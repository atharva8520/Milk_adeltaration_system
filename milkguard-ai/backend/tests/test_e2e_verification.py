import pytest
import requests
from datetime import datetime

API_BASE = "http://localhost:8000"
ML_BASE = "http://ml-service:8001"

@pytest.fixture(scope="module")
def setup_data():
    # Direct DB injection for setup since we don't have endpoints for these
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    import sys
    import os
    
    # Add backend to path so we can import
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
    
    from app import models, auth
    from app.database import Base
    
    engine = create_engine("postgresql://milkguard_user:milkguard_password@postgres:5432/milkguard_db")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    # Clean previous seeds if any
    db.query(models.Flag).delete()
    db.query(models.QualityReport).delete()
    db.query(models.Batch).delete()
    db.query(models.Livestock).delete()
    db.query(models.User).filter(models.User.email.like("%@e2e.com")).delete()
    db.commit()
    
    farmer = models.User(email="farmer@e2e.com", hashed_password=auth.get_password_hash("pw"), role=models.RoleEnum.FARMER)
    center = models.User(email="center@e2e.com", hashed_password=auth.get_password_hash("pw"), role=models.RoleEnum.MIDDLEMAN)
    consumer = models.User(email="consumer@e2e.com", hashed_password=auth.get_password_hash("pw"), role=models.RoleEnum.CONSUMER)
    admin = models.User(email="admin@e2e.com", hashed_password=auth.get_password_hash("pw"), role=models.RoleEnum.ADMIN)
    db.add_all([farmer, center, consumer, admin])
    db.commit()
    
    farmer_id = farmer.id
    center_id = center.id
    consumer_id = consumer.id
    admin_id = admin.id
    
    livestock = models.Livestock(jio_tag="tag_e2e_1", farmer_id=farmer_id, expected_yield_liters=20.0)
    db.add(livestock)
    db.commit()
    
    db.close()
    
    # Login to get a token for center and admin
    import requests
    res = requests.post(f"{API_BASE}/token", data={"username": "center@e2e.com", "password": "pw"})
    token = res.json().get("access_token")
    
    res_admin = requests.post(f"{API_BASE}/token", data={"username": "admin@e2e.com", "password": "pw"})
    admin_token = res_admin.json().get("access_token")
    
    return {
        "farmer_id": farmer_id,
        "center_id": center_id,
        "consumer_id": consumer_id,
        "token": token,
        "admin_token": admin_token
    }

