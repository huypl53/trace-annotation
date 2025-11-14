import { AnnotationData } from '../models/types';

function pointsToString(points: { x: number; y: number }[]): string {
  return points.map(p => `${p.x},${p.y}`).join(' ');
}

export function exportToXml(annotation: AnnotationData): string {
  const cellsXml = annotation.cells
    .map(
      cell => `        <cell start-row="${cell.startRow}" end-row="${cell.endRow}" start-col="${cell.startCol}" end-col="${cell.endCol}">
            <Coords points="${pointsToString(cell.points)}" />
            <Lines top="${cell.lines.top}" bottom="${cell.lines.bottom}" left="${cell.lines.left}" right="${cell.lines.right}" />
        </cell>`
    )
    .join('\n');

  const tableCoordsXml = annotation.tableCoords.points.length > 0
    ? `        <Coords points="${pointsToString(annotation.tableCoords.points)}" />\n`
    : '';

  return `<?xml version='1.0' encoding='utf-8'?>
<document filename="${annotation.filename}">
    <table>
${tableCoordsXml}${cellsXml}
    </table>
</document>`;
}

