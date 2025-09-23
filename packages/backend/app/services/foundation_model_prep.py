"""
Foundation Model Preparation Service
==================================

Service for preparing large text corpora for foundation model training.
Wraps Hugging Face tokenizers and datasets libraries for efficient processing.

Key Features:
- Text-only support (skip multimodal for now)
- Tokenization for large text corpora with streaming
- Sequence packing and batching for training efficiency
- Deduplication of samples to improve data quality
- Memory-efficient processing for large datasets
- Integration with distributed processing pipeline
"""

import asyncio
import hashlib
import json
import logging
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional, Union, Iterator, Callable
from dataclasses import dataclass, field
from enum import Enum
import pandas as pd
import numpy as np
from collections import defaultdict, Counter
import re

# Hugging Face imports
try:
    from transformers import AutoTokenizer, PreTrainedTokenizer
    from datasets import Dataset, load_dataset, DatasetDict
    import torch
    HF_AVAILABLE = True
except ImportError:
    HF_AVAILABLE = False
    logger.warning("Hugging Face libraries not available. Some features will be disabled.")

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.database.connection import get_async_session
from app.database.models import ProcessingJob, JobStatus
from app.services.distributed_processor import distributed_processor

logger = logging.getLogger(__name__)

class TokenizationStrategy(str, Enum):
    """Tokenization strategies for different model types"""
    AUTOREGRESSIVE = "autoregressive"  # GPT-style (left-to-right)
    MASKED_LM = "masked_lm"           # BERT-style (bidirectional)
    INSTRUCTION_TUNING = "instruction_tuning"  # Instruction following
    CHAT = "chat"                     # Chat/conversation format

class SequencePackingStrategy(str, Enum):
    """Strategies for packing sequences into fixed-length chunks"""
    NONE = "none"                     # No packing
    SIMPLE = "simple"                 # Simple concatenation with separators
    GREEDY = "greedy"                 # Greedy bin packing
    SAMPLE_PACKING = "sample_packing" # Pack multiple samples per sequence

@dataclass
class TokenizationConfig:
    """Configuration for tokenization process"""
    # Tokenizer settings
    model_name_or_path: str = "gpt2"  # Default tokenizer
    max_sequence_length: int = 2048
    padding: bool = False
    truncation: bool = True
    add_special_tokens: bool = True

    # Text preprocessing
    lowercase: bool = False
    remove_extra_whitespace: bool = True
    remove_empty_lines: bool = True
    min_text_length: int = 10

    # Sequence packing
    packing_strategy: SequencePackingStrategy = SequencePackingStrategy.SIMPLE
    pack_sequences: bool = True
    sequence_separator: str = "<|endoftext|>"

    # Performance settings
    batch_size: int = 1000
    num_workers: int = 4
    streaming: bool = True

@dataclass
class DeduplicationConfig:
    """Configuration for text deduplication"""
    # Deduplication methods
    exact_dedup: bool = True
    near_dedup: bool = True
    semantic_dedup: bool = False  # Advanced, requires embeddings

    # Near-deduplication settings
    similarity_threshold: float = 0.9
    ngram_size: int = 5
    min_doc_length: int = 100

    # Performance settings
    chunk_size: int = 10000
    memory_efficient: bool = True

@dataclass
class PrepResult:
    """Result of foundation model preparation"""
    job_id: str
    output_path: str
    total_sequences: int
    total_tokens: int
    vocab_size: int
    avg_sequence_length: float
    dedup_removed_count: int = 0
    processing_time_seconds: float = 0.0
    quality_metrics: Dict[str, Any] = field(default_factory=dict)
    tokenizer_info: Dict[str, Any] = field(default_factory=dict)

