import uuid
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update as sqlalchemy_update, delete as sqlalchemy_delete

from app.database import models
from app.schemas import data_processing as schemas # Renamed to avoid conflict

# --- DataInvestigation CRUD Functions ---

async def get_data_investigation(db: AsyncSession, investigation_id: uuid.UUID) -> Optional[models.DataInvestigation]:
    return await db.get(models.DataInvestigation, investigation_id)

async def get_data_investigations_by_workspace(
    db: AsyncSession, workspace_id: uuid.UUID, skip: int = 0, limit: int = 100
) -> List[models.DataInvestigation]:
    statement = (
        select(models.DataInvestigation)
        .where(models.DataInvestigation.workspace_id == workspace_id)
        .offset(skip)
        .limit(limit)
        .order_by(models.DataInvestigation.created_at.desc())
    )
    result = await db.execute(statement)
    return result.scalars().all()

async def create_data_investigation(
    db: AsyncSession, investigation_in: schemas.DataInvestigationCreate, user_id: uuid.UUID
) -> models.DataInvestigation:
    db_investigation = models.DataInvestigation(
        **investigation_in.model_dump(), 
        created_by_id=user_id
    )
    db.add(db_investigation)
    await db.commit()
    await db.refresh(db_investigation)
    return db_investigation

async def update_data_investigation(
    db: AsyncSession, investigation_id: uuid.UUID, investigation_in: schemas.DataInvestigationUpdate
) -> Optional[models.DataInvestigation]:
    update_data = investigation_in.model_dump(exclude_unset=True)
    if not update_data:
        # If there's nothing to update after excluding unset fields,
        # fetch and return the current object or handle as an error/no-op
        return await get_data_investigation(db, investigation_id)

    statement = (
        sqlalchemy_update(models.DataInvestigation)
        .where(models.DataInvestigation.id == investigation_id)
        .values(**update_data)
        .returning(models.DataInvestigation)
    )
    result = await db.execute(statement)
    await db.commit()
    return result.scalar_one_or_none()

async def delete_data_investigation(db: AsyncSession, investigation_id: uuid.UUID) -> bool:
    statement = (
        sqlalchemy_delete(models.DataInvestigation)
        .where(models.DataInvestigation.id == investigation_id)
    )
    result = await db.execute(statement)
    await db.commit()
    return result.rowcount > 0


# --- ProcessingJob CRUD Functions ---

async def get_processing_job(db: AsyncSession, job_id: uuid.UUID) -> Optional[models.ProcessingJob]:
    return await db.get(models.ProcessingJob, job_id)

async def get_processing_jobs_by_investigation(
    db: AsyncSession, investigation_id: uuid.UUID, skip: int = 0, limit: int = 100
) -> List[models.ProcessingJob]:
    statement = (
        select(models.ProcessingJob)
        .where(models.ProcessingJob.investigation_id == investigation_id)
        .offset(skip)
        .limit(limit)
        .order_by(models.ProcessingJob.created_at.asc()) # Usually chronological
    )
    result = await db.execute(statement)
    return result.scalars().all()

async def create_processing_job(
    db: AsyncSession, job_in: schemas.ProcessingJobCreate
) -> models.ProcessingJob:
    db_job = models.ProcessingJob(**job_in.model_dump())
    db.add(db_job)
    await db.commit()
    await db.refresh(db_job)
    return db_job

async def update_processing_job(
    db: AsyncSession, job_id: uuid.UUID, job_in: schemas.ProcessingJobUpdate
) -> Optional[models.ProcessingJob]:
    update_data = job_in.model_dump(exclude_unset=True)
    if not update_data:
        return await get_processing_job(db, job_id)

    statement = (
        sqlalchemy_update(models.ProcessingJob)
        .where(models.ProcessingJob.id == job_id)
        .values(**update_data)
        .returning(models.ProcessingJob)
    )
    result = await db.execute(statement)
    await db.commit()
    return result.scalar_one_or_none()

async def delete_processing_job(db: AsyncSession, job_id: uuid.UUID) -> bool:
    statement = (
        sqlalchemy_delete(models.ProcessingJob)
        .where(models.ProcessingJob.id == job_id)
    )
    result = await db.execute(statement)
    await db.commit()
    return result.rowcount > 0 