import requests
import random
from datetime import datetime, timedelta

API_BASE = "http://localhost:8000"

# Note: We need a way to bypass auth or create a user for testing.
# Since we didn't remove the auth dependency on `/engine-a` in main.py, wait, I didn't add auth dependencies to the Engine A endpoints!
# Look at main.py:
# @app.post("/engine-a/collection-events")
# def ingest_collection_event(event: schemas.CollectionEvent, db: Session = Depends(database.get_db)):
# It has no `Depends(auth.get_current_user)`. So it's publicly accessible for ease of IoT simulator injection. This is fine for testing.

def setup_users_and_livestock_via_db():
    # Direct DB injection for setup since we don't have endpoints for these
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    import sys
    import os
    
    # Add backend to path so we can import
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))
    
    from app import models, auth
    from app.database import Base, engine
    
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    # Clean previous seeds if any
    db.query(models.Flag).delete()
    db.query(models.Batch).delete()
    db.query(models.Livestock).delete()
    db.query(models.User).filter(models.User.email.like("%@seed.com")).delete()
    db.commit()
    
    farmer = models.User(email="farmer1@seed.com", hashed_password=auth.get_password_hash("pw"), role=models.RoleEnum.FARMER)
    center = models.User(email="center1@seed.com", hashed_password=auth.get_password_hash("pw"), role=models.RoleEnum.MIDDLEMAN)
    db.add_all([farmer, center])
    db.commit()
    db.refresh(farmer)
    db.refresh(center)
    
    livestock = models.Livestock(jio_tag="tag_seed_1", farmer_id=farmer.id, expected_yield_liters=50.0)
    db.add(livestock)
    db.commit()
    
    farmer_id = farmer.id
    center_id = center.id
    
    db.close()
    return farmer_id, center_id

def seed_data():
    farmer_id, center_id = setup_users_and_livestock_via_db()
    print(f"Created Farmer {farmer_id} and Center {center_id}")
    
    # Generate 14 days of normal history (avg 45L per day, within 50L capacity)
    print("Generating 14 days of normal history...")
    batch_ids = []
    
    for i in range(14, 0, -1):
        d = (datetime.utcnow() - timedelta(days=i)).strftime("%Y-%m-%d")
        vol = round(random.uniform(40.0, 48.0), 2)
        
        # Ingest collection
        res = requests.post(f"{API_BASE}/engine-a/collection-events", json={
            "farmer_id": farmer_id,
            "center_id": center_id,
            "volume_liters": vol,
            "collection_date": d
        })
        b_id = res.json()["batch_id"]
        batch_ids.append(b_id)
        
        # Ingest center forwarding (grouping chunks of 2-3 batches in real life, here just 1-to-1 with ~1% loss)
        vol_out = round(vol * 0.99, 2)
        requests.post(f"{API_BASE}/engine-a/center-events", json={
            "center_id": center_id,
            "destination_id": 999, # Dummy destination
            "volume_out_liters": vol_out,
            "collection_date": d,
            "parent_batch_ids": [b_id]
        })
        
    print("Normal history generated.")
    
    # Deliberate Fraud 1: Capacity Exceeded + Volume Spike
    # Farmer claims 80L (Capacity is 50L, normal is 45L)
    print("Generating Fraudulent Collection Event...")
    res = requests.post(f"{API_BASE}/engine-a/collection-events", json={
        "farmer_id": farmer_id,
        "center_id": center_id,
        "volume_liters": 80.0,
        "collection_date": datetime.utcnow().strftime("%Y-%m-%d")
    })
    fraud_batch_id = res.json()["batch_id"]
    
    # Deliberate Fraud 2: Middleman forwarding MORE than they received
    print("Generating Fraudulent Center Event...")
    requests.post(f"{API_BASE}/engine-a/center-events", json={
        "center_id": center_id,
        "destination_id": 999,
        "volume_out_liters": 95.0, # They received 80L, but are outputting 95L!
        "collection_date": datetime.utcnow().strftime("%Y-%m-%d"),
        "parent_batch_ids": [fraud_batch_id]
    })
    
    print("Seed complete! Checking flags...")
    
    # Authenticate as an admin/government user to see all flags
    login_res = requests.post(f"{API_BASE}/token", data={"username": "center1@seed.com", "password": "pw"}) # We created center1@seed.com in this script
    if login_res.status_code == 200:
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        # Note: Center is MIDDLEMAN so they only see their own flags. To see all, we should create an admin.
        # However, the flags generated here are FOR center_id and farmer_id.
        # So we can fetch as center, but it will only show Center flags. Let's create an admin!
    
    # Let's create a temporary admin user just for fetching
    requests.post(f"{API_BASE}/register", json={"email": "admin_seed@seed.com", "password": "pw", "name": "Admin", "role": "admin"})
    token = requests.post(f"{API_BASE}/token", data={"username": "admin_seed@seed.com", "password": "pw"}).json()["access_token"]
    
    flags = requests.get(f"{API_BASE}/flags", headers={"Authorization": f"Bearer {token}"}).json()
    for f in flags:
        print(f"FLAG [{f.get('severity', '').upper()}]: {f.get('entity_type')} {f.get('entity_id')} - {f.get('flag_type')}")
        print(f"  Details: {f.get('details')}")

if __name__ == "__main__":
    seed_data()
