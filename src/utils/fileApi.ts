const API_BASE_URL = import.meta.env.DEV ? '' : 'http://localhost:3001';

export interface FileInfo {
  name: string;
  size: number;
  modified: string;
}

export interface CheckFilesResponse {
  existingFiles: string[];
}

export interface UploadResponse {
  message: string;
  files: Array<{
    name: string;
    size: number;
    path: string;
  }>;
}

/**
 * Check if files exist on the server
 */
export async function checkFilesExist(filenames: string[]): Promise<string[]> {
  const response = await fetch(`${API_BASE_URL}/api/files/check`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ filenames }),
  });

  if (!response.ok) {
    throw new Error('Failed to check files');
  }

  const data: CheckFilesResponse = await response.json();
  return data.existingFiles;
}

/**
 * List all files on the server
 */
export async function listFiles(): Promise<FileInfo[]> {
  const response = await fetch(`${API_BASE_URL}/api/files`);

  if (!response.ok) {
    throw new Error('Failed to list files');
  }

  const data = await response.json();
  return data.files;
}

/**
 * Upload files to the server
 */
export async function uploadFiles(files: File[]): Promise<UploadResponse> {
  const formData = new FormData();
  files.forEach(file => {
    formData.append('files', file);
  });

  const response = await fetch(`${API_BASE_URL}/api/files/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to upload files');
  }

  return response.json();
}

/**
 * Download a file from the server
 */
export async function downloadFile(filename: string): Promise<File> {
  const response = await fetch(`${API_BASE_URL}/files/${filename}`);

  if (!response.ok) {
    throw new Error(`Failed to download file: ${filename}`);
  }

  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type });
}

/**
 * Delete a file from the server
 */
export async function deleteFile(filename: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/files/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`Failed to delete file: ${filename}`);
  }
}

