from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException
from . import models, schemas
from datetime import datetime, timedelta
import statistics
import uuid

# Configurable constants
MAX_FARMER_OVER_CAPACITY_PCT = 0.15 # 15%
MAX_LOSS_TOLERANCE_PCT = 0.02 # 2% loss tolerance
SPIKE_Z_SCORE_THRESHOLD = 3.0 # Z-score for spike detection

def generate_flag(db: Session, entity_type: str, entity_id: str, flag_type: str, severity: str, details: dict):
    flag = models.Flag(
        source_engine="Engine A",
        entity_type=entity_type,
        entity_id=entity_id,
        flag_type=flag_type,
        severity=severity,
        details=details
    )
    db.add(flag)
    db.commit()
    db.refresh(flag)
    return flag

def check_farmer_capacity(db: Session, farmer_id: int, declared_volume: float, collection_date: str):
    # Total expected yield of all healthy livestock owned by farmer
    livestock = db.query(models.Livestock).filter(
        models.Livestock.farmer_id == farmer_id,
        models.Livestock.health_status == "healthy"
    ).all()
    
    total_expected = sum([animal.expected_yield_liters for animal in livestock])
    
    if total_expected == 0:
        generate_flag(db, "Farmer", str(farmer_id), "Zero Capacity", "high", {
            "declared_volume": declared_volume,
            "message": "Farmer has no registered healthy livestock or expected yield is zero."
        })
        return
        
    max_allowed = total_expected * (1 + MAX_FARMER_OVER_CAPACITY_PCT)
    
    if declared_volume > max_allowed:
        generate_flag(db, "Farmer", str(farmer_id), "Capacity Exceeded", "high", {
            "expected_capacity": total_expected,
            "max_allowed": max_allowed,
            "declared_volume": declared_volume,
            "overage_pct": ((declared_volume - total_expected) / total_expected) * 100
        })

def check_farmer_volume_spike(db: Session, farmer_id: int, declared_volume: float, collection_date: str):
    # Get last 7 days of batches for this farmer
    recent_batches = db.query(models.Batch).filter(
        models.Batch.source_id == farmer_id,
        models.Batch.collection_date != collection_date
    ).order_by(models.Batch.timestamp.desc()).limit(14).all()
    
    if len(recent_batches) < 3:
        return # Not enough historical data to calculate z-score
        
    volumes = [b.volume_liters for b in recent_batches]
    mean_vol = statistics.mean(volumes)
    std_vol = statistics.stdev(volumes) if len(volumes) > 1 else 1.0
    
    if std_vol == 0:
        std_vol = 1.0 # Prevent division by zero
        
    z_score = (declared_volume - mean_vol) / std_vol
    
    if z_score > SPIKE_Z_SCORE_THRESHOLD:
        generate_flag(db, "Farmer", str(farmer_id), "Volume Spike", "medium", {
            "declared_volume": declared_volume,
            "historical_mean": mean_vol,
            "historical_std": std_vol,
            "z_score": z_score
        })

def check_reconciliation(db: Session, entity_type: str, entity_id: int, target_volume: float, parent_batch_ids: list[str]):
    if not parent_batch_ids:
        # Invalid input, not a data fraud flag but an error
        raise HTTPException(status_code=400, detail=f"{entity_type} must provide parent_batch_ids to aggregate.")
        
    # Fetch all parent batches that are directed to this entity
    parent_batches = db.query(models.Batch).filter(
        models.Batch.id.in_(parent_batch_ids),
        models.Batch.destination_id == entity_id
    ).all()
    
    if len(parent_batches) != len(parent_batch_ids):
        raise HTTPException(status_code=400, detail=f"One or more parent batches not found or not assigned to this {entity_type}.")
        
    total_input = sum([batch.volume_liters for batch in parent_batches])
    
    # Check if they are forwarding MORE than what they received (plus tolerance)
    if target_volume > (total_input * (1 + MAX_LOSS_TOLERANCE_PCT)):
        generate_flag(db, entity_type, str(entity_id), "Output Exceeds Input", "critical", {
            "total_input": total_input,
            "target_volume_out": target_volume,
            "discrepancy": target_volume - total_input
        })

def process_farmer_collection(db: Session, event: schemas.CollectionEvent):
    date_str = event.collection_date or datetime.utcnow().strftime("%Y-%m-%d")
    
    # 1. Capacity check
    check_farmer_capacity(db, event.farmer_id, event.volume_liters, date_str)
    
    # 2. Spike detection
    check_farmer_volume_spike(db, event.farmer_id, event.volume_liters, date_str)
    
    # 3. Create the batch record
    batch = models.Batch(
        id=str(uuid.uuid4()),
        source_id=event.farmer_id,
        destination_id=event.center_id,
        volume_liters=event.volume_liters,
        collection_date=date_str,
        status="created"
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch

def process_center_forwarding(db: Session, event: schemas.CenterEvent):
    date_str = event.collection_date or datetime.utcnow().strftime("%Y-%m-%d")
    
    # 1. Reconciliation check
    check_reconciliation(db, "Center", event.center_id, event.volume_out_liters, event.parent_batch_ids)
    
    # 2. Mark parent batches as aggregated
    db.query(models.Batch).filter(models.Batch.id.in_(event.parent_batch_ids)).update({"status": "aggregated"}, synchronize_session=False)
    
    # 3. Create the new forwarded batch
    batch = models.Batch(
        id=str(uuid.uuid4()),
        source_id=event.center_id,
        destination_id=event.destination_id,
        volume_liters=event.volume_out_liters,
        collection_date=date_str,
        status="processed",
        parent_batch_ids=event.parent_batch_ids
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch

def process_factory_forwarding(db: Session, event: schemas.FactoryEvent):
    date_str = event.collection_date or datetime.utcnow().strftime("%Y-%m-%d")
    
    # 1. Reconciliation check
    check_reconciliation(db, "Manufacturer", event.factory_id, event.volume_out_liters, event.parent_batch_ids)
    
    # 2. Mark parent batches as aggregated
    db.query(models.Batch).filter(models.Batch.id.in_(event.parent_batch_ids)).update({"status": "aggregated"}, synchronize_session=False)
    
    # 3. Create the new forwarded batch
    batch = models.Batch(
        id=str(uuid.uuid4()),
        source_id=event.factory_id,
        volume_liters=event.volume_out_liters,
        collection_date=date_str,
        status="processed",
        parent_batch_ids=event.parent_batch_ids
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch
