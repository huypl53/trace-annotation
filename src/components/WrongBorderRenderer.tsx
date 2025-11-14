import { WrongBorderSegment } from '../utils/wrongBorderDetector';

interface WrongBorderRendererProps {
  wrongBorders: WrongBorderSegment[];
}

const WRONG_BORDER_COLOR = '#f59e0b'; // Amber/orange color for warnings
const WRONG_BORDER_STROKE_WIDTH = 3;

export function WrongBorderRenderer({ wrongBorders }: WrongBorderRendererProps) {
  if (wrongBorders.length === 0) {
    return null;
  }

  return (
    <g>
      {wrongBorders.map((border, index) => (
        <line
          key={`wrong-border-${border.cellId}-${border.edge}-${index}`}
          x1={border.x1}
          y1={border.y1}
          x2={border.x2}
          y2={border.y2}
          stroke={WRONG_BORDER_COLOR}
          strokeWidth={WRONG_BORDER_STROKE_WIDTH}
          strokeDasharray="8,4"
          pointerEvents="none"
        />
      ))}
    </g>
  );
}

