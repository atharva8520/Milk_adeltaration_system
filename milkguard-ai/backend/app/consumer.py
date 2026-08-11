from sqlalchemy.orm import Session
from . import models, schemas, traceability, composition
from fastapi import HTTPException

def generate_consumer_scan(db: Session, batch_id: str) -> schemas.ConsumerScanResponse:
    # 1. Get backward trace
    try:
        trace = traceability.get_backward_trace(db, batch_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail="Batch not found")

    if not trace:
        raise HTTPException(status_code=404, detail="Batch not found")

    # 2. Gather all batches in lineage to collect flags and quality reports
    all_batch_ids = set()
    
    def collect_ids(node):
        if not node: return
        all_batch_ids.add(node.batch_id)
        if hasattr(node, "parents") and node.parents:
            for p in node.parents:
                collect_ids(p)
                
    collect_ids(trace)
    
    # 3. Fetch all flags for these batches
    flags = db.query(models.Flag).filter(
        models.Flag.entity_type == "Batch",
        models.Flag.entity_id.in_(all_batch_ids)
    ).all()
    
    # Check if there are any critical or high severity unresolved flags
    is_safe = True
    for f in flags:
        if not f.resolved and f.severity in ["critical", "high"]:
            is_safe = False
            break

    # 4. Fetch the latest quality report for composition
    composition_dict = {}
    reports = db.query(models.QualityReport).filter(
        models.QualityReport.batch_id.in_(all_batch_ids)
    ).order_by(models.QualityReport.timestamp.desc()).all()
    
    if reports:
        latest = reports[0]
        # Only expose non-ML raw parameters to consumer
        if latest.fat_percentage is not None: composition_dict["fat_pct"] = latest.fat_percentage
        if latest.snf_percentage is not None: composition_dict["snf_pct"] = latest.snf_percentage
        if latest.ph_level is not None: composition_dict["ph"] = latest.ph_level
        # Do not expose ML scores

    # 5. Build Timeline
    timeline = []
    
    def build_timeline(node):
        if not node: return
        
        # Determine entity
        source_user = db.query(models.User).filter(models.User.id == node.source_id).first()
        if source_user:
            role = source_user.role.value
            entity_name = "Unknown"
            if role == "farmer":
                entity_name = "Verified Local Farm" if source_user.is_anonymous else (source_user.name or f"Farm #{source_user.id}")
            elif role == "middleman":
                entity_name = "Certified Collection Center"
            else:
                entity_name = source_user.name or f"Facility #{source_user.id}"
                
            # Insert at beginning so we get chronological order (Farmer -> Center -> Retail)
            timeline.insert(0, schemas.TimelineEvent(
                stage=role.capitalize(),
                entity_name=entity_name,
                date=node.timestamp.isoformat() if hasattr(node.timestamp, 'isoformat') else node.timestamp
            ))
            
        if hasattr(node, "parents") and node.parents:
            # Just follow the first parent for simplicity in timeline if multiple (not ideal but works for MVP)
            # In a real multi-parent scenario, we'd build a tree UI.
            build_timeline(node.parents[0])
            
    build_timeline(trace)
    
    # Add Quality Check timeline event if reports exist
    if reports:
        timeline.append(schemas.TimelineEvent(
            stage="Quality Control",
            entity_name="Automated ML Screening",
            date=reports[0].timestamp.isoformat(),
            details={"status": "Passed" if is_safe else "Flagged"}
        ))
        
    timeline.append(schemas.TimelineEvent(
        stage="Retail",
        entity_name="Your Product",
        date=trace.timestamp.isoformat() if hasattr(trace.timestamp, 'isoformat') else trace.timestamp
    ))

    # 6. Calculate breakdown
    breakdown = composition.calculate_composition_breakdown(db, batch_id)

    note = "Note: Processing Loss and Measurement Tolerances are dynamically reconciled with upstream checkpoints."

    return schemas.ConsumerScanResponse(
        batch_id=batch_id,
        is_safe=is_safe,
        composition=composition_dict,
        composition_breakdown=breakdown,
        timeline=timeline,
        note=note
    )
