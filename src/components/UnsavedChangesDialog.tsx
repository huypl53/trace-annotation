interface UnsavedChangesDialogProps {
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export function UnsavedChangesDialog({
  onSave,
  onDiscard,
  onCancel,
}: UnsavedChangesDialogProps) {
  return (
    <div className="unsaved-dialog-overlay">
      <div className="unsaved-dialog">
        <h3>Unsaved Changes</h3>
        <p>You have unsaved changes to the current XML file. What would you like to do?</p>
        <div className="unsaved-dialog-actions">
          <button onClick={onSave} className="save-button">
            Save
          </button>
          <button onClick={onDiscard} className="discard-button">
            Discard
          </button>
          <button onClick={onCancel} className="cancel-button">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

