import { useRef, useCallback, useState } from 'react';
import { Point } from '../models/types';

interface UseCellCreateOptions {
  onCreateCell: (points: Point[]) => void;
  scale: number;
  imageOffset: { x: number; y: number };
  getContainerRect?: () => DOMRect | null;
  imageSize: { width: number; height: number } | null;
}

export function useCellCreate({
  onCreateCell,
  scale,
  imageOffset,
  getContainerRect,
  imageSize,
}: UseCellCreateOptions) {
  const [isCreating, setIsCreating] = useState(false);
  const [, forceUpdate] = useState(0);
  const createState = useRef<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  }>({
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
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

      setIsCreating(true);
      createState.current = {
        startX: originalX,
        startY: originalY,
        currentX: originalX,
        currentY: originalY,
      };
    },
    [scale, imageOffset, getContainerRect, imageSize]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isCreating || !imageSize) return;

      const containerRect = getContainerRect ? getContainerRect() : null;
      if (!containerRect) return;

      const moveX = e.clientX - containerRect.left - imageOffset.x;
      const moveY = e.clientY - containerRect.top - imageOffset.y;

      // Convert to original image coordinates
      const originalX = moveX / scale;
      const originalY = moveY / scale;

      createState.current.currentX = originalX;
      createState.current.currentY = originalY;
      // Force re-render to update preview
      forceUpdate(prev => prev + 1);
    },
    [scale, imageOffset, getContainerRect, imageSize, isCreating]
  );

  const handleMouseUp = useCallback(() => {
    if (!isCreating) return;

    const { startX, startY, currentX, currentY } = createState.current;

    // Calculate rectangle bounds
    const minX = Math.min(startX, currentX);
    const maxX = Math.max(startX, currentX);
    const minY = Math.min(startY, currentY);
    const maxY = Math.max(startY, currentY);

    // Only create cell if the rectangle has a minimum size
    const width = maxX - minX;
    const height = maxY - minY;
    if (width > 5 && height > 5) {
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
    setIsCreating(false);
    createState.current = {
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
    };
  }, [onCreateCell, isCreating]);

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

