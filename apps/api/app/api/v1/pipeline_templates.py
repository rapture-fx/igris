"""
Pipeline Templates API - Pre-built battle-tested pipelines for common ML use cases.

Provides ready-to-use data preparation recipes for:
- LLM instruction fine-tuning (Universal format support: HuggingFace, Alpaca, ShareGPT, OpenAI, JSONL, Parquet)
- Computer vision preprocessing (image augmentation, normalization)
- Tabular ML workflows (feature engineering, encoding)
"""

from typing import Dict, List, Optional, Any
from enum import Enum
from datetime import datetime
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel, Field, validator
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


class UseCase(str, Enum):
    """Supported ML use cases for pipeline templates."""
    LLM_FINE_TUNING = "llm_fine_tuning"
    COMPUTER_VISION = "computer_vision"
    TABULAR_ML = "tabular_ml"
    TEXT_CLASSIFICATION = "text_classification"
    TIME_SERIES = "time_series"


class Framework(str, Enum):
    """Supported ML frameworks."""
    HUGGINGFACE = "huggingface"
    SKLEARN = "sklearn"
    TENSORFLOW = "tensorflow"
    PYTORCH = "pytorch"
    UNIVERSAL = "universal"


class LLMOutputFormat(str, Enum):
    """Universal LLM fine-tuning output formats."""
    HUGGINGFACE_ARROW = "huggingface_arrow"  # HuggingFace Dataset with Arrow backend (Llama, Mistral, Phi, Gemma)
    ALPACA_JSON = "alpaca_json"  # Alpaca format for instruction tuning (Alpaca, WizardLM, LoRA)
    SHAREGPT_JSON = "sharegpt_json"  # ShareGPT format for conversational (Vicuna, FastChat)
    OPENAI_JSONL = "openai_jsonl"  # OpenAI fine-tuning format (GPT-3.5/4)
    GENERIC_JSONL = "generic_jsonl"  # Generic JSONL (Anthropic, Cohere, custom)
    PARQUET = "parquet"  # Parquet columnar format (Databricks, enterprise)
    CSV = "csv"  # Simple CSV (research, legacy systems)


class PipelineStep(BaseModel):
    """Individual step in a pipeline template."""
    step_name: str
    operation: str
    parameters: Dict[str, Any] = Field(default_factory=dict)
    description: str


class PipelineTemplate(BaseModel):
    """Complete pipeline template definition."""
    template_id: str
    name: str
    description: str
    use_case: UseCase
    framework: Framework
    tier_required: str  # "develop", "growth", "scale"
    steps: List[PipelineStep]
    expected_input_format: str
    expected_output_format: str
    output_formats: Optional[List[str]] = None  # For LLM templates: list of supported formats
    memory_reduction: Optional[str] = None
    estimated_speedup: Optional[str] = None
    example_use: str


class RunTemplateRequest(BaseModel):
    """Request to run a pipeline template."""
    template_id: str
    dataset_url: Optional[str] = None
    dataset_id: Optional[str] = None
    output_format: Optional[str] = None  # For LLM templates: choose output format
    custom_parameters: Dict[str, Any] = Field(default_factory=dict)
    async_mode: bool = True

    @validator('dataset_url', 'dataset_id')
    def check_dataset_source(cls, v, values):
        if 'dataset_url' not in values and 'dataset_id' not in values:
            raise ValueError("Either dataset_url or dataset_id must be provided")
        return v


class RunTemplateResponse(BaseModel):
    """Response from running a pipeline template."""
    job_id: str
    template_id: str
    status: str
    message: str
    estimated_completion_time: Optional[str] = None
    output_location: Optional[str] = None


