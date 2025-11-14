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
  matchedCellIds: string[]; // Array of all matched cell IDs (for highlighting multiple cells)
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
  _targetEdge?: EdgeType // Currently unused - checks all edges to find closest alignment
): SnapResult {
  if (otherCells.length === 0) {
    return {
      snapped: false,
      deltaX,
      deltaY,
      matchedCellId: null,
      matchedCellIds: [],
    };
  }

  const draggedBounds = draggedCell.getBounds();
  const newLeft = draggedBounds.minX + deltaX;
  const newRight = draggedBounds.maxX + deltaX;
  const newTop = draggedBounds.minY + deltaY;
  const newBottom = draggedBounds.maxY + deltaY;

  // Step 1: Check all cells for edge-to-edge distances (not just closest by corner)
  // This allows us to find cells close in horizontal AND vertical directions
  const horizontalSnaps: Array<{ 
    cellId: string; 
    type: 'left-right' | 'right-left'; 
    distance: number; 
    snapX: number 
  }> = [];
  
  const verticalSnaps: Array<{ 
    cellId: string; 
    type: 'top-bottom' | 'bottom-top'; 
    distance: number; 
    snapY: number 
  }> = [];

  for (const otherCell of otherCells) {
    if (otherCell.id === draggedCell.id) continue;

    const otherBounds = otherCell.getBounds();
    const otherLeft = otherBounds.minX;
    const otherRight = otherBounds.maxX;
    const otherTop = otherBounds.minY;
    const otherBottom = otherBounds.maxY;

    // Check horizontal edge distances
    // Dragged cell's right edge to other cell's left edge
    const distRightLeft = Math.abs(newRight - otherLeft);
    if (distRightLeft < snapThreshold) {
      horizontalSnaps.push({
        cellId: otherCell.id,
        type: 'right-left',
        distance: distRightLeft,
        snapX: otherLeft - draggedBounds.maxX,
      });
    }

    // Dragged cell's left edge to other cell's right edge
    const distLeftRight = Math.abs(newLeft - otherRight);
    if (distLeftRight < snapThreshold) {
      horizontalSnaps.push({
        cellId: otherCell.id,
        type: 'left-right',
        distance: distLeftRight,
        snapX: otherRight - draggedBounds.minX,
      });
    }

    // Check vertical edge distances
    // Dragged cell's bottom edge to other cell's top edge
    const distBottomTop = Math.abs(newBottom - otherTop);
    if (distBottomTop < snapThreshold) {
      verticalSnaps.push({
        cellId: otherCell.id,
        type: 'bottom-top',
        distance: distBottomTop,
        snapY: otherTop - draggedBounds.maxY,
      });
    }

    // Dragged cell's top edge to other cell's bottom edge
    const distTopBottom = Math.abs(newTop - otherBottom);
    if (distTopBottom < snapThreshold) {
      verticalSnaps.push({
        cellId: otherCell.id,
        type: 'top-bottom',
        distance: distTopBottom,
        snapY: otherBottom - draggedBounds.minY,
      });
    }
  }

  // Step 2: Find the best horizontal and vertical snaps
  let bestSnapX = deltaX;
  let bestSnapY = deltaY;
  let snapped = false;
  let matchedCellId: string | null = null;

  const bestHorizontalSnap = horizontalSnaps.length > 0
    ? horizontalSnaps.reduce((best, current) => current.distance < best.distance ? current : best)
    : null;

  const bestVerticalSnap = verticalSnaps.length > 0
    ? verticalSnaps.reduce((best, current) => current.distance < best.distance ? current : best)
    : null;

  // Step 3: Apply snaps - if both directions have close cells, snap to both
  const matchedCellIds: string[] = [];
  
  if (bestHorizontalSnap && bestVerticalSnap) {
    // Both horizontal and vertical snaps are available - apply both
    bestSnapX = bestHorizontalSnap.snapX;
    bestSnapY = bestVerticalSnap.snapY;
    snapped = true;
    // Collect both cell IDs (they might be the same or different)
    matchedCellIds.push(bestHorizontalSnap.cellId);
    if (bestVerticalSnap.cellId !== bestHorizontalSnap.cellId) {
      matchedCellIds.push(bestVerticalSnap.cellId);
    }
    // Use the cell with the smaller distance, or prefer horizontal if equal
    matchedCellId = bestHorizontalSnap.distance <= bestVerticalSnap.distance
      ? bestHorizontalSnap.cellId
      : bestVerticalSnap.cellId;
  } else if (bestHorizontalSnap) {
    // Only horizontal snap available
    bestSnapX = bestHorizontalSnap.snapX;
    snapped = true;
    matchedCellId = bestHorizontalSnap.cellId;
    matchedCellIds.push(bestHorizontalSnap.cellId);
  } else if (bestVerticalSnap) {
    // Only vertical snap available
    bestSnapY = bestVerticalSnap.snapY;
    snapped = true;
    matchedCellId = bestVerticalSnap.cellId;
    matchedCellIds.push(bestVerticalSnap.cellId);
  }

  const result = {
    snapped,
    deltaX: bestSnapX,
    deltaY: bestSnapY,
    matchedCellId,
    matchedCellIds,
  };

  return result;
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

