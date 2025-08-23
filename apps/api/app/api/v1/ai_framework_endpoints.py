"""
AI Framework Integration API Endpoints - Schlep-engine
==================================================

API endpoints for exporting data to different ML frameworks and
advanced auto-labeling capabilities. These endpoints provide
comprehensive data preparation services for enterprise AI/ML workflows.
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, List, Any, Optional, Union
from pydantic import BaseModel, Field
import pandas as pd
import numpy as np
import tempfile
import zipfile
from pathlib import Path
import logging
import json

from app.database.connection import get_db
from app.database.models import User, DataInvestigation
from app.api.v1.auth_unified import get_current_user
from app.services.ml_framework_integration import (
    ml_framework_integration, MLFrameworkType, TaskType, ExportConfiguration, DataFormat, ModelServingConfig
)
from app.services.advanced_auto_labeler import (
    AdvancedAutoLabeler, LabelingTask, FewShotExample, ConfidenceLevel
)
from app.services.file_processor import DataProcessor as FileProcessor

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize services
auto_labeler = AdvancedAutoLabeler()

# ==================== REQUEST/RESPONSE MODELS ====================

class FrameworkExportRequest(BaseModel):
    """Request model for framework export"""
    framework: str = Field(..., description="Target ML framework")
    task_type: str = Field(..., description="ML task type")
    target_column: Optional[str] = Field(None, description="Target column name")
    feature_columns: Optional[List[str]] = Field(None, description="Feature column names")
    text_column: Optional[str] = Field(None, description="Text column for NLP tasks")
    batch_size: int = Field(32, description="Batch size for data loaders")
    max_length: int = Field(512, description="Max sequence length for NLP")
    train_ratio: float = Field(0.7, description="Training data ratio")
    validation_ratio: float = Field(0.15, description="Validation data ratio")
    test_ratio: float = Field(0.15, description="Test data ratio")
    stratify: bool = Field(True, description="Use stratified splitting")

class FewShotTrainingRequest(BaseModel):
    """Request model for few-shot learning"""
    task_type: str = Field(..., description="Labeling task type")
    examples: List[Dict[str, Any]] = Field(..., description="Few-shot examples")
    model_name: str = Field("default", description="Model name identifier")

class LabelPredictionRequest(BaseModel):
    """Request model for label prediction"""
    model_key: str = Field(..., description="Trained model identifier")
    data: List[Dict[str, Any]] = Field(..., description="Data to label")

class ActiveLearningRequest(BaseModel):
    """Request model for active learning sample selection"""
    model_key: str = Field(..., description="Trained model identifier")
    unlabeled_data: List[Dict[str, Any]] = Field(..., description="Unlabeled data")
    n_samples: int = Field(10, description="Number of samples to select")
    strategy: str = Field("uncertainty", description="Selection strategy")

class PatternRulesRequest(BaseModel):
    """Request model for pattern-based labeling"""
    patterns: Dict[str, str] = Field(..., description="Dictionary of label -> regex pattern")
    task_name: str = Field(..., description="Task name identifier")

class ApplyPatternRequest(BaseModel):
    """Request model for applying pattern rules"""
    rule_key: str = Field(..., description="Pattern rule identifier")
    data: List[Dict[str, Any]] = Field(..., description="Data to label")
    text_column: Optional[str] = Field(None, description="Text column name")

class RuleStats(BaseModel):
    pattern_rules: int
    ml_rules: int # Future-proofing for when ML-based rules are more explicit
    total_rules: int

# ==================== FRAMEWORK EXPORT ENDPOINTS ====================

@router.post("/export/pytorch")
async def export_pytorch(
    request: FrameworkExportRequest,
    investigation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Export data in PyTorch format with DataLoader and Dataset"""
    try:
        # Get investigation data
        investigation = await db.get(DataInvestigation, investigation_id)
        if not investigation or investigation.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Investigation not found"
            )
        
        # Load data from investigation
        file_processor = FileProcessor()
        df = await file_processor.load_investigation_data(investigation)
        
        # Configure export
        config = ExportConfig(
            framework=MLFramework.PYTORCH,
            task_type=TaskType(request.task_type),
            target_column=request.target_column,
            feature_columns=request.feature_columns,
            batch_size=request.batch_size
        )
        
        # Configure data split
        split_config = DataSplit(
            train_ratio=request.train_ratio,
            validation_ratio=request.validation_ratio,
            test_ratio=request.test_ratio,
            stratify=request.stratify
        )
        
        # Export data
        with tempfile.TemporaryDirectory() as temp_dir:
            pytorch_data = framework_integrator.export_for_pytorch(
                df, config, output_dir=temp_dir
            )
            
            # Create zip file with exported data
            zip_path = Path(temp_dir) / "pytorch_export.zip"
            with zipfile.ZipFile(zip_path, 'w') as zipf:
                for file_path in Path(temp_dir).glob("*.pt"):
                    zipf.write(file_path, file_path.name)
                for file_path in Path(temp_dir).glob("*.json"):
                    zipf.write(file_path, file_path.name)
            
            return FileResponse(
                path=str(zip_path),
                filename=f"pytorch_export_{investigation_id}.zip",
                media_type="application/zip"
            )
    
    except Exception as e:
        logger.error(f"PyTorch export failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Export failed: {str(e)}"
        )

