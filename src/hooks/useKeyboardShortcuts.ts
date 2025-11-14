import { useState, useEffect, useCallback } from 'react';

export type ShortcutKey = 'move' | 'resize' | 'createCell';

export interface Shortcuts {
  move: string;
  resize: string;
  createCell: string;
}

const DEFAULT_SHORTCUTS: Shortcuts = {
  move: 'm',
  resize: 'r',
  createCell: 'c',
};

const STORAGE_KEY = 'keyboard-shortcuts';

/**
 * Formats a key for display (e.g., 'Control+m' -> 'Ctrl+M')
 */
export function formatShortcut(key: string): string {
  return key
    .replace(/Control/gi, 'Ctrl')
    .replace(/Meta/gi, 'Cmd')
    .replace(/Alt/gi, 'Alt')
    .split('+')
    .map(k => k.trim())
    .map(k => k.length === 1 ? k.toUpperCase() : k)
    .join('+');
}

/**
 * Normalizes a shortcut string for comparison (case-insensitive, sorted modifiers)
 */
export function normalizeShortcut(shortcut: string): string {
  const parts = shortcut.toLowerCase().split('+').map(p => p.trim()).filter(p => p);
  const modifiers: string[] = [];
  const keys: string[] = [];
  
  parts.forEach(part => {
    if (['control', 'ctrl', 'meta', 'cmd', 'alt', 'shift'].includes(part)) {
      // Normalize modifier names
      if (part === 'ctrl') part = 'control';
      if (part === 'cmd') part = 'meta';
      modifiers.push(part);
    } else {
      keys.push(part);
    }
  });
  
  // Sort modifiers consistently
  const modifierOrder = ['control', 'meta', 'alt', 'shift'];
  modifiers.sort((a, b) => {
    const aIdx = modifierOrder.indexOf(a);
    const bIdx = modifierOrder.indexOf(b);
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
  });
  
  return [...modifiers, ...keys].join('+');
}

/**
 * Parses a keyboard event into a shortcut string
 */
export function parseKeyEvent(e: KeyboardEvent): string {
  const parts: string[] = [];
  
  if (e.ctrlKey) parts.push('Control');
  if (e.metaKey) parts.push('Meta');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  
  // Ignore modifier keys themselves
  if (!['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) {
    parts.push(e.key);
  }
  
  return parts.join('+');
}

/**
 * Hook to manage keyboard shortcuts
 */
export function useKeyboardShortcuts() {
  const [shortcuts, setShortcuts] = useState<Shortcuts>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return { ...DEFAULT_SHORTCUTS, ...JSON.parse(stored) };
      } catch {
        return DEFAULT_SHORTCUTS;
      }
    }
    return DEFAULT_SHORTCUTS;
  });

  const updateShortcut = useCallback((key: ShortcutKey, value: string) => {
    setShortcuts(prev => {
      const updated = { ...prev, [key]: value };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const resetShortcuts = useCallback(() => {
    setShortcuts(DEFAULT_SHORTCUTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SHORTCUTS));
  }, []);

  return {
    shortcuts,
    updateShortcut,
    resetShortcuts,
  };
}

