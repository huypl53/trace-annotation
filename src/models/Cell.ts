import { Point, CellLines, CellData } from './types';

export class Cell {
  public id: string;
  public points: Point[];
  public lines: CellLines;
  public startRow: number;
  public endRow: number;
  public startCol: number;
  public endCol: number;

  constructor(data: CellData) {
    this.id = data.id;
    this.points = [...data.points];
    this.lines = { ...data.lines };
    this.startRow = data.startRow;
    this.endRow = data.endRow;
    this.startCol = data.startCol;
    this.endCol = data.endCol;
  }

  getBounds(): { minX: number; minY: number; maxX: number; maxY: number } {
    const xs = this.points.map(p => p.x);
    const ys = this.points.map(p => p.y);
    return {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    };
  }

  getLeftEdge(): number {
    return Math.min(...this.points.map(p => p.x));
  }

  getRightEdge(): number {
    return Math.max(...this.points.map(p => p.x));
  }

  getTopEdge(): number {
    return Math.min(...this.points.map(p => p.y));
  }

  getBottomEdge(): number {
    return Math.max(...this.points.map(p => p.y));
  }

  move(deltaX: number, deltaY: number): void {
    this.points = this.points.map(p => ({
      x: p.x + deltaX,
      y: p.y + deltaY,
    }));
  }

  setEdge(edge: 'left' | 'right' | 'top' | 'bottom', value: number): void {
    const bounds = this.getBounds();
    const deltaX = edge === 'left' ? value - bounds.minX : edge === 'right' ? value - bounds.maxX : 0;
    const deltaY = edge === 'top' ? value - bounds.minY : edge === 'bottom' ? value - bounds.maxY : 0;

    if (edge === 'left' || edge === 'right') {
      this.points = this.points.map(p => ({ ...p, x: p.x + deltaX }));
    } else {
      this.points = this.points.map(p => ({ ...p, y: p.y + deltaY }));
    }
  }

  toData(): CellData {
    return {
      id: this.id,
      points: [...this.points],
      lines: { ...this.lines },
      startRow: this.startRow,
      endRow: this.endRow,
      startCol: this.startCol,
      endCol: this.endCol,
    };
  }
}

