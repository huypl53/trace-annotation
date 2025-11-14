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
  selectedCellId: string | null;
  onCellSelect: (cellId: string | null) => void;
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
  snapEnabled = true,
  snapThreshold = 5,
  detectWrongBorders = false,
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

  // Debug logging for zoom calculations
  useEffect(() => {
    console.log('[Zoom Debug] Zoom calculation values:');
    console.log('  userZoom:', userZoom);
    console.log('  baseScale:', baseScale);
    console.log('  imageSize:', imageSize ? { width: imageSize.width, height: imageSize.height } : null);
    console.log('  originalImageSize:', originalImageSize ? { width: originalImageSize.width, height: originalImageSize.height } : null);
    console.log('  scale:', scale);
    console.log('  displayWidth:', displayWidth);
    console.log('  displayHeight:', displayHeight);
    console.log('  displayOffsetX:', displayOffsetX);
    console.log('  displayOffsetY:', displayOffsetY);
    console.log('  panOffset:', { x: panOffset.x, y: panOffset.y });
    console.log('  containerSize:', containerRef.current ? {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    } : null);
  }, [userZoom, baseScale, imageSize, originalImageSize, scale, displayWidth, displayHeight, displayOffsetX, displayOffsetY, panOffset]);

  // Debug logging for render positioning
  useEffect(() => {
    if (imageSize && originalImageSize && svgRef.current) {
      const svgRect = svgRef.current.getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect();
      const imgElement = containerRef.current?.querySelector('img');
      const imgRect = imgElement?.getBoundingClientRect();
      
      console.log('[Zoom Debug] Render positioning:');
      console.log('  svgStyle:', {
        top: svgRef.current.style.top,
        left: svgRef.current.style.left,
        width: svgRef.current.style.width,
        height: svgRef.current.style.height,
      });
      const viewBox = svgRef.current.viewBox.baseVal;
      console.log('  svgViewBox:', { x: viewBox.x, y: viewBox.y, width: viewBox.width, height: viewBox.height });
      console.log('  svgActualRect:', svgRect ? {
        top: svgRect.top,
        left: svgRect.left,
        width: svgRect.width,
        height: svgRect.height,
      } : null);
      console.log('  imgStyle:', imgElement ? {
        top: imgElement.style.top,
        left: imgElement.style.left,
        width: imgElement.style.width,
        height: imgElement.style.height,
      } : null);
      console.log('  imgActualRect:', imgRect ? {
        top: imgRect.top,
        left: imgRect.left,
        width: imgRect.width,
        height: imgRect.height,
      } : null);
      console.log('  containerRect:', containerRect ? {
        top: containerRect.top,
        left: containerRect.left,
        width: containerRect.width,
        height: containerRect.height,
      } : null);
      console.log('  zoomedDisplayOffsetX:', displayOffset.x);
      console.log('  zoomedDisplayOffsetY:', displayOffset.y);
      console.log('  displayWidth:', displayWidth);
      console.log('  displayHeight:', displayHeight);
      
      // Check for misalignment
      if (svgRect && imgRect) {
        const svgImgDiff = {
          top: svgRect.top - imgRect.top,
          left: svgRect.left - imgRect.left,
          width: svgRect.width - imgRect.width,
          height: svgRect.height - imgRect.height,
        };
        console.log('  [ALIGNMENT CHECK] SVG vs Image difference:');
        console.log('    top diff:', svgImgDiff.top, 'left diff:', svgImgDiff.left);
        console.log('    width diff:', svgImgDiff.width, 'height diff:', svgImgDiff.height);
        if (Math.abs(svgImgDiff.top) > 0.5 || Math.abs(svgImgDiff.left) > 0.5 || 
            Math.abs(svgImgDiff.width) > 0.5 || Math.abs(svgImgDiff.height) > 0.5) {
          console.warn('  [MISMATCH DETECTED] SVG and Image are not aligned!');
        }
      }
      
      // Check container scroll
      if (containerRef.current) {
        console.log('  containerScroll:', {
          scrollLeft: containerRef.current.scrollLeft,
          scrollTop: containerRef.current.scrollTop,
          scrollWidth: containerRef.current.scrollWidth,
          scrollHeight: containerRef.current.scrollHeight,
        });
      }
    }
  }, [displayOffset.x, displayOffset.y, displayWidth, displayHeight, imageSize, originalImageSize]);

  // Drag state using refs for direct DOM manipulation
  const dragState = useRef<{
    cellId: string | null;
    cellGroupElement: SVGGElement | null;
    startX: number;
    startY: number;
    initialCell: Cell | null;
    initialBounds: { minX: number; minY: number } | null;
    currentDeltaX: number;
    currentDeltaY: number;
    imageOffset: { x: number; y: number };
    scale: number;
    targetEdge: EdgeType | null;
    snapDeltaX: number;
    snapDeltaY: number;
  }>({
    cellId: null,
    cellGroupElement: null,
    startX: 0,
    startY: 0,
    initialCell: null,
    initialBounds: null,
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
    onCreateCell: onCreateCell || (() => { }),
    scale,
    imageOffset: displayOffset,
    getContainerRect: () => containerRef.current?.getBoundingClientRect() || null,
    imageSize: imageSize ? { width: imageSize.width / baseScale, height: imageSize.height / baseScale } : null,
  });

  // Direct DOM manipulation for cell dragging
  const handleCellMouseDown = useCallback((e: React.MouseEvent, cellId: string) => {
    if (mode !== 'move') return;
    e.preventDefault();
    e.stopPropagation();
    
    const cell = cells.find(c => c.id === cellId);
    if (!cell) return;

    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const mouseX = e.clientX - containerRect.left;
    const mouseY = e.clientY - containerRect.top;
    const svgX = (mouseX - displayOffset.x) / scale;
    const svgY = (mouseY - displayOffset.y) / scale;

    console.log('[Zoom Debug] handleCellMouseDown coordinate transformation:');
    console.log('  clientX:', e.clientX, 'clientY:', e.clientY);
    console.log('  containerRect:', { left: containerRect.left, top: containerRect.top, width: containerRect.width, height: containerRect.height });
    console.log('  mouseX:', mouseX, 'mouseY:', mouseY);
    console.log('  displayOffset:', { x: displayOffset.x, y: displayOffset.y });
    console.log('  scale:', scale);
    console.log('  svgX:', svgX, 'svgY:', svgY);
    const cellBounds = cell.getBounds();
    console.log('  cellBounds:', { minX: cellBounds.minX, minY: cellBounds.minY, maxX: cellBounds.maxX, maxY: cellBounds.maxY });
    console.log('  userZoom:', userZoom, 'baseScale:', baseScale);
    console.log('  imageSize:', imageSize ? { width: imageSize.width, height: imageSize.height } : null);
    console.log('  originalImageSize:', originalImageSize ? { width: originalImageSize.width, height: originalImageSize.height } : null);

    const targetEdge = detectNearestEdge(cell, { x: svgX, y: svgY });
    const initialBounds = cell.getBounds();
    const cellGroupElement = cellGroupRefs.current.get(cellId);

    dragState.current = {
      cellId,
      cellGroupElement: cellGroupElement || null,
      startX: svgX,
      startY: svgY,
      initialCell: new Cell(cell.toData()),
      initialBounds: { minX: initialBounds.minX, minY: initialBounds.minY },
      currentDeltaX: 0,
      currentDeltaY: 0,
      imageOffset: { ...displayOffset },
      scale,
      targetEdge,
      snapDeltaX: 0,
      snapDeltaY: 0,
    };
    
    // Check for initial snap position (when delta is 0) to show preview immediately if cell is already close
    if (snapEnabled) {
      const otherCells = cells.filter(c => c.id !== cellId);
      const snapThresholdInSvg = snapThreshold / scale;
      const initialSnapResult = calculateSnap(
        dragState.current.initialCell!,
        otherCells,
        0,
        0,
        snapThresholdInSvg,
        targetEdge || undefined
      );
      
      if (initialSnapResult.snapped && initialSnapResult.matchedCellId) {
        dragState.current.snapDeltaX = initialSnapResult.deltaX;
        dragState.current.snapDeltaY = initialSnapResult.deltaY;
        const previewCell = new Cell(dragState.current.initialCell!.toData());
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
    } else {
      setSnapPreview(null);
      setSnappedCellId(null);
      setSnappedCellIds(new Set());
    }
  }, [cells, scale, displayOffset, mode, snapEnabled, snapThreshold]);

  const handleCellMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.current.cellId || !dragState.current.initialCell || !dragState.current.cellGroupElement) return;

    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const storedOffset = dragState.current.imageOffset;
    const storedScale = dragState.current.scale;

    const mouseX = e.clientX - containerRect.left;
    const mouseY = e.clientY - containerRect.top;
    const svgX = (mouseX - storedOffset.x) / storedScale;
    const svgY = (mouseY - storedOffset.y) / storedScale;

    const rawDeltaX = svgX - dragState.current.startX;
    const rawDeltaY = svgY - dragState.current.startY;

    console.log('[Zoom Debug] handleCellMouseMove coordinate transformation:');
    console.log('  clientX:', e.clientX, 'clientY:', e.clientY);
    console.log('  containerRect:', { left: containerRect.left, top: containerRect.top, width: containerRect.width, height: containerRect.height });
    console.log('  mouseX:', mouseX, 'mouseY:', mouseY);
    console.log('  storedOffset:', { x: storedOffset.x, y: storedOffset.y });
    console.log('  currentDisplayOffset:', { x: displayOffset.x, y: displayOffset.y });
    console.log('  storedScale:', storedScale, 'currentScale:', scale);
    console.log('  svgX:', svgX, 'svgY:', svgY);
    console.log('  startX:', dragState.current.startX, 'startY:', dragState.current.startY);
    console.log('  rawDeltaX:', rawDeltaX, 'rawDeltaY:', rawDeltaY);
    console.log('  scaleMismatch:', storedScale !== scale);
    console.log('  offsetMismatch:', storedOffset.x !== displayOffset.x || storedOffset.y !== displayOffset.y);

    // Update DOM directly with transform
    dragState.current.currentDeltaX = rawDeltaX;
    dragState.current.currentDeltaY = rawDeltaY;
    dragState.current.cellGroupElement.setAttribute('transform', `translate(${rawDeltaX}, ${rawDeltaY})`);

    // Calculate snap preview only if snap is enabled
    if (snapEnabled) {
      const otherCells = cells.filter(c => c.id !== dragState.current.cellId);
      // Convert snap threshold from display pixels to SVG coordinates
      const snapThresholdInSvg = snapThreshold / storedScale;
      const snapResult = calculateSnap(
        dragState.current.initialCell,
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
        // The snap delta is relative to initial position, so we need to calculate
        // the snap offset relative to current dragged position
        const currentCell = new Cell(dragState.current.initialCell.toData());
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
        // Always update state to ensure UI reflects current state
        setSnapPreview(null);
        setSnappedCellId(null);
        setSnappedCellIds(new Set());
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
    if (!dragState.current.cellId) return;

    // Calculate final delta before removing transform
    const shouldSnap = snapPreview?.show && snapPreview.points.length > 0 && snappedCellId !== null;
    let finalDeltaX = dragState.current.currentDeltaX;
    let finalDeltaY = dragState.current.currentDeltaY;

    // Remove transform from DOM
    if (dragState.current.cellGroupElement) {
      dragState.current.cellGroupElement.removeAttribute('transform');
    }

    const draggedCellId = dragState.current.cellId;
    
    if (shouldSnap && dragState.current.initialCell) {
      // After transform removal, cell is at original position in data model
      // snapDeltaX/Y are already relative to initial position, so use them directly
      onCellMoveEnd(draggedCellId, shouldSnap, dragState.current.snapDeltaX, dragState.current.snapDeltaY);
    } else {
      // No snapping - apply the current drag position
      onCellMove(draggedCellId, finalDeltaX, finalDeltaY);
      onCellMoveEnd(draggedCellId, false, 0, 0);
    }

    // Reset drag state
    dragState.current = {
      cellId: null,
      cellGroupElement: null,
      startX: 0,
      startY: 0,
      initialCell: null,
      initialBounds: null,
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
  }, [snapPreview, snappedCellId, cells, onCellMove, onCellMoveEnd]);

  const handleMouseMoveCombined = (e: React.MouseEvent) => {
    if (isCreating) {
      handleCreateMove(e);
    } else if (mode === 'resize') {
      handleResizeMove(e);
    } else if (dragState.current.cellId) {
      handleCellMouseMove(e);
    }
  };

  const handleMouseUpCombined = () => {
    if (isCreating) {
      handleCreateUp();
    } else if (mode === 'resize') {
      handleResizeUp();
    } else if (dragState.current.cellId) {
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
        const detected = await detectWrongBordersUtil(annotation.cells, imageUrl);
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
  }, [detectWrongBorders, imageUrl, annotation]);

  const handleZoomIn = () => {
    setUserZoom(prev => {
      const newZoom = Math.min(prev * 1.2, 5);
      console.log('[Zoom Debug] handleZoomIn:');
      console.log('  prevZoom:', prev, 'newZoom:', newZoom);
      return newZoom;
    });
  };

  const handleZoomOut = () => {
    setUserZoom(prev => {
      const newZoom = Math.max(prev / 1.2, 0.1);
      console.log('[Zoom Debug] handleZoomOut:');
      console.log('  prevZoom:', prev, 'newZoom:', newZoom);
      return newZoom;
    });
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

      // Perform the zoom
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setUserZoom(prev => {
        const newZoom = Math.max(0.1, Math.min(5, prev * delta));
        console.log('[Zoom Debug] handleWheel zoom:');
        console.log('  prevZoom:', prev, 'newZoom:', newZoom);
        console.log('  delta:', delta, 'deltaY:', e.deltaY);
        return newZoom;
      });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

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

  // Use the same displayWidth and displayHeight calculated earlier
  // Calculate display offset accounting for zoom (keep image centered)
  // This should match displayOffset exactly since they use the same calculation
  const zoomedDisplayOffsetX = displayOffset.x;
  const zoomedDisplayOffsetY = displayOffset.y;

  const previewRect = getPreviewRect();

  const shouldShowSnapPreview = snapEnabled && snapPreview?.show && snapPreview.points.length > 0;

  return (
    <div
      className="image-canvas"
      ref={containerRef}
      onMouseMove={handleMouseMoveCombined}
      onMouseUp={handleMouseUpCombined}
      onMouseDown={handleCanvasMouseDown}
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
        <>
          <img
            src={imageUrl}
            alt="Annotation target"
            width={displayWidth}
            height={displayHeight}
            style={{
              position: 'absolute',
              top: `${zoomedDisplayOffsetY}px`,
              left: `${zoomedDisplayOffsetX}px`,
              width: `${displayWidth}px`,
              height: `${displayHeight}px`,
              maxWidth: 'none',
              maxHeight: 'none',
              display: 'block',
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
                top: `${zoomedDisplayOffsetY}px`,
                left: `${zoomedDisplayOffsetX}px`,
                width: `${displayWidth}px`,
                height: `${displayHeight}px`,
                pointerEvents: onCreateCell ? 'none' : 'all',
              }}
            >
              {annotation.cells.map(cell => {
                const pointsString = cell.points.map(p => `${p.x},${p.y}`).join(' ');
                const bounds = cell.getBounds();
                const left = bounds.minX;
                const right = bounds.maxX;
                const top = bounds.minY;
                const bottom = bounds.maxY;
                const selected = cell.id === selectedCellId;
                const isSnappedCell = snappedCellIds.has(cell.id);
                const VISIBLE_EDGE_COLOR = '#2563eb';
                const INVISIBLE_EDGE_COLOR = '#94a3b8';
                const CELL_FILL = 'rgba(37, 99, 235, 0.1)';
                const SELECTED_FILL = 'rgba(37, 99, 235, 0.2)';
                const SNAP_MATCHED_FILL = 'rgba(34, 197, 94, 0.2)';
                const CORNER_HANDLE_SIZE = 8;
                const CORNER_HANDLE_COLOR = '#2563eb';
                const CORNER_HANDLE_FILL = '#ffffff';

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
                    <polygon
                      points={pointsString}
                      fill={selected ? SELECTED_FILL : (isSnappedCell ? SNAP_MATCHED_FILL : CELL_FILL)}
                      stroke="none"
                      onMouseDown={mode === 'move' ? (e) => handleCellMouseDown(e, cell.id) : undefined}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCellSelect(cell.id === selectedCellId ? null : cell.id);
                      }}
                      style={{ cursor: mode === 'resize' ? 'default' : (mode === 'move' ? 'move' : 'default') }}
                    />
                    {mode === 'resize' && selected && cell.points.map((point, index) => (
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
              {detectWrongBorders && <WrongBorderRenderer wrongBorders={wrongBorders} />}
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

