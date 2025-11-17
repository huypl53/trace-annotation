interface OverwriteWarningDialogProps {
  existingFiles: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function OverwriteWarningDialog({
  existingFiles,
  onConfirm,
  onCancel,
}: OverwriteWarningDialogProps) {
  return (
    <div className="overwrite-dialog-overlay">
      <div className="overwrite-dialog">
        <h3>File Overwrite Warning</h3>
        <p>The following files already exist and will be overwritten:</p>
        <ul className="overwrite-file-list">
          {existingFiles.map((filename) => (
            <li key={filename}>{filename}</li>
          ))}
        </ul>
        <div className="overwrite-dialog-actions">
          <button onClick={onCancel} className="cancel-button">
            Cancel
          </button>
          <button onClick={onConfirm} className="confirm-button">
            Overwrite
          </button>
        </div>
      </div>
    </div>
  );
}

