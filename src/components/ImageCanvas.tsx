import { useCallback, useEffect, useRef, useState } from 'react';
import { useCellCreate } from '../hooks/useCellCreate';
import { useCellResize } from '../hooks/useCellResize';
import { Annotation } from '../models/Annotation';
import { Cell } from '../models/Cell';
import { Point } from '../models/types';
import { calculateSnap, detectNearestEdge, EdgeType } from '../utils/snapping';
import { detectWrongBorders as detectWrongBordersUtil, WrongBorderSegment } from '../utils/wrongBorderDetector';
import { BorderConflictRenderer } from './BorderConflictRenderer';
import { OverlapRenderer } from './OverlapRenderer';
import { WrongBorderRenderer } from './WrongBorderRenderer';

interface ImageCanvasProps {
  imageUrl: string | null;
  annotation: Annotation | null;
  selectedCellIds: Set<string>;
  onCellSelect: (cellIds: Set<string>) => void;
  onCellMove: (cellId: string, deltaX: number, deltaY: number) => void;
  onCellMoveEnd: (cellId: string, shouldSnap: boolean, snapDeltaX: number, snapDeltaY: number) => void;
  onCellResize: (cellId: string, points: Point[]) => void;
  onCellResizeEnd: () => void;
  onCreateCell?: (points: Point[]) => void;
  mode: 'move' | 'resize';
  showCells?: boolean;
  snapEnabled?: boolean;
  snapThreshold?: number;
  detectWrongBorders?: boolean;
  horizontalPadding?: number;
  verticalPadding?: number;
}

