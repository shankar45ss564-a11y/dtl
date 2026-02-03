from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from bson import ObjectId

from .models import UserStatusUpdate, PromoteUserRequest, ReportCreate, ReportAction
from .utils import get_current_user, serialize_user, log_admin_action
from .database import (
    users_collection, rides_collection, ride_requests_collection,
    chat_messages_collection, ratings_collection, sos_events_collection,
    reports_collection, audit_logs_collection, event_tags_collection
)
from .config import BRANCHES, ACADEMIC_YEARS, BADGE_DEFINITIONS

router = APIRouter()

# User Management
@router.get("/api/admin/users")
async def admin_get_users(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    users = list(users_collection.find({}, {"password": 0}))
    return {"users": [serialize_user(user) for user in users]}

@router.put("/api/admin/users/{user_id}/status")
async def admin_update_user_status(user_id: str, status_update: UserStatusUpdate, current_user: dict = Depends(get_current_user)):
    """Admin: Enable or disable a user account"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.get("is_admin"):
        raise HTTPException(status_code=400, detail="Cannot disable admin accounts")

    users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "is_active": status_update.is_active,
            "status_reason": status_update.reason,
            "status_updated_at": datetime.now(timezone.utc).isoformat(),
            "status_updated_by": current_user["id"]
        }}
    )

    # Log admin action
    log_admin_action(
        admin_id=current_user["id"],
        admin_name=current_user["name"],
        action_type="user_enabled" if status_update.is_active else "user_disabled",
        target_type="user",
        target_id=user_id,
        details={"reason": status_update.reason, "user_name": user["name"]}
    )

    action = "enabled" if status_update.is_active else "disabled"
    return {"message": f"User {user['name']} has been {action}"}

@router.put("/api/admin/users/{user_id}/promote")
async def admin_promote_user(user_id: str, request: PromoteUserRequest, current_user: dict = Depends(get_current_user)):
    """Admin: Promote a user to admin role"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    if not request.confirm:
        raise HTTPException(status_code=400, detail="Confirmation required")

    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.get("is_admin"):
        raise HTTPException(status_code=400, detail="User is already an admin")

    users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "is_admin": True,
            "role": "admin",
            "promoted_at": datetime.now(timezone.utc).isoformat(),
            "promoted_by": current_user["id"]
        }}
    )

    # Log admin action
    log_admin_action(
        admin_id=current_user["id"],
        admin_name=current_user["name"],
        action_type="user_promoted",
        target_type="user",
        target_id=user_id,
        details={"user_name": user["name"], "previous_role": user["role"]}
    )

    return {"message": f"User {user['name']} has been promoted to admin"}

@router.delete("/api/admin/users/{user_id}")
async def admin_delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Admin: Permanently delete a user and all their data"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.get("is_admin"):
        raise HTTPException(status_code=400, detail="Cannot delete admin accounts")

    user_name = user["name"]

    # Delete all user's rides
    user_rides = list(rides_collection.find({"driver_id": user_id}))
    ride_ids = [str(r["_id"]) for r in user_rides]

    # Delete ride requests for user's rides
    if ride_ids:
        ride_requests_collection.delete_many({"ride_id": {"$in": ride_ids}})
        # Delete chat messages for user's rides
        chat_messages_collection.delete_many({"ride_id": {"$in": ride_ids}})

    # Delete user's own ride requests
    user_requests = list(ride_requests_collection.find({"rider_id": user_id}))
    user_request_ids = [str(r["_id"]) for r in user_requests]

    # Delete chat messages from user's requests
    if user_request_ids:
        chat_messages_collection.delete_many({"ride_request_id": {"$in": user_request_ids}})

    ride_requests_collection.delete_many({"rider_id": user_id})

    # Delete user's rides
    rides_collection.delete_many({"driver_id": user_id})

    # Delete ratings given by and received by user
    ratings_collection.delete_many({"$or": [{"rater_id": user_id}, {"rated_user_id": user_id}]})

    # Delete SOS events triggered by user
    sos_events_collection.delete_many({"triggered_by": user_id})

    # Delete reports by and against user
    reports_collection.delete_many({"$or": [{"reporter_id": user_id}, {"reported_user_id": user_id}]})

    # Delete chat messages sent by user
    chat_messages_collection.delete_many({"sender_id": user_id})

    # Finally delete the user
    users_collection.delete_one({"_id": ObjectId(user_id)})

    # Log admin action
    log_admin_action(
        admin_id=current_user["id"],
        admin_name=current_user["name"],
        action_type="user_deleted",
        target_type="user",
        target_id=user_id,
        details={"user_name": user_name, "user_email": user["email"]}
    )

    return {"message": f"User {user_name} and all associated data have been permanently deleted"}

