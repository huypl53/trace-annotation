import { Cell } from '../models/Cell';
import { CellLines, Point } from '../models/types';

interface EdgeControlsProps {
  cell: Cell | null;
  onUpdate: (lines: Partial<CellLines>) => void;
  onUpdatePoints: (points: Point[]) => void;
}

export function EdgeControls({ cell, onUpdate, onUpdatePoints }: EdgeControlsProps) {
  if (!cell) {
    return (
      <div className="edge-controls">
        <h3>Cell Controls</h3>
        <p>Select a cell to edit its properties</p>
      </div>
    );
  }

  const toggleEdge = (edge: keyof CellLines) => {
    const newValue = cell.lines[edge] === 1 ? 0 : 1;
    onUpdate({ [edge]: newValue });
  };

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

  const topLeftIndex = findClosestPointIndex(topLeft.x, topLeft.y);
  const bottomRightIndex = findClosestPointIndex(bottomRight.x, bottomRight.y);
  
  // Find top-right and bottom-left indices
  const topRight = { x: bounds.maxX, y: bounds.minY };
  const bottomLeft = { x: bounds.minX, y: bounds.maxY };
  const topRightIndex = findClosestPointIndex(topRight.x, topRight.y);
  const bottomLeftIndex = findClosestPointIndex(bottomLeft.x, bottomLeft.y);

  const handleTopLeftChange = (field: 'x' | 'y', value: string) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;

    const newPoints = [...cell.points];
    
    // Update top-left
    newPoints[topLeftIndex] = { ...newPoints[topLeftIndex], [field]: numValue };
    
    // Update related corners to maintain rectangle shape
    if (field === 'x') {
      // When top-left X changes, update bottom-left X to match (same left edge)
      newPoints[bottomLeftIndex] = { ...newPoints[bottomLeftIndex], x: numValue };
    } else {
      // When top-left Y changes, update top-right Y to match (same top edge)
      newPoints[topRightIndex] = { ...newPoints[topRightIndex], y: numValue };
    }
    
    onUpdatePoints(newPoints);
  };

  const handleBottomRightChange = (field: 'x' | 'y', value: string) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;

    const newPoints = [...cell.points];
    
    // Update bottom-right
    newPoints[bottomRightIndex] = { ...newPoints[bottomRightIndex], [field]: numValue };
    
    // Update related corners to maintain rectangle shape
    if (field === 'x') {
      // When bottom-right X changes, update top-right X to match (same right edge)
      newPoints[topRightIndex] = { ...newPoints[topRightIndex], x: numValue };
    } else {
      // When bottom-right Y changes, update bottom-left Y to match (same bottom edge)
      newPoints[bottomLeftIndex] = { ...newPoints[bottomLeftIndex], y: numValue };
    }
    
    onUpdatePoints(newPoints);
  };

  return (
    <div className="edge-controls">
      <h3>Cell Controls</h3>
      
      <div className="coordinates-section">
        <h4>Coordinates</h4>
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

      <div className="edge-section">
        <h4>Edge Visibility</h4>
        <div className="edge-buttons">
          <div className="edge-group">
            <label>Top</label>
            <button
              className={cell.lines.top === 1 ? 'active' : ''}
              onClick={() => toggleEdge('top')}
            >
              {cell.lines.top === 1 ? 'Visible' : 'Hidden'}
            </button>
          </div>
          <div className="edge-group">
            <label>Bottom</label>
            <button
              className={cell.lines.bottom === 1 ? 'active' : ''}
              onClick={() => toggleEdge('bottom')}
            >
              {cell.lines.bottom === 1 ? 'Visible' : 'Hidden'}
            </button>
          </div>
          <div className="edge-group">
            <label>Left</label>
            <button
              className={cell.lines.left === 1 ? 'active' : ''}
              onClick={() => toggleEdge('left')}
            >
              {cell.lines.left === 1 ? 'Visible' : 'Hidden'}
            </button>
          </div>
          <div className="edge-group">
            <label>Right</label>
            <button
              className={cell.lines.right === 1 ? 'active' : ''}
              onClick={() => toggleEdge('right')}
            >
              {cell.lines.right === 1 ? 'Visible' : 'Hidden'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

