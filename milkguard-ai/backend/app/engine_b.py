import os
import requests

ML_SERVICE_URL = os.getenv("ML_SERVICE_URL", "http://ml-service:8001")

def predict_adulteration(peroxidase, enose_s02, formalin, enose_s01, formaldehyde, ffa):
    payload = {
        "peroxidase_activity": peroxidase,
        "enose_sensor_s02": enose_s02,
        "formalin_test": formalin,
        "enose_sensor_s01": enose_s01,
        "formaldehyde_ppm": formaldehyde,
        "ffa_linoleic_c18_2_pct": ffa
    }
    
    try:
        response = requests.post(f"{ML_SERVICE_URL}/predict", json=payload, timeout=5.0)
        response.raise_for_status()
        data = response.json()
        return data["is_adulterated"], data["confidence_score"]
    except Exception as e:
        print(f"Error calling ML service: {e}")
        # Default to safe if ML service is down, or we could raise an error depending on strictness
        return False, 0.0

