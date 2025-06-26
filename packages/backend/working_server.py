#!/usr/bin/env python3
"""
Pollarbase API - Working Server Entry Point
This file serves as the main entry point for the Pollarbase API server.
"""

from app.main import app

if __name__ == "__main__":
    import uvicorn
    
    # Development server configuration
    uvicorn.run(
        "working_server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        workers=1,
        access_log=True,
        log_level="info"
    ) 