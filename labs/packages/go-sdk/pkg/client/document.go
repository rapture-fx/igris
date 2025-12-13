package client

import (
	"context"
	"encoding/json"
	"fmt"
	"io"

	"github.com/igris-inertial/go-sdk/pkg/models"
	"go.opentelemetry.io/otel/attribute"
)

// DocumentClient handles document extraction operations
type DocumentClient struct {
	client *Client
}

// NewDocumentClient creates a new document extraction client
func NewDocumentClient(client *Client) *DocumentClient {
	return &DocumentClient{
		client: client,
	}
}

// ExtractTextRequest represents a text extraction request
type ExtractTextRequest struct {
	ExtractTables bool `json:"extract_tables"`
	ExtractImages bool `json:"extract_images"`
}

// ExtractionResult represents document extraction results
type ExtractionResult struct {
	Text         string                   `json:"text"`
	Tables       []ExtractedTable         `json:"tables,omitempty"`
	Images       []ExtractedImage         `json:"images,omitempty"`
	Metadata     map[string]interface{}   `json:"metadata,omitempty"`
	PageCount    int                      `json:"page_count,omitempty"`
	Language     string                   `json:"language,omitempty"`
	Confidence   float64                  `json:"confidence,omitempty"`
}

// ExtractedTable represents an extracted table
type ExtractedTable struct {
	PageNumber int                      `json:"page_number"`
	Headers    []string                 `json:"headers"`
	Rows       [][]string               `json:"rows"`
	Position   *TablePosition           `json:"position,omitempty"`
	Confidence float64                  `json:"confidence,omitempty"`
}

// TablePosition represents table position in document
type TablePosition struct {
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

// ExtractedImage represents an extracted image
type ExtractedImage struct {
	PageNumber int                      `json:"page_number"`
	URL        string                   `json:"url,omitempty"`
	Base64     string                   `json:"base64,omitempty"`
	Format     string                   `json:"format"`
	Width      int                      `json:"width"`
	Height     int                      `json:"height"`
	Position   *ImagePosition           `json:"position,omitempty"`
}

// ImagePosition represents image position in document
type ImagePosition struct {
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

// ExtractText extracts text from a document
func (d *DocumentClient) ExtractText(ctx context.Context, file io.Reader, filename string, extractTables, extractImages bool) (*ExtractionResult, error) {
	// Start tracing
	ctx, span := d.client.tracer.StartSpan(ctx, "extract_text")
	defer span.End()

	span.SetAttributes(
		attribute.String("document.filename", filename),
		attribute.Bool("extract.tables", extractTables),
		attribute.Bool("extract.images", extractImages),
	)

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"filename":       filename,
		"extract_tables": extractTables,
		"extract_images": extractImages,
	}).Info("Extracting text from document")

	// Prepare additional fields
	additionalFields := map[string]string{
		"extract_tables": fmt.Sprintf("%t", extractTables),
		"extract_images": fmt.Sprintf("%t", extractImages),
	}

	// Upload file and extract
	resp, err := d.client.httpClient.UploadFile(ctx, "/extract/text", file, filename, additionalFields)
	if err != nil {
		d.client.tracer.RecordError(span, err, "File upload failed")
		return nil, fmt.Errorf("failed to extract text: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		d.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		d.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse extraction result
	resultBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal result data: %w", err)
	}

	var result ExtractionResult
	if err := json.Unmarshal(resultBytes, &result); err != nil {
		return nil, fmt.Errorf("failed to parse extraction result: %w", err)
	}

	span.SetAttributes(
		attribute.Int("extraction.page_count", result.PageCount),
		attribute.Int("extraction.tables_count", len(result.Tables)),
		attribute.Int("extraction.images_count", len(result.Images)),
		attribute.Float64("extraction.confidence", result.Confidence),
	)

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"page_count":   result.PageCount,
		"tables_count": len(result.Tables),
		"images_count": len(result.Images),
		"confidence":   result.Confidence,
	}).Info("Text extraction completed")

	return &result, nil
}

// ExtractTables extracts tables from a document
func (d *DocumentClient) ExtractTables(ctx context.Context, file io.Reader, filename string) ([]ExtractedTable, error) {
	// Start tracing
	ctx, span := d.client.tracer.StartSpan(ctx, "extract_tables")
	defer span.End()

	span.SetAttributes(attribute.String("document.filename", filename))

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"filename": filename,
	}).Info("Extracting tables from document")

	// Upload file and extract
	resp, err := d.client.httpClient.UploadFile(ctx, "/extract/tables", file, filename, nil)
	if err != nil {
		d.client.tracer.RecordError(span, err, "File upload failed")
		return nil, fmt.Errorf("failed to extract tables: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		d.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		d.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse tables
	tablesBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal tables data: %w", err)
	}

	// Handle different response formats
	var tablesWrapper struct {
		Tables []ExtractedTable `json:"tables"`
	}
	if err := json.Unmarshal(tablesBytes, &tablesWrapper); err != nil {
		// Try parsing as direct array
		var tables []ExtractedTable
		if err := json.Unmarshal(tablesBytes, &tables); err != nil {
			return nil, fmt.Errorf("failed to parse tables: %w", err)
		}
		span.SetAttributes(attribute.Int("extraction.tables_count", len(tables)))
		return tables, nil
	}

	span.SetAttributes(attribute.Int("extraction.tables_count", len(tablesWrapper.Tables)))

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"tables_count": len(tablesWrapper.Tables),
	}).Info("Table extraction completed")

	return tablesWrapper.Tables, nil
}

