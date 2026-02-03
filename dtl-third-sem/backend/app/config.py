import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")

# JWT Config
JWT_SECRET = os.environ.get("JWT_SECRET")
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", 1440))

# Password hashing
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security
from fastapi.security import HTTPBearer
security = HTTPBearer()

# Allowed email domain
ALLOWED_EMAIL_DOMAIN = "@rvce.edu.in"

# Phase 5: RVCE-specific Pickup Points
PICKUP_POINTS = [
    {"id": "main_gate", "name": "Main Gate", "description": "RVCE Main Entrance"},
    {"id": "library", "name": "Central Library", "description": "Near Library Building"},
    {"id": "canteen", "name": "Main Canteen", "description": "Central Canteen Area"},
    {"id": "cse_block", "name": "CSE Block", "description": "Computer Science Building"},
    {"id": "ece_block", "name": "ECE Block", "description": "Electronics Building"},
    {"id": "mech_block", "name": "Mechanical Block", "description": "Mechanical Engineering Building"},
    {"id": "civil_block", "name": "Civil Block", "description": "Civil Engineering Building"},
    {"id": "admin_block", "name": "Admin Block", "description": "Administrative Building"},
    {"id": "hostel_gate", "name": "Hostel Gate", "description": "Boys/Girls Hostel Entrance"},
    {"id": "sports_complex", "name": "Sports Complex", "description": "Near Playground/Gym"},
    {"id": "parking_lot", "name": "Parking Lot", "description": "Main Parking Area"},
    {"id": "back_gate", "name": "Back Gate", "description": "Rear Campus Exit"},
]

# Phase 5: Recurrence Patterns
RECURRENCE_PATTERNS = [
    {"id": "weekdays", "name": "Weekdays", "days": [0, 1, 2, 3, 4]},  # Mon-Fri
    {"id": "weekends", "name": "Weekends", "days": [5, 6]},  # Sat-Sun
    {"id": "daily", "name": "Daily", "days": [0, 1, 2, 3, 4, 5, 6]},
    {"id": "mon_wed_fri", "name": "Mon/Wed/Fri", "days": [0, 2, 4]},
    {"id": "tue_thu", "name": "Tue/Thu", "days": [1, 3]},
]

# Phase 7: RVCE Branches and Academic Years
BRANCHES = [
    {"id": "cse", "name": "Computer Science"},
    {"id": "ise", "name": "Information Science"},
    {"id": "ece", "name": "Electronics & Communication"},
    {"id": "eee", "name": "Electrical & Electronics"},
    {"id": "me", "name": "Mechanical Engineering"},
    {"id": "cv", "name": "Civil Engineering"},
    {"id": "bt", "name": "Biotechnology"},
    {"id": "ch", "name": "Chemical Engineering"},
    {"id": "im", "name": "Industrial Management"},
    {"id": "te", "name": "Telecommunication"},
]

ACADEMIC_YEARS = [
    {"id": "1", "name": "1st Year"},
    {"id": "2", "name": "2nd Year"},
    {"id": "3", "name": "3rd Year"},
    {"id": "4", "name": "4th Year"},
]

# Phase 7: Badge Definitions
BADGE_DEFINITIONS = [
    {"id": "first_ride", "name": "First Ride", "description": "Completed your first ride", "icon": "🎉", "threshold": 1},
    {"id": "rides_5", "name": "Rising Star", "description": "Completed 5 rides", "icon": "⭐", "threshold": 5},
    {"id": "rides_10", "name": "Road Warrior", "description": "Completed 10 rides", "icon": "🏆", "threshold": 10},
    {"id": "rides_25", "name": "Campus Hero", "description": "Completed 25 rides", "icon": "🦸", "threshold": 25},
    {"id": "eco_warrior", "name": "Eco Warrior", "description": "Saved 50kg CO2", "icon": "🌱", "threshold_co2": 50},
    {"id": "eco_champion", "name": "Eco Champion", "description": "Saved 100kg CO2", "icon": "🌍", "threshold_co2": 100},
]

# Phase 7: CO2 Constants
CO2_PER_KM_SAVED = 0.21  # kg CO2 saved per km shared
AVG_RIDE_DISTANCE_KM = 8  # Average ride distance estimate
COST_PER_KM_SOLO = 12  # Estimated cost per km for solo travel (auto/cab)

# Phase 6: Trust Level Thresholds
TRUST_THRESHOLDS = {
    "trusted": {"min_rating": 4.0, "min_rides": 5},  # 4+ stars with 5+ rides
    "new_user": {"max_rides": 4},  # Less than 5 completed rides
    "needs_review": {"max_rating": 2.5}  # Below 2.5 stars
}