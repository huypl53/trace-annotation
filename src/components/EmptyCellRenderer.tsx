import { Cell } from '../models/Cell';
import { detectEmptyCells } from '../utils/emptyCellDetector';

interface EmptyCellRendererProps {
  cells: Cell[];
}

const EMPTY_CELL_FILL = 'rgba(255, 193, 7, 0.2)'; // Amber/yellow with transparency
const EMPTY_CELL_STROKE = 'rgba(255, 193, 7, 0.6)'; // Amber/yellow stroke
const EMPTY_CELL_STROKE_WIDTH = 2;

export function EmptyCellRenderer({ cells }: EmptyCellRendererProps) {
  if (cells.length === 0) {
    return null;
  }

  const emptyCells = detectEmptyCells(cells);

  if (emptyCells.length === 0) {
    return null;
  }

  return (
    <g>
      {emptyCells.map((emptyCell, index) => {
        const pointsString = emptyCell.points
          .map(p => `${p.x},${p.y}`)
          .join(' ');

        return (
          <polygon
            key={`empty-cell-${index}`}
            points={pointsString}
            fill={EMPTY_CELL_FILL}
            stroke={EMPTY_CELL_STROKE}
            strokeWidth={EMPTY_CELL_STROKE_WIDTH}
            strokeDasharray="4,4"
            pointerEvents="none"
          />
        );
      })}
    </g>
  );
}

