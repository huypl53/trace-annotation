import { AnnotationData, Point, CellData, TableCoords } from '../models/types';

function parsePoints(pointsStr: string): Point[] {
  return pointsStr
    .trim()
    .split(/\s+/)
    .map(pointStr => {
      const [x, y] = pointStr.split(',').map(Number);
      return { x, y };
    });
}

export function parseXml(xmlString: string): AnnotationData {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');

  const documentEl = doc.querySelector('document');
  if (!documentEl) {
    throw new Error('Invalid XML: missing document element');
  }

  const filename = documentEl.getAttribute('filename') || '';

  // Get all tables (not just the first one)
  const tableElements = documentEl.querySelectorAll('table');
  if (tableElements.length === 0) {
    throw new Error('Invalid XML: missing table element');
  }

  // Combine cells from all tables
  const allCells: CellData[] = [];
  let firstTableCoords: TableCoords = { points: [] };

  tableElements.forEach((tableEl, tableIndex) => {
    // Get table coordinates (use first table's coords, or combine if needed)
    const tableCoordsEl = tableEl.querySelector('Coords');
    if (tableIndex === 0) {
      firstTableCoords = tableCoordsEl
        ? { points: parsePoints(tableCoordsEl.getAttribute('points') || '') }
        : { points: [] };
    }

    // Get all cells from this table
    const cellElements = tableEl.querySelectorAll('cell');
    const tableCells: CellData[] = Array.from(cellElements).map((cellEl, cellIndex) => {
      const coordsEl = cellEl.querySelector('Coords');
      const linesEl = cellEl.querySelector('Lines');

      if (!coordsEl) {
        throw new Error(`Invalid XML: cell ${cellIndex} in table ${tableIndex} missing Coords`);
      }
      if (!linesEl) {
        throw new Error(`Invalid XML: cell ${cellIndex} in table ${tableIndex} missing Lines`);
      }

      const points = parsePoints(coordsEl.getAttribute('points') || '');
      const lines = {
        top: parseInt(linesEl.getAttribute('top') || '0') as 0 | 1,
        bottom: parseInt(linesEl.getAttribute('bottom') || '0') as 0 | 1,
        left: parseInt(linesEl.getAttribute('left') || '0') as 0 | 1,
        right: parseInt(linesEl.getAttribute('right') || '0') as 0 | 1,
      };

      return {
        id: `cell-${tableIndex}-${cellIndex}`,
        points,
        lines,
        startRow: parseInt(cellEl.getAttribute('start-row') || '0'),
        endRow: parseInt(cellEl.getAttribute('end-row') || '0'),
        startCol: parseInt(cellEl.getAttribute('start-col') || '0'),
        endCol: parseInt(cellEl.getAttribute('end-col') || '0'),
      };
    });

    allCells.push(...tableCells);
  });

  return {
    filename,
    tableCoords: firstTableCoords,
    cells: allCells,
  };
}

