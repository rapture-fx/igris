import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.connection import get_db
from app.crud import crud_data_processing
from app.schemas import data_processing as schemas_dp # Aliased
from app.database.models import User # Using the SQLAlchemy User model
# TODO: Re-enable when task is implemented
# from app.tasks.data_processing_tasks import schema_detection_task # Import the Celery task
from app.core.error_decorators import handle_database_errors, handle_file_processing_errors

# Import proper authentication dependency
from app.auth.dependencies import get_current_active_user

router = APIRouter()

# --- DataInvestigation Endpoints ---

@router.post("/investigations/", response_model=schemas_dp.DataInvestigation, status_code=status.HTTP_201_CREATED)
@handle_database_errors
async def create_data_investigation(
    *, # Ensures all following parameters are keyword-only
    db: AsyncSession = Depends(get_db),
    investigation_in: schemas_dp.DataInvestigationCreate,
    current_user: User = Depends(get_current_active_user) # Add current_user dependency
):
    """
    Create a new data investigation.
    Requires a workspace_id and will be associated with the current user.
    """
    # For now, user_id for created_by_id can come from a placeholder current_user
    return await crud_data_processing.create_data_investigation(
        db=db, investigation_in=investigation_in, user_id=current_user.id
    )

@router.get("/investigations/", response_model=List[schemas_dp.DataInvestigation])
async def list_data_investigations(
    db: AsyncSession = Depends(get_db),
    workspace_id: Optional[uuid.UUID] = None, # Filter by workspace_id
    skip: int = 0,
    limit: int = 100,
    # current_user: User = Depends(get_current_active_user) # Depending on policy
):
    """
    List data investigations.
    Can be filtered by workspace_id.
    """
    if workspace_id:
        investigations = await crud_data_processing.get_data_investigations_by_workspace(
            db, workspace_id=workspace_id, skip=skip, limit=limit
        )
    else:
        # Potentially, list all accessible investigations if no workspace_id is given
        # This might require more complex logic based on user roles/permissions
        # For now, let's assume if no workspace_id, it's an error or returns empty
        # Or, we could fetch all investigations for the current user's org, etc.
        # Returning empty list if no workspace_id for simplicity now.
        # A more robust implementation would define behavior for this case.
        # For example, get all investigations for the user or their organization.
        # For this example, let's require workspace_id implicitly by not fetching all.
        # Consider adding a query for all investigations a user has access to if needed.
        return [] # Or raise HTTPException(status_code=400, detail="workspace_id required")
    return investigations

@router.get("/investigations/{investigation_id}", response_model=schemas_dp.DataInvestigation)
async def read_data_investigation(
    investigation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    # current_user: User = Depends(get_current_active_user) # Permissions check
):
    """
    Get a specific data investigation by ID.
    """
    db_investigation = await crud_data_processing.get_data_investigation(db, investigation_id=investigation_id)
    if db_investigation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="DataInvestigation not found")
    return db_investigation

@router.put("/investigations/{investigation_id}", response_model=schemas_dp.DataInvestigation)
async def update_data_investigation(
    investigation_id: uuid.UUID,
    investigation_in: schemas_dp.DataInvestigationUpdate,
    db: AsyncSession = Depends(get_db),
    # current_user: User = Depends(get_current_active_user) # Permissions check
):
    """
    Update a data investigation.
    """
    updated_investigation = await crud_data_processing.update_data_investigation(
        db, investigation_id=investigation_id, investigation_in=investigation_in
    )
    if updated_investigation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="DataInvestigation not found or no updates performed")
    return updated_investigation

@router.delete("/investigations/{investigation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_data_investigation(
    investigation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    # current_user: User = Depends(get_current_active_user) # Permissions check
):
    """
    Delete a data investigation.
    """
    deleted = await crud_data_processing.delete_data_investigation(db, investigation_id=investigation_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="DataInvestigation not found")
    return # Return 204 No Content implies success


