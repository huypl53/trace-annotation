import { useState } from 'react';
import { checkFilesExist, uploadFiles } from '../utils/fileApi';
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
      // Separate JSON files from other files
      const jsonFiles = files.filter(isJsonFile);
      const otherFiles = files.filter(f => !isJsonFile(f));

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

      // Combine converted XML files with other files
      const allFiles = [...otherFiles, ...convertedXmlFiles];

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
      
      if (jsonFiles.length > 0) {
        setIsConverting(true);
        try {
          const result = await convertJsonFilesToXml(jsonFiles, files);
          setConversionResult(result);
          const allFiles = [...otherFiles, ...result.xmlFiles];
          await proceedWithUpload(allFiles);
        } catch (convError) {
          console.error('Error converting JSON:', convError);
          await proceedWithUpload(otherFiles);
        } finally {
          setIsConverting(false);
        }
      } else {
        await proceedWithUpload(files);
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
          <label htmlFor="file-upload">Upload Files (Images, XML & JSON)</label>
          <input
            id="file-upload"
            type="file"
            accept="image/*,.xml,text/xml,.json,application/json"
            multiple
            onChange={handleFileChange}
            disabled={isConverting}
          />
          {isConverting && (
            <div className="conversion-status">
              <span>Converting JSON to XML...</span>
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

