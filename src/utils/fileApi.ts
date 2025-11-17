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
 * @param filename - The name of the file to download
 * @param noCache - If true, adds cache-busting query parameter to ensure fresh download
 */
export async function downloadFile(filename: string, noCache: boolean = false): Promise<File> {
  const url = noCache 
    ? `${API_BASE_URL}/files/${filename}?t=${Date.now()}`
    : `${API_BASE_URL}/files/${filename}`;
  
  const response = await fetch(url, {
    cache: noCache ? 'no-store' : 'default',
  });

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

/**
 * Check if a file is an image file
 */
function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * Scale an image file and return a new File with the scaled image
 * @param imageFile - The original image file
 * @param scale - The scale factor (e.g., 1.5 for 150%)
 * @returns A new File with the scaled image
 */
export async function scaleImageFile(imageFile: File, scale: number): Promise<File> {
  if (scale === 1) {
    return imageFile;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(imageFile);
    
    img.onload = () => {
      // Clean up the object URL
      URL.revokeObjectURL(objectUrl);
      
      // Calculate scaled dimensions
      const scaledWidth = Math.round(img.width * scale);
      const scaledHeight = Math.round(img.height * scale);

      // Create canvas and draw scaled image
      const canvas = document.createElement('canvas');
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Use high-quality image scaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Draw the scaled image
      ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);

      // Convert to blob and create File
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to create blob'));
          return;
        }
        
        // Preserve original filename and type
        const scaledFile = new File([blob], imageFile.name, { 
          type: imageFile.type || 'image/png',
          lastModified: imageFile.lastModified 
        });
        resolve(scaledFile);
      }, imageFile.type || 'image/png');
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };
    
    img.src = objectUrl;
  });
}

