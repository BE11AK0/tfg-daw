import React, { useState, useRef, useEffect } from 'react';
import './DawLayout.css';
import { DrumRack } from './DrumRack';
import { PianoRoll } from './PianoRoll';

const AudioWaveform = ({ audioBuffer, color = '#c084fc', originalWidth, clipWidth, clipOffset = 0, height = 40 }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!audioBuffer || !canvasRef.current || originalWidth <= 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color;

    const data = audioBuffer.getChannelData(0); 
    const step = Math.max(1, Math.ceil(data.length / originalWidth));
    const amp = height / 2;

    const offCanvas = document.createElement('canvas');
    offCanvas.width = originalWidth;
    offCanvas.height = height;
    const offCtx = offCanvas.getContext('2d');
    offCtx.fillStyle = color;
    
    for (let i = 0; i < originalWidth; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = data[(i * step) + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      offCtx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
    }

    const iterations = Math.ceil((clipWidth + clipOffset) / originalWidth);
    for(let i = 0; i < iterations; i++) {
       ctx.drawImage(offCanvas, (i * originalWidth) - clipOffset, 0);
    }
  }, [audioBuffer, originalWidth, clipWidth, clipOffset, height, color]);

  return <canvas ref={canvasRef} width={clipWidth} height={height} />;
};

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
  const [activeBottomTab, setActiveBottomTab] = useState('drum-rack'); // 'drum-rack' | 'piano-roll' | 'mixer'

  const [tracks, setTracks] = useState([
    { id: 1, name: 'Pista 1: Drums', color: 'var(--track-color-1)', volume: 0.8, muted: false, solo: false, clips: [] },
    { id: 2, name: 'Pista 2: Synth MIDI', color: 'var(--track-color-4)', volume: 0.7, muted: false, solo: false, clips: [] }
  ]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [playheadPosition, setPlayheadPosition] = useState(0);

  const audioCtxRef = useRef(null);
  const timelineRef = useRef(null);
  const dragRef = useRef(null);
  const animationFrameRef = useRef(null);
  const activeSourcesRef = useRef([]);
  
  const previewAudioRef = useRef(null);
  const draggedItemRef = useRef(null);

  const playStartPositionRef = useRef(0);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

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

  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  const stopPreviewAudio = () => {
    if (previewAudioRef.current) {
      try { previewAudioRef.current.stop(); } catch (e) {}
      previewAudioRef.current = null;
    }
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    activeSourcesRef.current.forEach((source) => {
      try { source.stop(); } catch (e) {}
    });
    activeSourcesRef.current = [];
  };

  const startAudioPlayback = (ctx, startPx) => {
    activeSourcesRef.current.forEach((source) => {
      try { source.stop(); } catch (e) {}
    });
    activeSourcesRef.current = [];

    const pxPerSec = zoom * (bpm / 60);
    const startTime = ctx.currentTime - (startPx / pxPerSec);

    tracksRef.current.forEach((track) => {
      if (track.muted) return;

      track.clips.forEach(async (clip) => {
        if (clip.audioBuffer) {
          try {
            const clipStartTime = startTime + (clip.start / pxPerSec);
            const clipDurationSec = clip.width / pxPerSec;
            const clipOffsetSec = (clip.clipOffset || 0) / pxPerSec;
            const now = ctx.currentTime;
            const endTime = clipStartTime + clipDurationSec;

            if (now >= endTime) return;

            const source = ctx.createBufferSource();
            source.buffer = clip.audioBuffer;
            source.loop = true;
            
            const gainNode = ctx.createGain();
            gainNode.gain.value = track.volume;

            source.connect(gainNode);
            gainNode.connect(ctx.destination);

            if (clipStartTime >= now) {
              source.start(clipStartTime, clipOffsetSec, clipDurationSec);
              activeSourcesRef.current.push(source);
            } else {
              const playheadOffset = now - clipStartTime;
              const bufferStartOffset = (clipOffsetSec + playheadOffset) % clip.audioBuffer.duration;
              const playDuration = clipDurationSec - playheadOffset;
              
              source.start(now, bufferStartOffset, playDuration);
              activeSourcesRef.current.push(source);
            }
          } catch (err) {
            console.error('Error al reproducir clip:', err);
          }
        }
      });
    });

    return startTime;
  };

  const handlePlay = async () => {
    stopPreviewAudio(); 
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();

    if (isPlayingRef.current) {
      stopPlayback();
    } else {
      setIsPlaying(true);
      playStartPositionRef.current = playheadPosition;
      
      const pxPerSec = zoom * (bpm / 60);
      const startTime = startAudioPlayback(ctx, playheadPosition);

      const updatePlayhead = () => {
        if (!isPlayingRef.current) return;

        const elapsed = ctx.currentTime - startTime;
        let currentPx = elapsed * pxPerSec;

        let maxTimelineEnd = 3000;
        tracksRef.current.forEach(t => {
          t.clips.forEach(c => {
            const cEnd = c.start + c.width;
            if (cEnd > maxTimelineEnd) maxTimelineEnd = cEnd;
          });
        });

        if (currentPx >= maxTimelineEnd) {
          stopPlayback();
          setPlayheadPosition(playStartPositionRef.current);
          return;
        }
        
        setPlayheadPosition(currentPx);
        animationFrameRef.current = requestAnimationFrame(updatePlayhead);
      };

      animationFrameRef.current = requestAnimationFrame(updatePlayhead);
    }
  };

  const handleStop = () => {
    stopPreviewAudio();
    stopPlayback();
    setPlayheadPosition(playStartPositionRef.current);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handlePlay();
        return;
      }

      if (!selectedClipId) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        setTracks((prevTracks) =>
          prevTracks.map((t) => ({ ...t, clips: t.clips.filter((c) => c.id !== selectedClipId) }))
        );
        setSelectedClipId(null);
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

            const newClip = { ...target, id: Date.now(), start: newStart };
            return { ...t, clips: [...t.clips, newClip] };
          })
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipId, bpm, zoom, tracks, playheadPosition]);

  const handleSetPlayhead = (e) => {
    if (e.target.closest('.timeline-clip')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left + timelineRef.current.scrollLeft;
    const snappedX = Math.round(clickX / (zoom / 2)) * (zoom / 2);

    if (isPlayingRef.current) handleStop(); 
    setPlayheadPosition(Math.max(0, snappedX));
    playStartPositionRef.current = Math.max(0, snappedX);
  };

  const loadFolderContents = async (dirHandle) => {
    try {
      const items = [];
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'directory') {
          items.push({ name: entry.name, kind: 'directory', handle: entry });
        } else if (entry.kind === 'file' && /\.(wav|mp3|ogg|flac|m4a)$/i.test(entry.name)) {
          items.push({ name: entry.name, kind: 'file', handle: entry });
        }
      }
      items.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'directory' ? -1 : 1));
      setFolderItems(items);
      setCurrentFolderHandle(dirHandle);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleSelectFolder = async () => {
    try {
      if (!window.showDirectoryPicker) {
        alert('Navegador no soportado. Usa Chrome o Edge.');
        return;
      }
      const dirHandle = await window.showDirectoryPicker();
      setRootHandle(dirHandle);
      setFolderName(dirHandle.name);
      setFolderHistory([dirHandle]);
      await loadFolderContents(dirHandle);
    } catch (err) {
      if (err.name !== 'AbortError') console.error('Error:', err);
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
    stopPreviewAudio();
    try {
      const ctx = getAudioContext();
      const file = await fileItem.handle.getFile();
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start(0);

      previewAudioRef.current = source; 
      setActiveSample(fileItem);
    } catch (err) {}
  };

  const trackColors = ['var(--track-color-1)', 'var(--track-color-4)', '#e63946', '#f4a261', '#2a9d8f', '#e76f51'];

  const handleAddTrack = () => {
    setTracks((prevTracks) => {
      const nextId = prevTracks.length > 0 ? Math.max(...prevTracks.map((t) => t.id)) + 1 : 1;
      const color = trackColors[(nextId - 1) % trackColors.length];
      return [...prevTracks, { id: nextId, name: `Pista ${nextId}`, color, volume: 0.75, muted: false, solo: false, clips: [] }];
    });
  };

  const updateTrack = (id, updatedFields) => {
    setTracks((prevTracks) => prevTracks.map((t) => (t.id === id ? { ...t, ...updatedFields } : t)));
  };

  const deleteTrack = (id) => setTracks((prevTracks) => prevTracks.filter((t) => t.id !== id));

  const duplicateTrack = (id) => {
    setTracks((prevTracks) => {
      const trackToClone = prevTracks.find((t) => t.id === id);
      if (!trackToClone) return prevTracks;
      const newId = Math.max(...prevTracks.map((t) => t.id)) + 1;
      return [...prevTracks, { ...trackToClone, id: newId, name: `${trackToClone.name} (Copia)` }];
    });
  };

  const getClipDataForFile = async (fileHandle) => {
    if (!fileHandle) return { width: zoom * 4, buffer: null };
    try {
      const file = await fileHandle.getFile();
      const arrayBuffer = await file.arrayBuffer();
      const ctx = getAudioContext();
      const buffer = await ctx.decodeAudioData(arrayBuffer);
      const durationInBeats = buffer.duration * (bpm / 60);
      return { width: durationInBeats * zoom, buffer };
    } catch (e) {
      return { width: zoom * 4, buffer: null }; 
    }
  };

  const handleDropToTrack = async (e, trackId) => {
    e.preventDefault();
    const droppedItem = draggedItemRef.current;
    if (!droppedItem) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const dropX = e.clientX - rect.left;
    const startPosition = Math.floor(dropX / zoom) * zoom;
    
    const { width: clipWidth, buffer: clipBuffer } = await getClipDataForFile(droppedItem.handle);
    const endPosition = startPosition + clipWidth;

    setTracks((prevTracks) => {
      const targetTrack = prevTracks.find((t) => t.id === trackId);
      const isOccupied = targetTrack.clips.some((clip) => startPosition < clip.start + clip.width && endPosition > clip.start);
      if (isOccupied) {
        draggedItemRef.current = null;
        return prevTracks;
      }

      const newClip = {
        id: Date.now(),
        name: droppedItem.name,
        fileHandle: droppedItem.handle,
        audioBuffer: clipBuffer,
        start: startPosition,
        width: clipWidth,
        clipOffset: 0
      };

      setSelectedClipId(newClip.id);
      draggedItemRef.current = null;
      return prevTracks.map((t) => (t.id === trackId ? { ...t, clips: [...t.clips, newClip] } : t));
    });
  };

  const displayedItems = folderItems.filter((item) => item.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="daw-container" onClick={() => setSelectedClipId(null)}>
      <header className="daw-header">
        <div className="transport-controls">
          <button className={`btn-transport ${isPlaying ? 'active-play' : ''}`} onClick={handlePlay}>
            {isPlaying ? 'PAUSE' : 'PLAY'}
          </button>
          <button className="btn-transport" onClick={handleStop}>STOP</button>
          <div className="bpm-selector">
            <span>BPM</span>
            <input type="number" value={bpm} onChange={(e) => setBpm(Number(e.target.value) || 120)} />
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
                <button className="btn-back" onClick={handleGoBack} disabled={folderHistory.length <= 1}>⬅ Atrás</button>
                <span className="current-path-label" title={currentFolderHandle.name}>📁 {currentFolderHandle.name}</span>
              </div>
              <input type="text" placeholder="🔍 Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="search-input" />
            </div>
          )}

          <div className="file-list-container">
            <ul className="file-list">
              {displayedItems.length > 0 ? (
                displayedItems.map((item, index) => (
                  <li
                    key={index}
                    draggable={item.kind === 'file'}
                    onDragStart={() => { if (item.kind === 'file') draggedItemRef.current = item; }}
                    onClick={() => item.kind === 'directory' ? handleOpenSubfolder(item.handle) : playSample(item)}
                    className={`${item.kind === 'directory' ? 'is-folder' : ''} ${activeSample === item ? 'playing' : ''}`}
                  >
                    <span className="file-icon">{item.kind === 'directory' ? '📁' : '🎵'}</span>
                    <span className="file-name">{item.name}</span>
                  </li>
                ))
              ) : (
                <li className="no-files">{folderName ? 'Carpeta vacía' : 'Carga tu librería de sonidos'}</li>
              )}
            </ul>
          </div>
        </aside>

        <section className="daw-timeline" ref={timelineRef} onClick={(e) => e.stopPropagation()}>
          <div className="timeline-toolbar">
            <button className="btn-add-track" onClick={handleAddTrack}>+ Añadir Pista</button>
            <div className="timeline-shortcuts">
              <span>Zoom H: Ctrl + 🐭</span>
              <span>Zoom V: Alt + 🐭</span>
              <span>Duplicar: Ctrl + D</span>
              <span>Play/Pause: ␣ Space</span>
            </div>
          </div>

          <div className="timeline-grid" style={{ gridAutoRows: `${trackHeight}px` }}>
            {tracks.map((track) => (
              <React.Fragment key={track.id}>
                <div className="track-header" style={{ borderLeftColor: track.color, width: '160px', minWidth: '160px' }}>
                  <div className="track-header-top">
                    <input type="text" value={track.name} onChange={(e) => updateTrack(track.id, { name: e.target.value })} className="track-name-input-custom" />
                    <div className="track-inline-buttons">
                      <button className={`btn-ctrl-tiny ${track.muted ? 'active-mute' : ''}`} onClick={() => updateTrack(track.id, { muted: !track.muted })}>M</button>
                      <button className={`btn-ctrl-tiny ${track.solo ? 'active-solo' : ''}`} onClick={() => updateTrack(track.id, { solo: !track.solo })}>S</button>
                    </div>
                  </div>
                  <div className="track-header-bottom">
                    <input type="range" min="0" max="1" step="0.01" value={track.volume} onChange={(e) => updateTrack(track.id, { volume: parseFloat(e.target.value) })} className="track-vol-slider-custom" />
                    <div className="track-actions-tiny">
                      <button onClick={() => duplicateTrack(track.id)}>📋</button>
                      <button onClick={() => deleteTrack(track.id)}>✕</button>
                    </div>
                  </div>
                </div>

                <div
                  className={`track-lane ${track.muted ? 'is-muted' : ''}`}
                  style={{ backgroundSize: `${zoom}px 100%`, width: '3000px' }}
                  onClick={handleSetPlayhead} 
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                  onDrop={(e) => handleDropToTrack(e, track.id)}
                >
                  <div className="track-playhead" style={{ left: `${playheadPosition}px`, display: playheadPosition >= 0 ? 'block' : 'none' }} />

                  {track.clips.map((clip) => (
                    <div
                      key={clip.id}
                      className={`timeline-clip ${selectedClipId === clip.id ? 'selected' : ''}`}
                      style={{ left: `${clip.start}px`, width: `${clip.width}px` }}
                      onClick={(e) => { e.stopPropagation(); setSelectedClipId(clip.id); }}
                    >
                      {clip.audioBuffer && (
                        <div style={{ position: 'absolute', top: '18px', bottom: 0, left: 0, right: 0, overflow: 'hidden', pointerEvents: 'none' }}>
                          <AudioWaveform 
                            audioBuffer={clip.audioBuffer} 
                            originalWidth={clip.audioBuffer.duration * zoom * (bpm / 60)}
                            clipWidth={clip.width}
                            clipOffset={clip.clipOffset || 0}
                            height={trackHeight - 24} 
                            color="var(--accent-purple-light)" 
                          />
                        </div>
                      )}
                      <div className="clip-header-bar">
                        <span className="clip-title">{clip.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </React.Fragment>
            ))}
          </div>
        </section>
      </main>

      <footer className="daw-bottom-panel" onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', height: '260px', background: 'var(--bg-panel)', borderTop: '1px solid var(--border-color)', boxSizing: 'border-box' }}>
        <div className="panel-tabs" style={{ display: 'flex', gap: '4px', padding: '6px 12px', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
          <button 
            className={activeBottomTab === 'drum-rack' ? 'active' : ''} 
            onClick={() => setActiveBottomTab('drum-rack')}
            style={{ padding: '6px 14px', background: activeBottomTab === 'drum-rack' ? 'var(--accent-purple)' : 'transparent', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Drum Rack (Pads)
          </button>
          <button 
            className={activeBottomTab === 'piano-roll' ? 'active' : ''} 
            onClick={() => setActiveBottomTab('piano-roll')}
            style={{ padding: '6px 14px', background: activeBottomTab === 'piano-roll' ? 'var(--accent-purple)' : 'transparent', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Rollo de piano
          </button>
          <button 
            className={activeBottomTab === 'mixer' ? 'active' : ''} 
            onClick={() => setActiveBottomTab('mixer')}
            style={{ padding: '6px 14px', background: activeBottomTab === 'mixer' ? 'var(--accent-purple)' : 'transparent', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Mezclador
          </button>
        </div>
        
        <div className="panel-content" style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {activeBottomTab === 'drum-rack' && <DrumRack audioFiles={folderItems.filter((i) => i.kind === 'file').map((f) => f.handle)} getAudioContext={getAudioContext} />}
          {activeBottomTab === 'piano-roll' && (
            <PianoRoll 
              audioFiles={folderItems.filter((i) => i.kind === 'file').map((f) => f.handle)} 
              getAudioContext={getAudioContext} 
              isPlaying={isPlaying}
              bpm={bpm}
              playheadPosition={playheadPosition}
              zoom={zoom}
              onUpdatePlayhead={(newPos) => {
                setPlayheadPosition(newPos);
                playStartPositionRef.current = newPos;
              }}
              onExportMidiClip={(midiClip) => {
                setTracks((prevTracks) =>
                  prevTracks.map((t) => {
                    if (t.id === 2 || t.name.toLowerCase().includes('synth')) {
                      const newClip = {
                        id: Date.now(),
                        name: midiClip.name,
                        start: midiClip.start,
                        width: midiClip.width,
                        notes: midiClip.notes,
                        audioBuffer: null,
                      };
                      return { ...t, clips: [...t.clips.filter(c => c.name !== midiClip.name), newClip] };
                    }
                    return t;
                  })
                );
                alert('¡Clip MIDI enviado a la Pista 2! 🎹');
              }}
            />
          )}
          {activeBottomTab === 'mixer' && <div style={{ color: 'var(--text-secondary)', padding: '20px', textAlign: 'center' }}>Mixer virtual en construcción...</div>}
        </div>
      </footer>
    </div>
  );
};