# Pipeline template definitions
PIPELINE_TEMPLATES = [
    # Universal LLM Fine-Tuning Template (Tier: Develop+)
    PipelineTemplate(
        template_id="llm-instruction-universal",
        name="LLM Instruction Fine-Tuning (Universal)",
        description="Clean and format instruction data for ANY LLM - export to HuggingFace, Alpaca, ShareGPT, OpenAI, or generic formats",
        use_case=UseCase.LLM_FINE_TUNING,
        framework=Framework.UNIVERSAL,
        tier_required="develop",
        steps=[
            PipelineStep(
                step_name="load_and_validate",
                operation="load_dataset",
                parameters={"format": "auto", "use_rust": True},
                description="Load dataset with Rust kernels (6x faster CSV parsing)"
            ),
            PipelineStep(
                step_name="deduplicate",
                operation="deduplicate_dataset",
                parameters={"columns": ["instruction", "output"], "use_rust": True},
                description="Hash-based deduplication (70% memory reduction)"
            ),
            PipelineStep(
                step_name="clean_text",
                operation="clean_instruction_text",
                parameters={"remove_empty": True, "normalize_whitespace": True, "min_length": 10},
                description="Clean instruction/output pairs and remove invalid entries"
            ),
            PipelineStep(
                step_name="quality_filter",
                operation="filter_by_quality",
                parameters={"min_quality_score": 0.7, "check_toxicity": True},
                description="Filter low-quality or toxic instruction pairs"
            ),
            PipelineStep(
                step_name="format_conversion",
                operation="convert_to_llm_format",
                parameters={"output_format": "auto"},
                description="Convert to chosen LLM format (HuggingFace/Alpaca/ShareGPT/OpenAI/JSONL/Parquet)"
            ),
            PipelineStep(
                step_name="export",
                operation="export_ml_ready",
                parameters={"compression": "auto"},
                description="Export as ML-ready format with optimal compression"
            )
        ],
        expected_input_format="CSV/JSON/Parquet with instruction/output or prompt/completion columns",
        expected_output_format="User choice: HuggingFace Arrow, Alpaca JSON, ShareGPT JSON, OpenAI JSONL, Generic JSONL, Parquet, or CSV",
        output_formats=[
            "huggingface_arrow",  # Llama, Mistral, Phi, Gemma
            "alpaca_json",  # Alpaca, WizardLM, LoRA fine-tuning
            "sharegpt_json",  # Vicuna, FastChat conversational
            "openai_jsonl",  # GPT-3.5/4 fine-tuning
            "generic_jsonl",  # Anthropic, Cohere, custom pipelines
            "parquet",  # Databricks, enterprise ML platforms
            "csv"  # Research, legacy systems
        ],
        memory_reduction="70-80% vs pandas",
        estimated_speedup="6x vs pure Python",
        example_use="Fine-tuning any LLM (Llama, Mistral, GPT, Claude format) - clean once, export to any format"
    ),

    # Conversational LLM Template (Tier: Growth+)
    PipelineTemplate(
        template_id="llm-conversation-universal",
        name="LLM Conversational Fine-Tuning (Universal)",
        description="Clean and format multi-turn conversations for chatbot/assistant training - supports all LLM formats",
        use_case=UseCase.LLM_FINE_TUNING,
        framework=Framework.UNIVERSAL,
        tier_required="growth",
        steps=[
            PipelineStep(
                step_name="load_and_validate",
                operation="load_dataset",
                parameters={"format": "auto", "use_rust": True, "conversation_format": True},
                description="Load multi-turn conversation dataset with Rust kernels"
            ),
            PipelineStep(
                step_name="deduplicate",
                operation="deduplicate_conversations",
                parameters={"use_rust": True, "similarity_threshold": 0.95},
                description="Deduplicate similar conversations using content hashing"
            ),
            PipelineStep(
                step_name="clean_conversations",
                operation="clean_conversation_turns",
                parameters={"remove_empty_turns": True, "normalize_roles": True, "min_turns": 2},
                description="Clean conversation turns and normalize user/assistant roles"
            ),
            PipelineStep(
                step_name="quality_filter",
                operation="filter_conversation_quality",
                parameters={"min_quality_score": 0.7, "check_toxicity": True, "check_coherence": True},
                description="Filter low-quality or incoherent conversations"
            ),
            PipelineStep(
                step_name="format_conversion",
                operation="convert_to_llm_format",
                parameters={"output_format": "auto", "conversation_mode": True},
                description="Convert to chosen format (ShareGPT, OpenAI messages, HuggingFace chat, etc.)"
            ),
            PipelineStep(
                step_name="export",
                operation="export_ml_ready",
                parameters={"compression": "auto"},
                description="Export as ML-ready conversational format"
            )
        ],
        expected_input_format="JSON/JSONL with conversation arrays (role + content) or CSV with turn columns",
        expected_output_format="User choice: ShareGPT JSON, OpenAI messages JSONL, HuggingFace chat Arrow, Generic JSONL, Parquet",
        output_formats=[
            "sharegpt_json",  # Vicuna, FastChat (most popular for conversational)
            "openai_jsonl",  # GPT-3.5/4 chat format
            "huggingface_arrow",  # HuggingFace conversational datasets
            "generic_jsonl",  # Anthropic, Cohere chat formats
            "parquet",  # Enterprise ML platforms
            "csv"  # Research, analysis
        ],
        memory_reduction="70-80% vs pandas",
        estimated_speedup="6x vs pure Python",
        example_use="Fine-tuning chatbots/assistants (Vicuna, GPT, Claude-style) on multi-turn conversations"
    ),

    # Computer Vision Templates (Tier: Growth+)
    PipelineTemplate(
        template_id="cv-image-classification",
        name="Image Classification Pipeline",
        description="Prepare images for classification with augmentation and normalization",
        use_case=UseCase.COMPUTER_VISION,
        framework=Framework.PYTORCH,
        tier_required="growth",
        steps=[
            PipelineStep(
                step_name="load_images",
                operation="load_image_dataset",
                parameters={"resize": [224, 224], "format": "RGB"},
                description="Load and resize images to target dimensions"
            ),
            PipelineStep(
                step_name="augment",
                operation="apply_augmentation",
                parameters={
                    "transforms": ["random_flip", "random_rotation", "color_jitter"],
                    "probability": 0.5
                },
                description="Apply data augmentation transforms"
            ),
            PipelineStep(
                step_name="normalize",
                operation="normalize_images",
                parameters={"mean": [0.485, 0.456, 0.406], "std": [0.229, 0.224, 0.225]},
                description="Normalize with ImageNet statistics"
            ),
            PipelineStep(
                step_name="export",
                operation="export_ml_ready",
                parameters={"format": "pytorch_dataset", "split": [0.8, 0.1, 0.1]},
                description="Export as PyTorch Dataset with train/val/test splits"
            )
        ],
        expected_input_format="Image directory with class subdirectories",
        expected_output_format="PyTorch ImageFolder dataset",
        memory_reduction="Memory-mapped image loading",
        estimated_speedup="3x vs PIL sequential loading",
        example_use="Training ResNet/EfficientNet on custom image classes"
    ),

    # Tabular ML Templates (Tier: Develop+)
    PipelineTemplate(
        template_id="tabular-sklearn",
        name="Tabular ML Pipeline (scikit-learn)",
        description="Feature engineering, encoding, and scaling for tabular data",
        use_case=UseCase.TABULAR_ML,
        framework=Framework.SKLEARN,
        tier_required="develop",
        steps=[
            PipelineStep(
                step_name="load_and_profile",
                operation="load_dataset",
                parameters={"format": "auto", "use_rust": True, "profile": True},
                description="Load with automatic profiling for missing values and types"
            ),
            PipelineStep(
                step_name="handle_missing",
                operation="impute_missing",
                parameters={"strategy": "auto"},
                description="Intelligent missing value imputation"
            ),
            PipelineStep(
                step_name="encode_categoricals",
                operation="encode_categorical",
                parameters={"method": "target_encoding", "high_cardinality_threshold": 50},
                description="Target encoding for high-cardinality categoricals"
            ),
            PipelineStep(
                step_name="feature_engineering",
                operation="auto_feature_engineering",
                parameters={"interactions": True, "polynomials": 2},
                description="Automatic feature interactions and polynomial features"
            ),
            PipelineStep(
                step_name="scale",
                operation="scale_features",
                parameters={"method": "robust"},
                description="Robust scaling for outlier resistance"
            ),
            PipelineStep(
                step_name="export",
                operation="export_ml_ready",
                parameters={"format": "sklearn_numpy", "save_transformers": True},
                description="Export as numpy arrays with saved preprocessing transformers"
            )
        ],
        expected_input_format="CSV/Parquet with mixed numeric/categorical features",
        expected_output_format="NumPy arrays (X, y) + preprocessing pipeline",
        memory_reduction="70-80% vs pandas",
        estimated_speedup="5x vs pandas feature engineering",
        example_use="Training RandomForest/XGBoost on tabular data"
    ),

    # Text Classification Template (Tier: Growth+)
    PipelineTemplate(
        template_id="text-classification-hf",
        name="Text Classification (HuggingFace)",
        description="Prepare text data for classification with BERT-style models",
        use_case=UseCase.TEXT_CLASSIFICATION,
        framework=Framework.HUGGINGFACE,
        tier_required="growth",
        steps=[
            PipelineStep(
                step_name="load_and_clean",
                operation="load_dataset",
                parameters={"format": "auto", "use_rust": True},
                description="Load text dataset with Rust kernels"
            ),
            PipelineStep(
                step_name="deduplicate",
                operation="deduplicate_dataset",
                parameters={"columns": ["text"], "use_rust": True},
                description="Remove duplicate texts"
            ),
            PipelineStep(
                step_name="clean_text",
                operation="clean_text",
                parameters={"remove_urls": True, "remove_special_chars": False, "lowercase": False},
                description="Basic text cleaning while preserving case and punctuation"
            ),
            PipelineStep(
                step_name="tokenize",
                operation="tokenize_text",
                parameters={"tokenizer": "bert-base-uncased", "max_length": 512, "truncation": True},
                description="Tokenize with BERT tokenizer"
            ),
            PipelineStep(
                step_name="export",
                operation="export_ml_ready",
                parameters={"format": "huggingface_arrow"},
                description="Export as Arrow-backed HuggingFace dataset with labels"
            )
        ],
        expected_input_format="CSV/JSON with 'text' and 'label' columns",
        expected_output_format="HuggingFace Dataset (Arrow format)",
        memory_reduction="70-80% vs pandas",
        estimated_speedup="6x vs pure Python",
        example_use="Fine-tuning BERT for sentiment analysis or topic classification"
    ),

    # Time Series Template (Tier: Scale)
    PipelineTemplate(
        template_id="time-series-forecasting",
        name="Time Series Forecasting Pipeline",
        description="Prepare time series data with feature engineering for forecasting models",
        use_case=UseCase.TIME_SERIES,
        framework=Framework.SKLEARN,
        tier_required="scale",
        steps=[
            PipelineStep(
                step_name="load_and_sort",
                operation="load_dataset",
                parameters={"format": "auto", "use_rust": True, "parse_dates": True},
                description="Load with automatic datetime parsing and sorting"
            ),
            PipelineStep(
                step_name="resample",
                operation="resample_timeseries",
                parameters={"frequency": "1H", "aggregation": "mean"},
                description="Resample to consistent frequency"
            ),
            PipelineStep(
                step_name="lag_features",
                operation="create_lag_features",
                parameters={"lags": [1, 2, 3, 6, 12, 24], "rolling_windows": [3, 6, 12]},
                description="Create lag features and rolling statistics"
            ),
            PipelineStep(
                step_name="cyclical_encoding",
                operation="encode_cyclical",
                parameters={"features": ["hour", "day_of_week", "month"]},
                description="Encode cyclical time features with sin/cos"
            ),
            PipelineStep(
                step_name="export",
                operation="export_ml_ready",
                parameters={"format": "sklearn_numpy", "split_type": "temporal"},
                description="Export with temporal train/val/test split"
            )
        ],
        expected_input_format="CSV with timestamp column and target variable",
        expected_output_format="NumPy arrays with temporal splits",
        memory_reduction="70-80% vs pandas",
        estimated_speedup="8x vs pandas time series operations",
        example_use="Training LSTM/Prophet models for demand forecasting"
    ),
]

