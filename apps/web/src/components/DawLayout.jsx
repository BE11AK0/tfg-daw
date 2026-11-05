import React, { useState, useRef, useEffect } from 'react';
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

  const [zoom, setZoom] = useState(50);
  const [trackHeight, setTrackHeight] = useState(64);
  const [selectedClipId, setSelectedClipId] = useState(null);
  const [tracks, setTracks] = useState([
    { id: 1, name: 'Pista 1: Drums', color: 'var(--track-color-1)', clips: [] },
    { id: 2, name: 'Pista 2: Synth MIDI', color: 'var(--track-color-4)', clips: [] }
  ]);

  const audioCtxRef = useRef(null);
  const timelineRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => {
    const timelineEl = timelineRef.current;
    if (!timelineEl) return;

    const handleWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 6 : -6;
        setZoom((prev) => Math.min(Math.max(prev + delta, 15), 180));
      } else if (e.altKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 6 : -6;
        setTrackHeight((prev) => Math.min(Math.max(prev + delta, 40), 140));
      }
    };

    timelineEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => timelineEl.removeEventListener('wheel', handleWheel);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!selectedClipId) return;
      if (e.target.tagName === 'INPUT') return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        setTracks((prevTracks) =>
          prevTracks.map((t) => ({
            ...t,
            clips: t.clips.filter((c) => c.id !== selectedClipId)
          }))
        );
        setSelectedClipId(null);
      }

      if (e.ctrlKey && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        setTracks((prevTracks) =>
          prevTracks.map((t) => {
            const clipIndex = t.clips.findIndex((c) => c.id === selectedClipId);
            if (clipIndex === -1) return t;

            const target = t.clips[clipIndex];
            if (target.width <= 20) return t;

            const halfWidth = Math.floor(target.width / 2);
            const clip1 = { ...target, width: halfWidth };
            const clip2 = {
              ...target,
              id: Date.now(),
              start: target.start + halfWidth,
              width: target.width - halfWidth,
              name: `${target.name} (Split)`
            };

            const updatedClips = [...t.clips];
            updatedClips.splice(clipIndex, 1, clip1, clip2);
            return { ...t, clips: updatedClips };
          })
        );
      }

      if (e.ctrlKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        setTracks((prevTracks) =>
          prevTracks.map((t) => {
            const target = t.clips.find((c) => c.id === selectedClipId);
            if (!target) return t;

            const newStart = target.start + target.width;
            const newEnd = newStart + target.width;

            const isOccupied = t.clips.some((c) => {
              const cEnd = c.start + c.width;
              return newStart < cEnd && newEnd > c.start;
            });

            if (isOccupied) return t;

            const newClip = {
              ...target,
              id: Date.now(),
              start: newStart
            };
            return { ...t, clips: [...t.clips, newClip] };
          })
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipId]);

  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

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

  const handleOpenSubfolder = async (subDirHandle) => {
    setFolderHistory((prev) => [...prev, subDirHandle]);
    await loadFolderContents(subDirHandle);
  };

  const handleGoBack = async () => {
    if (folderHistory.length <= 1) return;
    const newHistory = [...folderHistory];
    newHistory.pop();
    const previousFolder = newHistory[newHistory.length - 1];
    setFolderHistory(newHistory);
    await loadFolderContents(previousFolder);
  };

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

  const trackColors = [
    'var(--track-color-1)',
    'var(--track-color-4)',
    '#e63946', '#f4a261', '#2a9d8f', '#e76f51', '#9d4edd', '#457b9d'
  ];

  const handleAddTrack = () => {
    setTracks((prevTracks) => {
      const nextId = prevTracks.length > 0 ? Math.max(...prevTracks.map((t) => t.id)) + 1 : 1;
      const color = trackColors[(nextId - 1) % trackColors.length];
      return [
        ...prevTracks,
        { id: nextId, name: `Pista ${nextId}: Canal Audio`, color, clips: [] }
      ];
    });
  };

  const handleAddClip = (trackId, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const startPosition = Math.floor(clickX / zoom) * zoom;
    const clipWidth = zoom * 4;
    const endPosition = startPosition + clipWidth;

    const targetTrack = tracks.find((t) => t.id === trackId);
    
    const isOccupied = targetTrack.clips.some((clip) => {
      const clipEnd = clip.start + clip.width;
      return startPosition < clipEnd && endPosition > clip.start;
    });

    if (isOccupied) return;

    const newClip = {
      id: Date.now(),
      name: activeSample ? activeSample.name : 'Clip Audio',
      start: startPosition,
      width: clipWidth
    };

    setTracks((prevTracks) =>
      prevTracks.map((t) => (t.id === trackId ? { ...t, clips: [...t.clips, newClip] } : t))
    );
    setSelectedClipId(newClip.id);
  };

  const handleClipMouseDown = (e, trackId, clip, action) => {
    e.stopPropagation();
    setSelectedClipId(clip.id);

    dragRef.current = {
      action,
      trackId,
      clipId: clip.id,
      startX: e.clientX,
      initialStart: clip.start,
      initialWidth: clip.width
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e) => {
    if (!dragRef.current) return;
    const { action, trackId, clipId, startX, initialStart, initialWidth } = dragRef.current;
    const deltaX = e.clientX - startX;
    const targetTrack = tracks.find((t) => t.id === trackId);

    setTracks((prevTracks) =>
      prevTracks.map((t) => {
        if (t.id !== trackId) return t;

        return {
          ...t,
          clips: t.clips.map((c) => {
            if (c.id !== clipId) return c;

            const snapGrid = zoom / 2;
            const otherClips = targetTrack.clips.filter((item) => item.id !== clipId);

            if (action === 'move') {
              let newStart = Math.max(0, initialStart + deltaX);
              newStart = Math.round(newStart / snapGrid) * snapGrid;
              const newEnd = newStart + c.width;

              for (const other of otherClips) {
                const otherEnd = other.start + other.width;
                if (newStart < otherEnd && newEnd > other.start) {
                  if (initialStart >= otherEnd) newStart = otherEnd;
                  else if (initialStart + c.width <= other.start) newStart = other.start - c.width;
                }
              }
              return { ...c, start: Math.max(0, newStart) };
            }

            if (action === 'resize-right') {
              let newWidth = Math.max(snapGrid, initialWidth + deltaX);
              newWidth = Math.round(newWidth / snapGrid) * snapGrid;
              const proposedEnd = c.start + newWidth;

              const nextClip = otherClips
                .filter((other) => other.start >= c.start + initialWidth)
                .sort((a, b) => a.start - b.start)[0];

              if (nextClip && proposedEnd > nextClip.start) {
                newWidth = nextClip.start - c.start;
              }
              return { ...c, width: newWidth };
            }

            if (action === 'resize-left') {
              let proposedStart = initialStart + deltaX;
              proposedStart = Math.round(proposedStart / snapGrid) * snapGrid;
              let proposedWidth = initialWidth + (initialStart - proposedStart);

              const prevClip = otherClips
                .filter((other) => other.start + other.width <= initialStart)
                .sort((a, b) => (b.start + b.width) - (a.start + a.width))[0];

              if (prevClip && proposedStart < prevClip.start + prevClip.width) {
                proposedStart = prevClip.start + prevClip.width;
                proposedWidth = (initialStart + initialWidth) - proposedStart;
              }

              if (proposedWidth >= snapGrid && proposedStart >= 0) {
                return { ...c, start: proposedStart, width: proposedWidth };
              }
            }

            return c;
          })
        };
      })
    );
  };

  const handleMouseUp = () => {
    dragRef.current = null;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  };

  const displayedItems = folderItems.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="daw-container" onClick={() => setSelectedClipId(null)}>
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

      <main className="daw-body">
        <aside className="daw-sidebar" onClick={(e) => e.stopPropagation()}>
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

        <section
          className="daw-timeline"
          ref={timelineRef}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="timeline-toolbar">
            <button className="btn-add-track" onClick={handleAddTrack}>
              + Añadir Pista
            </button>
            <div className="timeline-shortcuts">
              <span>Zoom H: Ctrl + 🐭</span>
              <span>Zoom V: Alt + 🐭</span>
              <span>Duplicar: Ctrl + D</span>
              <span>Cortar: Ctrl + E</span>
            </div>
          </div>

          <div
            className="timeline-grid"
            style={{ gridAutoRows: `${trackHeight}px` }}
          >
            {tracks.map((track) => (
              <React.Fragment key={track.id}>
                <div className="track-header" style={{ borderLeftColor: track.color }}>
                  <span>{track.name}</span>
                </div>
                <div
                  className="track-lane"
                  style={{ backgroundSize: `${zoom}px 100%` }}
                  onClick={(e) => handleAddClip(track.id, e)}
                >
                  {track.clips.map((clip) => (
                    <div
                      key={clip.id}
                      className={`timeline-clip ${
                        selectedClipId === clip.id ? 'selected' : ''
                      }`}
                      style={{ left: `${clip.start}px`, width: `${clip.width}px` }}
                      onMouseDown={(e) => handleClipMouseDown(e, track.id, clip, 'move')}
                    >
                      <div
                        className="clip-handle handle-left"
                        onMouseDown={(e) => handleClipMouseDown(e, track.id, clip, 'resize-left')}
                      />
                      
                      <div className="clip-header-bar">
                        <span className="clip-title">{clip.name}</span>
                      </div>
                      
                      <div
                        className="clip-handle handle-right"
                        onMouseDown={(e) => handleClipMouseDown(e, track.id, clip, 'resize-right')}
                      />
                    </div>
                  ))}
                </div>
              </React.Fragment>
            ))}
          </div>
        </section>
      </main>

      <footer className="daw-bottom-panel" onClick={(e) => e.stopPropagation()}>
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