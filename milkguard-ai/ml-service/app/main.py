from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import pandas as pd
from .model_loader import load_latest_model
from prometheus_fastapi_instrumentator import Instrumentator

app = FastAPI(title="MilkGuard AI - ML Service", description="Engine B Inference Service")

Instrumentator().instrument(app).expose(app)

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "ml-service"}

# Try loading the model on startup
model = load_latest_model()

class Features(BaseModel):
    peroxidase_activity: float
    enose_sensor_s02: float
    formalin_test: int
    enose_sensor_s01: float
    formaldehyde_ppm: float
    ffa_linoleic_c18_2_pct: float

class Prediction(BaseModel):
    is_adulterated: bool
    confidence_score: float

@app.post("/predict", response_model=Prediction)
def predict(features: Features):
    global model
    if model is None:
        # Try reloading if not available
        model = load_latest_model()
        if model is None:
            raise HTTPException(status_code=503, detail="ML Model is not currently available.")
            
    df = pd.DataFrame([{
        'Peroxidase_Activity': features.peroxidase_activity,
        'ENose_Sensor_S02': features.enose_sensor_s02,
        'Formalin_Test': features.formalin_test,
        'ENose_Sensor_S01': features.enose_sensor_s01,
        'Formaldehyde_ppm': features.formaldehyde_ppm,
        'FFA_Linoleic_C18_2_pct': features.ffa_linoleic_c18_2_pct
    }])
    
    try:
        proba = float(model.predict_proba(df)[0, 1])
        is_adulterated = bool(model.predict(df)[0])
        return Prediction(is_adulterated=is_adulterated, confidence_score=proba)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")

@app.get("/health")
def health_check():
    return {"status": "ok", "model_loaded": model is not None}
