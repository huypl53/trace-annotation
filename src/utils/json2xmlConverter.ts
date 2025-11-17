import { AnnotationData, CellData, TableCoords } from '../models/types';

interface JsonTableData {
  type?: string;
  id?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  properties?: {
    rows?: number;
    columns?: number;
    width?: number;
    height?: number;
    columnWidths?: Record<string, number>;
    rowHeights?: Record<string, number>;
    mergedCells?: Record<string, { rowspan?: number; colspan?: number }>;
    hiddenCells?: Record<string, boolean>;
    cellData?: Record<string, {
      cellStyle?: {
        borderTopWidth?: number | null;
        borderBottomWidth?: number | null;
        borderLeftWidth?: number | null;
        borderRightWidth?: number | null;
        borderTopStyle?: string | null;
        borderBottomStyle?: string | null;
        borderLeftStyle?: string | null;
        borderRightStyle?: string | null;
      };
    }>;
    cellBorders?: {
      all?: boolean;
    };
  };
}

export interface ConversionResult {
  success: boolean;
  xmlFiles: File[];
  message: string;
  tablesProcessed: number;
  errors?: string[];
}

export class JsonToXmlConverter {
  private defaultWidth: number = 100;
  private defaultHeight: number = 30;

  constructor() {
  }

  /**
   * Extract all table items from JSON data
   */
  private extractTablesFromJson(jsonData: any): JsonTableData[] {
    // If jsonData is an array, filter for tables
    if (Array.isArray(jsonData)) {
      return jsonData.filter((item: any) => item?.type === 'table');
    }

    // If jsonData is a single table object
    if (jsonData?.type === 'table') {
      return [jsonData];
    }

    // Check for nested structures
    if (jsonData && typeof jsonData === 'object') {
      // Check if there's a 'tables' array
      if (Array.isArray(jsonData.tables)) {
        return jsonData.tables.filter((item: any) => item?.type === 'table');
      }

      // Check if there's an 'items' array (common structure)
      if (Array.isArray(jsonData.items)) {
        const tables = jsonData.items.filter((item: any) => item?.type === 'table');
        if (tables.length > 0) {
          return tables;
        }
      }

      // Check if items is an object with tables
      if (jsonData.items && Array.isArray(jsonData.items.tables)) {
        return jsonData.items.tables.filter((item: any) => item?.type === 'table');
      }

      // Check if items is an object and itself contains tables
      if (jsonData.items && typeof jsonData.items === 'object' && !Array.isArray(jsonData.items)) {
        // Try to find any array properties that might contain tables
        for (const key in jsonData.items) {
          if (Array.isArray(jsonData.items[key])) {
            const tables = jsonData.items[key].filter((item: any) => item?.type === 'table');
            if (tables.length > 0) {
              return tables;
            }
          }
        }
      }

      // Last resort: recursively search for arrays containing table objects
      const foundTables: JsonTableData[] = [];
      const searchForTables = (obj: any): void => {
        if (!obj || typeof obj !== 'object') return;

        if (Array.isArray(obj)) {
          obj.forEach(item => {
            if (item?.type === 'table') {
              foundTables.push(item);
            } else if (item && typeof item === 'object') {
              searchForTables(item);
            }
          });
        } else {
          for (const key in obj) {
            if (Array.isArray(obj[key])) {
              searchForTables(obj[key]);
            } else if (obj[key] && typeof obj[key] === 'object') {
              searchForTables(obj[key]);
            }
          }
        }
      };

      searchForTables(jsonData);
      if (foundTables.length > 0) {
        return foundTables;
      }
    }

    return [];
  }

