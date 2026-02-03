import random
import re
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from bson import ObjectId
from typing import Optional

from .config import (
    JWT_SECRET, JWT_ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES,
    pwd_context, security, ALLOWED_EMAIL_DOMAIN,
    CO2_PER_KM_SAVED, AVG_RIDE_DISTANCE_KM, COST_PER_KM_SOLO,
    TRUST_THRESHOLDS, BADGE_DEFINITIONS, BRANCHES, ACADEMIC_YEARS, PICKUP_POINTS
)
from .database import (
    users_collection, rides_collection, ride_requests_collection,
    ratings_collection, event_tags_collection, sos_events_collection
)

# Password functions
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

# JWT functions
def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def validate_email_domain(email: str) -> bool:
    return email.lower().endswith(ALLOWED_EMAIL_DOMAIN)

# Ride utilities
def generate_ride_pin() -> str:
    """Generate a 4-digit PIN for ride verification"""
    return str(random.randint(1000, 9999))

def estimate_ride_duration(source: str, destination: str) -> int:
    """Estimate ride duration in minutes based on source/destination length as proxy for distance"""
    # Simple heuristic: longer place names often mean farther destinations
    # Base time: 15-45 minutes for typical campus rides
    base_time = 20
    # Add some variation based on string length (proxy for complexity/distance)
    distance_factor = (len(source) + len(destination)) // 10
    return base_time + (distance_factor * 5)  # Returns estimated minutes

def calculate_estimated_arrival(start_time_str: str, duration_minutes: int) -> str:
    """Calculate ETA based on start time and duration"""
    try:
        start_time = datetime.fromisoformat(start_time_str.replace('Z', '+00:00'))
        eta = start_time + timedelta(minutes=duration_minutes)
        return eta.isoformat()
    except:
        return None

