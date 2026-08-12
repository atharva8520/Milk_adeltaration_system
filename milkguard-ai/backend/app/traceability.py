from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional, List
import uuid

from . import models, schemas

def process_consumer_delivery(db: Session, delivery: schemas.ConsumerDelivery) -> models.Batch:
    # We record this delivery as a final batch with the consumer as destination
    batch_id = str(uuid.uuid4())
    
    # We must find the parent batch to verify its existence
    parent_batch = db.query(models.Batch).filter(models.Batch.id == delivery.parent_batch_id).first()
    if not parent_batch:
        raise ValueError("Parent batch not found")
        
    date_str = delivery.collection_date or datetime.utcnow().strftime("%Y-%m-%d")
    
    new_batch = models.Batch(
        id=batch_id,
        source_id=parent_batch.destination_id or parent_batch.source_id, # Fallback to source if destination is not set
        destination_id=delivery.consumer_id,
        volume_liters=delivery.volume_liters,
        collection_date=date_str,
        status="delivered",
        parent_batch_ids=[delivery.parent_batch_id]
    )
    
    db.add(new_batch)
    db.commit()
    db.refresh(new_batch)
    
    return new_batch

def get_backward_trace(db: Session, batch_id: str) -> Optional[schemas.TraceabilityNode]:
    batch = db.query(models.Batch).filter(models.Batch.id == batch_id).first()
    if not batch:
        return None
        
    node = schemas.TraceabilityNode(
        batch_id=batch.id,
        source_id=batch.source_id,
        destination_id=batch.destination_id,
        volume_liters=batch.volume_liters,
        timestamp=batch.timestamp,
        parents=[],
        children=None
    )
    
    if batch.parent_batch_ids:
        for pid in batch.parent_batch_ids:
            parent_node = get_backward_trace(db, pid)
            if parent_node:
                node.parents.append(parent_node)
                
    return node

def get_forward_trace(db: Session, batch_id: str) -> Optional[schemas.TraceabilityNode]:
    batch = db.query(models.Batch).filter(models.Batch.id == batch_id).first()
    if not batch:
        return None
        
    node = schemas.TraceabilityNode(
        batch_id=batch.id,
        source_id=batch.source_id,
        destination_id=batch.destination_id,
        volume_liters=batch.volume_liters,
        timestamp=batch.timestamp,
        parents=None,
        children=[]
    )
    
    # In SQLite/Postgres with JSON arrays, filtering is tricky.
    # For now, we will fetch batches that might be children
    # We know children usually have a higher timestamp or were created later.
    # A robust way is to query where parent_batch_ids contains batch_id.
    # In SQLite, we can just fetch all and filter in python for this MVP graph traversal, or use string like.
    # Postgres supports `jsonb_contains` but let's do a simple text match for the list string repr for cross-compatibility.
    
    # Fetch batches (without timestamp filter to avoid SQLite precision bugs during rapid tests)
    potential_children = db.query(models.Batch).all()
    
    for p in potential_children:
        if p.parent_batch_ids and batch.id in p.parent_batch_ids:
            child_node = get_forward_trace(db, p.id)
            if child_node:
                node.children.append(child_node)
                
    return node

def generate_government_report(db: Session, batch_id: str) -> Optional[schemas.GovernmentReport]:
    batch = db.query(models.Batch).filter(models.Batch.id == batch_id).first()
    if not batch:
        return None
        
    # Get Graph
    backward = get_backward_trace(db, batch_id)
    forward = get_forward_trace(db, batch_id)
    
    # Collect all entities in graph
    entity_ids = set()
    def extract_entities(node: schemas.TraceabilityNode, is_forward: bool):
        if not node: return
        entity_ids.add(node.source_id)
        if node.destination_id:
            entity_ids.add(node.destination_id)
        
        related = node.children if is_forward else node.parents
        if related:
            for r in related:
                extract_entities(r, is_forward)
                
    extract_entities(backward, is_forward=False)
    extract_entities(forward, is_forward=True)
    
    # Get all flags for these entities
    flags = []
    if entity_ids:
        flags = db.query(models.Flag).filter(models.Flag.entity_id.in_([str(eid) for eid in entity_ids])).all()
        
    # Get all quality reports for the batches in the graph
    batch_ids = set()
    def extract_batches(node: schemas.TraceabilityNode, is_forward: bool):
        if not node: return
        batch_ids.add(node.batch_id)
        related = node.children if is_forward else node.parents
        if related:
            for r in related:
                extract_batches(r, is_forward)
                
    extract_batches(backward, is_forward=False)
    extract_batches(forward, is_forward=True)
    
    quality_reports = []
    if batch_ids:
        quality_reports = db.query(models.QualityReport).filter(models.QualityReport.batch_id.in_(list(batch_ids))).all()
        
    return {
        "batch": batch,
        "traceability_backward": backward,
        "traceability_forward": forward,
        "flags": flags,
        "quality_reports": quality_reports,
        "generated_at": datetime.utcnow()
    }
