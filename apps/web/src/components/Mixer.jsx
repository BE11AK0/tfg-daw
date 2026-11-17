import React, { useRef, useEffect } from 'react';

const BandVisualizer = ({ analyserNode }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!analyserNode || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationId;

    analyserNode.fftSize = 128;
    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationId = requestAnimationFrame(draw);
      analyserNode.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Dividir visualmente el espectro en 3 zonas: Bajos (izq), Medios (centro), Altos (der)
      const third = Math.floor(bufferLength / 3);
      let lowSum = 0, midSum = 0, highSum = 0;

      for (let i = 0; i < bufferLength; i++) {
        if (i < third) lowSum += dataArray[i];
        else if (i < third * 2) midSum += dataArray[i];
        else highSum += dataArray[i];
      }

      const lowAvg = (lowSum / third / 255) * canvas.height;
      const midAvg = (midSum / third / 255) * canvas.height;
      const highAvg = (highSum / third / 255) * canvas.height;

      const barWidth = canvas.width / 3 - 6;

      // Barra de Bajos
      ctx.fillStyle = '#ef4444'; // Rojo/Naranja para bajos
      ctx.fillRect(4, canvas.height - lowAvg, barWidth, lowAvg);

      // Barra de Medios
      ctx.fillStyle = '#eab308'; // Amarillo para medios
      ctx.fillRect(barWidth + 8, canvas.height - midAvg, barWidth, midAvg);

      // Barra de Altos
      ctx.fillStyle = '#a855f7'; // Morado para altos
      ctx.fillRect((barWidth * 2) + 12, canvas.height - highAvg, barWidth, highAvg);
    };

    draw();
    return () => cancelAnimationFrame(animationId);
  }, [analyserNode]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%' }}>
      <canvas 
        ref={canvasRef} 
        width={140} 
        height={45} 
        style={{ borderRadius: '6px', background: '#000', border: '1px solid #27272a', width: '100%' }} 
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#a1a1aa', padding: '0 2px' }}>
        <span style={{ color: '#ef4444' }}>LOW</span>
        <span style={{ color: '#eab308' }}>MID</span>
        <span style={{ color: '#a855f7' }}>HIGH</span>
      </div>
    </div>
  );
};

export const Mixer = ({ tracks, onUpdateTrack, analysersRef }) => {
  return (
    <div style={{ 
      position: 'absolute',
      inset: 0,
      padding: '16px', 
      color: '#fff', 
      display: 'flex', 
      gap: '16px', 
      overflowX: 'auto', 
      overflowY: 'hidden',
      backgroundColor: '#09090b',
      boxSizing: 'border-box'
    }}>
      {tracks.map((track) => {
        const analyser = analysersRef?.current?.[track.id];
        return (
          <div 
            key={track.id} 
            style={{ 
              background: '#18181b', 
              border: `1px solid ${track.color || '#7c3aed'}`, 
              borderRadius: '10px', 
              padding: '12px', 
              width: '190px', 
              minWidth: '190px',
              display: 'flex', 
              flexDirection: 'column', 
              gap: '10px',
              height: '100%',
              maxHeight: '100%',
              overflowY: 'auto', // Scroll interno para evitar superposiciones
              boxSizing: 'border-box',
              boxShadow: '0 4px 12px rgba(124, 58, 237, 0.2)'
            }}
          >
            <div style={{ textAlign: 'center', borderBottom: '1px solid #27272a', paddingBottom: '4px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#f4f4f5' }}>{track.name}</span>
            </div>

            {/* Analizador Visual por Bandas (Bajos, Medios, Altos) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
              <span style={{ fontSize: '9px', color: '#a1a1aa' }}>Analizador Espectral</span>
              <BandVisualizer analyserNode={analyser} />
            </div>

            {/* Volumen General */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#a1a1aa' }}>
                <span>Volumen</span>
                <span style={{ color: '#c084fc', fontWeight: 'bold' }}>{Math.round(track.volume * 100)}%</span>
              </div>
              <input 
                type="range" min="0" max="1" step="0.01" value={track.volume} 
                onChange={(e) => onUpdateTrack(track.id, { volume: parseFloat(e.target.value) })}
                style={{ accentColor: '#9333ea', cursor: 'pointer', width: '100%' }}
              />
            </div>

            {/* Paneo (Pan) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#a1a1aa' }}>
                <span>Pan (L / R)</span>
                <span style={{ color: '#c084fc', fontWeight: 'bold' }}>{track.pan || 0}</span>
              </div>
              <input 
                type="range" min="-1" max="1" step="0.1" value={track.pan || 0} 
                onChange={(e) => onUpdateTrack(track.id, { pan: parseFloat(e.target.value) })}
                style={{ accentColor: '#9333ea', cursor: 'pointer', width: '100%' }}
              />
            </div>

            {/* ECUALIZADOR: Bajos (Low Shelf) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', background: '#27272a33', padding: '6px', borderRadius: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#ef4444' }}>
                <span>📉 Bajos (Low)</span>
                <span style={{ fontWeight: 'bold' }}>{track.eqLow || 0} dB</span>
              </div>
              <input 
                type="range" min="-20" max="20" step="1" value={track.eqLow || 0} 
                onChange={(e) => onUpdateTrack(track.id, { eqLow: parseFloat(e.target.value) })}
                style={{ accentColor: '#ef4444', cursor: 'pointer', width: '100%' }}
              />
            </div>

            {/* ECUALIZADOR: Medios (Peaking) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', background: '#27272a33', padding: '6px', borderRadius: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#eab308' }}>
                <span>📻 Medios (Mid)</span>
                <span style={{ fontWeight: 'bold' }}>{track.eqMid || 0} dB</span>
              </div>
              <input 
                type="range" min="-20" max="20" step="1" value={track.eqMid || 0} 
                onChange={(e) => onUpdateTrack(track.id, { eqMid: parseFloat(e.target.value) })}
                style={{ accentColor: '#eab308', cursor: 'pointer', width: '100%' }}
              />
            </div>

            {/* ECUALIZADOR: Altos (High Shelf) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', background: '#27272a33', padding: '6px', borderRadius: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#a855f7' }}>
                <span>📈 Altos (High)</span>
                <span style={{ fontWeight: 'bold' }}>{track.eqHigh || 0} dB</span>
              </div>
              <input 
                type="range" min="-20" max="20" step="1" value={track.eqHigh || 0} 
                onChange={(e) => onUpdateTrack(track.id, { eqHigh: parseFloat(e.target.value) })}
                style={{ accentColor: '#a855f7', cursor: 'pointer', width: '100%' }}
              />
            </div>

            {/* FX Rack: Delay */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#a1a1aa' }}>
                <span>Delay (Eco)</span>
                <span style={{ color: '#c084fc', fontWeight: 'bold' }}>{(track.delayTime ?? 0).toFixed(2)}s</span>
              </div>
              <input 
                type="range" min="0" max="1" step="0.05" value={track.delayTime ?? 0} 
                onChange={(e) => onUpdateTrack(track.id, { delayTime: parseFloat(e.target.value) })}
                style={{ accentColor: '#9333ea', cursor: 'pointer', width: '100%' }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};