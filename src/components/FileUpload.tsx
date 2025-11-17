import { useState } from 'react';
import { checkFilesExist, uploadFiles } from '../utils/fileApi';
import { OverwriteWarningDialog } from './OverwriteWarningDialog';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
}

export function FileUpload({ onFilesSelected }: FileUploadProps) {
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<string[]>([]);
  const [showWarning, setShowWarning] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) {
      return;
    }

    // Reset input so the same files can be selected again if needed
    e.target.value = '';

    try {
      // Check if any files already exist
      const filenames = files.map(f => f.name);
      const existing = await checkFilesExist(filenames);

      if (existing.length > 0) {
        // Show warning dialog
        setExistingFiles(existing);
        setPendingFiles(files);
        setShowWarning(true);
      } else {
        // No conflicts, proceed with upload
        await proceedWithUpload(files);
      }
    } catch (error) {
      console.error('Error checking files:', error);
      // If check fails, proceed anyway (server might be down)
      await proceedWithUpload(files);
    }
  };

  const proceedWithUpload = async (files: File[]) => {
    try {
      // Upload files to server
      await uploadFiles(files);
      // Notify parent component
      onFilesSelected(files);
    } catch (error) {
      console.error('Error uploading files:', error);
      // Even if upload fails, still notify parent (for offline mode)
      onFilesSelected(files);
    }
  };

  const handleConfirm = async () => {
    setShowWarning(false);
    await proceedWithUpload(pendingFiles);
    setPendingFiles([]);
    setExistingFiles([]);
  };

  const handleCancel = () => {
    setShowWarning(false);
    setPendingFiles([]);
    setExistingFiles([]);
  };

  return (
    <>
      <div className="file-upload">
        <div className="upload-group">
          <label htmlFor="file-upload">Upload Files (Images & XML)</label>
          <input
            id="file-upload"
            type="file"
            accept="image/*,.xml,text/xml"
            multiple
            onChange={handleFileChange}
          />
        </div>
      </div>
      {showWarning && (
        <OverwriteWarningDialog
          existingFiles={existingFiles}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </>
  );
}