# Ride Management
@router.get("/api/admin/rides")
async def admin_get_rides(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    rides = list(rides_collection.find().sort("created_at", -1))
    from .utils import serialize_ride
    return {"rides": [serialize_ride(ride) for ride in rides]}

# Reports Management
@router.post("/api/reports")
async def create_report(report: ReportCreate, current_user: dict = Depends(get_current_user)):
    """Submit a report against a user or ride"""
    if not report.reported_user_id and not report.ride_id:
        raise HTTPException(status_code=400, detail="Must specify either a user or ride to report")

    # Validate reported user if provided
    reported_user = None
    if report.reported_user_id:
        try:
            reported_user = users_collection.find_one({"_id": ObjectId(report.reported_user_id)})
        except:
            raise HTTPException(status_code=400, detail="Invalid reported user ID")
        if not reported_user:
            raise HTTPException(status_code=404, detail="Reported user not found")
        if report.reported_user_id == current_user["id"]:
            raise HTTPException(status_code=400, detail="Cannot report yourself")

    # Validate ride if provided
    reported_ride = None
    if report.ride_id:
        try:
            reported_ride = rides_collection.find_one({"_id": ObjectId(report.ride_id)})
        except:
            raise HTTPException(status_code=400, detail="Invalid ride ID")
        if not reported_ride:
            raise HTTPException(status_code=404, detail="Ride not found")

    new_report = {
        "reporter_id": current_user["id"],
        "reporter_name": current_user["name"],
        "reported_user_id": report.reported_user_id,
        "reported_user_name": reported_user["name"] if reported_user else None,
        "ride_id": report.ride_id,
        "category": report.category,
        "description": report.description,
        "status": "pending",  # pending, under_review, resolved, dismissed
        "admin_notes": None,
        "action_taken": None,
        "handled_by": None,
        "handled_at": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    result = reports_collection.insert_one(new_report)

    return {
        "message": "Report submitted successfully. Our team will review it.",
        "report_id": str(result.inserted_id)
    }

@router.get("/api/admin/reports")
async def admin_get_reports(
    status: str = None,
    category: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Admin: Get all reports"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    query = {}
    if status:
        query["status"] = status
    if category:
        query["category"] = category

    reports = list(reports_collection.find(query).sort("created_at", -1))

    result = []
    for report in reports:
        result.append({
            "id": str(report["_id"]),
            "reporter_id": report["reporter_id"],
            "reporter_name": report["reporter_name"],
            "reported_user_id": report.get("reported_user_id"),
            "reported_user_name": report.get("reported_user_name"),
            "ride_id": report.get("ride_id"),
            "category": report["category"],
            "description": report["description"],
            "status": report["status"],
            "admin_notes": report.get("admin_notes"),
            "action_taken": report.get("action_taken"),
            "handled_by": report.get("handled_by"),
            "handled_at": report.get("handled_at"),
            "created_at": report["created_at"]
        })

    # Stats
    pending_count = reports_collection.count_documents({"status": "pending"})
    under_review_count = reports_collection.count_documents({"status": "under_review"})

    return {
        "reports": result,
        "stats": {
            "pending": pending_count,
            "under_review": under_review_count,
            "total": len(result)
        }
    }

@router.put("/api/admin/reports/{report_id}")
async def admin_handle_report(report_id: str, action: ReportAction, current_user: dict = Depends(get_current_user)):
    """Admin: Handle a report - warn, suspend, disable, or dismiss"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        report = reports_collection.find_one({"_id": ObjectId(report_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid report ID")

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # Update report status
    update_data = {
        "status": "resolved" if action.action != "dismiss" else "dismissed",
        "action_taken": action.action,
        "admin_notes": action.admin_notes,
        "handled_by": current_user["id"],
        "handled_at": datetime.now(timezone.utc).isoformat()
    }

    reports_collection.update_one(
        {"_id": ObjectId(report_id)},
        {"$set": update_data}
    )

    # Take action on reported user if applicable
    reported_user_id = report.get("reported_user_id")
    action_message = ""

    if reported_user_id and action.action in ["warn", "suspend", "disable"]:
        user_update = {}

        if action.action == "warn":
            user_update = {
                "warning_count": 1,  # Increment would need $inc
                "last_warning_at": datetime.now(timezone.utc).isoformat(),
                "last_warning_reason": action.admin_notes
            }
            action_message = "User has been warned"
        elif action.action == "suspend":
            user_update = {
                "is_active": False,
                "is_suspended": True,
                "suspended_at": datetime.now(timezone.utc).isoformat(),
                "suspension_reason": action.admin_notes
            }
            action_message = "User has been suspended"
        elif action.action == "disable":
            user_update = {
                "is_active": False,
                "disabled_at": datetime.now(timezone.utc).isoformat(),
                "disable_reason": action.admin_notes
            }
            action_message = "User account has been disabled"

        if user_update:
            # Use $inc for warning_count
            if action.action == "warn":
                users_collection.update_one(
                    {"_id": ObjectId(reported_user_id)},
                    {
                        "$inc": {"warning_count": 1},
                        "$set": {
                            "last_warning_at": datetime.now(timezone.utc).isoformat(),
                            "last_warning_reason": action.admin_notes
                        }
                    }
                )
            else:
                users_collection.update_one(
                    {"_id": ObjectId(reported_user_id)},
                    {"$set": user_update}
                )

    elif action.action == "dismiss":
        action_message = "Report has been dismissed"

    # Log admin action
    log_admin_action(
        admin_id=current_user["id"],
        admin_name=current_user["name"],
        action_type=f"report_{action.action}",
        target_type="report",
        target_id=report_id,
        details={
            "reported_user_id": reported_user_id,
            "category": report["category"],
            "action_taken": action.action
        }
    )

    return {"message": action_message or f"Report handled with action: {action.action}"}

# Audit Logs
@router.get("/api/admin/audit-logs")
async def admin_get_audit_logs(
    action_type: str = None,
    target_type: str = None,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """Admin: Get audit logs of all admin actions"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    query = {}
    if action_type:
        query["action_type"] = action_type
    if target_type:
        query["target_type"] = target_type

    logs = list(audit_logs_collection.find(query).sort("timestamp", -1).limit(limit))

    result = []
    for log in logs:
        result.append({
            "id": str(log["_id"]),
            "admin_id": log["admin_id"],
            "admin_name": log["admin_name"],
            "action_type": log["action_type"],
            "target_type": log["target_type"],
            "target_id": log["target_id"],
            "details": log.get("details", {}),
            "timestamp": log["timestamp"]
        })

    return {"audit_logs": result, "total": len(result)}

# Stats and Analytics
@router.get("/api/admin/stats")
async def admin_get_stats(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    total_users = users_collection.count_documents({})
    total_riders = users_collection.count_documents({"role": "rider"})
    total_drivers = users_collection.count_documents({"role": "driver"})
    total_rides = rides_collection.count_documents({})
    active_rides = rides_collection.count_documents({"status": "active"})
    completed_rides = rides_collection.count_documents({"status": "completed"})
    total_requests = ride_requests_collection.count_documents({})
    pending_requests = ride_requests_collection.count_documents({"status": "requested"})
    ongoing_rides = ride_requests_collection.count_documents({"status": "ongoing"})

    # Verification stats
    verified_users = users_collection.count_documents({"verification_status": "verified"})
    pending_verifications = users_collection.count_documents({"verification_status": "pending"})
    unverified_users = users_collection.count_documents({"verification_status": "unverified"})
    rejected_verifications = users_collection.count_documents({"verification_status": "rejected"})

    # Phase 4: SOS stats
    active_sos = sos_events_collection.count_documents({"status": "active"})
    total_sos = sos_events_collection.count_documents({})

    # Phase 8: Report stats
    pending_reports = reports_collection.count_documents({"status": "pending"})
    total_reports = reports_collection.count_documents({})

    return {
        "stats": {
            "total_users": total_users,
            "total_riders": total_riders,
            "total_drivers": total_drivers,
            "total_rides": total_rides,
            "active_rides": active_rides,
            "completed_rides": completed_rides,
            "ongoing_rides": ongoing_rides,
            "total_requests": total_requests,
            "pending_requests": pending_requests,
            "verified_users": verified_users,
            "pending_verifications": pending_verifications,
            "unverified_users": unverified_users,
            "rejected_verifications": rejected_verifications,
            # Phase 4
            "active_sos": active_sos,
            "total_sos": total_sos,
            # Phase 8
            "pending_reports": pending_reports,
            "total_reports": total_reports
        }
    }

@router.get("/api/admin/analytics")
async def admin_get_analytics(current_user: dict = Depends(get_current_user)):
    """Admin: Get analytics data for charts"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    from datetime import datetime, timedelta

    # Get ride data for last 7 days
    today = datetime.now()
    daily_rides = []
    daily_users = []

    for i in range(6, -1, -1):
        date = (today - timedelta(days=i)).strftime("%Y-%m-%d")
        day_label = (today - timedelta(days=i)).strftime("%a")

        # Count rides for this date
        ride_count = rides_collection.count_documents({"date": date})
        completed_count = rides_collection.count_documents({"date": date, "status": "completed"})

        daily_rides.append({
            "day": day_label,
            "date": date,
            "rides": ride_count,
            "completed": completed_count
        })

        # Count users registered on this date (approximate from created_at)
        start_of_day = f"{date}T00:00:00"
        end_of_day = f"{date}T23:59:59"
        new_users = users_collection.count_documents({
            "created_at": {"$gte": start_of_day, "$lte": end_of_day}
        })
        daily_users.append({
            "day": day_label,
            "date": date,
            "new_users": new_users
        })

    # Report categories breakdown
    report_categories = {
        "safety": reports_collection.count_documents({"category": "safety"}),
        "behavior": reports_collection.count_documents({"category": "behavior"}),
        "misuse": reports_collection.count_documents({"category": "misuse"}),
        "other": reports_collection.count_documents({"category": "other"})
    }

    # SOS status breakdown
    sos_statuses = {
        "active": sos_events_collection.count_documents({"status": "active"}),
        "under_review": sos_events_collection.count_documents({"status": "under_review"}),
        "resolved": sos_events_collection.count_documents({"status": "resolved"})
    }

    # User roles breakdown
    user_roles = {
        "riders": users_collection.count_documents({"role": "rider", "is_admin": {"$ne": True}}),
        "drivers": users_collection.count_documents({"role": "driver", "is_admin": {"$ne": True}}),
        "admins": users_collection.count_documents({"is_admin": True})
    }

    # Verification status breakdown
    verification_status = {
        "verified": users_collection.count_documents({"verification_status": "verified"}),
        "pending": users_collection.count_documents({"verification_status": "pending"}),
        "rejected": users_collection.count_documents({"verification_status": "rejected"}),
        "unverified": users_collection.count_documents({"verification_status": "unverified"})
    }

    return {
        "daily_rides": daily_rides,
        "daily_users": daily_users,
        "report_categories": report_categories,
        "sos_statuses": sos_statuses,
        "user_roles": user_roles,
        "verification_status": verification_status
    }

@router.get("/api/admin/users/{user_id}")
async def admin_get_user_details(user_id: str, current_user: dict = Depends(get_current_user)):
    """Admin: Get detailed information about a user"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)}, {"password": 0})
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_data = serialize_user(user)

    # Get activity summary
    rides_offered = rides_collection.count_documents({"driver_id": user_id})
    rides_taken = ride_requests_collection.count_documents({"rider_id": user_id})
    sos_events = sos_events_collection.count_documents({"triggered_by": user_id})
    reports_filed = reports_collection.count_documents({"reporter_id": user_id})
    reports_received = reports_collection.count_documents({"reported_user_id": user_id})

    user_data["activity"] = {
        "rides_offered": rides_offered,
        "rides_taken": rides_taken,
        "sos_events_triggered": sos_events,
        "reports_filed": reports_filed,
        "reports_received": reports_received
    }

    # Account status
    user_data["account_status"] = {
        "is_active": user.get("is_active", True),
        "is_suspended": user.get("is_suspended", False),
        "warning_count": user.get("warning_count", 0),
        "last_warning_at": user.get("last_warning_at"),
        "status_reason": user.get("status_reason")
    }

    return {"user": user_data}

@router.get("/api/admin/rides/monitoring")
async def admin_monitor_rides(
    status: str = None,
    date_from: str = None,
    date_to: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Admin: Monitor rides with filters"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    query = {}
    if status:
        query["status"] = status
    if date_from and date_to:
        query["date"] = {"$gte": date_from, "$lte": date_to}
    elif date_from:
        query["date"] = {"$gte": date_from}
    elif date_to:
        query["date"] = {"$lte": date_to}

    rides = list(rides_collection.find(query).sort("created_at", -1).limit(200))

    serialized_rides = []
    for ride in rides:
        from .utils import serialize_ride
        ride_data = serialize_ride(ride)

        # Add cancellation info if cancelled
        if ride.get("status") == "cancelled":
            ride_data["cancelled_reason"] = ride.get("cancelled_reason")

        # Count SOS events for this ride
        ride_requests = list(ride_requests_collection.find({"ride_id": str(ride["_id"])}))
        request_ids = [str(req["_id"]) for req in ride_requests]
        sos_count = sos_events_collection.count_documents({"ride_request_id": {"$in": request_ids}})
        ride_data["sos_count"] = sos_count

        serialized_rides.append(ride_data)

    # Get cancellation stats
    cancelled_rides = rides_collection.count_documents({"status": "cancelled"})

    return {
        "rides": serialized_rides,
        "stats": {
            "total": len(serialized_rides),
            "cancelled_count": cancelled_rides
        }
    }