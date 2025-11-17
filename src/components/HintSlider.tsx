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
];

export function HintSlider() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

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

  return (
    <div className="hint-slider-container">
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

