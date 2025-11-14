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

  const tableEl = documentEl.querySelector('table');
  if (!tableEl) {
    throw new Error('Invalid XML: missing table element');
  }

  const tableCoordsEl = tableEl.querySelector('Coords');
  const tableCoords: TableCoords = tableCoordsEl
    ? { points: parsePoints(tableCoordsEl.getAttribute('points') || '') }
    : { points: [] };

  const cellElements = tableEl.querySelectorAll('cell');
  const cells: CellData[] = Array.from(cellElements).map((cellEl, index) => {
    const coordsEl = cellEl.querySelector('Coords');
    const linesEl = cellEl.querySelector('Lines');

    if (!coordsEl) {
      throw new Error(`Invalid XML: cell ${index} missing Coords`);
    }
    if (!linesEl) {
      throw new Error(`Invalid XML: cell ${index} missing Lines`);
    }

    const points = parsePoints(coordsEl.getAttribute('points') || '');
    const lines = {
      top: parseInt(linesEl.getAttribute('top') || '0') as 0 | 1,
      bottom: parseInt(linesEl.getAttribute('bottom') || '0') as 0 | 1,
      left: parseInt(linesEl.getAttribute('left') || '0') as 0 | 1,
      right: parseInt(linesEl.getAttribute('right') || '0') as 0 | 1,
    };

    return {
      id: `cell-${index}`,
      points,
      lines,
      startRow: parseInt(cellEl.getAttribute('start-row') || '0'),
      endRow: parseInt(cellEl.getAttribute('end-row') || '0'),
      startCol: parseInt(cellEl.getAttribute('start-col') || '0'),
      endCol: parseInt(cellEl.getAttribute('end-col') || '0'),
    };
  });

  return {
    filename,
    tableCoords,
    cells,
  };
}

