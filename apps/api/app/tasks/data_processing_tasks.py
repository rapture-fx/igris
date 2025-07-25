from app.core.celery_app import celery_app
from app.database.connection import get_db_session
from app.database.models import DataInvestigation, JobStatus
from app.services.unified_data_processor import unified_processor
import logging

logger = logging.getLogger(__name__)

@celery_app.task(bind=True, name="data_processing.process_data")
def process_data_async(self, investigation_id: str, file_path: str):
    """
    Background task to process uploaded data
    """
    try:
        from sqlalchemy import select
        
        with get_db_session() as db:
            # Get investigation
            result = db.execute(
                select(DataInvestigation).where(DataInvestigation.id == investigation_id)
            ).scalar_one_or_none()
            
            if not result:
                logger.error(f"Investigation {investigation_id} not found for processing")
                return
            
            # Update status to running
            result.status = JobStatus.RUNNING
            result.progress_percentage = 10.0
            db.commit()
            
            # Process the file using unified processor
            processing_result = unified_processor.process_file(
                file_path=file_path,
                processing_options=result.analysis_config or {}
            )
            
            # Update investigation with results
            result.status = JobStatus.COMPLETED
            result.progress_percentage = 100.0
            result.quality_score = processing_result.get("quality_score", 0.0)
            result.patterns_found = processing_result.get("patterns", [])
            result.anomalies_detected = processing_result.get("anomalies", [])
            result.recommendations = processing_result.get("recommendations", [])
            result.schema_info = processing_result.get("schema", {})
            
            # Update data source config with statistics
            result.data_source_config.update({
                "total_records": processing_result.get("total_records", 0),
                "columns": processing_result.get("total_columns", 0),
                "processing_time": processing_result.get("processing_time", 0)
            })
            
            db.commit()
            
            logger.info(f"Successfully processed investigation {investigation_id}")
            
    except Exception as e:
        logger.error(f"Background processing failed for {investigation_id}: {e}")
        
        # Update investigation with error status
        try:
            with get_db_session() as db:
                from sqlalchemy import select
                
                result = db.execute(
                    select(DataInvestigation).where(DataInvestigation.id == investigation_id)
                ).scalar_one_or_none()
                
                if result:
                    result.status = JobStatus.FAILED
                    result.error_message = str(e)
                    db.commit()
        except Exception as db_error:
            logger.error(f"Failed to update error status: {db_error}")