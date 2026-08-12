from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, Enum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from .database import Base

class RoleEnum(str, enum.Enum):
    FARMER = "farmer"
    MIDDLEMAN = "middleman"
    MANUFACTURER = "manufacturer"
    GOVERNMENT = "government"
    CONSUMER = "consumer"
    ADMIN = "admin"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(RoleEnum), nullable=False)
    is_anonymous = Column(Boolean, default=False)
    name = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Location (simplified)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

class Livestock(Base):
    __tablename__ = "livestock"
    
    id = Column(Integer, primary_key=True, index=True)
    jio_tag = Column(String, unique=True, index=True, nullable=False)
    farmer_id = Column(Integer, ForeignKey("users.id"))
    species = Column(String) # Cow, Buffalo
    health_status = Column(String, default="healthy")
    expected_yield_liters = Column(Float, default=0.0)

    farmer = relationship("User")

class Batch(Base):
    __tablename__ = "batches"

    id = Column(String, primary_key=True, index=True) # UUID or generated ID
    source_id = Column(Integer, ForeignKey("users.id")) # Who created it
    destination_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Where it went
    volume_liters = Column(Float, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    collection_date = Column(String, nullable=True) # e.g. 'YYYY-MM-DD' for daily aggregations
    status = Column(String, default="created") # created, aggregated, processed
    parent_batch_ids = Column(JSON, nullable=True) # Array of parent batch IDs for traceability

class QualityReport(Base):
    __tablename__ = "quality_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String, ForeignKey("batches.id"))
    fat_percentage = Column(Float)
    snf_percentage = Column(Float)
    ph_level = Column(Float)
    peroxidase_activity = Column(Float, nullable=True)
    enose_sensor_s02 = Column(Float, nullable=True)
    formalin_test = Column(Integer, nullable=True)
    enose_sensor_s01 = Column(Float, nullable=True)
    formaldehyde_ppm = Column(Float, nullable=True)
    ffa_linoleic_c18_2_pct = Column(Float, nullable=True)
    adulterants_detected = Column(JSON, nullable=True) # E.g., {"water": 5, "starch": 0}
    ml_confidence_score = Column(Float, nullable=True)
    is_safe = Column(Boolean, default=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    batch = relationship("Batch")

class Flag(Base):
    __tablename__ = "flags"
    
    id = Column(Integer, primary_key=True, index=True)
    source_engine = Column(String, index=True, nullable=False) # e.g., 'Engine A', 'Engine B'
    entity_type = Column(String, index=True, nullable=False) # e.g., 'Farmer', 'Center'
    entity_id = Column(String, index=True, nullable=False)
    flag_type = Column(String, nullable=False) # e.g., 'Volume Spike', 'Capacity Exceeded'
    severity = Column(String, default="medium") # 'low', 'medium', 'high', 'critical'
    details = Column(JSON, nullable=True) # Additional contextual data
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved = Column(Boolean, default=False)

