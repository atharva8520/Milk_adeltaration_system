import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))))
os.environ["DATABASE_URL"] = "sqlite:///./milkguard.db"

from app.database import SessionLocal, engine
from app import models, auth
from sqlalchemy.orm import Session

# Create tables
models.Base.metadata.create_all(bind=engine)

def seed_db():
    db = SessionLocal()
    
    # Check if users already exist
    if db.query(models.User).first():
        print("Database already seeded")
        return
        
    users = [
        {"email": "farmer@example.com", "password": "password", "role": models.RoleEnum.FARMER, "name": "Test Farmer", "lat": 12.9716, "lon": 77.5946},
        {"email": "center@example.com", "password": "password", "role": models.RoleEnum.MIDDLEMAN, "name": "Test Center", "lat": 12.9750, "lon": 77.6000},
        {"email": "factory@example.com", "password": "password", "role": models.RoleEnum.MANUFACTURER, "name": "Test Factory", "lat": 12.9800, "lon": 77.6100},
        {"email": "admin@example.com", "password": "password", "role": models.RoleEnum.GOVERNMENT, "name": "Admin", "lat": None, "lon": None}
    ]
    
    for u in users:
        user = models.User(
            email=u["email"],
            hashed_password=auth.get_password_hash(u["password"]),
            role=u["role"],
            name=u["name"],
            latitude=u["lat"],
            longitude=u["lon"]
        )
        db.add(user)
    
    db.commit()
    print("Database seeded successfully")
    db.close()

if __name__ == "__main__":
    seed_db()
