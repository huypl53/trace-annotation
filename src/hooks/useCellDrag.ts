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
    initialBounds: { minX: number; minY: number } | null; // Store initial bounds for position tracking
    containerRect: DOMRect | null;
    targetEdge: EdgeType | null; // The edge nearest to the mouse click
    snapDeltaX: number; // Stored snap delta for use on mouse up
    snapDeltaY: number; // Stored snap delta for use on mouse up
    imageOffset: { x: number; y: number }; // Store offset at drag start to prevent jitter
    scale: number; // Store scale at drag start to prevent jitter
    lastTargetX: number; // Track the last target X position we calculated
    lastTargetY: number; // Track the last target Y position we calculated
  }>({
    cellId: null,
    startX: 0,
    startY: 0,
    initialCell: null,
    initialBounds: null,
    containerRect: null,
    targetEdge: null,
    snapDeltaX: 0,
    snapDeltaY: 0,
    imageOffset: { x: 0, y: 0 },
    scale: 1,
    lastTargetX: 0,
    lastTargetY: 0,
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

      const initialBounds = cell.getBounds();

      dragState.current = {
        cellId,
        startX: svgX,
        startY: svgY,
        initialCell: new Cell(cell.toData()),
        initialBounds: { minX: initialBounds.minX, minY: initialBounds.minY },
        containerRect: containerRect,
        targetEdge,
        snapDeltaX: 0,
        snapDeltaY: 0,
        imageOffset: { ...imageOffset }, // Store offset at drag start
        scale, // Store scale at drag start
        lastTargetX: initialBounds.minX, // Initialize to initial position
        lastTargetY: initialBounds.minY, // Initialize to initial position
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

      // Use stored offset and scale from drag start to prevent jitter
      const storedOffset = dragState.current.imageOffset;
      const storedScale = dragState.current.scale;

      // Calculate mouse position relative to container, then to image, then to SVG coordinates
      const mouseX = containerRect ? e.clientX - containerRect.left : e.clientX;
      const mouseY = containerRect ? e.clientY - containerRect.top : e.clientY;
      const svgX = (mouseX - storedOffset.x) / storedScale;
      const svgY = (mouseY - storedOffset.y) / storedScale;

      // Calculate raw delta from initial mouse position
      const rawDeltaX = svgX - dragState.current.startX;
      const rawDeltaY = svgY - dragState.current.startY;

      // Calculate where the cell should be based on initial position + mouse delta
      // This is the same calculation used by the snap preview, ensuring consistency
      if (!dragState.current.initialBounds) return;
      const targetX = dragState.current.initialBounds.minX + rawDeltaX;
      const targetY = dragState.current.initialBounds.minY + rawDeltaY;

      // Get the actual current cell position to detect drift
      const currentCell = cells.find(c => c.id === dragState.current.cellId);
      if (!currentCell) return;

      const currentBounds = currentCell.getBounds();
      const currentX = currentBounds.minX;
      const currentY = currentBounds.minY;

      // Check if our tracked position has drifted significantly from the actual position
      // If so, sync it to prevent accumulation errors
      const driftX = Math.abs(dragState.current.lastTargetX - currentX);
      const driftY = Math.abs(dragState.current.lastTargetY - currentY);
      const maxDrift = 0.1; // Allow small drift to avoid jitter from async state

      if (driftX > maxDrift || driftY > maxDrift) {
        // Sync tracked position with actual position to correct drift
        dragState.current.lastTargetX = currentX;
        dragState.current.lastTargetY = currentY;
      }

      // Calculate the incremental delta from the last target position
      const incrementalDeltaX = targetX - dragState.current.lastTargetX;
      const incrementalDeltaY = targetY - dragState.current.lastTargetY;

      // Only apply movement if there's a meaningful change (avoid micro-movements)
      if (Math.abs(incrementalDeltaX) > 0.001 || Math.abs(incrementalDeltaY) > 0.001) {
        // Apply the incremental movement
        onDrag(dragState.current.cellId, incrementalDeltaX, incrementalDeltaY);

        // Update tracked position to match what we just requested
        dragState.current.lastTargetX = targetX;
        dragState.current.lastTargetY = targetY;
      }

      // Calculate snap preview for visual feedback
      const otherCells = cells.filter(c => c.id !== dragState.current.cellId);
      const snapThreshold = 5 / storedScale; // Convert screen pixels (5px) to image coordinates
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
    [cells, onDrag, getContainerRect]
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
        initialBounds: null,
        containerRect: null,
        targetEdge: null,
        snapDeltaX: 0,
        snapDeltaY: 0,
        imageOffset: { x: 0, y: 0 },
        scale: 1,
        lastTargetX: 0,
        lastTargetY: 0,
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

