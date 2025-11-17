import { Cell } from '../models/Cell';

export interface WrongBorderSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  cellId: string;
  edge: 'top' | 'bottom' | 'left' | 'right';
}

// Declare OpenCV.js types
declare global {
  interface Window {
    cv: any;
  }
}


/**
 * Loads OpenCV.js library dynamically
 */
export async function loadOpenCV(): Promise<void> {
  if (window.cv) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    // Check if script already exists
    const existingScript = document.querySelector('script[data-opencv]');
    if (existingScript) {
      const checkOpenCV = setInterval(() => {
        if (window.cv && window.cv.Mat) {
          clearInterval(checkOpenCV);
          resolve();
        }
      }, 100);
      setTimeout(() => {
        clearInterval(checkOpenCV);
        if (!window.cv) {
          reject(new Error('OpenCV.js failed to load'));
        }
      }, 10000);
      return;
    }

    const script = document.createElement('script');
    script.setAttribute('data-opencv', 'true');
    // Use official OpenCV.js from OpenCV documentation (most reliable source)
    script.src = 'https://docs.opencv.org/4.x/opencv.js';
    script.async = true;
    script.onload = () => {
      // Wait for OpenCV to be ready
      const checkOpenCV = setInterval(() => {
        if (window.cv && window.cv.Mat) {
          clearInterval(checkOpenCV);
          resolve();
        }
      }, 100);

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkOpenCV);
        if (!window.cv) {
          reject(new Error('OpenCV.js failed to load'));
        }
      }, 10000);
    };
    script.onerror = () => reject(new Error('Failed to load OpenCV.js'));
    document.head.appendChild(script);
  });
}

/**
 * Extracts a rectangular region from an image
 */
function extractRegion(
  imageData: ImageData,
  x: number,
  y: number,
  width: number,
  height: number,
  imageWidth: number,
  imageHeight: number
): ImageData | null {
  // Clamp coordinates to image bounds
  const startX = Math.max(0, Math.floor(x));
  const startY = Math.max(0, Math.floor(y));
  const endX = Math.min(imageWidth, Math.floor(x + width));
  const endY = Math.min(imageHeight, Math.floor(y + height));

  if (endX <= startX || endY <= startY) {
    return null;
  }

  const regionWidth = endX - startX;
  const regionHeight = endY - startY;
  const regionData = new Uint8ClampedArray(regionWidth * regionHeight * 4);

  for (let row = 0; row < regionHeight; row++) {
    for (let col = 0; col < regionWidth; col++) {
      const srcIndex = ((startY + row) * imageWidth + (startX + col)) * 4;
      const dstIndex = (row * regionWidth + col) * 4;

      regionData[dstIndex] = imageData.data[srcIndex]; // R
      regionData[dstIndex + 1] = imageData.data[srcIndex + 1]; // G
      regionData[dstIndex + 2] = imageData.data[srcIndex + 2]; // B
      regionData[dstIndex + 3] = imageData.data[srcIndex + 3]; // A
    }
  }

  return new ImageData(regionData, regionWidth, regionHeight);
}

/**
 * Detects if there are patterns (contours) in a border region using OpenCV
 */
async function detectPatternsInRegion(region: ImageData): Promise<boolean> {
  if (!window.cv) {
    await loadOpenCV();
  }

  try {
    const cv = window.cv;

    // Convert ImageData to OpenCV Mat
    const src = cv.matFromImageData(region);
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // Apply threshold to get binary image
    const binary = new cv.Mat();
    cv.threshold(gray, binary, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);

    // Find contours
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    // Check if any significant contours exist
    // Filter out very small contours (likely noise)
    const minContourArea = 10; // Minimum area to consider as a pattern
    let hasPattern = false;

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);
      if (area >= minContourArea) {
        hasPattern = true;
        break;
      }
    }

    // Cleanup
    src.delete();
    gray.delete();
    binary.delete();
    contours.delete();
    hierarchy.delete();

    return hasPattern;
  } catch (error) {
    console.error('Error detecting patterns:', error);
    return false;
  }
}

/**
 * Detects lines in a border region using HoughLinesP with adaptive parameters
 * Filters lines by orientation to match the edge direction
 * @param region - The image region to analyze
 * @param edge - The edge type to determine line orientation
 * @returns true if a line matching the edge orientation is detected, false otherwise
 */
