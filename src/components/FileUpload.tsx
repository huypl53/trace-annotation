import { useState } from 'react';
import { checkFilesExist, uploadFiles, scaleImageFile } from '../utils/fileApi';
import { OverwriteWarningDialog } from './OverwriteWarningDialog';
import { convertJsonFilesToXml, isJsonFile, ConversionResult } from '../utils/json2xmlConverter';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
}

export function FileUpload({ onFilesSelected }: FileUploadProps) {
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<string[]>([]);
  const [showWarning, setShowWarning] = useState(false);
  const [conversionResult, setConversionResult] = useState<ConversionResult | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [imageScale, setImageScale] = useState<string>('1');
  const [isScaling, setIsScaling] = useState(false);

  const isImageFile = (file: File): boolean => {
    return file.type.startsWith('image/');
  };

  const scaleImages = async (files: File[], scale: number): Promise<File[]> => {
    if (scale === 1) {
      return files;
    }

    setIsScaling(true);
    try {
      const scaledFiles = await Promise.all(
        files.map(async (file) => {
          if (isImageFile(file)) {
            return await scaleImageFile(file, scale);
          }
          return file;
        })
      );
      return scaledFiles;
    } finally {
      setIsScaling(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) {
      return;
    }

    // Reset input so the same files can be selected again if needed
    e.target.value = '';

    // Clear previous conversion result
    setConversionResult(null);

    try {
      // Get scale factor
      const scale = parseFloat(imageScale) || 1;
      
      // Separate JSON files from other files
      const jsonFiles = files.filter(isJsonFile);
      const otherFiles = files.filter(f => !isJsonFile(f));

      // Scale image files if scale is not 1
      const scaledFiles = await scaleImages(otherFiles, scale);

      // Convert JSON files to XML
      let convertedXmlFiles: File[] = [];
      if (jsonFiles.length > 0) {
        setIsConverting(true);
        setConversionResult(null);
        
        try {
          const result = await convertJsonFilesToXml(jsonFiles, files);
          setConversionResult(result);
          
          if (result.success && result.xmlFiles.length > 0) {
            convertedXmlFiles = result.xmlFiles;
          }
        } catch (error) {
          console.error('Error converting JSON to XML:', error);
          setConversionResult({
            success: false,
            xmlFiles: [],
            message: `Failed to convert JSON files: ${error}`,
            tablesProcessed: 0,
            errors: [String(error)],
          });
        } finally {
          setIsConverting(false);
        }
      }

      // Combine scaled files with converted XML files
      const allFiles = [...scaledFiles, ...convertedXmlFiles];

      if (allFiles.length === 0) {
        // Only JSON files were uploaded but conversion failed
        return;
      }

      // Check if any files already exist
      const filenames = allFiles.map(f => f.name);
      const existing = await checkFilesExist(filenames);

      if (existing.length > 0) {
        // Show warning dialog
        setExistingFiles(existing);
        setPendingFiles(allFiles);
        setShowWarning(true);
      } else {
        // No conflicts, proceed with upload
        await proceedWithUpload(allFiles);
      }
    } catch (error) {
      console.error('Error checking files:', error);
      // If check fails, proceed anyway (server might be down)
      const jsonFiles = files.filter(isJsonFile);
      const otherFiles = files.filter(f => !isJsonFile(f));
      const scale = parseFloat(imageScale) || 1;
      const scaledFiles = await scaleImages(otherFiles, scale);
      
      if (jsonFiles.length > 0) {
        setIsConverting(true);
        try {
          const result = await convertJsonFilesToXml(jsonFiles, files);
          setConversionResult(result);
          const allFiles = [...scaledFiles, ...result.xmlFiles];
          await proceedWithUpload(allFiles);
        } catch (convError) {
          console.error('Error converting JSON:', convError);
          await proceedWithUpload(scaledFiles);
        } finally {
          setIsConverting(false);
        }
      } else {
        await proceedWithUpload(scaledFiles);
      }
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
    // Scale images in pending files if needed
    const scale = parseFloat(imageScale) || 1;
    const scaledPendingFiles = await scaleImages(pendingFiles, scale);
    await proceedWithUpload(scaledPendingFiles);
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
          <label htmlFor="file-upload">Upload Files (Images, XML & JSON)</label>
          <input
            id="file-upload"
            type="file"
            accept="image/*,.xml,text/xml,.json,application/json"
            multiple
            onChange={handleFileChange}
            disabled={isConverting || isScaling}
          />
          <div className="scale-input-group">
            <label className="scale-input-label">
              <span>Image Scale Factor:</span>
              <input
                type="number"
                value={imageScale}
                onChange={(e) => setImageScale(e.target.value)}
                disabled={isConverting || isScaling}
                className="scale-input"
                min="0.01"
                max="10"
                step="0.01"
                placeholder="1.0"
                title="Scale factor to apply to images before upload (e.g., 1.5 for 150%)"
              />
            </label>
          </div>
          {isConverting && (
            <div className="conversion-status">
              <span>Converting JSON to XML...</span>
            </div>
          )}
          {isScaling && (
            <div className="conversion-status">
              <span>Scaling images...</span>
            </div>
          )}
        </div>
      </div>
      {conversionResult && (
        <div className={`conversion-result ${conversionResult.success ? 'success' : 'error'}`}>
          <div className="conversion-result-header">
            <span className="conversion-icon">{conversionResult.success ? '✓' : '✕'}</span>
            <span className="conversion-message">{conversionResult.message}</span>
          </div>
          {conversionResult.errors && conversionResult.errors.length > 0 && (
            <div className="conversion-errors">
              <details>
                <summary>Errors ({conversionResult.errors.length})</summary>
                <ul>
                  {conversionResult.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </details>
            </div>
          )}
          <button
            className="conversion-close"
            onClick={() => setConversionResult(null)}
            title="Close"
          >
            ×
          </button>
        </div>
      )}
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

