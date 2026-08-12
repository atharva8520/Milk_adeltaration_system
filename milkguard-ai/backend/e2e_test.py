import requests

BASE_URL = "http://127.0.0.1:8000"

# Need to authenticate or just call the endpoints directly if they allow?
# Let's check if the ingest endpoints require authentication.
# In main.py:
# @app.post("/engine-a/farmer-events")
# def ingest_farmer_event(event: schemas.FarmerEvent, db: Session = Depends(database.get_db)):
# It does NOT have current_user dependency! It's an open ingest endpoint.

print("--- Test 1: Clean Batch ---")
farmer_payload = {
    "farmer_id": "f1",
    "volume_liters": 100,
    "fat_percentage": 4.0,
    "snf_percentage": 8.6,
    "water_percentage": 5.0,
    "location": {"latitude": 12.9, "longitude": 77.5}
}
r1 = requests.post(f"{BASE_URL}/engine-a/farmer-events", json=farmer_payload)
print("Farmer Event Response:", r1.json())
batch_id = r1.json().get("batch_id")

center_payload = {
    "batch_id": batch_id,
    "center_id": "c1",
    "volume_liters": 100,
    "fat_percentage": 4.0,
    "snf_percentage": 8.6,
    "water_percentage": 5.0,
    "adulterants_detected": {},
    "location": {"latitude": 12.91, "longitude": 77.51}
}
r2 = requests.post(f"{BASE_URL}/engine-a/center-events", json=center_payload)
print("Center Event Response:", r2.json())

factory_payload = {
    "batch_id": batch_id,
    "factory_id": "fac1",
    "volume_liters": 100,
    "fat_percentage": 4.0,
    "snf_percentage": 8.6,
    "water_percentage": 5.0,
    "adulterants_detected": {},
    "location": {"latitude": 12.92, "longitude": 77.52}
}
r3 = requests.post(f"{BASE_URL}/engine-a/factory-events", json=factory_payload)
print("Factory Event Response:", r3.json())

r4 = requests.get(f"{BASE_URL}/chain/{batch_id}")
print("Pipeline Chain Data for Clean Batch:")
print(r4.json())


print("\n--- Test 2: Adulterated Batch ---")
r5 = requests.post(f"{BASE_URL}/engine-a/farmer-events", json=farmer_payload)
batch_id_adulterated = r5.json().get("batch_id")

center_payload_adul = {
    "batch_id": batch_id_adulterated,
    "center_id": "c1",
    "volume_liters": 100,
    "fat_percentage": 2.5,  # Below threshold (usually 3.0)
    "snf_percentage": 8.0,
    "water_percentage": 5.0,
    "adulterants_detected": {"formaldehyde": True}, # Formaldehyde!
    "location": {"latitude": 12.91, "longitude": 77.51}
}
r6 = requests.post(f"{BASE_URL}/engine-a/center-events", json=center_payload_adul)
print("Center Event (Adulterated) Response:", r6.json())

r7 = requests.get(f"{BASE_URL}/chain/{batch_id_adulterated}")
print("Pipeline Chain Data for Adulterated Batch:")
print(r7.json())
