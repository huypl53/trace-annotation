export interface Point {
  x: number;
  y: number;
}

export interface CellLines {
  top: 0 | 1;
  bottom: 0 | 1;
  left: 0 | 1;
  right: 0 | 1;
}

export interface CellData {
  id: string;
  points: Point[];
  lines: CellLines;
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
  color?: string;
  opacity?: number;
}

export interface TableCoords {
  points: Point[];
}

export interface AnnotationData {
  filename: string;
  tableCoords: TableCoords;
  cells: CellData[];
}

export interface ImageXmlPair {
  id: string;
  imageFile: File;
  xmlFile: File | null;
  imageUrl: string;
}

