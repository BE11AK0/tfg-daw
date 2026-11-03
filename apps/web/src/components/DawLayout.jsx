import React, { useState } from 'react';
import './DawLayout.css';
import { DrumRack } from './DrumRack';

export const DawLayout = () => {
  const [audioFiles, setAudioFiles] = useState([]);
  const [folderName, setFolderName] = useState('');

  // Función para abrir la carpeta del PC mediante la File System Access API
  const handleSelectFolder = async () => {
    try {
      // Abre el selector de carpetas del sistema
      const dirHandle = await window.showDirectoryPicker();
      setFolderName(dirHandle.name);

      const files = [];
      // Recorremos los archivos de la carpeta
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
          // Filtramos solo archivos de audio (.wav, .mp3, .ogg)
          if (/\.(wav|mp3|ogg)$/i.test(entry.name)) {
            files.push(entry);
          }
        }
      }

      setAudioFiles(files);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error al seleccionar la carpeta:', err);
      }
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
                <li key={index} title={file.name}>
                  🎵 {file.name}
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
          <DrumRack />
        </div>
      </footer>
    </div>
  );
};