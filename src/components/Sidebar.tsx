import { ImageXmlPair } from '../models/types';

interface SidebarProps {
  pairs: ImageXmlPair[];
  onSelectPair: (pairId: string) => void;
  onRemovePair: (pairId: string) => void;
  selectedPairId: string | null;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ pairs, onSelectPair, onRemovePair, selectedPairId, isCollapsed, onToggleCollapse }: SidebarProps) {
  // Filter to show only pairs with actual images (exclude orphan XML files)
  const imagePairs = pairs.filter(pair => pair.imageUrl && pair.imageFile.size > 0);

  return (
    <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <h2>Images</h2>
        <button className="sidebar-toggle" onClick={onToggleCollapse} title={isCollapsed ? 'Show sidebar' : 'Hide sidebar'}>
          {isCollapsed ? '▶' : '◀'}
        </button>
      </div>
      {!isCollapsed && (
        <div className="pair-list">
        {imagePairs.length === 0 ? (
          <p>No images loaded</p>
        ) : (
          imagePairs.map(pair => (
            <div
              key={pair.id}
              className={`pair-item ${selectedPairId === pair.id ? 'selected' : ''}`}
              onClick={() => onSelectPair(pair.id)}
            >
              {pair.imageUrl ? (
                <img src={pair.imageUrl} alt={pair.imageFile.name} className="pair-thumbnail" />
              ) : (
                <div className="pair-thumbnail pair-thumbnail-placeholder">
                  <span>IMG</span>
                </div>
              )}
              <div className="pair-info">
                <div className="pair-filename">
                  {pair.imageFile.name}
                </div>
                <div className="pair-xml-status">
                  {pair.xmlFile ? 'Has XML' : 'No XML'}
                </div>
              </div>
              <button
                className="remove-btn"
                onClick={e => {
                  e.stopPropagation();
                  onRemovePair(pair.id);
                }}
              >
                ×
              </button>
            </div>
          ))
        )}
        </div>
      )}
    </div>
  );
}