# Tier access mapping
TIER_HIERARCHY = {
    "develop": ["develop"],
    "growth": ["develop", "growth"],
    "scale": ["develop", "growth", "scale"]
}


def get_user_tier(api_key: str = None) -> str:
    """Get user tier from API key. Mock for now."""
    # TODO: Integrate with actual subscription service
    return "scale"  # Default to highest tier for demo


@router.get("/templates", response_model=List[PipelineTemplate])
async def list_pipeline_templates(
    use_case: Optional[UseCase] = None,
    framework: Optional[Framework] = None,
    user_tier: str = Depends(get_user_tier)
):
    """
    List available pipeline templates based on user tier and filters.

    - **use_case**: Filter by ML use case (llm_fine_tuning, computer_vision, tabular_ml, etc.)
    - **framework**: Filter by ML framework (huggingface, sklearn, pytorch, etc.)

    Returns templates accessible to user's subscription tier.
    """
    allowed_tiers = TIER_HIERARCHY.get(user_tier, ["develop"])

    templates = [
        t for t in PIPELINE_TEMPLATES
        if t.tier_required in allowed_tiers
    ]

    if use_case:
        templates = [t for t in templates if t.use_case == use_case]

    if framework:
        templates = [t for t in templates if t.framework == framework]

    logger.info(f"Listed {len(templates)} templates for user tier '{user_tier}'")
    return templates


