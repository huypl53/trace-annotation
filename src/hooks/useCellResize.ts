import { useCallback, useRef } from 'react';
import { Cell } from '../models/Cell';
import { Point } from '../models/types';
import { calculateCornerSnap, calculateResizeEdgeSnap } from '../utils/snapping';

interface UseCellResizeOptions {
  onResize: (points: Point[]) => void;
  onResizeEnd: () => void;
  cells: Cell[];
  scale: number;
  imageOffset: { x: number; y: number };
  getContainerRect?: () => DOMRect | null;
  snapEnabled?: boolean;
  snapThreshold?: number;
  onSnapPreview?: (preview: { show: boolean; points: Point[]; matchedCellId: string | null; matchedCellIds: string[] } | null) => void;
}

export function useCellResize({ 
  onResize, 
  onResizeEnd, 
  cells, 
  scale, 
  imageOffset, 
  getContainerRect,
  snapEnabled = true,
  snapThreshold = 5,
  onSnapPreview,
}: UseCellResizeOptions) {
  const resizeState = useRef<{
    cellId: string | null;
    cornerIndex: number | null;
    initialPoints: Point[] | null;
    startX: number;
    startY: number;
    imageOffset: { x: number; y: number }; // Store offset at resize start to prevent jitter
    scale: number; // Store scale at resize start to prevent jitter
  }>({
    cellId: null,
    cornerIndex: null,
    initialPoints: null,
    startX: 0,
    startY: 0,
    imageOffset: { x: 0, y: 0 },
    scale: 1,
  });

  const handleCornerMouseDown = useCallback(
    (e: React.MouseEvent, cellId: string, cornerIndex: number, initialPoints: Point[]) => {
      e.preventDefault();
      e.stopPropagation();

      const containerRect = getContainerRect ? getContainerRect() : null;
      const mouseX = containerRect ? e.clientX - containerRect.left : e.clientX;
      const mouseY = containerRect ? e.clientY - containerRect.top : e.clientY;
      const svgX = (mouseX - imageOffset.x) / scale;
      const svgY = (mouseY - imageOffset.y) / scale;

      resizeState.current = {
        cellId,
        cornerIndex,
        initialPoints: [...initialPoints],
        startX: svgX,
        startY: svgY,
        imageOffset: { ...imageOffset }, // Store offset at resize start
        scale, // Store scale at resize start
      };
    },
    [scale, imageOffset, getContainerRect]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!resizeState.current.cellId || resizeState.current.cornerIndex === null || !resizeState.current.initialPoints) return;

      // Use stored offset and scale from resize start to prevent jitter
      const storedOffset = resizeState.current.imageOffset;
      const storedScale = resizeState.current.scale;

      const containerRect = getContainerRect ? getContainerRect() : null;
      const mouseX = containerRect ? e.clientX - containerRect.left : e.clientX;
      const mouseY = containerRect ? e.clientY - containerRect.top : e.clientY;
      const svgX = (mouseX - storedOffset.x) / storedScale;
      const svgY = (mouseY - storedOffset.y) / storedScale;

      const deltaX = svgX - resizeState.current.startX;
      const deltaY = svgY - resizeState.current.startY;

      const newPoints = [...resizeState.current.initialPoints];
      const cornerIndex = resizeState.current.cornerIndex;

      // Calculate the new corner position
      const newCornerX = newPoints[cornerIndex].x + deltaX;
      const newCornerY = newPoints[cornerIndex].y + deltaY;

      // Convert snap threshold from display pixels to SVG coordinates
      const snapThresholdInSvg = snapEnabled ? (snapThreshold / storedScale) : Infinity;
      const otherCells = cells.filter(c => c.id !== resizeState.current.cellId);
      
      let finalCornerX = newCornerX;
      let finalCornerY = newCornerY;
      let snapMatchedCellId: string | null = null;
      let snapMatchedCellIds: string[] = [];

      if (snapEnabled && resizeState.current.cellId) {
        // First, create a temporary cell with the new corner position to check edge snapping
        const tempPoints = [...newPoints];
        tempPoints[cornerIndex] = { x: newCornerX, y: newCornerY };
        
        // Update adjacent corners to maintain rectangle shape
        switch (cornerIndex) {
          case 0: // top-left
            tempPoints[1] = { ...tempPoints[1], y: tempPoints[1].y + deltaY };
            tempPoints[3] = { ...tempPoints[3], x: tempPoints[3].x + deltaX };
            break;
          case 1: // top-right
            tempPoints[0] = { ...tempPoints[0], y: tempPoints[0].y + deltaY };
            tempPoints[2] = { ...tempPoints[2], x: tempPoints[2].x + deltaX };
            break;
          case 2: // bottom-right
            tempPoints[1] = { ...tempPoints[1], x: tempPoints[1].x + deltaX };
            tempPoints[3] = { ...tempPoints[3], y: tempPoints[3].y + deltaY };
            break;
          case 3: // bottom-left
            tempPoints[0] = { ...tempPoints[0], x: tempPoints[0].x + deltaX };
            tempPoints[2] = { ...tempPoints[2], y: tempPoints[2].y + deltaY };
            break;
        }
        
        const tempCell = new Cell({
          id: resizeState.current.cellId,
          points: tempPoints,
          lines: [],
        });

        // Check edge-to-edge snapping
        const initialCorner = newPoints[cornerIndex];
        const edgeSnapResult = calculateResizeEdgeSnap(
          tempCell,
          cornerIndex,
          { x: newCornerX, y: newCornerY },
          initialCorner,
          resizeState.current.cellId,
          otherCells,
          snapThresholdInSvg
        );

        // Also check corner-to-corner snapping
        const cornerSnapResult = calculateCornerSnap(
          { x: newCornerX, y: newCornerY },
          resizeState.current.cellId,
          otherCells,
          snapThresholdInSvg
        );

        // Prefer edge snapping over corner snapping (edge snapping is more useful for alignment)
        if (edgeSnapResult.snapped) {
          finalCornerX = edgeSnapResult.snappedX;
          finalCornerY = edgeSnapResult.snappedY;
          snapMatchedCellId = edgeSnapResult.matchedCellId;
          snapMatchedCellIds = edgeSnapResult.matchedCellIds;
        } else if (cornerSnapResult.snapped) {
          finalCornerX = cornerSnapResult.snappedX;
          finalCornerY = cornerSnapResult.snappedY;
        }

        // Update snap preview
        if (onSnapPreview && (edgeSnapResult.snapped || cornerSnapResult.snapped)) {
          // Create preview cell with snapped corner
          const previewPoints = [...tempPoints];
          previewPoints[cornerIndex] = { x: finalCornerX, y: finalCornerY };
          
          // Update adjacent corners for preview
          const finalDeltaX = finalCornerX - newPoints[cornerIndex].x;
          const finalDeltaY = finalCornerY - newPoints[cornerIndex].y;
          switch (cornerIndex) {
            case 0: // top-left
              previewPoints[1] = { ...previewPoints[1], y: previewPoints[1].y + finalDeltaY };
              previewPoints[3] = { ...previewPoints[3], x: previewPoints[3].x + finalDeltaX };
              break;
            case 1: // top-right
              previewPoints[0] = { ...previewPoints[0], y: previewPoints[0].y + finalDeltaY };
              previewPoints[2] = { ...previewPoints[2], x: previewPoints[2].x + finalDeltaX };
              break;
            case 2: // bottom-right
              previewPoints[1] = { ...previewPoints[1], x: previewPoints[1].x + finalDeltaX };
              previewPoints[3] = { ...previewPoints[3], y: previewPoints[3].y + finalDeltaY };
              break;
            case 3: // bottom-left
              previewPoints[0] = { ...previewPoints[0], x: previewPoints[0].x + finalDeltaX };
              previewPoints[2] = { ...previewPoints[2], y: previewPoints[2].y + finalDeltaY };
              break;
          }
          
          onSnapPreview({
            show: true,
            points: previewPoints,
            matchedCellId: snapMatchedCellId,
            matchedCellIds: snapMatchedCellIds,
          });
        } else if (onSnapPreview) {
          onSnapPreview(null);
        }
      } else if (onSnapPreview) {
        onSnapPreview(null);
      }

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
    [cells, onResize, getContainerRect, snapEnabled, snapThreshold, onSnapPreview]
  );

  const handleMouseUp = useCallback(() => {
    if (resizeState.current.cellId) {
      if (onSnapPreview) {
        onSnapPreview(null);
      }
      onResizeEnd();
      resizeState.current = {
        cellId: null,
        cornerIndex: null,
        initialPoints: null,
        startX: 0,
        startY: 0,
        imageOffset: { x: 0, y: 0 },
        scale: 1,
      };
    }
  }, [onResizeEnd, onSnapPreview]);

  return {
    handleCornerMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
}

