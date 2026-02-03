from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List

# Auth Models
class UserSignup(BaseModel):
    email: str
    password: str
    name: str
    role: str = Field(..., pattern="^(rider|driver)$")

class UserLogin(BaseModel):
    email: str
    password: str

class UserProfile(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    # Vehicle details for drivers
    vehicle_model: Optional[str] = None
    vehicle_number: Optional[str] = None
    vehicle_color: Optional[str] = None

# Ride Models
class RideCreate(BaseModel):
    source: str
    destination: str
    source_lat: Optional[float] = None
    source_lng: Optional[float] = None
    destination_lat: Optional[float] = None
    destination_lng: Optional[float] = None
    date: str
    time: str
    available_seats: int = Field(..., ge=1, le=10)
    estimated_cost: float = Field(..., ge=0)
    # Phase 5: Pickup point and recurring ride fields
    pickup_point: Optional[str] = None  # Pickup point ID from PICKUP_POINTS
    is_recurring: bool = False
    recurrence_pattern: Optional[str] = None  # Pattern ID from RECURRENCE_PATTERNS
    recurrence_days_ahead: Optional[int] = Field(default=None, ge=1, le=30)  # How many days to generate
    # Phase 7: Event tag
    event_tag: Optional[str] = None  # Event tag ID

class RideUpdate(BaseModel):
    source: Optional[str] = None
    destination: Optional[str] = None
    source_lat: Optional[float] = None
    source_lng: Optional[float] = None
    destination_lat: Optional[float] = None
    destination_lng: Optional[float] = None
    date: Optional[str] = None
    time: Optional[str] = None
    available_seats: Optional[int] = None
    estimated_cost: Optional[float] = None
    pickup_point: Optional[str] = None
    event_tag: Optional[str] = None  # Phase 7: Event tag

# Ride Request Models
class RideRequestCreate(BaseModel):
    ride_id: str
    is_urgent: bool = False  # Phase 5: Instant/urgent ride request

class RideRequestAction(BaseModel):
    action: str = Field(..., pattern="^(accept|reject)$")

# Verification Models
class VerificationUpload(BaseModel):
    student_id_image: str  # Base64 encoded image

class VerificationAction(BaseModel):
    action: str = Field(..., pattern="^(approve|reject)$")
    reason: Optional[str] = None  # Required for rejection

# Phase 3: Chat and PIN Models
class ChatMessage(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)

class StartRideRequest(BaseModel):
    pin: str = Field(..., min_length=4, max_length=4)

# Phase 4: SOS and Live Ride Models
class SOSCreate(BaseModel):
    ride_request_id: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    message: Optional[str] = None

class SOSAction(BaseModel):
    action: str = Field(..., pattern="^(review|resolve)$")
    notes: Optional[str] = None

# Phase 6: Rating Models
class RatingCreate(BaseModel):
    ride_request_id: str
    rating: int = Field(..., ge=1, le=5)  # 1-5 stars
    feedback: Optional[str] = Field(None, max_length=500)  # Optional text feedback

# Phase 7: Event Tag Models
class EventTagCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = Field(None, max_length=200)

class EventTagUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = Field(None, max_length=200)
    is_active: Optional[bool] = None

# Phase 7: User Profile Update with Community Fields
class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_number: Optional[str] = None
    vehicle_color: Optional[str] = None
    branch: Optional[str] = None
    academic_year: Optional[str] = None

# Phase 8: Report Models
class ReportCreate(BaseModel):
    reported_user_id: Optional[str] = None
    ride_id: Optional[str] = None
    category: str = Field(..., pattern="^(safety|behavior|misuse|other)$")
    description: str = Field(..., min_length=10, max_length=1000)

class ReportAction(BaseModel):
    action: str = Field(..., pattern="^(warn|suspend|disable|dismiss)$")
    admin_notes: Optional[str] = Field(None, max_length=500)

# Phase 8: User Status Update
class UserStatusUpdate(BaseModel):
    is_active: bool
    reason: Optional[str] = Field(None, max_length=500)

# Phase 8: Promote User to Admin
class PromoteUserRequest(BaseModel):
    confirm: bool = True