@router.get("/templates/{template_id}", response_model=PipelineTemplate)
async def get_pipeline_template(
    template_id: str,
    user_tier: str = Depends(get_user_tier)
):
    """Get detailed information about a specific pipeline template."""
    template = next((t for t in PIPELINE_TEMPLATES if t.template_id == template_id), None)

    if not template:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")

    allowed_tiers = TIER_HIERARCHY.get(user_tier, ["develop"])
    if template.tier_required not in allowed_tiers:
        raise HTTPException(
            status_code=403,
            detail=f"Template requires '{template.tier_required}' tier or higher. Current tier: '{user_tier}'"
        )

    return template


@router.post("/run-template", response_model=RunTemplateResponse)
async def run_pipeline_template(
    request: RunTemplateRequest,
    background_tasks: BackgroundTasks,
    user_tier: str = Depends(get_user_tier)
):
    """
    Execute a pipeline template on a dataset.

    - **template_id**: ID of the template to run
    - **dataset_url**: URL to download dataset from (S3, GCS, HTTP)
    - **dataset_id**: Alternative: ID of already uploaded dataset
    - **custom_parameters**: Override default template parameters
    - **async_mode**: Run asynchronously (recommended for large datasets)
    """
    # Validate template access
    template = next((t for t in PIPELINE_TEMPLATES if t.template_id == request.template_id), None)
    if not template:
        raise HTTPException(status_code=404, detail=f"Template '{request.template_id}' not found")

    allowed_tiers = TIER_HIERARCHY.get(user_tier, ["develop"])
    if template.tier_required not in allowed_tiers:
        raise HTTPException(
            status_code=403,
            detail=f"Template requires '{template.tier_required}' tier or higher"
        )

    # Generate job ID
    import uuid
    job_id = f"job_{uuid.uuid4().hex[:12]}"

    # Execute pipeline (async mode)
    if request.async_mode:
        background_tasks.add_task(
            execute_pipeline_template,
            job_id=job_id,
            template=template,
            dataset_url=request.dataset_url,
            dataset_id=request.dataset_id,
            custom_parameters=request.custom_parameters
        )

        return RunTemplateResponse(
            job_id=job_id,
            template_id=request.template_id,
            status="running",
            message=f"Pipeline '{template.name}' started. Check status at /api/v1/pipelines/status/{job_id}",
            estimated_completion_time="2-5 minutes (depends on dataset size)"
        )

    # Synchronous execution (for small datasets)
    try:
        result = await execute_pipeline_template(
            job_id=job_id,
            template=template,
            dataset_url=request.dataset_url,
            dataset_id=request.dataset_id,
            custom_parameters=request.custom_parameters
        )

        return RunTemplateResponse(
            job_id=job_id,
            template_id=request.template_id,
            status="completed",
            message=f"Pipeline completed successfully",
            output_location=result.get("output_location")
        )
    except Exception as e:
        logger.error(f"Pipeline execution failed: {e}")
        raise HTTPException(status_code=500, detail=f"Pipeline execution failed: {str(e)}")