async function detectLineInRegion(
  region: ImageData,
  edge: 'top' | 'bottom' | 'left' | 'right'
): Promise<boolean> {
  if (!window.cv) {
    await loadOpenCV();
  }

  try {
    const cv = window.cv;
    const width = region.width;
    const height = region.height;

    // Convert ImageData to OpenCV Mat
    const src = cv.matFromImageData(region);
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // Apply Canny edge detection with more lenient parameters
    const edges = new cv.Mat();
    cv.Canny(gray, edges, 30, 100);

    // Calculate adaptive parameters based on region size
    const isHorizontal = edge === 'top' || edge === 'bottom';
    const primaryDimension = isHorizontal ? width : height;
    const secondaryDimension = isHorizontal ? height : width;

    // More lenient adaptive parameters
    // Adaptive threshold: proportional to primary dimension (lower threshold)
    const threshold = Math.max(5, Math.floor(primaryDimension * 0.2));

    // Adaptive minLineLength: proportional to primary dimension (shorter lines)
    const minLineLength = Math.max(3, Math.floor(primaryDimension * 0.3));

    // Adaptive maxLineGap: proportional to secondary dimension (larger gaps allowed)
    const maxLineGap = Math.max(1, Math.floor(secondaryDimension * 0.5));

    // Apply HoughLinesP
    const lines = new cv.Mat();
    cv.HoughLinesP(
      edges,
      lines,
      1, // rho: distance resolution in pixels
      Math.PI / 180, // theta: angle resolution in radians
      threshold, // threshold: minimum number of intersections
      minLineLength, // minLineLength: minimum line length
      maxLineGap // maxLineGap: maximum gap between line segments
    );

    // Filter lines by orientation to match the edge direction
    const angleThreshold = Math.PI / 6; // 30 degrees tolerance
    let hasMatchingLine = false;

    for (let i = 0; i < lines.rows; i++) {
      const line = lines.data32S.subarray(i * 4, (i + 1) * 4);
      const x1 = line[0];
      const y1 = line[1];
      const x2 = line[2];
      const y2 = line[3];

      // Calculate line angle
      const dx = x2 - x1;
      const dy = y2 - y1;
      const angle = Math.atan2(Math.abs(dy), Math.abs(dx));

      if (isHorizontal) {
        // For horizontal edges, look for horizontal lines (angle close to 0)
        if (angle < angleThreshold) {
          hasMatchingLine = true;
          break;
        }
      } else {
        // For vertical edges, look for vertical lines (angle close to π/2)
        if (angle > (Math.PI / 2 - angleThreshold)) {
          hasMatchingLine = true;
          break;
        }
      }
    }

    // Cleanup
    src.delete();
    gray.delete();
    edges.delete();
    lines.delete();

    return hasMatchingLine;
  } catch (error) {
    console.error('Error detecting lines:', error);
    return false;
  }
}

/**
 * Checks if a border edge is wrong by detecting patterns in the border region
 * @param isVisible - true if the border is visible, false if invisible
 * @returns true if the border is wrong, false if correct
 */
async function checkBorderEdge(
  cell: Cell,
  edge: 'top' | 'bottom' | 'left' | 'right',
  imageData: ImageData,
  imageWidth: number,
  imageHeight: number,
  horizontalPadding: number,
  verticalPadding: number,
  isVisible: boolean
): Promise<boolean> {
  const bounds = cell.getBounds();
  let x1: number, y1: number, x2: number, y2: number;
  let rectX: number, rectY: number, rectWidth: number, rectHeight: number;

  if (edge === 'top' || edge === 'bottom') {
    // Horizontal edge
    const y = edge === 'top' ? bounds.minY : bounds.maxY;
    x1 = bounds.minX;
    x2 = bounds.maxX;

    // Calculate full width after padding
    const fullWidth = (x2 - horizontalPadding) - (x1 + horizontalPadding);
    // Take 80% of width and center it
    rectWidth = fullWidth * 0.8;
    rectX = (x1 + horizontalPadding) + (fullWidth * 0.1);
    rectY = y - verticalPadding;
    rectHeight = verticalPadding * 2;

    // Validate dimensions
    if (rectWidth <= 0 || rectHeight <= 0) {
      return false; // Edge is too short, assume border is OK
    }
  } else {
    // Vertical edge
    const x = edge === 'left' ? bounds.minX : bounds.maxX;
    y1 = bounds.minY;
    y2 = bounds.maxY;

    // Calculate full height after padding
    const fullHeight = (y2 - horizontalPadding) - (y1 + horizontalPadding);
    // Take 80% of height and center it
    rectHeight = fullHeight * 0.8;
    rectY = (y1 + horizontalPadding) + (fullHeight * 0.1);
    rectX = x - verticalPadding;
    rectWidth = verticalPadding * 2;

    // Validate dimensions
    if (rectWidth <= 0 || rectHeight <= 0) {
      return false; // Edge is too short, assume border is OK
    }
  }

  // Extract the region
  const region = extractRegion(imageData, rectX, rectY, rectWidth, rectHeight, imageWidth, imageHeight);
  if (!region) {
    return false; // Region is invalid, assume border is OK
  }

  // Detect patterns
  const hasPattern = await detectPatternsInRegion(region);

  // Validation rules:
  // - Visible border: wrong if there are no patterns (keep as is)
  // - Invisible border: wrong if has no pattern OR has line detected
  if (isVisible) {
    return !hasPattern; // Visible border is wrong if there are no patterns
  } else {
    // Invisible border: wrong if no pattern OR has line
    if (!hasPattern) {
      return true; // No patterns, border is wrong
    }
    // Has patterns, check if there's a line
    const hasLine = await detectLineInRegion(region, edge);
    return hasLine; // Invisible border is wrong if there is a line
  }
}

