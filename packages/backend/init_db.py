#!/usr/bin/env python3
"""
Database Initialization Script
Creates tables and default users for Pollarbase platform
"""

import asyncio
import sys
from pathlib import Path

# Add the backend directory to Python path
sys.path.append(str(Path(__file__).parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.database.connection import Base
from app.database.models import User, UserRole, Organization
from app.auth.auth_service import auth_service
from app.core.config import settings
import uuid
from datetime import datetime

async def create_tables():
    """Create all database tables"""
    print("Creating database tables...")
    
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    
    async with engine.begin() as conn:
        # Drop all tables (for development)
        await conn.run_sync(Base.metadata.drop_all)
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)
    
    await engine.dispose()
    print(" Database tables created successfully")

async def create_default_users():
    """Create default users for testing"""
    print("Creating default users...")
    
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        try:
            # Create default organization
            org = Organization(
                id=uuid.uuid4(),
                        name="Pollarbase Demo",
        slug="pollarbase-demo",
        domain="demo.pollarbase.com",
                subscription_plan="pro",
                subscription_status="active",
                created_at=datetime.utcnow()
            )
            session.add(org)
            await session.commit()
            await session.refresh(org)
            
            # Create admin user
            admin_user = await auth_service.create_user(
                db=session,
                email="admin@pollarbase.com",
                username="admin",
                password="admin123",
                first_name="Admin",
                last_name="User"
            )
            admin_user.role = UserRole.ADMIN
            admin_user.organization_id = org.id
            await session.commit()
            
            # Create demo user
            demo_user = await auth_service.create_user(
                db=session,
                email="demo@pollarbase.com", 
                username="demo",
                password="demo123",
                first_name="Demo",
                last_name="User"
            )
            demo_user.organization_id = org.id
            await session.commit()
            
            # Create test analyst
            analyst_user = await auth_service.create_user(
                db=session,
                email="analyst@pollarbase.com",
                username="analyst", 
                password="analyst123",
                first_name="Data",
                last_name="Analyst"
            )
            analyst_user.role = UserRole.ANALYST
            analyst_user.organization_id = org.id
            await session.commit()
            
            print(" Default users created:")
            print(f"   Admin: admin@pollarbase.com / admin123")
            print(f"   Demo:  demo@pollarbase.com / demo123")
            print(f"   Analyst: analyst@pollarbase.com / analyst123")
            
        except Exception as e:
            print(f" Error creating users: {e}")
            await session.rollback()
        finally:
            await session.close()
    
    await engine.dispose()

async def main():
    """Main initialization function"""
    print(" Initializing Pollarbase Database...")
    print(f"Database URL: {settings.DATABASE_URL}")
    
    try:
        # Create tables
        await create_tables()
        
        # Create default users
        await create_default_users()
        
        print("\n Database initialization completed successfully!")
        print("\n You can now:")
        print("   1. Start the backend server: python -m uvicorn app.main:app --reload")
        print("   2. Login with any of the default users")
        print("   3. Test file upload and analysis features")
        
    except Exception as e:
        print(f" Database initialization failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main()) 