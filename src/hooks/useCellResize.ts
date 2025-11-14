import { useRef, useCallback } from 'react';
import { Point } from '../models/types';
import { Cell } from '../models/Cell';
import { calculateCornerSnap } from '../utils/snapping';

interface UseCellResizeOptions {
  onResize: (points: Point[]) => void;
  onResizeEnd: () => void;
  cells: Cell[];
  scale: number;
  imageOffset: { x: number; y: number };
}

export function useCellResize({ onResize, onResizeEnd, cells, scale, imageOffset }: UseCellResizeOptions) {
  const resizeState = useRef<{
    cellId: string | null;
    cornerIndex: number | null;
    initialPoints: Point[] | null;
    startX: number;
    startY: number;
  }>({
    cellId: null,
    cornerIndex: null,
    initialPoints: null,
    startX: 0,
    startY: 0,
  });

  const handleCornerMouseDown = useCallback(
    (e: React.MouseEvent, cellId: string, cornerIndex: number, initialPoints: Point[]) => {
      e.preventDefault();
      e.stopPropagation();

      const svgX = (e.clientX - imageOffset.x) / scale;
      const svgY = (e.clientY - imageOffset.y) / scale;

      resizeState.current = {
        cellId,
        cornerIndex,
        initialPoints: [...initialPoints],
        startX: svgX,
        startY: svgY,
      };
    },
    [scale, imageOffset]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!resizeState.current.cellId || resizeState.current.cornerIndex === null || !resizeState.current.initialPoints) return;

      const svgX = (e.clientX - imageOffset.x) / scale;
      const svgY = (e.clientY - imageOffset.y) / scale;

      const deltaX = svgX - resizeState.current.startX;
      const deltaY = svgY - resizeState.current.startY;

      const newPoints = [...resizeState.current.initialPoints];
      const cornerIndex = resizeState.current.cornerIndex;
      
      // Calculate the new corner position
      const newCornerX = newPoints[cornerIndex].x + deltaX;
      const newCornerY = newPoints[cornerIndex].y + deltaY;
      
      // Apply corner snapping (convert threshold from screen pixels to image coordinates)
      const snapThreshold = 8 / scale;
      const otherCells = cells.filter(c => c.id !== resizeState.current.cellId);
      const snapResult = calculateCornerSnap(
        { x: newCornerX, y: newCornerY },
        resizeState.current.cellId || '',
        otherCells,
        snapThreshold
      );
      
      // Use snapped position if snapping occurred, otherwise use the calculated position
      const finalCornerX = snapResult.snapped ? snapResult.snappedX : newCornerX;
      const finalCornerY = snapResult.snapped ? snapResult.snappedY : newCornerY;
      
      // Calculate the actual delta after snapping
      const finalDeltaX = finalCornerX - newPoints[cornerIndex].x;
      const finalDeltaY = finalCornerY - newPoints[cornerIndex].y;
      
      // Cell points order: 0=top-left, 1=top-right, 2=bottom-right, 3=bottom-left
      // When dragging a corner, maintain rectangle shape by updating adjacent corners
      switch (cornerIndex) {
        case 0: // top-left
          newPoints[0] = { x: finalCornerX, y: finalCornerY };
          newPoints[1] = { ...newPoints[1], y: newPoints[1].y + finalDeltaY }; // top-right: update y
          newPoints[3] = { ...newPoints[3], x: newPoints[3].x + finalDeltaX }; // bottom-left: update x
          break;
        case 1: // top-right
          newPoints[1] = { x: finalCornerX, y: finalCornerY };
          newPoints[0] = { ...newPoints[0], y: newPoints[0].y + finalDeltaY }; // top-left: update y
          newPoints[2] = { ...newPoints[2], x: newPoints[2].x + finalDeltaX }; // bottom-right: update x
          break;
        case 2: // bottom-right
          newPoints[2] = { x: finalCornerX, y: finalCornerY };
          newPoints[1] = { ...newPoints[1], x: newPoints[1].x + finalDeltaX }; // top-right: update x
          newPoints[3] = { ...newPoints[3], y: newPoints[3].y + finalDeltaY }; // bottom-left: update y
          break;
        case 3: // bottom-left
          newPoints[3] = { x: finalCornerX, y: finalCornerY };
          newPoints[0] = { ...newPoints[0], x: newPoints[0].x + finalDeltaX }; // top-left: update x
          newPoints[2] = { ...newPoints[2], y: newPoints[2].y + finalDeltaY }; // bottom-right: update y
          break;
      }

      onResize(newPoints);
    },
    [cells, scale, imageOffset, onResize]
  );

  const handleMouseUp = useCallback(() => {
    if (resizeState.current.cellId) {
      onResizeEnd();
      resizeState.current = {
        cellId: null,
        cornerIndex: null,
        initialPoints: null,
        startX: 0,
        startY: 0,
      };
    }
  }, [onResizeEnd]);

  return {
    handleCornerMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
}

