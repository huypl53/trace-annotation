import { useCallback, useRef } from 'react';
import { Cell } from '../models/Cell';
import { Point } from '../models/types';
import { calculateCornerSnap, calculateResizeEdgeSnap } from '../utils/snapping';

interface UseCellResizeOptions {
  onResize: (cellId: string, points: Point[]) => void;
  onResizeEnd: () => void;
  cells: Cell[];
  scale: number;
  imageOffset: { x: number; y: number };
  getContainerRect?: () => DOMRect | null;
  snapEnabled?: boolean;
  snapThreshold?: number;
  onSnapPreview?: (preview: { show: boolean; points: Point[]; matchedCellId: string | null; matchedCellIds: string[] } | null) => void;
  selectedCellIds?: Set<string>;
  onMultiCellResize?: (cellId: string, deltaWidth: number, deltaHeight: number, initialCellData: { points: Point[]; bounds: { width: number; height: number } }) => void;
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
  selectedCellIds = new Set(),
  onMultiCellResize,
}: UseCellResizeOptions) {
  const resizeState = useRef<{
    cellId: string | null;
    cornerIndex: number | null;
    initialPoints: Point[] | null;
    initialBounds: { width: number; height: number } | null;
    startX: number;
    startY: number;
    imageOffset: { x: number; y: number }; // Store offset at resize start to prevent jitter
    scale: number; // Store scale at resize start to prevent jitter
    selectedCellIds: Set<string>;
    initialCells: Map<string, { points: Point[]; bounds: { width: number; height: number } }>;
  }>({
    cellId: null,
    cornerIndex: null,
    initialPoints: null,
    initialBounds: null,
    startX: 0,
    startY: 0,
    imageOffset: { x: 0, y: 0 },
    scale: 1,
    selectedCellIds: new Set(),
    initialCells: new Map(),
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

      // Calculate initial bounds for the primary cell
      const bounds = {
        minX: Math.min(...initialPoints.map(p => p.x)),
        minY: Math.min(...initialPoints.map(p => p.y)),
        maxX: Math.max(...initialPoints.map(p => p.x)),
        maxY: Math.max(...initialPoints.map(p => p.y)),
      };
      const initialBounds = {
        width: bounds.maxX - bounds.minX,
        height: bounds.maxY - bounds.minY,
      };

      // Store initial state for all selected cells (if multiple selection)
      const cellsToResize = selectedCellIds.has(cellId) && selectedCellIds.size > 1 
        ? selectedCellIds 
        : new Set([cellId]);
      
      const initialCells = new Map<string, { points: Point[]; bounds: { width: number; height: number } }>();
      cellsToResize.forEach(id => {
        const cell = cells.find(c => c.id === id);
        if (cell) {
          const cellBounds = {
            minX: Math.min(...cell.points.map(p => p.x)),
            minY: Math.min(...cell.points.map(p => p.y)),
            maxX: Math.max(...cell.points.map(p => p.x)),
            maxY: Math.max(...cell.points.map(p => p.y)),
          };
          initialCells.set(id, {
            points: [...cell.points],
            bounds: {
              width: cellBounds.maxX - cellBounds.minX,
              height: cellBounds.maxY - cellBounds.minY,
            },
          });
        }
      });

      resizeState.current = {
        cellId,
        cornerIndex,
        initialPoints: [...initialPoints],
        initialBounds,
        startX: svgX,
        startY: svgY,
        imageOffset: { ...imageOffset }, // Store offset at resize start
        scale, // Store scale at resize start
        selectedCellIds: new Set(cellsToResize),
        initialCells,
      };
    },
    [scale, imageOffset, getContainerRect, selectedCellIds, cells]
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

      // Calculate new bounds for primary cell
      const newBounds = {
        minX: Math.min(...newPoints.map(p => p.x)),
        minY: Math.min(...newPoints.map(p => p.y)),
        maxX: Math.max(...newPoints.map(p => p.x)),
        maxY: Math.max(...newPoints.map(p => p.y)),
      };
      const newWidth = newBounds.maxX - newBounds.minX;
      const newHeight = newBounds.maxY - newBounds.minY;

      // Calculate delta width and height
      const deltaWidth = newWidth - (resizeState.current.initialBounds?.width || 0);
      const deltaHeight = newHeight - (resizeState.current.initialBounds?.height || 0);

      // Update primary cell
      if (resizeState.current.cellId) {
        onResize(resizeState.current.cellId, newPoints);
      }

      // If multiple cells are selected, apply same delta width/height to all other cells
      if (onMultiCellResize && resizeState.current.selectedCellIds.size > 1) {
        resizeState.current.selectedCellIds.forEach(cellId => {
          if (cellId !== resizeState.current.cellId) {
            const initialCellData = resizeState.current.initialCells.get(cellId);
            if (initialCellData) {
              onMultiCellResize(cellId, deltaWidth, deltaHeight, initialCellData);
            }
          }
        });
      }
    },
    [cells, onResize, getContainerRect, snapEnabled, snapThreshold, onSnapPreview, onMultiCellResize]
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
        initialBounds: null,
        startX: 0,
        startY: 0,
        imageOffset: { x: 0, y: 0 },
        scale: 1,
        selectedCellIds: new Set(),
        initialCells: new Map(),
      };
    }
  }, [onResizeEnd, onSnapPreview]);

  return {
    handleCornerMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
}

