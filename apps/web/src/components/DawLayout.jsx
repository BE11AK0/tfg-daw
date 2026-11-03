import React, { useState, useRef } from 'react';
import './DawLayout.css';
import { DrumRack } from './DrumRack';

export const DawLayout = () => {
  const [rootHandle, setRootHandle] = useState(null);
  const [currentFolderHandle, setCurrentFolderHandle] = useState(null);
  const [folderHistory, setFolderHistory] = useState([]);
  const [folderItems, setFolderItems] = useState([]);
  const [folderName, setFolderName] = useState('');
  const [activeSample, setActiveSample] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

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

  // Carga instantánea de UNA sola carpeta sin escanear subcarpetas
  const loadFolderContents = async (dirHandle) => {
    try {
      const items = [];
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'directory') {
          items.push({ name: entry.name, kind: 'directory', handle: entry });
        } else if (entry.kind === 'file' && /\.(wav|mp3|ogg)$/i.test(entry.name)) {
          items.push({ name: entry.name, kind: 'file', handle: entry });
        }
      }

      // Ordenar: primero carpetas, luego archivos de audio
      items.sort((a, b) => {
        if (a.kind === b.kind) return a.name.localeCompare(b.name);
        return a.kind === 'directory' ? -1 : 1;
      });

      setFolderItems(items);
      setCurrentFolderHandle(dirHandle);
    } catch (err) {
      console.error('Error al leer contenido de carpeta:', err);
    }
  };

  // Selector de la carpeta principal (50 GB carga en 0.1s)
  const handleSelectFolder = async () => {
    try {
      const dirHandle = await window.showDirectoryPicker();
      setRootHandle(dirHandle);
      setFolderName(dirHandle.name);
      setFolderHistory([dirHandle]);
      await loadFolderContents(dirHandle);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error seleccionando carpeta:', err);
      }
    }
  };

  // Entrar en una subcarpeta
  const handleOpenSubfolder = async (subDirHandle) => {
    setFolderHistory((prev) => [...prev, subDirHandle]);
    await loadFolderContents(subDirHandle);
  };

  // Volver a la carpeta anterior
  const handleGoBack = async () => {
    if (folderHistory.length <= 1) return;
    const newHistory = [...folderHistory];
    newHistory.pop(); // quitar la actual
    const previousFolder = newHistory[newHistory.length - 1];
    setFolderHistory(newHistory);
    await loadFolderContents(previousFolder);
  };

  // Reproducir muestra con Web Audio API
  const playSample = async (fileItem) => {
    try {
      const ctx = getAudioContext();
      const file = await fileItem.handle.getFile();
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start(0);

      setActiveSample(fileItem);
    } catch (err) {
      console.error('Error reproduciendo muestra:', err);
    }
  };

  // Filtrado por buscador en la carpeta actual
  const displayedItems = folderItems.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

      {/* CUERPO PRINCIPAL */}
      <main className="daw-body">
        <aside className="daw-sidebar">
          <h3>Biblioteca Local</h3>

          <button className="btn-select-folder" onClick={handleSelectFolder}>
            📂 {folderName ? folderName : 'Seleccionar Pendrive (50GB)'}
          </button>

          {currentFolderHandle && (
            <div className="browser-controls">
              <div className="nav-bar">
                <button 
                  className="btn-back" 
                  onClick={handleGoBack}
                  disabled={folderHistory.length <= 1}
                >
                  ⬅ Atrás
                </button>
                <span className="current-path-label" title={currentFolderHandle.name}>
                  📁 {currentFolderHandle.name}
                </span>
              </div>

              <input
                type="text"
                placeholder="🔍 Buscar en esta carpeta..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
          )}

          <div className="file-list-container">
            <ul className="file-list">
              {displayedItems.length > 0 ? (
                displayedItems.map((item, index) => (
                  <li
                    key={index}
                    onClick={() => {
                      if (item.kind === 'directory') {
                        handleOpenSubfolder(item.handle);
                      } else {
                        playSample(item);
                      }
                    }}
                    className={`${item.kind === 'directory' ? 'is-folder' : ''} ${
                      activeSample === item ? 'playing' : ''
                    }`}
                  >
                    <span className="file-icon">
                      {item.kind === 'directory' ? '📁' : '🎵'}
                    </span>
                    <span className="file-name">{item.name}</span>
                  </li>
                ))
              ) : (
                <li className="no-files">
                  {folderName ? 'Carpeta vacía o sin coincidencias' : 'Carga tu librería de sonidos'}
                </li>
              )}
            </ul>
          </div>
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

      {/* PANEL INFERIOR */}
      <footer className="daw-bottom-panel">
        <div className="panel-tabs">
          <button className="active">Drum Rack (Pads)</button>
          <button>Piano Roll</button>
          <button>Mezclador</button>
        </div>
        <div className="panel-content">
          <DrumRack
            audioFiles={folderItems.filter((i) => i.kind === 'file').map((f) => f.handle)}
            getAudioContext={getAudioContext}
          />
        </div>
      </footer>
    </div>
  );
};