from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from bson import ObjectId

from .models import SOSCreate, SOSAction
from .utils import get_current_user, serialize_sos_event, log_admin_action
from .database import ride_requests_collection, rides_collection, sos_events_collection

router = APIRouter()

@router.post("/api/sos")
async def trigger_sos(sos_data: SOSCreate, current_user: dict = Depends(get_current_user)):
    """Trigger SOS emergency during an ongoing ride"""
    try:
        ride_request = ride_requests_collection.find_one({"_id": ObjectId(sos_data.ride_request_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid ride request ID")

    if not ride_request:
        raise HTTPException(status_code=404, detail="Ride request not found")

    ride = rides_collection.find_one({"_id": ObjectId(ride_request["ride_id"])})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")

    # Only participants can trigger SOS
    is_rider = ride_request["rider_id"] == current_user["id"]
    is_driver = ride["driver_id"] == current_user["id"]

    if not (is_rider or is_driver):
        raise HTTPException(status_code=403, detail="Only ride participants can trigger SOS")

    # Must be ongoing ride
    if ride_request["status"] != "ongoing":
        raise HTTPException(status_code=400, detail="SOS can only be triggered during an ongoing ride")

    # Check if there's already an active SOS for this ride
    existing_sos = sos_events_collection.find_one({
        "ride_request_id": sos_data.ride_request_id,
        "status": {"$in": ["active", "reviewed"]}
    })

    if existing_sos:
        raise HTTPException(status_code=400, detail="An SOS alert is already active for this ride")

    # Create SOS event
    new_sos = {
        "ride_request_id": sos_data.ride_request_id,
        "ride_id": ride_request["ride_id"],
        "triggered_by": current_user["id"],
        "triggered_by_role": current_user["role"],
        "latitude": sos_data.latitude,
        "longitude": sos_data.longitude,
        "message": sos_data.message,
        "status": "active",
        "admin_notes": None,
        "reviewed_at": None,
        "resolved_at": None,
        "resolved_by": None,
        "created_at": datetime.now().isoformat()
    }

    result = sos_events_collection.insert_one(new_sos)
    new_sos["_id"] = result.inserted_id

    return {
        "message": "SOS alert triggered! Help is on the way.",
        "sos": serialize_sos_event(new_sos)
    }

@router.get("/api/sos/my-active")
async def get_my_active_sos(current_user: dict = Depends(get_current_user)):
    """Get user's active SOS events"""
    active_sos = list(sos_events_collection.find({
        "triggered_by": current_user["id"],
        "status": {"$in": ["active", "reviewed"]}
    }).sort("created_at", -1))

    return {"sos_events": [serialize_sos_event(sos) for sos in active_sos]}

@router.get("/api/admin/sos")
async def admin_get_sos_events(
    status: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Admin: Get all SOS events"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    query = {}
    if status:
        query["status"] = status

    sos_events = list(sos_events_collection.find(query).sort("created_at", -1))

    # Get counts for dashboard
    active_count = sos_events_collection.count_documents({"status": "active"})
    reviewed_count = sos_events_collection.count_documents({"status": "reviewed"})
    resolved_count = sos_events_collection.count_documents({"status": "resolved"})

    return {
        "sos_events": [serialize_sos_event(sos) for sos in sos_events],
        "counts": {
            "active": active_count,
            "reviewed": reviewed_count,
            "resolved": resolved_count,
            "total": active_count + reviewed_count + resolved_count
        }
    }

@router.put("/api/admin/sos/{sos_id}")
async def admin_update_sos(
    sos_id: str,
    action: SOSAction,
    current_user: dict = Depends(get_current_user)
):
    """Admin: Update SOS event status"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        sos = sos_events_collection.find_one({"_id": ObjectId(sos_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid SOS ID")

    if not sos:
        raise HTTPException(status_code=404, detail="SOS event not found")

    now = datetime.now().isoformat()
    update_data = {}

    if action.action == "review":
        update_data = {
            "status": "under_review",
            "reviewed_at": now,
            "reviewed_by": current_user["id"],
            "admin_notes": action.notes
        }
        message = "SOS marked as under review"
    elif action.action == "resolve":
        update_data = {
            "status": "resolved",
            "resolved_at": now,
            "resolved_by": current_user["id"],
            "admin_notes": action.notes or sos.get("admin_notes")
        }
        message = "SOS resolved successfully"

    sos_events_collection.update_one(
        {"_id": ObjectId(sos_id)},
        {"$set": update_data}
    )

    # Phase 8: Log admin action
    log_admin_action(
        admin_id=current_user["id"],
        admin_name=current_user["name"],
        action_type=f"sos_{action.action}",
        target_type="sos",
        target_id=sos_id,
        details={"previous_status": sos.get("status"), "notes": action.notes}
    )

    updated_sos = sos_events_collection.find_one({"_id": ObjectId(sos_id)})
    return {"message": message, "sos": serialize_sos_event(updated_sos)}