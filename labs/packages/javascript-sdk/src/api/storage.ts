/**
 * Storage API for Igris-engine JavaScript SDK
 */

import { BaseAPI } from './base';
import { APIResponse, FileUpload } from '../types/common';
import { ProgressCallback } from '../types/common';

/**
 * File metadata interface
 */
export interface FileMetadata {
  file_id: string;
  filename: string;
  size: number;
  content_type: string;
  upload_date: string;
  last_modified: string;
  tags: string[];
  metadata: Record<string, unknown>;
  download_url?: string;
  preview_url?: string;
}

/**
 * Storage configuration interface
 */
export interface StorageConfig {
  max_file_size: number;
  allowed_extensions: string[];
  storage_quota: number;
  used_storage: number;
}

/**
 * Storage API client
 * Provides methods for file storage, management, and retrieval
 */
export class StorageAPI extends BaseAPI {
  constructor(client: any) {
    super(client);
    this.basePath = '/storage';
  }

  /**
   * Upload file to storage
   */
  async uploadFile(
    file: File | Blob,
    options: {
      filename?: string;
      tags?: string[];
      metadata?: Record<string, unknown>;
      folder?: string;
      onProgress?: ProgressCallback;
    } = {}
  ): Promise<APIResponse<FileMetadata>> {
    const additionalParams: Record<string, unknown> = {};
    
    if (options.filename) additionalParams.filename = options.filename;
    if (options.tags) additionalParams.tags = JSON.stringify(options.tags);
    if (options.metadata) additionalParams.metadata = JSON.stringify(options.metadata);
    if (options.folder) additionalParams.folder = options.folder;

    return super.uploadFile<FileMetadata>('/files', file, additionalParams, options.onProgress);
  }

  /**
   * Upload multiple files
   */
  async uploadMultipleFiles(
    files: File[],
    options: {
      folder?: string;
      onProgress?: (fileIndex: number, progress: number, filename: string) => void;
      onFileComplete?: (fileIndex: number, result: FileMetadata, filename: string) => void;
    } = {}
  ): Promise<APIResponse<FileMetadata[]>> {
    const results: FileMetadata[] = [];
    const errors: Array<{ filename: string; error: string }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        const response = await this.uploadFile(file, {
          folder: options.folder,
          onProgress: (progress) => {
            options.onProgress?.(i, progress, file.name);
          }
        });

        if (this.isSuccess(response)) {
          results.push(response.data);
          options.onFileComplete?.(i, response.data, file.name);
        } else {
          errors.push({ 
            filename: file.name, 
            error: this.getErrorMessage(response) 
          });
        }
      } catch (error) {
        errors.push({ 
          filename: file.name, 
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        message: `${errors.length} files failed to upload`,
        data: results,
        errors
      } as any;
    }

    return {
      success: true,
      data: results,
      message: `${results.length} files uploaded successfully`
    };
  }

  /**
   * Get file metadata
   */
  async getFile(fileId: string): Promise<APIResponse<FileMetadata>> {
    this.validateRequired({ fileId }, ['fileId']);
    return this.get<FileMetadata>(`/files/${fileId}`);
  }

  /**
   * Update file metadata
   */
  async updateFile(
    fileId: string,
    updates: {
      filename?: string;
      tags?: string[];
      metadata?: Record<string, unknown>;
    }
  ): Promise<APIResponse<FileMetadata>> {
    this.validateRequired({ fileId }, ['fileId']);
    return this.patch<FileMetadata>(`/files/${fileId}`, { params: updates });
  }

  /**
   * Delete file
   */
  async deleteFile(fileId: string): Promise<APIResponse<{ message: string }>> {
    this.validateRequired({ fileId }, ['fileId']);
    return this.delete<{ message: string }>(`/files/${fileId}`);
  }

  /**
   * Delete multiple files
   */
  async deleteMultipleFiles(fileIds: string[]): Promise<APIResponse<{
    deleted_count: number;
    failed_deletions: Array<{ file_id: string; error: string }>;
  }>> {
    this.validateRequired({ fileIds }, ['fileIds']);
    return this.post<{
      deleted_count: number;
      failed_deletions: Array<{ file_id: string; error: string }>;
    }>('/files/batch-delete', {
      params: { file_ids: fileIds }
    });
  }

  /**
   * List files
   */
  async listFiles(params?: {
    page?: number;
    pageSize?: number;
    folder?: string;
    tags?: string[];
    contentType?: string;
    search?: string;
    sortBy?: 'filename' | 'upload_date' | 'size' | 'last_modified';
    sortOrder?: 'asc' | 'desc';
  }): Promise<APIResponse<FileMetadata[]>> {
    const queryParams = params ? this.buildQueryParams(params) : {};
    return this.paginatedRequest<FileMetadata>('/files', queryParams);
  }

  /**
   * Search files
   */
  async searchFiles(
    query: string,
    params?: {
      page?: number;
      pageSize?: number;
      folder?: string;
      tags?: string[];
      contentType?: string;
    }
  ): Promise<APIResponse<FileMetadata[]>> {
    this.validateRequired({ query }, ['query']);
    
    const queryParams = {
      q: query,
      ...this.buildQueryParams(params || {})
    };

    return this.paginatedRequest<FileMetadata>('/files/search', queryParams);
  }

  /**
   * Get file download URL
   */
  getDownloadUrl(fileId: string, options?: {
    inline?: boolean;
    expiresIn?: number;
  }): string {
    this.validateRequired({ fileId }, ['fileId']);
    
    const params: Record<string, string> = {};
    if (options?.inline) params.inline = 'true';
    if (options?.expiresIn) params.expires_in = options.expiresIn.toString();

    return this.buildDownloadUrl(`/files/${fileId}/download`, params);
  }

