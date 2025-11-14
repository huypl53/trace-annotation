import { Cell } from '../models/Cell';
import { Point } from '../models/types';

interface CellRendererProps {
  cell: Cell;
  scale: number;
  onMouseDown?: (e: React.MouseEvent, cellId: string) => void;
  onClick: (e: React.MouseEvent, cellId: string) => void;
  onCornerMouseDown?: (e: React.MouseEvent, cellId: string, cornerIndex: number, points: Point[]) => void;
  selected: boolean;
  showResizeHandles?: boolean;
}

const VISIBLE_EDGE_COLOR = '#2563eb';
const INVISIBLE_EDGE_COLOR = '#94a3b8';
const CELL_FILL = 'rgba(37, 99, 235, 0.1)';
const SELECTED_FILL = 'rgba(37, 99, 235, 0.2)';

const CORNER_HANDLE_SIZE = 8;
const CORNER_HANDLE_COLOR = '#2563eb';
const CORNER_HANDLE_FILL = '#ffffff';

export function CellRenderer({ cell, scale, onMouseDown, onClick, onCornerMouseDown, selected, showResizeHandles }: CellRendererProps) {
  const pointsString = cell.points.map(p => `${p.x * scale},${p.y * scale}`).join(' ');

  const bounds = cell.getBounds();
  const left = bounds.minX * scale;
  const right = bounds.maxX * scale;
  const top = bounds.minY * scale;
  const bottom = bounds.maxY * scale;
  const width = (bounds.maxX - bounds.minX) * scale;
  const height = (bounds.maxY - bounds.minY) * scale;

  return (
    <g>
      <polygon
        points={pointsString}
        fill={selected ? SELECTED_FILL : CELL_FILL}
        stroke="none"
        onMouseDown={onMouseDown ? (e => onMouseDown(e, cell.id)) : undefined}
        onClick={e => onClick(e, cell.id)}
        style={{ cursor: showResizeHandles ? 'default' : (onMouseDown ? 'move' : 'default') }}
      />
      {showResizeHandles && selected && onCornerMouseDown && cell.points.map((point, index) => {
        const x = point.x * scale;
        const y = point.y * scale;
        return (
          <circle
            key={`corner-${index}`}
            cx={x}
            cy={y}
            r={CORNER_HANDLE_SIZE}
            fill={CORNER_HANDLE_FILL}
            stroke={CORNER_HANDLE_COLOR}
            strokeWidth={2}
            onMouseDown={e => {
              e.stopPropagation();
              onCornerMouseDown(e, cell.id, index, cell.points);
            }}
            style={{ cursor: 'nwse-resize' }}
          />
        );
      })}
      {cell.lines.top === 1 && (
        <line
          x1={left}
          y1={top}
          x2={right}
          y2={top}
          stroke={VISIBLE_EDGE_COLOR}
          strokeWidth={2}
          pointerEvents="none"
        />
      )}
      {cell.lines.top === 0 && (
        <line
          x1={left}
          y1={top}
          x2={right}
          y2={top}
          stroke={INVISIBLE_EDGE_COLOR}
          strokeWidth={1}
          strokeDasharray="4,4"
          pointerEvents="none"
        />
      )}
      {cell.lines.bottom === 1 && (
        <line
          x1={left}
          y1={bottom}
          x2={right}
          y2={bottom}
          stroke={VISIBLE_EDGE_COLOR}
          strokeWidth={2}
          pointerEvents="none"
        />
      )}
      {cell.lines.bottom === 0 && (
        <line
          x1={left}
          y1={bottom}
          x2={right}
          y2={bottom}
          stroke={INVISIBLE_EDGE_COLOR}
          strokeWidth={1}
          strokeDasharray="4,4"
          pointerEvents="none"
        />
      )}
      {cell.lines.left === 1 && (
        <line
          x1={left}
          y1={top}
          x2={left}
          y2={bottom}
          stroke={VISIBLE_EDGE_COLOR}
          strokeWidth={2}
          pointerEvents="none"
        />
      )}
      {cell.lines.left === 0 && (
        <line
          x1={left}
          y1={top}
          x2={left}
          y2={bottom}
          stroke={INVISIBLE_EDGE_COLOR}
          strokeWidth={1}
          strokeDasharray="4,4"
          pointerEvents="none"
        />
      )}
      {cell.lines.right === 1 && (
        <line
          x1={right}
          y1={top}
          x2={right}
          y2={bottom}
          stroke={VISIBLE_EDGE_COLOR}
          strokeWidth={2}
          pointerEvents="none"
        />
      )}
      {cell.lines.right === 0 && (
        <line
          x1={right}
          y1={top}
          x2={right}
          y2={bottom}
          stroke={INVISIBLE_EDGE_COLOR}
          strokeWidth={1}
          strokeDasharray="4,4"
          pointerEvents="none"
        />
      )}
    </g>
  );
}

