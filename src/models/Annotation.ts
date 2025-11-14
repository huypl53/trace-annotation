import { AnnotationData, TableCoords, CellData } from './types';
import { Cell } from './Cell';

export class Annotation {
  public filename: string;
  public tableCoords: TableCoords;
  public cells: Cell[];

  constructor(data: AnnotationData) {
    this.filename = data.filename;
    this.tableCoords = { ...data.tableCoords };
    this.cells = data.cells.map(cellData => new Cell(cellData));
  }

  getCellById(id: string): Cell | undefined {
    return this.cells.find(cell => cell.id === id);
  }

  toData(): AnnotationData {
    return {
      filename: this.filename,
      tableCoords: { ...this.tableCoords },
      cells: this.cells.map(cell => cell.toData()),
    };
  }
}

