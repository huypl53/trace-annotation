import { useState, useCallback } from 'react';
import { Annotation } from '../models/Annotation';
import { AnnotationData } from '../models/types';

export function useAnnotation() {
  const [annotation, setAnnotation] = useState<Annotation | null>(null);

  const loadAnnotation = useCallback((data: AnnotationData) => {
    setAnnotation(new Annotation(data));
  }, []);

  const updateCell = useCallback((cellId: string, updater: (cell: import('../models/Cell').Cell) => void) => {
    setAnnotation(prev => {
      if (!prev) return prev;
      const cell = prev.getCellById(cellId);
      if (!cell) return prev;
      updater(cell);
      return new Annotation(prev.toData());
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
      cell.points = points;
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

  return {
    annotation,
    loadAnnotation,
    updateCell,
    moveCell,
    updateCellLines,
    updateCellPoints,
    createCell,
  };
}

