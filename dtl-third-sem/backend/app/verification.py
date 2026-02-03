from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from bson import ObjectId
import base64

from .models import VerificationUpload, VerificationAction
from .utils import get_current_user, log_admin_action
from .database import users_collection

router = APIRouter()

@router.post("/api/verification/upload")
async def upload_verification(data: VerificationUpload, current_user: dict = Depends(get_current_user)):
    """Upload student ID for verification"""
    if current_user.get("is_admin"):
        raise HTTPException(status_code=400, detail="Admins do not need verification")

    # Validate base64 image
    try:
        # Check if it's a valid base64 string with data URL prefix
        if not data.student_id_image.startswith("data:image/"):
            raise HTTPException(status_code=400, detail="Invalid image format. Please upload a valid image.")

        # Extract the base64 part and validate
        base64_part = data.student_id_image.split(",")[1] if "," in data.student_id_image else data.student_id_image
        base64.b64decode(base64_part)
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid image data")

    # Update user with verification data
    users_collection.update_one(
        {"_id": ObjectId(current_user["id"])},
        {
            "$set": {
                "student_id_image": data.student_id_image,
                "verification_status": "pending",
                "rejection_reason": None,
                "submitted_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )

    return {"message": "Student ID uploaded successfully. Awaiting admin verification."}

@router.get("/api/verification/status")
async def get_verification_status(current_user: dict = Depends(get_current_user)):
    """Get current user's verification status"""
    user = users_collection.find_one({"_id": ObjectId(current_user["id"])}, {"password": 0})

    return {
        "verification_status": user.get("verification_status", "unverified"),
        "rejection_reason": user.get("rejection_reason"),
        "verified_at": user.get("verified_at"),
        "submitted_at": user.get("submitted_at"),
        "has_uploaded_id": user.get("student_id_image") is not None
    }

@router.get("/api/admin/verifications")
async def get_pending_verifications(current_user: dict = Depends(get_current_user)):
    """Get all pending verification requests - Admin only"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    # Get all users with pending verification
    pending_users = list(users_collection.find(
        {"verification_status": "pending"},
        {"password": 0}
    ).sort("submitted_at", -1))

    result = []
    for user in pending_users:
        result.append({
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "student_id_image": user.get("student_id_image"),
            "submitted_at": user.get("submitted_at"),
            "created_at": user.get("created_at")
        })

    return {"verifications": result}

@router.get("/api/admin/verifications/all")
async def get_all_verifications(current_user: dict = Depends(get_current_user)):
    """Get all verification records - Admin only"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    # Get all non-admin users
    all_users = list(users_collection.find(
        {"is_admin": {"$ne": True}},
        {"password": 0}
    ).sort("submitted_at", -1))

    result = []
    for user in all_users:
        result.append({
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "verification_status": user.get("verification_status", "unverified"),
            "student_id_image": user.get("student_id_image"),
            "rejection_reason": user.get("rejection_reason"),
            "submitted_at": user.get("submitted_at"),
            "verified_at": user.get("verified_at"),
            "created_at": user.get("created_at")
        })

    return {"verifications": result}

@router.put("/api/admin/verifications/{user_id}")
async def handle_verification(user_id: str, action: VerificationAction, current_user: dict = Depends(get_current_user)):
    """Approve or reject a verification request - Admin only"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if action.action == "approve":
        users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "verification_status": "verified",
                    "verified_at": datetime.now(timezone.utc).isoformat(),
                    "rejection_reason": None,
                    "verified_by": current_user["id"]
                }
            }
        )
        # Phase 8: Log admin action
        log_admin_action(
            admin_id=current_user["id"],
            admin_name=current_user["name"],
            action_type="verification_approved",
            target_type="user",
            target_id=user_id,
            details={"user_name": user["name"]}
        )
        return {"message": f"User {user['name']} has been verified successfully"}

    elif action.action == "reject":
        if not action.reason:
            raise HTTPException(status_code=400, detail="Rejection reason is required")

        users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "verification_status": "rejected",
                    "rejection_reason": action.reason,
                    "verified_at": None,
                    "rejected_by": current_user["id"]
                }
            }
        )
        # Phase 8: Log admin action
        log_admin_action(
            admin_id=current_user["id"],
            admin_name=current_user["name"],
            action_type="verification_rejected",
            target_type="user",
            target_id=user_id,
            details={"user_name": user["name"], "reason": action.reason}
        )
        return {"message": f"User {user['name']}'s verification has been rejected"}

@router.put("/api/admin/verifications/{user_id}/revoke")
async def admin_revoke_verification(user_id: str, current_user: dict = Depends(get_current_user)):
    """Admin: Revoke a user's verification status"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.get("verification_status") != "verified":
        raise HTTPException(status_code=400, detail="User is not verified")

    users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "verification_status": "unverified",
            "verified_at": None,
            "verification_revoked_at": datetime.now(timezone.utc).isoformat(),
            "verification_revoked_by": current_user["id"]
        }}
    )

    # Log admin action
    log_admin_action(
        admin_id=current_user["id"],
        admin_name=current_user["name"],
        action_type="verification_revoked",
        target_type="user",
        target_id=user_id,
        details={"user_name": user["name"]}
    )

    return {"message": f"Verification revoked for {user['name']}"}