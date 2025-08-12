import asyncio
import logging
import os
from uuid import uuid4

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# It's better to use the app's own modules if possible, but for a standalone script,
# you might need to adjust the Python path or duplicate some model definitions.
# This assumes the script is run from a context where the app modules are available.
from app.core.config import settings
from app.models.user import User
from app.models.organization import Organization
from app.core.security import get_password_hash

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def seed_data():
    """
    Seeds the database with initial data for development and testing.
    """
    engine = create_async_engine(settings.ASYNC_DATABASE_URI, echo=True)
    AsyncSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, class_=AsyncSession)

    logger.info("Starting database seeding...")

    async with AsyncSessionLocal() as session:
        try:
            # 1. Create a Default Organization
            org_name = "Default Organization"
            organization = await session.get(Organization, {"name": org_name})
            if not organization:
                organization = Organization(
                    id=uuid4(),
                    name=org_name,
                    slug="default-organization",
                )
                session.add(organization)
                logger.info(f"Organization '{org_name}' created.")
            else:
                logger.info(f"Organization '{org_name}' already exists.")

            # 2. Create a Default Admin User
            admin_email = "admin@example.com"
            user = await session.get(User, {"email": admin_email})
            if not user:
                user = User(
                    id=uuid4(),
                    email=admin_email,
                    username="admin",
                    hashed_password=get_password_hash(os.getenv("ADMIN_PASSWORD", "temp_admin_pass_123!")),
                    first_name="Admin",
                    last_name="User",
                    role="ADMIN",
                    is_active=True,
                    is_verified=True,
                    organization_id=organization.id,
                )
                session.add(user)
                logger.info(f"Admin user '{admin_email}' created.")
            else:
                logger.info(f"Admin user '{admin_email}' already exists.")

            await session.commit()
            logger.info("Database seeding completed successfully.")

        except Exception as e:
            await session.rollback()
            logger.error(f"An error occurred during seeding: {e}")
            raise
        finally:
            await session.close()

if __name__ == "__main__":
    asyncio.run(seed_data()) 