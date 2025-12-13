package client

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strings"

	"github.com/igris-inertial/go-sdk/pkg/models"
	"go.opentelemetry.io/otel/attribute"
)

// StorageClient handles file storage operations
type StorageClient struct {
	client *Client
}

// NewStorageClient creates a new storage client
func NewStorageClient(client *Client) *StorageClient {
	return &StorageClient{
		client: client,
	}
}

// UploadFile uploads a file to storage
func (s *StorageClient) UploadFile(ctx context.Context, file io.Reader, filename string, metadata map[string]string) (*models.FileUpload, error) {
	// Start tracing
	ctx, span := s.client.tracer.StartSpan(ctx, "upload_file")
	defer span.End()

	span.SetAttributes(attribute.String("file.name", filename))

	s.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"filename": filename,
		"metadata": metadata,
	}).Info("Uploading file to storage")

	// Upload file using HTTP client
	resp, err := s.client.httpClient.UploadFile(ctx, "/storage/upload", file, filename, metadata)
	if err != nil {
		s.client.tracer.RecordError(span, err, "File upload failed")
		return nil, fmt.Errorf("failed to upload file: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		s.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		s.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse file upload result
	uploadBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal upload data: %w", err)
	}

	var upload models.FileUpload
	if err := json.Unmarshal(uploadBytes, &upload); err != nil {
		return nil, fmt.Errorf("failed to parse upload result: %w", err)
	}

	span.SetAttributes(
		attribute.String("file.id", upload.ID),
		attribute.Int64("file.size", upload.Size),
		attribute.String("file.content_type", upload.ContentType),
	)

	s.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"file_id":      upload.ID,
		"filename":     upload.Filename,
		"file_size":    upload.Size,
		"content_type": upload.ContentType,
		"url":          upload.URL,
	}).Info("File uploaded successfully")

	return &upload, nil
}

// GetFile retrieves file information
func (s *StorageClient) GetFile(ctx context.Context, fileID string) (*models.FileUpload, error) {
	// Start tracing
	ctx, span := s.client.tracer.StartSpan(ctx, "get_file")
	defer span.End()

	span.SetAttributes(attribute.String("file.id", fileID))

	// Make API request
	path := fmt.Sprintf("/storage/files/%s", fileID)
	resp, err := s.client.Get(ctx, path)
	if err != nil {
		s.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to get file: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		s.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		s.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	// Parse file
	fileBytes, err := json.Marshal(apiResp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal file data: %w", err)
	}

	var file models.FileUpload
	if err := json.Unmarshal(fileBytes, &file); err != nil {
		return nil, fmt.Errorf("failed to parse file: %w", err)
	}

	s.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"file_id":      file.ID,
		"filename":     file.Filename,
		"file_size":    file.Size,
		"content_type": file.ContentType,
	}).Debug("Retrieved file information")

	return &file, nil
}

// DownloadFile downloads a file from storage
func (s *StorageClient) DownloadFile(ctx context.Context, fileID string) (io.ReadCloser, error) {
	// Start tracing
	ctx, span := s.client.tracer.StartSpan(ctx, "download_file")
	defer span.End()

	span.SetAttributes(attribute.String("file.id", fileID))

	s.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"file_id": fileID,
	}).Info("Downloading file from storage")

	// Make API request
	path := fmt.Sprintf("/storage/files/%s/download", fileID)
	resp, err := s.client.Get(ctx, path)
	if err != nil {
		s.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to download file: %w", err)
	}

	if resp.StatusCode >= 400 {
		err := fmt.Errorf("download failed with status %d", resp.StatusCode)
		s.client.tracer.RecordError(span, err, "Download failed")
		return nil, err
	}

	// Return response body as ReadCloser
	// Note: In a real implementation, you'd want to wrap this to handle closing properly
	s.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"file_id":   fileID,
		"file_size": len(resp.Body),
	}).Info("File download completed")

	// For this example, we'll return a simple reader
	// In production, you'd want to return an actual ReadCloser
	return io.NopCloser(strings.NewReader(string(resp.Body))), nil
}

