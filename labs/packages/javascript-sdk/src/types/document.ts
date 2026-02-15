/**
 * Document extraction types for Igris-engine JavaScript SDK
 */

/**
 * Supported document types
 */
export enum DocumentType {
  PDF = 'pdf',
  DOCX = 'docx',
  DOC = 'doc',
  TXT = 'txt',
  HTML = 'html',
  MARKDOWN = 'markdown',
  RTF = 'rtf',
  ODT = 'odt',
  IMAGE = 'image'
}

/**
 * Extraction options configuration
 */
export interface ExtractionOptions {
  extract_text?: boolean;
  extract_tables?: boolean;
  extract_images?: boolean;
  extract_metadata?: boolean;
  extract_structure?: boolean;
  ocr_enabled?: boolean;
  language?: string;
  preserve_formatting?: boolean;
  page_range?: PageRange;
}

/**
 * Page range specification
 */
export interface PageRange {
  start?: number;
  end?: number;
  pages?: number[];
}

/**
 * Document extraction result
 */
export interface DocumentExtractionResult {
  document_id: string;
  document_type: DocumentType;
  pages: number;
  extraction_time_ms: number;
  text?: TextExtraction;
  tables?: TableExtraction[];
  images?: ImageExtraction[];
  metadata?: DocumentMetadata;
  structure?: DocumentStructure;
  language?: string;
  confidence_score?: number;
}

/**
 * Text extraction result
 */
export interface TextExtraction {
  full_text: string;
  pages: PageTextExtraction[];
  word_count: number;
  character_count: number;
  encoding?: string;
}

/**
 * Text extraction for a single page
 */
export interface PageTextExtraction {
  page_number: number;
  text: string;
  word_count: number;
  bounding_box?: BoundingBox;
  confidence?: number;
  language?: string;
}

/**
 * Bounding box coordinates
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  page?: number;
}

/**
 * Table extraction result
 */
export interface TableExtraction {
  table_id: string;
  page_number: number;
  rows: number;
  columns: number;
  headers?: string[];
  data: Array<Record<string, unknown>>;
  raw_data?: string[][];
  bounding_box?: BoundingBox;
  confidence?: number;
}

/**
 * Image extraction result
 */
export interface ImageExtraction {
  image_id: string;
  page_number: number;
  format: ImageFormat;
  width: number;
  height: number;
  url?: string;
  data?: string; // Base64 encoded
  bounding_box?: BoundingBox;
  caption?: string;
  alt_text?: string;
  ocr_text?: string;
}

/**
 * Image formats
 */
export enum ImageFormat {
  JPEG = 'jpeg',
  PNG = 'png',
  GIF = 'gif',
  BMP = 'bmp',
  TIFF = 'tiff',
  WEBP = 'webp'
}

/**
 * Document metadata
 */
export interface DocumentMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  creator?: string;
  producer?: string;
  created_date?: string;
  modified_date?: string;
  page_count?: number;
  file_size?: number;
  language?: string;
  custom_properties?: Record<string, unknown>;
}

/**
 * Document structure information
 */
export interface DocumentStructure {
  headings: HeadingElement[];
  paragraphs: ParagraphElement[];
  lists: ListElement[];
  sections: SectionElement[];
  toc?: TableOfContents;
}

/**
 * Heading element
 */
export interface HeadingElement {
  level: number;
  text: string;
  page_number: number;
  position: number;
  id?: string;
}

/**
 * Paragraph element
 */
export interface ParagraphElement {
  text: string;
  page_number: number;
  position: number;
  style?: TextStyle;
}

/**
 * Text styling information
 */
export interface TextStyle {
  font_family?: string;
  font_size?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  alignment?: 'left' | 'center' | 'right' | 'justify';
}

/**
 * List element
 */
export interface ListElement {
  type: 'ordered' | 'unordered';
  items: string[];
  page_number: number;
  position: number;
  nesting_level?: number;
}

/**
 * Section element
 */
export interface SectionElement {
  title?: string;
  level: number;
  page_start: number;
  page_end: number;
  content?: string;
}

/**
 * Table of contents
 */
export interface TableOfContents {
  entries: TOCEntry[];
}

/**
 * TOC entry
 */
export interface TOCEntry {
  title: string;
  level: number;
  page_number: number;
  children?: TOCEntry[];
}

/**
 * OCR configuration
 */
export interface OCRConfig {
  enabled: boolean;
  language?: string;
  languages?: string[];
  engine?: 'tesseract' | 'google_vision' | 'aws_textract';
  confidence_threshold?: number;
  preprocessing?: OCRPreprocessing;
}

/**
 * OCR preprocessing options
 */
