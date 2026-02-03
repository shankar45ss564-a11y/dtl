from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from bson import ObjectId

from .models import UserSignup, UserLogin, UserProfile
from .utils import (
    verify_password, get_password_hash, create_access_token,
    validate_email_domain, get_current_user, serialize_user
)
from .database import users_collection
from .config import security

router = APIRouter()

@router.post("/api/auth/signup")
async def signup(user: UserSignup):
    if not validate_email_domain(user.email):
        raise HTTPException(status_code=400, detail=f"Only @rvce.edu.in emails are allowed")

    existing_user = users_collection.find_one({"email": user.email.lower()})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = {
        "email": user.email.lower(),
        "password": get_password_hash(user.password),
        "name": user.name,
        "role": user.role,
        "is_admin": False,
        "verification_status": "unverified",
        "student_id_image": None,
        "rejection_reason": None,
        "verified_at": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    result = users_collection.insert_one(new_user)
    token = create_access_token({"user_id": str(result.inserted_id)})

    return {
        "message": "User created successfully",
        "token": token,
        "user": {
            "id": str(result.inserted_id),
            "email": new_user["email"],
            "name": new_user["name"],
            "role": new_user["role"],
            "is_admin": new_user["is_admin"],
            "verification_status": new_user["verification_status"],
            "ride_count": 0
        }
    }

@router.post("/api/auth/login")
async def login(user: UserLogin):
    db_user = users_collection.find_one({"email": user.email.lower()})
    if not db_user or not verify_password(user.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Check if user account is disabled
    if db_user.get("is_active") == False:
        raise HTTPException(status_code=403, detail="Your account has been disabled. Please contact support.")

    token = create_access_token({"user_id": str(db_user["_id"])})

    return {
        "message": "Login successful",
        "token": token,
        "user": serialize_user(db_user)
    }

@router.get("/api/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {"user": current_user}

# Profile endpoints
@router.get("/api/profile")
async def get_profile(current_user: dict = Depends(get_current_user)):
    return {"user": current_user}

@router.put("/api/profile")
async def update_profile(profile: UserProfile, current_user: dict = Depends(get_current_user)):
    update_data = {}
    if profile.name:
        update_data["name"] = profile.name
    if profile.role and profile.role in ["rider", "driver"]:
        update_data["role"] = profile.role

    # Phase 4: Vehicle details for drivers
    if profile.vehicle_model is not None:
        update_data["vehicle_model"] = profile.vehicle_model
    if profile.vehicle_number is not None:
        update_data["vehicle_number"] = profile.vehicle_number
    if profile.vehicle_color is not None:
        update_data["vehicle_color"] = profile.vehicle_color

    if update_data:
        users_collection.update_one(
            {"_id": ObjectId(current_user["id"])},
            {"$set": update_data}
        )

    updated_user = users_collection.find_one({"_id": ObjectId(current_user["id"])}, {"password": 0})
    updated_user["id"] = str(updated_user["_id"])
    del updated_user["_id"]

    return {"message": "Profile updated", "user": updated_user}