// ListFiles lists files in storage
func (s *StorageClient) ListFiles(ctx context.Context, opts *models.ListOptions) (*models.PaginatedResponse, error) {
	// Start tracing
	ctx, span := s.client.tracer.StartSpan(ctx, "list_files")
	defer span.End()

	// Build query parameters
	params := make(map[string]string)
	if opts != nil {
		if opts.Page > 0 {
			params["page"] = fmt.Sprintf("%d", opts.Page)
		}
		if opts.PerPage > 0 {
			params["per_page"] = fmt.Sprintf("%d", opts.PerPage)
		}
		if opts.SortBy != "" {
			params["sort_by"] = opts.SortBy
		}
		if opts.SortOrder != "" {
			params["sort_order"] = opts.SortOrder
		}
		if opts.Search != "" {
			params["search"] = opts.Search
		}
		// Add filters
		for key, value := range opts.Filters {
			params["filter_"+key] = value
		}
	}

	// Build path with query parameters
	path := "/storage/files"
	if len(params) > 0 {
		path += "?"
		first := true
		for key, value := range params {
			if !first {
				path += "&"
			}
			path += fmt.Sprintf("%s=%s", key, value)
			first = false
		}
	}

	// Make API request
	resp, err := s.client.Get(ctx, path)
	if err != nil {
		s.client.tracer.RecordError(span, err, "API request failed")
		return nil, fmt.Errorf("failed to list files: %w", err)
	}

	// Parse response
	var result models.PaginatedResponse
	if err := json.Unmarshal(resp.Body, &result); err != nil {
		s.client.tracer.RecordError(span, err, "Failed to parse response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !result.Success {
		err := fmt.Errorf("API error: %s", result.Error)
		s.client.tracer.RecordError(span, err, "API returned error")
		return nil, err
	}

	span.SetAttributes(
		attribute.Int("files.total", result.Pagination.Total),
		attribute.Int("files.page", result.Pagination.Page),
	)

	s.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"total_files": result.Pagination.Total,
		"page":        result.Pagination.Page,
		"per_page":    result.Pagination.PerPage,
	}).Debug("Listed files")

	return &result, nil
}

// DeleteFile deletes a file from storage
func (s *StorageClient) DeleteFile(ctx context.Context, fileID string) error {
	// Start tracing
	ctx, span := s.client.tracer.StartSpan(ctx, "delete_file")
	defer span.End()

	span.SetAttributes(attribute.String("file.id", fileID))

	s.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"file_id": fileID,
	}).Info("Deleting file from storage")

	// Make API request
	path := fmt.Sprintf("/storage/files/%s", fileID)
	resp, err := s.client.Delete(ctx, path)
	if err != nil {
		s.client.tracer.RecordError(span, err, "API request failed")
		return fmt.Errorf("failed to delete file: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		s.client.tracer.RecordError(span, err, "Failed to parse response")
		return fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		s.client.tracer.RecordError(span, err, "API returned error")
		return err
	}

	s.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"file_id": fileID,
	}).Info("File deleted successfully")

	return nil
}

// GetDownloadURL generates a temporary download URL for a file
func (s *StorageClient) GetDownloadURL(ctx context.Context, fileID string, expiresIn int) (string, error) {
	// Start tracing
	ctx, span := s.client.tracer.StartSpan(ctx, "get_download_url")
	defer span.End()

	span.SetAttributes(
		attribute.String("file.id", fileID),
		attribute.Int("url.expires_in", expiresIn),
	)

	// Make API request
	path := fmt.Sprintf("/storage/files/%s/download-url", fileID)
	if expiresIn > 0 {
		path += fmt.Sprintf("?expires_in=%d", expiresIn)
	}

	resp, err := s.client.Get(ctx, path)
	if err != nil {
		s.client.tracer.RecordError(span, err, "API request failed")
		return "", fmt.Errorf("failed to get download URL: %w", err)
	}

	// Parse response
	var apiResp models.APIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		s.client.tracer.RecordError(span, err, "Failed to parse response")
		return "", fmt.Errorf("failed to parse response: %w", err)
	}

	if !apiResp.Success {
		err := fmt.Errorf("API error: %s", apiResp.Error)
		s.client.tracer.RecordError(span, err, "API returned error")
		return "", err
	}

	// Extract URL from response
	urlData, ok := apiResp.Data.(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("invalid response data format")
	}

	url, ok := urlData["url"].(string)
	if !ok {
		return "", fmt.Errorf("invalid URL in response")
	}

	s.client.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"file_id":    fileID,
		"expires_in": expiresIn,
	}).Debug("Generated download URL")

	return url, nil
}