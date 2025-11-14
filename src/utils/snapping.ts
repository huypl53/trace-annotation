import { Cell } from '../models/Cell';
import { Point } from '../models/types';

const DEFAULT_SNAP_THRESHOLD = 5;

export type EdgeType = 'left' | 'right' | 'top' | 'bottom';

/**
 * Detects which edge of a cell is nearest to a given point
 */
export function detectNearestEdge(cell: Cell, point: Point): EdgeType {
  const bounds = cell.getBounds();
  const distToLeft = Math.abs(point.x - bounds.minX);
  const distToRight = Math.abs(point.x - bounds.maxX);
  const distToTop = Math.abs(point.y - bounds.minY);
  const distToBottom = Math.abs(point.y - bounds.maxY);

  const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);

  if (minDist === distToLeft) return 'left';
  if (minDist === distToRight) return 'right';
  if (minDist === distToTop) return 'top';
  return 'bottom';
}

export interface SnapResult {
  snapped: boolean;
  deltaX: number;
  deltaY: number;
  matchedCellId: string | null;
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
  deltaY: number,
  snapThreshold: number = DEFAULT_SNAP_THRESHOLD,
  targetEdge?: EdgeType // Only snap this specific edge
): SnapResult {
  const draggedBounds = draggedCell.getBounds();
  const newLeft = draggedBounds.minX + deltaX;
  const newRight = draggedBounds.maxX + deltaX;
  const newTop = draggedBounds.minY + deltaY;
  const newBottom = draggedBounds.maxY + deltaY;

  let bestSnapX = deltaX;
  let bestSnapY = deltaY;
  let bestDistX = Infinity;
  let bestDistY = Infinity;
  let snapped = false;
  let matchedCellId: string | null = null;
  let bestMatchCellId: string | null = null;
  let bestMatchCombinedDist = Infinity;

  for (const otherCell of otherCells) {
    if (otherCell.id === draggedCell.id) continue;

    const otherBounds = otherCell.getBounds();
    const otherLeft = otherBounds.minX;
    const otherRight = otherBounds.maxX;
    const otherTop = otherBounds.minY;
    const otherBottom = otherBounds.maxY;

    // Only check snapping for the target edge if specified
    // Otherwise, check all edges (backward compatibility)

    // Check horizontal snapping (left/right edges)
    if (!targetEdge || targetEdge === 'right') {
      // Case 1: Dragged cell's right edge aligns with other cell's left edge
      const distToOtherLeft = Math.abs(newRight - otherLeft);
      if (distToOtherLeft < snapThreshold && distToOtherLeft < bestDistX) {
        // If within threshold, snap regardless of movement direction
        // This ensures snap preview shows when edges are close enough
        bestSnapX = otherLeft - draggedBounds.maxX;
        bestDistX = distToOtherLeft;
        snapped = true;
        matchedCellId = otherCell.id;
        // Track best overall match
        if (distToOtherLeft < bestMatchCombinedDist) {
          bestMatchCombinedDist = distToOtherLeft;
          bestMatchCellId = otherCell.id;
        }
      }
    }

    if (!targetEdge || targetEdge === 'left') {
      // Case 2: Dragged cell's left edge aligns with other cell's right edge
      const distToOtherRight = Math.abs(newLeft - otherRight);
      if (distToOtherRight < snapThreshold && distToOtherRight < bestDistX) {
        // If within threshold, snap regardless of movement direction
        // This ensures snap preview shows when edges are close enough
        bestSnapX = otherRight - draggedBounds.minX;
        bestDistX = distToOtherRight;
        snapped = true;
        matchedCellId = otherCell.id;
        // Track best overall match
        if (distToOtherRight < bestMatchCombinedDist) {
          bestMatchCombinedDist = distToOtherRight;
          bestMatchCellId = otherCell.id;
        }
      }
    }

    // Check vertical snapping (top/bottom edges)
    if (!targetEdge || targetEdge === 'bottom') {
      // Case 3: Dragged cell's bottom edge aligns with other cell's top edge
      const distToOtherTop = Math.abs(newBottom - otherTop);
      if (distToOtherTop < snapThreshold && distToOtherTop < bestDistY) {
        // If within threshold, snap regardless of movement direction
        // This ensures snap preview shows when edges are close enough
        bestSnapY = otherTop - draggedBounds.maxY;
        bestDistY = distToOtherTop;
        snapped = true;
        matchedCellId = otherCell.id;
        // Track best overall match
        if (distToOtherTop < bestMatchCombinedDist) {
          bestMatchCombinedDist = distToOtherTop;
          bestMatchCellId = otherCell.id;
        }
      }
    }

    if (!targetEdge || targetEdge === 'top') {
      // Case 4: Dragged cell's top edge aligns with other cell's bottom edge
      const distToOtherBottom = Math.abs(newTop - otherBottom);
      if (distToOtherBottom < snapThreshold && distToOtherBottom < bestDistY) {
        // If within threshold, snap regardless of movement direction
        // This ensures snap preview shows when edges are close enough
        bestSnapY = otherBottom - draggedBounds.minY;
        bestDistY = distToOtherBottom;
        snapped = true;
        matchedCellId = otherCell.id;
        // Track best overall match
        if (distToOtherBottom < bestMatchCombinedDist) {
          bestMatchCombinedDist = distToOtherBottom;
          bestMatchCellId = otherCell.id;
        }
      }
    }
  }

  // Use the best overall match if we have one
  if (snapped && bestMatchCellId) {
    matchedCellId = bestMatchCellId;
  }
  
  // Ensure matchedCellId is set if snapped is true (fallback to first matched cell)
  if (snapped && !matchedCellId && bestMatchCellId) {
    matchedCellId = bestMatchCellId;
  }

  return {
    snapped,
    deltaX: bestSnapX,
    deltaY: bestSnapY,
    matchedCellId: matchedCellId || null,
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
  snapThreshold: number = DEFAULT_SNAP_THRESHOLD
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

