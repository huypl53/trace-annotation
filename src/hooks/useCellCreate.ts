import { useRef, useCallback, useState } from 'react';
import { Point } from '../models/types';
import { Cell } from '../models/Cell';
import { calculateCreateSnap } from '../utils/snapping';

interface UseCellCreateOptions {
  onCreateCell: (points: Point[]) => void;
  scale: number;
  imageOffset: { x: number; y: number };
  getContainerRect?: () => DOMRect | null;
  imageSize: { width: number; height: number } | null;
  cells?: Cell[];
  snapEnabled?: boolean;
  snapThreshold?: number;
  onSnapPreview?: (preview: { show: boolean; points: Point[]; matchedCellId: string | null; matchedCellIds: string[] } | null) => void;
}

export function useCellCreate({
  onCreateCell,
  scale,
  imageOffset,
  getContainerRect,
  imageSize,
  cells = [],
  snapEnabled = true,
  snapThreshold = 5,
  onSnapPreview,
}: UseCellCreateOptions) {
  const [isCreating, setIsCreating] = useState(false);
  const [, forceUpdate] = useState(0);
  const createState = useRef<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    imageOffset: { x: number; y: number }; // Store offset at create start to prevent jitter
    scale: number; // Store scale at create start to prevent jitter
  }>({
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    imageOffset: { x: 0, y: 0 },
    scale: 1,
  });

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only handle left mouse button
      if (e.button !== 0) return;

      if (!imageSize) return;

      const containerRect = getContainerRect ? getContainerRect() : null;
      if (!containerRect) return;

      const clickX = e.clientX - containerRect.left - imageOffset.x;
      const clickY = e.clientY - containerRect.top - imageOffset.y;

      // Check if click is within image bounds
      const displayWidth = imageSize.width * scale;
      const displayHeight = imageSize.height * scale;
      if (clickX < 0 || clickX > displayWidth || clickY < 0 || clickY > displayHeight) {
        return;
      }

      // Convert to original image coordinates
      const originalX = clickX / scale;
      const originalY = clickY / scale;

      e.preventDefault();
      e.stopPropagation();

      // Clear snap preview when starting to create
      if (onSnapPreview) {
        onSnapPreview(null);
      }

      setIsCreating(true);
      createState.current = {
        startX: originalX,
        startY: originalY,
        currentX: originalX,
        currentY: originalY,
        imageOffset: { ...imageOffset }, // Store offset at create start
        scale, // Store scale at create start
      };
    },
    [scale, imageOffset, getContainerRect, imageSize, onSnapPreview]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isCreating || !imageSize) return;

      // Use stored offset and scale from create start to prevent jitter
      const storedOffset = createState.current.imageOffset;
      const storedScale = createState.current.scale;

      const containerRect = getContainerRect ? getContainerRect() : null;
      if (!containerRect) return;

      const moveX = e.clientX - containerRect.left - storedOffset.x;
      const moveY = e.clientY - containerRect.top - storedOffset.y;

      // Convert to original image coordinates
      const originalX = moveX / storedScale;
      const originalY = moveY / storedScale;

      createState.current.currentX = originalX;
      createState.current.currentY = originalY;

      // Calculate snap preview if enabled
      if (snapEnabled && cells.length > 0 && onSnapPreview) {
        const { startX, startY, currentX, currentY } = createState.current;
        const minX = Math.min(startX, currentX);
        const maxX = Math.max(startX, currentX);
        const minY = Math.min(startY, currentY);
        const maxY = Math.max(startY, currentY);

        const width = maxX - minX;
        const height = maxY - minY;

        // Only show snap preview if rectangle has minimum size
        if (width > 5 && height > 5) {
          const snapThresholdInSvg = snapThreshold / storedScale;
          const snapResult = calculateCreateSnap(
            minX,
            minY,
            maxX,
            maxY,
            cells,
            snapThresholdInSvg
          );

          if (snapResult.snapped) {
            // Create preview points with snapped bounds
            const previewPoints: Point[] = [
              { x: snapResult.snappedMinX, y: snapResult.snappedMinY }, // top-left
              { x: snapResult.snappedMaxX, y: snapResult.snappedMinY }, // top-right
              { x: snapResult.snappedMaxX, y: snapResult.snappedMaxY }, // bottom-right
              { x: snapResult.snappedMinX, y: snapResult.snappedMaxY }, // bottom-left
            ];
            onSnapPreview({
              show: true,
              points: previewPoints,
              matchedCellId: snapResult.matchedCellId,
              matchedCellIds: snapResult.matchedCellIds,
            });
          } else {
            onSnapPreview(null);
          }
        } else {
          onSnapPreview(null);
        }
      } else if (onSnapPreview) {
        onSnapPreview(null);
      }

      // Force re-render to update preview
      forceUpdate(prev => prev + 1);
    },
    [getContainerRect, imageSize, isCreating, cells, snapEnabled, snapThreshold, onSnapPreview]
  );

  const handleMouseUp = useCallback(() => {
    if (!isCreating) return;

    const { startX, startY, currentX, currentY } = createState.current;
    const storedScale = createState.current.scale;

    // Calculate rectangle bounds
    let minX = Math.min(startX, currentX);
    let maxX = Math.max(startX, currentX);
    let minY = Math.min(startY, currentY);
    let maxY = Math.max(startY, currentY);

    // Only create cell if the rectangle has a minimum size
    const width = maxX - minX;
    const height = maxY - minY;
    if (width > 5 && height > 5) {
      // Apply snap if enabled
      if (snapEnabled && cells.length > 0) {
        // Convert snap threshold from display pixels to SVG coordinates
        const snapThresholdInSvg = snapThreshold / storedScale;
        const snapResult = calculateCreateSnap(
          minX,
          minY,
          maxX,
          maxY,
          cells,
          snapThresholdInSvg
        );

        if (snapResult.snapped) {
          minX = snapResult.snappedMinX;
          minY = snapResult.snappedMinY;
          maxX = snapResult.snappedMaxX;
          maxY = snapResult.snappedMaxY;
        }
      }

      // Create cell with 4 points (rectangle)
      const points: Point[] = [
        { x: minX, y: minY }, // top-left
        { x: maxX, y: minY }, // top-right
        { x: maxX, y: maxY }, // bottom-right
        { x: minX, y: maxY }, // bottom-left
      ];
      onCreateCell(points);
    }

    // Reset state
    if (onSnapPreview) {
      onSnapPreview(null);
    }
    setIsCreating(false);
    createState.current = {
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      imageOffset: { x: 0, y: 0 },
      scale: 1,
    };
  }, [onCreateCell, isCreating, cells, snapEnabled, snapThreshold, onSnapPreview]);

  const getPreviewRect = useCallback((): { x: number; y: number; width: number; height: number } | null => {
    if (!isCreating) return null;

    const { startX, startY, currentX, currentY } = createState.current;
    const minX = Math.min(startX, currentX);
    const maxX = Math.max(startX, currentX);
    const minY = Math.min(startY, currentY);
    const maxY = Math.max(startY, currentY);

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [isCreating]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    getPreviewRect,
    isCreating,
  };
}

