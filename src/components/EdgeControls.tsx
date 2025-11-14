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

  const handlePointChange = (index: number, field: 'x' | 'y', value: string) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;

    const newPoints = [...cell.points];
    newPoints[index] = { ...newPoints[index], [field]: numValue };
    onUpdatePoints(newPoints);
  };

  return (
    <div className="edge-controls">
      <h3>Cell Controls</h3>
      
      <div className="coordinates-section">
        <h4>Coordinates</h4>
        <div className="coordinates-list">
          {cell.points.map((point, index) => (
            <div key={index} className="coordinate-row">
              <span className="coordinate-label">Point {index + 1}:</span>
              <input
                type="number"
                value={point.x}
                onChange={e => handlePointChange(index, 'x', e.target.value)}
                className="coordinate-input"
                step="0.1"
              />
              <input
                type="number"
                value={point.y}
                onChange={e => handlePointChange(index, 'y', e.target.value)}
                className="coordinate-input"
                step="0.1"
              />
            </div>
          ))}
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