async def execute_pipeline_template(
    job_id: str,
    template: PipelineTemplate,
    dataset_url: Optional[str] = None,
    dataset_id: Optional[str] = None,
    custom_parameters: Dict[str, Any] = None
) -> Dict[str, Any]:
    """
    Execute the pipeline template steps.
    This is a mock implementation - integrate with actual Rust kernels and ML adapters.
    """
    logger.info(f"Executing pipeline template '{template.template_id}' for job '{job_id}'")

    # TODO: Integrate with actual implementation:
    # 1. Load dataset from URL or retrieve by ID
    # 2. Execute each step in template.steps using Rust kernels
    # 3. Apply custom_parameters overrides
    # 4. Save output to user's storage location
    # 5. Update job status in database

    # Mock result
    return {
        "job_id": job_id,
        "status": "completed",
        "output_location": f"s3://user-bucket/ml-ready/{job_id}/output.arrow",
        "rows_processed": 100000,
        "memory_used_mb": 45,
        "duration_seconds": 12.3
    }


@router.get("/status/{job_id}")
async def get_pipeline_status(job_id: str):
    """Check the status of a pipeline execution job."""
    # TODO: Query job status from database
    return {
        "job_id": job_id,
        "status": "completed",  # Mock status
        "progress_percent": 100,
        "message": "Pipeline completed successfully",
        "output_location": f"s3://user-bucket/ml-ready/{job_id}/output.arrow"
    }


