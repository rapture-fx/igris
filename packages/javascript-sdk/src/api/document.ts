/**
 * Document Extraction API for Schlep-engine JavaScript SDK
 * Provides comprehensive document processing and extraction capabilities
 */

import { BaseAPI } from './base';
import { APIResponse } from '../types/common';
import {
  DocumentExtractionResult,
  ExtractionOptions,
  BatchExtractionConfig,
  BatchExtractionResult,
  DocumentComparisonResult,
  DocumentClassificationResult,
  EntityExtractionResult,
  SummarizationConfig,
  DocumentSummary,
  FormFieldExtraction,
  LanguageDetection,
  DocumentQuality,
  TableExtraction,
  ImageExtraction,
  OCRConfig
} from '../types/document';

/**
 * Document Extraction API client
 *
 * Provides methods for extracting text, tables, images, and metadata from various
 * document formats including PDFs, Word documents, and images.
 *
 * @example
 * ```typescript
 * // Extract text from a document
 * const result = await client.document.extractText(file, {
 *   extract_tables: true,
 *   extract_images: true,
 *   ocr_enabled: true
 * });
 *
 * // Extract tables only
 * const tables = await client.document.extractTables(file);
 *
 * // Classify a document
 * const classification = await client.document.classifyDocument(file);
 * ```
 */
export class DocumentExtractionAPI extends BaseAPI {
  protected basePath = '/extract';

