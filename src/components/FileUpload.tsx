interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
}

export function FileUpload({ onFilesSelected }: FileUploadProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFilesSelected(files);
      // Reset input so the same files can be selected again if needed
      e.target.value = '';
    }
  };

  return (
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
  );
}