  /**
   * Get file preview URL (for images, documents)
   */
  getPreviewUrl(fileId: string, options?: {
    width?: number;
    height?: number;
    quality?: number;
  }): string {
    this.validateRequired({ fileId }, ['fileId']);
    
    const params: Record<string, string> = {};
    if (options?.width) params.width = options.width.toString();
    if (options?.height) params.height = options.height.toString();
    if (options?.quality) params.quality = options.quality.toString();

    return this.buildDownloadUrl(`/files/${fileId}/preview`, params);
  }

  /**
   * Create folder
   */
  async createFolder(name: string, parentFolder?: string): Promise<APIResponse<{
    folder_id: string;
    name: string;
    path: string;
    created_at: string;
  }>> {
    this.validateRequired({ name }, ['name']);
    return this.post<{
      folder_id: string;
      name: string;
      path: string;
      created_at: string;
    }>('/folders', {
      params: { name, parent_folder: parentFolder }
    });
  }

  /**
   * List folders
   */
  async listFolders(parentFolder?: string): Promise<APIResponse<Array<{
    folder_id: string;
    name: string;
    path: string;
    file_count: number;
    created_at: string;
  }>>> {
    const params = parentFolder ? { parent_folder: parentFolder } : {};
    return this.get('/folders', { params });
  }

  /**
   * Rename folder
   */
  async renameFolder(folderId: string, newName: string): Promise<APIResponse<{
    folder_id: string;
    name: string;
    path: string;
  }>> {
    this.validateRequired({ folderId, newName }, ['folderId', 'newName']);
    return this.patch<{
      folder_id: string;
      name: string;
      path: string;
    }>(`/folders/${folderId}`, {
      params: { name: newName }
    });
  }

  /**
   * Delete folder
   */
  async deleteFolder(folderId: string, deleteContents = false): Promise<APIResponse<{ message: string }>> {
    this.validateRequired({ folderId }, ['folderId']);
    return this.delete<{ message: string }>(`/folders/${folderId}`, {
      params: { delete_contents: deleteContents }
    });
  }

  /**
   * Move file to folder
   */
  async moveFile(fileId: string, targetFolderId?: string): Promise<APIResponse<FileMetadata>> {
    this.validateRequired({ fileId }, ['fileId']);
    return this.patch<FileMetadata>(`/files/${fileId}/move`, {
      params: { target_folder_id: targetFolderId }
    });
  }

  /**
   * Copy file
   */
  async copyFile(fileId: string, targetFolderId?: string, newName?: string): Promise<APIResponse<FileMetadata>> {
    this.validateRequired({ fileId }, ['fileId']);
    return this.post<FileMetadata>(`/files/${fileId}/copy`, {
      params: { 
        target_folder_id: targetFolderId,
        new_name: newName
      }
    });
  }

  /**
   * Get storage usage statistics
   */
  async getStorageStats(): Promise<APIResponse<{
    total_files: number;
    total_size: number;
    used_storage: number;
    storage_quota: number;
    files_by_type: Record<string, number>;
    files_by_month: Array<{ month: string; count: number; size: number }>;
  }>> {
    return this.get('/stats');
  }

  /**
   * Get storage configuration
   */
  async getStorageConfig(): Promise<APIResponse<StorageConfig>> {
    return this.get('/config');
  }

  /**
   * Create shareable link for file
   */
  async createShareLink(
    fileId: string,
    options: {
      expiresAt?: string;
      password?: string;
      allowDownload?: boolean;
      allowPreview?: boolean;
    } = {}
  ): Promise<APIResponse<{
    link_id: string;
    share_url: string;
    expires_at?: string;
    created_at: string;
  }>> {
    this.validateRequired({ fileId }, ['fileId']);
    return this.post<{
      link_id: string;
      share_url: string;
      expires_at?: string;
      created_at: string;
    }>(`/files/${fileId}/share`, {
      params: options
    });
  }

  /**
   * List share links for file
   */
  async getShareLinks(fileId: string): Promise<APIResponse<Array<{
    link_id: string;
    share_url: string;
    expires_at?: string;
    created_at: string;
    access_count: number;
    is_active: boolean;
  }>>> {
    this.validateRequired({ fileId }, ['fileId']);
    return this.get(`/files/${fileId}/share`);
  }

  /**
   * Revoke share link
   */
  async revokeShareLink(linkId: string): Promise<APIResponse<{ message: string }>> {
    this.validateRequired({ linkId }, ['linkId']);
    return this.delete<{ message: string }>(`/share/${linkId}`);
  }

  /**
   * Get file versions (if versioning is enabled)
   */
  async getFileVersions(fileId: string): Promise<APIResponse<Array<{
    version_id: string;
    version_number: number;
    size: number;
    created_at: string;
    created_by: string;
    is_current: boolean;
  }>>> {
    this.validateRequired({ fileId }, ['fileId']);
    return this.get(`/files/${fileId}/versions`);
  }

  /**
   * Restore file version
   */
  async restoreFileVersion(fileId: string, versionId: string): Promise<APIResponse<FileMetadata>> {
    this.validateRequired({ fileId, versionId }, ['fileId', 'versionId']);
    return this.post<FileMetadata>(`/files/${fileId}/versions/${versionId}/restore`);
  }

  /**
   * Cleanup unused files
   */
  async cleanupUnusedFiles(olderThanDays: number): Promise<APIResponse<{
    deleted_files_count: number;
    freed_space: number;
    cleanup_summary: Record<string, number>;
  }>> {
    this.validateRequired({ olderThanDays }, ['olderThanDays']);
    return this.post<{
      deleted_files_count: number;
      freed_space: number;
      cleanup_summary: Record<string, number>;
    }>('/cleanup', {
      params: { older_than_days: olderThanDays }
    });
  }
}

export default StorageAPI;