  /**
   * Extract text from a document
   *
   * Extracts text content from documents with support for OCR,
   * table extraction, and image extraction.
   *
   * @param file - Document file (File, Blob, or file path)
   * @param options - Extraction options
   * @param onProgress - Progress callback
   * @returns Extraction results
   *
   * @example
   * ```typescript
   * const result = await client.document.extractText(file, {
   *   extract_text: true,
   *   extract_tables: true,
   *   extract_images: false,
   *   ocr_enabled: true,
   *   language: 'eng',
   *   page_range: { start: 1, end: 10 }
   * });
   *
   * console.log(`Extracted ${result.data.text.word_count} words`);
   * console.log(`Found ${result.data.tables.length} tables`);
   * ```
   */
  async extractText(
    file: File | Blob,
    options: ExtractionOptions = {},
    onProgress?: (progress: number) => void
  ): Promise<APIResponse<DocumentExtractionResult>> {
    const formData = new FormData();
    formData.append('file', file);

    // Add options to form data
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, JSON.stringify(value));
      }
    });

    return this.uploadFile<DocumentExtractionResult>(
      '/text',
      file,
      options as any,
      onProgress
    );
  }

  /**
   * Extract tables from a document
   *
   * Specialized extraction focused on identifying and parsing tables
   * with automatic header detection and data structuring.
   *
   * @param file - Document file
   * @param onProgress - Progress callback
   * @returns Extracted tables
   *
   * @example
   * ```typescript
   * const tables = await client.document.extractTables(file);
   *
   * tables.data.forEach((table, index) => {
   *   console.log(`Table ${index + 1}: ${table.rows}x${table.columns}`);
   *   console.log('Headers:', table.headers);
   *   console.log('Data:', table.data);
   * });
   * ```
   */
  async extractTables(
    file: File | Blob,
    onProgress?: (progress: number) => void
  ): Promise<APIResponse<TableExtraction[]>> {
    return this.uploadFile<TableExtraction[]>(
      '/tables',
      file,
      undefined,
      onProgress
    );
  }

  /**
   * Extract images from a document
   *
   * Extracts all images from a document with optional OCR on image content.
   *
   * @param file - Document file
   * @param includeOCR - Whether to perform OCR on extracted images
   * @param onProgress - Progress callback
   * @returns Extracted images
   *
   * @example
   * ```typescript
   * const images = await client.document.extractImages(file, true);
   *
   * images.data.forEach((image, index) => {
   *   console.log(`Image ${index + 1}:`, {
   *     format: image.format,
   *     size: `${image.width}x${image.height}`,
   *     page: image.page_number,
   *     ocr_text: image.ocr_text
   *   });
   * });
   * ```
   */
  async extractImages(
    file: File | Blob,
    includeOCR: boolean = false,
    onProgress?: (progress: number) => void
  ): Promise<APIResponse<ImageExtraction[]>> {
    return this.uploadFile<ImageExtraction[]>(
      '/images',
      file,
      { include_ocr: includeOCR } as any,
      onProgress
    );
  }

  /**
   * Perform OCR on a document or image
   *
   * Uses optical character recognition to extract text from scanned documents or images.
   *
   * @param file - Document or image file
   * @param config - OCR configuration
   * @param onProgress - Progress callback
   * @returns OCR results
   *
   * @example
   * ```typescript
   * const result = await client.document.performOCR(file, {
   *   enabled: true,
   *   languages: ['eng', 'fra'],
   *   engine: 'tesseract',
   *   confidence_threshold: 0.8,
   *   preprocessing: {
   *     deskew: true,
   *     denoise: true,
   *     contrast_enhancement: true
   *   }
   * });
   * ```
   */
  async performOCR(
    file: File | Blob,
    config: OCRConfig,
    onProgress?: (progress: number) => void
  ): Promise<APIResponse<DocumentExtractionResult>> {
    return this.uploadFile<DocumentExtractionResult>(
      '/ocr',
      file,
      config as any,
      onProgress
    );
  }

  /**
   * Extract form fields from a document
   *
   * Identifies and extracts form fields including checkboxes, text fields,
   * signatures, and barcodes.
   *
   * @param file - Document file
   * @param onProgress - Progress callback
   * @returns Extracted form fields
   *
   * @example
   * ```typescript
   * const form = await client.document.extractFormFields(file);
   *
   * form.data.fields.forEach(field => {
   *   console.log(`${field.name}: ${field.value} (${field.type})`);
   *   console.log(`Confidence: ${field.confidence}`);
   * });
   *
   * console.log(`Form completeness: ${form.data.completeness_score}%`);
   * ```
   */
  async extractFormFields(
    file: File | Blob,
    onProgress?: (progress: number) => void
  ): Promise<APIResponse<FormFieldExtraction>> {
    return this.uploadFile<FormFieldExtraction>(
      '/forms',
      file,
      undefined,
      onProgress
    );
  }

  /**
   * Extract named entities from a document
   *
   * Identifies and extracts entities such as people, organizations,
   * locations, dates, and custom entity types.
   *
   * @param file - Document file
   * @param entityTypes - Optional list of entity types to extract
   * @param onProgress - Progress callback
   * @returns Extracted entities
   *
   * @example
   * ```typescript
   * const entities = await client.document.extractEntities(file, [
   *   'person',
   *   'organization',
   *   'location',
   *   'date'
   * ]);
   *
   * // Group entities by type
   * Object.entries(entities.data.entity_groups).forEach(([type, items]) => {
   *   console.log(`${type}: ${items.length} found`);
   * });
   * ```
   */
  async extractEntities(
    file: File | Blob,
    entityTypes?: string[],
    onProgress?: (progress: number) => void
  ): Promise<APIResponse<EntityExtractionResult>> {
    const params = entityTypes ? { entity_types: entityTypes } : undefined;
    return this.uploadFile<EntityExtractionResult>(
      '/entities',
      file,
      params as any,
      onProgress
    );
  }

  /**
   * Batch extract from multiple documents
   *
   * Process multiple documents in parallel with configurable options.
   *
   * @param config - Batch extraction configuration
   * @returns Batch processing results
   *
   * @example
   * ```typescript
   * const batch = await client.document.batchExtract({
   *   documents: [file1, file2, file3],
   *   options: {
   *     extract_text: true,
   *     extract_tables: true,
   *     ocr_enabled: true
   *   },
   *   parallel_processing: true,
   *   max_workers: 4
   * });
   *
   * console.log(`Completed: ${batch.data.completed}/${batch.data.total_documents}`);
   * ```
   */
  async batchExtract(
    config: BatchExtractionConfig
  ): Promise<APIResponse<BatchExtractionResult>> {
    const formData = new FormData();

    // Add documents
    config.documents.forEach((doc, index) => {
      if (doc instanceof File || doc instanceof Blob) {
        formData.append(`document_${index}`, doc);
      } else if (typeof doc === 'string') {
        formData.append(`document_path_${index}`, doc);
      }
    });

    // Add configuration
    formData.append('options', JSON.stringify(config.options));
    if (config.parallel_processing !== undefined) {
      formData.append('parallel_processing', String(config.parallel_processing));
    }
    if (config.max_workers) {
      formData.append('max_workers', String(config.max_workers));
    }
    if (config.callback_url) {
      formData.append('callback_url', config.callback_url);
    }

    return this.post<BatchExtractionResult>('/batch', {
      params: formData as any
    });
  }

  /**
   * Get batch extraction status
   *
   * @param batchId - Batch ID
   * @returns Batch status and results
   */
  async getBatchStatus(
    batchId: string
  ): Promise<APIResponse<BatchExtractionResult>> {
    return this.get<BatchExtractionResult>(`/batch/${batchId}`);
  }

  /**
   * Compare two documents
   *
   * Performs a detailed comparison between two documents,
   * highlighting differences and calculating similarity scores.
   *
   * @param file1 - First document
   * @param file2 - Second document
   * @returns Comparison results
   *
   * @example
   * ```typescript
   * const comparison = await client.document.compareDocuments(
   *   originalDoc,
   *   revisedDoc
   * );
   *
   * console.log(`Similarity: ${comparison.data.similarity_score}%`);
   * console.log(`Total changes: ${comparison.data.summary.total_changes}`);
   *
   * comparison.data.differences.forEach(diff => {
   *   console.log(`${diff.type}: ${diff.old_value} → ${diff.new_value}`);
   * });
   * ```
   */
  async compareDocuments(
    file1: File | Blob,
    file2: File | Blob
  ): Promise<APIResponse<DocumentComparisonResult>> {
    const formData = new FormData();
    formData.append('document1', file1);
    formData.append('document2', file2);

    return this.post<DocumentComparisonResult>('/compare', {
      params: formData as any
    });
  }

  /**
   * Classify a document
   *
   * Automatically categorizes a document based on its content,
   * providing confidence scores and suggested tags.
   *
   * @param file - Document file
   * @param categories - Optional predefined categories
   * @param onProgress - Progress callback
   * @returns Classification results
   *
   * @example
   * ```typescript
   * const classification = await client.document.classifyDocument(file);
   *
   * console.log(`Category: ${classification.data.category}`);
   * console.log(`Confidence: ${classification.data.confidence}`);
   * console.log(`Tags:`, classification.data.suggested_tags);
   * ```
   */
  async classifyDocument(
    file: File | Blob,
    categories?: string[],
    onProgress?: (progress: number) => void
  ): Promise<APIResponse<DocumentClassificationResult>> {
    const params = categories ? { categories } : undefined;
    return this.uploadFile<DocumentClassificationResult>(
      '/classify',
      file,
      params as any,
      onProgress
    );
  }

  /**
   * Summarize a document
   *
   * Generates a concise summary of the document content using
   * extractive or abstractive methods.
   *
   * @param file - Document file
   * @param config - Summarization configuration
   * @param onProgress - Progress callback
   * @returns Document summary
   *
   * @example
   * ```typescript
   * const summary = await client.document.summarizeDocument(file, {
   *   method: 'abstractive',
   *   length: 'medium',
   *   max_sentences: 5
   * });
   *
   * console.log('Summary:', summary.data.summary);
   * console.log('Key points:', summary.data.key_points);
   * console.log(`Compression: ${summary.data.compression_ratio}x`);
   * ```
   */
  async summarizeDocument(
    file: File | Blob,
    config: SummarizationConfig = {},
    onProgress?: (progress: number) => void
  ): Promise<APIResponse<DocumentSummary>> {
    return this.uploadFile<DocumentSummary>(
      '/summarize',
      file,
      config as any,
      onProgress
    );
  }

  /**
   * Detect document language
   *
   * Identifies the primary language and all languages present in the document.
   *
   * @param file - Document file
   * @returns Language detection results
   *
   * @example
   * ```typescript
   * const languages = await client.document.detectLanguage(file);
   *
   * console.log(`Primary: ${languages.data.primary_language}`);
   * languages.data.detected_languages.forEach(lang => {
   *   console.log(`${lang.language}: ${lang.percentage}%`);
   * });
   * ```
   */
  async detectLanguage(
    file: File | Blob
  ): Promise<APIResponse<LanguageDetection>> {
    return this.uploadFile<LanguageDetection>('/language', file);
  }

  /**
   * Assess document quality
   *
   * Analyzes document quality including readability, image quality,
   * and structure, providing recommendations for improvement.
   *
   * @param file - Document file
   * @returns Quality assessment
   *
   * @example
   * ```typescript
   * const quality = await client.document.assessQuality(file);
   *
   * console.log(`Overall score: ${quality.data.overall_score}`);
   * console.log(`Issues found: ${quality.data.issues.length}`);
   *
   * quality.data.issues.forEach(issue => {
   *   console.log(`[${issue.severity}] ${issue.description}`);
   * });
   * ```
   */
  async assessQuality(
    file: File | Blob
  ): Promise<APIResponse<DocumentQuality>> {
    return this.uploadFile<DocumentQuality>('/quality', file);
  }

  /**
   * Get extraction job status
   *
   * @param jobId - Extraction job ID
   * @returns Job status and results
   */
  async getExtractionStatus(
    jobId: string
  ): Promise<APIResponse<DocumentExtractionResult>> {
    return this.get<DocumentExtractionResult>(`/jobs/${jobId}`);
  }

  /**
   * Cancel an extraction job
   *
   * @param jobId - Job ID to cancel
   * @returns Cancellation confirmation
   */
  async cancelExtraction(jobId: string): Promise<APIResponse<void>> {
    return this.post<void>(`/jobs/${jobId}/cancel`);
  }

  /**
   * Download extracted content
   *
   * Downloads the extracted content in the specified format.
   *
   * @param jobId - Extraction job ID
   * @param format - Output format (json, txt, csv)
   * @returns Download URL
   */
  async downloadExtraction(
    jobId: string,
    format: 'json' | 'txt' | 'csv' = 'json'
  ): Promise<APIResponse<{ download_url: string; expires_at: string }>> {
    return this.get<{ download_url: string; expires_at: string }>(
      `/jobs/${jobId}/download`,
      { params: { format } as any }
    );
  }
}

export default DocumentExtractionAPI;