  /**
   * Calculate cell coordinates for all visible cells in the table
   */
  private calculateCellCoordinates(
    tableProperties: JsonTableData['properties'],
    tableX: number,
    tableY: number
  ): Map<string, { x: number; y: number; width: number; height: number; colspan: number; rowspan: number }> {
    if (!tableProperties) return new Map();

    const rows = tableProperties.rows || 0;
    const columns = tableProperties.columns || 0;
    const columnWidths = tableProperties.columnWidths || {};
    const rowHeights = tableProperties.rowHeights || {};
    const mergedCells = tableProperties.mergedCells || {};
    const hiddenCells = tableProperties.hiddenCells || {};

    const getColWidth = (col: number): number => {
      return columnWidths[String(col)] ?? this.defaultWidth;
    };

    const getRowHeight = (row: number): number => {
      return rowHeights[String(row)] ?? this.defaultHeight;
    };

    // Build set of cells that are covered by merged cells (excluding origin)
    const mergedSpannedCells = new Set<string>();
    for (const [cellKey, mergeInfo] of Object.entries(mergedCells)) {
      const [baseRow, baseCol] = cellKey.split('-').map(Number);
      const rowspan = mergeInfo.rowspan ?? 1;
      const colspan = mergeInfo.colspan ?? 1;

      for (let r = baseRow; r < baseRow + rowspan; r++) {
        for (let c = baseCol; c < baseCol + colspan; c++) {
          if (r !== baseRow || c !== baseCol) {
            mergedSpannedCells.add(`${r}-${c}`);
          }
        }
      }
    }

    const cellCoords = new Map<string, { x: number; y: number; width: number; height: number; colspan: number; rowspan: number }>();

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const cellKey = `${row}-${col}`;

        // Skip hidden cells and cells covered by merges
        if (hiddenCells[cellKey] || mergedSpannedCells.has(cellKey)) {
          continue;
        }

        // Calculate position by summing previous column widths/row heights
        let x = 0;
        for (let c = 0; c < col; c++) {
          x += getColWidth(c);
        }
        let y = 0;
        for (let r = 0; r < row; r++) {
          y += getRowHeight(r);
        }

        // Check if this cell is a merge origin
        let colspan = 1;
        let rowspan = 1;
        if (cellKey in mergedCells) {
          const mergeInfo = mergedCells[cellKey];
          colspan = mergeInfo.colspan ?? 1;
          rowspan = mergeInfo.rowspan ?? 1;
        }

        // Calculate cell dimensions
        let width = 0;
        for (let c = col; c < col + colspan; c++) {
          width += getColWidth(c);
        }
        let height = 0;
        for (let r = row; r < row + rowspan; r++) {
          height += getRowHeight(r);
        }

        // Store coordinates
        cellCoords.set(cellKey, {
          x: x + tableX,
          y: y + tableY,
          width,
          height,
          colspan,
          rowspan,
        });
      }
    }

    return cellCoords;
  }

  /**
   * Adjust table position based on border widths of first row and first column cells
   */
  private adjustTablePositionForBorders(
    properties: JsonTableData['properties'],
    tableX: number,
    tableY: number
  ): [number, number] {
    if (!properties) return [tableX, tableY];

    const cellData = properties.cellData || {};
    const rows = properties.rows || 0;
    const columns = properties.columns || 0;

    let maxBorderTopWidth = 0;
    let maxBorderLeftWidth = 0;

    // Find the thickest border in first row
    for (let col = 0; col < columns; col++) {
      const cellKey = `0-${col}`;
      const cell = cellData[cellKey];
      if (cell?.cellStyle) {
        const borderTopWidth = cell.cellStyle.borderTopWidth ?? 0;
        maxBorderTopWidth = Math.max(maxBorderTopWidth, borderTopWidth);
      }
    }

    // Find the thickest border in first column
    for (let row = 0; row < rows; row++) {
      const cellKey = `${row}-0`;
      const cell = cellData[cellKey];
      if (cell?.cellStyle) {
        const borderLeftWidth = cell.cellStyle.borderLeftWidth ?? 0;
        maxBorderLeftWidth = Math.max(maxBorderLeftWidth, borderLeftWidth);
      }
    }

    const adjustedX = tableX + Math.floor(maxBorderLeftWidth / 2);
    const adjustedY = tableY + Math.floor(maxBorderTopWidth / 2);

    return [adjustedX, adjustedY];
  }

  /**
   * Determine border visibility for each side of a cell
   */
  private determineCellBorders(
    cellData: {
      cellStyle?: {
        borderTopWidth?: number | null;
        borderBottomWidth?: number | null;
        borderLeftWidth?: number | null;
        borderRightWidth?: number | null;
        borderTopStyle?: string | null;
        borderBottomStyle?: string | null;
        borderLeftStyle?: string | null;
        borderRightStyle?: string | null;
      };
    } | undefined,
    tableProperties: JsonTableData['properties']
  ): [number, number, number, number] {
    if (!tableProperties) return [0, 0, 0, 0];

    // Get global border settings
    const cellBorders = tableProperties.cellBorders || {};
    const hasGlobalBorders = cellBorders.all ?? false;

    // Default borders based on global setting
    const borders: { top: number; bottom: number; left: number; right: number } = {
      top: hasGlobalBorders ? 1 : 0,
      bottom: hasGlobalBorders ? 1 : 0,
      left: hasGlobalBorders ? 1 : 0,
      right: hasGlobalBorders ? 1 : 0,
    };

    // Check for cell-specific border overrides
    if (cellData?.cellStyle) {
      const cellStyle = cellData.cellStyle;

      const borderMappings: Record<string, keyof typeof borders> = {
        borderTopWidth: 'top',
        borderBottomWidth: 'bottom',
        borderLeftWidth: 'left',
        borderRightWidth: 'right',
      };

      // If any border width property exists, this cell has custom borders
      const hasCustomBorders = Object.keys(borderMappings).some(key => key in cellStyle);

      if (hasCustomBorders) {
        // Apply custom border settings for each side
        for (const [widthKey, borderSide] of Object.entries(borderMappings)) {
          if (widthKey in cellStyle) {
            const width = cellStyle[widthKey as keyof typeof cellStyle] as number | null | undefined;
            let hasBorder = width != null && width > 0;

            // Check border style if specified
            const styleKey = widthKey.replace('Width', 'Style');
            const style = cellStyle[styleKey as keyof typeof cellStyle] as string | null | undefined;
            if (style === 'none') {
              hasBorder = false;
            }
            if (style == null && width == null) {
              hasBorder = true;
            }

            borders[borderSide] = hasBorder ? 1 : 0;
          }
        }
      }
    }

    return [borders.top, borders.bottom, borders.left, borders.right];
  }

  /**
   * Convert a single table to AnnotationData format
   */
  private convertTableToAnnotationData(
    tableData: JsonTableData,
    imageFilename: string
  ): AnnotationData {
    const properties = tableData.properties || {};

    // Handle None values properly (0 is a valid coordinate/dimension)
    let tableX = tableData.x ?? 0;
    let tableY = tableData.y ?? 0;
    let tableWidth = tableData.width ?? properties.width ?? 0;
    let tableHeight = tableData.height ?? properties.height ?? 0;

    // Adjust table position based on first row and first column border widths
    [tableX, tableY] = this.adjustTablePositionForBorders(properties, tableX, tableY);

    // Create table coordinates using original image coordinates
    const tableCoords: TableCoords = {
      points: [
        { x: tableX, y: tableY },
        { x: tableX + tableWidth, y: tableY },
        { x: tableX + tableWidth, y: tableY + tableHeight },
        { x: tableX, y: tableY + tableHeight },
      ],
    };

    // Get cell coordinates and data
    const cellCoords = this.calculateCellCoordinates(properties, tableX, tableY);
    const cellData = properties.cellData || {};

    // Create cells
    const cells: CellData[] = [];
    let cellIdCounter = 0;

    for (const [cellKey, coords] of cellCoords.entries()) {
      const [row, col] = cellKey.split('-').map(Number);
      const currentCellData = cellData[cellKey] || {};

      // Determine cell span (for merged cells)
      const endRow = row + coords.rowspan - 1;
      const endCol = col + coords.colspan - 1;

      // Use original image coordinates (no cropping transformation)
      const x1 = Math.floor(coords.x);
      const y1 = Math.floor(coords.y);
      const x2 = Math.floor(coords.x + coords.width);
      const y2 = Math.floor(coords.y + coords.height);

      // Add border information
      const [top, bottom, left, right] = this.determineCellBorders(currentCellData, properties);

      const cell: CellData = {
        id: `cell-${cellIdCounter++}`,
        points: [
          { x: x1, y: y1 },
          { x: x2, y: y1 },
          { x: x2, y: y2 },
          { x: x1, y: y2 },
        ],
        lines: {
          top: top as 0 | 1,
          bottom: bottom as 0 | 1,
          left: left as 0 | 1,
          right: right as 0 | 1,
        },
        startRow: row,
        endRow,
        startCol: col,
        endCol,
      };

      cells.push(cell);
    }

    return {
      filename: imageFilename,
      tableCoords,
      cells,
    };
  }

  /**
   * Convert a single table's AnnotationData to XML string (table element only)
   */
  private annotationDataToTableXml(annotationData: AnnotationData): string {
    const cellsXml = annotationData.cells
      .map(
        cell => `        <cell start-row="${cell.startRow}" end-row="${cell.endRow}" start-col="${cell.startCol}" end-col="${cell.endCol}">
            <Coords points="${cell.points.map(p => `${p.x},${p.y}`).join(' ')}" />
            <Lines top="${cell.lines.top}" bottom="${cell.lines.bottom}" left="${cell.lines.left}" right="${cell.lines.right}" />
        </cell>`
      )
      .join('\n');

    const tableCoordsXml = annotationData.tableCoords.points.length > 0
      ? `        <Coords points="${annotationData.tableCoords.points.map(p => `${p.x},${p.y}`).join(' ')}" />\n`
      : '';

    return `    <table>
${tableCoordsXml}${cellsXml}
    </table>`;
  }

  /**
   * Convert multiple AnnotationData objects to a single XML string with multiple tables
   */
  private annotationDataArrayToXml(annotationDataArray: AnnotationData[]): string {
    if (annotationDataArray.length === 0) {
      throw new Error('Cannot convert empty annotation data array to XML');
    }

    // Use the filename from the first annotation (they should all be the same)
    const filename = annotationDataArray[0].filename;

    const tablesXml = annotationDataArray
      .map(data => this.annotationDataToTableXml(data))
      .join('\n');

    return `<?xml version='1.0' encoding='utf-8'?>
<document filename="${filename}">
${tablesXml}
</document>`;
  }

  /**
   * Get corresponding image filename for a table
   */
  private getImageFilenameForTable(
    baseName: string,
    imageExtensions: Set<string>,
    allFiles: File[]
  ): string | null {
    // Try exact match with different extensions
    for (const ext of imageExtensions) {
      const potentialImage = `${baseName}${ext}`;
      const found = allFiles.find(f => f.name.toLowerCase() === potentialImage.toLowerCase());
      if (found) {
        return found.name;
      }
    }

    // Try alternative matching strategies
    const jsonPart = baseName.includes('-') ? baseName.split('-')[1] : baseName;
    for (const file of allFiles) {
      const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (imageExtensions.has(fileExt)) {
        const imageStem = file.name.substring(0, file.name.lastIndexOf('.'));
        const part = imageStem.includes('-') ? imageStem.split('-')[0] : imageStem;
        if (part === jsonPart) {
          return file.name;
        }
      }
    }

    return null;
  }

  /**
   * Convert JSON file(s) to XML file(s)
   */
  async convertJsonToXml(
    jsonFiles: File[],
    allFiles: File[] = []
  ): Promise<ConversionResult> {
    const xmlFiles: File[] = [];
    const errors: string[] = [];
    let tablesProcessed = 0;

    const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.tif', '.gif', '.webp']);

    for (const jsonFile of jsonFiles) {
      try {
        // Read and parse JSON
        const jsonText = await jsonFile.text();
        let jsonData: any;
        try {
          jsonData = JSON.parse(jsonText);
        } catch (parseError) {
          errors.push(`Failed to parse JSON file ${jsonFile.name}: ${parseError}`);
          continue;
        }

        // Extract all tables (extractTablesFromJson handles items internally)
        const tables = this.extractTablesFromJson(jsonData);

        if (tables.length === 0) {
          errors.push(`No tables found in ${jsonFile.name}`);
          continue;
        }

        const baseName = jsonFile.name.substring(0, jsonFile.name.lastIndexOf('.')) || jsonFile.name;

        // Find corresponding image file
        const imageFilename = this.getImageFilenameForTable(
          baseName,
          imageExtensions,
          allFiles
        ) || `${baseName}.png`; // Default fallback

        // Convert all tables to annotation data
        const annotationDataArray: AnnotationData[] = [];
        for (let tableIndex = 0; tableIndex < tables.length; tableIndex++) {
          try {
            const tableData = tables[tableIndex];

            // Convert table to annotation data
            const annotationData = this.convertTableToAnnotationData(tableData, imageFilename);
            annotationDataArray.push(annotationData);
            tablesProcessed++;
          } catch (error) {
            errors.push(`Error processing table ${tableIndex + 1} in ${jsonFile.name}: ${error}`);
          }
        }

        // Create a single XML file with all tables
        if (annotationDataArray.length > 0) {
          try {
            // Convert all annotation data to a single XML string
            const xmlString = this.annotationDataArrayToXml(annotationDataArray);

            // Generate XML filename (always use base name, regardless of table count)
            const xmlFilename = `${baseName}.xml`;

            // Create XML file
            const xmlBlob = new Blob([xmlString], { type: 'text/xml' });
            const xmlFile = new File([xmlBlob], xmlFilename, { type: 'text/xml' });

            xmlFiles.push(xmlFile);
          } catch (error) {
            errors.push(`Error creating XML file for ${jsonFile.name}: ${error}`);
          }
        }
      } catch (error) {
        errors.push(`Error processing file ${jsonFile.name}: ${error}`);
      }
    }

    const success = xmlFiles.length > 0;
    const message = success
      ? `Successfully converted ${tablesProcessed} table(s) from ${jsonFiles.length} JSON file(s) to ${xmlFiles.length} XML file(s)`
      : `Failed to convert JSON files. ${errors.length > 0 ? errors.join('; ') : 'No tables found'}`;

    return {
      success,
      xmlFiles,
      message,
      tablesProcessed,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}

/**
 * Check if a file is a JSON file
 */
export function isJsonFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.json') || file.type === 'application/json';
}

/**
 * Convert JSON files to XML files
 */
export async function convertJsonFilesToXml(
  jsonFiles: File[],
  allFiles: File[] = []
): Promise<ConversionResult> {
  const converter = new JsonToXmlConverter();
  return converter.convertJsonToXml(jsonFiles, allFiles);
}