@router.post("/export/tensorflow")
async def export_tensorflow(
    request: FrameworkExportRequest,
    investigation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Export data in TensorFlow tf.data.Dataset format"""
    try:
        # Similar implementation to PyTorch export
        investigation = await db.get(DataInvestigation, investigation_id)
        if not investigation or investigation.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Investigation not found"
            )
        
        file_processor = FileProcessor()
        df = await file_processor.load_investigation_data(investigation)
        
        config = ExportConfig(
            framework=MLFramework.TENSORFLOW,
            task_type=TaskType(request.task_type),
            target_column=request.target_column,
            feature_columns=request.feature_columns,
            batch_size=request.batch_size
        )
        
        with tempfile.TemporaryDirectory() as temp_dir:
            tf_data = framework_integrator.export_for_tensorflow(
                df, config, output_dir=temp_dir
            )
            
            # Create zip file
            zip_path = Path(temp_dir) / "tensorflow_export.zip"
            with zipfile.ZipFile(zip_path, 'w') as zipf:
                for dir_path in Path(temp_dir).glob("*_dataset"):
                    for file_path in dir_path.rglob("*"):
                        if file_path.is_file():
                            zipf.write(file_path, f"{dir_path.name}/{file_path.name}")
                for file_path in Path(temp_dir).glob("*.json"):
                    zipf.write(file_path, file_path.name)
            
            return FileResponse(
                path=str(zip_path),
                filename=f"tensorflow_export_{investigation_id}.zip",
                media_type="application/zip"
            )
    
    except Exception as e:
        logger.error(f"TensorFlow export failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Export failed: {str(e)}"
        )

@router.post("/export/huggingface")
async def export_huggingface(
    request: FrameworkExportRequest,
    investigation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Export data in HuggingFace datasets format for NLP tasks"""
    try:
        investigation = await db.get(DataInvestigation, investigation_id)
        if not investigation or investigation.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Investigation not found"
            )
        
        file_processor = FileProcessor()
        df = await file_processor.load_investigation_data(investigation)
        
        if not request.text_column:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="text_column is required for HuggingFace export"
            )
        
        config = ExportConfig(
            framework=MLFramework.HUGGINGFACE,
            task_type=TaskType(request.task_type),
            target_column=request.target_column,
            text_column=request.text_column,
            max_length=request.max_length
        )
        
        with tempfile.TemporaryDirectory() as temp_dir:
            hf_data = framework_integrator.export_for_huggingface(
                df, config, output_dir=temp_dir
            )
            
            # Create zip file
            zip_path = Path(temp_dir) / "huggingface_export.zip"
            with zipfile.ZipFile(zip_path, 'w') as zipf:
                # Add datasets directory
                datasets_dir = Path(temp_dir) / "hf_datasets"
                if datasets_dir.exists():
                    for file_path in datasets_dir.rglob("*"):
                        if file_path.is_file():
                            zipf.write(file_path, f"datasets/{file_path.relative_to(datasets_dir)}")
                
                # Add tokenizer directory
                tokenizer_dir = Path(temp_dir) / "tokenizer"
                if tokenizer_dir.exists():
                    for file_path in tokenizer_dir.rglob("*"):
                        if file_path.is_file():
                            zipf.write(file_path, f"tokenizer/{file_path.relative_to(tokenizer_dir)}")
                
                # Add metadata
                for file_path in Path(temp_dir).glob("*.json"):
                    zipf.write(file_path, file_path.name)
            
            return FileResponse(
                path=str(zip_path),
                filename=f"huggingface_export_{investigation_id}.zip",
                media_type="application/zip"
            )
    
    except Exception as e:
        logger.error(f"HuggingFace export failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Export failed: {str(e)}"
        )

