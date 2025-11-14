import { useState, useCallback } from 'react';
import { Annotation } from '../models/Annotation';
import { AnnotationData } from '../models/types';
import { Cell } from '../models/Cell';

export function useAnnotation() {
  const [annotation, setAnnotation] = useState<Annotation | null>(null);

  const loadAnnotation = useCallback((data: AnnotationData) => {
    setAnnotation(new Annotation(data));
  }, []);

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
    updateAllCellsColor,
    updateAllCellsOpacity,
  };
}

