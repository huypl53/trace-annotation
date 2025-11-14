import { WrongBorderSegment } from '../utils/wrongBorderDetector';

interface WrongBorderRendererProps {
  wrongBorders: WrongBorderSegment[];
  horizontalPadding: number;
  verticalPadding: number;
}

const WRONG_BORDER_COLOR = '#f59e0b'; // Amber/orange color for warnings
const GRADIENT_EXTENSION = 8; // Fixed distance for gradient extension

export function WrongBorderRenderer({ wrongBorders, horizontalPadding, verticalPadding }: WrongBorderRendererProps) {
  if (wrongBorders.length === 0) {
    return null;
  }

  return (
    <g>
      <defs>
        {/* Gradient for top edge: from bottom (center/border) to top (transparent) */}
        <linearGradient id="gradient-top" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor={WRONG_BORDER_COLOR} stopOpacity="1" />
          <stop offset="100%" stopColor={WRONG_BORDER_COLOR} stopOpacity="0" />
        </linearGradient>
        
        {/* Gradient for bottom edge: from top (center/border) to bottom (transparent) */}
        <linearGradient id="gradient-bottom" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={WRONG_BORDER_COLOR} stopOpacity="1" />
          <stop offset="100%" stopColor={WRONG_BORDER_COLOR} stopOpacity="0" />
        </linearGradient>
        
        {/* Gradient for left edge: from right (center/border) to left (transparent) */}
        <linearGradient id="gradient-left" x1="100%" y1="0%" x2="0%" y2="0%">
          <stop offset="0%" stopColor={WRONG_BORDER_COLOR} stopOpacity="1" />
          <stop offset="100%" stopColor={WRONG_BORDER_COLOR} stopOpacity="0" />
        </linearGradient>
        
        {/* Gradient for right edge: from left (center/border) to right (transparent) */}
        <linearGradient id="gradient-right" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={WRONG_BORDER_COLOR} stopOpacity="1" />
          <stop offset="100%" stopColor={WRONG_BORDER_COLOR} stopOpacity="0" />
        </linearGradient>
      </defs>
      
      {wrongBorders.map((border, index) => {
        let rectX: number, rectY: number, rectWidth: number, rectHeight: number;
        let gradientId: string;

        if (border.edge === 'top' || border.edge === 'bottom') {
          // Horizontal edge
          const y = border.y1; // Same for both points on horizontal edge
          const edgeLength = Math.abs(border.x2 - border.x1);
          
          rectX = Math.min(border.x1, border.x2);
          rectWidth = edgeLength;
          
          if (border.edge === 'top') {
            // Rectangle extends upward from the border
            rectY = y - GRADIENT_EXTENSION;
            rectHeight = GRADIENT_EXTENSION;
            gradientId = 'gradient-top';
          } else {
            // Rectangle extends downward from the border
            rectY = y;
            rectHeight = GRADIENT_EXTENSION;
            gradientId = 'gradient-bottom';
          }
        } else {
          // Vertical edge
          const x = border.x1; // Same for both points on vertical edge
          const edgeLength = Math.abs(border.y2 - border.y1);
          
          rectY = Math.min(border.y1, border.y2);
          rectHeight = edgeLength;
          
          if (border.edge === 'left') {
            // Rectangle extends leftward from the border
            rectX = x - GRADIENT_EXTENSION;
            rectWidth = GRADIENT_EXTENSION;
            gradientId = 'gradient-left';
          } else {
            // Rectangle extends rightward from the border
            rectX = x;
            rectWidth = GRADIENT_EXTENSION;
            gradientId = 'gradient-right';
          }
        }

        return (
          <rect
            key={`wrong-border-${border.cellId}-${border.edge}-${index}`}
            x={rectX}
            y={rectY}
            width={rectWidth}
            height={rectHeight}
            fill={`url(#${gradientId})`}
            pointerEvents="none"
          />
        );
      })}
    </g>
  );
}

