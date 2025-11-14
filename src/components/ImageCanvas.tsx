import { useEffect, useRef, useState } from 'react';
import { useCellCreate } from '../hooks/useCellCreate';
import { useCellDrag } from '../hooks/useCellDrag';
import { useCellResize } from '../hooks/useCellResize';
import { Annotation } from '../models/Annotation';
import { Point } from '../models/types';
import { BorderConflictRenderer } from './BorderConflictRenderer';
import { CellRenderer } from './CellRenderer';

interface ImageCanvasProps {
  imageUrl: string | null;
  annotation: Annotation | null;
  selectedCellId: string | null;
  onCellSelect: (cellId: string | null) => void;
  onCellMove: (cellId: string, deltaX: number, deltaY: number) => void;
  onCellMoveEnd: (shouldSnap: boolean, snapDeltaX: number, snapDeltaY: number) => void;
  onCellResize: (cellId: string, points: Point[]) => void;
  onCellResizeEnd: () => void;
  onCreateCell?: (points: Point[]) => void;
  mode: 'move' | 'resize';
  showCells?: boolean;
}

export function ImageCanvas({
  imageUrl,
  annotation,
  selectedCellId,
  onCellSelect,
  onCellMove,
  onCellMoveEnd,
  onCellResize,
  onCellResizeEnd,
  onCreateCell,
  mode,
  showCells = true,
}: ImageCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [originalImageSize, setOriginalImageSize] = useState<{ width: number; height: number } | null>(null);
  const [baseScale, setBaseScale] = useState(1);
  const [userZoom, setUserZoom] = useState(1);
  const [imageOffset, setImageOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  
  // Calculate scale: converts from original image coordinates to current display coordinates
  // displayWidth = imageSize.width * userZoom (current displayed image width in pixels)
  // originalImageSize.width = original image width in pixels
  // scale = how many display pixels per original image pixel
  const scale = originalImageSize && imageSize
    ? (imageSize.width * userZoom) / originalImageSize.width
    : baseScale * userZoom;

  const cells = annotation?.cells || [];

  // Calculate display dimensions based on originalImageSize * scale (for consistency)
  // This will be recalculated later, but we need it here for displayOffset
  const calculatedDisplayWidth = originalImageSize ? originalImageSize.width * scale : (imageSize ? imageSize.width * userZoom : 0);
  const calculatedDisplayHeight = originalImageSize ? originalImageSize.height * scale : (imageSize ? imageSize.height * userZoom : 0);

  // Calculate display offset for hooks (accounting for zoom)
  // We need to recalculate this when zoom changes to keep cells aligned
  const displayOffsetX = containerRef.current
    ? (containerRef.current.clientWidth - calculatedDisplayWidth) / 2 + panOffset.x
    : (imageSize ? imageOffset.x + panOffset.x : 0);
  const displayOffsetY = containerRef.current
    ? (containerRef.current.clientHeight - calculatedDisplayHeight) / 2 + panOffset.y
    : (imageSize ? imageOffset.y + panOffset.y : 0);
  const displayOffset = { x: displayOffsetX, y: displayOffsetY };

  const { handleMouseDown: handleCellMouseDown, handleMouseMove: handleCellMouseMove, handleMouseUp: handleCellMouseUp, snapPreview } = useCellDrag({
    onDrag: onCellMove,
    onDragEnd: onCellMoveEnd,
    cells,
    scale,
    imageOffset: displayOffset,
    getContainerRect: () => containerRef.current?.getBoundingClientRect() || null,
  });

  const { handleCornerMouseDown, handleMouseMove: handleResizeMove, handleMouseUp: handleResizeUp } = useCellResize({
    onResize: (points) => {
      if (selectedCellId) {
        onCellResize(selectedCellId, points);
      }
    },
    onResizeEnd: onCellResizeEnd,
    cells,
    scale,
    imageOffset: displayOffset,
    getContainerRect: () => containerRef.current?.getBoundingClientRect() || null,
  });

  const { handleMouseDown: handleCreateMouseDown, handleMouseMove: handleCreateMove, handleMouseUp: handleCreateUp, getPreviewRect, isCreating } = useCellCreate({
    onCreateCell: onCreateCell || (() => {}),
    scale,
    imageOffset: displayOffset,
    getContainerRect: () => containerRef.current?.getBoundingClientRect() || null,
    imageSize: imageSize ? { width: imageSize.width / baseScale, height: imageSize.height / baseScale } : null,
  });

  const handleMouseMoveCombined = (e: React.MouseEvent) => {
    if (isCreating) {
      handleCreateMove(e);
    } else if (mode === 'resize') {
      handleResizeMove(e);
    } else {
      handleCellMouseMove(e);
    }
  };

  const handleMouseUpCombined = () => {
    if (isCreating) {
      handleCreateUp();
    } else if (mode === 'resize') {
      handleResizeUp();
    } else {
      handleCellMouseUp();
    }
  };

  useEffect(() => {
    if (!imageUrl || !containerRef.current) return;

    const img = new Image();
    img.onload = () => {
      const container = containerRef.current;
      if (!container) return;

      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const imgAspect = img.width / img.height;
      const containerAspect = containerWidth / containerHeight;

      let displayWidth: number;
      let displayHeight: number;

      if (imgAspect > containerAspect) {
        displayWidth = containerWidth;
        displayHeight = containerWidth / imgAspect;
      } else {
        displayHeight = containerHeight;
        displayWidth = containerHeight * imgAspect;
      }

      const offsetX = (containerWidth - displayWidth) / 2;
      const offsetY = (containerHeight - displayHeight) / 2;

      const baseScaleValue = displayWidth / img.width;
      setImageSize({ width: displayWidth, height: displayHeight });
      setOriginalImageSize({ width: img.width, height: img.height });
      setImageOffset({ x: offsetX, y: offsetY });
      setBaseScale(baseScaleValue);
      setUserZoom(1);
      setPanOffset({ x: 0, y: 0 });
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const handleZoomIn = () => {
    setUserZoom(prev => Math.min(prev * 1.2, 5));
  };

  const handleZoomOut = () => {
    setUserZoom(prev => Math.max(prev / 1.2, 0.1));
  };

  const handleResetZoom = () => {
    setUserZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent) => {
    // Only zoom if Ctrl/Cmd is pressed and event is within canvas
    if (!e.ctrlKey && !e.metaKey) return;
    
    // Check if the event target is within the canvas container
    const target = e.target as HTMLElement;
    if (!containerRef.current?.contains(target)) {
      return; // Don't zoom if scrolling in controls panel or other areas
    }
    
    // Prevent browser's default zoom behavior
    // Note: The document listener also prevents default, but we do it here too
    // to ensure it's prevented even if the document listener doesn't catch it
    e.preventDefault();
    
    // Perform the zoom
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setUserZoom(prev => {
      const newZoom = Math.max(0.1, Math.min(5, prev * delta));
      return newZoom;
    });
  };
  
  // Prevent browser zoom when Ctrl+scroll is used over the canvas
  useEffect(() => {
    const handleDocumentWheel = (e: WheelEvent) => {
      // Only prevent browser zoom if Ctrl/Cmd is pressed
      if (!e.ctrlKey && !e.metaKey) return;
      
      // Check if the event is over the canvas container or any of its children
      const target = e.target as HTMLElement;
      const container = containerRef.current;
      
      if (container && (container === target || container.contains(target))) {
        // Prevent browser's default zoom behavior
        // React's synthetic event system will still receive the event
        e.preventDefault();
      }
    };
    
    // Use capture phase to catch the event early, before browser handles it
    // This prevents browser zoom while still allowing React to handle the event
    document.addEventListener('wheel', handleDocumentWheel, { passive: false, capture: true });
    
    return () => {
      document.removeEventListener('wheel', handleDocumentWheel, { capture: true });
    };
  }, []);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Middle mouse button drag for panning
    if (e.button === 1) {
      e.preventDefault();
      e.stopPropagation();
      
      const startX = e.clientX - panOffset.x;
      const startY = e.clientY - panOffset.y;
      
      const handlePanMove = (moveEvent: MouseEvent) => {
        setPanOffset({
          x: moveEvent.clientX - startX,
          y: moveEvent.clientY - startY,
        });
      };
      
      const handlePanUp = () => {
        document.removeEventListener('mousemove', handlePanMove);
        document.removeEventListener('mouseup', handlePanUp);
      };
      
      document.addEventListener('mousemove', handlePanMove);
      document.addEventListener('mouseup', handlePanUp);
      return;
    }

    // Handle cell creation on left mouse button when in create mode
    if (onCreateCell && e.button === 0) {
      handleCreateMouseDown(e);
    }
  };

  if (!imageUrl) {
    return (
      <div className="image-canvas empty">
        <p>Upload an image to get started</p>
      </div>
    );
  }

  // Calculate display dimensions based on originalImageSize * scale
  // This ensures the SVG viewBox and width/height use the same coordinate system
  const displayWidth = originalImageSize ? originalImageSize.width * scale : 0;
  const displayHeight = originalImageSize ? originalImageSize.height * scale : 0;
  
  // Calculate display offset accounting for zoom (keep image centered)
  // When zooming, we need to adjust the offset to keep the image centered
  const zoomedDisplayOffsetX = containerRef.current
    ? (containerRef.current.clientWidth - displayWidth) / 2 + panOffset.x
    : (imageSize ? imageOffset.x + panOffset.x : 0);
  const zoomedDisplayOffsetY = containerRef.current
    ? (containerRef.current.clientHeight - displayHeight) / 2 + panOffset.y
    : (imageSize ? imageOffset.y + panOffset.y : 0);

  const previewRect = getPreviewRect();

  return (
    <div
      className="image-canvas"
      ref={containerRef}
      onMouseMove={handleMouseMoveCombined}
      onMouseUp={handleMouseUpCombined}
      onMouseDown={handleCanvasMouseDown}
      onMouseLeave={handleMouseUpCombined}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()} // Prevent context menu on middle click
      style={{ cursor: onCreateCell ? 'crosshair' : 'default' }}
    >
      <div className="zoom-controls">
        <button onClick={handleZoomIn} title="Zoom In (Ctrl + Scroll)">
          +
        </button>
        <button onClick={handleZoomOut} title="Zoom Out (Ctrl + Scroll)">
          −
        </button>
        <button onClick={handleResetZoom} title="Reset Zoom">
          ⟲
        </button>
        <span className="zoom-level">{Math.round(userZoom * 100)}%</span>
      </div>
      {imageSize && (
        <>
          <img
            src={imageUrl}
            alt="Annotation target"
            style={{
              position: 'absolute',
              top: `${zoomedDisplayOffsetY}px`,
              left: `${zoomedDisplayOffsetX}px`,
              width: `${displayWidth}px`,
              height: `${displayHeight}px`,
              display: 'block',
            }}
          />
          {annotation && showCells && originalImageSize && (
            <svg
              ref={svgRef}
              viewBox={`0 0 ${originalImageSize.width} ${originalImageSize.height}`}
              preserveAspectRatio="none"
              style={{
                position: 'absolute',
                top: `${zoomedDisplayOffsetY}px`,
                left: `${zoomedDisplayOffsetX}px`,
                width: `${displayWidth}px`,
                height: `${displayHeight}px`,
                pointerEvents: onCreateCell ? 'none' : 'all',
              }}
            >
              {annotation.cells.map(cell => (
                <CellRenderer
                  key={cell.id}
                  cell={cell}
                  scale={1}
                  onMouseDown={mode === 'move' ? handleCellMouseDown : undefined}
                  onClick={(e, cellId) => {
                    e.stopPropagation();
                    onCellSelect(cellId === selectedCellId ? null : cellId);
                  }}
                  onCornerMouseDown={mode === 'resize' ? handleCornerMouseDown : undefined}
                  selected={cell.id === selectedCellId}
                  showResizeHandles={mode === 'resize'}
                />
              ))}
              <BorderConflictRenderer cells={annotation.cells} scale={1} />
              {snapPreview?.show && snapPreview.points.length > 0 && (
                <polygon
                  key="snap-preview"
                  points={snapPreview.points.map(p => `${p.x},${p.y}`).join(' ')}
                  fill="rgba(34, 197, 94, 0.15)"
                  stroke="rgba(34, 197, 94, 0.8)"
                  strokeWidth={2 * (originalImageSize.width / displayWidth)}
                  strokeDasharray={`${4 * (originalImageSize.width / displayWidth)},${4 * (originalImageSize.width / displayWidth)}`}
                  pointerEvents="none"
                />
              )}
              {previewRect && (
                <rect
                  x={previewRect.x}
                  y={previewRect.y}
                  width={previewRect.width}
                  height={previewRect.height}
                  fill="rgba(0, 123, 255, 0.2)"
                  stroke="rgba(0, 123, 255, 0.8)"
                  strokeWidth={2 * (originalImageSize.width / displayWidth)}
                  strokeDasharray={`${4 * (originalImageSize.width / displayWidth)},${4 * (originalImageSize.width / displayWidth)}`}
                  pointerEvents="none"
                />
              )}
            </svg>
          )}
          {!annotation && previewRect && originalImageSize && (
            <svg
              viewBox={`0 0 ${originalImageSize.width} ${originalImageSize.height}`}
              preserveAspectRatio="none"
              style={{
                position: 'absolute',
                top: `${zoomedDisplayOffsetY}px`,
                left: `${zoomedDisplayOffsetX}px`,
                width: `${displayWidth}px`,
                height: `${displayHeight}px`,
                pointerEvents: 'none',
              }}
            >
              <rect
                x={previewRect.x}
                y={previewRect.y}
                width={previewRect.width}
                height={previewRect.height}
                fill="rgba(0, 123, 255, 0.2)"
                stroke="rgba(0, 123, 255, 0.8)"
                strokeWidth={2 * (originalImageSize.width / displayWidth)}
                strokeDasharray={`${4 * (originalImageSize.width / displayWidth)},${4 * (originalImageSize.width / displayWidth)}`}
                pointerEvents="none"
              />
            </svg>
          )}
        </>
      )}
    </div>
  );
}

