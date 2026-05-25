import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useMusicStore } from '../../stores/musicStore';

const EQ_PRESETS = [
  { key: 'flat', label: '平坦' },
  { key: 'pop', label: '流行' },
  { key: 'rock', label: '摇滚' },
  { key: 'classical', label: '古典' },
  { key: 'jazz', label: '爵士' },
  { key: 'electronic', label: '电子' },
  { key: 'vocal', label: '人声' },
  { key: 'bass', label: '低音增强' },
];

const EQ_BANDS = [
  { index: 0, label: '60Hz', shortLabel: '低音' },
  { index: 1, label: '230Hz', shortLabel: '中低' },
  { index: 2, label: '910Hz', shortLabel: '中音' },
  { index: 3, label: '4kHz', shortLabel: '中高' },
  { index: 4, label: '14kHz', shortLabel: '高音' },
];

const EqualizerPanel: React.FC = () => {
  const eqPreset = useMusicStore((s) => s.eqPreset);
  const eqBands = useMusicStore((s) => s.eqBands);
  const setEqPreset = useMusicStore((s) => s.setEqPreset);
  const setEqBand = useMusicStore((s) => s.setEqBand);

  return (
    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <SlidersHorizontal size={14} style={{ color: 'var(--primary-color)' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>均衡器</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {EQ_PRESETS.map(preset => (
          <button
            key={preset.key}
            onClick={() => setEqPreset(preset.key)}
            style={{
              padding: '4px 10px',
              fontSize: 10,
              borderRadius: 4,
              border: '1px solid',
              borderColor: eqPreset === preset.key ? 'var(--primary-color)' : 'var(--border-light)',
              cursor: 'pointer',
              background: eqPreset === preset.key ? 'var(--primary-color)' : 'var(--bg-tertiary)',
              color: eqPreset === preset.key ? 'white' : 'var(--text-secondary)',
              transition: 'all 0.2s',
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: '8px 0' }}>
        {EQ_BANDS.map(band => (
          <div key={band.index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>
              {eqBands[band.index] > 0 ? '+' : ''}{eqBands[band.index]}dB
            </span>
            <input
              type="range"
              min={-12}
              max={12}
              step={1}
              value={eqBands[band.index]}
              onChange={(e) => setEqBand(band.index, Number(e.target.value))}
              style={{
                writingMode: 'vertical-lr' as any,
                direction: 'rtl',
                width: 4,
                height: 80,
                accentColor: 'var(--primary-color)',
                cursor: 'pointer',
              }}
            />
            <span style={{ fontSize: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>{band.shortLabel}</span>
            <span style={{ fontSize: 7, color: 'var(--text-tertiary)' }}>{band.label}</span>
          </div>
        ))}
      </div>

      {eqPreset === 'custom' && (
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={() => setEqPreset('flat')}
            style={{
              padding: '3px 10px',
              fontSize: 9,
              borderRadius: 4,
              border: '1px solid var(--border-light)',
              cursor: 'pointer',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-tertiary)',
            }}
          >
            重置
          </button>
        </div>
      )}
    </div>
  );
};

export default EqualizerPanel;
