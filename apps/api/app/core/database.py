# Import from the new database connection module
from app.database.connection import Base, get_db, get_sync_db, engine, async_engine

# Re-export for backward compatibility
__all__ = ["Base", "get_db", "get_sync_db", "engine", "async_engine"] 