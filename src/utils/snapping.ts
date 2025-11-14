import { Cell } from '../models/Cell';
import { Point } from '../models/types';

const SNAP_THRESHOLD = 8;

export interface SnapResult {
  snapped: boolean;
  deltaX: number;
  deltaY: number;
}

export interface CornerSnapResult {
  snapped: boolean;
  snappedX: number;
  snappedY: number;
}

export function calculateSnap(
  draggedCell: Cell,
  otherCells: Cell[],
  deltaX: number,
  deltaY: number
): SnapResult {
  const draggedBounds = draggedCell.getBounds();
  const newLeft = draggedBounds.minX + deltaX;
  const newRight = draggedBounds.maxX + deltaX;
  const newTop = draggedBounds.minY + deltaY;
  const newBottom = draggedBounds.maxY + deltaY;

  let bestSnapX = deltaX;
  let bestSnapY = deltaY;
  let snapped = false;

  for (const otherCell of otherCells) {
    if (otherCell.id === draggedCell.id) continue;

    const otherBounds = otherCell.getBounds();
    const otherLeft = otherBounds.minX;
    const otherRight = otherBounds.maxX;
    const otherTop = otherBounds.minY;
    const otherBottom = otherBounds.maxY;

    // Check horizontal snapping (left/right edges)
    const distToOtherLeft = Math.abs(newRight - otherLeft);
    const distToOtherRight = Math.abs(newLeft - otherRight);

    if (distToOtherLeft < SNAP_THRESHOLD && distToOtherLeft < Math.abs(bestSnapX - deltaX)) {
      bestSnapX = otherLeft - draggedBounds.maxX;
      snapped = true;
    }
    if (distToOtherRight < SNAP_THRESHOLD && distToOtherRight < Math.abs(bestSnapX - deltaX)) {
      bestSnapX = otherRight - draggedBounds.minX;
      snapped = true;
    }

    // Check vertical snapping (top/bottom edges)
    const distToOtherTop = Math.abs(newBottom - otherTop);
    const distToOtherBottom = Math.abs(newTop - otherBottom);

    if (distToOtherTop < SNAP_THRESHOLD && distToOtherTop < Math.abs(bestSnapY - deltaY)) {
      bestSnapY = otherTop - draggedBounds.maxY;
      snapped = true;
    }
    if (distToOtherBottom < SNAP_THRESHOLD && distToOtherBottom < Math.abs(bestSnapY - deltaY)) {
      bestSnapY = otherBottom - draggedBounds.minY;
      snapped = true;
    }
  }

  return {
    snapped,
    deltaX: bestSnapX,
    deltaY: bestSnapY,
  };
}

/**
 * Calculates corner-to-corner snapping for resize operations
 * Finds the nearest corner from other cells and snaps the dragged corner to it
 * @param draggedCorner The current position of the corner being dragged
 * @param draggedCellId The ID of the cell being resized
 * @param otherCells Other cells to snap to
 * @param snapThreshold The snap threshold in original image coordinates (default: 8 pixels scaled)
 */
export function calculateCornerSnap(
  draggedCorner: Point,
  draggedCellId: string,
  otherCells: Cell[],
  snapThreshold: number = SNAP_THRESHOLD
): CornerSnapResult {
  let bestSnapX = draggedCorner.x;
  let bestSnapY = draggedCorner.y;
  let minDistance = Infinity;
  let snapped = false;

  for (const otherCell of otherCells) {
    if (otherCell.id === draggedCellId) continue;

    // Get all corners of the other cell
    const corners = otherCell.points;

    for (const corner of corners) {
      const distance = Math.sqrt(
        Math.pow(draggedCorner.x - corner.x, 2) + Math.pow(draggedCorner.y - corner.y, 2)
      );

      if (distance < snapThreshold && distance < minDistance) {
        minDistance = distance;
        bestSnapX = corner.x;
        bestSnapY = corner.y;
        snapped = true;
      }
    }
  }

  return {
    snapped,
    snappedX: bestSnapX,
    snappedY: bestSnapY,
  };
}

