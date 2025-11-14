import { AnnotationData } from '../models/types';

export function exportToJson(annotation: AnnotationData): string {
  return JSON.stringify(annotation, null, 2);
}

