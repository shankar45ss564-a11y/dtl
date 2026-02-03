from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from bson import ObjectId

from .models import RideRequestCreate, RideRequestAction, StartRideRequest
from .utils import get_current_user, serialize_ride_request, generate_ride_pin
from .database import rides_collection, ride_requests_collection, chat_messages_collection
from .config import PICKUP_POINTS

router = APIRouter()

@router.post("/api/ride-requests")
async def create_ride_request(request: RideRequestCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "rider":
        raise HTTPException(status_code=403, detail="Only riders can request rides")

    # Check verification status
    if current_user.get("verification_status") != "verified":
        raise HTTPException(status_code=403, detail="Only verified users can request rides. Please complete ID verification first.")

    try:
        ride = rides_collection.find_one({"_id": ObjectId(request.ride_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid ride ID")

    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")

    if ride["status"] != "active":
        raise HTTPException(status_code=400, detail="This ride is no longer active")

    # Phase 5: Validate urgent request - must be for rides within active time window (next 60 mins)
    if request.is_urgent:
        try:
            ride_datetime_str = f"{ride['date']} {ride['time']}"
            ride_datetime = datetime.strptime(ride_datetime_str, "%Y-%m-%d %H:%M")
            now = datetime.now()
            time_diff = (ride_datetime - now).total_seconds() / 60  # minutes

            # Urgent requests only valid for rides starting within 60 minutes
            if time_diff > 60 or time_diff < -10:  # Allow 10 min past for flexibility
                raise HTTPException(
                    status_code=400,
                    detail="Urgent requests can only be made for rides starting within the next 60 minutes"
                )
        except ValueError:
            pass  # If date parsing fails, allow the request

    # Check if already requested
    existing_request = ride_requests_collection.find_one({
        "ride_id": request.ride_id,
        "rider_id": current_user["id"]
    })

    if existing_request:
        raise HTTPException(status_code=400, detail="You have already requested this ride")

    # Check seat availability
    accepted_count = ride_requests_collection.count_documents({
        "ride_id": request.ride_id,
        "status": {"$in": ["accepted", "ongoing"]}
    })

    if accepted_count >= ride["available_seats"]:
        raise HTTPException(status_code=400, detail="No seats available")

    new_request = {
        "ride_id": request.ride_id,
        "rider_id": current_user["id"],
        "status": "requested",
        "ride_pin": None,  # Phase 3: PIN will be generated on acceptance
        "is_urgent": request.is_urgent,  # Phase 5: Urgent/instant ride flag
        "created_at": datetime.now().isoformat()
    }

    result = ride_requests_collection.insert_one(new_request)
    new_request["_id"] = result.inserted_id

    return {
        "message": "Urgent ride request submitted! Driver will be notified." if request.is_urgent else "Ride request submitted",
        "request": serialize_ride_request(new_request)
    }

@router.get("/api/ride-requests/my-requests")
async def get_my_requests(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "rider":
        raise HTTPException(status_code=403, detail="Only riders can access this endpoint")

    requests = list(ride_requests_collection.find({"rider_id": current_user["id"]}).sort("created_at", -1))
    return {"requests": [serialize_ride_request(req) for req in requests]}

@router.get("/api/ride-requests/ride/{ride_id}")
async def get_ride_requests(ride_id: str, current_user: dict = Depends(get_current_user)):
    try:
        ride = rides_collection.find_one({"_id": ObjectId(ride_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid ride ID")

    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")

    if ride["driver_id"] != current_user["id"] and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="You can only view requests for your own rides")

    requests = list(ride_requests_collection.find({"ride_id": ride_id}).sort("created_at", -1))
    return {"requests": [serialize_ride_request(req) for req in requests]}

@router.get("/api/ride-requests/driver/pending")
async def get_driver_pending_requests(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can access this endpoint")

    # Get all rides by this driver
    driver_rides = list(rides_collection.find({"driver_id": current_user["id"]}))
    ride_ids = [str(ride["_id"]) for ride in driver_rides]

    # Get pending requests for these rides
    requests = list(ride_requests_collection.find({
        "ride_id": {"$in": ride_ids},
        "status": "requested"
    }).sort("created_at", -1))

    return {"requests": [serialize_ride_request(req) for req in requests]}

# Phase 3: Get driver's accepted requests (for managing ongoing rides)
@router.get("/api/ride-requests/driver/accepted")
async def get_driver_accepted_requests(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can access this endpoint")

    # Get all rides by this driver
    driver_rides = list(rides_collection.find({"driver_id": current_user["id"]}))
    ride_ids = [str(ride["_id"]) for ride in driver_rides]

    # Get accepted and ongoing requests for these rides
    requests = list(ride_requests_collection.find({
        "ride_id": {"$in": ride_ids},
        "status": {"$in": ["accepted", "ongoing"]}
    }).sort("created_at", -1))

    return {"requests": [serialize_ride_request(req) for req in requests]}

@router.put("/api/ride-requests/{request_id}")
async def handle_ride_request(request_id: str, action: RideRequestAction, current_user: dict = Depends(get_current_user)):
    try:
        ride_request = ride_requests_collection.find_one({"_id": ObjectId(request_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid request ID")

    if not ride_request:
        raise HTTPException(status_code=404, detail="Request not found")

    ride = rides_collection.find_one({"_id": ObjectId(ride_request["ride_id"])})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")

    if ride["driver_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the driver can handle this request")

    if ride_request["status"] != "requested":
        raise HTTPException(status_code=400, detail="Request already processed")

    new_status = "accepted" if action.action == "accept" else "rejected"

    # Check seat availability for acceptance
    if action.action == "accept":
        accepted_count = ride_requests_collection.count_documents({
            "ride_id": ride_request["ride_id"],
            "status": {"$in": ["accepted", "ongoing"]}
        })
        if accepted_count >= ride["available_seats"]:
            raise HTTPException(status_code=400, detail="No seats available")

    update_data = {"status": new_status}

    # Phase 3: Generate PIN when accepting
    if action.action == "accept":
        update_data["ride_pin"] = generate_ride_pin()
        update_data["accepted_at"] = datetime.now().isoformat()

    ride_requests_collection.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": update_data}
    )

    updated_request = ride_requests_collection.find_one({"_id": ObjectId(request_id)})
    return {"message": f"Request {new_status}", "request": serialize_ride_request(updated_request)}

# Phase 3: Start Ride with PIN verification
@router.post("/api/ride-requests/{request_id}/start")
async def start_ride(request_id: str, pin_data: StartRideRequest, current_user: dict = Depends(get_current_user)):
    """Start ride after PIN verification - Driver only"""
    try:
        ride_request = ride_requests_collection.find_one({"_id": ObjectId(request_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid request ID")

    if not ride_request:
        raise HTTPException(status_code=404, detail="Ride request not found")

    ride = rides_collection.find_one({"_id": ObjectId(ride_request["ride_id"])})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")

    # Only driver can start the ride
    if ride["driver_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the driver can start this ride")

    # Check if request is in accepted status
    if ride_request["status"] != "accepted":
        if ride_request["status"] == "ongoing":
            raise HTTPException(status_code=400, detail="Ride has already started")
        raise HTTPException(status_code=400, detail="Ride request must be accepted before starting")

    # Verify PIN
    if ride_request.get("ride_pin") != pin_data.pin:
        raise HTTPException(status_code=400, detail="Incorrect PIN. Please verify with the rider.")

    # Update request status to ongoing
    ride_requests_collection.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {
            "status": "ongoing",
            "ride_started_at": datetime.now().isoformat()
        }}
    )

    updated_request = ride_requests_collection.find_one({"_id": ObjectId(request_id)})
    return {"message": "Ride started successfully!", "request": serialize_ride_request(updated_request)}

# Phase 4: Live Ride & Safety Endpoints
@router.get("/api/ride-requests/{request_id}/live")
async def get_live_ride_details(request_id: str, current_user: dict = Depends(get_current_user)):
    """Get detailed ride information for live ride screen"""
    try:
        ride_request = ride_requests_collection.find_one({"_id": ObjectId(request_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid request ID")

    if not ride_request:
        raise HTTPException(status_code=404, detail="Ride request not found")

    ride = rides_collection.find_one({"_id": ObjectId(ride_request["ride_id"])})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")

    # Check authorization - only participants can view
    is_rider = ride_request["rider_id"] == current_user["id"]
    is_driver = ride["driver_id"] == current_user["id"]
    is_admin = current_user.get("is_admin", False)

    if not (is_rider or is_driver or is_admin):
        raise HTTPException(status_code=403, detail="Not authorized to view this ride")

    # Check if there's an active SOS for this ride
    from .database import sos_events_collection
    active_sos = sos_events_collection.find_one({
        "ride_request_id": request_id,
        "status": {"$in": ["active", "reviewed"]}
    })

    serialized = serialize_ride_request(ride_request)
    serialized["has_active_sos"] = active_sos is not None
    serialized["sos_id"] = str(active_sos["_id"]) if active_sos else None

    return {"ride": serialized}

@router.post("/api/ride-requests/{request_id}/reached-safely")
async def mark_reached_safely(request_id: str, current_user: dict = Depends(get_current_user)):
    """Rider confirms safe arrival - marks ride as completed"""
    try:
        ride_request = ride_requests_collection.find_one({"_id": ObjectId(request_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid request ID")

    if not ride_request:
        raise HTTPException(status_code=404, detail="Ride request not found")

    # Only the rider can mark reached safely
    if ride_request["rider_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the rider can confirm safe arrival")

    # Must be in ongoing status
    if ride_request["status"] != "ongoing":
        if ride_request["status"] == "completed":
            raise HTTPException(status_code=400, detail="Ride is already completed")
        raise HTTPException(status_code=400, detail="Ride must be ongoing to mark as completed")

    # Update ride request to completed
    now = datetime.now().isoformat()
    ride_requests_collection.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {
            "status": "completed",
            "reached_safely_at": now,
            "completed_at": now
        }}
    )

    # Check if all requests for this ride are completed
    ride_id = ride_request["ride_id"]
    pending_requests = ride_requests_collection.count_documents({
        "ride_id": ride_id,
        "status": {"$in": ["accepted", "ongoing"]}
    })

    # If no more active requests, mark the ride as completed
    if pending_requests == 0:
        rides_collection.update_one(
            {"_id": ObjectId(ride_id)},
            {"$set": {"status": "completed"}}
        )

    updated_request = ride_requests_collection.find_one({"_id": ObjectId(request_id)})
    return {
        "message": "Arrived safely! Ride completed.",
        "request": serialize_ride_request(updated_request)
    }