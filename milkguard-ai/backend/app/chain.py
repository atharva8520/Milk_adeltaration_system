from sqlalchemy.orm import Session
from . import models, traceability, engine_c

def get_pipeline(db: Session, batch_id: str):
    # Find batch
    batch = db.query(models.Batch).filter(models.Batch.id == batch_id).first()
    if not batch:
        return {"error": "Batch not found"}

    # We use backward and forward trace to build a single path representing the primary flow
    # A single batch_id could theoretically have multiple paths (if multiple parents), but we
    # flatten to show the linear path involving this batch_id.
    
    node_b = traceability.get_backward_trace(db, batch_id)
    node_f = traceability.get_forward_trace(db, batch_id)
    
    if not node_b and not node_f:
        # fallback
        node_b = traceability.TraceabilityNode(
            batch_id=batch.id,
            source_id=batch.source_id,
            destination_id=batch.destination_id,
            volume_liters=batch.volume_liters,
            timestamp=batch.timestamp
        )

    # Build backward path
    b_path = []
    current = node_b
    while current:
        b_path.append(current)
        current = current.parents[0] if current.parents else None
    b_path.reverse() # Farmer -> ... -> current batch
    
    # Build forward path (excluding current batch)
    f_path = []
    current = node_f.children[0] if node_f and node_f.children else None
    while current:
        f_path.append(current)
        current = current.children[0] if current.children else None
        
    full_path = b_path + f_path
    
    stages = []
    overall_red_alert = False
    fssai_reference = "https://fssai.gov.in/"
    violations = []
    
    previous_stage_quality = None
    
    for n in full_path:
        source_user = db.query(models.User).filter(models.User.id == n.source_id).first()
        if not source_user:
            continue
            
        stage_obj = {
            "role": source_user.role.value if source_user.role else "unknown",
            "entity_name": source_user.name or f"{source_user.role.value.capitalize()} #{source_user.id}",
            "latitude": source_user.latitude,
            "longitude": source_user.longitude,
            "volume_liters": n.volume_liters,
            "timestamp": n.timestamp.isoformat(),
            "quality": {},
            "is_flagged": False
        }
        
        # Check flags for this entity
        entity_flags = db.query(models.Flag).filter(
            models.Flag.entity_id == str(n.source_id),
            models.Flag.resolved == False
        ).all()
        
        if any(f.severity in ["high", "critical"] for f in entity_flags):
            stage_obj["is_flagged"] = True
            overall_red_alert = True
            violations.append(f"[{stage_obj['role'].capitalize()}] Entity has unresolved high/critical flags.")
            
        # Pull QualityReport
        qr = db.query(models.QualityReport).filter(models.QualityReport.batch_id == n.batch_id).order_by(models.QualityReport.timestamp.desc()).first()
        if qr:
            # Map parameters
            params_to_check = {
                "fat_pct": qr.fat_percentage,
                "snf_pct": qr.snf_percentage,
                "ph": qr.ph_level,
                "density": qr.density_g_cm3,
                "temperature": qr.temperature_c,
                "peroxidase_activity": qr.peroxidase_activity,
                "enose_sensor_s02": qr.enose_sensor_s02,
                "formalin_test": qr.formalin_test,
                "enose_sensor_s01": qr.enose_sensor_s01,
                "formaldehyde_ppm": qr.formaldehyde_ppm,
                "ffa_linoleic_c18_2_pct": qr.ffa_linoleic_c18_2_pct,
                "urea_mg": qr.urea_mg,
                "water_addition_pct": qr.water_addition_pct,
                "starch_test": qr.starch_test,
                "detergent_test": qr.detergent_test
            }
            
            for param, val in params_to_check.items():
                if val is not None:
                    dev, status, ref_str = engine_c.calculate_deviation(param, val)
                    stage_obj["quality"][param] = {
                        "value": val,
                        "status": status,
                        "range": ref_str
                    }
                    if status == "Suspicious":
                        overall_red_alert = True
                        stage_obj["is_flagged"] = True
                        violations.append(f"[{stage_obj['role'].capitalize()}] {param} out of bounds: {val} (Expected: {ref_str})")

            # check deltas against previous stage
            if previous_stage_quality:
                # check fat
                prev_fat = previous_stage_quality.get("fat_pct")
                curr_fat = stage_obj["quality"].get("fat_pct")
                if prev_fat and curr_fat:
                    delta_fat = curr_fat["value"] - prev_fat["value"]
                    if delta_fat < -0.2:
                        overall_red_alert = True
                        stage_obj["is_flagged"] = True
                        violations.append(f"[{stage_obj['role'].capitalize()}] Suspicious Fat drop: {delta_fat:.2f}% (Possible skimming/water addition)")
                        
                # check snf
                prev_snf = previous_stage_quality.get("snf_pct")
                curr_snf = stage_obj["quality"].get("snf_pct")
                if prev_snf and curr_snf:
                    delta_snf = curr_snf["value"] - prev_snf["value"]
                    if delta_snf < -0.2:
                        overall_red_alert = True
                        stage_obj["is_flagged"] = True
                        violations.append(f"[{stage_obj['role'].capitalize()}] Suspicious SNF drop: {delta_snf:.2f}% (Possible adulteration)")
                        
                # check density
                prev_density = previous_stage_quality.get("density")
                curr_density = stage_obj["quality"].get("density")
                if prev_density and curr_density:
                    delta_density = curr_density["value"] - prev_density["value"]
                    if abs(delta_density) > 0.002:
                        overall_red_alert = True
                        stage_obj["is_flagged"] = True
                        violations.append(f"[{stage_obj['role'].capitalize()}] Suspicious Density shift: {delta_density:.4f} g/cm3")

            previous_stage_quality = stage_obj["quality"]

        stages.append(stage_obj)
        
    # Check if destination user (e.g. consumer) should be added as a stage
    if full_path:
        last_node = full_path[-1]
        if last_node.destination_id:
            dest_user = db.query(models.User).filter(models.User.id == last_node.destination_id).first()
            if dest_user and dest_user.role.value == "consumer":
                stages.append({
                    "role": "consumer",
                    "entity_name": dest_user.name or f"Consumer #{dest_user.id}",
                    "volume_liters": last_node.volume_liters,
                    "timestamp": last_node.timestamp.isoformat(),
                    "quality": {},
                    "is_flagged": False
                })
            
    return {
        "unique_id": batch_id,
        "stages": stages,
        "overall_status": "flagged" if overall_red_alert else "safe",
        "red_alert": overall_red_alert,
        "fssai_reference": fssai_reference,
        "violations": violations
    }
