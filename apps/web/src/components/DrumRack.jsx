import React, { useState } from 'react';
import './DrumRack.css';

// 16 Pads estilo sampler tradicional (4x4)
const INITIAL_PADS = Array.from({ length: 16 }, (_, i) => ({
  id: i + 1,
  name: `Pad ${i + 1}`,
  sample: null,
  keyTrigger: ['1', '2', '3', '4', 'q', 'w', 'e', 'r', 'a', 's', 'd', 'f', 'z', 'x', 'c', 'v'][i]
}));

export const DrumRack = () => {
  const [pads, setPads] = useState(INITIAL_PADS);
  const [selectedPad, setSelectedPad] = useState(1);

  // Función para simular el disparo de sonido al hacer clic en un pad
  const triggerPad = (pad) => {
    console.log(`Disparando ${pad.name} (Tecla asociada: ${pad.keyTrigger.toUpperCase()})`);
    
    // Feedback visual rápido
    const el = document.getElementById(`pad-${pad.id}`);
    if (el) {
      el.classList.add('active');
      setTimeout(() => el.classList.remove('active'), 100);
    }
  };

  return (
    <div className="drum-rack-container">
      <div className="pads-grid">
        {pads.map((pad) => (
          <button
            key={pad.id}
            id={`pad-${pad.id}`}
            className={`drum-pad ${selectedPad === pad.id ? 'selected' : ''}`}
            onClick={() => {
              setSelectedPad(pad.id);
              triggerPad(pad);
            }}
          >
            <span className="pad-number">{pad.id}</span>
            <span className="pad-label">{pad.name}</span>
            <span className="key-hint">[{pad.keyTrigger.toUpperCase()}]</span>
          </button>
        ))}
      </div>

      <div className="pad-inspector">
        <h4>Ajustes de Pad {selectedPad}</h4>
        <div className="inspector-field">
          <label>Muestra asignada:</label>
          <span className="sample-name">Ninguna (Arrastra un .wav)</span>
        </div>
        <div className="inspector-controls">
          <button className="btn-secondary">Mapear MIDI</button>
          <button className="btn-secondary">Limpiar Pad</button>
        </div>
      </div>
    </div>
  );
};