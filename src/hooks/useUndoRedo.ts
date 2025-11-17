import { useState, useCallback, useRef, useEffect } from 'react';
import { Annotation } from '../models/Annotation';
import { AnnotationData } from '../models/types';

const MAX_HISTORY_SIZE = 50;

export function useUndoRedo(initialAnnotation: Annotation | null = null) {
  const [annotation, setAnnotation] = useState<Annotation | null>(initialAnnotation);
  const [history, setHistory] = useState<AnnotationData[]>(initialAnnotation ? [initialAnnotation.toData()] : []);
  const [historyIndex, setHistoryIndex] = useState(0);
  const isUndoRedoRef = useRef(false);
  const annotationRef = useRef<Annotation | null>(initialAnnotation);
  const historyIndexRef = useRef(0);
  const historyRef = useRef<AnnotationData[]>(initialAnnotation ? [initialAnnotation.toData()] : []);

  // Sync refs with state
  useEffect(() => {
    historyIndexRef.current = historyIndex;
    historyRef.current = history;
    annotationRef.current = annotation;
  }, [historyIndex, history, annotation]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const addToHistory = useCallback((newAnnotation: Annotation) => {
    if (isUndoRedoRef.current) {
      // Don't add to history if we're in the middle of an undo/redo operation
      return;
    }

    const currentIndex = historyIndexRef.current;
    const currentHistory = historyRef.current;
    
    // Remove any history after current index (when we're in the middle of history)
    const newHistory = currentHistory.slice(0, currentIndex + 1);
    
    // Add new state
    newHistory.push(newAnnotation.toData());
    
    // Limit history size
    let newIndex = currentIndex + 1;
    if (newHistory.length > MAX_HISTORY_SIZE) {
      newHistory.shift();
      newIndex = currentIndex; // Index stays the same when we remove first item
    }
    
    // Update both state values
    setHistory(newHistory);
    setHistoryIndex(newIndex);
  }, []);

  const setAnnotationWithHistory = useCallback((updater: Annotation | null | ((prev: Annotation | null) => Annotation | null)) => {
    if (typeof updater === 'function') {
      setAnnotation(prev => {
        const newAnnotation = updater(prev);
        
        if (newAnnotation) {
          annotationRef.current = newAnnotation;
          // Add to history after computing new annotation
          addToHistory(newAnnotation);
          return newAnnotation;
        } else {
          annotationRef.current = null;
          setHistory([]);
          setHistoryIndex(0);
          return null;
        }
      });
    } else {
      if (updater) {
        annotationRef.current = updater;
        setAnnotation(updater);
        addToHistory(updater);
      } else {
        annotationRef.current = null;
        setAnnotation(null);
        setHistory([]);
        setHistoryIndex(0);
      }
    }
  }, [addToHistory]);

  const undo = useCallback(() => {
    if (!canUndo) return;
    
    isUndoRedoRef.current = true;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    const restoredAnnotation = new Annotation(history[newIndex]);
    annotationRef.current = restoredAnnotation;
    setAnnotation(restoredAnnotation);
    isUndoRedoRef.current = false;
  }, [canUndo, historyIndex, history]);

  const redo = useCallback(() => {
    if (!canRedo) return;
    
    isUndoRedoRef.current = true;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    const restoredAnnotation = new Annotation(history[newIndex]);
    annotationRef.current = restoredAnnotation;
    setAnnotation(restoredAnnotation);
    isUndoRedoRef.current = false;
  }, [canRedo, historyIndex, history]);

  const resetHistory = useCallback((newAnnotation: Annotation | null) => {
    if (newAnnotation) {
      annotationRef.current = newAnnotation;
      setAnnotation(newAnnotation);
      const initialData = [newAnnotation.toData()];
      setHistory(initialData);
      setHistoryIndex(0);
      historyRef.current = initialData;
      historyIndexRef.current = 0;
    } else {
      annotationRef.current = null;
      setAnnotation(null);
      setHistory([]);
      setHistoryIndex(0);
      historyRef.current = [];
      historyIndexRef.current = 0;
    }
  }, []);

  return {
    annotation,
    setAnnotation: setAnnotationWithHistory,
    resetHistory,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
