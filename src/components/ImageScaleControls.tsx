import { useEffect, useState } from 'react';

interface ImageScaleControlsProps {
  currentScale: number;
  onSetScale: (scale: number) => void;
  disabled?: boolean;
  imageUrl: string | null;
  onDownloadImage?: () => void;
}

export function ImageScaleControls({ currentScale, onSetScale, disabled = false, imageUrl, onDownloadImage }: ImageScaleControlsProps) {
  const [inputValue, setInputValue] = useState(currentScale.toString());

  // Update input when scale changes externally
  useEffect(() => {
    setInputValue(currentScale.toString());
  }, [currentScale]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) {
      onSetScale(numValue);
    }
  };

  const handleInputBlur = () => {
    const numValue = parseFloat(inputValue);
    if (isNaN(numValue) || numValue <= 0) {
      // Reset to current scale if invalid
      setInputValue(currentScale.toString());
    } else {
      onSetScale(numValue);
    }
  };

  const handleApply = () => {
    const numValue = parseFloat(inputValue);
    if (!isNaN(numValue) && numValue > 0) {
      onSetScale(numValue);
    } else {
      // Reset to current scale if invalid
      setInputValue(currentScale.toString());
    }
  };

  return (
    <div className="image-scale-controls">
      <h4 className="section-header-with-tooltip" title="Scale the image display size to correct incorrect input image dimensions. This affects how the image is displayed but does not change cell coordinates.">
        Image Scale
        <span className="tooltip-icon">ℹ️</span>
      </h4>
      <div className="scale-input-group">
        <label className="scale-input-label">
          <span>Scale Factor:</span>
          <input
            type="number"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleApply();
              }
            }}
            disabled={disabled}
            className="scale-input"
            min="0.01"
            max="10"
            step="0.01"
            placeholder="1.0"
          />
        </label>
        <button
          onClick={handleApply}
          disabled={disabled}
          className="scale-apply-button"
          title="Apply scale factor"
        >
          Apply
        </button>
      </div>
      {onDownloadImage && imageUrl && (
        <div className="scale-download-group">
          <button
            onClick={onDownloadImage}
            disabled={disabled}
            className="scale-download-button"
            title="Download the scaled image"
          >
            Download Scaled Image
          </button>
        </div>
      )}
    </div>
  );
}

