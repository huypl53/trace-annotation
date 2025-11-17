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

export interface ResizeEdgeSnapResult {
  snapped: boolean;
  snappedX: number;
  snappedY: number;
  matchedCellId: string | null;
  matchedCellIds: string[];
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

/**
 * Calculates edge-to-edge snapping for resize operations
 * When resizing a cell by dragging a corner, checks if the edges align with other cell edges
 * @param resizedCell The cell being resized (with new points after corner movement)
 * @param draggedCornerIndex The index of the corner being dragged (0=top-left, 1=top-right, 2=bottom-right, 3=bottom-left)
 * @param draggedCorner The current position of the corner being dragged
 * @param initialCorner The initial position of the corner before dragging
 * @param draggedCellId The ID of the cell being resized
 * @param otherCells Other cells to snap to
 * @param snapThreshold The snap threshold in original image coordinates
 */
export function calculateResizeEdgeSnap(
  resizedCell: Cell,
  draggedCornerIndex: number,
  draggedCorner: Point,
  initialCorner: Point,
  draggedCellId: string,
  otherCells: Cell[],
  snapThreshold: number = DEFAULT_SNAP_THRESHOLD
): ResizeEdgeSnapResult {
  if (otherCells.length === 0) {
    return {
      snapped: false,
      snappedX: draggedCorner.x,
      snappedY: draggedCorner.y,
      matchedCellId: null,
      matchedCellIds: [],
    };
  }

  // Get the cell's points to understand the current state
  const cellPoints = resizedCell.points;
  
  // Determine which edges are affected by the dragged corner
  // 0=top-left (affects left and top), 1=top-right (affects right and top)
  // 2=bottom-right (affects right and bottom), 3=bottom-left (affects left and bottom)
  const affectsLeft = draggedCornerIndex === 0 || draggedCornerIndex === 3;
  const affectsRight = draggedCornerIndex === 1 || draggedCornerIndex === 2;
  const affectsTop = draggedCornerIndex === 0 || draggedCornerIndex === 1;
  const affectsBottom = draggedCornerIndex === 2 || draggedCornerIndex === 3;

  // Calculate the current edge positions based on the dragged corner
  // When dragging a corner, the edge directly controlled by that corner is at the corner's position
  // The opposite edge is at the opposite corner's position
  let currentLeft: number;
  let currentRight: number;
  let currentTop: number;
  let currentBottom: number;
  
  if (draggedCornerIndex === 0) {
    // top-left: left edge at corner.x, top edge at corner.y
    currentLeft = draggedCorner.x;
    currentTop = draggedCorner.y;
    currentRight = cellPoints[2].x; // bottom-right corner x
    currentBottom = cellPoints[2].y; // bottom-right corner y
  } else if (draggedCornerIndex === 1) {
    // top-right: right edge at corner.x, top edge at corner.y
    currentRight = draggedCorner.x;
    currentTop = draggedCorner.y;
    currentLeft = cellPoints[3].x; // bottom-left corner x
    currentBottom = cellPoints[2].y; // bottom-right corner y
  } else if (draggedCornerIndex === 2) {
    // bottom-right: right edge at corner.x, bottom edge at corner.y
    currentRight = draggedCorner.x;
    currentBottom = draggedCorner.y;
    currentLeft = cellPoints[0].x; // top-left corner x
    currentTop = cellPoints[0].y; // top-left corner y
  } else {
    // bottom-left: left edge at corner.x, bottom edge at corner.y
    currentLeft = draggedCorner.x;
    currentBottom = draggedCorner.y;
    currentRight = cellPoints[1].x; // top-right corner x
    currentTop = cellPoints[0].y; // top-left corner y
  }

  const horizontalSnaps: Array<{
    cellId: string;
    type: 'left' | 'right';
    distance: number;
    snapX: number;
  }> = [];

  const verticalSnaps: Array<{
    cellId: string;
    type: 'top' | 'bottom';
    distance: number;
    snapY: number;
  }> = [];

  for (const otherCell of otherCells) {
    if (otherCell.id === draggedCellId) continue;

    const otherBounds = otherCell.getBounds();
    const otherLeft = otherBounds.minX;
    const otherRight = otherBounds.maxX;
    const otherTop = otherBounds.minY;
    const otherBottom = otherBounds.maxY;

    // Check horizontal edge alignment
    if (affectsLeft) {
      // Check if resized cell's left edge aligns with other cell's right edge
      const distLeftRight = Math.abs(currentLeft - otherRight);
      if (distLeftRight < snapThreshold) {
        // To align left edge to otherRight, set the corner X to otherRight
        // The left edge is directly at the corner's X when dragging top-left or bottom-left
        horizontalSnaps.push({
          cellId: otherCell.id,
          type: 'left',
          distance: distLeftRight,
          snapX: otherRight, // Left edge should be at otherRight, so corner X should be otherRight
        });
      }
      // Check if resized cell's left edge aligns with other cell's left edge
      const distLeftLeft = Math.abs(currentLeft - otherLeft);
      if (distLeftLeft < snapThreshold) {
        horizontalSnaps.push({
          cellId: otherCell.id,
          type: 'left',
          distance: distLeftLeft,
          snapX: otherLeft, // Left edge should be at otherLeft, so corner X should be otherLeft
        });
      }
    }

    if (affectsRight) {
      // Check if resized cell's right edge aligns with other cell's left edge
      const distRightLeft = Math.abs(currentRight - otherLeft);
      if (distRightLeft < snapThreshold) {
        // To align right edge to otherLeft, set the corner X to otherLeft
        // The right edge is directly at the corner's X when dragging top-right or bottom-right
        horizontalSnaps.push({
          cellId: otherCell.id,
          type: 'right',
          distance: distRightLeft,
          snapX: otherLeft, // Right edge should be at otherLeft, so corner X should be otherLeft
        });
      }
      // Check if resized cell's right edge aligns with other cell's right edge
      const distRightRight = Math.abs(currentRight - otherRight);
      if (distRightRight < snapThreshold) {
        horizontalSnaps.push({
          cellId: otherCell.id,
          type: 'right',
          distance: distRightRight,
          snapX: otherRight, // Right edge should be at otherRight, so corner X should be otherRight
        });
      }
    }

    // Check vertical edge alignment
    if (affectsTop) {
      // Check if resized cell's top edge aligns with other cell's bottom edge
      const distTopBottom = Math.abs(currentTop - otherBottom);
      if (distTopBottom < snapThreshold) {
        // To align top edge to otherBottom, set the corner Y to otherBottom
        // The top edge is directly at the corner's Y when dragging top-left or top-right
        verticalSnaps.push({
          cellId: otherCell.id,
          type: 'top',
          distance: distTopBottom,
          snapY: otherBottom, // Top edge should be at otherBottom, so corner Y should be otherBottom
        });
      }
      // Check if resized cell's top edge aligns with other cell's top edge
      const distTopTop = Math.abs(currentTop - otherTop);
      if (distTopTop < snapThreshold) {
        verticalSnaps.push({
          cellId: otherCell.id,
          type: 'top',
          distance: distTopTop,
          snapY: otherTop, // Top edge should be at otherTop, so corner Y should be otherTop
        });
      }
    }

    if (affectsBottom) {
      // Check if resized cell's bottom edge aligns with other cell's top edge
      const distBottomTop = Math.abs(currentBottom - otherTop);
      if (distBottomTop < snapThreshold) {
        // To align bottom edge to otherTop, set the corner Y to otherTop
        // The bottom edge is directly at the corner's Y when dragging bottom-left or bottom-right
        verticalSnaps.push({
          cellId: otherCell.id,
          type: 'bottom',
          distance: distBottomTop,
          snapY: otherTop, // Bottom edge should be at otherTop, so corner Y should be otherTop
        });
      }
      // Check if resized cell's bottom edge aligns with other cell's bottom edge
      const distBottomBottom = Math.abs(currentBottom - otherBottom);
      if (distBottomBottom < snapThreshold) {
        verticalSnaps.push({
          cellId: otherCell.id,
          type: 'bottom',
          distance: distBottomBottom,
          snapY: otherBottom, // Bottom edge should be at otherBottom, so corner Y should be otherBottom
        });
      }
    }
  }

  // Find the best horizontal and vertical snaps
  const bestHorizontalSnap = horizontalSnaps.length > 0
    ? horizontalSnaps.reduce((best, current) => current.distance < best.distance ? current : best)
    : null;

  const bestVerticalSnap = verticalSnaps.length > 0
    ? verticalSnaps.reduce((best, current) => current.distance < best.distance ? current : best)
    : null;

  let snappedX = draggedCorner.x;
  let snappedY = draggedCorner.y;
  let snapped = false;
  let matchedCellId: string | null = null;
  const matchedCellIds: string[] = [];

  if (bestHorizontalSnap && bestVerticalSnap) {
    // Both horizontal and vertical snaps available
    snappedX = bestHorizontalSnap.snapX;
    snappedY = bestVerticalSnap.snapY;
    snapped = true;
    matchedCellIds.push(bestHorizontalSnap.cellId);
    if (bestVerticalSnap.cellId !== bestHorizontalSnap.cellId) {
      matchedCellIds.push(bestVerticalSnap.cellId);
    }
    matchedCellId = bestHorizontalSnap.distance <= bestVerticalSnap.distance
      ? bestHorizontalSnap.cellId
      : bestVerticalSnap.cellId;
  } else if (bestHorizontalSnap) {
    // Only horizontal snap available
    snappedX = bestHorizontalSnap.snapX;
    snapped = true;
    matchedCellId = bestHorizontalSnap.cellId;
    matchedCellIds.push(bestHorizontalSnap.cellId);
  } else if (bestVerticalSnap) {
    // Only vertical snap available
    snappedY = bestVerticalSnap.snapY;
    snapped = true;
    matchedCellId = bestVerticalSnap.cellId;
    matchedCellIds.push(bestVerticalSnap.cellId);
  }

  return {
    snapped,
    snappedX,
    snappedY,
    matchedCellId,
    matchedCellIds,
  };
}