# Auth dependency
def get_current_user(credentials):
    from fastapi import HTTPException, Depends
    from .config import security
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = users_collection.find_one({"_id": ObjectId(user_id)}, {"password": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        # Check if user account is disabled (allow admins to continue)
        if user.get("is_active") == False and not user.get("is_admin"):
            raise HTTPException(status_code=403, detail="Your account has been disabled. Please contact support.")
        user["id"] = str(user["_id"])
        del user["_id"]
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Serialization functions
def serialize_user(user: dict) -> dict:
    # Count completed rides for this user
    ride_count = 0
    user_id_str = str(user["_id"])

    if user.get("role") == "driver":
        ride_count = rides_collection.count_documents({
            "driver_id": user_id_str,
            "status": "completed"
        })
    else:
        ride_count = ride_requests_collection.count_documents({
            "rider_id": user_id_str,
            "status": "completed"
        })

    # Phase 6: Get rating statistics
    rating_stats = get_user_rating_stats(user_id_str)
    trust_level = calculate_trust_level(rating_stats["average_rating"], ride_count)

    # Phase 7: Calculate badges
    badges = calculate_user_badges(user_id_str, ride_count)

    result = {
        "id": user_id_str,
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "is_admin": user.get("is_admin", False),
        "verification_status": user.get("verification_status", "unverified"),
        "rejection_reason": user.get("rejection_reason"),
        "verified_at": user.get("verified_at"),
        "ride_count": ride_count,
        "created_at": user.get("created_at", ""),
        # Phase 6: Rating and Trust fields
        "average_rating": rating_stats["average_rating"],
        "total_ratings": rating_stats["total_ratings"],
        "rating_distribution": rating_stats["rating_distribution"],
        "trust_level": trust_level,
        # Phase 7: Community and Engagement fields
        "branch": user.get("branch"),
        "academic_year": user.get("academic_year"),
        "badges": badges,
        # Phase 8: Account status fields
        "is_active": user.get("is_active", True),
        "is_suspended": user.get("is_suspended", False),
        "warning_count": user.get("warning_count", 0)
    }

    # Include vehicle details for drivers
    if user.get("role") == "driver":
        result["vehicle_model"] = user.get("vehicle_model")
        result["vehicle_number"] = user.get("vehicle_number")
        result["vehicle_color"] = user.get("vehicle_color")

    return result

def serialize_ride(ride: dict) -> dict:
    driver = users_collection.find_one({"_id": ObjectId(ride["driver_id"])}, {"password": 0})
    driver_name = driver["name"] if driver else "Unknown"
    driver_verification_status = driver.get("verification_status", "unverified") if driver else "unverified"

    # Phase 6: Get driver rating stats and trust level
    driver_rating_stats = get_user_rating_stats(ride["driver_id"])
    driver_completed_rides = rides_collection.count_documents({
        "driver_id": ride["driver_id"],
        "status": "completed"
    })
    driver_trust_level = calculate_trust_level(driver_rating_stats["average_rating"], driver_completed_rides)

    # Count accepted requests (including ongoing and completed for completed rides)
    # For completed rides, we want to show the total riders who were part of the ride
    if ride.get("status") == "completed":
        # Include completed requests to show accurate rider count for past rides
        accepted_requests = ride_requests_collection.count_documents({
            "ride_id": str(ride["_id"]),
            "status": {"$in": ["accepted", "ongoing", "completed"]}
        })
    else:
        # For active rides, only count accepted and ongoing
        accepted_requests = ride_requests_collection.count_documents({
            "ride_id": str(ride["_id"]),
            "status": {"$in": ["accepted", "ongoing"]}
        })

    seats_taken = accepted_requests
    seats_available = ride["available_seats"] - seats_taken
    cost_per_rider = ride["estimated_cost"] / (seats_taken + 1) if seats_taken > 0 else ride["estimated_cost"]

    # Phase 5: Get pickup point name
    pickup_point_id = ride.get("pickup_point")
    pickup_point_name = None
    if pickup_point_id:
        for pp in PICKUP_POINTS:
            if pp["id"] == pickup_point_id:
                pickup_point_name = pp["name"]
                break

    return {
        "id": str(ride["_id"]),
        "driver_id": ride["driver_id"],
        "driver_name": driver_name,
        "driver_verification_status": driver_verification_status,
        # Phase 6: Driver rating and trust info
        "driver_average_rating": driver_rating_stats["average_rating"],
        "driver_total_ratings": driver_rating_stats["total_ratings"],
        "driver_trust_level": driver_trust_level,
        "driver_completed_rides": driver_completed_rides,
        "source": ride["source"],
        "destination": ride["destination"],
        "source_lat": ride.get("source_lat"),
        "source_lng": ride.get("source_lng"),
        "destination_lat": ride.get("destination_lat"),
        "destination_lng": ride.get("destination_lng"),
        "date": ride["date"],
        "time": ride["time"],
        "available_seats": ride["available_seats"],
        "seats_available": seats_available,
        "seats_taken": seats_taken,
        "estimated_cost": ride["estimated_cost"],
        "cost_per_rider": round(cost_per_rider, 2),
        "status": ride["status"],
        # Phase 5: New fields
        "pickup_point": pickup_point_id,
        "pickup_point_name": pickup_point_name,
        "is_recurring": ride.get("is_recurring", False),
        "recurrence_pattern": ride.get("recurrence_pattern"),
        "parent_ride_id": ride.get("parent_ride_id"),  # For recurring ride instances
        # Phase 7: Event tag and driver community info
        "event_tag": ride.get("event_tag"),
        "event_tag_name": get_event_tag_name(ride.get("event_tag")),
        "driver_branch": driver.get("branch") if driver else None,
        "driver_branch_name": get_branch_name(driver.get("branch")) if driver else None,
        "driver_academic_year": driver.get("academic_year") if driver else None,
        "driver_academic_year_name": get_academic_year_name(driver.get("academic_year")) if driver else None,
        "created_at": ride.get("created_at", "")
    }

def serialize_ride_request(request: dict) -> dict:
    rider = users_collection.find_one({"_id": ObjectId(request["rider_id"])}, {"password": 0})
    ride = rides_collection.find_one({"_id": ObjectId(request["ride_id"])})
    driver = users_collection.find_one({"_id": ObjectId(ride["driver_id"])}, {"password": 0}) if ride else None

    # Phase 4: Calculate ETA for ongoing rides
    estimated_arrival = None
    estimated_duration = None
    if request.get("ride_started_at") and ride:
        estimated_duration = estimate_ride_duration(ride["source"], ride["destination"])
        estimated_arrival = calculate_estimated_arrival(request["ride_started_at"], estimated_duration)

    return {
        "id": str(request["_id"]),
        "ride_id": request["ride_id"],
        "rider_id": request["rider_id"],
        "rider_name": rider["name"] if rider else "Unknown",
        "rider_email": rider["email"] if rider else "Unknown",
        "rider_verification_status": rider.get("verification_status", "unverified") if rider else "unverified",
        "ride_source": ride["source"] if ride else "Unknown",
        "ride_destination": ride["destination"] if ride else "Unknown",
        "source_lat": ride.get("source_lat") if ride else None,
        "source_lng": ride.get("source_lng") if ride else None,
        "destination_lat": ride.get("destination_lat") if ride else None,
        "destination_lng": ride.get("destination_lng") if ride else None,
        "ride_date": ride["date"] if ride else "Unknown",
        "ride_time": ride["time"] if ride else "Unknown",
        "ride_estimated_cost": ride["estimated_cost"] if ride else 0,
        "status": request["status"],
        "ride_pin": request.get("ride_pin"),  # Phase 3: Include PIN
        "ride_started_at": request.get("ride_started_at"),  # Phase 3: Include start time
        # Phase 4: Additional fields for live ride
        "driver_id": ride["driver_id"] if ride else None,
        "driver_name": driver["name"] if driver else "Unknown",
        "driver_verification_status": driver.get("verification_status", "unverified") if driver else "unverified",
        # Phase 4: Vehicle details for live ride
        "driver_vehicle_model": driver.get("vehicle_model") if driver else None,
        "driver_vehicle_number": driver.get("vehicle_number") if driver else None,
        "driver_vehicle_color": driver.get("vehicle_color") if driver else None,
        "estimated_arrival": estimated_arrival,
        "estimated_duration_minutes": estimated_duration,
        "reached_safely_at": request.get("reached_safely_at"),
        "completed_at": request.get("completed_at"),
        # Phase 5: Urgent/instant ride request
        "is_urgent": request.get("is_urgent", False),
        "pickup_point": ride.get("pickup_point") if ride else None,
        "pickup_point_name": None,  # Will be populated below
        "created_at": request.get("created_at", "")
    }

def serialize_ride_request_with_pickup(request: dict) -> dict:
    """Serialize ride request with pickup point name resolution"""
    result = serialize_ride_request(request)
    # Resolve pickup point name
    if result.get("pickup_point"):
        for pp in PICKUP_POINTS:
            if pp["id"] == result["pickup_point"]:
                result["pickup_point_name"] = pp["name"]
                break
    return result

def serialize_chat_message(message: dict) -> dict:
    sender = users_collection.find_one({"_id": ObjectId(message["sender_id"])}, {"password": 0})
    return {
        "id": str(message["_id"]),
        "ride_request_id": message["ride_request_id"],
        "sender_id": message["sender_id"],
        "sender_name": sender["name"] if sender else "Unknown",
        "sender_role": sender["role"] if sender else "Unknown",
        "message": message["message"],
        "created_at": message.get("created_at", "")
    }

def serialize_sos_event(sos: dict) -> dict:
    ride_request = ride_requests_collection.find_one({"_id": ObjectId(sos["ride_request_id"])}) if sos.get("ride_request_id") else None
    triggered_by_user = users_collection.find_one({"_id": ObjectId(sos["triggered_by"])}, {"password": 0}) if sos.get("triggered_by") else None

    # Get ride and participants info
    ride = None
    rider = None
    driver = None
    if ride_request:
        ride = rides_collection.find_one({"_id": ObjectId(ride_request["ride_id"])})
        rider = users_collection.find_one({"_id": ObjectId(ride_request["rider_id"])}, {"password": 0})
        if ride:
            driver = users_collection.find_one({"_id": ObjectId(ride["driver_id"])}, {"password": 0})

    return {
        "id": str(sos["_id"]),
        "ride_request_id": sos.get("ride_request_id"),
        "triggered_by": sos.get("triggered_by"),
        "triggered_by_name": triggered_by_user["name"] if triggered_by_user else "Unknown",
        "triggered_by_role": triggered_by_user["role"] if triggered_by_user else "Unknown",
        "latitude": sos.get("latitude"),
        "longitude": sos.get("longitude"),
        "message": sos.get("message"),
        "status": sos.get("status", "active"),
        "admin_notes": sos.get("admin_notes"),
        "reviewed_at": sos.get("reviewed_at"),
        "resolved_at": sos.get("resolved_at"),
        "resolved_by": sos.get("resolved_by"),
        "created_at": sos.get("created_at", ""),
        # Ride details
        "ride_source": ride["source"] if ride else "Unknown",
        "ride_destination": ride["destination"] if ride else "Unknown",
        "ride_date": ride["date"] if ride else "Unknown",
        "ride_time": ride["time"] if ride else "Unknown",
        # Participant details
        "rider_name": rider["name"] if rider else "Unknown",
        "rider_email": rider["email"] if rider else "Unknown",
        "driver_name": driver["name"] if driver else "Unknown",
        "driver_email": driver["email"] if driver else "Unknown",
    }

# Rating and trust functions
def calculate_trust_level(avg_rating: float, ride_count: int) -> dict:
    """Calculate trust level based on rating and ride count"""
    if ride_count < TRUST_THRESHOLDS["new_user"]["max_rides"]:
        return {"level": "new", "label": "New User", "color": "gray"}
    elif avg_rating and avg_rating < TRUST_THRESHOLDS["needs_review"]["max_rating"]:
        return {"level": "low", "label": "Needs Review", "color": "red"}
    elif avg_rating and avg_rating >= TRUST_THRESHOLDS["trusted"]["min_rating"] and ride_count >= TRUST_THRESHOLDS["trusted"]["min_rides"]:
        return {"level": "trusted", "label": "Trusted", "color": "green"}
    else:
        return {"level": "regular", "label": "Regular", "color": "blue"}

def get_user_rating_stats(user_id: str) -> dict:
    """Get aggregated rating statistics for a user"""
    # Get all ratings where this user was rated
    ratings = list(ratings_collection.find({"rated_user_id": user_id}))

    if not ratings:
        return {
            "average_rating": None,
            "total_ratings": 0,
            "rating_distribution": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
        }

    total = len(ratings)
    sum_ratings = sum(r["rating"] for r in ratings)
    avg = round(sum_ratings / total, 2) if total > 0 else None

    # Calculate distribution
    distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for r in ratings:
        distribution[r["rating"]] = distribution.get(r["rating"], 0) + 1

    return {
        "average_rating": avg,
        "total_ratings": total,
        "rating_distribution": distribution
    }

# Badge functions
def calculate_user_badges(user_id: str, ride_count: int = None) -> list:
    """Calculate earned badges for a user"""
    if ride_count is None:
        # Count completed rides
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if user and user.get("role") == "driver":
            ride_count = rides_collection.count_documents({
                "driver_id": user_id,
                "status": "completed"
            })
        else:
            ride_count = ride_requests_collection.count_documents({
                "rider_id": user_id,
                "status": "completed"
            })

    # Calculate CO2 saved
    co2_saved = ride_count * AVG_RIDE_DISTANCE_KM * CO2_PER_KM_SAVED

    badges = []
    for badge in BADGE_DEFINITIONS:
        earned = False
        if "threshold" in badge:
            earned = ride_count >= badge["threshold"]
        elif "threshold_co2" in badge:
            earned = co2_saved >= badge["threshold_co2"]

        if earned:
            badges.append({
                "id": badge["id"],
                "name": badge["name"],
                "description": badge["description"],
                "icon": badge["icon"],
                "earned": True
            })

    return badges

# Stats functions
def calculate_user_stats(user_id: str, user_role: str) -> dict:
    """Calculate comprehensive user statistics"""
    # Get completed rides/requests
    rides_offered = 0
    rides_taken = 0

    if user_role == "driver":
        rides_offered = rides_collection.count_documents({
            "driver_id": user_id,
            "status": "completed"
        })
        # Also count rides taken if user has ever been a rider
        rides_taken = ride_requests_collection.count_documents({
            "rider_id": user_id,
            "status": "completed"
        })
    else:
        rides_taken = ride_requests_collection.count_documents({
            "rider_id": user_id,
            "status": "completed"
        })
        # Also count rides offered if user has ever been a driver
        rides_offered = rides_collection.count_documents({
            "driver_id": user_id,
            "status": "completed"
        })

    total_rides = rides_offered + rides_taken

    # Calculate distance and savings
    total_distance_km = total_rides * AVG_RIDE_DISTANCE_KM
    total_co2_saved = total_distance_km * CO2_PER_KM_SAVED

    # Calculate money saved (estimated solo cost - actual ride cost)
    money_saved = 0
    if user_role == "rider" or rides_taken > 0:
        completed_requests = list(ride_requests_collection.find({
            "rider_id": user_id,
            "status": "completed"
        }))
        for req in completed_requests:
            ride = rides_collection.find_one({"_id": ObjectId(req["ride_id"])})
            if ride:
                solo_cost = AVG_RIDE_DISTANCE_KM * COST_PER_KM_SOLO
                actual_cost = ride.get("estimated_cost", 0)
                money_saved += max(0, solo_cost - actual_cost)

    if user_role == "driver" or rides_offered > 0:
        completed_rides = list(rides_collection.find({
            "driver_id": user_id,
            "status": "completed"
        }))
        for ride in completed_rides:
            # Count riders who completed
            rider_count = ride_requests_collection.count_documents({
                "ride_id": str(ride["_id"]),
                "status": "completed"
            })
            if rider_count > 0:
                # Driver saved by splitting cost
                solo_cost = AVG_RIDE_DISTANCE_KM * COST_PER_KM_SOLO
                money_saved += solo_cost * rider_count / (rider_count + 1)

    # Calculate ride streak
    streak = calculate_ride_streak(user_id, user_role)

    return {
        "rides_offered": rides_offered,
        "rides_taken": rides_taken,
        "total_rides": total_rides,
        "total_distance_km": round(total_distance_km, 1),
        "total_co2_saved_kg": round(total_co2_saved, 2),
        "money_saved": round(money_saved, 0),
        "streak": streak
    }

def calculate_ride_streak(user_id: str, user_role: str) -> dict:
    """Calculate consecutive days of ride usage"""
    # Get all completed ride dates for this user
    ride_dates = set()

    if user_role == "driver":
        rides = rides_collection.find({
            "driver_id": user_id,
            "status": "completed"
        }, {"date": 1})
        for r in rides:
            if r.get("date"):
                ride_dates.add(r["date"])

    requests = ride_requests_collection.find({
        "rider_id": user_id,
        "status": "completed"
    })
    for req in requests:
        ride = rides_collection.find_one({"_id": ObjectId(req["ride_id"])}, {"date": 1})
        if ride and ride.get("date"):
            ride_dates.add(ride["date"])

    if not ride_dates:
        return {"current": 0, "longest": 0}

    # Sort dates
    sorted_dates = sorted(ride_dates)

    # Calculate current streak (from today backwards)
    today = datetime.now().strftime("%Y-%m-%d")
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

    current_streak = 0
    check_date = today

    while check_date in ride_dates or (current_streak == 0 and yesterday in ride_dates):
        if check_date in ride_dates:
            current_streak += 1
        elif current_streak == 0 and yesterday in ride_dates:
            check_date = yesterday
            continue
        else:
            break
        check_date = (datetime.strptime(check_date, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")

    # Calculate longest streak
    longest_streak = 0
    temp_streak = 1

    for i in range(1, len(sorted_dates)):
        prev_date = datetime.strptime(sorted_dates[i-1], "%Y-%m-%d")
        curr_date = datetime.strptime(sorted_dates[i], "%Y-%m-%d")

        if (curr_date - prev_date).days == 1:
            temp_streak += 1
        else:
            longest_streak = max(longest_streak, temp_streak)
            temp_streak = 1

    longest_streak = max(longest_streak, temp_streak)

    return {
        "current": current_streak,
        "longest": longest_streak
    }

def calculate_weekly_summary(user_id: str, user_role: str) -> dict:
    """Calculate stats for the last 7 days"""
    week_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
    today = datetime.now().strftime("%Y-%m-%d")

    rides_completed = 0
    co2_saved = 0
    money_saved = 0

    # Get rides in last 7 days
    if user_role == "driver":
        rides = list(rides_collection.find({
            "driver_id": user_id,
            "status": "completed",
            "date": {"$gte": week_ago, "$lte": today}
        }))
        rides_completed = len(rides)
        for ride in rides:
            rider_count = ride_requests_collection.count_documents({
                "ride_id": str(ride["_id"]),
                "status": "completed"
            })
            if rider_count > 0:
                solo_cost = AVG_RIDE_DISTANCE_KM * COST_PER_KM_SOLO
                money_saved += solo_cost * rider_count / (rider_count + 1)
                co2_saved += AVG_RIDE_DISTANCE_KM * CO2_PER_KM_SAVED

    # Get ride requests in last 7 days
    requests = list(ride_requests_collection.find({
        "rider_id": user_id,
        "status": "completed"
    }))

    for req in requests:
        ride = rides_collection.find_one({"_id": ObjectId(req["ride_id"])})
        if ride and ride.get("date", "") >= week_ago and ride.get("date", "") <= today:
            rides_completed += 1
            solo_cost = AVG_RIDE_DISTANCE_KM * COST_PER_KM_SOLO
            actual_cost = ride.get("estimated_cost", 0)
            money_saved += max(0, solo_cost - actual_cost)
            co2_saved += AVG_RIDE_DISTANCE_KM * CO2_PER_KM_SAVED

    return {
        "period": f"{week_ago} to {today}",
        "rides_completed": rides_completed,
        "co2_saved_kg": round(co2_saved, 2),
        "money_saved": round(money_saved, 0)
    }

# Helper functions for event tags and branches
def get_event_tag_name(tag_id: str) -> str:
    """Get event tag name from ID"""
    if not tag_id:
        return None
    tag = event_tags_collection.find_one({"_id": ObjectId(tag_id)})
    return tag["name"] if tag else None

def get_branch_name(branch_id: str) -> str:
    """Get branch name from ID"""
    if not branch_id:
        return None
    for branch in BRANCHES:
        if branch["id"] == branch_id:
            return branch["name"]
    return None

def get_academic_year_name(year_id: str) -> str:
    """Get academic year name from ID"""
    if not year_id:
        return None
    for year in ACADEMIC_YEARS:
        if year["id"] == year_id:
            return year["name"]
    return None

# Admin audit logging
def log_admin_action(admin_id: str, admin_name: str, action_type: str, target_type: str, target_id: str, details: dict = None):
    """Log an admin action for audit trail"""
    from .database import audit_logs_collection
    audit_log = {
        "admin_id": admin_id,
        "admin_name": admin_name,
        "action_type": action_type,  # e.g., 'user_disabled', 'verification_approved', 'report_handled'
        "target_type": target_type,  # e.g., 'user', 'ride', 'report', 'sos'
        "target_id": target_id,
        "details": details or {},
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    audit_logs_collection.insert_one(audit_log)