// ExtractImages extracts images from a document
func (d *DocumentClient) ExtractImages(ctx context.Context, file io.Reader, filename string) ([]ExtractedImage, error) {
	// Start tracing
	ctx, span := d.client.tracer.StartSpan(ctx, "extract_images")
	defer span.End()

	span.SetAttributes(attribute.String("document.filename", filename))

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"filename": filename,
	}).Info("Extracting images from document")

	// Upload file and extract
	resp, err := d.client.httpClient.UploadFile(ctx, "/extract/images", file, filename, nil)
	if err != nil {
		d.client.tracer.RecordError(span, err, "File upload failed")
		return nil, fmt.Errorf("failed to extract images: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		d.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		d.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse images
	imagesBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal images data: %w", err)
	}

	// Handle different response formats
	var imagesWrapper struct {
		Images []ExtractedImage `json:"images"`
	}
	if err := json.Unmarshal(imagesBytes, &imagesWrapper); err != nil {
		// Try parsing as direct array
		var images []ExtractedImage
		if err := json.Unmarshal(imagesBytes, &images); err != nil {
			return nil, fmt.Errorf("failed to parse images: %w", err)
		}
		span.SetAttributes(attribute.Int("extraction.images_count", len(images)))
		return images, nil
	}

	span.SetAttributes(attribute.Int("extraction.images_count", len(imagesWrapper.Images)))

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"images_count": len(imagesWrapper.Images),
	}).Info("Image extraction completed")

	return imagesWrapper.Images, nil
}

// ExtractMetadata extracts metadata from a document
func (d *DocumentClient) ExtractMetadata(ctx context.Context, file io.Reader, filename string) (map[string]interface{}, error) {
	// Start tracing
	ctx, span := d.client.tracer.StartSpan(ctx, "extract_metadata")
	defer span.End()

	span.SetAttributes(attribute.String("document.filename", filename))

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"filename": filename,
	}).Info("Extracting metadata from document")

	// Upload file and extract
	resp, err := d.client.httpClient.UploadFile(ctx, "/extract/metadata", file, filename, nil)
	if err != nil {
		d.client.tracer.RecordError(span, err, "File upload failed")
		return nil, fmt.Errorf("failed to extract metadata: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		d.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		d.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse metadata
	metadataBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal metadata: %w", err)
	}

	var metadata map[string]interface{}
	if err := json.Unmarshal(metadataBytes, &metadata); err != nil {
		return nil, fmt.Errorf("failed to parse metadata: %w", err)
	}

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"metadata_fields": len(metadata),
	}).Info("Metadata extraction completed")

	return metadata, nil
}

// ParseStructuredDocument parses structured data from a document (e.g., forms, invoices)
func (d *DocumentClient) ParseStructuredDocument(ctx context.Context, file io.Reader, filename string, documentType string) (map[string]interface{}, error) {
	// Start tracing
	ctx, span := d.client.tracer.StartSpan(ctx, "parse_structured_document")
	defer span.End()

	span.SetAttributes(
		attribute.String("document.filename", filename),
		attribute.String("document.type", documentType),
	)

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"filename":      filename,
		"document_type": documentType,
	}).Info("Parsing structured document")

	// Prepare additional fields
	additionalFields := map[string]string{
		"document_type": documentType,
	}

	// Upload file and parse
	resp, err := d.client.httpClient.UploadFile(ctx, "/extract/structured", file, filename, additionalFields)
	if err != nil {
		d.client.tracer.RecordError(span, err, "File upload failed")
		return nil, fmt.Errorf("failed to parse structured document: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		d.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		d.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse structured data
	dataBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal structured data: %w", err)
	}

	var structuredData map[string]interface{}
	if err := json.Unmarshal(dataBytes, &structuredData); err != nil {
		return nil, fmt.Errorf("failed to parse structured data: %w", err)
	}

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"fields_extracted": len(structuredData),
	}).Info("Structured document parsing completed")

	return structuredData, nil
}

// OCRDocument performs OCR on a document
func (d *DocumentClient) OCRDocument(ctx context.Context, file io.Reader, filename string, language string) (*ExtractionResult, error) {
	// Start tracing
	ctx, span := d.client.tracer.StartSpan(ctx, "ocr_document")
	defer span.End()

	span.SetAttributes(
		attribute.String("document.filename", filename),
		attribute.String("ocr.language", language),
	)

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"filename": filename,
		"language": language,
	}).Info("Performing OCR on document")

	// Prepare additional fields
	additionalFields := map[string]string{
		"language": language,
	}

	// Upload file and perform OCR
	resp, err := d.client.httpClient.UploadFile(ctx, "/extract/ocr", file, filename, additionalFields)
	if err != nil {
		d.client.tracer.RecordError(span, err, "File upload failed")
		return nil, fmt.Errorf("failed to perform OCR: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		d.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		d.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse OCR result
	resultBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal result data: %w", err)
	}

	var result ExtractionResult
	if err := json.Unmarshal(resultBytes, &result); err != nil {
		return nil, fmt.Errorf("failed to parse OCR result: %w", err)
	}

	span.SetAttributes(
		attribute.Int("ocr.page_count", result.PageCount),
		attribute.Float64("ocr.confidence", result.Confidence),
	)

	d.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"page_count": result.PageCount,
		"confidence": result.Confidence,
		"language":   result.Language,
	}).Info("OCR completed")

	return &result, nil
}