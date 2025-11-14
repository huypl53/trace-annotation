import { Cell } from '../models/Cell';
import { Point } from '../models/types';

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

const PADDING = 2;
const HEIGHT_PADDING = 3;

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
 * Checks if an invisible border edge is wrong by detecting patterns in the border region
 */
async function checkBorderEdge(
  cell: Cell,
  edge: 'top' | 'bottom' | 'left' | 'right',
  imageData: ImageData,
  imageWidth: number,
  imageHeight: number
): Promise<boolean> {
  const bounds = cell.getBounds();
  let x1: number, y1: number, x2: number, y2: number;
  let rectX: number, rectY: number, rectWidth: number, rectHeight: number;

  if (edge === 'top' || edge === 'bottom') {
    // Horizontal edge
    const y = edge === 'top' ? bounds.minY : bounds.maxY;
    x1 = bounds.minX;
    x2 = bounds.maxX;
    
    // Create rectangle: from x1+2 to x2-2, height from y-3 to y+3
    rectX = x1 + PADDING;
    rectY = y - HEIGHT_PADDING;
    rectWidth = (x2 - PADDING) - (x1 + PADDING);
    rectHeight = HEIGHT_PADDING * 2;
    
    // Validate dimensions
    if (rectWidth <= 0 || rectHeight <= 0) {
      return false; // Edge is too short, assume border is OK
    }
  } else {
    // Vertical edge
    const x = edge === 'left' ? bounds.minX : bounds.maxX;
    y1 = bounds.minY;
    y2 = bounds.maxY;
    
    // Create rectangle: from y1+2 to y2-2, width from x-3 to x+3
    rectX = x - HEIGHT_PADDING;
    rectY = y1 + PADDING;
    rectWidth = HEIGHT_PADDING * 2;
    rectHeight = (y2 - PADDING) - (y1 + PADDING);
    
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
  
  // If there's no pattern, the border is wrong (should be visible)
  return !hasPattern;
}

/**
 * Detects wrong invisible borders for all cells
 */
export async function detectWrongBorders(
  cells: Cell[],
  imageUrl: string
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

        // Check each cell's invisible borders
        for (const cell of cells) {
          const bounds = cell.getBounds();

          // Check top edge if invisible
          if (cell.lines.top === 0) {
            const isWrong = await checkBorderEdge(cell, 'top', imageData, img.width, img.height);
            if (isWrong) {
              wrongBorders.push({
                x1: bounds.minX,
                y1: bounds.minY,
                x2: bounds.maxX,
                y2: bounds.minY,
                cellId: cell.id,
                edge: 'top',
              });
            }
          }

          // Check bottom edge if invisible
          if (cell.lines.bottom === 0) {
            const isWrong = await checkBorderEdge(cell, 'bottom', imageData, img.width, img.height);
            if (isWrong) {
              wrongBorders.push({
                x1: bounds.minX,
                y1: bounds.maxY,
                x2: bounds.maxX,
                y2: bounds.maxY,
                cellId: cell.id,
                edge: 'bottom',
              });
            }
          }

          // Check left edge if invisible
          if (cell.lines.left === 0) {
            const isWrong = await checkBorderEdge(cell, 'left', imageData, img.width, img.height);
            if (isWrong) {
              wrongBorders.push({
                x1: bounds.minX,
                y1: bounds.minY,
                x2: bounds.minX,
                y2: bounds.maxY,
                cellId: cell.id,
                edge: 'left',
              });
            }
          }

          // Check right edge if invisible
          if (cell.lines.right === 0) {
            const isWrong = await checkBorderEdge(cell, 'right', imageData, img.width, img.height);
            if (isWrong) {
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

