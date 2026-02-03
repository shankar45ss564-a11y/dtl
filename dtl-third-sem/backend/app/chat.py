from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from bson import ObjectId

from .models import ChatMessage
from .utils import get_current_user, serialize_chat_message
from .database import ride_requests_collection, rides_collection, chat_messages_collection

router = APIRouter()

@router.get("/api/chat/{request_id}/messages")
async def get_chat_messages(request_id: str, current_user: dict = Depends(get_current_user)):
    """Get chat messages for a ride request - Only participants can access"""
    try:
        ride_request = ride_requests_collection.find_one({"_id": ObjectId(request_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid request ID")

    if not ride_request:
        raise HTTPException(status_code=404, detail="Ride request not found")

    ride = rides_collection.find_one({"_id": ObjectId(ride_request["ride_id"])})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")

    # Check if user is participant (rider or driver) or admin
    is_rider = ride_request["rider_id"] == current_user["id"]
    is_driver = ride["driver_id"] == current_user["id"]
    is_admin = current_user.get("is_admin", False)

    if not (is_rider or is_driver or is_admin):
        raise HTTPException(status_code=403, detail="Only ride participants can access chat")

    # Chat only available after acceptance
    if ride_request["status"] == "requested" or ride_request["status"] == "rejected":
        raise HTTPException(status_code=403, detail="Chat is only available after ride acceptance")

    messages = list(chat_messages_collection.find({"ride_request_id": request_id}).sort("created_at", 1))

    return {
        "messages": [serialize_chat_message(msg) for msg in messages],
        "chat_enabled": ride_request["status"] in ["accepted", "ongoing"],  # Disable after completion
        "request_status": ride_request["status"]
    }

@router.post("/api/chat/{request_id}/messages")
async def send_chat_message(request_id: str, chat_data: ChatMessage, current_user: dict = Depends(get_current_user)):
    """Send a chat message - Only participants can send"""
    try:
        ride_request = ride_requests_collection.find_one({"_id": ObjectId(request_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid request ID")

    if not ride_request:
        raise HTTPException(status_code=404, detail="Ride request not found")

    ride = rides_collection.find_one({"_id": ObjectId(ride_request["ride_id"])})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")

    # Check if user is participant
    is_rider = ride_request["rider_id"] == current_user["id"]
    is_driver = ride["driver_id"] == current_user["id"]

    if not (is_rider or is_driver):
        raise HTTPException(status_code=403, detail="Only ride participants can send messages")

    # Chat only available after acceptance and before completion
    if ride_request["status"] not in ["accepted", "ongoing"]:
        if ride_request["status"] == "completed":
            raise HTTPException(status_code=403, detail="Chat is disabled after ride completion")
        raise HTTPException(status_code=403, detail="Chat is only available after ride acceptance")

    new_message = {
        "ride_request_id": request_id,
        "ride_id": ride_request["ride_id"],
        "sender_id": current_user["id"],
        "message": chat_data.message,
        "created_at": datetime.now().isoformat()
    }

    result = chat_messages_collection.insert_one(new_message)
    new_message["_id"] = result.inserted_id

    return {"message": "Message sent", "chat_message": serialize_chat_message(new_message)}