# --- ProcessingJob Endpoints ---

@router.post("/jobs/", response_model=schemas_dp.ProcessingJob, status_code=status.HTTP_201_CREATED)
@handle_file_processing_errors
async def create_processing_job(
    *, # Keyword-only args
    db: AsyncSession = Depends(get_db),
    job_in: schemas_dp.ProcessingJobCreate,
    # current_user: User = Depends(get_current_active_user) # Permissions check
):
    """
    Create a new processing job for a data investigation.
    This will create the job record and dispatch it to a Celery worker if applicable.
    """
    # Check if parent investigation exists
    investigation = await crud_data_processing.get_data_investigation(db, investigation_id=job_in.investigation_id)
    if not investigation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"DataInvestigation with id {job_in.investigation_id} not found")
    
    # Create the ProcessingJob record in the database (status will be PENDING by default)
    db_job = await crud_data_processing.create_processing_job(db=db, job_in=job_in)

    # Dispatch to Celery worker if it's a schema detection job
    # In a real app, you'd have a more robust way to map job_type to tasks
    # and to get necessary parameters like file_path.
    # For now, assuming file_path might come from investigation.original_file_path
    if db_job.job_type == "schema_detection":
        if investigation.original_file_path:
            # Send task to Celery. .delay() is a shortcut for .apply_async()
            schema_detection_task.delay(str(db_job.id), investigation.original_file_path)
        else:
            # Handle case where file path is missing for a schema detection job
            # Perhaps update job to FAILED status immediately or log a warning
            # For now, just logging.
            print(f"Warning: original_file_path not found for investigation {investigation.id} during schema_detection job {db_job.id} creation.")
            # Optionally, update job to FAILED:
            # await crud_data_processing.update_processing_job(
            #     db, job_id=db_job.id, 
            #     job_in=schemas_dp.ProcessingJobUpdate(status="FAILED", error_message="Missing file path for schema detection")
            # )
            # db_job.status = "FAILED" # Update local object if needed for response

    return db_job

@router.get("/investigations/{investigation_id}/jobs/", response_model=List[schemas_dp.ProcessingJob])
async def list_processing_jobs_for_investigation(
    investigation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    # current_user: User = Depends(get_current_active_user) # Permissions check
):
    """
    List all processing jobs for a specific data investigation.
    """
    # Check if parent investigation exists
    investigation = await crud_data_processing.get_data_investigation(db, investigation_id=investigation_id)
    if not investigation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"DataInvestigation with id {investigation_id} not found")

    jobs = await crud_data_processing.get_processing_jobs_by_investigation(
        db, investigation_id=investigation_id, skip=skip, limit=limit
    )
    return jobs

@router.get("/jobs/{job_id}", response_model=schemas_dp.ProcessingJob)
async def read_processing_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    # current_user: User = Depends(get_current_active_user) # Permissions check
):
    """
    Get a specific processing job by ID.
    """
    db_job = await crud_data_processing.get_processing_job(db, job_id=job_id)
    if db_job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ProcessingJob not found")
    return db_job

@router.put("/jobs/{job_id}", response_model=schemas_dp.ProcessingJob)
async def update_processing_job(
    job_id: uuid.UUID,
    job_in: schemas_dp.ProcessingJobUpdate,
    db: AsyncSession = Depends(get_db),
    # current_user: User = Depends(get_current_active_user) # Permissions check
):
    """
    Update a processing job.
    """
    updated_job = await crud_data_processing.update_processing_job(
        db, job_id=job_id, job_in=job_in
    )
    if updated_job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ProcessingJob not found or no updates performed")
    return updated_job

@router.delete("/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_processing_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    # current_user: User = Depends(get_current_active_user) # Permissions check
):
    """
    Delete a processing job.
    """
    deleted = await crud_data_processing.delete_processing_job(db, job_id=job_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ProcessingJob not found")
    return 