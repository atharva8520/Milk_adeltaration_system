from sqlalchemy.orm import Session
from collections import defaultdict
from . import models, schemas, traceability
from .engine_a import MAX_MIDDLEMAN_LOSS_PCT

def calculate_composition_breakdown(db: Session, batch_id: str):
    trace = traceability.get_backward_trace(db, batch_id)
    if not trace:
        return []
        
    # Dictionary to hold the final volume allocation
    # keys: entity name ("Farmer A", "Unknown Source", "Processing Loss")
    # values: volume in liters
    allocations = defaultdict(float)
    
    def traverse(node: schemas.TraceabilityNode, allocated_volume: float):
        if not node: return
        
        source_user = db.query(models.User).filter(models.User.id == node.source_id).first()
        if source_user and source_user.role.value == "farmer":
            # Leaf node!
            name = "Verified Local Farm" if source_user.is_anonymous else (source_user.name or f"Farm #{source_user.id}")
            allocations[name] += allocated_volume
            return
            
        if not node.parents:
            # If it's not a farmer and has no parents, the entire allocated volume is unknown
            allocations["Unknown Source"] += allocated_volume
            return
            
        sum_parent_vol = sum(p.volume_liters for p in node.parents)
        
        # Calculate how much of the current node's volume came from parents
        if node.volume_liters > sum_parent_vol:
            # Output exceeded input!
            gap = node.volume_liters - sum_parent_vol
            gap_pct = gap / sum_parent_vol if sum_parent_vol > 0 else float('inf')
            
            # The shortfall is passed down to be allocated
            # If the gap exceeds the Engine A tolerance, it's flagged as Unknown Source
            # We scale the gap proportional to the allocated_volume of this node in the final batch
            allocated_gap = allocated_volume * (gap / node.volume_liters)
            if gap_pct <= MAX_MIDDLEMAN_LOSS_PCT:
                allocations["Processing Loss"] += allocated_gap
            else:
                allocations["Unknown Source"] += allocated_gap
                
            # The remaining volume is distributed to parents
            allocated_from_parents = allocated_volume - allocated_gap
            for p in node.parents:
                parent_share = (p.volume_liters / sum_parent_vol) * allocated_from_parents
                traverse(p, parent_share)
        else:
            # Output is less than or equal to input (normal processing)
            for p in node.parents:
                parent_share = (p.volume_liters / sum_parent_vol) * allocated_volume
                traverse(p, parent_share)
                
    traverse(trace, trace.volume_liters)
    
    # Convert absolute volumes to percentages of the final batch
    total_vol = sum(allocations.values())
    if total_vol == 0:
        return []
        
    breakdown = []
    for name, vol in allocations.items():
        pct = (vol / total_vol) * 100
        # Round to 1 decimal place
        if pct >= 0.1: # Only include if it rounds to at least 0.1%
            breakdown.append({
                "name": name,
                "percentage": round(pct, 1)
            })
            
    # Sort by percentage descending
    breakdown.sort(key=lambda x: x["percentage"], reverse=True)
    return breakdown