@router.post("/export/sklearn")
async def export_sklearn(
    request: FrameworkExportRequest,
    investigation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Export data in scikit-learn format with preprocessing pipelines"""
    try:
        investigation = await db.get(DataInvestigation, investigation_id)
        if not investigation or investigation.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Investigation not found"
            )
        
        file_processor = FileProcessor()
        df = await file_processor.load_investigation_data(investigation)
        
        config = ExportConfig(
            framework=MLFramework.SKLEARN,
            task_type=TaskType(request.task_type),
            target_column=request.target_column,
            feature_columns=request.feature_columns
        )
        
        with tempfile.TemporaryDirectory() as temp_dir:
            sklearn_data = framework_integrator.export_for_sklearn(
                df, config, output_dir=temp_dir
            )
            
            # Create zip file
            zip_path = Path(temp_dir) / "sklearn_export.zip"
            with zipfile.ZipFile(zip_path, 'w') as zipf:
                for file_path in Path(temp_dir).glob("*"):
                    if file_path.is_file():
                        zipf.write(file_path, file_path.name)
            
            return FileResponse(
                path=str(zip_path),
                filename=f"sklearn_export_{investigation_id}.zip",
                media_type="application/zip"
            )
    
    except Exception as e:
        logger.error(f"Scikit-learn export failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Export failed: {str(e)}"
        )

# ==================== AUTO-LABELING ENDPOINTS ====================

@router.post("/labeling/train-few-shot")
async def train_few_shot_labeler(
    request: FewShotTrainingRequest,
    current_user: User = Depends(get_current_user)
):
    """Train a few-shot learning model for automated labeling"""
    try:
        # Convert request examples to FewShotExample objects
        examples = []
        for ex_data in request.examples:
            example = FewShotExample(
                input_data=ex_data.get('input'),
                label=ex_data.get('label'),
                weight=ex_data.get('weight', 1.0),
                metadata=ex_data.get('metadata')
            )
            examples.append(example)
        
        # Train the model
        result = auto_labeler.train_few_shot_labeler(
            examples=examples,
            task_type=LabelingTask(request.task_type),
            model_name=request.model_name
        )
        
        return {
            "status": "success",
            "message": "Few-shot model trained successfully",
            "model_info": result
        }
    
    except Exception as e:
        logger.error(f"Few-shot training failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Training failed: {str(e)}"
        )

@router.post("/labeling/predict")
async def predict_labels(
    request: LabelPredictionRequest,
    current_user: User = Depends(get_current_user)
):
    """Predict labels using a trained few-shot model"""
    try:
        # Make predictions
        result = auto_labeler.predict_labels(
            data=request.data,
            model_key=request.model_key
        )
        
        return {
            "status": "success",
            "predicted_labels": result.predicted_labels,
            "confidence_scores": result.confidence_scores,
            "confidence_levels": [level.value for level in result.confidence_levels],
            "uncertain_indices": result.uncertain_indices,
            "metadata": result.metadata
        }
    
    except Exception as e:
        logger.error(f"Label prediction failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Prediction failed: {str(e)}"
        )

@router.post("/labeling/active-learning")
async def active_learning_selection(
    request: ActiveLearningRequest,
    current_user: User = Depends(get_current_user)
):
    """Select most informative samples for labeling using active learning"""
    try:
        result = auto_labeler.active_learning_selection(
            unlabeled_data=request.unlabeled_data,
            model_key=request.model_key,
            n_samples=request.n_samples,
            strategy=request.strategy
        )
        
        return {
            "status": "success",
            "selected_indices": result['selected_indices'],
            "selected_samples": result['selected_samples'],
            "selection_strategy": result['selection_strategy'],
            "uncertainty_scores": result['uncertainty_scores'],
            "predicted_labels": result['predicted_labels'],
            "metadata": result.get('metadata', {})
        }
    
    except Exception as e:
        logger.error(f"Active learning selection failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Selection failed: {str(e)}"
        )

@router.post("/labeling/create-pattern-rules")
async def create_pattern_rules(
    request: PatternRulesRequest,
    current_user: User = Depends(get_current_user)
):
    """Create pattern-based labeling rules using regex patterns"""
    try:
        rule_key = auto_labeler.create_pattern_rules(
            patterns=request.patterns,
            task_name=request.task_name
        )
        
        return {
            "status": "success",
            "message": "Pattern rules created successfully",
            "rule_key": rule_key,
            "pattern_count": len(request.patterns)
        }
    
    except Exception as e:
        logger.error(f"Pattern rule creation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Rule creation failed: {str(e)}"
        )

@router.post("/labeling/apply-pattern-rules")
async def apply_pattern_rules(
    request: ApplyPatternRequest,
    current_user: User = Depends(get_current_user)
):
    """Apply pattern-based labeling rules to data"""
    try:
        result = auto_labeler.apply_pattern_rules(
            data=request.data,
            rule_key=request.rule_key,
            text_column=request.text_column
        )
        
        return {
            "status": "success",
            "predicted_labels": result.predicted_labels,
            "confidence_scores": result.confidence_scores,
            "confidence_levels": [level.value for level in result.confidence_levels],
            "uncertain_indices": result.uncertain_indices,
            "metadata": result.metadata
        }
    
    except Exception as e:
        logger.error(f"Pattern rule application failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Rule application failed: {str(e)}"
        )

@router.get("/labeling/rules/stats", response_model=RuleStats)
async def get_rule_stats(
    current_user: User = Depends(get_current_user)
):
    """Get statistics about labeling rules."""
    try:
        # This is a mock implementation. In a real system, this would query
        # the rule registry or database.
        pattern_rules_count = len(auto_labeler.pattern_rules)
        
        # ML rules are not explicitly stored as 'rules' yet, so we'll mock it.
        ml_rules_count = len(auto_labeler.models)

        return RuleStats(
            pattern_rules=pattern_rules_count,
            ml_rules=ml_rules_count,
            total_rules=pattern_rules_count + ml_rules_count
        )

    except Exception as e:
        logger.error(f"Failed to get rule stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve rule statistics"
        )

# ==================== UTILITY ENDPOINTS ====================

@router.get("/frameworks/supported")
async def get_supported_frameworks(
    current_user: User = Depends(get_current_user)
):
    """Get list of supported ML frameworks and task types"""
    return {
        "frameworks": framework_integrator.supported_frameworks,
        "task_types": framework_integrator.supported_tasks,
        "labeling_tasks": [task.value for task in LabelingTask]
    }

@router.post("/frameworks/recommendations")
async def get_framework_recommendations(
    investigation_id: str,
    task_type: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get framework recommendations based on data characteristics"""
    try:
        investigation = await db.get(DataInvestigation, investigation_id)
        if not investigation or investigation.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Investigation not found"
            )
        
        file_processor = FileProcessor()
        df = await file_processor.load_investigation_data(investigation)
        
        recommendations = framework_integrator.get_framework_recommendations(
            df=df,
            task_type=TaskType(task_type)
        )
        
        return {
            "status": "success",
            "recommendations": recommendations
        }
    
    except Exception as e:
        logger.error(f"Framework recommendations failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Recommendations failed: {str(e)}"
        ) 