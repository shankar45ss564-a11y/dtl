from pymongo import MongoClient
from .config import MONGO_URL, DB_NAME

# MongoDB connection
client = MongoClient(MONGO_URL)
db = client[DB_NAME]

# Collections
users_collection = db["users"]
rides_collection = db["rides"]
ride_requests_collection = db["ride_requests"]
chat_messages_collection = db["chat_messages"]
sos_events_collection = db["sos_events"]  # Phase 4: SOS Events
ratings_collection = db["ratings"]  # Phase 6: Ratings & Feedback
event_tags_collection = db["event_tags"]  # Phase 7: Event Tags
reports_collection = db["reports"]  # Phase 8: User Reports
audit_logs_collection = db["audit_logs"]  # Phase 8: Admin Audit Logs