import { ImageXmlPair } from '../models/types';

interface SidebarProps {
  pairs: ImageXmlPair[];
  onSelectPair: (pairId: string) => void;
  onRemovePair: (pairId: string) => void;
  selectedPairId: string | null;
}

export function Sidebar({ pairs, onSelectPair, onRemovePair, selectedPairId }: SidebarProps) {
  return (
    <div className="sidebar">
      <h2>Image/XML Pairs</h2>
      <div className="pair-list">
        {pairs.length === 0 ? (
          <p>No pairs loaded</p>
        ) : (
          pairs.map(pair => (
            <div
              key={pair.id}
              className={`pair-item ${selectedPairId === pair.id ? 'selected' : ''}`}
              onClick={() => onSelectPair(pair.id)}
            >
              {pair.imageUrl ? (
                <img src={pair.imageUrl} alt={pair.imageFile.name} className="pair-thumbnail" />
              ) : (
                <div className="pair-thumbnail pair-thumbnail-placeholder">
                  <span>XML</span>
                </div>
              )}
              <div className="pair-info">
                <div className="pair-filename">
                  {pair.imageFile.name || (pair.xmlFile ? pair.xmlFile.name : 'Unknown')}
                </div>
                <div className="pair-xml-status">
                  {pair.xmlFile ? pair.xmlFile.name : 'No XML'}
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
    </div>
  );
}

