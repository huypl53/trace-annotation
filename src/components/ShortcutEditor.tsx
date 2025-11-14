import { useState, useRef, useEffect } from 'react';
import { ShortcutKey, formatShortcut, parseKeyEvent } from '../hooks/useKeyboardShortcuts';

interface ShortcutEditorProps {
  label: string;
  shortcutKey: ShortcutKey;
  currentShortcut: string;
  onUpdate: (key: ShortcutKey, value: string) => void;
  disabled?: boolean;
  active?: boolean;
}

export function ShortcutEditor({
  label,
  shortcutKey,
  currentShortcut,
  onUpdate,
  disabled = false,
  active = false,
}: ShortcutEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleClick = () => {
    if (!disabled) {
      setIsEditing(true);
      setTempValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Escape') {
      setIsEditing(false);
      setTempValue('');
      return;
    }

    if (e.key === 'Enter') {
      if (tempValue.trim()) {
        onUpdate(shortcutKey, tempValue.trim());
      }
      setIsEditing(false);
      setTempValue('');
      return;
    }

    // Parse the key event using the same function as the main app
    const nativeEvent = e.nativeEvent as KeyboardEvent;
    const newValue = parseKeyEvent(nativeEvent);
    if (newValue) {
      setTempValue(newValue);
    }
  };

  const handleBlur = () => {
    if (tempValue.trim()) {
      onUpdate(shortcutKey, tempValue.trim());
    }
    setIsEditing(false);
    setTempValue('');
  };

  return (
    <div className="shortcut-editor">
      <span className="shortcut-label">{label}:</span>
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          className="shortcut-input"
          value={tempValue || 'Press key combination...'}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder="Press key combination..."
          readOnly
        />
      ) : (
        <button
          className={`shortcut-display ${active ? 'active' : ''}`}
          onClick={handleClick}
          disabled={disabled}
          title="Click to edit shortcut"
        >
          {formatShortcut(currentShortcut)}
        </button>
      )}
    </div>
  );
}

