import { Point } from '../models/types';

/**
 * Calculates the intersection of two polygons using the Sutherland-Hodgman clipping algorithm
 * @param polygon1 First polygon
 * @param polygon2 Second polygon (clipping polygon)
 * @returns Intersection polygon, or null if no intersection
 */
export function polygonIntersection(polygon1: Point[], polygon2: Point[]): Point[] | null {
  if (polygon1.length < 3 || polygon2.length < 3) {
    return null;
  }

  // Special case: if both are rectangles (4 points), use optimized rectangle intersection
  if (polygon1.length === 4 && polygon2.length === 4) {
    const rectIntersection = rectangleIntersection(polygon1, polygon2);
    if (rectIntersection) {
      return rectIntersection;
    }
  }

  // Normalize polygons to counter-clockwise winding
  const normalized1 = normalizeWinding(polygon1);
  const normalized2 = normalizeWinding(polygon2);

  // Try both directions and return the best result
  const result1 = computeIntersection(normalized1, normalized2);
  const result2 = computeIntersection(normalized2, normalized1);
  
  // Return the result with more points (more complete intersection)
  if (result1 && result2) {
    return result1.length >= result2.length ? result1 : result2;
  }
  return result1 || result2;
}

/**
 * Optimized rectangle intersection for 4-point rectangular polygons
 */
function rectangleIntersection(rect1: Point[], rect2: Point[]): Point[] | null {
  const bounds1 = getBounds(rect1);
  const bounds2 = getBounds(rect2);

  // Calculate intersection rectangle
  const minX = Math.max(bounds1.minX, bounds2.minX);
  const maxX = Math.min(bounds1.maxX, bounds2.maxX);
  const minY = Math.max(bounds1.minY, bounds2.minY);
  const maxY = Math.min(bounds1.maxY, bounds2.maxY);

  // Check if there's a valid intersection
  if (minX >= maxX || minY >= maxY) {
    return null;
  }

  // Return intersection rectangle as polygon
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
}

/**
 * Normalizes polygon winding to counter-clockwise
 */
function normalizeWinding(polygon: Point[]): Point[] {
  // Calculate signed area to determine winding
  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    area += (polygon[j].x - polygon[i].x) * (polygon[j].y + polygon[i].y);
  }

  // If clockwise (negative area), reverse the polygon
  if (area < 0) {
    return [...polygon].reverse();
  }

  return [...polygon];
}

/**
 * Computes intersection by clipping polygon1 against polygon2
 */
function computeIntersection(polygon1: Point[], polygon2: Point[]): Point[] | null {
  let result: Point[] = [...polygon1];

  // Clip polygon1 against each edge of polygon2
  for (let i = 0; i < polygon2.length; i++) {
    const edgeStart = polygon2[i];
    const edgeEnd = polygon2[(i + 1) % polygon2.length];
    
    result = clipPolygon(result, edgeStart, edgeEnd);
    
    if (result.length < 3) {
      return null; // No valid intersection
    }
  }

  return result.length > 0 ? result : null;
}

/**
 * Clips a polygon against a single edge using the Sutherland-Hodgman algorithm
 */
function clipPolygon(polygon: Point[], edgeStart: Point, edgeEnd: Point): Point[] {
  const output: Point[] = [];
  
  // Edge vector
  const edgeVector = { x: edgeEnd.x - edgeStart.x, y: edgeEnd.y - edgeStart.y };
  
  // Normal vector pointing to the left of the edge (for counter-clockwise polygons)
  // This points "inside" the clipping polygon if it's wound counter-clockwise
  const normal = { x: -edgeVector.y, y: edgeVector.x };

  for (let i = 0; i < polygon.length; i++) {
    const currentPoint = polygon[i];
    const prevPoint = polygon[(i - 1 + polygon.length) % polygon.length];
    
    const currentInside = isInside(currentPoint, edgeStart, normal);
    const prevInside = isInside(prevPoint, edgeStart, normal);

    if (currentInside) {
      if (!prevInside) {
        // Entering the clipping region - add intersection point
        const intersection = getIntersection(prevPoint, currentPoint, edgeStart, edgeEnd);
        if (intersection) {
          output.push(intersection);
        }
      }
      // Current point is inside - add it
      output.push(currentPoint);
    } else if (prevInside) {
      // Exiting the clipping region - add intersection point
      const intersection = getIntersection(prevPoint, currentPoint, edgeStart, edgeEnd);
      if (intersection) {
        output.push(intersection);
      }
      // Current point is outside - don't add it
    }
  }

  return output;
}

/**
 * Checks if a point is inside the clipping edge
 */
function isInside(point: Point, edgeStart: Point, normal: Point): boolean {
  const toPoint = { x: point.x - edgeStart.x, y: point.y - edgeStart.y };
  const dot = toPoint.x * normal.x + toPoint.y * normal.y;
  return dot >= 0;
}

/**
 * Calculates the intersection point of two line segments
 */
function getIntersection(
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point
): Point | null {
  const denom = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  
  if (Math.abs(denom) < 1e-10) {
    return null; // Lines are parallel
  }

  const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denom;
  
  return {
    x: p1.x + t * (p2.x - p1.x),
    y: p1.y + t * (p2.y - p1.y),
  };
}

/**
 * Checks if two polygons overlap by testing bounding box intersection first,
 * then computing the actual polygon intersection
 */
export function findOverlappingCells(cells: Array<{ id: string; points: Point[] }>): Array<{
  cell1Id: string;
  cell2Id: string;
  intersection: Point[];
}> {
  const overlaps: Array<{
    cell1Id: string;
    cell2Id: string;
    intersection: Point[];
  }> = [];

  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const cell1 = cells[i];
      const cell2 = cells[j];

      // Quick bounding box check
      if (!boundingBoxesOverlap(cell1.points, cell2.points)) {
        continue;
      }

      // Calculate actual polygon intersection
      const intersection = polygonIntersection(cell1.points, cell2.points);
      if (intersection && intersection.length >= 3) {
        overlaps.push({
          cell1Id: cell1.id,
          cell2Id: cell2.id,
          intersection,
        });
      }
    }
  }

  return overlaps;
}

/**
 * Checks if two polygons' bounding boxes overlap
 */
function boundingBoxesOverlap(points1: Point[], points2: Point[]): boolean {
  const bounds1 = getBounds(points1);
  const bounds2 = getBounds(points2);

  return !(
    bounds1.maxX < bounds2.minX ||
    bounds2.maxX < bounds1.minX ||
    bounds1.maxY < bounds2.minY ||
    bounds2.maxY < bounds1.minY
  );
}

/**
 * Gets the bounding box of a set of points
 */
function getBounds(points: Point[]): { minX: number; minY: number; maxX: number; maxY: number } {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

