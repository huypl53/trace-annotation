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
  _targetEdge?: EdgeType // Currently unused - checks all edges to find closest alignment
): SnapResult {
  if (otherCells.length === 0) {
    return {
      snapped: false,
      deltaX,
      deltaY,
      matchedCellId: null,
    };
  }

  const draggedBounds = draggedCell.getBounds();
  const newLeft = draggedBounds.minX + deltaX;
  const newRight = draggedBounds.maxX + deltaX;
  const newTop = draggedBounds.minY + deltaY;
  const newBottom = draggedBounds.maxY + deltaY;

  // Step 1: Find the closest cell by calculating minimum corner-to-corner distance
  let closestCell: Cell | null = null;
  let minCornerDistance = Infinity;

  // Calculate corners of dragged cell at new position
  const draggedCorners = draggedCell.points.map(p => ({
    x: p.x + deltaX,
    y: p.y + deltaY,
  }));

  for (const otherCell of otherCells) {
    if (otherCell.id === draggedCell.id) continue;

    // Calculate minimum corner-to-corner distance between dragged cell and other cell
    let cellMinDistance = Infinity;
    for (const draggedCorner of draggedCorners) {
      for (const otherCorner of otherCell.points) {
        const distance = Math.sqrt(
          Math.pow(draggedCorner.x - otherCorner.x, 2) +
          Math.pow(draggedCorner.y - otherCorner.y, 2)
        );
        if (distance < cellMinDistance) {
          cellMinDistance = distance;
        }
      }
    }

    // Track the closest cell
    if (cellMinDistance < minCornerDistance) {
      minCornerDistance = cellMinDistance;
      closestCell = otherCell;
    }
  }

  // If no closest cell found, return no snap
  if (!closestCell) {
    return {
      snapped: false,
      deltaX,
      deltaY,
      matchedCellId: null,
    };
  }

  // Step 2: For the closest cell, calculate horizontal and vertical edge distances
  const otherBounds = closestCell.getBounds();
  const otherLeft = otherBounds.minX;
  const otherRight = otherBounds.maxX;
  const otherTop = otherBounds.minY;
  const otherBottom = otherBounds.maxY;

  // Calculate all possible horizontal edge distances
  // Check all edges regardless of targetEdge - we want to find the closest alignment
  const horizontalDistances: Array<{ type: 'left-right' | 'right-left'; distance: number; snapX: number }> = [];

  // Dragged cell's right edge to other cell's left edge
  const distRightLeft = Math.abs(newRight - otherLeft);
  if (distRightLeft < snapThreshold) {
    horizontalDistances.push({
      type: 'right-left',
      distance: distRightLeft,
      snapX: otherLeft - draggedBounds.maxX,
    });
  }

  // Dragged cell's left edge to other cell's right edge
  const distLeftRight = Math.abs(newLeft - otherRight);
  if (distLeftRight < snapThreshold) {
    horizontalDistances.push({
      type: 'left-right',
      distance: distLeftRight,
      snapX: otherRight - draggedBounds.minX,
    });
  }

  // Calculate all possible vertical edge distances
  const verticalDistances: Array<{ type: 'top-bottom' | 'bottom-top'; distance: number; snapY: number }> = [];

  // Dragged cell's bottom edge to other cell's top edge
  const distBottomTop = Math.abs(newBottom - otherTop);
  if (distBottomTop < snapThreshold) {
    verticalDistances.push({
      type: 'bottom-top',
      distance: distBottomTop,
      snapY: otherTop - draggedBounds.maxY,
    });
  }

  // Dragged cell's top edge to other cell's bottom edge
  const distTopBottom = Math.abs(newTop - otherBottom);
  if (distTopBottom < snapThreshold) {
    verticalDistances.push({
      type: 'top-bottom',
      distance: distTopBottom,
      snapY: otherBottom - draggedBounds.minY,
    });
  }

  // Step 3: Apply snap based on the smallest horizontal OR vertical distance
  let bestSnapX = deltaX;
  let bestSnapY = deltaY;
  let snapped = false;

  // Find minimum horizontal distance
  const minHorizontalDist = horizontalDistances.length > 0
    ? Math.min(...horizontalDistances.map(d => d.distance))
    : Infinity;

  // Find minimum vertical distance
  const minVerticalDist = verticalDistances.length > 0
    ? Math.min(...verticalDistances.map(d => d.distance))
    : Infinity;

  // Apply snap based on whichever is smaller (horizontal or vertical)
  if (minHorizontalDist < Infinity && minVerticalDist < Infinity) {
    // Both are within threshold - use the smaller one
    if (minHorizontalDist <= minVerticalDist) {
      const bestHorizontal = horizontalDistances.find(d => d.distance === minHorizontalDist)!;
      bestSnapX = bestHorizontal.snapX;
      snapped = true;
    } else {
      const bestVertical = verticalDistances.find(d => d.distance === minVerticalDist)!;
      bestSnapY = bestVertical.snapY;
      snapped = true;
    }
  } else if (minHorizontalDist < Infinity) {
    // Only horizontal is within threshold
    const bestHorizontal = horizontalDistances.find(d => d.distance === minHorizontalDist)!;
    bestSnapX = bestHorizontal.snapX;
    snapped = true;
  } else if (minVerticalDist < Infinity) {
    // Only vertical is within threshold
    const bestVertical = verticalDistances.find(d => d.distance === minVerticalDist)!;
    bestSnapY = bestVertical.snapY;
    snapped = true;
  }

  const result = {
    snapped,
    deltaX: bestSnapX,
    deltaY: bestSnapY,
    matchedCellId: snapped ? closestCell.id : null,
  };

  // Debug logging
  if (closestCell) {
    console.log('[Snap Debug] calculateSnap: Distance analysis');
    console.log('  draggedCellId:', draggedCell.id);
    console.log('  closestCellId:', closestCell.id);
    console.log('  minCornerDistance:', minCornerDistance);
    console.log('  snapThreshold:', snapThreshold);
    console.log('  draggedBounds:', { minX: draggedBounds.minX, minY: draggedBounds.minY, maxX: draggedBounds.maxX, maxY: draggedBounds.maxY });
    console.log('  newPosition:', { newLeft, newRight, newTop, newBottom });
    console.log('  otherBounds:', { minX: otherLeft, minY: otherTop, maxX: otherRight, maxY: otherBottom });
    console.log('  edgeDistances (all):', {
      rightToLeft: distRightLeft,
      leftToRight: distLeftRight,
      bottomToTop: distBottomTop,
      topToBottom: distTopBottom,
    });
    console.log('  horizontalDistances (within threshold):', JSON.stringify(horizontalDistances));
    console.log('  verticalDistances (within threshold):', JSON.stringify(verticalDistances));
    console.log('  minHorizontalDist:', minHorizontalDist === Infinity ? 'Infinity' : minHorizontalDist);
    console.log('  minVerticalDist:', minVerticalDist === Infinity ? 'Infinity' : minVerticalDist);
    console.log('  snapped:', result.snapped);
    console.log('  matchedCellId:', result.matchedCellId);
    console.log('  result.deltaX:', result.deltaX, 'result.deltaY:', result.deltaY);
  } else {
    console.log('[Snap Debug] calculateSnap: No closest cell found');
    console.log('  otherCellsCount:', otherCells.length);
  }

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

