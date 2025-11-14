import { Cell } from '../models/Cell';
import { findAllConflictingBorders, SharedBorderSegment } from '../utils/borderConflictDetector';

interface BorderConflictRendererProps {
  cells: Cell[];
  scale: number;
}

const CONFLICT_COLOR = '#ef4444'; // Red color
const CONFLICT_STROKE_WIDTH = 3;

export function BorderConflictRenderer({ cells, scale }: BorderConflictRendererProps) {
  if (cells.length < 2) {
    return null;
  }
  
  const conflicts = findAllConflictingBorders(cells);
  
  if (conflicts.length === 0) {
    return null;
  }
  
  return (
    <g>
      {conflicts.map((conflict, index) => (
        <line
          key={`conflict-${conflict.cell1Id}-${conflict.cell2Id}-${index}`}
          x1={conflict.x1 * scale}
          y1={conflict.y1 * scale}
          x2={conflict.x2 * scale}
          y2={conflict.y2 * scale}
          stroke={CONFLICT_COLOR}
          strokeWidth={CONFLICT_STROKE_WIDTH}
          pointerEvents="none"
        />
      ))}
    </g>
  );
}