# Format conversion endpoint
class ConvertFormatRequest(BaseModel):
    """Request to convert dataset between LLM formats."""
    dataset_id: str
    source_format: LLMOutputFormat
    target_format: LLMOutputFormat
    async_mode: bool = True


class ConvertFormatResponse(BaseModel):
    """Response from format conversion."""
    job_id: str
    source_format: str
    target_format: str
    status: str
    message: str
    output_location: Optional[str] = None


@router.post("/convert-format", response_model=ConvertFormatResponse)
async def convert_llm_format(
    request: ConvertFormatRequest,
    background_tasks: BackgroundTasks,
    user_tier: str = Depends(get_user_tier)
):
    """
    Convert cleaned dataset between LLM formats.

    Allows users to switch between formats without re-cleaning data:
    - HuggingFace Arrow ↔ Alpaca JSON
    - ShareGPT JSON ↔ OpenAI JSONL
    - Any format ↔ Parquet/CSV

    **Use case**: Clean once with pipeline template, then export to multiple formats for different LLM frameworks.

    - **dataset_id**: ID of already processed dataset
    - **source_format**: Current format of the dataset
    - **target_format**: Desired output format
    - **async_mode**: Run asynchronously (recommended)
    """
    import uuid
    job_id = f"convert_{uuid.uuid4().hex[:12]}"

    if request.async_mode:
        background_tasks.add_task(
            execute_format_conversion,
            job_id=job_id,
            dataset_id=request.dataset_id,
            source_format=request.source_format,
            target_format=request.target_format
        )

        return ConvertFormatResponse(
            job_id=job_id,
            source_format=request.source_format.value,
            target_format=request.target_format.value,
            status="running",
            message=f"Converting from {request.source_format.value} to {request.target_format.value}"
        )

    # Synchronous conversion
    try:
        result = await execute_format_conversion(
            job_id=job_id,
            dataset_id=request.dataset_id,
            source_format=request.source_format,
            target_format=request.target_format
        )

        return ConvertFormatResponse(
            job_id=job_id,
            source_format=request.source_format.value,
            target_format=request.target_format.value,
            status="completed",
            message="Conversion completed successfully",
            output_location=result.get("output_location")
        )
    except Exception as e:
        logger.error(f"Format conversion failed: {e}")
        raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")


