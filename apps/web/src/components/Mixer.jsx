import React, { useEffect, useState } from 'react';

const LevelMeter = ({ trackId, analysersRef, isMuted }) => {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    let rafId;

    const updateMeter = () => {
      const analyser = analysersRef?.current?.[trackId];
      if (!analyser || isMuted) {
        setLevel(0);
        rafId = requestAnimationFrame(updateMeter);
        return;
      }

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteTimeDomainData(dataArray);

      let peak = 0;
      for (let i = 0; i < bufferLength; i++) {
        const normalized = Math.abs(dataArray[i] - 128) / 128;
        if (normalized > peak) peak = normalized;
      }

      setLevel(Math.min(1, peak * 1.8));
      rafId = requestAnimationFrame(updateMeter);
    };

    rafId = requestAnimationFrame(updateMeter);
    return () => cancelAnimationFrame(rafId);
  }, [trackId, analysersRef, isMuted]);

  const barHeightPercent = Math.round(level * 100);

  return (
    <div
      style={{
        width: '8px',
        height: '100%',
        minHeight: '72px',
        borderRadius: '3px',
        background: '#0f0919',
        border: '1px solid rgba(168, 85, 247, 0.22)',
        display: 'flex',
        alignItems: 'flex-end',
        overflow: 'hidden',
        padding: '1px',
        boxSizing: 'border-box'
      }}
    >
      <div
        style={{
          width: '100%',
          height: `${barHeightPercent}%`,
          borderRadius: '2px',
          background:
            barHeightPercent > 88
              ? '#e879f9'
              : 'linear-gradient(to top, #7e22ce, #c084fc)',
          transition: 'height 40ms linear'
        }}
      />
    </div>
  );
};

