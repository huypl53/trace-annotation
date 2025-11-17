import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import { EdgeControls } from './components/EdgeControls';
import { FileUpload } from './components/FileUpload';
import { HintSlider } from './components/HintSlider';
import { ImageCanvas } from './components/ImageCanvas';
import { MoveSpeedSettings, useMoveSpeedSettings } from './components/MoveSpeedSettings';
import { ShortcutEditor } from './components/ShortcutEditor';
import { Sidebar } from './components/Sidebar';
import { useAnnotation } from './hooks/useAnnotation';
import { useArrowKeyMovement } from './hooks/useArrowKeyMovement';
import { normalizeShortcut, parseKeyEvent, useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { Cell } from './models/Cell';
import { ImageXmlPair } from './models/types';
import { pairImageXmlFiles } from './utils/filePairing';
import { exportToJson } from './utils/jsonExporter';
import { calculateSnap } from './utils/snapping';
import { exportToXml } from './utils/xmlExporter';
import { parseXml } from './utils/xmlParser';
import { findOverlappingCellGroup } from './utils/polygonIntersection';
import { listFiles, downloadFile } from './utils/fileApi';

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
  const [detectWrongBorders, setDetectWrongBorders] = useState(false);
  const [horizontalPadding, setHorizontalPadding] = useState(2);
  const [verticalPadding, setVerticalPadding] = useState(3);
  
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

  const handleSelectPair = useCallback((pairId: string) => {
    setSelectedPairId(pairId);
    const pair = pairs.find(p => p.id === pairId);
    if (pair) {
      setCurrentImageUrl(pair.imageUrl || null);
      if (pair.xmlFile) {
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
      }
    }
  }, [pairs, loadAnnotation]);

  const handleRemovePair = useCallback((pairId: string) => {
    setPairs(prev => {
      const pair = prev.find(p => p.id === pairId);
      if (pair) {
        URL.revokeObjectURL(pair.imageUrl);
      }
      const newPairs = prev.filter(p => p.id !== pairId);
      if (selectedPairId === pairId) {
        setSelectedPairId(newPairs.length > 0 ? newPairs[0].id : null);
        if (newPairs.length > 0) {
          handleSelectPair(newPairs[0].id);
        } else {
          setCurrentImageUrl(null);
          loadAnnotation({
            filename: '',
            tableCoords: { points: [] },
            cells: [],
          });
        }
      }
      return newPairs;
    });
  }, [selectedPairId, handleSelectPair, loadAnnotation]);

  const handleExportXml = useCallback(() => {
    if (!annotation) return;
    const xmlString = exportToXml(annotation.toData());
    const blob = new Blob([xmlString], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = annotation.filename.replace(/\.(png|jpg|jpeg)$/i, '.xml');
    a.click();
    URL.revokeObjectURL(url);
  }, [annotation]);

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
            console.warn('Failed to load default files:', error);
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
          console.warn('Failed to load default files:', fallbackError);
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
        <div className="toolbar">
          <FileUpload onFilesSelected={handleFilesSelected} />
          <div className="toolbar-actions">
            <div className="mode-buttons">
              <div className={`mode-button-group ${mode === 'move' ? 'active' : ''}`}>
                <button
                  onClick={() => setMode('move')}
                  className={mode === 'move' ? 'active' : ''}
                  disabled={!annotation}
                >
                  Move Mode
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
                >
                  Resize Mode
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
            <div className="create-cell-group">
              <button
                onClick={() => {
                  if (!isCreatingCell) {
                    handleCreateCell();
                  } else {
                    setIsCreatingCell(false);
                  }
                }}
                disabled={!currentImageUrl}
                className={isCreatingCell ? 'active' : ''}
              >
                {isCreatingCell ? 'Cancel' : 'Create Cell'}
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
            <div className="export-buttons">
              <button onClick={handleExportXml} disabled={!annotation}>
                Export XML
              </button>
              <button onClick={handleExportJson} disabled={!annotation}>
                Export JSON
              </button>
            </div>
            <div className="cell-actions">
              <button
                onClick={() => {
                  if (selectedCellIds.size > 0) {
                    selectedCellIds.forEach(cellId => {
                      removeCell(cellId);
                    });
                    overlappingGroupRef.current = null; // Clear cache when removing cells
                    setSelectedCellIds(new Set());
                  }
                }}
                disabled={!annotation || selectedCellIds.size === 0}
              >
                Remove {selectedCellIds.size > 1 ? `${selectedCellIds.size} Cells` : 'Cell'}
              </button>
            </div>
            <div className="undo-redo-buttons">
              <button
                onClick={undo}
                disabled={!annotation || !canUndo}
                title="Undo (Ctrl+Z)"
              >
                Undo
              </button>
              <button
                onClick={redo}
                disabled={!annotation || !canRedo}
                title="Redo (Ctrl+Y)"
              >
                Redo
              </button>
            </div>
            <div className="visibility-controls">
              <label>
                <input
                  type="checkbox"
                  checked={showCells}
                  onChange={(e) => setShowCells(e.target.checked)}
                  disabled={!annotation}
                />
                <span>Show Cells</span>
              </label>
            </div>
          </div>
        </div>
        <div className="canvas-container">
          <ImageCanvas
            imageUrl={currentImageUrl}
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
          />
          <div className="controls-panel">
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
          </div>
        </div>
      </div>
      <HintSlider />
    </div>
  );
}

export default App;

