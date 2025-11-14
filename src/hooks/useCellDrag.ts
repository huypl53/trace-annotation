import { useCallback, useRef, useState } from 'react';
import { Cell } from '../models/Cell';
import { calculateSnap, detectNearestEdge, EdgeType } from '../utils/snapping';

interface UseCellDragOptions {
  onDrag: (cellId: string, deltaX: number, deltaY: number) => void;
  onDragEnd: (shouldSnap: boolean, snapDeltaX: number, snapDeltaY: number) => void;
  cells: Cell[];
  scale: number;
  imageOffset: { x: number; y: number };
  getContainerRect?: () => DOMRect | null;
}

export interface SnapPreview {
  show: boolean;
  points: { x: number; y: number }[];
}

export function useCellDrag({ onDrag, onDragEnd, cells, scale, imageOffset, getContainerRect }: UseCellDragOptions) {
  const [snapPreview, setSnapPreview] = useState<SnapPreview | null>(null);

  const dragState = useRef<{
    cellId: string | null;
    startX: number;
    startY: number;
    initialCell: Cell | null;
    containerRect: DOMRect | null;
    targetEdge: EdgeType | null; // The edge nearest to the mouse click
    snapDeltaX: number; // Stored snap delta for use on mouse up
    snapDeltaY: number; // Stored snap delta for use on mouse up
  }>({
    cellId: null,
    startX: 0,
    startY: 0,
    initialCell: null,
    containerRect: null,
    targetEdge: null,
    snapDeltaX: 0,
    snapDeltaY: 0,
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

      // Detect which edge of the cell is nearest to the mouse click
      const targetEdge = detectNearestEdge(cell, { x: svgX, y: svgY });

      dragState.current = {
        cellId,
        startX: svgX,
        startY: svgY,
        initialCell: new Cell(cell.toData()),
        containerRect: containerRect,
        targetEdge,
        snapDeltaX: 0,
        snapDeltaY: 0,
      };
      setSnapPreview(null);
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

      // Always move the cell to follow the mouse (no snapping during drag)
      onDrag(dragState.current.cellId, neededDeltaX, neededDeltaY);

      // Calculate snap preview for visual feedback
      const otherCells = cells.filter(c => c.id !== dragState.current.cellId);
      const snapThreshold = 5 / scale; // Convert screen pixels (5px) to image coordinates
      const snapResult = calculateSnap(
        dragState.current.initialCell,
        otherCells,
        rawDeltaX,
        rawDeltaY,
        snapThreshold,
        dragState.current.targetEdge || undefined // Only snap the detected edge
      );

      // Update snap preview
      if (snapResult.snapped) {
        // Store the snap deltas relative to initial position for use on mouse up
        dragState.current.snapDeltaX = snapResult.deltaX;
        dragState.current.snapDeltaY = snapResult.deltaY;

        // Create a preview cell at the snapped position
        const previewCell = new Cell(dragState.current.initialCell.toData());
        previewCell.move(snapResult.deltaX, snapResult.deltaY);

        setSnapPreview({
          show: true,
          points: previewCell.points,
        });
      } else {
        dragState.current.snapDeltaX = 0;
        dragState.current.snapDeltaY = 0;
        setSnapPreview({
          show: false,
          points: [],
        });
      }
    },
    [cells, scale, imageOffset, onDrag, getContainerRect]
  );

  const handleMouseUp = useCallback(() => {
    if (dragState.current.cellId) {
      // Check if we should apply snap on release
      const shouldSnap = snapPreview?.show || false;
      let snapDeltaX = 0;
      let snapDeltaY = 0;

      if (shouldSnap && dragState.current.initialCell) {
        const currentCell = cells.find(c => c.id === dragState.current.cellId);
        if (currentCell) {
          const initialBounds = dragState.current.initialCell.getBounds();
          const currentBounds = currentCell.getBounds();

          // Calculate the delta needed to move from current position to snapped position
          // The snap deltas are stored relative to the initial position
          const snappedTargetX = initialBounds.minX + dragState.current.snapDeltaX;
          const snappedTargetY = initialBounds.minY + dragState.current.snapDeltaY;

          // Calculate the delta from current position to snapped position
          snapDeltaX = snappedTargetX - currentBounds.minX;
          snapDeltaY = snappedTargetY - currentBounds.minY;
        }
      }

      onDragEnd(shouldSnap, snapDeltaX, snapDeltaY);
      dragState.current = {
        cellId: null,
        startX: 0,
        startY: 0,
        initialCell: null,
        containerRect: null,
        targetEdge: null,
        snapDeltaX: 0,
        snapDeltaY: 0,
      };
      setSnapPreview(null);
    }
  }, [onDragEnd, cells, snapPreview]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    snapPreview,
  };
}