export interface OCRPreprocessing {
  deskew?: boolean;
  denoise?: boolean;
  contrast_enhancement?: boolean;
  binarization?: boolean;
  resize_scale?: number;
}

/**
 * Batch extraction configuration
 */
export interface BatchExtractionConfig {
  documents: Array<string | File | Blob>;
  options: ExtractionOptions;
  parallel_processing?: boolean;
  max_workers?: number;
  callback_url?: string;
}

/**
 * Batch extraction result
 */
export interface BatchExtractionResult {
  batch_id: string;
  total_documents: number;
  completed: number;
  failed: number;
  in_progress: number;
  results: DocumentExtractionResult[];
  errors?: Array<{
    document_index: number;
    error: string;
  }>;
}

/**
 * Document comparison result
 */
export interface DocumentComparisonResult {
  document1_id: string;
  document2_id: string;
  similarity_score: number;
  differences: DocumentDifference[];
  summary: ComparisonSummary;
}

/**
 * Document difference
 */
export interface DocumentDifference {
  type: 'added' | 'removed' | 'modified';
  location: {
    page?: number;
    position?: number;
    section?: string;
  };
  old_value?: string;
  new_value?: string;
  context?: string;
}

/**
 * Comparison summary
 */
export interface ComparisonSummary {
  total_changes: number;
  additions: number;
  deletions: number;
  modifications: number;
  unchanged_percentage: number;
}

/**
 * Document classification result
 */
export interface DocumentClassificationResult {
  document_id: string;
  category: string;
  subcategory?: string;
  confidence: number;
  labels: Array<{
    name: string;
    confidence: number;
  }>;
  suggested_tags?: string[];
}

/**
 * Entity extraction result
 */
export interface EntityExtractionResult {
  entities: Entity[];
  entity_groups: Record<string, Entity[]>;
  relationships?: EntityRelationship[];
}

/**
 * Named entity
 */
export interface Entity {
  text: string;
  type: EntityType;
  start_position: number;
  end_position: number;
  page_number?: number;
  confidence: number;
  metadata?: Record<string, unknown>;
}

/**
 * Entity types
 */
export enum EntityType {
  PERSON = 'person',
  ORGANIZATION = 'organization',
  LOCATION = 'location',
  DATE = 'date',
  TIME = 'time',
  MONEY = 'money',
  PERCENTAGE = 'percentage',
  EMAIL = 'email',
  PHONE = 'phone',
  URL = 'url',
  CUSTOM = 'custom'
}

/**
 * Entity relationship
 */
export interface EntityRelationship {
  entity1: string;
  entity2: string;
  relationship_type: string;
  confidence: number;
}

/**
 * Document summary configuration
 */
export interface SummarizationConfig {
  method?: 'extractive' | 'abstractive';
  length?: 'short' | 'medium' | 'long';
  max_sentences?: number;
  max_words?: number;
  language?: string;
  focus_sections?: string[];
}

/**
 * Document summary result
 */
export interface DocumentSummary {
  summary: string;
  key_points: string[];
  length: number;
  compression_ratio: number;
  method: 'extractive' | 'abstractive';
  confidence?: number;
}

/**
 * Form field extraction result
 */
export interface FormFieldExtraction {
  fields: FormField[];
  field_groups?: Record<string, FormField[]>;
  completeness_score?: number;
}

/**
 * Individual form field
 */
export interface FormField {
  name: string;
  value: string;
  type: FormFieldType;
  page_number: number;
  bounding_box?: BoundingBox;
  confidence: number;
  validation_status?: 'valid' | 'invalid' | 'unknown';
}

/**
 * Form field types
 */
export enum FormFieldType {
  TEXT = 'text',
  NUMBER = 'number',
  DATE = 'date',
  CHECKBOX = 'checkbox',
  RADIO = 'radio',
  DROPDOWN = 'dropdown',
  SIGNATURE = 'signature',
  BARCODE = 'barcode',
  QR_CODE = 'qr_code'
}

/**
 * Language detection result
 */
export interface LanguageDetection {
  primary_language: string;
  language_code: string;
  confidence: number;
  detected_languages: Array<{
    language: string;
    language_code: string;
    confidence: number;
    percentage: number;
  }>;
}

/**
 * Document quality assessment
 */
export interface DocumentQuality {
  overall_score: number;
  readability_score?: number;
  image_quality?: number;
  text_clarity?: number;
  structure_quality?: number;
  issues: QualityIssue[];
  recommendations?: string[];
}

/**
 * Quality issue
 */
export interface QualityIssue {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  page_number?: number;
  affected_elements?: number;
}

export default {};