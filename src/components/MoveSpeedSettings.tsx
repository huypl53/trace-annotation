import { useEffect, useState } from 'react';

export interface MoveSpeedSettings {
  baseSpeed: number;
  maxSpeed: number;
  acceleration: number;
  stepInterval: number;
  snapEnabled: boolean;
  snapThreshold: number;
}

const DEFAULT_SETTINGS: MoveSpeedSettings = {
  baseSpeed: 0.5,
  maxSpeed: 5,
  acceleration: 0.1,
  stepInterval: 16,
  snapEnabled: true,
  snapThreshold: 5,
};

const STORAGE_KEY = 'move-speed-settings';

interface MoveSpeedSettingsProps {
  settings: MoveSpeedSettings;
  onSettingsChange: (settings: MoveSpeedSettings) => void;
  disabled?: boolean;
}

export function MoveSpeedSettings({
  settings,
  onSettingsChange,
  disabled = false,
}: MoveSpeedSettingsProps) {
  const [localSettings, setLocalSettings] = useState<MoveSpeedSettings>(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleChange = (key: keyof MoveSpeedSettings, value: number | boolean) => {
    const newSettings: MoveSpeedSettings = { ...localSettings };
    if (key === 'snapEnabled') {
      newSettings[key] = value as boolean;
    } else {
      newSettings[key] = value as number;
    }
    setLocalSettings(newSettings);
    onSettingsChange(newSettings);
  };

  return (
    <div className="move-speed-settings">
      <h4>Arrow Key Movement Speed</h4>
      <div className="speed-control-group">
        <label>
          <span>Base Speed</span>
          <input
            type="number"
            min="0.1"
            max="10"
            step="0.1"
            value={localSettings.baseSpeed}
            onChange={(e) => handleChange('baseSpeed', parseFloat(e.target.value) || 0.1)}
            disabled={disabled}
          />
        </label>
        <label>
          <span>Max Speed</span>
          <input
            type="number"
            min="1"
            max="50"
            step="0.5"
            value={localSettings.maxSpeed}
            onChange={(e) => handleChange('maxSpeed', parseFloat(e.target.value) || 1)}
            disabled={disabled}
          />
        </label>
        <label>
          <span>Acceleration</span>
          <input
            type="number"
            min="0.01"
            max="2"
            step="0.01"
            value={localSettings.acceleration}
            onChange={(e) => handleChange('acceleration', parseFloat(e.target.value) || 0.01)}
            disabled={disabled}
          />
        </label>
        <label>
          <span>Update Rate (ms)</span>
          <input
            type="number"
            min="8"
            max="100"
            step="1"
            value={localSettings.stepInterval}
            onChange={(e) => handleChange('stepInterval', parseInt(e.target.value) || 16)}
            disabled={disabled}
          />
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={localSettings.snapEnabled}
            onChange={(e) => handleChange('snapEnabled', e.target.checked)}
            disabled={disabled}
          />
          <span>Snap to Nearby Cells</span>
        </label>
        {localSettings.snapEnabled && (
          <label>
            <span>Snap Threshold (pixels)</span>
            <input
              type="number"
              min="1"
              max="50"
              step="0.5"
              value={localSettings.snapThreshold}
              onChange={(e) => handleChange('snapThreshold', parseFloat(e.target.value) || 1)}
              disabled={disabled}
            />
          </label>
        )}
      </div>
    </div>
  );
}

export function useMoveSpeedSettings() {
  const [settings, setSettings] = useState<MoveSpeedSettings>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  const updateSettings = (newSettings: MoveSpeedSettings) => {
    setSettings(newSettings);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
  };

  return {
    settings,
    updateSettings,
    resetSettings,
  };
}

