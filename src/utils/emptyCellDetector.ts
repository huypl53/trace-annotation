import { Cell } from '../models/Cell';
import { Point } from '../models/types';

export interface EmptyCell {
  points: Point[];
}

/**
 * Detects empty cells in a table structure using a canvas-based approach (similar to cv2).
 * 1. Extracts grid lines from cell boundaries
 * 2. Draws grid on binary image (canvas)
 * 3. Fills cells with white
 * 4. Finds holes (black areas) which represent unfulfilled areas
 */
export function detectEmptyCells(cells: Cell[]): EmptyCell[] {
  if (cells.length === 0) {
    return [];
  }

  // Step 0: Calculate grid bounds from all cell coordinates
  let gridMinX = Infinity;
  let gridMaxX = -Infinity;
  let gridMinY = Infinity;
  let gridMaxY = -Infinity;

  for (const cell of cells) {
    const bounds = cell.getBounds();
    gridMinX = Math.min(gridMinX, bounds.minX);
    gridMaxX = Math.max(gridMaxX, bounds.maxX);
    gridMinY = Math.min(gridMinY, bounds.minY);
    gridMaxY = Math.max(gridMaxY, bounds.maxY);
  }

  const gridWidth = gridMaxX - gridMinX;
  const gridHeight = gridMaxY - gridMinY;

  // Step 1: Extract and cluster grid lines from cell boundaries
  // Use clustering to handle slight misalignments and find actual grid structure
  const TOLERANCE = 2; // Pixels tolerance for clustering boundaries

  const horizontalPositions: number[] = [];
  const verticalPositions: number[] = [];

  for (const cell of cells) {
    const bounds = cell.getBounds();
    horizontalPositions.push(bounds.minY, bounds.maxY);
    verticalPositions.push(bounds.minX, bounds.maxX);
  }

  // Cluster positions that are close together
  const clusterPositions = (positions: number[], tolerance: number): number[] => {
    const sorted = [...positions].sort((a, b) => a - b);
    const clusters: number[] = [];

    for (const pos of sorted) {
      // Check if this position is close to an existing cluster
      const existingCluster = clusters.find(cluster => Math.abs(cluster - pos) <= tolerance);
      if (!existingCluster) {
        clusters.push(pos);
      } else {
        // Update cluster to average position for better alignment
        const index = clusters.indexOf(existingCluster);
        clusters[index] = (clusters[index] + pos) / 2;
      }
    }

    return clusters.sort((a, b) => a - b);
  };

  const sortedHorizontalLines = clusterPositions(horizontalPositions, TOLERANCE);
  const sortedVerticalLines = clusterPositions(verticalPositions, TOLERANCE);

  // Step 2: Create a binary image (canvas) using grid bounds - white background, black grid
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(gridWidth);
  canvas.height = Math.ceil(gridHeight);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return [];
  }

  // Fill with white (background)
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Helper to convert original coordinates to grid-relative coordinates
  const toGridX = (x: number) => x - gridMinX;
  const toGridY = (y: number) => y - gridMinY;

  // Draw grid lines in black (thicker to ensure they remain visible)
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 2;

  // Draw horizontal grid lines
  for (const y of sortedHorizontalLines) {
    const gridY = toGridY(y);
    ctx.beginPath();
    ctx.moveTo(0, gridY);
    ctx.lineTo(canvas.width, gridY);
    ctx.stroke();
  }

  // Draw vertical grid lines
  for (const x of sortedVerticalLines) {
    const gridX = toGridX(x);
    ctx.beginPath();
    ctx.moveTo(gridX, 0);
    ctx.lineTo(gridX, canvas.height);
    ctx.stroke();
  }

  // Step 3: Fill cells with white (this will cover grid lines inside cells)
  ctx.fillStyle = 'white';
  for (const cell of cells) {
    const points = cell.points;
    if (points.length < 3) continue;

    ctx.beginPath();
    ctx.moveTo(toGridX(points[0].x), toGridY(points[0].y));
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(toGridX(points[i].x), toGridY(points[i].y));
    }
    ctx.closePath();
    ctx.fill();
  }

  // Redraw grid lines on top to ensure they separate empty cells
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 3; // Thicker to ensure visibility
  for (const y of sortedHorizontalLines) {
    const gridY = toGridY(y);
    ctx.beginPath();
    ctx.moveTo(0, gridY);
    ctx.lineTo(canvas.width, gridY);
    ctx.stroke();
  }
  for (const x of sortedVerticalLines) {
    const gridX = toGridX(x);
    ctx.beginPath();
    ctx.moveTo(gridX, 0);
    ctx.lineTo(gridX, canvas.height);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over'; // Reset

  // Step 4: Find holes (black areas) in the image
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const visited = new Set<number>();

  const emptyCells: EmptyCell[] = [];

  // Helper function to check if a pixel is black (hole)
  const isBlack = (x: number, y: number): boolean => {
    if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) {
      return false;
    }
    const index = (y * canvas.width + x) * 4;
    // Check if pixel is black (R, G, B all < 128)
    return data[index] < 128 && data[index + 1] < 128 && data[index + 2] < 128;
  };

  // Helper function to get pixel key
  const getKey = (x: number, y: number): number => {
    return y * canvas.width + x;
  };

  // Helper to convert grid-relative coordinates back to original coordinates
  const toOriginalX = (x: number) => x + gridMinX;
  const toOriginalY = (y: number) => y + gridMinY;

  // Flood fill to find connected black regions (holes)
  const floodFill = (startX: number, startY: number): Point[] | null => {
    const stack: Array<[number, number]> = [[startX, startY]];
    const region: Point[] = [];
    const minX = { value: startX };
    const maxX = { value: startX };
    const minY = { value: startY };
    const maxY = { value: startY };

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const key = getKey(x, y);

      if (visited.has(key) || !isBlack(x, y)) {
        continue;
      }

      visited.add(key);
      region.push({ x, y });

      minX.value = Math.min(minX.value, x);
      maxX.value = Math.max(maxX.value, x);
      minY.value = Math.min(minY.value, y);
      maxY.value = Math.max(maxY.value, y);

      // Check 4-connected neighbors
      if (isBlack(x + 1, y)) stack.push([x + 1, y]);
      if (isBlack(x - 1, y)) stack.push([x - 1, y]);
      if (isBlack(x, y + 1)) stack.push([x, y + 1]);
      if (isBlack(x, y - 1)) stack.push([x, y - 1]);
    }

    // Only return regions that are large enough to be cells (not just grid lines)
    const width = maxX.value - minX.value;
    const height = maxY.value - minY.value;
    const area = width * height;

    // Filter out thin grid lines (width or height < 5 pixels) and small noise
    if (width < 5 || height < 5 || area < 200) {
      return null;
    }

    // Create rectangular points from bounding box (in grid coordinates)
    return [
      { x: minX.value, y: minY.value },
      { x: maxX.value, y: minY.value },
      { x: maxX.value, y: maxY.value },
      { x: minX.value, y: maxY.value },
    ];
  };

  // Scan the image for black pixels (holes)
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const key = getKey(x, y);
      if (!visited.has(key) && isBlack(x, y)) {
        const points = floodFill(x, y);
        if (points) {
          // Convert points back to original coordinates
          const originalPoints = points.map(p => ({
            x: toOriginalX(p.x),
            y: toOriginalY(p.y),
          }));
          emptyCells.push({ points: originalPoints });
        }
      }
    }
  }

  return emptyCells;
}

