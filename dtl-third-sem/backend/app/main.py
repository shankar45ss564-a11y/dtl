from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import routers
from .auth import router as auth_router
from .rides import router as rides_router
from .ride_requests import router as ride_requests_router
from .chat import router as chat_router
from .verification import router as verification_router
from .sos import router as sos_router
from .ratings import router as ratings_router
from .admin import router as admin_router

# Import database and config
from .database import client
from .config import MONGO_URL

# Create FastAPI app
app = FastAPI(
    title="DTL Ride Sharing API",
    description="A comprehensive ride sharing platform for college students",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(rides_router)
app.include_router(ride_requests_router)
app.include_router(chat_router)
app.include_router(verification_router)
app.include_router(sos_router)
app.include_router(ratings_router)
app.include_router(admin_router)

# Startup event
@app.on_event("startup")
async def startup_event():
    try:
        # Test database connection
        client.admin.command('ping')
        print("✅ Connected to MongoDB successfully")
    except Exception as e:
        print(f"❌ Failed to connect to MongoDB: {e}")
        raise

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    client.close()
    print("🔌 Database connection closed")

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "DTL Ride Sharing API",
        "version": "1.0.0",
        "status": "running"
    }

# Health check
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "database": "connected" if client else "disconnected"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)