class FoundationModelPrep:
    """
    Foundation model preparation service for large text corpora.

    Provides efficient tokenization, sequence packing, and deduplication
    for training foundation models on large text datasets.
    """

    def __init__(self):
        if not HF_AVAILABLE:
            logger.warning("Hugging Face not available. Limited functionality.")

        self.tokenizers = {}  # Cache for loaded tokenizers
        self.supported_formats = [".txt", ".jsonl", ".csv", ".parquet"]

    async def prepare_dataset_for_pretraining(
        self,
        input_path: str,
        output_path: str,
        tokenization_config: TokenizationConfig,
        dedup_config: Optional[DeduplicationConfig] = None,
        text_column: str = "text",
        job_id: Optional[str] = None
    ) -> str:
        """
        Prepare a text dataset for foundation model pretraining.

        Args:
            input_path: Path to input text dataset
            output_path: Path for prepared dataset
            tokenization_config: Tokenization configuration
            dedup_config: Optional deduplication configuration
            text_column: Name of text column in dataset
            job_id: Optional job ID for tracking

        Returns:
            Job ID for tracking progress
        """
        if not HF_AVAILABLE:
            raise ImportError("Hugging Face libraries required for foundation model prep")

        if job_id is None:
            job_id = str(uuid.uuid4())

        # Create job record
        await self._create_prep_job(job_id, input_path, output_path, tokenization_config)

        # Start background processing
        asyncio.create_task(self._prepare_dataset_background(
            job_id, input_path, output_path, tokenization_config, dedup_config, text_column
        ))

        return job_id

    async def _prepare_dataset_background(
        self,
        job_id: str,
        input_path: str,
        output_path: str,
        tokenization_config: TokenizationConfig,
        dedup_config: Optional[DeduplicationConfig],
        text_column: str
    ):
        """Background task for dataset preparation"""
        start_time = datetime.utcnow()

        try:
            await self._update_job_status(job_id, "processing", "Loading dataset")

            # Load and preprocess text data
            texts = await self._load_text_dataset(input_path, text_column)
            logger.info(f"Loaded {len(texts)} text samples")

            # Preprocessing
            await self._update_job_status(job_id, "processing", "Preprocessing text")
            texts = await self._preprocess_texts(texts, tokenization_config)
            logger.info(f"After preprocessing: {len(texts)} text samples")

            # Deduplication if configured
            dedup_removed = 0
            if dedup_config:
                await self._update_job_status(job_id, "processing", "Deduplicating text")
                texts, dedup_removed = await self._deduplicate_texts(texts, dedup_config)
                logger.info(f"After deduplication: {len(texts)} text samples ({dedup_removed} removed)")

            # Load tokenizer
            await self._update_job_status(job_id, "processing", "Loading tokenizer")
            tokenizer = await self._load_tokenizer(tokenization_config.model_name_or_path)

            # Tokenization
            await self._update_job_status(job_id, "processing", "Tokenizing text")
            tokenized_dataset = await self._tokenize_texts(texts, tokenizer, tokenization_config)
            logger.info(f"Tokenized {len(tokenized_dataset)} sequences")

            # Sequence packing
            if tokenization_config.pack_sequences:
                await self._update_job_status(job_id, "processing", "Packing sequences")
                tokenized_dataset = await self._pack_sequences(tokenized_dataset, tokenization_config)
                logger.info(f"After packing: {len(tokenized_dataset)} sequences")

            # Save prepared dataset
            await self._update_job_status(job_id, "processing", "Saving prepared dataset")
            await self._save_prepared_dataset(tokenized_dataset, output_path, tokenizer)

            # Calculate metrics
            total_tokens = sum(len(seq['input_ids']) for seq in tokenized_dataset)
            avg_length = total_tokens / len(tokenized_dataset) if tokenized_dataset else 0

            result = PrepResult(
                job_id=job_id,
                output_path=output_path,
                total_sequences=len(tokenized_dataset),
                total_tokens=total_tokens,
                vocab_size=tokenizer.vocab_size,
                avg_sequence_length=avg_length,
                dedup_removed_count=dedup_removed,
                processing_time_seconds=(datetime.utcnow() - start_time).total_seconds(),
                quality_metrics=await self._calculate_quality_metrics(tokenized_dataset, texts),
                tokenizer_info={
                    "model_name": tokenization_config.model_name_or_path,
                    "vocab_size": tokenizer.vocab_size,
                    "special_tokens": dict(tokenizer.special_tokens_map)
                }
            )

            await self._complete_prep_job(job_id, result)

        except Exception as e:
            logger.error(f"Foundation model prep failed for job {job_id}: {e}")
            await self._fail_prep_job(job_id, str(e))

    async def _load_text_dataset(self, input_path: str, text_column: str) -> List[str]:
        """Load text dataset from various formats"""
        try:
            file_path = Path(input_path)
            file_format = file_path.suffix.lower()

            if file_format == '.txt':
                # Plain text file - split by lines or paragraphs
                with open(input_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    # Split by double newlines (paragraphs) or single newlines
                    if '\n\n' in content:
                        texts = [text.strip() for text in content.split('\n\n') if text.strip()]
                    else:
                        texts = [text.strip() for text in content.split('\n') if text.strip()]

            elif file_format == '.jsonl':
                texts = []
                with open(input_path, 'r', encoding='utf-8') as f:
                    for line in f:
                        data = json.loads(line.strip())
                        if text_column in data:
                            texts.append(data[text_column])

            elif file_format == '.csv':
                df = pd.read_csv(input_path)
                if text_column not in df.columns:
                    raise ValueError(f"Text column '{text_column}' not found in CSV")
                texts = df[text_column].dropna().tolist()

            elif file_format == '.parquet':
                df = pd.read_parquet(input_path)
                if text_column not in df.columns:
                    raise ValueError(f"Text column '{text_column}' not found in Parquet")
                texts = df[text_column].dropna().tolist()

            else:
                raise ValueError(f"Unsupported file format: {file_format}")

            return [str(text) for text in texts if text]  # Ensure strings and filter empty

        except Exception as e:
            logger.error(f"Failed to load text dataset: {e}")
            raise

    async def _preprocess_texts(
        self,
        texts: List[str],
        config: TokenizationConfig
    ) -> List[str]:
        """Preprocess text data"""
        processed_texts = []

        for text in texts:
            # Skip empty or too short texts
            if len(text.strip()) < config.min_text_length:
                continue

            # Basic preprocessing
            if config.remove_extra_whitespace:
                text = re.sub(r'\s+', ' ', text)

            if config.remove_empty_lines:
                text = '\n'.join(line.strip() for line in text.split('\n') if line.strip())

            if config.lowercase:
                text = text.lower()

            processed_texts.append(text.strip())

        return processed_texts

    async def _deduplicate_texts(
        self,
        texts: List[str],
        config: DeduplicationConfig
    ) -> tuple[List[str], int]:
        """Remove duplicate text samples"""
        original_count = len(texts)
        unique_texts = []
        seen_hashes = set()
        seen_ngrams = defaultdict(set)

        for text in texts:
            # Exact deduplication
            if config.exact_dedup:
                text_hash = hashlib.md5(text.encode()).hexdigest()
                if text_hash in seen_hashes:
                    continue
                seen_hashes.add(text_hash)

            # Near deduplication using n-grams
            if config.near_dedup and len(text) >= config.min_doc_length:
                ngrams = self._extract_ngrams(text, config.ngram_size)
                ngram_set = set(ngrams)

                # Check similarity with existing documents
                is_duplicate = False
                for existing_ngrams in seen_ngrams.values():
                    if len(ngram_set) == 0:
                        break

                    overlap = len(ngram_set.intersection(existing_ngrams))
                    similarity = overlap / len(ngram_set)

                    if similarity >= config.similarity_threshold:
                        is_duplicate = True
                        break

                if is_duplicate:
                    continue

                # Store n-grams for this document
                seen_ngrams[len(unique_texts)] = ngram_set

            unique_texts.append(text)

        removed_count = original_count - len(unique_texts)
        return unique_texts, removed_count

    def _extract_ngrams(self, text: str, n: int) -> List[str]:
        """Extract n-grams from text for similarity comparison"""
        # Simple word-level n-grams
        words = text.lower().split()
        return [' '.join(words[i:i+n]) for i in range(len(words) - n + 1)]

    async def _load_tokenizer(self, model_name_or_path: str) -> PreTrainedTokenizer:
        """Load and cache tokenizer"""
        if model_name_or_path in self.tokenizers:
            return self.tokenizers[model_name_or_path]

        try:
            tokenizer = AutoTokenizer.from_pretrained(model_name_or_path)

            # Add pad token if not present (common for GPT models)
            if tokenizer.pad_token is None:
                tokenizer.pad_token = tokenizer.eos_token

            self.tokenizers[model_name_or_path] = tokenizer
            return tokenizer

        except Exception as e:
            logger.error(f"Failed to load tokenizer {model_name_or_path}: {e}")
            raise

    async def _tokenize_texts(
        self,
        texts: List[str],
        tokenizer: PreTrainedTokenizer,
        config: TokenizationConfig
    ) -> List[Dict[str, Any]]:
        """Tokenize text samples"""
        tokenized_samples = []

        # Process in batches for efficiency
        for i in range(0, len(texts), config.batch_size):
            batch_texts = texts[i:i + config.batch_size]

            # Tokenize batch
            tokenized = tokenizer(
                batch_texts,
                max_length=config.max_sequence_length,
                truncation=config.truncation,
                padding=config.padding,
                add_special_tokens=config.add_special_tokens,
                return_tensors=None  # Return lists instead of tensors
            )

            # Convert to individual samples
            for j in range(len(batch_texts)):
                sample = {
                    'input_ids': tokenized['input_ids'][j],
                    'attention_mask': tokenized['attention_mask'][j] if 'attention_mask' in tokenized else None,
                    'text': batch_texts[j]  # Keep original text for reference
                }
                tokenized_samples.append(sample)

        return tokenized_samples

    async def _pack_sequences(
        self,
        tokenized_samples: List[Dict[str, Any]],
        config: TokenizationConfig
    ) -> List[Dict[str, Any]]:
        """Pack multiple short sequences into longer ones"""
        if config.packing_strategy == SequencePackingStrategy.NONE:
            return tokenized_samples

        packed_samples = []
        current_sequence = []
        current_length = 0

        separator_tokens = tokenizer.encode(config.sequence_separator, add_special_tokens=False) if hasattr(self, 'tokenizer') else []

        for sample in tokenized_samples:
            input_ids = sample['input_ids']
            sample_length = len(input_ids)

            # Check if we can fit this sample
            needed_length = sample_length + len(separator_tokens) if current_sequence else sample_length

            if current_length + needed_length <= config.max_sequence_length:
                # Add to current sequence
                if current_sequence:
                    current_sequence.extend(separator_tokens)
                    current_length += len(separator_tokens)

                current_sequence.extend(input_ids)
                current_length += sample_length

            else:
                # Start new sequence
                if current_sequence:
                    packed_samples.append({
                        'input_ids': current_sequence,
                        'attention_mask': [1] * len(current_sequence)
                    })

                current_sequence = input_ids.copy()
                current_length = sample_length

        # Add final sequence
        if current_sequence:
            packed_samples.append({
                'input_ids': current_sequence,
                'attention_mask': [1] * len(current_sequence)
            })

        return packed_samples

    async def _save_prepared_dataset(
        self,
        tokenized_dataset: List[Dict[str, Any]],
        output_path: str,
        tokenizer: PreTrainedTokenizer
    ):
        """Save prepared dataset in HuggingFace format"""
        try:
            output_dir = Path(output_path)
            output_dir.mkdir(parents=True, exist_ok=True)

            # Convert to HuggingFace Dataset
            dataset_dict = {
                'input_ids': [sample['input_ids'] for sample in tokenized_dataset],
                'attention_mask': [sample['attention_mask'] for sample in tokenized_dataset if sample.get('attention_mask')]
            }

            # Only include attention_mask if present for all samples
            if len(dataset_dict['attention_mask']) != len(dataset_dict['input_ids']):
                del dataset_dict['attention_mask']

            dataset = Dataset.from_dict(dataset_dict)

            # Save dataset
            dataset.save_to_disk(str(output_dir / "dataset"))

            # Save tokenizer
            tokenizer.save_pretrained(str(output_dir / "tokenizer"))

            # Save metadata
            metadata = {
                "total_sequences": len(tokenized_dataset),
                "total_tokens": sum(len(sample['input_ids']) for sample in tokenized_dataset),
                "avg_sequence_length": sum(len(sample['input_ids']) for sample in tokenized_dataset) / len(tokenized_dataset),
                "vocab_size": tokenizer.vocab_size,
                "created_at": datetime.utcnow().isoformat()
            }

            with open(output_dir / "metadata.json", 'w') as f:
                json.dump(metadata, f, indent=2)

        except Exception as e:
            logger.error(f"Failed to save prepared dataset: {e}")
            raise

    async def _calculate_quality_metrics(
        self,
        tokenized_dataset: List[Dict[str, Any]],
        original_texts: List[str]
    ) -> Dict[str, Any]:
        """Calculate quality metrics for the prepared dataset"""
        try:
            # Sequence length distribution
            lengths = [len(sample['input_ids']) for sample in tokenized_dataset]

            # Token frequency analysis
            all_tokens = []
            for sample in tokenized_dataset:
                all_tokens.extend(sample['input_ids'])

            token_counts = Counter(all_tokens)

            return {
                "sequence_length_stats": {
                    "min": min(lengths) if lengths else 0,
                    "max": max(lengths) if lengths else 0,
                    "mean": np.mean(lengths) if lengths else 0,
                    "median": np.median(lengths) if lengths else 0,
                    "std": np.std(lengths) if lengths else 0
                },
                "token_frequency": {
                    "unique_tokens": len(token_counts),
                    "most_common_tokens": token_counts.most_common(10),
                    "vocabulary_coverage": len(token_counts) / max(all_tokens) if all_tokens else 0
                },
                "text_quality": {
                    "avg_text_length": np.mean([len(text) for text in original_texts]) if original_texts else 0,
                    "total_characters": sum(len(text) for text in original_texts),
                    "compression_ratio": sum(len(sample['input_ids']) for sample in tokenized_dataset) / sum(len(text) for text in original_texts) if original_texts else 0
                }
            }

        except Exception as e:
            logger.warning(f"Failed to calculate quality metrics: {e}")
            return {}

    async def _create_prep_job(
        self,
        job_id: str,
        input_path: str,
        output_path: str,
        config: TokenizationConfig
    ):
        """Create database record for prep job"""
        try:
            async with get_async_session() as session:
                job = ProcessingJob(
                    id=uuid.UUID(job_id),
                    job_type="foundation_model_prep",
                    config={
                        "input_path": input_path,
                        "output_path": output_path,
                        "tokenization_config": config.__dict__
                    },
                    status=JobStatus.PENDING
                )
                session.add(job)
                await session.commit()

        except Exception as e:
            logger.error(f"Failed to create prep job: {e}")

    async def _update_job_status(self, job_id: str, status: str, operation: str = None):
        """Update job status in database"""
        try:
            async with get_async_session() as session:
                update_data = {"status": JobStatus(status)}
                if operation:
                    update_data["config"] = {"current_operation": operation}

                stmt = (
                    update(ProcessingJob)
                    .where(ProcessingJob.id == uuid.UUID(job_id))
                    .values(**update_data)
                )
                await session.execute(stmt)
                await session.commit()

        except Exception as e:
            logger.error(f"Failed to update job status: {e}")

    async def _complete_prep_job(self, job_id: str, result: PrepResult):
        """Complete prep job with results"""
        try:
            async with get_async_session() as session:
                stmt = (
                    update(ProcessingJob)
                    .where(ProcessingJob.id == uuid.UUID(job_id))
                    .values(
                        status=JobStatus.COMPLETED,
                        progress_percentage=100.0,
                        output_summary=result.__dict__,
                        output_artifact_path=result.output_path,
                        completed_at=datetime.utcnow()
                    )
                )
                await session.execute(stmt)
                await session.commit()

        except Exception as e:
            logger.error(f"Failed to complete prep job: {e}")

    async def _fail_prep_job(self, job_id: str, error_message: str):
        """Mark prep job as failed"""
        try:
            async with get_async_session() as session:
                stmt = (
                    update(ProcessingJob)
                    .where(ProcessingJob.id == uuid.UUID(job_id))
                    .values(
                        status=JobStatus.FAILED,
                        error_message=error_message,
                        completed_at=datetime.utcnow()
                    )
                )
                await session.execute(stmt)
                await session.commit()

        except Exception as e:
            logger.error(f"Failed to fail prep job: {e}")

    async def get_prep_job_status(self, job_id: str) -> Dict[str, Any]:
        """Get status of foundation model prep job"""
        try:
            async with get_async_session() as session:
                stmt = select(ProcessingJob).where(ProcessingJob.id == uuid.UUID(job_id))
                result = await session.execute(stmt)
                job = result.scalar_one_or_none()

                if job:
                    return {
                        "job_id": job_id,
                        "status": job.status.value,
                        "progress_percentage": job.progress_percentage,
                        "output_path": job.output_artifact_path,
                        "error_message": job.error_message,
                        "created_at": job.created_at.isoformat() if job.created_at else None,
                        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
                        "output_summary": job.output_summary,
                        "current_operation": job.config.get("current_operation") if job.config else None
                    }
                else:
                    return {"error": "Job not found"}

        except Exception as e:
            logger.error(f"Failed to get prep job status: {e}")
            return {"error": str(e)}

# Global instance
foundation_model_prep = FoundationModelPrep()