async def execute_format_conversion(
    job_id: str,
    dataset_id: str,
    source_format: LLMOutputFormat,
    target_format: LLMOutputFormat
) -> Dict[str, Any]:
    """
    Execute format conversion using Rust kernels for zero-copy operations.
    This is a mock implementation - integrate with actual Rust kernels.
    """
    logger.info(f"Converting dataset '{dataset_id}' from {source_format.value} to {target_format.value}")

    # TODO: Integrate with actual implementation:
    # 1. Load dataset from storage in source_format
    # 2. Use Arrow IPC for zero-copy conversion where possible
    # 3. Convert to target_format schema
    # 4. Save output to user's storage location
    # 5. Update job status in database

    # Mock result
    return {
        "job_id": job_id,
        "status": "completed",
        "output_location": f"s3://user-bucket/ml-ready/{job_id}/output.{target_format.value}",
        "rows_processed": 100000,
        "duration_seconds": 3.2
    }


@router.get("/formats")
async def list_supported_formats():
    """
    List all supported LLM output formats with descriptions.

    Returns format compatibility matrix showing which LLMs support each format.
    """
    formats = []

    for fmt in LLMOutputFormat:
        format_info = {
            "format": fmt.value,
            "description": "",
            "supported_llms": [],
            "use_cases": []
        }

        if fmt == LLMOutputFormat.HUGGINGFACE_ARROW:
            format_info["description"] = "HuggingFace Dataset with Arrow backend - zero-copy, memory-efficient"
            format_info["supported_llms"] = ["Llama 2/3", "Mistral", "Phi", "Gemma", "Qwen", "DeepSeek"]
            format_info["use_cases"] = ["Open-source LLM fine-tuning", "LoRA/QLoRA training", "PEFT methods"]

        elif fmt == LLMOutputFormat.ALPACA_JSON:
            format_info["description"] = "Alpaca instruction format - community standard for instruction tuning"
            format_info["supported_llms"] = ["Alpaca", "WizardLM", "Orca", "Any Llama-based model"]
            format_info["use_cases"] = ["Instruction fine-tuning", "LoRA training", "Research experiments"]

        elif fmt == LLMOutputFormat.SHAREGPT_JSON:
            format_info["description"] = "ShareGPT conversational format - multi-turn dialogue standard"
            format_info["supported_llms"] = ["Vicuna", "FastChat", "ChatGLM", "Baichuan"]
            format_info["use_cases"] = ["Chatbot training", "Multi-turn conversations", "Assistant fine-tuning"]

        elif fmt == LLMOutputFormat.OPENAI_JSONL:
            format_info["description"] = "OpenAI fine-tuning format - official GPT fine-tuning standard"
            format_info["supported_llms"] = ["GPT-3.5 Turbo", "GPT-4", "GPT-4 Turbo"]
            format_info["use_cases"] = ["OpenAI API fine-tuning", "Production chatbots", "Enterprise applications"]

        elif fmt == LLMOutputFormat.GENERIC_JSONL:
            format_info["description"] = "Generic JSONL format - universal compatibility"
            format_info["supported_llms"] = ["Anthropic Claude", "Cohere", "Custom pipelines", "Research models"]
            format_info["use_cases"] = ["Custom fine-tuning pipelines", "API integrations", "Data analysis"]

        elif fmt == LLMOutputFormat.PARQUET:
            format_info["description"] = "Apache Parquet columnar format - enterprise ML platform standard"
            format_info["supported_llms"] = ["Databricks", "Spark ML", "Enterprise platforms"]
            format_info["use_cases"] = ["Large-scale ML", "Data warehousing", "Analytics integration"]

        elif fmt == LLMOutputFormat.CSV:
            format_info["description"] = "Simple CSV format - universal compatibility, human-readable"
            format_info["supported_llms"] = ["Any framework", "Research tools", "Legacy systems"]
            format_info["use_cases"] = ["Data inspection", "Research", "Legacy system integration"]

        formats.append(format_info)

    return {
        "total_formats": len(formats),
        "formats": formats,
        "conversion_note": "Use POST /api/v1/pipelines/convert-format to switch between formats without re-cleaning data"
    }
