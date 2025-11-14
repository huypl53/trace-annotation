import { Cell } from '../models/Cell';

export interface SharedBorderSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  cell1Id: string;
  cell2Id: string;
}

const EXACT_TOLERANCE = 0.1; // Small tolerance for floating point comparison
const APPROXIMATE_TOLERANCE = 5; // 5 pixels tolerance for approximately aligned borders

/**
 * Checks if two values are approximately equal (within tolerance)
 */
function approximatelyEqual(a: number, b: number, tolerance: number = EXACT_TOLERANCE): boolean {
  return Math.abs(a - b) < tolerance;
}

/**
 * Checks if two values are approximately aligned (within 5 pixels)
 */
function approximatelyAligned(a: number, b: number, tolerance: number = APPROXIMATE_TOLERANCE): boolean {
  return Math.abs(a - b) < tolerance;
}

/**
 * Gets the overlapping range between two intervals
 */
function getOverlap(
  min1: number,
  max1: number,
  min2: number,
  max2: number
): { min: number; max: number } | null {
  const overlapMin = Math.max(min1, min2);
  const overlapMax = Math.min(max1, max2);
  if (overlapMin <= overlapMax) {
    return { min: overlapMin, max: overlapMax };
  }
  return null;
}

/**
 * Finds shared borders between two cells with conflicting visibility
 * Also detects borders that are approximately aligned (within 5 pixels)
 */
export function findConflictingSharedBorders(cell1: Cell, cell2: Cell): SharedBorderSegment[] {
  const conflicts: SharedBorderSegment[] = [];

  const bounds1 = cell1.getBounds();
  const bounds2 = cell2.getBounds();

  // Check horizontal borders (top/bottom)
  // Cell1's top edge vs Cell2's bottom edge
  if (approximatelyAligned(bounds1.minY, bounds2.maxY)) {
    const overlap = getOverlap(bounds1.minX, bounds1.maxX, bounds2.minX, bounds2.maxX);
    if (overlap && cell1.lines.top !== cell2.lines.bottom) {
      // Use average Y position for the conflict line
      const avgY = (bounds1.minY + bounds2.maxY) / 2;
      conflicts.push({
        x1: overlap.min,
        y1: avgY,
        x2: overlap.max,
        y2: avgY,
        cell1Id: cell1.id,
        cell2Id: cell2.id,
      });
    }
  }

  // Cell1's bottom edge vs Cell2's top edge
  if (approximatelyAligned(bounds1.maxY, bounds2.minY)) {
    const overlap = getOverlap(bounds1.minX, bounds1.maxX, bounds2.minX, bounds2.maxX);
    if (overlap && cell1.lines.bottom !== cell2.lines.top) {
      // Use average Y position for the conflict line
      const avgY = (bounds1.maxY + bounds2.minY) / 2;
      conflicts.push({
        x1: overlap.min,
        y1: avgY,
        x2: overlap.max,
        y2: avgY,
        cell1Id: cell1.id,
        cell2Id: cell2.id,
      });
    }
  }

  // Check if Cell1's top edge is approximately aligned with Cell2's top edge
  if (approximatelyAligned(bounds1.minY, bounds2.minY)) {
    const overlap = getOverlap(bounds1.minX, bounds1.maxX, bounds2.minX, bounds2.maxX);
    if (overlap && cell1.lines.top !== cell2.lines.top) {
      const avgY = (bounds1.minY + bounds2.minY) / 2;
      conflicts.push({
        x1: overlap.min,
        y1: avgY,
        x2: overlap.max,
        y2: avgY,
        cell1Id: cell1.id,
        cell2Id: cell2.id,
      });
    }
  }

  // Check if Cell1's bottom edge is approximately aligned with Cell2's bottom edge
  if (approximatelyAligned(bounds1.maxY, bounds2.maxY)) {
    const overlap = getOverlap(bounds1.minX, bounds1.maxX, bounds2.minX, bounds2.maxX);
    if (overlap && cell1.lines.bottom !== cell2.lines.bottom) {
      const avgY = (bounds1.maxY + bounds2.maxY) / 2;
      conflicts.push({
        x1: overlap.min,
        y1: avgY,
        x2: overlap.max,
        y2: avgY,
        cell1Id: cell1.id,
        cell2Id: cell2.id,
      });
    }
  }

  // Check vertical borders (left/right)
  // Cell1's left edge vs Cell2's right edge
  if (approximatelyAligned(bounds1.minX, bounds2.maxX)) {
    const overlap = getOverlap(bounds1.minY, bounds1.maxY, bounds2.minY, bounds2.maxY);
    if (overlap && cell1.lines.left !== cell2.lines.right) {
      // Use average X position for the conflict line
      const avgX = (bounds1.minX + bounds2.maxX) / 2;
      conflicts.push({
        x1: avgX,
        y1: overlap.min,
        x2: avgX,
        y2: overlap.max,
        cell1Id: cell1.id,
        cell2Id: cell2.id,
      });
    }
  }

  // Cell1's right edge vs Cell2's left edge
  if (approximatelyAligned(bounds1.maxX, bounds2.minX)) {
    const overlap = getOverlap(bounds1.minY, bounds1.maxY, bounds2.minY, bounds2.maxY);
    if (overlap && cell1.lines.right !== cell2.lines.left) {
      // Use average X position for the conflict line
      const avgX = (bounds1.maxX + bounds2.minX) / 2;
      conflicts.push({
        x1: avgX,
        y1: overlap.min,
        x2: avgX,
        y2: overlap.max,
        cell1Id: cell1.id,
        cell2Id: cell2.id,
      });
    }
  }

  // Check if Cell1's left edge is approximately aligned with Cell2's left edge
  if (approximatelyAligned(bounds1.minX, bounds2.minX)) {
    const overlap = getOverlap(bounds1.minY, bounds1.maxY, bounds2.minY, bounds2.maxY);
    if (overlap && cell1.lines.left !== cell2.lines.left) {
      const avgX = (bounds1.minX + bounds2.minX) / 2;
      conflicts.push({
        x1: avgX,
        y1: overlap.min,
        x2: avgX,
        y2: overlap.max,
        cell1Id: cell1.id,
        cell2Id: cell2.id,
      });
    }
  }

  // Check if Cell1's right edge is approximately aligned with Cell2's right edge
  if (approximatelyAligned(bounds1.maxX, bounds2.maxX)) {
    const overlap = getOverlap(bounds1.minY, bounds1.maxY, bounds2.minY, bounds2.maxY);
    if (overlap && cell1.lines.right !== cell2.lines.right) {
      const avgX = (bounds1.maxX + bounds2.maxX) / 2;
      conflicts.push({
        x1: avgX,
        y1: overlap.min,
        x2: avgX,
        y2: overlap.max,
        cell1Id: cell1.id,
        cell2Id: cell2.id,
      });
    }
  }

  return conflicts;
}

/**
 * Finds all conflicting shared borders in a collection of cells
 */
export function findAllConflictingBorders(cells: Cell[]): SharedBorderSegment[] {
  const allConflicts: SharedBorderSegment[] = [];
  const processedPairs = new Set<string>();

  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const cell1 = cells[i];
      const cell2 = cells[j];

      // Create a unique key for this pair to avoid duplicates
      const pairKey = [cell1.id, cell2.id].sort().join('-');
      if (processedPairs.has(pairKey)) {
        continue;
      }
      processedPairs.add(pairKey);

      const conflicts = findConflictingSharedBorders(cell1, cell2);
      allConflicts.push(...conflicts);
    }
  }

  return allConflicts;
}

