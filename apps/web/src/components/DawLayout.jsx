import React, { useState, useRef } from 'react';
import './DawLayout.css';
import { DrumRack } from './DrumRack';

export const DawLayout = () => {
  const [audioFiles, setAudioFiles] = useState([]);
  const [folderName, setFolderName] = useState('');
  const [activeSample, setActiveSample] = useState(null);

  // Contexto de Web Audio para reproducción de baja latencia
  const audioCtxRef = useRef(null);

  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  // Función para abrir la carpeta del PC mediante File System Access API
  const handleSelectFolder = async () => {
    try {
      const dirHandle = await window.showDirectoryPicker();
      setFolderName(dirHandle.name);

      const files = [];
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file' && /\.(wav|mp3|ogg)$/i.test(entry.name)) {
          files.push(entry);
        }
      }
      setAudioFiles(files);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error al seleccionar carpeta:', err);
      }
    }
  };

  // Reproducir directamente una muestra desde la lista de la biblioteca
  const playSample = async (fileHandle) => {
    try {
      const ctx = getAudioContext();
      const file = await fileHandle.getFile();
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start(0);

      setActiveSample(fileHandle);
    } catch (err) {
      console.error('Error reproduciendo muestra:', err);
    }
  };

  return (
    <div className="daw-container">
      {/* BARRA SUPERIOR / TRANSPORTE */}
      <header className="daw-header">
        <div className="transport-controls">
          <button className="btn-transport">PLAY</button>
          <button className="btn-transport">STOP</button>
          <button className="btn-transport rec">REC</button>
          <div className="bpm-selector">
            <span>BPM</span>
            <input type="number" defaultValue={120} />
          </div>
        </div>
        <div className="project-title">
          <span>Proyecto: TFG_Track_01</span>
        </div>
        <div className="presence-badge">
          <span>🟢 2 usuarios conectados</span>
        </div>
      </header>

      {/* CUERPO PRINCIPAL (Biblioteca + Timeline) */}
      <main className="daw-body">
        <aside className="daw-sidebar">
          <h3>Biblioteca Local</h3>
          <button className="btn-select-folder" onClick={handleSelectFolder}>
            📂 {folderName ? `Carpeta: ${folderName}` : 'Seleccionar Carpeta PC'}
          </button>
          
          <ul className="file-list">
            {audioFiles.length > 0 ? (
              audioFiles.map((file, index) => (
                <li 
                  key={index} 
                  title="Haz clic para escuchar el sonido"
                  onClick={() => playSample(file)}
                  className={activeSample === file ? 'playing' : ''}
                >
                  ▶ 🎵 {file.name}
                </li>
              ))
            ) : (
              <li className="no-files">Sin archivos cargados</li>
            )}
          </ul>
        </aside>

        <section className="daw-timeline">
          <div className="track-header" style={{ borderLeftColor: 'var(--track-color-1)' }}>
            <span>Pista 1: Drums</span>
          </div>
          <div className="track-lane"></div>

          <div className="track-header" style={{ borderLeftColor: 'var(--track-color-4)' }}>
            <span>Pista 2: Synth MIDI</span>
          </div>
          <div className="track-lane"></div>
        </section>
      </main>

      {/* PANEL INFERIOR (Piano Roll / Pads) */}
      <footer className="daw-bottom-panel">
        <div className="panel-tabs">
          <button className="active">Drum Rack (Pads)</button>
          <button>Piano Roll</button>
          <button>Mezclador</button>
        </div>
        <div className="panel-content">
          <DrumRack audioFiles={audioFiles} getAudioContext={getAudioContext} />
        </div>
      </footer>
    </div>
  );
};