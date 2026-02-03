from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from bson import ObjectId

from .models import RatingCreate
from .utils import get_current_user, get_user_rating_stats, calculate_trust_level, serialize_user
from .database import ride_requests_collection, rides_collection, ratings_collection, users_collection

router = APIRouter()

@router.post("/api/ratings")
async def submit_rating(rating_data: RatingCreate, current_user: dict = Depends(get_current_user)):
    """Submit a rating for a completed ride"""
    try:
        ride_request = ride_requests_collection.find_one({"_id": ObjectId(rating_data.ride_request_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid ride request ID")

    if not ride_request:
        raise HTTPException(status_code=404, detail="Ride request not found")

    # Verify the ride is completed
    if ride_request["status"] != "completed":
        raise HTTPException(status_code=400, detail="Can only rate completed rides")

    ride = rides_collection.find_one({"_id": ObjectId(ride_request["ride_id"])})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")

    # Determine who is rating whom
    rider_id = ride_request["rider_id"]
    driver_id = ride["driver_id"]

    if current_user["id"] == rider_id:
        # Rider is rating the driver
        rated_user_id = driver_id
        rater_role = "rider"
    elif current_user["id"] == driver_id:
        # Driver is rating the rider
        rated_user_id = rider_id
        rater_role = "driver"
    else:
        raise HTTPException(status_code=403, detail="You were not part of this ride")

    # Check for duplicate rating (one rating per ride per rater)
    existing_rating = ratings_collection.find_one({
        "ride_request_id": rating_data.ride_request_id,
        "rater_id": current_user["id"]
    })

    if existing_rating:
        raise HTTPException(status_code=400, detail="You have already rated this ride")

    # Create the rating
    new_rating = {
        "ride_request_id": rating_data.ride_request_id,
        "ride_id": ride_request["ride_id"],
        "rater_id": current_user["id"],
        "rater_role": rater_role,
        "rated_user_id": rated_user_id,
        "rating": rating_data.rating,
        "feedback": rating_data.feedback,
        "created_at": datetime.now().isoformat()
    }

    result = ratings_collection.insert_one(new_rating)
    new_rating["id"] = str(result.inserted_id)

    # Get updated rating stats for the rated user
    rated_user_stats = get_user_rating_stats(rated_user_id)

    return {
        "message": "Rating submitted successfully",
        "rating": {
            "id": str(result.inserted_id),
            "rating": rating_data.rating,
            "feedback": rating_data.feedback,
            "created_at": new_rating["created_at"]
        },
        "rated_user_new_average": rated_user_stats["average_rating"]
    }

@router.get("/api/ratings/can-rate/{ride_request_id}")
async def can_rate_ride(ride_request_id: str, current_user: dict = Depends(get_current_user)):
    """Check if current user can rate this ride"""
    try:
        ride_request = ride_requests_collection.find_one({"_id": ObjectId(ride_request_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid ride request ID")

    if not ride_request:
        return {"can_rate": False, "reason": "Ride request not found"}

    # Check if ride is completed
    if ride_request["status"] != "completed":
        return {"can_rate": False, "reason": "Ride is not completed"}

    ride = rides_collection.find_one({"_id": ObjectId(ride_request["ride_id"])})
    if not ride:
        return {"can_rate": False, "reason": "Ride not found"}

    # Check if user is part of this ride
    rider_id = ride_request["rider_id"]
    driver_id = ride["driver_id"]

    if current_user["id"] not in [rider_id, driver_id]:
        return {"can_rate": False, "reason": "Not part of this ride"}

    # Check if already rated
    existing_rating = ratings_collection.find_one({
        "ride_request_id": ride_request_id,
        "rater_id": current_user["id"]
    })

    if existing_rating:
        return {"can_rate": False, "reason": "Already rated", "existing_rating": existing_rating["rating"]}

    # Determine who would be rated
    if current_user["id"] == rider_id:
        rated_user = users_collection.find_one({"_id": ObjectId(driver_id)}, {"password": 0})
        rated_role = "driver"
    else:
        rated_user = users_collection.find_one({"_id": ObjectId(rider_id)}, {"password": 0})
        rated_role = "rider"

    return {
        "can_rate": True,
        "rated_user_id": str(rated_user["_id"]) if rated_user else None,
        "rated_user_name": rated_user["name"] if rated_user else "Unknown",
        "rated_role": rated_role
    }

@router.get("/api/users/{user_id}/ratings")
async def get_user_ratings(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get aggregated ratings for a user"""
    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)}, {"password": 0})
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    rating_stats = get_user_rating_stats(user_id)

    # Count completed rides
    ride_count = 0
    if user.get("role") == "driver":
        ride_count = rides_collection.count_documents({
            "driver_id": user_id,
            "status": "completed"
        })
    else:
        ride_count = ride_requests_collection.count_documents({
            "rider_id": user_id,
            "status": "completed"
        })

    trust_level = calculate_trust_level(rating_stats["average_rating"], ride_count)

    return {
        "user_id": user_id,
        "name": user["name"],
        "role": user["role"],
        "average_rating": rating_stats["average_rating"],
        "total_ratings": rating_stats["total_ratings"],
        "rating_distribution": rating_stats["rating_distribution"],
        "ride_count": ride_count,
        "trust_level": trust_level
    }

@router.get("/api/ride-history")
async def get_ride_history(current_user: dict = Depends(get_current_user)):
    """Get ride history for the current user"""
    user_id = current_user["id"]
    user_role = current_user["role"]

    history = []

    if user_role == "driver":
        # Get all completed rides by this driver
        rides = list(rides_collection.find({
            "driver_id": user_id,
            "status": "completed"
        }).sort("created_at", -1))

        for ride in rides:
            # Get all completed requests for this ride
            requests = list(ride_requests_collection.find({
                "ride_id": str(ride["_id"]),
                "status": "completed"
            }))

            for req in requests:
                rider = users_collection.find_one({"_id": ObjectId(req["rider_id"])}, {"password": 0})

                # Check if rating exists for this ride
                my_rating = ratings_collection.find_one({
                    "ride_request_id": str(req["_id"]),
                    "rater_id": user_id
                })
                their_rating = ratings_collection.find_one({
                    "ride_request_id": str(req["_id"]),
                    "rated_user_id": user_id
                })

                history.append({
                    "ride_request_id": str(req["_id"]),
                    "ride_id": str(ride["_id"]),
                    "role": "driver",
                    "other_user_id": req["rider_id"],
                    "other_user_name": rider["name"] if rider else "Unknown",
                    "other_user_role": "rider",
                    "source": ride["source"],
                    "destination": ride["destination"],
                    "date": ride["date"],
                    "time": ride["time"],
                    "cost": ride["estimated_cost"],
                    "completed_at": req.get("completed_at"),
                    "reached_safely_at": req.get("reached_safely_at"),
                    "my_rating": my_rating["rating"] if my_rating else None,
                    "their_rating": their_rating["rating"] if their_rating else None,
                    "can_rate": my_rating is None,
                    "pickup_point": ride.get("pickup_point")
                })
    else:
        # Rider: Get all completed ride requests
        requests = list(ride_requests_collection.find({
            "rider_id": user_id,
            "status": "completed"
        }).sort("created_at", -1))

        for req in requests:
            ride = rides_collection.find_one({"_id": ObjectId(req["ride_id"])})
            if not ride:
                continue

            driver = users_collection.find_one({"_id": ObjectId(ride["driver_id"])}, {"password": 0})

            # Check if rating exists
            my_rating = ratings_collection.find_one({
                "ride_request_id": str(req["_id"]),
                "rater_id": user_id
            })
            their_rating = ratings_collection.find_one({
                "ride_request_id": str(req["_id"]),
                "rated_user_id": user_id
            })

            history.append({
                "ride_request_id": str(req["_id"]),
                "ride_id": req["ride_id"],
                "role": "rider",
                "other_user_id": ride["driver_id"],
                "other_user_name": driver["name"] if driver else "Unknown",
                "other_user_role": "driver",
                "source": ride["source"],
                "destination": ride["destination"],
                "date": ride["date"],
                "time": ride["time"],
                "cost": ride["estimated_cost"],
                "completed_at": req.get("completed_at"),
                "reached_safely_at": req.get("reached_safely_at"),
                "my_rating": my_rating["rating"] if my_rating else None,
                "their_rating": their_rating["rating"] if their_rating else None,
                "can_rate": my_rating is None,
                "pickup_point": ride.get("pickup_point")
            })

    return {
        "history": history,
        "total_count": len(history)
    }

@router.get("/api/ride-history/{ride_request_id}")
async def get_ride_summary(ride_request_id: str, current_user: dict = Depends(get_current_user)):
    """Get detailed summary of a specific ride"""
    try:
        ride_request = ride_requests_collection.find_one({"_id": ObjectId(ride_request_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid ride request ID")

    if not ride_request:
        raise HTTPException(status_code=404, detail="Ride request not found")

    ride = rides_collection.find_one({"_id": ObjectId(ride_request["ride_id"])})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")

    # Verify user is part of this ride
    rider_id = ride_request["rider_id"]
    driver_id = ride["driver_id"]

    if current_user["id"] not in [rider_id, driver_id] and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="You were not part of this ride")

    rider = users_collection.find_one({"_id": ObjectId(rider_id)}, {"password": 0})
    driver = users_collection.find_one({"_id": ObjectId(driver_id)}, {"password": 0})

    # Get ratings
    rider_rating = ratings_collection.find_one({
        "ride_request_id": ride_request_id,
        "rater_id": rider_id
    })
    driver_rating = ratings_collection.find_one({
        "ride_request_id": ride_request_id,
        "rater_id": driver_id
    })

    # Determine current user's role in this ride
    is_rider = current_user["id"] == rider_id
    is_driver = current_user["id"] == driver_id

    return {
        "summary": {
            "ride_request_id": ride_request_id,
            "ride_id": str(ride["_id"]),
            "status": ride_request["status"],
            # Route info
            "source": ride["source"],
            "destination": ride["destination"],
            "pickup_point": ride.get("pickup_point"),
            "date": ride["date"],
            "time": ride["time"],
            "cost": ride["estimated_cost"],
            # Timestamps
            "created_at": ride_request.get("created_at"),
            "accepted_at": ride_request.get("accepted_at"),
            "ride_started_at": ride_request.get("ride_started_at"),
            "completed_at": ride_request.get("completed_at"),
            "reached_safely_at": ride_request.get("reached_safely_at"),
            # Participants
            "rider": {
                "id": rider_id,
                "name": rider["name"] if rider else "Unknown",
                "verification_status": rider.get("verification_status") if rider else "unverified"
            },
            "driver": {
                "id": driver_id,
                "name": driver["name"] if driver else "Unknown",
                "verification_status": driver.get("verification_status") if driver else "unverified",
                "vehicle_model": driver.get("vehicle_model") if driver else None,
                "vehicle_number": driver.get("vehicle_number") if driver else None,
                "vehicle_color": driver.get("vehicle_color") if driver else None
            },
            # Ratings
            "rider_gave_rating": rider_rating["rating"] if rider_rating else None,
            "rider_gave_feedback": rider_rating["feedback"] if rider_rating else None,
            "driver_gave_rating": driver_rating["rating"] if driver_rating else None,
            "driver_gave_feedback": driver_rating["feedback"] if driver_rating else None,
            # Current user context
            "is_rider": is_rider,
            "is_driver": is_driver,
            "can_rate": (is_rider and not rider_rating) or (is_driver and not driver_rating)
        }
    }

@router.get("/api/ratings/pending")
async def get_pending_ratings(current_user: dict = Depends(get_current_user)):
    """Get list of completed rides that need rating"""
    user_id = current_user["id"]
    user_role = current_user["role"]

    pending = []

    if user_role == "driver":
        # Get completed rides by this driver
        rides = list(rides_collection.find({
            "driver_id": user_id,
            "status": "completed"
        }))

        for ride in rides:
            requests = list(ride_requests_collection.find({
                "ride_id": str(ride["_id"]),
                "status": "completed"
            }))

            for req in requests:
                # Check if already rated
                existing = ratings_collection.find_one({
                    "ride_request_id": str(req["_id"]),
                    "rater_id": user_id
                })

                if not existing:
                    rider = users_collection.find_one({"_id": ObjectId(req["rider_id"])}, {"password": 0})
                    pending.append({
                        "ride_request_id": str(req["_id"]),
                        "other_user_id": req["rider_id"],
                        "other_user_name": rider["name"] if rider else "Unknown",
                        "other_user_role": "rider",
                        "source": ride["source"],
                        "destination": ride["destination"],
                        "date": ride["date"],
                        "completed_at": req.get("completed_at")
                    })
    else:
        # Rider: Get completed requests
        requests = list(ride_requests_collection.find({
            "rider_id": user_id,
            "status": "completed"
        }))

        for req in requests:
            # Check if already rated
            existing = ratings_collection.find_one({
                "ride_request_id": str(req["_id"]),
                "rater_id": user_id
            })

            if not existing:
                ride = rides_collection.find_one({"_id": ObjectId(req["ride_id"])})
                if ride:
                    driver = users_collection.find_one({"_id": ObjectId(ride["driver_id"])}, {"password": 0})
                    pending.append({
                        "ride_request_id": str(req["_id"]),
                        "other_user_id": ride["driver_id"],
                        "other_user_name": driver["name"] if driver else "Unknown",
                        "other_user_role": "driver",
                        "source": ride["source"],
                        "destination": ride["destination"],
                        "date": ride["date"],
                        "completed_at": req.get("completed_at")
                    })

    return {
        "pending_ratings": pending,
        "count": len(pending)
    }

@router.get("/api/admin/ratings")
async def admin_get_all_ratings(
    min_rating: int = None,
    max_rating: int = None,
    current_user: dict = Depends(get_current_user)
):
    """Admin: Get all ratings for moderation"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    query = {}
    if min_rating:
        query["rating"] = {"$gte": min_rating}
    if max_rating:
        if "rating" in query:
            query["rating"]["$lte"] = max_rating
        else:
            query["rating"] = {"$lte": max_rating}

    ratings = list(ratings_collection.find(query).sort("created_at", -1).limit(100))

    result = []
    for r in ratings:
        rater = users_collection.find_one({"_id": ObjectId(r["rater_id"])}, {"password": 0})
        rated = users_collection.find_one({"_id": ObjectId(r["rated_user_id"])}, {"password": 0})

        result.append({
            "id": str(r["_id"]),
            "rating": r["rating"],
            "feedback": r.get("feedback"),
            "rater_name": rater["name"] if rater else "Unknown",
            "rater_role": r["rater_role"],
            "rated_user_name": rated["name"] if rated else "Unknown",
            "created_at": r.get("created_at")
        })

    # Stats
    total_ratings = ratings_collection.count_documents({})
    low_ratings = ratings_collection.count_documents({"rating": {"$lte": 2}})

    return {
        "ratings": result,
        "stats": {
            "total_ratings": total_ratings,
            "low_ratings_count": low_ratings
        }
    }

@router.get("/api/admin/low-trust-users")
async def admin_get_low_trust_users(current_user: dict = Depends(get_current_user)):
    """Admin: Get users with low ratings that need review"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    # Get all users except admins
    users = list(users_collection.find({"is_admin": {"$ne": True}}, {"password": 0}))

    low_trust_users = []
    for user in users:
        user_id = str(user["_id"])
        rating_stats = get_user_rating_stats(user_id)

        # Count completed rides
        ride_count = 0
        if user.get("role") == "driver":
            ride_count = rides_collection.count_documents({
                "driver_id": user_id,
                "status": "completed"
            })
        else:
            ride_count = ride_requests_collection.count_documents({
                "rider_id": user_id,
                "status": "completed"
            })

        trust_level = calculate_trust_level(rating_stats["average_rating"], ride_count)

        # Only include users with low trust level
        if trust_level["level"] == "low" or (rating_stats["average_rating"] and rating_stats["average_rating"] < 3.0):
            low_trust_users.append({
                "id": user_id,
                "name": user["name"],
                "email": user["email"],
                "role": user["role"],
                "verification_status": user.get("verification_status", "unverified"),
                "average_rating": rating_stats["average_rating"],
                "total_ratings": rating_stats["total_ratings"],
                "ride_count": ride_count,
                "trust_level": trust_level
            })

    # Sort by average rating (lowest first)
    low_trust_users.sort(key=lambda x: x["average_rating"] or 0)

    return {
        "low_trust_users": low_trust_users,
        "count": len(low_trust_users)
    }