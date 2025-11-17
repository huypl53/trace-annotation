import { useState, useEffect } from 'react';
import './HintSlider.css';

interface Hint {
  id: string;
  text: string;
}

const hints: Hint[] = [
  { id: '1', text: '💡 Press Tab to cycle through overlapping cells' },
  { id: '2', text: '💡 Use Shift+Tab to cycle backward through overlapping cells' },
  { id: '3', text: '💡 Tab selection works when cells overlap at the same position' },
  { id: '4', text: '💡 Select multiple cells by clicking while holding Ctrl/Cmd' },
  { id: '5', text: '⌨️ Use Arrow Keys to move selected cells (speed increases while held)' },
  { id: '6', text: '🔗 Enable "Snap to Nearby Cells" to automatically align cells when moving' },
  { id: '7', text: '↩️ Press Ctrl+Z to undo and Ctrl+Y to redo your actions' },
  { id: '8', text: '📋 Press Ctrl+C to copy selected cells and Ctrl+V to paste them' },
  { id: '9', text: '⚙️ Customize keyboard shortcuts by clicking on the shortcut keys in the toolbar' },
  { id: '10', text: '🎨 Adjust move speed settings in Move Mode for precise cell positioning' },
  { id: '11', text: '🔍 Enable "Detect Wrong Borders" to highlight cells with incorrect padding' },
  { id: '12', text: '📐 Edit cell coordinates directly in the right panel for precise positioning' },
  { id: '13', text: '👁️ Toggle edge visibility to show/hide cell borders in the final output' },
];

export function HintSlider() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Auto-advance every 4 seconds
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % hints.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [isPaused, hints.length]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
    setIsPaused(true);
    // Resume auto-advance after 2 seconds
    setTimeout(() => setIsPaused(false), 2000);
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + hints.length) % hints.length);
    setIsPaused(true);
    setTimeout(() => setIsPaused(false), 2000);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % hints.length);
    setIsPaused(true);
    setTimeout(() => setIsPaused(false), 2000);
  };

  if (isCollapsed) {
    return (
      <div className="hint-slider-container hint-slider-collapsed">
        <button
          className="hint-collapse-button"
          onClick={() => setIsCollapsed(false)}
          aria-label="Expand hints"
          title="Show hints"
        >
          💡
        </button>
      </div>
    );
  }

  return (
    <div className="hint-slider-container">
      <button
        className="hint-collapse-button hint-collapse-button-top"
        onClick={() => setIsCollapsed(true)}
        aria-label="Collapse hints"
        title="Hide hints"
      >
        ▼
      </button>
      <div className="hint-slider">
        <button
          className="hint-nav-button hint-nav-prev"
          onClick={goToPrevious}
          aria-label="Previous hint"
        >
          ‹
        </button>
        <div className="hint-content">
          <div
            className="hint-slides"
            style={{ transform: `translateX(-${currentIndex * 100}%)` }}
          >
            {hints.map((hint) => (
              <div key={hint.id} className="hint-slide">
                {hint.text}
              </div>
            ))}
          </div>
        </div>
        <button
          className="hint-nav-button hint-nav-next"
          onClick={goToNext}
          aria-label="Next hint"
        >
          ›
        </button>
      </div>
      <div className="hint-indicators">
        {hints.map((_, index) => (
          <button
            key={index}
            className={`hint-indicator ${index === currentIndex ? 'active' : ''}`}
            onClick={() => goToSlide(index)}
            aria-label={`Go to hint ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

