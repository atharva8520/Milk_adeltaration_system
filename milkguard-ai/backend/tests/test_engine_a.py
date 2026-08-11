import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app import models, engine_a
from app.schemas import CollectionEvent, CenterEvent
from datetime import datetime, timedelta

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture()
def db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

def setup_farmer_and_livestock(db, expected_yield=20.0):
    farmer = models.User(email="farmer@test.com", hashed_password="pw", role=models.RoleEnum.FARMER)
    db.add(farmer)
    db.commit()
    db.refresh(farmer)
    
    livestock = models.Livestock(jio_tag="tag1", farmer_id=farmer.id, expected_yield_liters=expected_yield)
    db.add(livestock)
    db.commit()
    
    return farmer.id

def test_farmer_capacity_normal(db):
    farmer_id = setup_farmer_and_livestock(db, expected_yield=20.0)
    event = CollectionEvent(farmer_id=farmer_id, volume_liters=18.0)
    
    batch = engine_a.process_farmer_collection(db, event)
    
    flags = db.query(models.Flag).all()
    assert len(flags) == 0
    assert batch.volume_liters == 18.0

def test_farmer_capacity_fraud(db):
    farmer_id = setup_farmer_and_livestock(db, expected_yield=20.0)
    # Expected max is 20 * 1.15 = 23
    event = CollectionEvent(farmer_id=farmer_id, volume_liters=25.0)
    
    engine_a.process_farmer_collection(db, event)
    
    flags = db.query(models.Flag).filter_by(flag_type="Capacity Exceeded").all()
    assert len(flags) == 1
    assert flags[0].severity == "high"

def test_middleman_reconciliation_normal(db):
    center_id = 99
    # Create two input batches
    b1 = models.Batch(id="b1", source_id=1, destination_id=center_id, volume_liters=100.0)
    b2 = models.Batch(id="b2", source_id=2, destination_id=center_id, volume_liters=100.0)
    db.add_all([b1, b2])
    db.commit()
    
    event = CenterEvent(center_id=center_id, volume_out_liters=198.0, parent_batch_ids=["b1", "b2"])
    
    batch = engine_a.process_center_forwarding(db, event)
    flags = db.query(models.Flag).all()
    
    assert len(flags) == 0
    assert batch.volume_liters == 198.0

def test_middleman_reconciliation_fraud(db):
    center_id = 99
    b1 = models.Batch(id="b1", source_id=1, destination_id=center_id, volume_liters=100.0)
    db.add(b1)
    db.commit()
    
    # 100 in, 105 out. Tolerance is 2%, so max is 102
    event = CenterEvent(center_id=center_id, volume_out_liters=105.0, parent_batch_ids=["b1"])
    
    engine_a.process_center_forwarding(db, event)
    flags = db.query(models.Flag).filter_by(flag_type="Output Exceeds Input").all()
    
    assert len(flags) == 1
    assert flags[0].severity == "critical"

def test_farmer_volume_spike(db):
    farmer_id = setup_farmer_and_livestock(db, expected_yield=100.0)
    
    # Insert 10 days of normal history (avg ~20)
    for i in range(10):
        d = (datetime.utcnow() - timedelta(days=i+1)).strftime("%Y-%m-%d")
        db.add(models.Batch(id=f"hist_{i}", source_id=farmer_id, volume_liters=20.0, collection_date=d))
    db.commit()
    
    # Now sudden spike to 50 (within capacity 100, but anomalous)
    event = CollectionEvent(farmer_id=farmer_id, volume_liters=50.0)
    engine_a.process_farmer_collection(db, event)
    
    flags = db.query(models.Flag).filter_by(flag_type="Volume Spike").all()
    assert len(flags) == 1
    assert flags[0].severity == "medium"