/**
 * Detects wrong borders for all cells
 * Validates:
 * - Visible border has no patterns around → wrong (should be invisible)
 * - Invisible border has no pattern OR has line detected → wrong (should be visible)
 */
export async function detectWrongBorders(
  cells: Cell[],
  imageUrl: string,
  horizontalPadding: number = 2,
  verticalPadding: number = 3
): Promise<WrongBorderSegment[]> {
  if (cells.length === 0 || !imageUrl) {
    return [];
  }

  // Load OpenCV if not already loaded
  await loadOpenCV();

  // Load image and get image data
  const img = new Image();
  img.crossOrigin = 'anonymous';

  return new Promise((resolve, reject) => {
    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);

        const wrongBorders: WrongBorderSegment[] = [];

        // Check each cell's borders (both visible and invisible)
        for (const cell of cells) {
          const bounds = cell.getBounds();

          // Check top edge
          const isTopVisible = cell.lines.top !== 0;
          const isTopWrong = await checkBorderEdge(
            cell,
            'top',
            imageData,
            img.width,
            img.height,
            horizontalPadding,
            verticalPadding,
            isTopVisible
          );
          if (isTopWrong) {
            wrongBorders.push({
              x1: bounds.minX,
              y1: bounds.minY,
              x2: bounds.maxX,
              y2: bounds.minY,
              cellId: cell.id,
              edge: 'top',
            });
          }

          // Check bottom edge
          const isBottomVisible = cell.lines.bottom !== 0;
          const isBottomWrong = await checkBorderEdge(
            cell,
            'bottom',
            imageData,
            img.width,
            img.height,
            horizontalPadding,
            verticalPadding,
            isBottomVisible
          );
          if (isBottomWrong) {
            wrongBorders.push({
              x1: bounds.minX,
              y1: bounds.maxY,
              x2: bounds.maxX,
              y2: bounds.maxY,
              cellId: cell.id,
              edge: 'bottom',
            });
          }

          // Check left edge
          const isLeftVisible = cell.lines.left !== 0;
          const isLeftWrong = await checkBorderEdge(
            cell,
            'left',
            imageData,
            img.width,
            img.height,
            horizontalPadding,
            verticalPadding,
            isLeftVisible
          );
          if (isLeftWrong) {
            wrongBorders.push({
              x1: bounds.minX,
              y1: bounds.minY,
              x2: bounds.minX,
              y2: bounds.maxY,
              cellId: cell.id,
              edge: 'left',
            });
          }

          // Check right edge
          const isRightVisible = cell.lines.right !== 0;
          const isRightWrong = await checkBorderEdge(
            cell,
            'right',
            imageData,
            img.width,
            img.height,
            horizontalPadding,
            verticalPadding,
            isRightVisible
          );
          if (isRightWrong) {
            wrongBorders.push({
              x1: bounds.maxX,
              y1: bounds.minY,
              x2: bounds.maxX,
              y2: bounds.maxY,
              cellId: cell.id,
              edge: 'right',
            });
          }
        }

        resolve(wrongBorders);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = imageUrl;
  });
}