def test_1_health_checks():
    res = requests.get(f"{API_BASE}/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
    
    res = requests.get(f"{ML_BASE}/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

def test_2_normal_flow(setup_data):
    # Farmer -> Center
    d = datetime.utcnow().strftime("%Y-%m-%d")
    res = requests.post(f"{API_BASE}/engine-a/collection-events", json={
        "farmer_id": setup_data["farmer_id"],
        "center_id": setup_data["center_id"],
        "volume_liters": 18.0,
        "collection_date": d
    })
    assert res.status_code == 200
    batch_id = res.json()["batch_id"]
    
    res = requests.post(f"{API_BASE}/engine-a/center-events", json={
        "center_id": setup_data["center_id"],
        "volume_out_liters": 17.5,
        "collection_date": d,
        "parent_batch_ids": [batch_id]
    })
    assert res.status_code == 200
    
    # Assert no flags
    headers = {"Authorization": f"Bearer {setup_data['admin_token']}"}
    flags = requests.get(f"{API_BASE}/flags", headers=headers).json()
    assert len(flags) == 0

def test_3_fraud_flow(setup_data):
    # Farmer -> Center -> Quality -> Consumer
    d = datetime.utcnow().strftime("%Y-%m-%d")
    
    # 1. Farmer Fraud
    res = requests.post(f"{API_BASE}/engine-a/collection-events", json={
        "farmer_id": setup_data["farmer_id"],
        "center_id": setup_data["center_id"],
        "volume_liters": 40.0, # Expected is 20
        "collection_date": d
    })
    assert res.status_code == 200
    farmer_batch_id = res.json()["batch_id"]
    
    # 2. Middleman Fraud
    res = requests.post(f"{API_BASE}/engine-a/center-events", json={
        "center_id": setup_data["center_id"],
        "volume_out_liters": 50.0, # Received 40
        "collection_date": d,
        "parent_batch_ids": [farmer_batch_id]
    })
    assert res.status_code == 200
    center_batch_id = res.json()["batch_id"]
    
    # 3. Adulteration Quality Report
    headers = {"Authorization": f"Bearer {setup_data['token']}"}
    res = requests.post(f"{API_BASE}/quality-reports", headers=headers, json={
        "batch_id": center_batch_id,
        "fat_percentage": 4.0,
        "snf_percentage": 8.5,
        "ph_level": 6.7,
        "peroxidase_activity": 0.5, # Usually high if adulterated
        "enose_sensor_s02": 20.0,
        "formalin_test": 1.0,
        "enose_sensor_s01": 25.0,
        "formaldehyde_ppm": 2.0,
        "ffa_linoleic_c18_2_pct": 5.0
    })
    assert res.status_code == 200
    assert res.json()["is_safe"] == False
    
    # 4. Consumer Delivery
    res = requests.post(f"{API_BASE}/traceability/delivery", json={
        "consumer_id": setup_data["consumer_id"],
        "volume_liters": 1.0,
        "parent_batch_id": center_batch_id,
        "collection_date": d
    })
    assert res.status_code == 200
    consumer_batch_id = res.json()["batch_id"]
    
    pytest.fraud_batch_id = consumer_batch_id
    pytest.farmer_batch_id = farmer_batch_id

def test_4_verify_flags(setup_data):
    headers = {"Authorization": f"Bearer {setup_data['admin_token']}"}
    flags = requests.get(f"{API_BASE}/flags", headers=headers).json()
    assert len(flags) >= 2 # Capacity Exceeded + Output Exceeds Input
    flag_types = [f["flag_type"] for f in flags]
    assert "Capacity Exceeded" in flag_types
    assert "Output Exceeds Input" in flag_types

def test_5_traceability_and_reporting():
    batch_id = pytest.fraud_batch_id
    
    # Backward Trace
    res = requests.get(f"{API_BASE}/traceability/backward/{batch_id}")
    assert res.status_code == 200
    trace = res.json()
    assert trace["batch_id"] == batch_id
    assert len(trace["parents"]) > 0 # Has center parent
    assert len(trace["parents"][0]["parents"]) > 0 # Has farmer parent
    
    # Forward Trace from Farmer
    f_batch_id = pytest.farmer_batch_id
    res = requests.get(f"{API_BASE}/traceability/forward/{f_batch_id}")
    assert res.status_code == 200
    f_trace = res.json()
    assert f_trace["batch_id"] == f_batch_id
    assert len(f_trace["children"]) > 0 # Has center child
    
    # Government Report
    res = requests.get(f"{API_BASE}/government/report/{batch_id}")
    assert res.status_code == 200
    report = res.json()
    assert len(report["flags"]) > 0
    assert len(report["quality_reports"]) > 0
    assert report["traceability_backward"] is not None

def test_8_negative_paths():
    # Malformed data
    res = requests.post(f"{API_BASE}/engine-a/collection-events", json={
        "farmer_id": 1,
        "center_id": 2
        # missing volume
    })
    assert res.status_code == 422
    
def test_7_ml_service_direct():
    # Clean vector
    res = requests.post(f"{ML_BASE}/predict", json={
        "peroxidase_activity": 1.0,
        "enose_sensor_s02": 0.22,
        "formalin_test": 0,
        "enose_sensor_s01": 0.28,
        "formaldehyde_ppm": 0.0065,
        "ffa_linoleic_c18_2_pct": 3.46
    })
    assert res.status_code == 200
    assert res.json()["is_adulterated"] == False
    
    # Adulterated vector
    res = requests.post(f"{ML_BASE}/predict", json={
        "peroxidase_activity": 0.1,
        "enose_sensor_s02": 25.0,
        "formalin_test": 1,
        "enose_sensor_s01": 25.0,
        "formaldehyde_ppm": 2.0,
        "ffa_linoleic_c18_2_pct": 5.0
    })
    assert res.status_code == 200
    assert res.json()["is_adulterated"] == True
