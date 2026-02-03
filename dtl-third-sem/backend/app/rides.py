from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timedelta
from bson import ObjectId

from .models import RideCreate, RideUpdate
from .utils import get_current_user, serialize_ride
from .database import rides_collection, ride_requests_collection, chat_messages_collection
from .config import PICKUP_POINTS, RECURRENCE_PATTERNS

router = APIRouter()

@router.post("/api/rides")
async def create_ride(ride: RideCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can post rides")

    # Check verification status
    if current_user.get("verification_status") != "verified":
        raise HTTPException(status_code=403, detail="Only verified users can post rides. Please complete ID verification first.")

    # Phase 5: Validate pickup point if provided
    if ride.pickup_point:
        valid_pickup_ids = [pp["id"] for pp in PICKUP_POINTS]
        if ride.pickup_point not in valid_pickup_ids:
            raise HTTPException(status_code=400, detail="Invalid pickup point")

    # Phase 5: Validate recurrence pattern if recurring
    if ride.is_recurring:
        if not ride.recurrence_pattern:
            raise HTTPException(status_code=400, detail="Recurrence pattern is required for recurring rides")
        if not ride.recurrence_days_ahead:
            raise HTTPException(status_code=400, detail="Number of days ahead is required for recurring rides")

        valid_patterns = [p["id"] for p in RECURRENCE_PATTERNS]
        if ride.recurrence_pattern not in valid_patterns:
            raise HTTPException(status_code=400, detail="Invalid recurrence pattern")

    new_ride = {
        "driver_id": current_user["id"],
        "source": ride.source,
        "destination": ride.destination,
        "source_lat": ride.source_lat,
        "source_lng": ride.source_lng,
        "destination_lat": ride.destination_lat,
        "destination_lng": ride.destination_lng,
        "date": ride.date,
        "time": ride.time,
        "available_seats": ride.available_seats,
        "estimated_cost": ride.estimated_cost,
        "status": "active",
        # Phase 5: New fields
        "pickup_point": ride.pickup_point,
        "is_recurring": ride.is_recurring,
        "recurrence_pattern": ride.recurrence_pattern if ride.is_recurring else None,
        "parent_ride_id": None,  # This is the parent ride
        "created_at": datetime.now().isoformat()
    }

    result = rides_collection.insert_one(new_ride)
    new_ride["_id"] = result.inserted_id
    parent_ride_id = str(result.inserted_id)

    # Phase 5: Create recurring ride instances
    created_rides = [serialize_ride(new_ride)]
    if ride.is_recurring and ride.recurrence_pattern and ride.recurrence_days_ahead:
        pattern = next((p for p in RECURRENCE_PATTERNS if p["id"] == ride.recurrence_pattern), None)
        if pattern:
            try:
                base_date = datetime.strptime(ride.date, "%Y-%m-%d")
                for day_offset in range(1, ride.recurrence_days_ahead + 1):
                    future_date = base_date + timedelta(days=day_offset)
                    # Check if this day matches the pattern
                    if future_date.weekday() in pattern["days"]:
                        # Check if ride already exists for this date (avoid duplicates)
                        existing = rides_collection.find_one({
                            "driver_id": current_user["id"],
                            "source": ride.source,
                            "destination": ride.destination,
                            "date": future_date.strftime("%Y-%m-%d"),
                            "time": ride.time
                        })
                        if not existing:
                            recurring_ride = {
                                "driver_id": current_user["id"],
                                "source": ride.source,
                                "destination": ride.destination,
                                "source_lat": ride.source_lat,
                                "source_lng": ride.source_lng,
                                "destination_lat": ride.destination_lat,
                                "destination_lng": ride.destination_lng,
                                "date": future_date.strftime("%Y-%m-%d"),
                                "time": ride.time,
                                "available_seats": ride.available_seats,
                                "estimated_cost": ride.estimated_cost,
                                "status": "active",
                                "pickup_point": ride.pickup_point,
                                "is_recurring": False,  # Instance is not recurring itself
                                "recurrence_pattern": None,
                                "parent_ride_id": parent_ride_id,
                                "created_at": datetime.now().isoformat()
                            }
                            rec_result = rides_collection.insert_one(recurring_ride)
                            recurring_ride["_id"] = rec_result.inserted_id
                            created_rides.append(serialize_ride(recurring_ride))
            except ValueError:
                pass  # Invalid date format, skip recurring

    return {
        "message": f"Ride created successfully{' with ' + str(len(created_rides) - 1) + ' recurring instances' if len(created_rides) > 1 else ''}",
        "ride": created_rides[0],
        "recurring_rides_created": len(created_rides) - 1
    }

@router.get("/api/rides")
async def get_rides(
    destination: str = None,
    source: str = None,
    date: str = None,
    # Phase 5: Smart matching parameters
    time_window: int = None,  # Time window in minutes (15, 30, 60)
    preferred_time: str = None,  # HH:MM format
    pickup_point: str = None,
    # Phase 7: Community and event filters
    event_tag: str = None,
    branch: str = None,
    academic_year: str = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"status": "active"}

    # Basic filters
    if date:
        query["date"] = date
    if pickup_point:
        query["pickup_point"] = pickup_point
    # Phase 7: Event tag filter
    if event_tag:
        query["event_tag"] = event_tag

    rides = list(rides_collection.find(query).sort("created_at", -1))
    serialized_rides = []
    recommended_rides = []

    # Phase 5: Smart matching helper functions
    def calculate_route_score(ride, src_keyword, dest_keyword):
        """Calculate route similarity score (0-100)"""
        score = 0
        if src_keyword:
            src_lower = src_keyword.lower()
            ride_src_lower = ride["source"].lower()
            if src_lower in ride_src_lower or ride_src_lower in src_lower:
                score += 50
            elif any(word in ride_src_lower for word in src_lower.split()):
                score += 25

        if dest_keyword:
            dest_lower = dest_keyword.lower()
            ride_dest_lower = ride["destination"].lower()
            if dest_lower in ride_dest_lower or ride_dest_lower in dest_lower:
                score += 50
            elif any(word in ride_dest_lower for word in dest_lower.split()):
                score += 25

        return score

    def calculate_time_diff_minutes(ride_time, preferred):
        """Calculate time difference in minutes"""
        try:
            ride_parts = ride_time.split(":")
            pref_parts = preferred.split(":")
            ride_mins = int(ride_parts[0]) * 60 + int(ride_parts[1])
            pref_mins = int(pref_parts[0]) * 60 + int(pref_parts[1])
            return abs(ride_mins - pref_mins)
        except:
            return 9999

    for ride in rides:
        serialized = serialize_ride(ride)

        # Only show rides with available seats
        if serialized["seats_available"] <= 0:
            continue

        # Phase 7: Filter by driver's branch/academic year
        if branch and serialized.get("driver_branch") != branch:
            continue
        if academic_year and serialized.get("driver_academic_year") != academic_year:
            continue

        # Phase 5: Calculate match score
        route_score = 0
        time_diff = None
        is_recommended = False

        # Route-based matching
        if source or destination:
            route_score = calculate_route_score(ride, source, destination)
            if route_score >= 50:
                is_recommended = True

        # Time window matching
        if preferred_time and time_window:
            time_diff = calculate_time_diff_minutes(ride["time"], preferred_time)
            if time_diff <= time_window:
                is_recommended = True
                serialized["time_diff_minutes"] = time_diff
            else:
                # Skip rides outside time window if strict filtering
                continue
        elif preferred_time:
            time_diff = calculate_time_diff_minutes(ride["time"], preferred_time)
            serialized["time_diff_minutes"] = time_diff

        serialized["route_score"] = route_score
        serialized["is_recommended"] = is_recommended

        if is_recommended:
            recommended_rides.append(serialized)
        else:
            serialized_rides.append(serialized)

    # Sort recommended rides by score (higher first), then by time diff (lower first)
    recommended_rides.sort(key=lambda x: (-x.get("route_score", 0), x.get("time_diff_minutes", 9999)))

    # Combine: recommended first, then rest
    all_rides = recommended_rides + serialized_rides

    return {
        "rides": all_rides,
        "recommended_count": len(recommended_rides),
        "total_count": len(all_rides)
    }

# Phase 5: Get available pickup points
@router.get("/api/pickup-points")
async def get_pickup_points():
    """Get list of RVCE campus pickup points"""
    from .config import PICKUP_POINTS
    return {"pickup_points": PICKUP_POINTS}

# Phase 5: Get recurrence patterns
@router.get("/api/recurrence-patterns")
async def get_recurrence_patterns():
    """Get available recurrence patterns for recurring rides"""
    from .config import RECURRENCE_PATTERNS
    return {"patterns": RECURRENCE_PATTERNS}

@router.get("/api/rides/{ride_id}")
async def get_ride(ride_id: str, current_user: dict = Depends(get_current_user)):
    try:
        ride = rides_collection.find_one({"_id": ObjectId(ride_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid ride ID")

    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")

    return {"ride": serialize_ride(ride)}

@router.get("/api/rides/driver/my-rides")
async def get_my_rides(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can access this endpoint")

    rides = list(rides_collection.find({"driver_id": current_user["id"]}).sort("created_at", -1))
    return {"rides": [serialize_ride(ride) for ride in rides]}

@router.put("/api/rides/{ride_id}")
async def update_ride(ride_id: str, ride: RideUpdate, current_user: dict = Depends(get_current_user)):
    try:
        existing_ride = rides_collection.find_one({"_id": ObjectId(ride_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid ride ID")

    if not existing_ride:
        raise HTTPException(status_code=404, detail="Ride not found")

    if existing_ride["driver_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You can only update your own rides")

    update_data = {}
    if ride.source:
        update_data["source"] = ride.source
    if ride.destination:
        update_data["destination"] = ride.destination
    if ride.source_lat is not None:
        update_data["source_lat"] = ride.source_lat
    if ride.source_lng is not None:
        update_data["source_lng"] = ride.source_lng
    if ride.destination_lat is not None:
        update_data["destination_lat"] = ride.destination_lat
    if ride.destination_lng is not None:
        update_data["destination_lng"] = ride.destination_lng
    if ride.date:
        update_data["date"] = ride.date
    if ride.time:
        update_data["time"] = ride.time
    if ride.available_seats is not None:
        update_data["available_seats"] = ride.available_seats
    if ride.estimated_cost is not None:
        update_data["estimated_cost"] = ride.estimated_cost

    if update_data:
        rides_collection.update_one({"_id": ObjectId(ride_id)}, {"$set": update_data})

    updated_ride = rides_collection.find_one({"_id": ObjectId(ride_id)})
    return {"message": "Ride updated", "ride": serialize_ride(updated_ride)}

@router.delete("/api/rides/{ride_id}")
async def delete_ride(ride_id: str, current_user: dict = Depends(get_current_user)):
    try:
        existing_ride = rides_collection.find_one({"_id": ObjectId(ride_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid ride ID")

    if not existing_ride:
        raise HTTPException(status_code=404, detail="Ride not found")

    if existing_ride["driver_id"] != current_user["id"] and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="You can only delete your own rides")

    rides_collection.delete_one({"_id": ObjectId(ride_id)})
    ride_requests_collection.delete_many({"ride_id": ride_id})
    chat_messages_collection.delete_many({"ride_id": ride_id})  # Phase 3: Delete chat messages

    return {"message": "Ride deleted successfully"}

@router.put("/api/rides/{ride_id}/complete")
async def complete_ride(ride_id: str, current_user: dict = Depends(get_current_user)):
    try:
        existing_ride = rides_collection.find_one({"_id": ObjectId(ride_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid ride ID")

    if not existing_ride:
        raise HTTPException(status_code=404, detail="Ride not found")

    if existing_ride["driver_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the driver can complete this ride")

    rides_collection.update_one({"_id": ObjectId(ride_id)}, {"$set": {"status": "completed"}})

    # Update all accepted/ongoing requests to completed
    ride_requests_collection.update_many(
        {"ride_id": ride_id, "status": {"$in": ["accepted", "ongoing"]}},
        {"$set": {"status": "completed", "completed_at": datetime.now().isoformat()}}
    )

    updated_ride = rides_collection.find_one({"_id": ObjectId(ride_id)})
    return {"message": "Ride completed", "ride": serialize_ride(updated_ride)}