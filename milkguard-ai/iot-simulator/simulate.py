import requests
import json
import time
import random

API_URL = "http://localhost:8000"

def register_user(email, password, role, name):
    payload = {
        "email": email,
        "password": password,
        "role": role,
        "name": name
    }
    response = requests.post(f"{API_URL}/register", json=payload)
    if response.status_code == 200:
        return response.json()
    else:
        print(f"Failed to register {email}:", response.text)
        # Assume already registered, let's login
        return {"email": email}

def login(email, password):
    payload = {
        "username": email,
        "password": password
    }
    response = requests.post(f"{API_URL}/token", data=payload)
    if response.status_code == 200:
        return response.json()["access_token"]
    else:
        print(f"Failed to login {email}:", response.text)
        return None

def create_batch(token, volume, destination_id=None, parent_batch_ids=None):
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "volume_liters": volume,
        "destination_id": destination_id,
        "parent_batch_ids": parent_batch_ids
    }
    response = requests.post(f"{API_URL}/batches", headers=headers, json=payload)
    return response.status_code, response.json()

def register_livestock(token, jio_tag, species, yield_liters):
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "jio_tag": jio_tag,
        "species": species,
        "expected_yield_liters": yield_liters
    }
    response = requests.post(f"{API_URL}/livestock", headers=headers, json=payload)
    return response.status_code, response.json()

def run_simulation():
    print("--- Starting IoT Simulator ---")
    
    # 1. Register/Login Farmer and Middleman
    farmer_data = register_user("farmer1@milkguard.ai", "password123", "farmer", "Ramu Kaka")
    middleman_data = register_user("center1@milkguard.ai", "password123", "middleman", "Collection Center A")
    
    farmer_token = login("farmer1@milkguard.ai", "password123")
    middleman_token = login("center1@milkguard.ai", "password123")
    
    if not farmer_token or not middleman_token:
        print("Auth failed, exiting.")
        return
        
    print("Registering livestock for farmer...")
    register_livestock(farmer_token, "TAG_12345", "Cow", 25.0)
    
    # The farmer has 25.0L expected yield. Max allowed is 25.0 * 1.2 = 30.0L.
    
    print("Farmer sending batch of 20L (Should Pass)...")
    status, res = create_batch(farmer_token, 20.0)
    print(f"Response ({status}):", res)
    
    print("Farmer sending batch of 40L (Should fail Engine A)...")
    status, res = create_batch(farmer_token, 40.0)
    print(f"Response ({status}):", res)

if __name__ == "__main__":
    run_simulation()
