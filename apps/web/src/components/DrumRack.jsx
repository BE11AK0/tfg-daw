import React, { useState } from 'react';
import { dawEngine } from '../audio/dawEngine';

const PADS = [
  { id: 'kick', label: 'Kick', keyHint: '1' },
  { id: 'snare', label: 'Snare', keyHint: '2' },
  { id: 'closedhat', label: 'Closed Hat', keyHint: '3' },
  { id: 'openhat', label: 'Open Hat', keyHint: '4' },
  { id: 'clap', label: 'Clap', keyHint: '5' },
  { id: 'tom', label: 'Low Tom', keyHint: '6' },
  { id: 'perc', label: 'Rim / Perc', keyHint: '7' },
  { id: 'sub', label: 'Sub Hit', keyHint: '8' }
];

export const DrumRack = ({ onSendDrumPattern, zoom = 50 }) => {
  const [activePadId, setActivePadId] = useState(null);

  const triggerPad = async (pad) => {
    setActivePadId(pad.id);
    await dawEngine.previewDrumPad(pad.id);
    setTimeout(() => {
      setActivePadId((prev) => (prev === pad.id ? null : prev));
    }, 140);
  };

  const handleSendBeatLoop = () => {
    if (typeof onSendDrumPattern !== 'function') return;
    const beatPx = zoom;
    const stepPx = beatPx / 2;
    const notes = [
      { id: `d-k1-${Date.now()}`, semitone: -24, start: 0, duration: stepPx },
      { id: `d-s1-${Date.now()}`, semitone: -12, start: beatPx, duration: stepPx },
      { id: `d-k2-${Date.now()}`, semitone: -24, start: beatPx * 2, duration: stepPx },
      { id: `d-s2-${Date.now()}`, semitone: -12, start: beatPx * 3, duration: stepPx },
      { id: `d-h1-${Date.now()}`, semitone: 0, start: 0, duration: stepPx / 2 },
      { id: `d-h2-${Date.now()}`, semitone: 0, start: stepPx, duration: stepPx / 2 },
      { id: `d-h3-${Date.now()}`, semitone: 0, start: beatPx, duration: stepPx / 2 },
      { id: `d-h4-${Date.now()}`, semitone: 0, start: beatPx + stepPx, duration: stepPx / 2 },
      { id: `d-h5-${Date.now()}`, semitone: 0, start: beatPx * 2, duration: stepPx / 2 },
      { id: `d-h6-${Date.now()}`, semitone: 0, start: beatPx * 2 + stepPx, duration: stepPx / 2 },
      { id: `d-h7-${Date.now()}`, semitone: 0, start: beatPx * 3, duration: stepPx / 2 },
      { id: `d-h8-${Date.now()}`, semitone: 0, start: beatPx * 3 + stepPx, duration: stepPx / 2 }
    ];

    onSendDrumPattern({
      name: 'Drum Rack Groove',
      start: 0,
      width: beatPx * 4,
      notes
    });
  };

  return (
    <div
      style={{
        height: '100%',
        padding: '8px 12px',
        background: '#120b1d',
        color: '#f5eaff',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        boxSizing: 'border-box'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
        <span style={{ color: '#e9d5ff', fontWeight: 'bold' }}>
          Drum Rack Sintetizado (sin carpeta de audio)
        </span>
        {onSendDrumPattern && (
          <button
            type="button"
            onClick={handleSendBeatLoop}
            style={{
              background: '#7c3aed',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              padding: '3px 10px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '11px'
            }}
          >
            Enviar Groove a Pista 1
          </button>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(110px, 1fr))',
          gap: '8px',
          flex: 1
        }}
      >
        {PADS.map((pad) => {
          const isActive = activePadId === pad.id;
          return (
            <button
              key={pad.id}
              type="button"
              onMouseDown={() => triggerPad(pad)}
              style={{
                background: isActive ? '#9333ea' : '#1e1330',
                border: isActive ? '1px solid #f3e8ff' : '1px solid rgba(168, 85, 247, 0.35)',
                borderRadius: '6px',
                color: '#faf5ff',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '12px'
              }}
            >
              <span>{pad.label}</span>
              <span style={{ fontSize: '10px', color: '#d8b4fe' }}>Pad {pad.keyHint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};