export const Mixer = ({ tracks = [], onUpdateTrack, analysersRef }) => {
  const handleChange = (trackId, field, value) => {
    if (typeof onUpdateTrack === 'function') {
      onUpdateTrack(trackId, { [field]: value });
    }
  };

  const handleResetEqAndFx = (trackId) => {
    if (typeof onUpdateTrack === 'function') {
      onUpdateTrack(trackId, {
        pan: 0,
        eqLow: 0,
        eqMid: 0,
        eqHigh: 0,
        delayTime: 0
      });
    }
  };

  if (!tracks || tracks.length === 0) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#b7a5d9',
          fontSize: '12px'
        }}
      >
        No hay pistas en el mezclador.
      </div>
    );
  }

  return (
    <div
      className="daw-mixer-panel"
      style={{
        display: 'flex',
        gap: '8px',
        padding: '8px 10px',
        height: '100%',
        overflowX: 'auto',
        overflowY: 'hidden',
        alignItems: 'stretch',
        background: '#0f0919',
        boxSizing: 'border-box'
      }}
    >
      {tracks.map((track) => {
        const volume = typeof track.volume === 'number' ? track.volume : 0.75;
        const pan = typeof track.pan === 'number' ? track.pan : 0;
        const eqLow = typeof track.eqLow === 'number' ? track.eqLow : 0;
        const eqMid = typeof track.eqMid === 'number' ? track.eqMid : 0;
        const eqHigh = typeof track.eqHigh === 'number' ? track.eqHigh : 0;
        const delayTime = typeof track.delayTime === 'number' ? track.delayTime : 0;

        return (
          <div
            key={track.id}
            style={{
              width: '196px',
              minWidth: '196px',
              height: '100%',
              background: '#170e26',
              border: '1px solid rgba(168, 85, 247, 0.22)',
              borderTop: `2px solid ${track.color || '#c084fc'}`,
              borderRadius: '6px',
              padding: '7px 8px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '5px',
              color: '#f4ecff',
              fontSize: '10px',
              boxSizing: 'border-box'
            }}
          >
            {/* Cabecera compacta de canal */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#f4ecff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  flex: 1
                }}
                title={track.name}
              >
                {track.name}
              </span>

              <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => handleChange(track.id, 'muted', !track.muted)}
                  style={{
                    padding: '1px 5px',
                    borderRadius: '3px',
                    border: '1px solid rgba(168, 85, 247, 0.35)',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '10px',
                    background: track.muted ? '#7e22ce' : '#221538',
                    color: track.muted ? '#ffffff' : '#d8b4fe'
                  }}
                >
                  M
                </button>
                <button
                  type="button"
                  onClick={() => handleChange(track.id, 'solo', !track.solo)}
                  style={{
                    padding: '1px 5px',
                    borderRadius: '3px',
                    border: '1px solid rgba(192, 132, 252, 0.45)',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '10px',
                    background: track.solo ? '#9333ea' : '#221538',
                    color: track.solo ? '#ffffff' : '#d8b4fe'
                  }}
                >
                  S
                </button>
                <button
                  type="button"
                  onClick={() => handleResetEqAndFx(track.id)}
                  title="Resetear EQ, Pan y Delay"
                  style={{
                    padding: '1px 5px',
                    borderRadius: '3px',
                    border: '1px solid rgba(168, 85, 247, 0.25)',
                    cursor: 'pointer',
                    fontSize: '9px',
                    background: '#1e1233',
                    color: '#b7a5d9'
                  }}
                >
                  ↺
                </button>
              </div>
            </div>

            {/* Nivel + Volumen + Pan + Delay */}
            <div style={{ display: 'grid', gridTemplateColumns: '8px 1fr', gap: '7px', alignItems: 'center', flex: 1 }}>
              <LevelMeter
                trackId={track.id}
                analysersRef={analysersRef}
                isMuted={Boolean(track.muted)}
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b7a5d9' }}>
                    <span>VOL</span>
                    <span>{Math.round(volume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={volume}
                    onChange={(e) => handleChange(track.id, 'volume', parseFloat(e.target.value))}
                    style={{ accentColor: '#c084fc', width: '100%', height: '4px', cursor: 'pointer' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b7a5d9' }}>
                    <span>PAN</span>
                    <span>{pan === 0 ? 'C' : pan < 0 ? `L${Math.round(Math.abs(pan) * 100)}` : `R${Math.round(pan * 100)}`}</span>
                  </div>
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.05}
                    value={pan}
                    onChange={(e) => handleChange(track.id, 'pan', parseFloat(e.target.value))}
                    style={{ accentColor: '#a855f7', width: '100%', height: '4px', cursor: 'pointer' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b7a5d9' }}>
                    <span>DLY</span>
                    <span>{Math.round(delayTime * 1000)}ms</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={0.8}
                    step={0.01}
                    value={delayTime}
                    onChange={(e) => handleChange(track.id, 'delayTime', parseFloat(e.target.value))}
                    style={{ accentColor: '#9333ea', width: '100%', height: '4px', cursor: 'pointer' }}
                  />
                </div>
              </div>
            </div>

            {/* EQ 3 bandas */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '5px',
                paddingTop: '4px',
                borderTop: '1px solid rgba(168, 85, 247, 0.18)'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b7a5d9', fontSize: '9px' }}>
                  <span>L</span>
                  <span>{eqLow > 0 ? `+${eqLow}` : eqLow}</span>
                </div>
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={0.5}
                  value={eqLow}
                  onChange={(e) => handleChange(track.id, 'eqLow', parseFloat(e.target.value))}
                  style={{ accentColor: '#9333ea', width: '100%', height: '4px', cursor: 'pointer' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b7a5d9', fontSize: '9px' }}>
                  <span>M</span>
                  <span>{eqMid > 0 ? `+${eqMid}` : eqMid}</span>
                </div>
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={0.5}
                  value={eqMid}
                  onChange={(e) => handleChange(track.id, 'eqMid', parseFloat(e.target.value))}
                  style={{ accentColor: '#a855f7', width: '100%', height: '4px', cursor: 'pointer' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b7a5d9', fontSize: '9px' }}>
                  <span>H</span>
                  <span>{eqHigh > 0 ? `+${eqHigh}` : eqHigh}</span>
                </div>
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={0.5}
                  value={eqHigh}
                  onChange={(e) => handleChange(track.id, 'eqHigh', parseFloat(e.target.value))}
                  style={{ accentColor: '#c084fc', width: '100%', height: '4px', cursor: 'pointer' }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};