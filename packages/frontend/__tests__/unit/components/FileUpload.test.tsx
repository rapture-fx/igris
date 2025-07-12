import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileUpload } from '@/components/upload/FileUpload';

// Mock the useAuth hook
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 1, email: 'test@example.com' },
    isAuthenticated: true,
  }),
}));

// Mock the API call
jest.mock('@/lib/api', () => ({
  uploadFile: jest.fn(),
}));

describe('FileUpload Component', () => {
  const mockUploadFile = require('@/lib/api').uploadFile;
  const mockOnUploadComplete = jest.fn();
  const mockOnError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders upload area correctly', () => {
    render(
      <FileUpload
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
        acceptedFileTypes={['.csv', '.xlsx']}
        maxFileSize={10485760}
      />
    );

    expect(screen.getByText(/drag and drop/i)).toBeInTheDocument();
    expect(screen.getByText(/or click to browse/i)).toBeInTheDocument();
    expect(screen.getByText(/CSV, XLSX files up to 10MB/i)).toBeInTheDocument();
  });

  it('handles file selection via click', async () => {
    const user = userEvent.setup();
    mockUploadFile.mockResolvedValue({
      success: true,
      file_id: 'test-file-id',
      message: 'File uploaded successfully',
    });

    render(
      <FileUpload
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
        acceptedFileTypes={['.csv']}
        maxFileSize={10485760}
      />
    );

    const file = new File(['test content'], 'test.csv', { type: 'text/csv' });
    const input = screen.getByLabelText(/file input/i);

    await user.upload(input, file);

    await waitFor(() => {
      expect(mockUploadFile).toHaveBeenCalledWith(file);
    });

    await waitFor(() => {
      expect(mockOnUploadComplete).toHaveBeenCalledWith({
        file_id: 'test-file-id',
        message: 'File uploaded successfully',
      });
    });
  });

  it('handles drag and drop', async () => {
    mockUploadFile.mockResolvedValue({
      success: true,
      file_id: 'test-file-id',
      message: 'File uploaded successfully',
    });

    render(
      <FileUpload
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
        acceptedFileTypes={['.csv']}
        maxFileSize={10485760}
      />
    );

    const file = new File(['test content'], 'test.csv', { type: 'text/csv' });
    const dropZone = screen.getByTestId('drop-zone');

    fireEvent.dragEnter(dropZone);
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [file],
      },
    });

    await waitFor(() => {
      expect(mockUploadFile).toHaveBeenCalledWith(file);
    });
  });

  it('shows upload progress', async () => {
    const user = userEvent.setup();
    mockUploadFile.mockImplementation(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            success: true,
            file_id: 'test-file-id',
            message: 'File uploaded successfully',
          });
        }, 100);
      });
    });

    render(
      <FileUpload
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
        acceptedFileTypes={['.csv']}
        maxFileSize={10485760}
      />
    );

    const file = new File(['test content'], 'test.csv', { type: 'text/csv' });
    const input = screen.getByLabelText(/file input/i);

    await user.upload(input, file);

    expect(screen.getByText(/uploading/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('handles file type validation', async () => {
    const user = userEvent.setup();

    render(
      <FileUpload
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
        acceptedFileTypes={['.csv']}
        maxFileSize={10485760}
      />
    );

    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const input = screen.getByLabelText(/file input/i);

    await user.upload(input, file);

    expect(mockOnError).toHaveBeenCalledWith(
      expect.stringContaining('file type')
    );
    expect(mockUploadFile).not.toHaveBeenCalled();
  });

  it('handles file size validation', async () => {
    const user = userEvent.setup();

    render(
      <FileUpload
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
        acceptedFileTypes={['.csv']}
        maxFileSize={100} // 100 bytes
      />
    );

    // Create a file larger than the limit
    const largeContent = 'x'.repeat(200);
    const file = new File([largeContent], 'large.csv', { type: 'text/csv' });
    const input = screen.getByLabelText(/file input/i);

    await user.upload(input, file);

    expect(mockOnError).toHaveBeenCalledWith(
      expect.stringContaining('file size')
    );
    expect(mockUploadFile).not.toHaveBeenCalled();
  });

  it('handles upload errors', async () => {
    const user = userEvent.setup();
    const errorMessage = 'Upload failed';
    mockUploadFile.mockRejectedValue(new Error(errorMessage));

    render(
      <FileUpload
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
        acceptedFileTypes={['.csv']}
        maxFileSize={10485760}
      />
    );

    const file = new File(['test content'], 'test.csv', { type: 'text/csv' });
    const input = screen.getByLabelText(/file input/i);

    await user.upload(input, file);

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith(errorMessage);
    });
  });

  it('handles multiple file uploads', async () => {
    const user = userEvent.setup();
    mockUploadFile
      .mockResolvedValueOnce({
        success: true,
        file_id: 'file-1',
        message: 'File 1 uploaded successfully',
      })
      .mockResolvedValueOnce({
        success: true,
        file_id: 'file-2',
        message: 'File 2 uploaded successfully',
      });

    render(
      <FileUpload
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
        acceptedFileTypes={['.csv']}
        maxFileSize={10485760}
        multiple={true}
      />
    );

    const file1 = new File(['content 1'], 'file1.csv', { type: 'text/csv' });
    const file2 = new File(['content 2'], 'file2.csv', { type: 'text/csv' });
    const input = screen.getByLabelText(/file input/i);

    await user.upload(input, [file1, file2]);

    await waitFor(() => {
      expect(mockUploadFile).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(mockOnUploadComplete).toHaveBeenCalledTimes(2);
    });
  });

  it('shows drag overlay when dragging over', () => {
    render(
      <FileUpload
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
        acceptedFileTypes={['.csv']}
        maxFileSize={10485760}
      />
    );

    const dropZone = screen.getByTestId('drop-zone');

    fireEvent.dragEnter(dropZone);

    expect(screen.getByTestId('drag-overlay')).toHaveClass('opacity-100');
  });

  it('hides drag overlay when dragging leaves', () => {
    render(
      <FileUpload
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
        acceptedFileTypes={['.csv']}
        maxFileSize={10485760}
      />
    );

    const dropZone = screen.getByTestId('drop-zone');

    fireEvent.dragEnter(dropZone);
    fireEvent.dragLeave(dropZone);

    expect(screen.getByTestId('drag-overlay')).toHaveClass('opacity-0');
  });

  it('disables upload when disabled prop is true', () => {
    render(
      <FileUpload
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
        acceptedFileTypes={['.csv']}
        maxFileSize={10485760}
        disabled={true}
      />
    );

    const input = screen.getByLabelText(/file input/i);
    expect(input).toBeDisabled();
  });

  it('shows custom upload text when provided', () => {
    const customText = 'Custom upload message';
    render(
      <FileUpload
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
        acceptedFileTypes={['.csv']}
        maxFileSize={10485760}
        uploadText={customText}
      />
    );

    expect(screen.getByText(customText)).toBeInTheDocument();
  });

  it('handles file upload with custom headers', async () => {
    const user = userEvent.setup();
    mockUploadFile.mockResolvedValue({
      success: true,
      file_id: 'test-file-id',
      message: 'File uploaded successfully',
    });

    const customHeaders = { 'X-Custom-Header': 'custom-value' };

    render(
      <FileUpload
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
        acceptedFileTypes={['.csv']}
        maxFileSize={10485760}
        headers={customHeaders}
      />
    );

    const file = new File(['test content'], 'test.csv', { type: 'text/csv' });
    const input = screen.getByLabelText(/file input/i);

    await user.upload(input, file);

    await waitFor(() => {
      expect(mockUploadFile).toHaveBeenCalledWith(file, customHeaders);
    });
  });
}); 