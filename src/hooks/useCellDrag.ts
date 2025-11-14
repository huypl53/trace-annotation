import { useRef, useCallback } from 'react';
import { Cell } from '../models/Cell';
import { calculateSnap } from '../utils/snapping';

interface UseCellDragOptions {
  onDrag: (cellId: string, deltaX: number, deltaY: number) => void;
  onDragEnd: () => void;
  cells: Cell[];
  scale: number;
  imageOffset: { x: number; y: number };
  getContainerRect?: () => DOMRect | null;
}

export function useCellDrag({ onDrag, onDragEnd, cells, scale, imageOffset, getContainerRect }: UseCellDragOptions) {
  const dragState = useRef<{
    cellId: string | null;
    startX: number;
    startY: number;
    initialCell: Cell | null;
    containerRect: DOMRect | null;
  }>({
    cellId: null,
    startX: 0,
    startY: 0,
    initialCell: null,
    containerRect: null,
  });

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, cellId: string) => {
      e.preventDefault();
      e.stopPropagation();
      const cell = cells.find(c => c.id === cellId);
      if (!cell) return;

      // Get container rect for accurate mouse position calculation
      const containerRect = getContainerRect ? getContainerRect() : null;

      // Calculate mouse position relative to container, then to image, then to SVG coordinates
      const mouseX = containerRect ? e.clientX - containerRect.left : e.clientX;
      const mouseY = containerRect ? e.clientY - containerRect.top : e.clientY;
      const svgX = (mouseX - imageOffset.x) / scale;
      const svgY = (mouseY - imageOffset.y) / scale;

      dragState.current = {
        cellId,
        startX: svgX,
        startY: svgY,
        initialCell: new Cell(cell.toData()),
        containerRect: containerRect,
      };
    },
    [cells, scale, imageOffset, getContainerRect]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragState.current.cellId || !dragState.current.initialCell) return;

      // Get current container rect (recalculate in case of scrolling/movement)
      const containerRect = getContainerRect ? getContainerRect() : dragState.current.containerRect;
      
      // Calculate mouse position relative to container, then to image, then to SVG coordinates
      const mouseX = containerRect ? e.clientX - containerRect.left : e.clientX;
      const mouseY = containerRect ? e.clientY - containerRect.top : e.clientY;
      const svgX = (mouseX - imageOffset.x) / scale;
      const svgY = (mouseY - imageOffset.y) / scale;

      // Calculate raw delta from initial mouse position
      const rawDeltaX = svgX - dragState.current.startX;
      const rawDeltaY = svgY - dragState.current.startY;

      // Get current cell position from the cells array
      const currentCell = cells.find(c => c.id === dragState.current.cellId);
      if (!currentCell) return;

      // Calculate where the cell should be based on initial position + mouse delta
      const initialBounds = dragState.current.initialCell.getBounds();
      const targetX = initialBounds.minX + rawDeltaX;
      const targetY = initialBounds.minY + rawDeltaY;

      // Calculate current position
      const currentBounds = currentCell.getBounds();
      
      // Calculate the delta needed to move from current position to target position
      const neededDeltaX = targetX - currentBounds.minX;
      const neededDeltaY = targetY - currentBounds.minY;

      // Apply snapping to the needed delta
      const otherCells = cells.filter(c => c.id !== dragState.current.cellId);
      const snapResult = calculateSnap(
        dragState.current.initialCell,
        otherCells,
        rawDeltaX,
        rawDeltaY
      );

      // Calculate the final target position with snapping
      const snappedTargetX = initialBounds.minX + snapResult.deltaX;
      const snappedTargetY = initialBounds.minY + snapResult.deltaY;

      // Calculate the final delta from current position
      const finalDeltaX = snappedTargetX - currentBounds.minX;
      const finalDeltaY = snappedTargetY - currentBounds.minY;

      onDrag(dragState.current.cellId, finalDeltaX, finalDeltaY);
    },
    [cells, scale, imageOffset, onDrag, getContainerRect]
  );

  const handleMouseUp = useCallback(() => {
    if (dragState.current.cellId) {
      onDragEnd();
      dragState.current = {
        cellId: null,
        startX: 0,
        startY: 0,
        initialCell: null,
        containerRect: null,
      };
    }
  }, [onDragEnd]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
}

