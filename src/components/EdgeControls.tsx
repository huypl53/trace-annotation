import { Cell } from '../models/Cell';
import { CellLines, Point } from '../models/types';

interface EdgeControlsProps {
  cell: Cell | null;
  selectedCells?: Cell[];
  onUpdate: (lines: Partial<CellLines>) => void;
  onUpdatePoints: (points: Point[]) => void;
  onUpdateColor?: (color: string) => void;
  onUpdateOpacity?: (opacity: number) => void;
  globalColor?: string;
  globalOpacity?: number;
}

export function EdgeControls({ cell, selectedCells = [], onUpdate, onUpdatePoints, onUpdateColor, onUpdateOpacity, globalColor, globalOpacity }: EdgeControlsProps) {
  // Use cell's color/opacity if available, otherwise use global values or defaults
  const displayColor = cell?.color || globalColor || '#2563eb';
  const displayOpacity = cell?.opacity !== undefined ? cell.opacity : (globalOpacity !== undefined ? globalOpacity : 0.1);

  // Determine if we have any cells selected (single or multiple)
  const hasSelectedCells = cell !== null || selectedCells.length > 0;
  // Combine cells, avoiding duplicates (cell might be in selectedCells when there's exactly 1)
  const allSelectedCells = cell 
    ? selectedCells.some(c => c.id === cell.id) 
      ? selectedCells 
      : [cell, ...selectedCells]
    : selectedCells;

  if (!hasSelectedCells) {
    return (
      <div className="edge-controls">
        <h3>Cell Controls</h3>
        <p>Select a cell to edit its properties</p>
        {onUpdateColor && onUpdateOpacity && (
          <div className="appearance-section">
            <h4 className="section-header-with-tooltip" title="Change the color and opacity of all cells in the annotation. These settings apply globally to all cells, not just the selected one.">
              Appearance (All Cells)
              <span className="tooltip-icon">ℹ️</span>
            </h4>
            <div className="appearance-controls">
              <div className="appearance-group">
                <label className="appearance-label">Color:</label>
                <input
                  type="color"
                  value={displayColor}
                  onChange={(e) => onUpdateColor(e.target.value)}
                  className="color-input"
                />
              </div>
              <div className="appearance-group">
                <label className="appearance-label">Opacity:</label>
                <div className="opacity-control">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={displayOpacity}
                    onChange={(e) => onUpdateOpacity(parseFloat(e.target.value))}
                    className="opacity-slider"
                  />
                  <span className="opacity-value">{(displayOpacity * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Helper function to get edge state for multiple cells
  const getEdgeState = (edge: keyof CellLines): 'all-visible' | 'all-hidden' | 'mixed' => {
    if (allSelectedCells.length === 0) return 'all-hidden';
    
    const firstValue = allSelectedCells[0].lines[edge];
    const allSame = allSelectedCells.every(c => c.lines[edge] === firstValue);
    
    if (!allSame) return 'mixed';
    return firstValue === 1 ? 'all-visible' : 'all-hidden';
  };

  const toggleEdge = (edge: keyof CellLines) => {
    const currentState = getEdgeState(edge);
    // If mixed or all-hidden, set to visible (1). If all-visible, set to hidden (0).
    const newValue = currentState === 'all-visible' ? 0 : 1;
    onUpdate({ [edge]: newValue });
  };

  // Only show coordinates section for single cell
  const showCoordinates = cell !== null;

  // Coordinate editing functions - only used when cell is not null
  let handleTopLeftChange: ((field: 'x' | 'y', value: string) => void) | undefined;
  let handleBottomRightChange: ((field: 'x' | 'y', value: string) => void) | undefined;
  let topLeftIndex: number | undefined;
  let bottomRightIndex: number | undefined;

  if (cell && showCoordinates) {
    const bounds = cell.getBounds();
    const topLeft = { x: bounds.minX, y: bounds.minY };
    const bottomRight = { x: bounds.maxX, y: bounds.maxY };

    // Find the indices of all 4 corners
    const findClosestPointIndex = (targetX: number, targetY: number): number => {
      let closestIndex = 0;
      let minDistance = Infinity;
      cell.points.forEach((point, index) => {
        const distance = Math.sqrt(
          Math.pow(point.x - targetX, 2) + Math.pow(point.y - targetY, 2)
        );
        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = index;
        }
      });
      return closestIndex;
    };

    topLeftIndex = findClosestPointIndex(topLeft.x, topLeft.y);
    bottomRightIndex = findClosestPointIndex(bottomRight.x, bottomRight.y);
    
    // Find top-right and bottom-left indices
    const topRight = { x: bounds.maxX, y: bounds.minY };
    const bottomLeft = { x: bounds.minX, y: bounds.maxY };
    const topRightIndex = findClosestPointIndex(topRight.x, topRight.y);
    const bottomLeftIndex = findClosestPointIndex(bottomLeft.x, bottomLeft.y);

    handleTopLeftChange = (field: 'x' | 'y', value: string) => {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) return;

      const newPoints = [...cell.points];
      
      // Update top-left
      if (topLeftIndex !== undefined) {
        newPoints[topLeftIndex] = { ...newPoints[topLeftIndex], [field]: numValue };
      }
      
      // Update related corners to maintain rectangle shape
      if (field === 'x') {
        // When top-left X changes, update bottom-left X to match (same left edge)
        if (bottomLeftIndex !== undefined) {
          newPoints[bottomLeftIndex] = { ...newPoints[bottomLeftIndex], x: numValue };
        }
      } else {
        // When top-left Y changes, update top-right Y to match (same top edge)
        if (topRightIndex !== undefined) {
          newPoints[topRightIndex] = { ...newPoints[topRightIndex], y: numValue };
        }
      }
      
      onUpdatePoints(newPoints);
    };

    handleBottomRightChange = (field: 'x' | 'y', value: string) => {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) return;

      const newPoints = [...cell.points];
      
      // Update bottom-right
      if (bottomRightIndex !== undefined) {
        newPoints[bottomRightIndex] = { ...newPoints[bottomRightIndex], [field]: numValue };
      }
      
      // Update related corners to maintain rectangle shape
      if (field === 'x') {
        // When bottom-right X changes, update top-right X to match (same right edge)
        if (topRightIndex !== undefined) {
          newPoints[topRightIndex] = { ...newPoints[topRightIndex], x: numValue };
        }
      } else {
        // When bottom-right Y changes, update bottom-left Y to match (same bottom edge)
        if (bottomLeftIndex !== undefined) {
          newPoints[bottomLeftIndex] = { ...newPoints[bottomLeftIndex], y: numValue };
        }
      }
      
      onUpdatePoints(newPoints);
    };
  }

  return (
    <div className="edge-controls">
      <h3>Cell Controls</h3>
      
      {showCoordinates && cell && handleTopLeftChange && handleBottomRightChange && topLeftIndex !== undefined && bottomRightIndex !== undefined && (
      <div className="coordinates-section">
        <h4 className="section-header-with-tooltip" title="Edit cell corner coordinates. Changing top-left or bottom-right coordinates will automatically adjust related corners to maintain a rectangular shape.">
          Coordinates
          <span className="tooltip-icon">ℹ️</span>
        </h4>
        <div className="coordinates-list">
          <div className="coordinate-group">
            <span className="coordinate-label">Top Left:</span>
            <div className="coordinate-inputs">
              <div className="coordinate-input-row">
                <label className="coordinate-field-label">X:</label>
                <input
                  type="number"
                  value={cell.points[topLeftIndex].x.toFixed(1)}
                  onChange={e => handleTopLeftChange('x', e.target.value)}
                  className="coordinate-input"
                  step="0.1"
                />
              </div>
              <div className="coordinate-input-row">
                <label className="coordinate-field-label">Y:</label>
                <input
                  type="number"
                  value={cell.points[topLeftIndex].y.toFixed(1)}
                  onChange={e => handleTopLeftChange('y', e.target.value)}
                  className="coordinate-input"
                  step="0.1"
                />
              </div>
            </div>
          </div>
          <div className="coordinate-group">
            <span className="coordinate-label">Bottom Right:</span>
            <div className="coordinate-inputs">
              <div className="coordinate-input-row">
                <label className="coordinate-field-label">X:</label>
                <input
                  type="number"
                  value={cell.points[bottomRightIndex].x.toFixed(1)}
                  onChange={e => handleBottomRightChange('x', e.target.value)}
                  className="coordinate-input"
                  step="0.1"
                />
              </div>
              <div className="coordinate-input-row">
                <label className="coordinate-field-label">Y:</label>
                <input
                  type="number"
                  value={cell.points[bottomRightIndex].y.toFixed(1)}
                  onChange={e => handleBottomRightChange('y', e.target.value)}
                  className="coordinate-input"
                  step="0.1"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      <div className="edge-section">
        <h4 className="section-header-with-tooltip" title="Toggle visibility of cell borders. Visible edges are shown as solid lines, hidden edges are shown as dashed lines. This helps identify which borders should be rendered in the final output.">
          Edge Visibility
          {allSelectedCells.length > 1 && <span className="multi-select-indicator"> ({allSelectedCells.length} cells)</span>}
          <span className="tooltip-icon">ℹ️</span>
        </h4>
        <div className="edge-buttons">
          <div className="edge-group">
            <label>Top</label>
            <button
              className={getEdgeState('top') === 'all-visible' ? 'active' : getEdgeState('top') === 'mixed' ? 'mixed' : ''}
              onClick={() => toggleEdge('top')}
            >
              {getEdgeState('top') === 'mixed' ? 'Mixed' : (getEdgeState('top') === 'all-visible' ? 'Visible' : 'Hidden')}
            </button>
          </div>
          <div className="edge-group">
            <label>Bottom</label>
            <button
              className={getEdgeState('bottom') === 'all-visible' ? 'active' : getEdgeState('bottom') === 'mixed' ? 'mixed' : ''}
              onClick={() => toggleEdge('bottom')}
            >
              {getEdgeState('bottom') === 'mixed' ? 'Mixed' : (getEdgeState('bottom') === 'all-visible' ? 'Visible' : 'Hidden')}
            </button>
          </div>
          <div className="edge-group">
            <label>Left</label>
            <button
              className={getEdgeState('left') === 'all-visible' ? 'active' : getEdgeState('left') === 'mixed' ? 'mixed' : ''}
              onClick={() => toggleEdge('left')}
            >
              {getEdgeState('left') === 'mixed' ? 'Mixed' : (getEdgeState('left') === 'all-visible' ? 'Visible' : 'Hidden')}
            </button>
          </div>
          <div className="edge-group">
            <label>Right</label>
            <button
              className={getEdgeState('right') === 'all-visible' ? 'active' : getEdgeState('right') === 'mixed' ? 'mixed' : ''}
              onClick={() => toggleEdge('right')}
            >
              {getEdgeState('right') === 'mixed' ? 'Mixed' : (getEdgeState('right') === 'all-visible' ? 'Visible' : 'Hidden')}
            </button>
          </div>
        </div>
      </div>

      {onUpdateColor && onUpdateOpacity && (
        <div className="appearance-section">
          <h4 className="section-header-with-tooltip" title="Change the color and opacity of all cells in the annotation. These settings apply globally to all cells, not just the selected one.">
            Appearance (All Cells)
            <span className="tooltip-icon">ℹ️</span>
          </h4>
          <div className="appearance-controls">
            <div className="appearance-group">
              <label className="appearance-label">Color:</label>
              <input
                type="color"
                value={displayColor}
                onChange={(e) => onUpdateColor(e.target.value)}
                className="color-input"
              />
            </div>
            <div className="appearance-group">
              <label className="appearance-label">Opacity:</label>
              <div className="opacity-control">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={displayOpacity}
                  onChange={(e) => onUpdateOpacity(parseFloat(e.target.value))}
                  className="opacity-slider"
                />
                <span className="opacity-value">{(displayOpacity * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

