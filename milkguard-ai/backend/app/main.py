from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import List, Optional

from . import models, schemas, auth, database, engine_a, engine_b, engine_c, traceability, consumer
from .database import engine
from prometheus_fastapi_instrumentator import Instrumentator
from fastapi.middleware.cors import CORSMiddleware

# Create the database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="MilkGuard AI Backend", description="Core API for MilkGuard AI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all for local dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Instrumentator().instrument(app).expose(app)

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "backend"}

@app.get("/")
def read_root():
    return {"message": "Welcome to MilkGuard AI API"}

@app.post("/register", response_model=schemas.UserResponse)
def register_user(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = auth.get_password_hash(user.password)
    new_user = models.User(
        email=user.email,
        hashed_password=hashed_password,
        role=user.role,
        name=user.name,
        latitude=user.latitude,
        longitude=user.longitude
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/token", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

import uuid

@app.get("/users/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@app.post("/batches", response_model=schemas.BatchResponse)
def create_batch(batch: schemas.BatchCreate, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(database.get_db)):
    batch_id = str(uuid.uuid4())
    
    # Engine A (Volume/Capacity Check)
    engine_a.run_engine_a_checks(db, current_user, batch)
    
    new_batch = models.Batch(
        id=batch_id,
        source_id=current_user.id,
        destination_id=batch.destination_id,
        volume_liters=batch.volume_liters,
        status="created",
        parent_batch_ids=batch.parent_batch_ids
    )
    db.add(new_batch)
    db.commit()
    db.refresh(new_batch)
    return new_batch

@app.post("/livestock", response_model=schemas.LivestockResponse)
def add_livestock(livestock: schemas.LivestockCreate, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(database.get_db)):
    if current_user.role != models.RoleEnum.FARMER:
        raise HTTPException(status_code=403, detail="Only farmers can register livestock")
        
    new_animal = models.Livestock(
        jio_tag=livestock.jio_tag,
        farmer_id=current_user.id,
        species=livestock.species,
        expected_yield_liters=livestock.expected_yield_liters
    )
    db.add(new_animal)
    db.commit()
    db.refresh(new_animal)
    return new_animal

@app.post("/quality-reports", response_model=schemas.QualityReportResponse)
def create_quality_report(report: schemas.QualityReportCreate, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(database.get_db)):
    # Run Engine B inference
    is_adulterated, confidence = engine_b.predict_adulteration(
        peroxidase=report.peroxidase_activity,
        enose_s02=report.enose_sensor_s02,
        formalin=report.formalin_test,
        enose_s01=report.enose_sensor_s01,
        formaldehyde=report.formaldehyde_ppm,
        ffa=report.ffa_linoleic_c18_2_pct
    )
    
    new_report = models.QualityReport(
        batch_id=report.batch_id,
        is_safe=not is_adulterated,
        ml_confidence_score=confidence
    )
    db.add(new_report)
    db.commit()
    db.refresh(new_report)
    return new_report

@app.post("/quick-check/estimate", response_model=schemas.QuickCheckResponse)
def quick_check_estimate(params: schemas.QuickCheckParams, db: Session = Depends(database.get_db)):
    result = engine_c.evaluate_quick_check(params)
    
    # Optionally log flags if suspicious and a batch_id was provided
    if result.is_suspicious and params.batch_id:
        flag = models.Flag(
            source_engine="manual_quick_check",
            entity_type="Batch",
            entity_id=params.batch_id,
            flag_type="quick_check_anomaly",
            severity="medium",
            details={
                "likelihood_pct": result.adulteration_likelihood_pct,
                "parameters": [p.dict() for p in result.parameters]
            }
        )
        db.add(flag)
        db.commit()
        
    return result

@app.post("/engine-a/collection-events")
def ingest_collection_event(event: schemas.CollectionEvent, db: Session = Depends(database.get_db)):
    batch = engine_a.process_farmer_collection(db, event)
    return {"message": "Collection event processed", "batch_id": batch.id}

@app.post("/engine-a/center-events")
def ingest_center_event(event: schemas.CenterEvent, db: Session = Depends(database.get_db)):
    batch = engine_a.process_center_forwarding(db, event)
    return {"message": "Center event processed", "batch_id": batch.id}
@app.get("/flags", response_model=List[schemas.FlagResponse])
def get_flags(
    entity_type: Optional[str] = None, 
    entity_id: Optional[str] = None,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    query = db.query(models.Flag)
    
    # Role-based scoping
    if current_user.role in [models.RoleEnum.FARMER, models.RoleEnum.MIDDLEMAN, models.RoleEnum.MANUFACTURER, models.RoleEnum.CONSUMER]:
        # Filter to only show flags belonging to their specific entity ID
        query = query.filter(models.Flag.entity_id == str(current_user.id))
        
    if entity_type:
        query = query.filter(models.Flag.entity_type == entity_type)
    if entity_id:
        # Prevent users from circumventing the scope by providing a different entity_id
        if current_user.role not in [models.RoleEnum.FARMER, models.RoleEnum.MIDDLEMAN, models.RoleEnum.MANUFACTURER, models.RoleEnum.CONSUMER] or entity_id == str(current_user.id):
            query = query.filter(models.Flag.entity_id == entity_id)
            
    return query.order_by(models.Flag.created_at.desc()).all()

from . import traceability
from fastapi import HTTPException

@app.post("/traceability/delivery")
def ingest_consumer_delivery(delivery: schemas.ConsumerDelivery, db: Session = Depends(database.get_db)):
    try:
        batch = traceability.process_consumer_delivery(db, delivery)
        return {"message": "Consumer delivery processed", "batch_id": batch.id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/traceability/backward/{batch_id}", response_model=schemas.TraceabilityNode)
def backward_trace(batch_id: str, db: Session = Depends(database.get_db)):
    node = traceability.get_backward_trace(db, batch_id)
    if not node:
        raise HTTPException(status_code=404, detail="Batch not found")
    return node

@app.get("/traceability/forward/{batch_id}", response_model=schemas.TraceabilityNode)
def forward_trace(batch_id: str, db: Session = Depends(database.get_db)):
    node = traceability.get_forward_trace(db, batch_id)
    if not node:
        raise HTTPException(status_code=404, detail="Batch not found")
    return node

@app.get("/government/report/{batch_id}", response_model=schemas.GovernmentReport)
def government_report(batch_id: str, db: Session = Depends(database.get_db)):
    report = traceability.generate_government_report(db, batch_id)
    if not report:
        raise HTTPException(status_code=404, detail="Batch not found")
    return report

@app.get("/consumer/scan/{batch_id}", response_model=schemas.ConsumerScanResponse)
def get_consumer_scan(batch_id: str, db: Session = Depends(database.get_db)):
    return consumer.generate_consumer_scan(db, batch_id)

from sqlalchemy import func
from datetime import datetime, timedelta

@app.get("/dashboard/summary")
def get_dashboard_summary(db: Session = Depends(database.get_db)):
    total_users = db.query(func.count(models.User.id)).scalar()
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    total_users_delta = db.query(func.count(models.User.id)).filter(models.User.created_at >= thirty_days_ago).scalar()
    
    active_batches = db.query(func.count(models.Batch.id)).filter(models.Batch.status != "processed").scalar()
    fraud_alerts_count = db.query(func.count(models.Flag.id)).filter(models.Flag.resolved == False).scalar()
    
    return {
        "total_users": total_users,
        "total_users_delta": total_users_delta,
        "active_batches": active_batches,
        "shipments_in_transit": 0, # There is no shipment tracking table yet
        "fraud_alerts_count": fraud_alerts_count
    }

@app.get("/dashboard/collection-trends")
def get_collection_trends(days: int = 7, db: Session = Depends(database.get_db)):
    cutoff = datetime.utcnow() - timedelta(days=days)
    results = db.query(
        models.Batch.collection_date,
        func.sum(models.Batch.volume_liters).label('total_volume')
    ).filter(models.Batch.timestamp >= cutoff).group_by(models.Batch.collection_date).order_by(models.Batch.collection_date.asc()).all()
    
    trends = []
    for row in results:
        trends.append({"date": row[0], "volume": row[1]})
    return trends

@app.get("/batches/recent")
def get_recent_batches(limit: int = 10, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(database.get_db)):
    query = db.query(models.Batch)
    if current_user.role in [models.RoleEnum.FARMER, models.RoleEnum.MIDDLEMAN, models.RoleEnum.MANUFACTURER]:
         # For farmer, show batches they created. For middleman/factory, show batches directed to them.
         # For simplicity, scope to where source_id == their id or destination_id == their id
         from sqlalchemy import or_
         query = query.filter(or_(models.Batch.source_id == current_user.id, models.Batch.destination_id == current_user.id))
    
    batches = query.order_by(models.Batch.timestamp.desc()).limit(limit).all()
    return batches

@app.get("/operations/live-locations")
def get_live_locations(db: Session = Depends(database.get_db)):
    # Return users that are middlemen or manufacturers with coordinates
    nodes = db.query(models.User).filter(
        models.User.role.in_([models.RoleEnum.MIDDLEMAN, models.RoleEnum.MANUFACTURER]),
        models.User.latitude.isnot(None),
        models.User.longitude.isnot(None)
    ).all()
    
    locations = []
    for n in nodes:
        # Check if they have active flags
        active_flags = db.query(func.count(models.Flag.id)).filter(
            models.Flag.entity_id == str(n.id), 
            models.Flag.resolved == False
        ).scalar()
        
        locations.append({
            "id": n.id,
            "name": n.name or f"{n.role.value.capitalize()} #{n.id}",
            "role": n.role.value,
            "latitude": n.latitude,
            "longitude": n.longitude,
            "status": "alert" if active_flags > 0 else "active"
        })
    return locations
