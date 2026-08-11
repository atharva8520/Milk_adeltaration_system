from . import schemas

# Sources for standard reference ranges:
# pH & Density: BIS IS 1479 (Part 1) / FSSAI Manual for Dairy Products
# Fat & SNF: FSSAI Milk & Milk Products Regulations (Standard Minimums for Cow Milk)
# Formaldehyde & Formalin: FSSAI strictly prohibits preservatives. Must be exactly 0.
# Peroxidase Activity: Positive (1) indicates properly pasteurized or raw milk. Negative (0) is suspicious (synthetic/over-boiled).

REFERENCE_RANGES = {
    "ph": {"min": 6.5, "max": 6.8, "unit": "", "ref": "BIS IS 1479 (Part 1)"},
    "density": {"min": 1.028, "max": 1.033, "unit": "g/cm3", "ref": "BIS IS 1479 (Part 1)"},
    "fat_pct": {"min": 3.2, "max": 100.0, "unit": "%", "ref": "FSSAI Minimum Standard"},
    "snf_pct": {"min": 8.3, "max": 100.0, "unit": "%", "ref": "FSSAI Minimum Standard"},
    "formaldehyde_ppm": {"min": 0.0, "max": 0.0, "unit": "ppm", "ref": "FSSAI (Strict Prohibition)"},
    "formalin_test": {"min": 0.0, "max": 0.0, "unit": "", "ref": "FSSAI (Strict Prohibition)"},
    "peroxidase_activity": {"expected_binary": 1, "ref": "Qualitative Storch's Test (FSSAI)"},
    "ffa_linoleic_c18_2_pct": {"min": 0.0, "max": 4.0, "unit": "%", "ref": "Literature typical bounds"},
    "enose_sensor_s01": {"min": 0.0, "max": 2.0, "unit": "", "ref": "Baseline sensor response"},
    "enose_sensor_s02": {"min": 0.0, "max": 2.0, "unit": "", "ref": "Baseline sensor response"}
}

def calculate_deviation(param_name, value):
    ref = REFERENCE_RANGES.get(param_name)
    if not ref:
        return 0.0, "Normal", "N/A"

    if "expected_binary" in ref:
        range_str = f"Must be {ref['expected_binary']} ({ref['ref']})"
        if value != ref['expected_binary']:
            return 100.0, "Suspicious", range_str
        return 0.0, "Normal", range_str

    min_v = ref["min"]
    max_v = ref["max"]
    range_str = f"{min_v} - {max_v} {ref['unit']} ({ref['ref']})"

    if min_v <= value <= max_v:
        return 0.0, "Normal", range_str

    if value < min_v:
        dev = ((min_v - value) / min_v) * 100 if min_v != 0 else 100
    else:
        # value > max_v
        dev = ((value - max_v) / max_v) * 100 if max_v != 0 else 100

    # For critically prohibited items, any deviation is suspicious
    if max_v == 0.0 and min_v == 0.0:
        dev = 100.0
        status = "Suspicious"
    else:
        if dev > 10.0:
            status = "Suspicious"
        elif dev > 5.0:
            status = "Borderline"
        else:
            status = "Normal"

    return dev, status, range_str

def evaluate_quick_check(params: schemas.QuickCheckParams) -> schemas.QuickCheckResponse:
    param_dict = params.dict(exclude_none=True, exclude={"batch_id"})
    
    results = []
    max_dev = 0.0

    for p, val in param_dict.items():
        dev, status, ref_str = calculate_deviation(p, val)
        max_dev = max(max_dev, dev)
        results.append(schemas.ParameterCheckResult(
            parameter=p,
            value_entered=val,
            reference_range=ref_str,
            deviation_pct=round(dev, 2),
            status=status
        ))

    # Worst-parameter-dominates logic: 
    # If any single parameter is 100% off or explicitly Suspicious/Prohibited, likelihood caps at 100%
    # Otherwise scale the max deviation (e.g. 10% deviation = 100% suspicious if cap is 10)
    likelihood = min(max_dev * 10, 100.0)
    
    is_suspicious = likelihood > 50.0 or any(r.status == "Suspicious" for r in results)
    
    # If there's an explicit critical violation, ensure likelihood is very high
    if is_suspicious and likelihood < 80.0:
        likelihood = 80.0

    note = "Quick Check (Estimate) — not a certified lab result."
    # Upgrade path note: Once we have real dataset labels that incorporate pH/density, 
    # this logic can feed into or be replaced by Engine B ML predictions.

    return schemas.QuickCheckResponse(
        adulteration_likelihood_pct=round(likelihood, 1),
        parameters=results,
        is_suspicious=is_suspicious,
        note=note
    )
