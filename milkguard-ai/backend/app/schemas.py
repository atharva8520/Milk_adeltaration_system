from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from .models import RoleEnum

class UserBase(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    role: RoleEnum
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class BatchBase(BaseModel):
    volume_liters: float
    destination_id: Optional[int] = None
    parent_batch_ids: Optional[List[str]] = None

class BatchCreate(BatchBase):
    pass

class BatchResponse(BatchBase):
    id: str
    source_id: int
    status: str
    
    class Config:
        from_attributes = True

class LivestockBase(BaseModel):
    jio_tag: str
    species: str
    expected_yield_liters: float

class LivestockCreate(LivestockBase):
    pass

class LivestockResponse(LivestockBase):
    id: int
    farmer_id: int
    health_status: str

    class Config:
        from_attributes = True

class QualityReportBase(BaseModel):
    batch_id: str
    peroxidase_activity: float
    enose_sensor_s02: float
    formalin_test: int
class QualityReportBase(BaseModel):
    batch_id: str
    fat_percentage: float
    snf_percentage: float
    ph_level: float
    peroxidase_activity: float
    enose_sensor_s02: float
    formalin_test: int
    enose_sensor_s01: float
    formaldehyde_ppm: float
    ffa_linoleic_c18_2_pct: float

class QualityReportCreate(QualityReportBase):
    pass

class QualityReportResponse(BaseModel):
    id: int
    batch_id: str
    is_safe: bool
    ml_confidence_score: Optional[float]
    timestamp: datetime

    class Config:
        orm_mode = True

# --- Flag Schemas (Engine A & B) ---
class FlagCreate(BaseModel):
    source_engine: str
    entity_type: str
    entity_id: str
    flag_type: str
    severity: str
    details: Optional[dict] = None

class FlagResponse(FlagCreate):
    id: int
    created_at: datetime
    resolved: bool

# --- Engine C (Quick Check) Schemas ---
class QuickCheckParams(BaseModel):
    batch_id: Optional[str] = None
    ph: Optional[float] = None
    density: Optional[float] = None
    fat_pct: Optional[float] = None
    snf_pct: Optional[float] = None
    peroxidase_activity: Optional[int] = None
    formalin_test: Optional[int] = None
    formaldehyde_ppm: Optional[float] = None
    ffa_linoleic_c18_2_pct: Optional[float] = None
    enose_sensor_s01: Optional[float] = None
    enose_sensor_s02: Optional[float] = None

class ParameterCheckResult(BaseModel):
    parameter: str
    value_entered: float
    reference_range: str
    deviation_pct: float
    status: str  # Normal, Borderline, Suspicious

class QuickCheckResponse(BaseModel):
    adulteration_likelihood_pct: float
    parameters: List[ParameterCheckResult]
    is_suspicious: bool
    note: str

    class Config:
        orm_mode = True

# --- Engine A Event Schemas ---
class CollectionEvent(BaseModel):
    farmer_id: int
    center_id: int
    volume_liters: float
    collection_date: Optional[str] = None # 'YYYY-MM-DD', defaults to today if not provided

# --- Phase 7: Consumer QR Flow ---
class TimelineEvent(BaseModel):
    stage: str
    entity_name: str
    date: str
    details: Optional[dict] = None

class CompositionSlice(BaseModel):
    name: str
    percentage: float

class ConsumerScanResponse(BaseModel):
    batch_id: str
    is_safe: bool
    composition: dict  # non-ML parameters only
    composition_breakdown: List[CompositionSlice]
    timeline: List[TimelineEvent]
    note: str

class CenterEvent(BaseModel):
    center_id: int
    volume_out_liters: float
    collection_date: Optional[str] = None
    parent_batch_ids: list[str]

class ConsumerDelivery(BaseModel):
    consumer_id: int
    volume_liters: float
    parent_batch_id: str
    collection_date: Optional[str] = None

class TraceabilityNode(BaseModel):
    batch_id: str
    source_id: int
    destination_id: Optional[int]
    volume_liters: float
    timestamp: datetime
    parents: Optional[List['TraceabilityNode']] = None
    children: Optional[List['TraceabilityNode']] = None

class GovernmentReport(BaseModel):
    batch: BatchResponse
    traceability_backward: Optional[TraceabilityNode] = None
    traceability_forward: Optional[TraceabilityNode] = None
    flags: List[FlagResponse]
    quality_reports: List[QualityReportResponse]
    generated_at: datetime
