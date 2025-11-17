import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import { ConfirmDialog } from './components/ConfirmDialog';
import { EdgeControls } from './components/EdgeControls';
import { FileUpload } from './components/FileUpload';
import { HintSlider } from './components/HintSlider';
import { ImageCanvas } from './components/ImageCanvas';
import { ImageScaleControls } from './components/ImageScaleControls';
import { MoveSpeedSettings, useMoveSpeedSettings } from './components/MoveSpeedSettings';
import { ShortcutEditor } from './components/ShortcutEditor';
import { Sidebar } from './components/Sidebar';
import { UnsavedChangesDialog } from './components/UnsavedChangesDialog';
import { useAnnotation } from './hooks/useAnnotation';
import { useArrowKeyMovement } from './hooks/useArrowKeyMovement';
import { normalizeShortcut, parseKeyEvent, useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { Cell } from './models/Cell';
import { ImageXmlPair } from './models/types';
import { deleteFile, downloadFile, listFiles, uploadFiles } from './utils/fileApi';
import { pairImageXmlFiles } from './utils/filePairing';
import { exportToJson } from './utils/jsonExporter';
import { findOverlappingCellGroup } from './utils/polygonIntersection';
import { calculateSnap } from './utils/snapping';
import { exportToXml } from './utils/xmlExporter';
import { parseXml } from './utils/xmlParser';

function App() {
  const { annotation, loadAnnotation, moveCell, updateCell, updateCellLines, updateCellPoints, createCell, removeCell, updateAllCellsColor, updateAllCellsOpacity, undo, redo, canUndo, canRedo } = useAnnotation();
  const { shortcuts, updateShortcut } = useKeyboardShortcuts();
  const { settings: moveSpeedSettings, updateSettings: updateMoveSpeedSettings } = useMoveSpeedSettings();
  const [pairs, setPairs] = useState<ImageXmlPair[]>([]);
  const [selectedPairId, setSelectedPairId] = useState<string | null>(null);
  const [selectedCellIds, setSelectedCellIds] = useState<Set<string>>(new Set());
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [isCreatingCell, setIsCreatingCell] = useState(false);
  const [mode, setMode] = useState<'move' | 'resize'>('move');
  const [showCells, setShowCells] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false);
  const [isControlsPanelCollapsed, setIsControlsPanelCollapsed] = useState(false);
  const [detectWrongBorders, setDetectWrongBorders] = useState(false);
  const [horizontalPadding, setHorizontalPadding] = useState(2);
  const [verticalPadding, setVerticalPadding] = useState(3);
  const [imageZoom, setImageZoom] = useState(1);
  const [imageScale, setImageScale] = useState(1);
  const [scaledImageUrl, setScaledImageUrl] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingPairSwitch, setPendingPairSwitch] = useState<string | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const lastSavedAnnotationRef = useRef<string | null>(null);
  const isLoadingPairRef = useRef(false);
  const scaledImageBlobUrlRef = useRef<string | null>(null);
  
  // Clean up blob URL when component unmounts or image changes
  useEffect(() => {
    return () => {
      if (scaledImageBlobUrlRef.current) {
        URL.revokeObjectURL(scaledImageBlobUrlRef.current);
        scaledImageBlobUrlRef.current = null;
      }
    };
  }, []);

  // Clean up scaled image when currentImageUrl changes
  useEffect(() => {
    if (scaledImageBlobUrlRef.current) {
      URL.revokeObjectURL(scaledImageBlobUrlRef.current);
      scaledImageBlobUrlRef.current = null;
    }
    setScaledImageUrl(null);
  }, [currentImageUrl]);

  // Create scaled image from original image URL
  const createScaledImage = useCallback(async (imageUrl: string, scale: number): Promise<string> => {
    // Clean up old blob URL if exists
    if (scaledImageBlobUrlRef.current) {
      URL.revokeObjectURL(scaledImageBlobUrlRef.current);
      scaledImageBlobUrlRef.current = null;
    }

    // If scale is 1, return original URL
    if (scale === 1) {
      return imageUrl;
    }

    try {
      // Load the original image
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageUrl;
      });

      // Calculate scaled dimensions
      const scaledWidth = Math.round(img.width * scale);
      const scaledHeight = Math.round(img.height * scale);

      // Create canvas and draw scaled image
      const canvas = document.createElement('canvas');
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      // Use high-quality image scaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Draw the scaled image
      ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);

      // Convert to blob and create URL
      return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Failed to create blob'));
            return;
          }
          
          const url = URL.createObjectURL(blob);
          scaledImageBlobUrlRef.current = url;
          resolve(url);
        }, 'image/png');
      });
    } catch (error) {
      console.error('Failed to create scaled image:', error);
      throw error;
    }
  }, []);

  const handleSetImageScale = useCallback(async (scale: number) => {
    setImageScale(scale);
    
    if (!currentImageUrl) {
      return;
    }

    // If scale is 1, use original image
    if (scale === 1) {
      // Clean up old blob URL
      if (scaledImageBlobUrlRef.current) {
        URL.revokeObjectURL(scaledImageBlobUrlRef.current);
        scaledImageBlobUrlRef.current = null;
      }
      setScaledImageUrl(null);
      return;
    }

    try {
      const scaledUrl = await createScaledImage(currentImageUrl, scale);
      setScaledImageUrl(scaledUrl);
    } catch (error) {
      console.error('Failed to apply image scale:', error);
      alert('Failed to apply image scale. Please try again.');
      // Reset to original scale on error
      setImageScale(1);
      setScaledImageUrl(null);
    }
  }, [currentImageUrl, createScaledImage]);

  // Download scaled image
  const handleDownloadScaledImage = useCallback(async () => {
    // Use scaled image if available, otherwise use original
    const imageToDownload = scaledImageUrl || currentImageUrl;
    if (!imageToDownload) {
      return;
    }

    try {
      // Load the image
      const img = new Image();
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageToDownload;
      });

      // Create canvas and draw image (already scaled if scaledImageUrl is used)
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      // Use high-quality image scaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Draw the image
      ctx.drawImage(img, 0, 0);

      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (!blob) {
          throw new Error('Failed to create blob');
        }
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const scaleStr = imageScale.toString().replace('.', '_');
        link.download = `scaled_image_${scaleStr}x.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 'image/png');
    } catch (error) {
      console.error('Failed to download scaled image:', error);
      alert('Failed to download scaled image. Please try again.');
    }
  }, [scaledImageUrl, currentImageUrl, imageScale]);
  
  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    pairId: string | null;
    pairName: string;
  }>({
    isOpen: false,
    pairId: null,
    pairName: '',
  });
  
  // Track overlapping group for Tab cycling
  // sourceCellId is the cell that was manually selected (not via Tab)
  // cellIds is the sorted list of all cells in the overlapping group
  const overlappingGroupRef = useRef<{ sourceCellId: string; cellIds: string[] } | null>(null);
  
  // Track if last selection change was via Tab (to avoid clearing cache on Tab)
  const lastSelectionViaTabRef = useRef(false);

  const handleFilesSelected = useCallback((files: File[]) => {
    const newPairs = pairImageXmlFiles(files);
    
    if (newPairs.length === 0) {
      alert('No valid image or XML files found');
      return;
    }

    setPairs(prev => {
      // Check for duplicates by filename to prevent adding the same files twice
      const existingFilenames = new Set(
        prev.flatMap(p => [
          p.imageFile.name,
          p.xmlFile?.name
        ].filter(Boolean))
      );
      
      const uniqueNewPairs = newPairs.filter(pair => {
        const imageName = pair.imageFile.name;
        const xmlName = pair.xmlFile?.name;
        return !existingFilenames.has(imageName) && (!xmlName || !existingFilenames.has(xmlName));
      });
      
      if (uniqueNewPairs.length === 0) {
        return prev; // No new pairs to add
      }
      
      // Revoke old URLs for pairs that will be replaced
      const existingIds = new Set(prev.map(p => p.id));
      uniqueNewPairs.forEach(pair => {
        if (existingIds.has(pair.id)) {
          // Find the old pair and revoke its URL
          const oldPair = prev.find(p => p.id === pair.id);
          if (oldPair) {
            URL.revokeObjectURL(oldPair.imageUrl);
          }
        }
      });
      
      // Select the first new pair (use the filtered unique pairs)
      if (uniqueNewPairs.length > 0) {
        const firstPair = uniqueNewPairs[0];
        setSelectedPairId(firstPair.id);
        setCurrentImageUrl(firstPair.imageUrl || null);
        setImageZoom(1); // Reset zoom when loading new image
        setImageScale(1); // Reset scale when loading new image
        setScaledImageUrl(null); // Reset scaled image when loading new image
        // Load XML if available
        if (firstPair.xmlFile) {
          const reader = new FileReader();
          reader.onload = e => {
            const xmlString = e.target?.result as string;
            try {
              const annotationData = parseXml(xmlString);
              loadAnnotation(annotationData);
            } catch (error) {
              console.error('Failed to parse XML:', error);
            }
          };
          reader.readAsText(firstPair.xmlFile);
        } else {
          const filename = firstPair.imageFile.name 
            ? firstPair.imageFile.name.replace(/\.(png|jpg|jpeg)$/i, '.png')
            : 'annotation.png';
          loadAnnotation({
            filename,
            tableCoords: { points: [] },
            cells: [],
          });
        }
      }
      
      return [...prev, ...uniqueNewPairs];
    });
  }, [loadAnnotation]);

  const performPairSwitch = useCallback(async (pairId: string) => {
    setSelectedPairId(pairId);
    const pair = pairs.find(p => p.id === pairId);
    if (pair) {
      isLoadingPairRef.current = true;
      setImageZoom(1); // Reset zoom when selecting a different image
      setImageScale(1); // Reset scale when selecting a different image
      setScaledImageUrl(null); // Reset scaled image when selecting a different image
      
      try {
        // Fetch fresh image from server with cache-busting
        const imageFilename = pair.imageFile.name;
        const imageFile = await downloadFile(imageFilename, true);
        const freshImageUrl = URL.createObjectURL(imageFile);
        setCurrentImageUrl(freshImageUrl);
        
        // Revoke old URL if it exists
        if (pair.imageUrl && pair.imageUrl.startsWith('blob:')) {
          URL.revokeObjectURL(pair.imageUrl);
        }
        
        // Update the pair with the fresh image URL
        setPairs(prev => prev.map(p => {
          if (p.id === pairId) {
            return { ...p, imageUrl: freshImageUrl, imageFile };
          }
          return p;
        }));
        
        // Load XML from server if available
        if (pair.xmlFile) {
          const xmlFilename = pair.xmlFile.name;
          const xmlFile = await downloadFile(xmlFilename, true);
          const reader = new FileReader();
          reader.onload = e => {
            const xmlString = e.target?.result as string;
            try {
              const annotationData = parseXml(xmlString);
              loadAnnotation(annotationData);
              // Set saved state to the exported XML from the loaded annotation
              // This ensures we compare apples to apples
              const exportedXml = exportToXml(annotationData);
              lastSavedAnnotationRef.current = exportedXml;
              setHasUnsavedChanges(false);
              isLoadingPairRef.current = false;
              
              // Update the pair with the fresh XML file
              setPairs(prev => prev.map(p => {
                if (p.id === pairId) {
                  return { ...p, xmlFile };
                }
                return p;
              }));
            } catch (error) {
              console.error('Failed to parse XML:', error);
              lastSavedAnnotationRef.current = null;
              setHasUnsavedChanges(true);
              isLoadingPairRef.current = false;
            }
          };
          reader.readAsText(xmlFile);
        } else {
          const filename = pair.imageFile.name 
            ? pair.imageFile.name.replace(/\.(png|jpg|jpeg)$/i, '.png')
            : 'annotation.png';
          loadAnnotation({
            filename,
            tableCoords: { points: [] },
            cells: [],
          });
          lastSavedAnnotationRef.current = null;
          setHasUnsavedChanges(true);
          isLoadingPairRef.current = false;
        }
      } catch (error) {
        console.error('Failed to load files from server:', error);
        // Fallback to cached files if server fetch fails
        setCurrentImageUrl(pair.imageUrl || null);
        if (pair.xmlFile) {
          const reader = new FileReader();
          reader.onload = e => {
            const xmlString = e.target?.result as string;
            try {
              const annotationData = parseXml(xmlString);
              loadAnnotation(annotationData);
              const exportedXml = exportToXml(annotationData);
              lastSavedAnnotationRef.current = exportedXml;
              setHasUnsavedChanges(false);
              isLoadingPairRef.current = false;
            } catch (error) {
              console.error('Failed to parse XML:', error);
              lastSavedAnnotationRef.current = null;
              setHasUnsavedChanges(true);
              isLoadingPairRef.current = false;
            }
          };
          reader.readAsText(pair.xmlFile);
        } else {
          const filename = pair.imageFile.name 
            ? pair.imageFile.name.replace(/\.(png|jpg|jpeg)$/i, '.png')
            : 'annotation.png';
          loadAnnotation({
            filename,
            tableCoords: { points: [] },
            cells: [],
          });
          lastSavedAnnotationRef.current = null;
          setHasUnsavedChanges(true);
          isLoadingPairRef.current = false;
        }
      }
    }
    setPendingPairSwitch(null);
    setShowUnsavedDialog(false);
  }, [pairs, loadAnnotation]);

  const handleSelectPair = useCallback((pairId: string) => {
    if (hasUnsavedChanges && pairId !== selectedPairId) {
      setPendingPairSwitch(pairId);
      setShowUnsavedDialog(true);
    } else {
      performPairSwitch(pairId);
    }
  }, [hasUnsavedChanges, selectedPairId, performPairSwitch]);

  // Normalize XML string for comparison (remove whitespace differences)
  const normalizeXml = useCallback((xml: string): string => {
    // Parse and re-export to normalize formatting
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');
      const serializer = new XMLSerializer();
      return serializer.serializeToString(doc);
    } catch {
      // If parsing fails, return original
      return xml;
    }
  }, []);

  const handleSaveXml = useCallback(async () => {
    if (!annotation) return;
    
    try {
      const xmlString = exportToXml(annotation.toData());
      const xmlFilename = annotation.filename.replace(/\.(png|jpg|jpeg)$/i, '.xml');
      const blob = new Blob([xmlString], { type: 'text/xml' });
      const xmlFile = new File([blob], xmlFilename, { type: 'text/xml' });
      
      const imageFilename = annotation.filename.replace(/\.(jpg|jpeg)$/i, '.png');
      const filesToUpload: File[] = [xmlFile];
      
      // Get the image to save (create scaled version if needed)
      if (currentImageUrl) {
        try {
          let imageToSave: string;
          
          // If scale is not 1, ensure we have a scaled image
          if (imageScale !== 1) {
            // Use existing scaled image or create one
            imageToSave = scaledImageUrl || await createScaledImage(currentImageUrl, imageScale);
          } else {
            // Use original image
            imageToSave = currentImageUrl;
          }
          
          // Fetch the image and convert to File
          const response = await fetch(imageToSave);
          const imageBlob = await response.blob();
          const imageFile = new File([imageBlob], imageFilename, { type: 'image/png' });
          filesToUpload.push(imageFile);
        } catch (imageError) {
          console.error('Failed to convert image to file:', imageError);
          // Continue with XML upload even if image conversion fails
        }
      }
      
      // Save to server
      await uploadFiles(filesToUpload);
      
      // Mark as saved
      lastSavedAnnotationRef.current = xmlString;
      setHasUnsavedChanges(false);
      
      // Update the pair to include the XML file if it doesn't exist
      setPairs(prev => prev.map(pair => {
        if (pair.id === selectedPairId && !pair.xmlFile) {
          return { ...pair, xmlFile };
        }
        return pair;
      }));
    } catch (error) {
      console.error('Failed to save XML to server:', error);
      // Don't mark as saved if upload fails
    }
  }, [annotation, selectedPairId, scaledImageUrl, currentImageUrl, imageScale, createScaledImage]);

  const handleUnsavedDialogSave = useCallback(() => {
    if (pendingPairSwitch) {
      handleSaveXml().then(() => {
        performPairSwitch(pendingPairSwitch);
      });
    }
  }, [pendingPairSwitch, handleSaveXml, performPairSwitch]);

  const handleUnsavedDialogDiscard = useCallback(() => {
    if (pendingPairSwitch) {
      performPairSwitch(pendingPairSwitch);
    }
  }, [pendingPairSwitch, performPairSwitch]);

  const handleUnsavedDialogCancel = useCallback(() => {
    setShowUnsavedDialog(false);
    setPendingPairSwitch(null);
  }, []);

  const handleRemovePair = useCallback((pairId: string) => {
    const pair = pairs.find(p => p.id === pairId);
    if (pair) {
      const pairName = pair.imageFile.name || (pair.xmlFile ? pair.xmlFile.name : 'Unknown');
      setConfirmDialog({
        isOpen: true,
        pairId,
        pairName,
      });
    }
  }, [pairs]);

  const handleConfirmRemove = useCallback(async () => {
    if (!confirmDialog.pairId) return;

    const pair = pairs.find(p => p.id === confirmDialog.pairId);
    if (!pair) {
      setConfirmDialog({ isOpen: false, pairId: null, pairName: '' });
      return;
    }

    try {
      // Delete files from server
      const filesToDelete: string[] = [pair.imageFile.name];
      if (pair.xmlFile) {
        filesToDelete.push(pair.xmlFile.name);
      }

      // Delete all files from server
      await Promise.all(
        filesToDelete.map(filename => 
          deleteFile(filename).catch(error => {
            console.error(`Failed to delete file ${filename} from server:`, error);
            // Continue with local removal even if server deletion fails
          })
        )
      );
    } catch (error) {
      console.error('Error deleting files from server:', error);
      // Continue with local removal even if server deletion fails
    }

    // Remove from local state
    setPairs(prev => {
      const pairToRemove = prev.find(p => p.id === confirmDialog.pairId);
      if (pairToRemove) {
        URL.revokeObjectURL(pairToRemove.imageUrl);
      }
      const newPairs = prev.filter(p => p.id !== confirmDialog.pairId);
      if (selectedPairId === confirmDialog.pairId) {
        setSelectedPairId(newPairs.length > 0 ? newPairs[0].id : null);
        if (newPairs.length > 0) {
          handleSelectPair(newPairs[0].id);
        } else {
          setCurrentImageUrl(null);
          setScaledImageUrl(null);
          loadAnnotation({
            filename: '',
            tableCoords: { points: [] },
            cells: [],
          });
        }
      }
      return newPairs;
    });

    // Close dialog
    setConfirmDialog({ isOpen: false, pairId: null, pairName: '' });
  }, [confirmDialog, pairs, selectedPairId, handleSelectPair, loadAnnotation]);

  const handleCancelRemove = useCallback(() => {
    setConfirmDialog({ isOpen: false, pairId: null, pairName: '' });
  }, []);

  // Track annotation changes to detect unsaved changes
  useEffect(() => {
    // Skip comparison if we're currently loading a new pair
    if (isLoadingPairRef.current) {
      return;
    }

    if (!annotation) {
      setHasUnsavedChanges(false);
      lastSavedAnnotationRef.current = null;
      return;
    }

    const currentXml = exportToXml(annotation.toData());
    
    // If we have a saved reference, compare with current
    if (lastSavedAnnotationRef.current !== null) {
      // Compare normalized XML strings to account for formatting differences
      const normalizedCurrent = normalizeXml(currentXml);
      const normalizedSaved = normalizeXml(lastSavedAnnotationRef.current);
      setHasUnsavedChanges(normalizedCurrent !== normalizedSaved);
    } else {
      // No saved reference means this is a new annotation without XML file
      // performPairSwitch will have already set hasUnsavedChanges, but we ensure it here too
      const pair = pairs.find(p => p.id === selectedPairId);
      if (!pair?.xmlFile) {
        setHasUnsavedChanges(true);
      }
    }
  }, [annotation, pairs, selectedPairId, normalizeXml]);

  const handleExportXml = useCallback(() => {
    handleSaveXml();
  }, [handleSaveXml]);

  const handleExportJson = useCallback(() => {
    if (!annotation) return;
    const jsonString = exportToJson(annotation.toData());
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = annotation.filename.replace(/\.(png|jpg|jpeg)$/i, '.json');
    a.click();
    URL.revokeObjectURL(url);
  }, [annotation]);

  const handleCreateCell = useCallback(() => {
    if (!currentImageUrl) {
      alert('Please upload an image first');
      return;
    }
    // If no annotation exists, create an empty one
    if (!annotation) {
      const pair = pairs.find(p => p.id === selectedPairId);
      const filename = pair?.imageFile.name.replace(/\.(png|jpg|jpeg)$/i, '.png') || 'annotation.png';
      loadAnnotation({
        filename,
        tableCoords: { points: [] },
        cells: [],
      });
    }
    setIsCreatingCell(true);
  }, [annotation, currentImageUrl, pairs, selectedPairId, loadAnnotation]);

  const handleCreateCellFromPoints = useCallback((points: import('./models/types').Point[]) => {
    if (!isCreatingCell || !annotation) return;

    const newCell: import('./models/types').CellData = {
      id: `cell-${Date.now()}`,
      points,
      lines: {
        top: 1,
        bottom: 1,
        left: 1,
        right: 1,
      },
      startRow: 0,
      endRow: 0,
      startCol: 0,
      endCol: 0,
    };

    createCell(newCell);
    overlappingGroupRef.current = null; // Clear cache when creating new cell
    setSelectedCellIds(new Set([newCell.id]));
    setIsCreatingCell(false);
    setMode('resize'); // Switch to resize mode after creating a cell
  }, [isCreatingCell, annotation, createCell]);

  const selectedCells = annotation ? Array.from(selectedCellIds).map(id => annotation.getCellById(id)).filter(Boolean) as Cell[] : [];
  const selectedCell = selectedCells.length === 1 ? selectedCells[0] : null;

  // Use refs to store latest values to avoid recreating callbacks
  const moveSpeedSettingsRef = useRef(moveSpeedSettings);
  const selectedCellIdsRef = useRef(selectedCellIds);
  const modeRef = useRef(mode);
  const annotationRef = useRef(annotation);

  // Update refs when values change
  useEffect(() => {
    moveSpeedSettingsRef.current = moveSpeedSettings;
  }, [moveSpeedSettings]);

  useEffect(() => {
    selectedCellIdsRef.current = selectedCellIds;
  }, [selectedCellIds]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Validate selection when annotation changes (e.g., after undo/redo)
  useEffect(() => {
    if (!annotation) {
      // Clear selection if annotation is removed
      if (selectedCellIds.size > 0) {
        setSelectedCellIds(new Set());
        overlappingGroupRef.current = null;
      }
      return;
    }

    // Filter out any selected cell IDs that no longer exist
    const validCellIds = Array.from(selectedCellIds).filter(id => 
      annotation.getCellById(id) !== null
    );

    if (validCellIds.length !== selectedCellIds.size) {
      // Some selected cells no longer exist, update selection
      setSelectedCellIds(new Set(validCellIds));
      if (validCellIds.length === 0) {
        overlappingGroupRef.current = null;
      }
    }
  }, [annotation, selectedCellIds]);

  useEffect(() => {
    annotationRef.current = annotation;
  }, [annotation]);

  // Handle arrow key movement with acceleration in move mode
  const handleArrowKeyMove = useCallback((deltaX: number, deltaY: number) => {
    const currentSelectedCellIds = selectedCellIdsRef.current;
    const currentMode = modeRef.current;
    const currentAnnotation = annotationRef.current;
    const currentSettings = moveSpeedSettingsRef.current;

    if (currentSelectedCellIds.size === 0 || currentMode !== 'move' || !currentAnnotation) return;

    // Apply snapping if enabled (only for single cell selection)
    let finalDeltaX = deltaX;
    let finalDeltaY = deltaY;

    if (currentSettings.snapEnabled && currentSelectedCellIds.size === 1) {
      const cellId = Array.from(currentSelectedCellIds)[0];
      const currentCell = currentAnnotation.getCellById(cellId);
      if (currentCell) {
        const otherCells = currentAnnotation.cells.filter(c => c.id !== cellId);
        // Create a temporary cell copy to calculate snap position
        const tempCell = new Cell(currentCell.toData());
        const snapResult = calculateSnap(
          tempCell,
          otherCells,
          deltaX,
          deltaY,
          currentSettings.snapThreshold
        );
        finalDeltaX = snapResult.deltaX;
        finalDeltaY = snapResult.deltaY;
      }
    }

    // Move all selected cells
    currentSelectedCellIds.forEach(cellId => {
      moveCell(cellId, finalDeltaX, finalDeltaY);
    });
  }, [moveCell]);

  useArrowKeyMovement({
    enabled: mode === 'move' && selectedCellIds.size > 0 && !isCreatingCell,
    onMove: handleArrowKeyMove,
    baseSpeed: moveSpeedSettings.baseSpeed,
    maxSpeed: moveSpeedSettings.maxSpeed,
    acceleration: moveSpeedSettings.acceleration,
    stepInterval: moveSpeedSettings.stepInterval,
  });

  // Load files from backend on mount (only once)
  const defaultFilesLoadedRef = useRef(false);
  useEffect(() => {
    if (defaultFilesLoadedRef.current) return;
    if (pairs.length > 0) return; // Don't load if pairs already exist
    
    defaultFilesLoadedRef.current = true;
    
    const loadFilesFromBackend = async () => {
      try {
        // Get list of files from backend
        const fileInfos = await listFiles();
        
        if (fileInfos.length === 0) {
          // Fallback to default files in public folder if backend has no files
          const imageFileName = 'page_32_goc_3706_ec022de2-25a3-4386-ac1f-f3751db43bb5_patch_1.png';
          const xmlFileName = 'page_32_goc_3706_ec022de2-25a3-4386-ac1f-f3751db43bb5_patch_1.xml';

          try {
            const [imageResponse, xmlResponse] = await Promise.all([
              fetch(`/${imageFileName}`),
              fetch(`/${xmlFileName}`),
            ]);

            if (imageResponse.ok && xmlResponse.ok) {
              const imageBlob = await imageResponse.blob();
              const xmlBlob = await xmlResponse.blob();
              const imageFile = new File([imageBlob], imageFileName, { type: imageBlob.type });
              const xmlFile = new File([xmlBlob], xmlFileName, { type: 'text/xml' });
              handleFilesSelected([imageFile, xmlFile]);
            }
          } catch (error) {
            // Failed to load default files, continue without them
          }
          return;
        }

        // Download all files from backend and convert to File objects
        const files: File[] = [];
        for (const fileInfo of fileInfos) {
          try {
            const file = await downloadFile(fileInfo.name);
            files.push(file);
          } catch (error) {
            console.error(`Failed to download file ${fileInfo.name}:`, error);
          }
        }

        if (files.length > 0) {
          handleFilesSelected(files);
        }
      } catch (error) {
        console.error('Failed to load files from backend:', error);
        // Fallback to default files if backend is unavailable
        const imageFileName = 'page_32_goc_3706_ec022de2-25a3-4386-ac1f-f3751db43bb5_patch_1.png';
        const xmlFileName = 'page_32_goc_3706_ec022de2-25a3-4386-ac1f-f3751db43bb5_patch_1.xml';

        try {
          const [imageResponse, xmlResponse] = await Promise.all([
            fetch(`/${imageFileName}`),
            fetch(`/${xmlFileName}`),
          ]);

          if (imageResponse.ok && xmlResponse.ok) {
            const imageBlob = await imageResponse.blob();
            const xmlBlob = await xmlResponse.blob();
            const imageFile = new File([imageBlob], imageFileName, { type: imageBlob.type });
            const xmlFile = new File([xmlBlob], xmlFileName, { type: 'text/xml' });
            handleFilesSelected([imageFile, xmlFile]);
          }
        } catch (fallbackError) {
          // Failed to load default files, continue without them
        }
      }
    };

    loadFilesFromBackend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const pressedKey = parseKeyEvent(e);
      const normalizedPressed = normalizeShortcut(pressedKey);
      
      // Handle Ctrl+S to save XML
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (annotation) {
          handleSaveXml();
        }
        return;
      }
      
      // Handle Tab key to cycle through overlapping cells
      if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (annotation && selectedCellIds.size === 1) {
          e.preventDefault();
          const selectedCellId = Array.from(selectedCellIds)[0];
          const allCells = annotation.cells.map(cell => ({ id: cell.id, points: cell.points }));
          
          const cachedGroup = overlappingGroupRef.current;
          let overlappingArray: string[];
          
          // Recalculate if no cache, or if current selection is not in cached group
          if (!cachedGroup || !cachedGroup.cellIds.includes(selectedCellId)) {
            // Recalculate overlapping group from the selected cell
            const overlappingGroup = findOverlappingCellGroup(selectedCellId, allCells);
            
            if (overlappingGroup.size > 1) {
              overlappingArray = Array.from(overlappingGroup).sort();
              // Cache the group - use the first cell in sorted order as source
              overlappingGroupRef.current = {
                sourceCellId: overlappingArray[0],
                cellIds: overlappingArray,
              };
            } else {
              // No overlapping cells, clear cache
              overlappingGroupRef.current = null;
              return;
            }
          } else {
            // Use cached group - continue cycling through the same group
            overlappingArray = cachedGroup.cellIds;
          }
          
          // Find current index in the overlapping array
          const currentIndex = overlappingArray.indexOf(selectedCellId);
          
          if (currentIndex === -1) {
            // Shouldn't happen if cache is valid, but handle it
            return;
          }
          
          // Calculate next index with wrap-around
          const nextIndex = e.shiftKey 
            ? (currentIndex - 1 + overlappingArray.length) % overlappingArray.length // Shift+Tab cycles backward
            : (currentIndex + 1) % overlappingArray.length; // Tab cycles forward
          
          const nextCellId = overlappingArray[nextIndex];
          
          // Mark that this selection change is via Tab
          lastSelectionViaTabRef.current = true;
          
          // Update selection
          setSelectedCellIds(new Set([nextCellId]));
        }
        return;
      }
      
      // Handle undo/redo with standard shortcuts
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          // Ctrl+Z or Cmd+Z for undo
          if (canUndo && annotation) {
            e.preventDefault();
            undo();
          }
          return;
        } else if ((e.key === 'y' || (e.key === 'z' && e.shiftKey)) && !e.altKey) {
          // Ctrl+Y or Ctrl+Shift+Z for redo
          if (canRedo && annotation) {
            e.preventDefault();
            redo();
          }
          return;
        }
      }
      
      if (normalizedPressed === normalizeShortcut(shortcuts.move)) {
        if (annotation) {
          e.preventDefault();
          setMode('move');
        }
      } else if (normalizedPressed === normalizeShortcut(shortcuts.resize)) {
        if (annotation) {
          e.preventDefault();
          setMode('resize');
        }
      } else if (normalizedPressed === normalizeShortcut(shortcuts.createCell)) {
        if (currentImageUrl) {
          e.preventDefault();
          if (!isCreatingCell) {
            handleCreateCell();
          } else {
            setIsCreatingCell(false);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, annotation, currentImageUrl, isCreatingCell, handleCreateCell, canUndo, canRedo, undo, redo, selectedCellIds]);

  return (
    <div className="app">
      <Sidebar
        pairs={pairs}
        onSelectPair={handleSelectPair}
        onRemovePair={handleRemovePair}
        selectedPairId={selectedPairId}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
      />
      <div className="main-content">
        <div className={`toolbar ${isToolbarCollapsed ? 'collapsed' : ''}`}>
          <div className="toolbar-header">
            <button 
              className="toolbar-toggle" 
              onClick={() => setIsToolbarCollapsed(prev => !prev)}
              title={isToolbarCollapsed ? 'Expand toolbar' : 'Collapse toolbar'}
            >
              {isToolbarCollapsed ? '▼' : '▲'}
            </button>
          </div>
          {!isToolbarCollapsed && (
            <>
              <div className="toolbar-section toolbar-section-left">
            <div className="toolbar-group">
              <FileUpload onFilesSelected={handleFilesSelected} />
            </div>
            <div className="toolbar-divider" />
            <div className="toolbar-group">
              <div className="mode-buttons">
                <div className={`mode-button-group ${mode === 'move' ? 'active' : ''}`}>
                  <button
                    onClick={() => setMode('move')}
                    className={mode === 'move' ? 'active' : ''}
                    disabled={!annotation}
                    title="Move cells (M)"
                  >
                    <span className="button-icon">↔</span>
                    <span className="button-text">Move</span>
                  </button>
                  <ShortcutEditor
                    label=""
                    shortcutKey="move"
                    currentShortcut={shortcuts.move}
                    onUpdate={updateShortcut}
                    disabled={!annotation}
                    active={mode === 'move'}
                  />
                </div>
                <div className={`mode-button-group ${mode === 'resize' ? 'active' : ''}`}>
                  <button
                    onClick={() => setMode('resize')}
                    className={mode === 'resize' ? 'active' : ''}
                    disabled={!annotation}
                    title="Resize cells (R)"
                  >
                    <span className="button-icon">⤢</span>
                    <span className="button-text">Resize</span>
                  </button>
                  <ShortcutEditor
                    label=""
                    shortcutKey="resize"
                    currentShortcut={shortcuts.resize}
                    onUpdate={updateShortcut}
                    disabled={!annotation}
                    active={mode === 'resize'}
                  />
                </div>
              </div>
            </div>
            <div className="toolbar-divider" />
            <div className="toolbar-group">
              <button
                onClick={() => {
                  if (!isCreatingCell) {
                    handleCreateCell();
                  } else {
                    setIsCreatingCell(false);
                  }
                }}
                disabled={!currentImageUrl}
                className={`toolbar-button toolbar-button-primary ${isCreatingCell ? 'active' : ''}`}
                title="Create new cell (C)"
              >
                <span className="button-icon">{isCreatingCell ? '✕' : '+'}</span>
                <span className="button-text">{isCreatingCell ? 'Cancel' : 'Create Cell'}</span>
              </button>
              <ShortcutEditor
                label=""
                shortcutKey="createCell"
                currentShortcut={shortcuts.createCell}
                onUpdate={updateShortcut}
                disabled={!currentImageUrl}
                active={isCreatingCell}
              />
            </div>
          </div>
          
          <div className="toolbar-section toolbar-section-right">
            <div className="toolbar-group">
              <button
                onClick={undo}
                disabled={!annotation || !canUndo}
                className="toolbar-button toolbar-button-icon"
                title="Undo (Ctrl+Z)"
              >
                <span className="button-icon">↶</span>
                <span className="button-text">Undo</span>
              </button>
              <button
                onClick={redo}
                disabled={!annotation || !canRedo}
                className="toolbar-button toolbar-button-icon"
                title="Redo (Ctrl+Y)"
              >
                <span className="button-icon">↷</span>
                <span className="button-text">Redo</span>
              </button>
            </div>
            <div className="toolbar-divider" />
            <div className="toolbar-group">
              <button
                onClick={() => {
                  if (selectedCellIds.size > 0) {
                    selectedCellIds.forEach(cellId => {
                      removeCell(cellId);
                    });
                    overlappingGroupRef.current = null;
                    setSelectedCellIds(new Set());
                  }
                }}
                disabled={!annotation || selectedCellIds.size === 0}
                className="toolbar-button toolbar-button-danger"
                title="Remove selected cell(s)"
              >
                <span className="button-icon">🗑</span>
                <span className="button-text">Remove {selectedCellIds.size > 1 ? `${selectedCellIds.size}` : ''}</span>
              </button>
            </div>
            <div className="toolbar-divider" />
            <div className="toolbar-group">
              <button
                onClick={handleExportXml}
                disabled={!annotation}
                className={`toolbar-button toolbar-button-export ${hasUnsavedChanges ? 'has-unsaved-changes' : ''}`}
                title={`Save XML (Ctrl+S)${hasUnsavedChanges ? ' - Unsaved changes' : ''}`}
              >
                <span className="button-icon">💾</span>
                <span className="button-text">Save XML</span>
                {hasUnsavedChanges && <span className="unsaved-indicator">●</span>}
              </button>
              <button
                onClick={handleExportJson}
                disabled={!annotation}
                className="toolbar-button toolbar-button-export"
                title="Export as JSON"
              >
                <span className="button-icon">📋</span>
                <span className="button-text">JSON</span>
              </button>
            </div>
            <div className="toolbar-divider" />
            <div className="toolbar-group">
              <label className="toolbar-checkbox">
                <input
                  type="checkbox"
                  checked={showCells}
                  onChange={(e) => setShowCells(e.target.checked)}
                  disabled={!annotation}
                />
                <span className="checkbox-label">Show Cells</span>
              </label>
            </div>
          </div>
            </>
          )}
        </div>
        <div className="canvas-container">
          <ImageCanvas
            imageUrl={scaledImageUrl || currentImageUrl}
            annotation={annotation}
            selectedCellIds={selectedCellIds}
            onCellSelect={(cellIds) => {
              // If selection change was not via Tab, clear the overlapping group cache
              // This allows a new overlapping group to be calculated when Tab is pressed
              if (!lastSelectionViaTabRef.current) {
                overlappingGroupRef.current = null;
              }
              lastSelectionViaTabRef.current = false;
              setSelectedCellIds(cellIds);
            }}
            onCellMove={moveCell}
            onCellMoveEnd={(cellId, shouldSnap, snapDeltaX, snapDeltaY) => {
              if (shouldSnap) {
                // Apply the snap by moving the cell to the snapped position
                moveCell(cellId, snapDeltaX, snapDeltaY);
              }
            }}
            onCellResize={updateCellPoints}
            onCellResizeEnd={() => {}}
            onCreateCell={isCreatingCell ? handleCreateCellFromPoints : undefined}
            mode={mode}
            showCells={showCells}
            snapEnabled={moveSpeedSettings.snapEnabled}
            snapThreshold={moveSpeedSettings.snapThreshold}
            detectWrongBorders={detectWrongBorders}
            horizontalPadding={horizontalPadding}
            verticalPadding={verticalPadding}
            externalZoom={imageZoom}
            onZoomChange={setImageZoom}
          />
          <div className={`controls-panel ${isControlsPanelCollapsed ? 'collapsed' : ''}`}>
            <div className="controls-panel-header">
              <button 
                className="controls-panel-toggle" 
                onClick={() => setIsControlsPanelCollapsed(prev => !prev)}
                title={isControlsPanelCollapsed ? 'Expand controls' : 'Collapse controls'}
              >
                {isControlsPanelCollapsed ? '◀' : '▶'}
              </button>
            </div>
            {!isControlsPanelCollapsed && (
              <>
            <ImageScaleControls
              currentScale={imageScale}
              onSetScale={handleSetImageScale}
              disabled={!currentImageUrl}
              imageUrl={currentImageUrl}
              onDownloadImage={handleDownloadScaledImage}
            />
            {mode === 'move' && (
              <MoveSpeedSettings
                settings={moveSpeedSettings}
                onSettingsChange={updateMoveSpeedSettings}
                disabled={!annotation}
              />
            )}
            <div className="wrong-border-detection-section">
              <h4>Detect Wrong Borders</h4>
              <label>
                <input
                  type="checkbox"
                  checked={detectWrongBorders}
                  onChange={(e) => setDetectWrongBorders(e.target.checked)}
                  disabled={!annotation || !currentImageUrl}
                />
                <span>Enable Detection</span>
              </label>
              {detectWrongBorders && (
                <div className="padding-controls">
                  <label className="padding-input-label">
                    <span>Horizontal Padding:</span>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={horizontalPadding}
                      onChange={(e) => setHorizontalPadding(Math.max(1, Math.min(20, parseInt(e.target.value) || 2)))}
                      disabled={!annotation || !currentImageUrl}
                    />
                  </label>
                  <label className="padding-input-label">
                    <span>Vertical Padding:</span>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={verticalPadding}
                      onChange={(e) => setVerticalPadding(Math.max(1, Math.min(20, parseInt(e.target.value) || 3)))}
                      disabled={!annotation || !currentImageUrl}
                    />
                  </label>
                </div>
              )}
            </div>
            <EdgeControls
              cell={selectedCell || null}
              selectedCells={selectedCells.length > 1 ? selectedCells : []}
              onUpdate={lines => {
                // Apply to all selected cells
                selectedCellIds.forEach(cellId => {
                  updateCellLines(cellId, lines);
                });
              }}
              onUpdatePoints={points => {
                // Only update if single cell selected
                if (selectedCellIds.size === 1) {
                  const cellId = Array.from(selectedCellIds)[0];
                  updateCellPoints(cellId, points);
                }
              }}
              onUpdateColor={color => {
                updateAllCellsColor(color);
              }}
              onUpdateOpacity={opacity => {
                updateAllCellsOpacity(opacity);
              }}
              globalColor={annotation?.cells[0]?.color}
              globalOpacity={annotation?.cells[0]?.opacity}
            />
              </>
            )}
          </div>
        </div>
      </div>
      <HintSlider />
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title="Confirm Deletion"
        message={`Are you sure you want to delete "${confirmDialog.pairName}"? This will remove the file from both the application and the server. This action cannot be undone.`}
        onConfirm={handleConfirmRemove}
        onCancel={handleCancelRemove}
        confirmText="Delete"
        cancelText="Cancel"
      />
      {showUnsavedDialog && (
        <UnsavedChangesDialog
          onSave={handleUnsavedDialogSave}
          onDiscard={handleUnsavedDialogDiscard}
          onCancel={handleUnsavedDialogCancel}
        />
      )}
    </div>
  );
}

export default App;

