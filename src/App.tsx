import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import { EdgeControls } from './components/EdgeControls';
import { FileUpload } from './components/FileUpload';
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

function App() {
  const { annotation, loadAnnotation, moveCell, updateCellLines, updateCellPoints, createCell, removeCell } = useAnnotation();
  const { shortcuts, updateShortcut } = useKeyboardShortcuts();
  const { settings: moveSpeedSettings, updateSettings: updateMoveSpeedSettings } = useMoveSpeedSettings();
  const [pairs, setPairs] = useState<ImageXmlPair[]>([]);
  const [selectedPairId, setSelectedPairId] = useState<string | null>(null);
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [isCreatingCell, setIsCreatingCell] = useState(false);
  const [mode, setMode] = useState<'move' | 'resize'>('move');
  const [showCells, setShowCells] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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
    setSelectedCellId(newCell.id);
    setIsCreatingCell(false);
    setMode('resize'); // Switch to resize mode after creating a cell
  }, [isCreatingCell, annotation, createCell]);

  const selectedCell = annotation?.getCellById(selectedCellId || '');

  // Use refs to store latest values to avoid recreating callbacks
  const moveSpeedSettingsRef = useRef(moveSpeedSettings);
  const selectedCellIdRef = useRef(selectedCellId);
  const modeRef = useRef(mode);
  const annotationRef = useRef(annotation);

  // Update refs when values change
  useEffect(() => {
    moveSpeedSettingsRef.current = moveSpeedSettings;
  }, [moveSpeedSettings]);

  useEffect(() => {
    selectedCellIdRef.current = selectedCellId;
  }, [selectedCellId]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    annotationRef.current = annotation;
  }, [annotation]);

  // Handle arrow key movement with acceleration in move mode
  const handleArrowKeyMove = useCallback((deltaX: number, deltaY: number) => {
    const currentSelectedCellId = selectedCellIdRef.current;
    const currentMode = modeRef.current;
    const currentAnnotation = annotationRef.current;
    const currentSettings = moveSpeedSettingsRef.current;

    if (!currentSelectedCellId || currentMode !== 'move' || !currentAnnotation) return;

    const currentCell = currentAnnotation.getCellById(currentSelectedCellId);
    if (!currentCell) return;

    // Apply snapping if enabled
    let finalDeltaX = deltaX;
    let finalDeltaY = deltaY;

    if (currentSettings.snapEnabled) {
      const otherCells = currentAnnotation.cells.filter(c => c.id !== currentSelectedCellId);
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

    moveCell(currentSelectedCellId, finalDeltaX, finalDeltaY);
  }, [moveCell]);

  useArrowKeyMovement({
    enabled: mode === 'move' && selectedCellId !== null && !isCreatingCell,
    onMove: handleArrowKeyMove,
    baseSpeed: moveSpeedSettings.baseSpeed,
    maxSpeed: moveSpeedSettings.maxSpeed,
    acceleration: moveSpeedSettings.acceleration,
    stepInterval: moveSpeedSettings.stepInterval,
  });

  // Load default files on mount (only once)
  const defaultFilesLoadedRef = useRef(false);
  useEffect(() => {
    if (defaultFilesLoadedRef.current) return;
    if (pairs.length > 0) return; // Don't load if pairs already exist
    
    defaultFilesLoadedRef.current = true;
    
    const loadDefaultFiles = async () => {
      const imageFileName = 'page_32_goc_3706_ec022de2-25a3-4386-ac1f-f3751db43bb5_patch_1.png';
      const xmlFileName = 'page_32_goc_3706_ec022de2-25a3-4386-ac1f-f3751db43bb5_patch_1.xml';

      try {
        // Fetch both files
        const [imageResponse, xmlResponse] = await Promise.all([
          fetch(`/${imageFileName}`),
          fetch(`/${xmlFileName}`),
        ]);

        if (!imageResponse.ok || !xmlResponse.ok) {
          console.warn('Default files not found, skipping auto-load');
          return;
        }

        // Convert to File objects
        const imageBlob = await imageResponse.blob();
        const xmlBlob = await xmlResponse.blob();

        const imageFile = new File([imageBlob], imageFileName, { type: imageBlob.type });
        const xmlFile = new File([xmlBlob], xmlFileName, { type: 'text/xml' });

        // Load the files using the existing handler
        handleFilesSelected([imageFile, xmlFile]);
      } catch (error) {
        console.error('Failed to load default files:', error);
      }
    };

    loadDefaultFiles();
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
  }, [shortcuts, annotation, currentImageUrl, isCreatingCell, handleCreateCell]);

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
                  if (selectedCellId) {
                    removeCell(selectedCellId);
                    setSelectedCellId(null);
                  }
                }}
                disabled={!annotation || !selectedCellId}
              >
                Remove Cell
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
            selectedCellId={selectedCellId}
            onCellSelect={setSelectedCellId}
            onCellMove={moveCell}
            onCellMoveEnd={(shouldSnap, snapDeltaX, snapDeltaY) => {
              if (shouldSnap && selectedCellId) {
                // Apply the snap by moving the cell to the snapped position
                moveCell(selectedCellId, snapDeltaX, snapDeltaY);
              }
            }}
            onCellResize={updateCellPoints}
            onCellResizeEnd={() => {}}
            onCreateCell={isCreatingCell ? handleCreateCellFromPoints : undefined}
            mode={mode}
            showCells={showCells}
            snapEnabled={moveSpeedSettings.snapEnabled}
            snapThreshold={moveSpeedSettings.snapThreshold}
          />
          <div className="controls-panel">
            {mode === 'move' && (
              <MoveSpeedSettings
                settings={moveSpeedSettings}
                onSettingsChange={updateMoveSpeedSettings}
                disabled={!annotation}
              />
            )}
            <EdgeControls
              cell={selectedCell || null}
              onUpdate={lines => {
                if (selectedCellId) {
                  updateCellLines(selectedCellId, lines);
                }
              }}
              onUpdatePoints={points => {
                if (selectedCellId) {
                  updateCellPoints(selectedCellId, points);
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

