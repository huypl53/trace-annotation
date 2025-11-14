import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Polyfill: Ensure SVG elements have string className to prevent errors
// when React DevTools or extensions try to call .split() on className
if (typeof SVGElement !== 'undefined') {
  const originalGetAttribute = SVGElement.prototype.getAttribute;
  SVGElement.prototype.getAttribute = function(name: string) {
    if (name === 'class' || name === 'className') {
      // Return className as string for SVG elements
      const classAttr = originalGetAttribute.call(this, 'class');
      return classAttr || '';
    }
    return originalGetAttribute.call(this, name);
  };
  
  // Also ensure className property works as string
  Object.defineProperty(SVGElement.prototype, 'className', {
    get: function() {
      const classAttr = this.getAttribute('class') || '';
      return typeof classAttr === 'string' ? classAttr : String(classAttr);
    },
    set: function(value: string) {
      this.setAttribute('class', String(value));
    },
    configurable: true,
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

