import { Cell } from '../models/Cell';
import { findOverlappingCells } from '../utils/polygonIntersection';

interface OverlapRendererProps {
  cells: Cell[];
}

const OVERLAP_FILL = 'rgba(255, 0, 255, 0.6)'; // Magenta/Pink with transparency for intersection area
const OVERLAP_STROKE = 'rgba(255, 0, 255, 1)'; // Magenta/Pink stroke
const OVERLAP_STROKE_WIDTH = 2;

export function OverlapRenderer({ cells }: OverlapRendererProps) {
  if (cells.length < 2) {
    return null;
  }

  const overlaps = findOverlappingCells(
    cells.map(cell => ({ id: cell.id, points: cell.points }))
  );

  if (overlaps.length === 0) {
    return null;
  }

  return (
    <g>
      {overlaps.map((overlap, index) => {
        const pointsString = overlap.intersection
          .map(p => `${p.x},${p.y}`)
          .join(' ');

        return (
          <polygon
            key={`overlap-${overlap.cell1Id}-${overlap.cell2Id}-${index}`}
            points={pointsString}
            fill={OVERLAP_FILL}
            stroke={OVERLAP_STROKE}
            strokeWidth={OVERLAP_STROKE_WIDTH}
            pointerEvents="none"
          />
        );
      })}
    </g>
  );
}

