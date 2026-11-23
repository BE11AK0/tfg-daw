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
        width: '10px',
        height: '76px',
        borderRadius: '4px',
        background: '#160d24',
        border: '1px solid rgba(192, 132, 252, 0.25)',
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
            barHeightPercent > 85
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
          color: '#d8b4fe',
          fontSize: '13px'
        }}
      >
        No hay pistas disponibles en el mezclador.
      </div>
    );
  }

  return (
    <div
      className="daw-mixer-panel"
      style={{
        display: 'flex',
        gap: '10px',
        padding: '8px 12px',
        height: '100%',
        overflowX: 'auto',
        overflowY: 'hidden',
        alignItems: 'stretch',
        background: '#120b1d',
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
              minWidth: '250px',
              maxWidth: '280px',
              background: '#1c122c',
              border: '1px solid rgba(168, 85, 247, 0.32)',
              borderTop: `3px solid ${track.color || '#a855f7'}`,
              borderRadius: '8px',
              padding: '8px 10px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '6px',
              color: '#f5eaff',
              fontSize: '11px',
              boxSizing: 'border-box'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '6px'
              }}
            >
              <strong
                style={{
                  fontSize: '12px',
                  color: '#f3e8ff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  flex: 1
                }}
                title={track.name}
              >
                {track.name}
              </strong>

              <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => handleChange(track.id, 'muted', !track.muted)}
                  style={{
                    padding: '2px 7px',
                    borderRadius: '4px',
                    border: '1px solid #9333ea',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '11px',
                    background: track.muted ? '#7e22ce' : '#291b3f',
                    color: track.muted ? '#ffffff' : '#e9d5ff'
                  }}
                >
                  M
                </button>
                <button
                  type="button"
                  onClick={() => handleChange(track.id, 'solo', !track.solo)}
                  style={{
                    padding: '2px 7px',
                    borderRadius: '4px',
                    border: '1px solid #c084fc',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '11px',
                    background: track.solo ? '#a855f7' : '#291b3f',
                    color: track.solo ? '#ffffff' : '#e9d5ff'
                  }}
                >
                  S
                </button>
                <button
                  type="button"
                  onClick={() => handleResetEqAndFx(track.id)}
                  title="Resetear EQ, Pan y Delay"
                  style={{
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: '1px solid rgba(192, 132, 252, 0.35)',
                    cursor: 'pointer',
                    fontSize: '10px',
                    background: '#241738',
                    color: '#d8b4fe'
                  }}
                >
                  Reset
                </button>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr 1fr',
                gap: '8px',
                alignItems: 'center'
              }}
            >
              <LevelMeter
                trackId={track.id}
                analysersRef={analysersRef}
                isMuted={Boolean(track.muted)}
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', color: '#e9d5ff' }}>
                  <span>Volumen</span>
                  <span>{Math.round(volume * 100)}%</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(e) => handleChange(track.id, 'volume', parseFloat(e.target.value))}
                  style={{ accentColor: '#a855f7', width: '100%', cursor: 'pointer' }}
                />

                <label style={{ display: 'flex', justifyContent: 'space-between', color: '#e9d5ff' }}>
                  <span>Paneo</span>
                  <span>{pan === 0 ? 'C' : pan < 0 ? `L ${Math.round(Math.abs(pan) * 100)}` : `R ${Math.round(pan * 100)}`}</span>
                </label>
                <input
                  type="range"
                  min={-1}
                  max={1}
                  step={0.05}
                  value={pan}
                  onChange={(e) => handleChange(track.id, 'pan', parseFloat(e.target.value))}
                  style={{ accentColor: '#c084fc', width: '100%', cursor: 'pointer' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', color: '#e9d5ff' }}>
                  <span>Delay</span>
                  <span>{Math.round(delayTime * 1000)} ms</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={0.8}
                  step={0.01}
                  value={delayTime}
                  onChange={(e) => handleChange(track.id, 'delayTime', parseFloat(e.target.value))}
                  style={{ accentColor: '#9333ea', width: '100%', cursor: 'pointer' }}
                />

                <div
                  style={{
                    marginTop: '2px',
                    padding: '4px 6px',
                    borderRadius: '4px',
                    background: '#160d24',
                    border: '1px solid rgba(168, 85, 247, 0.2)',
                    color: '#d8b4fe',
                    fontSize: '10px',
                    textAlign: 'center'
                  }}
                >
                  {track.muted
                    ? 'Canal silenciado'
                    : track.solo
                    ? 'Modo Solo activo'
                    : 'Canal listo'}
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '6px',
                paddingTop: '4px',
                borderTop: '1px solid rgba(168, 85, 247, 0.2)'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', color: '#e9d5ff', fontSize: '10px' }}>
                  <span>Low</span>
                  <span>{eqLow > 0 ? `+${eqLow}` : eqLow}dB</span>
                </label>
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={0.5}
                  value={eqLow}
                  onChange={(e) => handleChange(track.id, 'eqLow', parseFloat(e.target.value))}
                  style={{ accentColor: '#9333ea', width: '100%', cursor: 'pointer' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', color: '#e9d5ff', fontSize: '10px' }}>
                  <span>Mid</span>
                  <span>{eqMid > 0 ? `+${eqMid}` : eqMid}dB</span>
                </label>
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={0.5}
                  value={eqMid}
                  onChange={(e) => handleChange(track.id, 'eqMid', parseFloat(e.target.value))}
                  style={{ accentColor: '#a855f7', width: '100%', cursor: 'pointer' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', color: '#e9d5ff', fontSize: '10px' }}>
                  <span>High</span>
                  <span>{eqHigh > 0 ? `+${eqHigh}` : eqHigh}dB</span>
                </label>
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={0.5}
                  value={eqHigh}
                  onChange={(e) => handleChange(track.id, 'eqHigh', parseFloat(e.target.value))}
                  style={{ accentColor: '#c084fc', width: '100%', cursor: 'pointer' }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};