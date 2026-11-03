import React, { useState, useEffect, useRef } from 'react';
import './DrumRack.css';

const KEY_MAPPINGS = ['1', '2', '3', '4', 'q', 'w', 'e', 'r', 'a', 's', 'd', 'f', 'z', 'x', 'c', 'v'];

export const DrumRack = ({ audioFiles = [], getAudioContext }) => {
  // Estado para los 16 pads
  const [pads, setPads] = useState(() =>
    Array.from({ length: 16 }, (_, i) => ({
      id: i + 1,
      name: `Pad ${i + 1}`,
      fileHandle: null,
      audioBuffer: null,
      keyTrigger: KEY_MAPPINGS[i]
    }))
  );

  const [selectedPadId, setSelectedPadId] = useState(1);
  const padsRef = useRef(pads);
  padsRef.current = pads;

  // Cargar y decodificar el Buffer de Audio al asignar un archivo a un Pad
  const assignSampleToPad = async (padId, fileHandle) => {
    if (!fileHandle) return;

    try {
      const ctx = getAudioContext();
      const file = await fileHandle.getFile();
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      setPads((prevPads) =>
        prevPads.map((pad) =>
          pad.id === padId
            ? { ...pad, name: fileHandle.name, fileHandle, audioBuffer }
            : pad
        )
      );
    } catch (err) {
      console.error('Error decodificando audio para el pad:', err);
    }
  };

  // Disparar el sonido del Pad con Web Audio API
  const triggerPad = (pad) => {
    // Feedback visual en la interfaz
    const el = document.getElementById(`pad-${pad.id}`);
    if (el) {
      el.classList.add('active');
      setTimeout(() => el.classList.remove('active'), 120);
    }

    if (!pad.audioBuffer) return;

    try {
      const ctx = getAudioContext();
      const source = ctx.createBufferSource();
      source.buffer = pad.audioBuffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch (err) {
      console.error('Error al reproducir el pad:', err);
    }
  };

  // Escuchador de teclado para disparar los Pads con teclas físicas (1..4, Q..R, A..F, Z..V)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.repeat || e.target.tagName === 'INPUT') return;

      const key = e.key.toLowerCase();
      const targetPad = padsRef.current.find((p) => p.keyTrigger === key);

      if (targetPad) {
        triggerPad(targetPad);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const currentSelectedPad = pads.find((p) => p.id === selectedPadId);

  return (
    <div className="drum-rack-container">
      {/* CUADRÍCULA DE PADS 4x4 */}
      <div className="pads-grid">
        {pads.map((pad) => (
          <button
            key={pad.id}
            id={`pad-${pad.id}`}
            className={`drum-pad ${selectedPadId === pad.id ? 'selected' : ''} ${pad.audioBuffer ? 'has-sample' : ''}`}
            onClick={() => {
              setSelectedPadId(pad.id);
              triggerPad(pad);
            }}
          >
            <span className="pad-number">{pad.id}</span>
            <span className="pad-label">{pad.name}</span>
            <span className="key-hint">[{pad.keyTrigger.toUpperCase()}]</span>
          </button>
        ))}
      </div>

      {/* PANEL LATERAL DE CONTROL DE PAD */}
      <div className="pad-inspector">
        <h4>Ajustes de Pad {selectedPadId}</h4>
        
        <div className="inspector-field">
          <label>Muestra asignada:</label>
          <span className="sample-name">
            {currentSelectedPad?.fileHandle ? currentSelectedPad.fileHandle.name : 'Ninguna seleccionada'}
          </span>
        </div>

        <div className="inspector-field">
          <label>Asignar desde Biblioteca:</label>
          <select
            className="sample-select"
            value=""
            onChange={(e) => {
              const fileIndex = e.target.value;
              if (fileIndex !== '') {
                assignSampleToPad(selectedPadId, audioFiles[fileIndex]);
              }
            }}
          >
            <option value="">-- Selecciona una muestra --</option>
            {audioFiles.map((file, idx) => (
              <option key={idx} value={idx}>
                {file.name}
              </option>
            ))}
          </select>
        </div>

        <div className="inspector-controls">
          <button 
            className="btn-secondary" 
            onClick={() => {
              setPads((prev) =>
                prev.map((p) =>
                  p.id === selectedPadId
                    ? { ...p, name: `Pad ${p.id}`, fileHandle: null, audioBuffer: null }
                    : p
                )
              );
            }}
          >
            Limpiar Pad
          </button>
        </div>
      </div>
    </div>
  );
};