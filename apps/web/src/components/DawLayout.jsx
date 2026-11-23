import React, { useState, useRef, useEffect, useMemo } from 'react';
import './DawLayout.css';
import { DrumRack } from './DrumRack';
import { PianoRoll } from './PianoRoll';
import { Mixer } from './Mixer';
import { dawEngine } from '../audio/dawEngine';

const AUDIO_EXT_REGEX = /\.(wav|mp3|ogg|flac|m4a)$/i;

function isTauriRuntime() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);
}

function createFileHandleAdapter(file) {
  return {
    name: file.name,
    kind: 'file',
    getFile: async () => file
  };
}

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
    for (let i = 0; i < iterations; i++) {
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
  const [runtimeMode] = useState(() => (isTauriRuntime() ? 'Tauri Desktop' : 'Web'));

  const [zoom, setZoom] = useState(50);
  const [trackHeight, setTrackHeight] = useState(64);
  const [selectedClipId, setSelectedClipId] = useState(null);
  const [activeBottomTab, setActiveBottomTab] = useState('drum-rack');
  const [draggingClip, setDraggingClip] = useState(null);
  const [resizingClip, setResizingClip] = useState(null);

  // Tamaños ajustables de cajones (como en un DAW)
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(260);
  const [trackHeaderWidth, setTrackHeaderWidth] = useState(170);
  const [resizingPane, setResizingPane] = useState(null);

  const [loopEnabled, setLoopEnabled] = useState(false);
  const [loopStartBeats, setLoopStartBeats] = useState(0);
  const [loopEndBeats, setLoopEndBeats] = useState(8);

  const [tracks, setTracks] = useState([
    { id: 1, name: 'Pista 1: Drums', color: 'var(--track-color-1)', volume: 0.8, pan: 0, eqLow: 0, eqMid: 0, eqHigh: 0, delayTime: 0, muted: false, solo: false, clips: [] },
    { id: 2, name: 'Pista 2: Synth MIDI', color: 'var(--track-color-4)', volume: 0.7, pan: 0, eqLow: 0, eqMid: 0, eqHigh: 0, delayTime: 0, muted: false, solo: false, clips: [] }
  ]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [playheadPosition, setPlayheadPosition] = useState(0);
  const [metronomeActive, setMetronomeActive] = useState(false);

  const audioCtxRef = useRef(null);
  const timelineRef = useRef(null);
  const folderInputRef = useRef(null);
  const animationFrameRef = useRef(null);
  const paneRafRef = useRef(null);
  const activeSourcesRef = useRef([]);
  const metronomeTimerRef = useRef(null);
  const analysersRef = useRef(dawEngine.getAnalysersRef());

  const previewAudioRef = useRef(null);
  const draggedItemRef = useRef(null);

  const playStartPositionRef = useRef(0);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

  const metronomeActiveRef = useRef(metronomeActive);
  metronomeActiveRef.current = metronomeActive;

  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;

  const loopEnabledRef = useRef(loopEnabled);
  loopEnabledRef.current = loopEnabled;

  const loopStartBeatsRef = useRef(loopStartBeats);
  loopStartBeatsRef.current = loopStartBeats;

  const loopEndBeatsRef = useRef(loopEndBeats);
  loopEndBeatsRef.current = loopEndBeats;

  const selectedClipEntry = useMemo(() => {
    for (const track of tracks) {
      const found = (track.clips || []).find((c) => c.id === selectedClipId);
      if (found) {
        return { trackId: track.id, clip: found };
      }
    }
    return null;
  }, [tracks, selectedClipId]);

  const handleUpdateSelectedClipNotes = (nextNotes) => {
    if (!selectedClipEntry) return;
    setTracks((prevTracks) =>
      prevTracks.map((t) => {
        if (t.id !== selectedClipEntry.trackId) return t;
        return {
          ...t,
          clips: t.clips.map((c) =>
            c.id === selectedClipEntry.clip.id ? { ...c, notes: nextNotes } : c
          )
        };
      })
    );
  };

  useEffect(() => {
    if (!resizingPane) return;

    const prevSelect = document.body.style.userSelect;
    const prevCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = resizingPane.type === 'bottom' ? 'row-resize' : 'col-resize';

    const handleMouseMove = (e) => {
      if (paneRafRef.current) cancelAnimationFrame(paneRafRef.current);

      paneRafRef.current = requestAnimationFrame(() => {
        if (resizingPane.type === 'sidebar') {
          const dx = e.clientX - resizingPane.startX;
          const nextW = Math.min(480, Math.max(185, resizingPane.startValue + dx));
          setSidebarWidth(nextW);
        } else if (resizingPane.type === 'bottom') {
          const dy = resizingPane.startY - e.clientY;
          const nextH = Math.min(480, Math.max(150, resizingPane.startValue + dy));
          setBottomPanelHeight(nextH);
        } else if (resizingPane.type === 'trackHeader') {
          const dx = e.clientX - resizingPane.startX;
          const nextTH = Math.min(300, Math.max(130, resizingPane.startValue + dx));
          setTrackHeaderWidth(nextTH);
        }
      });
    };

    const handleMouseUp = () => {
      if (paneRafRef.current) cancelAnimationFrame(paneRafRef.current);
      setResizingPane(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      if (paneRafRef.current) cancelAnimationFrame(paneRafRef.current);
      document.body.style.userSelect = prevSelect;
      document.body.style.cursor = prevCursor;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingPane]);

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
    if (!draggingClip) return;

    const handleMouseMove = (e) => {
      const deltaX = e.clientX - draggingClip.startX;
      const snapStep = Math.max(1, zoom / 2);
      const snappedDelta = Math.round(deltaX / snapStep) * snapStep;
      const nextStart = Math.max(0, draggingClip.initialStart + snappedDelta);

      setTracks((prevTracks) =>
        prevTracks.map((t) => {
          if (t.id !== draggingClip.trackId) return t;
          return {
            ...t,
            clips: t.clips.map((c) =>
              c.id === draggingClip.clipId ? { ...c, start: nextStart } : c
            )
          };
        })
      );
    };

    const handleMouseUp = () => {
      setDraggingClip(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingClip, zoom]);

  useEffect(() => {
    if (!resizingClip) return;

    const handleMouseMove = (e) => {
      const deltaX = e.clientX - resizingClip.startX;
      const snapStep = Math.max(1, zoom / 2);
      const minWidth = Math.max(12, zoom / 4);
      const nextWidth = Math.max(minWidth, Math.round((resizingClip.initialWidth + deltaX) / snapStep) * snapStep);

      setTracks((prevTracks) =>
        prevTracks.map((t) => {
          if (t.id !== resizingClip.trackId) return t;
          return {
            ...t,
            clips: t.clips.map((c) =>
              c.id === resizingClip.clipId ? { ...c, width: nextWidth } : c
            )
          };
        })
      );
    };

    const handleMouseUp = () => {
      setResizingClip(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingClip, zoom]);

  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = dawEngine.ctx || new (window.AudioContext || window.webkitAudioContext)();
      dawEngine.ctx = audioCtxRef.current;
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

  const playClickSound = (ctx) => {
    dawEngine.playClickSound(ctx);
  };

  const playSynthNote = (ctx, semitone, durationSec, track, analyser) => {
    dawEngine.playSynthNote(ctx, semitone, durationSec, track, analyser);
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (metronomeTimerRef.current) {
      clearInterval(metronomeTimerRef.current);
      metronomeTimerRef.current = null;
    }
    dawEngine.stopAll();
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

    if (metronomeActiveRef.current) {
      const intervalMs = (60 / bpmRef.current) * 1000;
      playClickSound(ctx);
      metronomeTimerRef.current = setInterval(() => {
        if (isPlayingRef.current) playClickSound(ctx);
      }, intervalMs);
    }

    dawEngine.schedulePlayback({
      ctx,
      tracks: tracksRef.current,
      startPx,
      zoom,
      bpm,
      isPlayingRef
    });

    return startTime;
  };

  const handlePlay = async () => {
    stopPreviewAudio();
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();

    if (isPlayingRef.current) {
      stopPlayback();
      setPlayheadPosition(playStartPositionRef.current);
    } else {
      setIsPlaying(true);
      playStartPositionRef.current = playheadPosition;

      const pxPerSec = zoom * (bpm / 60);
      let currentStartTime = startAudioPlayback(ctx, playheadPosition);

      const updatePlayhead = () => {
        if (!isPlayingRef.current) return;

        const elapsed = ctx.currentTime - currentStartTime;
        const currentPx = elapsed * pxPerSec;

        const loopStartPx = Math.max(0, loopStartBeatsRef.current) * zoom;
        const loopEndPx = Math.max(loopStartBeatsRef.current + 1, loopEndBeatsRef.current) * zoom;

        if (loopEnabledRef.current && currentPx >= loopEndPx) {
          setPlayheadPosition(loopStartPx);
          currentStartTime = startAudioPlayback(ctx, loopStartPx);
          animationFrameRef.current = requestAnimationFrame(updatePlayhead);
          return;
        }

        let maxTimelineEnd = 3000;
        tracksRef.current.forEach((t) => {
          t.clips.forEach((c) => {
            const cEnd = c.start + c.width;
            if (cEnd > maxTimelineEnd) maxTimelineEnd = cEnd;
          });
        });

        if (!loopEnabledRef.current && currentPx >= maxTimelineEnd) {
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
    setPlayheadPosition(0);
    playStartPositionRef.current = 0;
  };

  const handleInsertDemoMidiClip = () => {
    const beatPx = zoom;
    const demoClip = {
      id: Date.now(),
      name: 'Demo MIDI Synth',
      start: 0,
      width: beatPx * 4,
      clipOffset: 0,
      audioBuffer: null,
      notes: [
        { id: `demo-1-${Date.now()}`, semitone: 0, start: 0, duration: beatPx * 0.9 },
        { id: `demo-2-${Date.now()}`, semitone: 4, start: beatPx, duration: beatPx * 0.9 },
        { id: `demo-3-${Date.now()}`, semitone: 7, start: beatPx * 2, duration: beatPx * 0.9 },
        { id: `demo-4-${Date.now()}`, semitone: 12, start: beatPx * 3, duration: beatPx * 0.9 }
      ]
    };

    setTracks((prevTracks) =>
      prevTracks.map((t) =>
        t.id === 2 || t.name.toLowerCase().includes('synth')
          ? { ...t, clips: [...t.clips, demoClip] }
          : t
      )
    );
    setSelectedClipId(demoClip.id);
    setActiveBottomTab('piano-roll');
  };

  const handleSendDrumPattern = (drumClip) => {
    const newClip = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      name: drumClip.name || 'Drum Rack Groove',
      start: drumClip.start ?? 0,
      width: drumClip.width ?? zoom * 4,
      clipOffset: 0,
      audioBuffer: null,
      notes: drumClip.notes || []
    };

    setTracks((prevTracks) =>
      prevTracks.map((t, idx) =>
        t.id === 1 || idx === 0
          ? { ...t, clips: [...t.clips, newClip] }
          : t
      )
    );
    setSelectedClipId(newClip.id);
  };

  const triggerBlobDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.download = filename;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  };

  const handleSaveProject = () => {
    const projectData = {
      app: 'Bellaudio',
      runtime: runtimeMode,
      bpm,
      loopEnabled,
      loopStartBeats,
      loopEndBeats,
      layoutSizes: {
        sidebarWidth,
        bottomPanelHeight,
        trackHeaderWidth
      },
      tracks: tracks.map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
        volume: t.volume,
        pan: t.pan,
        eqLow: t.eqLow,
        eqMid: t.eqMid,
        eqHigh: t.eqHigh,
        delayTime: t.delayTime,
        muted: t.muted,
        solo: t.solo,
        clips: t.clips.map((c) => ({
          id: c.id,
          name: c.name,
          start: c.start,
          width: c.width,
          notes: c.notes || []
        }))
      }))
    };

    const jsonBlob = new Blob([JSON.stringify(projectData, null, 2)], {
      type: 'application/json;charset=utf-8'
    });
    triggerBlobDownload(jsonBlob, 'tfg_daw_proyecto.json');
  };

  const handleLoadProject = (e) => {
    const fileReader = new FileReader();
    if (e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], 'UTF-8');
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (parsed.bpm) setBpm(parsed.bpm);
          if (typeof parsed.loopEnabled === 'boolean') setLoopEnabled(parsed.loopEnabled);
          if (typeof parsed.loopStartBeats === 'number') setLoopStartBeats(parsed.loopStartBeats);
          if (typeof parsed.loopEndBeats === 'number') setLoopEndBeats(parsed.loopEndBeats);
          if (parsed.layoutSizes) {
            if (parsed.layoutSizes.sidebarWidth) setSidebarWidth(parsed.layoutSizes.sidebarWidth);
            if (parsed.layoutSizes.bottomPanelHeight) setBottomPanelHeight(parsed.layoutSizes.bottomPanelHeight);
            if (parsed.layoutSizes.trackHeaderWidth) setTrackHeaderWidth(parsed.layoutSizes.trackHeaderWidth);
          }
          if (parsed.tracks) setTracks(parsed.tracks);
          alert('¡Proyecto cargado con éxito! 📂✨');
        } catch (err) {
          alert('Error al leer el archivo JSON del proyecto.');
        }
      };
    }
  };

  const handleExportWav = async () => {
    try {
      const wavBlob = await dawEngine.renderMixToWavBlob(tracks, zoom, bpm);
      triggerBlobDownload(wavBlob, 'bellaudio_mix.wav');
    } catch (err) {
      console.error(err);
      alert('Error al exportar el archivo WAV.');
    }
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

            const newClip = {
              ...target,
              id: Date.now() + Math.floor(Math.random() * 1000),
              start: newStart,
              notes: (target.notes || []).map((n, idx) => ({
                ...n,
                id: n.id ? `${n.id}-dup-${idx}` : `note-dup-${Date.now()}-${idx}`
              }))
            };
            return { ...t, clips: [...t.clips, newClip] };
          })
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipId, bpm, zoom, tracks, playheadPosition]);

  const handleSetPlayhead = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left + timelineRef.current.scrollLeft;
    const snappedX = Math.round(clickX / (zoom / 2)) * (zoom / 2);

    if (isPlayingRef.current) stopPlayback();
    setPlayheadPosition(Math.max(0, snappedX));
    playStartPositionRef.current = Math.max(0, snappedX);
  };

  const loadFolderContents = async (dirHandle) => {
    try {
      if (Array.isArray(dirHandle?.items)) {
        setFolderItems(dirHandle.items);
        setCurrentFolderHandle(dirHandle);
        return;
      }

      const items = [];
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'directory') {
          items.push({ name: entry.name, kind: 'directory', handle: entry });
        } else if (entry.kind === 'file' && AUDIO_EXT_REGEX.test(entry.name)) {
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

  const handleFallbackFolderInputChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const firstRel = files[0].webkitRelativePath || '';
    const detectedName = firstRel.includes('/') ? firstRel.split('/')[0] : 'Carpeta Audio';

    const audioItems = files
      .filter((f) => AUDIO_EXT_REGEX.test(f.name))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((f) => ({
        name: f.name,
        kind: 'file',
        handle: createFileHandleAdapter(f)
      }));

    const virtualFolder = { name: detectedName, items: audioItems };
    setRootHandle(virtualFolder);
    setFolderName(detectedName);
    setFolderHistory([virtualFolder]);
    await loadFolderContents(virtualFolder);
    e.target.value = '';
  };

  const handleSelectFolder = async () => {
    try {
      if (!isTauriRuntime() && typeof window.showDirectoryPicker === 'function') {
        const dirHandle = await window.showDirectoryPicker();
        setRootHandle(dirHandle);
        setFolderName(dirHandle.name);
        setFolderHistory([dirHandle]);
        await loadFolderContents(dirHandle);
        return;
      }

      if (folderInputRef.current) {
        folderInputRef.current.click();
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error al seleccionar carpeta, usando selector de archivos:', err);
        if (folderInputRef.current) folderInputRef.current.click();
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
      return [
        ...prevTracks,
        { id: nextId, name: `Pista ${nextId}`, color, volume: 0.75, pan: 0, eqLow: 0, eqMid: 0, eqHigh: 0, delayTime: 0, muted: false, solo: false, clips: [] }
      ];
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
        clipOffset: 0,
        notes: []
      };

      setSelectedClipId(newClip.id);
      draggedItemRef.current = null;
      return prevTracks.map((t) => (t.id === trackId ? { ...t, clips: [...t.clips, newClip] } : t));
    });
  };

  const displayedItems = folderItems.filter((item) => item.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="daw-container" onClick={() => setSelectedClipId(null)}>
      <input
        ref={folderInputRef}
        type="file"
        webkitdirectory="true"
        directory=""
        multiple
        onChange={handleFallbackFolderInputChange}
        style={{ display: 'none' }}
      />

      <header className="daw-header">
        <div className="transport-controls">
          <button className={`btn-transport ${isPlaying ? 'active-play' : ''}`} onClick={handlePlay}>
            {isPlaying ? 'PAUSE' : 'PLAY'}
          </button>
          <button className="btn-transport" onClick={handleStop}>STOP</button>

          <button
            className={`btn-transport ${loopEnabled ? 'active-play' : ''}`}
            onClick={() => setLoopEnabled(!loopEnabled)}
            style={{ fontSize: '11px', background: loopEnabled ? '#7e22ce' : '#27272a' }}
          >
            🔁 Loop {loopEnabled ? 'ON' : 'OFF'}
          </button>

          <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Ini:
            <input
              type="number"
              min={0}
              max={loopEndBeats - 1}
              value={loopStartBeats}
              onChange={(e) => setLoopStartBeats(Math.max(0, Number(e.target.value) || 0))}
              style={{ width: '44px' }}
            />
          </label>

          <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Fin:
            <input
              type="number"
              min={loopStartBeats + 1}
              max={64}
              value={loopEndBeats}
              onChange={(e) => setLoopEndBeats(Math.max(loopStartBeats + 1, Number(e.target.value) || 8))}
              style={{ width: '44px' }}
            />
          </label>

          <button
            className={`btn-transport ${metronomeActive ? 'active-play' : ''}`}
            onClick={() => setMetronomeActive(!metronomeActive)}
            style={{ fontSize: '11px', background: metronomeActive ? '#9333ea' : '#27272a' }}
          >
            🔊 Click {metronomeActive ? 'ON' : 'OFF'}
          </button>

          <div className="bpm-selector">
            <span>BPM</span>
            <input type="number" value={bpm} onChange={(e) => setBpm(Number(e.target.value) || 120)} />
          </div>
        </div>

        <div className="project-title" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span>Proyecto: TFG_Track_01</span>
          <button onClick={handleSaveProject} style={{ background: '#27272a', color: '#c084fc', border: '1px solid #7c3aed', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontSize: '11px' }}>💾 Guardar JSON</button>
          <label style={{ background: '#27272a', color: '#c084fc', border: '1px solid #7c3aed', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontSize: '11px' }}>
            📂 Cargar JSON
            <input type="file" accept=".json" onChange={handleLoadProject} style={{ display: 'none' }} />
          </label>
          <button onClick={handleExportWav} style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontSize: '11px' }}>💽 Exportar WAV</button>
        </div>

        <div className="presence-badge">
          <span>🟢 {runtimeMode} · 2 usuarios conectados</span>
        </div>
      </header>

      <main className="daw-body" style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <aside
          className="daw-sidebar"
          onClick={(e) => e.stopPropagation()}
          style={{
            width: `${sidebarWidth}px`,
            minWidth: `${sidebarWidth}px`,
            maxWidth: `${sidebarWidth}px`,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            transition: resizingPane?.type === 'sidebar' ? 'none' : 'box-shadow 140ms ease'
          }}
        >
          <h3>Biblioteca Local</h3>
          <button className="btn-select-folder" onClick={handleSelectFolder}>
            📂 {folderName ? folderName : 'Seleccionar Carpeta / Pendrive'}
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

          <div className="file-list-container" style={{ flex: 1, overflowY: 'auto' }}>
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

        <div
          onMouseDown={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            setResizingPane({
              type: 'sidebar',
              startX: e.clientX,
              startValue: sidebarWidth
            });
          }}
          title="Arrastra para redimensionar Biblioteca"
          style={{
            width: '5px',
            cursor: 'col-resize',
            background: resizingPane?.type === 'sidebar' ? '#c084fc' : 'rgba(168, 85, 247, 0.22)',
            transition: 'background 140ms ease',
            flexShrink: 0,
            zIndex: 25
          }}
        />

        <section
          className="daw-timeline"
          ref={timelineRef}
          onClick={(e) => e.stopPropagation()}
          style={{ flex: 1, minWidth: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}
        >
          <div className="timeline-toolbar">
            <button className="btn-add-track" onClick={handleAddTrack}>+ Añadir Pista</button>
            <button className="btn-add-track" onClick={handleInsertDemoMidiClip}>+ Demo MIDI</button>
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
                <div
                  className="track-header"
                  style={{
                    borderLeftColor: track.color,
                    width: `${trackHeaderWidth}px`,
                    minWidth: `${trackHeaderWidth}px`,
                    position: 'relative'
                  }}
                >
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

                  <div
                    onMouseDown={(e) => {
                      if (e.button !== 0) return;
                      e.stopPropagation();
                      setResizingPane({
                        type: 'trackHeader',
                        startX: e.clientX,
                        startValue: trackHeaderWidth
                      });
                    }}
                    title="Arrastra para ajustar ancho de pistas"
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: '4px',
                      height: '100%',
                      cursor: 'col-resize',
                      background: resizingPane?.type === 'trackHeader' ? '#c084fc' : 'transparent'
                    }}
                  />
                </div>

                <div
                  className={`track-lane ${track.muted ? 'is-muted' : ''}`}
                  style={{
                    backgroundSize: `${zoom}px 100%`,
                    width: '3000px',
                    backgroundImage: 'linear-gradient(90deg, rgba(255, 255, 255, 0.22) 1px, transparent 1px)'
                  }}
                  onClick={handleSetPlayhead}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                  onDrop={(e) => handleDropToTrack(e, track.id)}
                >
                  <div className="track-playhead" style={{ left: `${playheadPosition}px`, display: playheadPosition >= 0 ? 'block' : 'none' }} />

                  {track.clips.map((clip) => (
                    <div
                      key={clip.id}
                      className={`timeline-clip ${selectedClipId === clip.id ? 'selected' : ''}`}
                      style={{
                        left: `${clip.start}px`,
                        width: `${clip.width}px`,
                        transition: draggingClip?.clipId === clip.id || resizingClip?.clipId === clip.id ? 'none' : 'box-shadow 120ms ease, border-color 120ms ease'
                      }}
                      onMouseDown={(e) => {
                        if (e.button !== 0) return;
                        e.stopPropagation();
                        setSelectedClipId(clip.id);
                        setDraggingClip({
                          trackId: track.id,
                          clipId: clip.id,
                          startX: e.clientX,
                          initialStart: clip.start
                        });
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedClipId(clip.id);
                        const laneEl = e.currentTarget.closest('.track-lane');
                        if (laneEl && timelineRef.current) {
                          const rect = laneEl.getBoundingClientRect();
                          const clickX = e.clientX - rect.left + timelineRef.current.scrollLeft;
                          const snappedX = Math.round(clickX / (zoom / 2)) * (zoom / 2);
                          if (isPlayingRef.current) stopPlayback();
                          setPlayheadPosition(Math.max(0, snappedX));
                          playStartPositionRef.current = Math.max(0, snappedX);
                        }
                      }}
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
                      <div
                        onMouseDown={(e) => {
                          if (e.button !== 0) return;
                          e.stopPropagation();
                          setSelectedClipId(clip.id);
                          setResizingClip({
                            trackId: track.id,
                            clipId: clip.id,
                            startX: e.clientX,
                            initialWidth: clip.width
                          });
                        }}
                        style={{
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          width: '8px',
                          height: '100%',
                          cursor: 'ew-resize',
                          background: 'rgba(233, 213, 255, 0.22)'
                        }}
                      />
                    </div>
                  ))}
                </div>
              </React.Fragment>
            ))}
          </div>
        </section>
      </main>

      <div
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          setResizingPane({
            type: 'bottom',
            startY: e.clientY,
            startValue: bottomPanelHeight
          });
        }}
        title="Arrastra para ajustar altura del panel inferior"
        style={{
          height: '5px',
          cursor: 'row-resize',
          background: resizingPane?.type === 'bottom' ? '#c084fc' : 'rgba(168, 85, 247, 0.25)',
          transition: 'background 140ms ease',
          flexShrink: 0,
          zIndex: 25
        }}
      />

      <footer
        className="daw-bottom-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: `${bottomPanelHeight}px`,
          minHeight: `${bottomPanelHeight}px`,
          background: 'var(--bg-panel)',
          boxSizing: 'border-box',
          overflow: 'hidden'
        }}
      >
        <div className="panel-tabs" style={{ display: 'flex', gap: '4px', padding: '6px 12px', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
          <button
            className={activeBottomTab === 'drum-rack' ? 'active' : ''}
            onClick={() => setActiveBottomTab('drum-rack')}
            style={{ padding: '6px 14px', background: activeBottomTab === 'drum-rack' ? 'var(--accent-purple)' : 'transparent', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', transition: 'background 140ms ease' }}
          >
            Drum Rack (Pads)
          </button>
          <button
            className={activeBottomTab === 'piano-roll' ? 'active' : ''}
            onClick={() => setActiveBottomTab('piano-roll')}
            style={{ padding: '6px 14px', background: activeBottomTab === 'piano-roll' ? 'var(--accent-purple)' : 'transparent', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', transition: 'background 140ms ease' }}
          >
            Rollo de piano {selectedClipEntry ? `· ${selectedClipEntry.clip.name}` : ''}
          </button>
          <button
            className={activeBottomTab === 'mixer' ? 'active' : ''}
            onClick={() => setActiveBottomTab('mixer')}
            style={{ padding: '6px 14px', background: activeBottomTab === 'mixer' ? 'var(--accent-purple)' : 'transparent', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', transition: 'background 140ms ease' }}
          >
            Mezclador Pro & FX
          </button>
        </div>

        <div className="panel-content" style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {activeBottomTab === 'drum-rack' && (
            <DrumRack
              audioFiles={folderItems.filter((i) => i.kind === 'file').map((f) => f.handle)}
              getAudioContext={getAudioContext}
              zoom={zoom}
              onSendDrumPattern={handleSendDrumPattern}
            />
          )}
          {activeBottomTab === 'piano-roll' && (
            <PianoRoll
              audioFiles={folderItems.filter((i) => i.kind === 'file').map((f) => f.handle)}
              getAudioContext={getAudioContext}
              isPlaying={isPlaying}
              bpm={bpm}
              playheadPosition={playheadPosition}
              zoom={zoom}
              notes={selectedClipEntry ? selectedClipEntry.clip.notes || [] : []}
              onChangeNotes={handleUpdateSelectedClipNotes}
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
                        audioBuffer: null
                      };
                      setSelectedClipId(newClip.id);
                      return { ...t, clips: [...t.clips.filter((c) => c.name !== midiClip.name), newClip] };
                    }
                    return t;
                  })
                );
                alert('¡Clip MIDI enviado a la Pista 2! 🎹');
              }}
            />
          )}
          {activeBottomTab === 'mixer' && (
            <Mixer tracks={tracks} onUpdateTrack={updateTrack} analysersRef={analysersRef} />
          )}
        </div>
      </footer>
    </div>
  );
};