export function ImageCanvas({
  imageUrl,
  annotation,
  selectedCellIds,
  onCellSelect,
  onCellMove,
  onCellMoveEnd,
  onCellResize,
  onCellResizeEnd,
  onCreateCell,
  mode,
  showCells = true,
  snapEnabled = true,
  snapThreshold = 5,
  detectWrongBorders = false,
  horizontalPadding = 2,
  verticalPadding = 3,
}: ImageCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [originalImageSize, setOriginalImageSize] = useState<{ width: number; height: number } | null>(null);
  const [baseScale, setBaseScale] = useState(1);
  const [userZoom, setUserZoom] = useState(1);
  const [imageOffset, setImageOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const panOffsetRef = useRef(panOffset);
  
  // Keep ref in sync with state
  useEffect(() => {
    panOffsetRef.current = panOffset;
  }, [panOffset]);

  // Calculate scale: converts from original image coordinates to current display coordinates
  // displayWidth = imageSize.width * userZoom (current displayed image width in pixels)
  // originalImageSize.width = original image width in pixels
  // scale = how many display pixels per original image pixel
  const scale = originalImageSize && imageSize
    ? (imageSize.width * userZoom) / originalImageSize.width
    : baseScale * userZoom;

  const cells = annotation?.cells || [];

  // Calculate display dimensions based on originalImageSize * scale
  // This ensures the SVG viewBox and width/height use the same coordinate system
  // Calculate this once and use it for both displayOffset and SVG positioning
  const displayWidth = originalImageSize ? originalImageSize.width * scale : 0;
  const displayHeight = originalImageSize ? originalImageSize.height * scale : 0;

  // Calculate display offset for hooks (accounting for zoom)
  // This must match the SVG positioning exactly to ensure correct coordinate transformation
  const displayOffsetX = containerRef.current
    ? (containerRef.current.clientWidth - displayWidth) / 2 + panOffset.x
    : (imageSize ? imageOffset.x + panOffset.x : 0);
  const displayOffsetY = containerRef.current
    ? (containerRef.current.clientHeight - displayHeight) / 2 + panOffset.y
    : (imageSize ? imageOffset.y + panOffset.y : 0);
  const displayOffset = { x: displayOffsetX, y: displayOffsetY };


  // Debug logging for render positioning
  useEffect(() => {
    if (imageSize && originalImageSize && svgRef.current) {
      const svgRect = svgRef.current.getBoundingClientRect();
      const imgElement = containerRef.current?.querySelector('img');
      const imgRect = imgElement?.getBoundingClientRect();
      
      
      // Check for misalignment
      if (svgRect && imgRect) {
        const svgImgDiff = {
          top: svgRect.top - imgRect.top,
          left: svgRect.left - imgRect.left,
          width: svgRect.width - imgRect.width,
          height: svgRect.height - imgRect.height,
        };
        if (Math.abs(svgImgDiff.top) > 0.5 || Math.abs(svgImgDiff.left) > 0.5 || 
            Math.abs(svgImgDiff.width) > 0.5 || Math.abs(svgImgDiff.height) > 0.5) {
          console.warn('  [MISMATCH DETECTED] SVG and Image are not aligned!');
        }
      }
      
    }
  }, [displayOffset.x, displayOffset.y, displayWidth, displayHeight, imageSize, originalImageSize]);

  // Drag state using refs for direct DOM manipulation
  const dragState = useRef<{
    cellIds: Set<string>;
    cellGroupElements: Map<string, SVGGElement>;
    startX: number;
    startY: number;
    initialCells: Map<string, Cell>;
    currentDeltaX: number;
    currentDeltaY: number;
    imageOffset: { x: number; y: number };
    scale: number;
    targetEdge: EdgeType | null;
    snapDeltaX: number;
    snapDeltaY: number;
  }>({
    cellIds: new Set(),
    cellGroupElements: new Map(),
    startX: 0,
    startY: 0,
    initialCells: new Map(),
    currentDeltaX: 0,
    currentDeltaY: 0,
    imageOffset: { x: 0, y: 0 },
    scale: 1,
    targetEdge: null,
    snapDeltaX: 0,
    snapDeltaY: 0,
  });

  const [snapPreview, setSnapPreview] = useState<{ show: boolean; points: { x: number; y: number }[] } | null>(null);
  const [snappedCellId, setSnappedCellId] = useState<string | null>(null);
  const [snappedCellIds, setSnappedCellIds] = useState<Set<string>>(new Set());
  const cellGroupRefs = useRef<Map<string, SVGGElement>>(new Map());
  const [wrongBorders, setWrongBorders] = useState<WrongBorderSegment[]>([]);

  const { handleCornerMouseDown, handleMouseMove: handleResizeMove, handleMouseUp: handleResizeUp } = useCellResize({
    onResize: (points) => {
      // Only resize the first selected cell (or single selected cell)
      if (selectedCellIds.size === 1) {
        const cellId = Array.from(selectedCellIds)[0];
        onCellResize(cellId, points);
      }
    },
    onResizeEnd: onCellResizeEnd,
    cells,
    scale,
    imageOffset: displayOffset,
    getContainerRect: () => containerRef.current?.getBoundingClientRect() || null,
  });

  const { handleMouseDown: handleCreateMouseDown, handleMouseMove: handleCreateMove, handleMouseUp: handleCreateUp, getPreviewRect, isCreating } = useCellCreate({
    onCreateCell: onCreateCell || (() => { }),
    scale,
    imageOffset: displayOffset,
    getContainerRect: () => containerRef.current?.getBoundingClientRect() || null,
    imageSize: imageSize ? { width: imageSize.width / baseScale, height: imageSize.height / baseScale } : null,
  });

  // Direct DOM manipulation for cell dragging
  const handleCellMouseDown = useCallback((e: React.MouseEvent, cellId: string) => {
    if (mode !== 'move') {
      return;
    }
    
    // Don't start drag if middle mouse button is pressed - allow panning instead
    if (e.button === 1) {
      return;
    }
    
    // Don't start drag if Ctrl/Cmd or Shift is pressed - let onClick handle selection
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    const cell = cells.find(c => c.id === cellId);
    if (!cell) {
      return;
    }

    // Determine which cells to drag: if clicked cell is selected, drag all selected; otherwise just this cell
    const cellsToDrag = selectedCellIds.has(cellId) ? selectedCellIds : new Set([cellId]);

    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) {
      return;
    }

    const mouseX = e.clientX - containerRect.left;
    const mouseY = e.clientY - containerRect.top;
    const svgX = (mouseX - displayOffset.x) / scale;
    const svgY = (mouseY - displayOffset.y) / scale;

    const targetEdge = detectNearestEdge(cell, { x: svgX, y: svgY });
    
    // Store initial state for all cells being dragged
    const initialCells = new Map<string, Cell>();
    const cellGroupElements = new Map<string, SVGGElement>();
    
    cellsToDrag.forEach(id => {
      const c = cells.find(c => c.id === id);
      if (c) {
        initialCells.set(id, new Cell(c.toData()));
        const element = cellGroupRefs.current.get(id);
        if (element) {
          cellGroupElements.set(id, element);
        }
      }
    });

    dragState.current = {
      cellIds: new Set(cellsToDrag),
      cellGroupElements,
      startX: svgX,
      startY: svgY,
      initialCells,
      currentDeltaX: 0,
      currentDeltaY: 0,
      imageOffset: { ...displayOffset },
      scale,
      targetEdge,
      snapDeltaX: 0,
      snapDeltaY: 0,
    };
    
    // Check for initial snap position (only for single cell, using the clicked cell)
    if (snapEnabled && cellsToDrag.size === 1) {
      const otherCells = cells.filter(c => !cellsToDrag.has(c.id));
      const snapThresholdInSvg = snapThreshold / scale;
      const initialCell = initialCells.get(cellId);
      if (initialCell) {
        const initialSnapResult = calculateSnap(
          initialCell,
          otherCells,
          0,
          0,
          snapThresholdInSvg,
          targetEdge || undefined
        );
        
        if (initialSnapResult.snapped && initialSnapResult.matchedCellId) {
          dragState.current.snapDeltaX = initialSnapResult.deltaX;
          dragState.current.snapDeltaY = initialSnapResult.deltaY;
          const previewCell = new Cell(initialCell.toData());
          previewCell.move(initialSnapResult.deltaX, initialSnapResult.deltaY);
          const previewPoints = previewCell.points;
          setSnapPreview({ show: true, points: previewPoints });
          setSnappedCellId(initialSnapResult.matchedCellId);
          setSnappedCellIds(new Set(initialSnapResult.matchedCellIds));
        } else {
          setSnapPreview(null);
          setSnappedCellId(null);
          setSnappedCellIds(new Set());
        }
      }
    } else {
      setSnapPreview(null);
      setSnappedCellId(null);
      setSnappedCellIds(new Set());
    }
  }, [cells, scale, displayOffset, mode, snapEnabled, snapThreshold, selectedCellIds]);

  const handleCellMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragState.current.cellIds.size === 0 || dragState.current.initialCells.size === 0) {
      return;
    }

    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) {
      return;
    }

    const storedOffset = dragState.current.imageOffset;
    const storedScale = dragState.current.scale;

    const mouseX = e.clientX - containerRect.left;
    const mouseY = e.clientY - containerRect.top;
    const svgX = (mouseX - storedOffset.x) / storedScale;
    const svgY = (mouseY - storedOffset.y) / storedScale;

    const rawDeltaX = svgX - dragState.current.startX;
    const rawDeltaY = svgY - dragState.current.startY;

    // Update DOM directly with transform for all dragged cells
    dragState.current.currentDeltaX = rawDeltaX;
    dragState.current.currentDeltaY = rawDeltaY;
    dragState.current.cellGroupElements.forEach((element) => {
      element.setAttribute('transform', `translate(${rawDeltaX}, ${rawDeltaY})`);
    });

    // Calculate snap preview only if snap is enabled and single cell
    if (snapEnabled && dragState.current.cellIds.size === 1) {
      const cellId = Array.from(dragState.current.cellIds)[0];
      const initialCell = dragState.current.initialCells.get(cellId);
      if (initialCell) {
        const otherCells = cells.filter(c => !dragState.current.cellIds.has(c.id));
        // Convert snap threshold from display pixels to SVG coordinates
        const snapThresholdInSvg = snapThreshold / storedScale;
        const snapResult = calculateSnap(
          initialCell,
          otherCells,
          rawDeltaX,
          rawDeltaY,
          snapThresholdInSvg,
          dragState.current.targetEdge || undefined
        );

        if (snapResult.snapped && snapResult.matchedCellId) {
          dragState.current.snapDeltaX = snapResult.deltaX;
          dragState.current.snapDeltaY = snapResult.deltaY;
          // Create preview from current dragged position, then apply snap offset
          const currentCell = new Cell(initialCell.toData());
          currentCell.move(rawDeltaX, rawDeltaY); // Move to current dragged position
          const snapOffsetX = snapResult.deltaX - rawDeltaX; // Offset from current to snapped
          const snapOffsetY = snapResult.deltaY - rawDeltaY;
          currentCell.move(snapOffsetX, snapOffsetY); // Apply snap offset
          const previewPoints = currentCell.points;
          setSnapPreview({ show: true, points: previewPoints });
          setSnappedCellId(snapResult.matchedCellId);
          setSnappedCellIds(new Set(snapResult.matchedCellIds));
        } else {
          dragState.current.snapDeltaX = 0;
          dragState.current.snapDeltaY = 0;
          setSnapPreview(null);
          setSnappedCellId(null);
          setSnappedCellIds(new Set());
        }
      }
    } else {
      dragState.current.snapDeltaX = 0;
      dragState.current.snapDeltaY = 0;
      setSnapPreview(null);
      setSnappedCellId(null);
      setSnappedCellIds(new Set());
    }
  }, [cells, snapEnabled, snapThreshold]);

  const handleCellMouseUp = useCallback(() => {
    if (dragState.current.cellIds.size === 0) {
      return;
    }

    // Calculate final delta before removing transform
    const shouldSnap = snapPreview?.show && snapPreview.points.length > 0 && snappedCellId !== null && dragState.current.cellIds.size === 1;
    let finalDeltaX = dragState.current.currentDeltaX;
    let finalDeltaY = dragState.current.currentDeltaY;

    // Remove transform from DOM for all dragged cells
    dragState.current.cellGroupElements.forEach((element) => {
      element.removeAttribute('transform');
    });

    // Apply movement to all dragged cells
    dragState.current.cellIds.forEach(cellId => {
      if (shouldSnap && dragState.current.initialCells.has(cellId)) {
        // After transform removal, cell is at original position in data model
        // snapDeltaX/Y are already relative to initial position, so use them directly
        onCellMoveEnd(cellId, shouldSnap, dragState.current.snapDeltaX, dragState.current.snapDeltaY);
      } else {
        // No snapping - apply the current drag position
        onCellMove(cellId, finalDeltaX, finalDeltaY);
        onCellMoveEnd(cellId, false, 0, 0);
      }
    });

    // Reset drag state
    dragState.current = {
      cellIds: new Set(),
      cellGroupElements: new Map(),
      startX: 0,
      startY: 0,
      initialCells: new Map(),
      currentDeltaX: 0,
      currentDeltaY: 0,
      imageOffset: { x: 0, y: 0 },
      scale: 1,
      targetEdge: null,
      snapDeltaX: 0,
      snapDeltaY: 0,
    };
    setSnapPreview(null);
    setSnappedCellId(null);
    setSnappedCellIds(new Set());
  }, [snapPreview, snappedCellId, onCellMove, onCellMoveEnd]);

  const handleMouseMoveCombined = (e: React.MouseEvent) => {
    if (isCreating) {
      handleCreateMove(e);
    } else if (mode === 'resize') {
      handleResizeMove(e);
    } else if (dragState.current.cellIds.size > 0) {
      handleCellMouseMove(e);
    }
  };

  const handleMouseUpCombined = () => {
    if (isCreating) {
      handleCreateUp();
    } else if (mode === 'resize') {
      handleResizeUp();
    } else if (dragState.current.cellIds.size > 0) {
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

  // Detect wrong borders when enabled
  useEffect(() => {
    if (!detectWrongBorders || !imageUrl || !annotation || annotation.cells.length === 0) {
      setWrongBorders([]);
      return;
    }

    let cancelled = false;

    const runDetection = async () => {
      try {
        const detected = await detectWrongBordersUtil(annotation.cells, imageUrl, horizontalPadding, verticalPadding);
        if (!cancelled) {
          setWrongBorders(detected);
        }
      } catch (error) {
        console.error('Error detecting wrong borders:', error);
        if (!cancelled) {
          setWrongBorders([]);
        }
      }
    };

    runDetection();

    return () => {
      cancelled = true;
    };
  }, [detectWrongBorders, imageUrl, annotation, horizontalPadding, verticalPadding]);

  // Helper function to zoom at a specific mouse position
  const zoomAtPosition = useCallback((mouseX: number, mouseY: number, zoomFactor: number) => {
    if (!containerRef.current || !originalImageSize) return;

    const container = containerRef.current;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // Get current zoom and calculate current scale
    setUserZoom(prev => {
      const newZoom = Math.max(0.1, Math.min(5, prev * zoomFactor));
      const oldScale = originalImageSize && imageSize
        ? (imageSize.width * prev) / originalImageSize.width
        : baseScale * prev;
      const newScale = originalImageSize && imageSize
        ? (imageSize.width * newZoom) / originalImageSize.width
        : baseScale * newZoom;

      // Use ref to get current panOffset (avoids stale closure)
      const currentPanOffset = panOffsetRef.current;

      // Calculate current display dimensions and offset
      const oldDisplayWidth = originalImageSize.width * oldScale;
      const oldDisplayHeight = originalImageSize.height * oldScale;
      const oldDisplayOffsetX = (containerWidth - oldDisplayWidth) / 2 + currentPanOffset.x;
      const oldDisplayOffsetY = (containerHeight - oldDisplayHeight) / 2 + currentPanOffset.y;

      // Calculate SVG coordinate at mouse position before zoom
      const svgX = (mouseX - oldDisplayOffsetX) / oldScale;
      const svgY = (mouseY - oldDisplayOffsetY) / oldScale;

      // Calculate new display dimensions
      const newDisplayWidth = originalImageSize.width * newScale;
      const newDisplayHeight = originalImageSize.height * newScale;

      // Calculate new panOffset to keep the same SVG coordinate under the mouse
      const newPanOffsetX = mouseX - (containerWidth - newDisplayWidth) / 2 - svgX * newScale;
      const newPanOffsetY = mouseY - (containerHeight - newDisplayHeight) / 2 - svgY * newScale;

      setPanOffset({ x: newPanOffsetX, y: newPanOffsetY });

      return newZoom;
    });
  }, [originalImageSize, imageSize, baseScale]);

  const handleZoomIn = (e?: React.MouseEvent) => {
    if (!containerRef.current) {
      // Fallback to center zoom if no container
      setUserZoom(prev => Math.min(prev * 1.2, 5));
      return;
    }

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    
    // Use mouse position if available, otherwise use center of container
    const mouseX = e ? e.clientX - containerRect.left : container.clientWidth / 2;
    const mouseY = e ? e.clientY - containerRect.top : container.clientHeight / 2;

    zoomAtPosition(mouseX, mouseY, 1.2);
  };

  const handleZoomOut = (e?: React.MouseEvent) => {
    if (!containerRef.current) {
      // Fallback to center zoom if no container
      setUserZoom(prev => Math.max(prev / 1.2, 0.1));
      return;
    }

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    
    // Use mouse position if available, otherwise use center of container
    const mouseX = e ? e.clientX - containerRect.left : container.clientWidth / 2;
    const mouseY = e ? e.clientY - containerRect.top : container.clientHeight / 2;

    zoomAtPosition(mouseX, mouseY, 1 / 1.2);
  };

  const handleResetZoom = () => {
    console.log('[Zoom Debug] handleResetZoom');
    setUserZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Handle wheel events for zooming (using native listener to allow preventDefault)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Only zoom if Ctrl/Cmd is pressed and event is within canvas
      if (!e.ctrlKey && !e.metaKey) return;

      // Check if the event target is within the canvas container
      const target = e.target as HTMLElement;
      if (!container.contains(target)) {
        return; // Don't zoom if scrolling in controls panel or other areas
      }

      // Prevent browser's default zoom behavior
      e.preventDefault();

      // Get mouse position relative to container
      const containerRect = container.getBoundingClientRect();
      const mouseX = e.clientX - containerRect.left;
      const mouseY = e.clientY - containerRect.top;

      // Perform the zoom at mouse position
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      zoomAtPosition(mouseX, mouseY, delta);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [zoomAtPosition]);

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

  const handleCanvasClick = (e: React.MouseEvent) => {
    // Deselect all cells when clicking on canvas background (not on a cell)
    // Only if not creating a cell and not using modifier keys
    // Cell clicks stop propagation, so if we get here, it's a background click
    if (!onCreateCell && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      const target = e.target as HTMLElement;
      // Deselect if clicking on the canvas div, SVG container, or preview rect (not on a cell polygon)
      if (target === containerRef.current || 
          target.tagName === 'svg' || 
          (target.tagName === 'rect' && target.getAttribute('fill')?.includes('rgba(0, 123, 255'))) {
        onCellSelect(new Set());
      }
    }
  };

  if (!imageUrl) {
    return (
      <div className="image-canvas empty">
        <p>Upload an image to get started</p>
      </div>
    );
  }

  // Use the same displayWidth and displayHeight calculated earlier
  // Calculate display offset accounting for zoom (keep image centered)
  // This should match displayOffset exactly since they use the same calculation
  const zoomedDisplayOffsetX = displayOffset.x;
  const zoomedDisplayOffsetY = displayOffset.y;

  const previewRect = getPreviewRect();

  const shouldShowSnapPreview = snapEnabled && snapPreview?.show && snapPreview.points.length > 0;

  // Calculate scrollable area bounds to enable scrolling in all directions
  // When content is positioned at negative coordinates, we need a wrapper that extends
  // the scrollable area to include those negative positions
  const containerWidth = containerRef.current?.clientWidth || 0;
  const containerHeight = containerRef.current?.clientHeight || 0;
  
  // Calculate the bounds of where content can be positioned
  // Ensure we account for content that extends beyond container bounds
  const minX = Math.min(0, zoomedDisplayOffsetX);
  const minY = Math.min(0, zoomedDisplayOffsetY);
  const maxX = Math.max(containerWidth, zoomedDisplayOffsetX + displayWidth);
  const maxY = Math.max(containerHeight, zoomedDisplayOffsetY + displayHeight);
  
  // Wrapper dimensions need to cover the full scrollable area
  // Add padding to ensure we can scroll even when content is at the edges
  const scrollPadding = 1000; // Large padding to allow scrolling in all directions
  const wrapperWidth = Math.max(containerWidth, maxX - minX + scrollPadding * 2);
  const wrapperHeight = Math.max(containerHeight, maxY - minY + scrollPadding * 2);
  const wrapperLeft = minX - scrollPadding;
  const wrapperTop = minY - scrollPadding;
  
  // Adjust content positions relative to the wrapper
  // This maintains the same visual position as before
  const contentOffsetX = zoomedDisplayOffsetX - wrapperLeft;
  const contentOffsetY = zoomedDisplayOffsetY - wrapperTop;

  return (
    <div
      className="image-canvas"
      ref={containerRef}
      onMouseMove={handleMouseMoveCombined}
      onMouseUp={handleMouseUpCombined}
      onMouseDown={handleCanvasMouseDown}
      onClick={handleCanvasClick}
      onMouseLeave={handleMouseUpCombined}
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
        <div
          style={{
            position: 'absolute',
            left: `${wrapperLeft}px`,
            top: `${wrapperTop}px`,
            width: `${wrapperWidth}px`,
            height: `${wrapperHeight}px`,
            pointerEvents: 'none',
          }}
        >
          <img
            src={imageUrl}
            alt="Annotation target"
            width={displayWidth}
            height={displayHeight}
            style={{
              position: 'absolute',
              top: `${contentOffsetY}px`,
              left: `${contentOffsetX}px`,
              width: `${displayWidth}px`,
              height: `${displayHeight}px`,
              maxWidth: 'none',
              maxHeight: 'none',
              display: 'block',
              pointerEvents: 'none',
            }}
          />
          {annotation && showCells && originalImageSize && (
            <svg
              ref={svgRef}
              viewBox={`0 0 ${originalImageSize.width} ${originalImageSize.height}`}
              preserveAspectRatio="none"
              width={displayWidth}
              height={displayHeight}
              style={{
                position: 'absolute',
                top: `${contentOffsetY}px`,
                left: `${contentOffsetX}px`,
                width: `${displayWidth}px`,
                height: `${displayHeight}px`,
                pointerEvents: onCreateCell ? 'none' : 'all',
              }}
            >
              <defs>
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              {annotation.cells.map(cell => {
                const pointsString = cell.points.map(p => `${p.x},${p.y}`).join(' ');
                const bounds = cell.getBounds();
                const left = bounds.minX;
                const right = bounds.maxX;
                const top = bounds.minY;
                const bottom = bounds.maxY;
                const selected = selectedCellIds.has(cell.id);
                const isSnappedCell = snappedCellIds.has(cell.id);
                const VISIBLE_EDGE_COLOR = '#2563eb';
                const INVISIBLE_EDGE_COLOR = '#94a3b8';
                
                // Convert hex color to RGB for rgba
                const hexToRgb = (hex: string) => {
                  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                  return result ? {
                    r: parseInt(result[1], 16),
                    g: parseInt(result[2], 16),
                    b: parseInt(result[3], 16)
                  } : { r: 37, g: 99, b: 235 };
                };
                const rgb = hexToRgb(cell.color);
                const CELL_FILL = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${cell.opacity})`;
                const SELECTED_FILL = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.min(cell.opacity * 1.2, 1)})`;
                const SNAP_MATCHED_FILL = 'rgba(34, 197, 94, 0.2)';
                const SELECTED_STROKE_COLOR = '#ff6b00'; // Bright orange
                const SELECTED_STROKE_WIDTH = 5;
                const SELECTED_GLOW_COLOR = '#ff6b00';
                const CORNER_HANDLE_SIZE = 8;
                const CORNER_HANDLE_COLOR = '#2563eb';
                const CORNER_HANDLE_FILL = '#ffffff';
                const CORNER_DOT_SIZE = 3;
                const CORNER_DOT_COLOR = '#2563eb';

                return (
                  <g
                    key={cell.id}
                    ref={(el) => {
                      if (el) {
                        cellGroupRefs.current.set(cell.id, el);
                      } else {
                        cellGroupRefs.current.delete(cell.id);
                      }
                    }}
                  >
                    {selected && (
                      <>
                        {/* Outer glow effect */}
                        <polygon
                          points={pointsString}
                          fill="none"
                          stroke={SELECTED_GLOW_COLOR}
                          strokeWidth={SELECTED_STROKE_WIDTH + 6}
                          opacity={0.5}
                          pointerEvents="none"
                          filter="url(#glow)"
                        />
                        {/* Middle highlight layer */}
                        <polygon
                          points={pointsString}
                          fill="none"
                          stroke={SELECTED_STROKE_COLOR}
                          strokeWidth={SELECTED_STROKE_WIDTH + 2}
                          opacity={0.7}
                          pointerEvents="none"
                        />
                      </>
                    )}
                    <polygon
                      points={pointsString}
                      fill={selected ? SELECTED_FILL : (isSnappedCell ? SNAP_MATCHED_FILL : CELL_FILL)}
                      stroke={selected ? SELECTED_STROKE_COLOR : 'none'}
                      strokeWidth={selected ? SELECTED_STROKE_WIDTH : 0}
                      strokeDasharray={selected ? '10,5' : 'none'}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      onMouseDown={mode === 'move' ? (e) => handleCellMouseDown(e, cell.id) : undefined}
                      onClick={(e) => {
                        // Don't handle clicks for middle mouse button - allow panning
                        if (e.button === 1) {
                          return;
                        }
                        e.stopPropagation();
                        const isCtrlOrMeta = e.ctrlKey || e.metaKey;
                        const isShift = e.shiftKey;
                        
                        if (isCtrlOrMeta || isShift) {
                          // Toggle selection: add if not selected, remove if selected
                          const newSelection = new Set(selectedCellIds);
                          if (newSelection.has(cell.id)) {
                            newSelection.delete(cell.id);
                          } else {
                            newSelection.add(cell.id);
                          }
                          onCellSelect(newSelection);
                        } else {
                          // Single selection: select only this cell
                          onCellSelect(new Set([cell.id]));
                        }
                      }}
                      style={{ cursor: mode === 'resize' ? 'default' : (mode === 'move' ? 'move' : 'default') }}
                    />
                    {/* Corner dots to indicate corners */}
                    {cell.points.map((point, index) => (
                      <circle
                        key={`corner-dot-${index}`}
                        cx={point.x}
                        cy={point.y}
                        r={CORNER_DOT_SIZE}
                        fill={CORNER_DOT_COLOR}
                        stroke="none"
                        pointerEvents="none"
                      />
                    ))}
                    {mode === 'resize' && selected && selectedCellIds.size === 1 && cell.points.map((point, index) => (
                      <circle
                        key={`corner-${index}`}
                        cx={point.x}
                        cy={point.y}
                        r={CORNER_HANDLE_SIZE}
                        fill={CORNER_HANDLE_FILL}
                        stroke={CORNER_HANDLE_COLOR}
                        strokeWidth={2}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleCornerMouseDown(e, cell.id, index, cell.points);
                        }}
                        style={{ cursor: 'nwse-resize' }}
                      />
                    ))}
                    {cell.lines.top === 1 && (
                      <line x1={left} y1={top} x2={right} y2={top} stroke={VISIBLE_EDGE_COLOR} strokeWidth={2} pointerEvents="none" />
                    )}
                    {cell.lines.top === 0 && (
                      <line x1={left} y1={top} x2={right} y2={top} stroke={INVISIBLE_EDGE_COLOR} strokeWidth={1} strokeDasharray="4,4" pointerEvents="none" />
                    )}
                    {cell.lines.bottom === 1 && (
                      <line x1={left} y1={bottom} x2={right} y2={bottom} stroke={VISIBLE_EDGE_COLOR} strokeWidth={2} pointerEvents="none" />
                    )}
                    {cell.lines.bottom === 0 && (
                      <line x1={left} y1={bottom} x2={right} y2={bottom} stroke={INVISIBLE_EDGE_COLOR} strokeWidth={1} strokeDasharray="4,4" pointerEvents="none" />
                    )}
                    {cell.lines.left === 1 && (
                      <line x1={left} y1={top} x2={left} y2={bottom} stroke={VISIBLE_EDGE_COLOR} strokeWidth={2} pointerEvents="none" />
                    )}
                    {cell.lines.left === 0 && (
                      <line x1={left} y1={top} x2={left} y2={bottom} stroke={INVISIBLE_EDGE_COLOR} strokeWidth={1} strokeDasharray="4,4" pointerEvents="none" />
                    )}
                    {cell.lines.right === 1 && (
                      <line x1={right} y1={top} x2={right} y2={bottom} stroke={VISIBLE_EDGE_COLOR} strokeWidth={2} pointerEvents="none" />
                    )}
                    {cell.lines.right === 0 && (
                      <line x1={right} y1={top} x2={right} y2={bottom} stroke={INVISIBLE_EDGE_COLOR} strokeWidth={1} strokeDasharray="4,4" pointerEvents="none" />
                    )}
                  </g>
                );
              })}
              <OverlapRenderer cells={annotation.cells} />
              <BorderConflictRenderer cells={annotation.cells} scale={1} />
              {detectWrongBorders && <WrongBorderRenderer wrongBorders={wrongBorders} horizontalPadding={horizontalPadding} verticalPadding={verticalPadding} />}
              {shouldShowSnapPreview && (
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
                top: `${contentOffsetY}px`,
                left: `${contentOffsetX}px`,
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
        </div>
      )}
    </div>
  );
}

