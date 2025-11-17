import { useState, useCallback } from 'react';
import { Annotation } from '../models/Annotation';
import { AnnotationData } from '../models/types';
import { Cell } from '../models/Cell';
import { useUndoRedo } from './useUndoRedo';

export function useAnnotation() {
  const { annotation, setAnnotation, resetHistory, undo, redo, canUndo, canRedo } = useUndoRedo();

  const loadAnnotation = useCallback((data: AnnotationData) => {
    resetHistory(new Annotation(data));
  }, [resetHistory]);

  const updateCell = useCallback((cellId: string, updater: (cell: Cell) => void) => {
    setAnnotation(prev => {
      if (!prev) return prev;
      const cell = prev.getCellById(cellId);
      if (!cell) return prev;
      
      // Create a copy of the cell data, update it, then create new annotation
      const cellData = cell.toData();
      const tempCell = new Cell(cellData);
      updater(tempCell);
      const updatedCellData = tempCell.toData();
      
      // Create new annotation data with updated cell
      const data = prev.toData();
      const cellIndex = data.cells.findIndex(c => c.id === cellId);
      if (cellIndex !== -1) {
        data.cells[cellIndex] = updatedCellData;
      }
      return new Annotation(data);
    });
  }, []);

  const moveCell = useCallback((cellId: string, deltaX: number, deltaY: number) => {
    updateCell(cellId, cell => cell.move(deltaX, deltaY));
  }, [updateCell]);

  const updateCellLines = useCallback((cellId: string, lines: Partial<import('../models/types').CellLines>) => {
    updateCell(cellId, cell => {
      cell.lines = { ...cell.lines, ...lines };
    });
  }, [updateCell]);

  const updateCellPoints = useCallback((cellId: string, points: import('../models/types').Point[]) => {
    updateCell(cellId, cell => {
      cell.points = [...points];
    });
  }, [updateCell]);

  const createCell = useCallback((cellData: import('../models/types').CellData) => {
    setAnnotation(prev => {
      if (!prev) {
        const newAnnotation = new Annotation({
          filename: '',
          tableCoords: { points: [] },
          cells: [cellData],
        });
        return newAnnotation;
      }
      const data = prev.toData();
      data.cells.push(cellData);
      return new Annotation(data);
    });
  }, []);

  const removeCell = useCallback((cellId: string) => {
    setAnnotation(prev => {
      if (!prev) return prev;
      const data = prev.toData();
      data.cells = data.cells.filter(cell => cell.id !== cellId);
      return new Annotation(data);
    });
  }, []);

  const mergeCells = useCallback((cellIds: string[]): string | null => {
    if (cellIds.length < 2) return null;

    let mergedCellId: string | null = null;

    setAnnotation(prev => {
      if (!prev) return prev;
      
      // Get all cells to merge
      const cellsToMerge = cellIds
        .map(id => prev.getCellById(id))
        .filter((cell): cell is Cell => cell !== undefined);
      
      if (cellsToMerge.length < 2) return prev;

      // Calculate bounding box of all cells
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const cell of cellsToMerge) {
        const bounds = cell.getBounds();
        minX = Math.min(minX, bounds.minX);
        minY = Math.min(minY, bounds.minY);
        maxX = Math.max(maxX, bounds.maxX);
        maxY = Math.max(maxY, bounds.maxY);
      }

      // Create new merged cell as a rectangle
      mergedCellId = `cell-${Date.now()}`;
      const mergedCellData: import('../models/types').CellData = {
        id: mergedCellId,
        points: [
          { x: minX, y: minY }, // top-left
          { x: maxX, y: minY }, // top-right
          { x: maxX, y: maxY }, // bottom-right
          { x: minX, y: maxY }, // bottom-left
        ],
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
        // Use color and opacity from first cell
        color: cellsToMerge[0]?.color || '#2563eb',
        opacity: cellsToMerge[0]?.opacity !== undefined ? cellsToMerge[0].opacity : 0.1,
      };

      // Remove old cells and add new merged cell
      const data = prev.toData();
      data.cells = data.cells.filter(cell => !cellIds.includes(cell.id));
      data.cells.push(mergedCellData);
      
      return new Annotation(data);
    });

    return mergedCellId;
  }, []);

  const updateAllCellsColor = useCallback((color: string) => {
    setAnnotation(prev => {
      if (!prev) return prev;
      const data = prev.toData();
      data.cells = data.cells.map(cell => ({ ...cell, color }));
      return new Annotation(data);
    });
  }, []);

  const updateAllCellsOpacity = useCallback((opacity: number) => {
    setAnnotation(prev => {
      if (!prev) return prev;
      const data = prev.toData();
      data.cells = data.cells.map(cell => ({ ...cell, opacity }));
      return new Annotation(data);
    });
  }, []);

  return {
    annotation,
    loadAnnotation,
    updateCell,
    moveCell,
    updateCellLines,
    updateCellPoints,
    createCell,
    removeCell,
    mergeCells,
    updateAllCellsColor,
    updateAllCellsOpacity,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}

