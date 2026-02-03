#!/usr/bin/env python3
"""
DTL Ride Sharing Backend Server

This is the entry point for the modular FastAPI application.
The main application logic is now organized in the app/ directory.
"""

import uvicorn
from app.main import app

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # Enable auto-reload during development
        log_level="info"
    )