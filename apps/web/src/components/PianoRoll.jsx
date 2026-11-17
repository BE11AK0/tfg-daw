import React, { useState, useRef, useEffect } from 'react';
import './PianoRoll.css';

const PITCHES = [
  { name: 'C5', semitone: 12 },
  { name: 'B4', semitone: 11 },
  { name: 'A#4', semitone: 10 },
  { name: 'A4', semitone: 9 },
  { name: 'G#4', semitone: 8 },
  { name: 'G4', semitone: 7 },
  { name: 'F#4', semitone: 6 },
  { name: 'F4', semitone: 5 },
  { name: 'E4', semitone: 4 },
  { name: 'D#4', semitone: 3 },
  { name: 'D4', semitone: 2 },
  { name: 'C#4', semitone: 1 },
  { name: 'C4', semitone: 0 }
];

const KEY_MAP = {
  'KeyA': 0,
  'KeyW': 1,
  'KeyS': 2,
  'KeyE': 3,
  'KeyD': 4,
  'KeyF': 5,
  'KeyT': 6,
  'KeyG': 7,
  'KeyY': 8,
  'KeyH': 9,
  'KeyU': 10,
  'KeyJ': 11,
  'KeyK': 12,
};

export const PianoRoll = ({ audioFiles = [], getAudioContext }) => {
  const [notes, setNotes] = useState([]);
  const [loadedBuffer, setLoadedBuffer] = useState(null);
  const [activeSemitones, setActiveSemitones] = useState([]);

  const activeNodesRef = useRef({});
  const fallbackCtxRef = useRef(null);

  const resolveAudioContext = () => {
    let ctx = typeof getAudioContext === 'function' ? getAudioContext() : null;
    if (!ctx) {
      if (!fallbackCtxRef.current) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        fallbackCtxRef.current = new AudioCtx();
      }
      ctx = fallbackCtxRef.current;
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
    }
    return ctx;
  };

  // Cargar sample personalizado
  const handleSelectInstrument = async (e) => {
    const fileName = e.target.value;
    const fileItem = audioFiles.find(f => f.name === fileName);
    if (!fileItem) return;

    try {
      const file = await fileItem.getFile();
      const arrayBuffer = await file.arrayBuffer();
      const ctx = resolveAudioContext();
      const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
      setLoadedBuffer(decodedBuffer);
    } catch (err) {
      console.error('Error al cargar instrumento:', err);
    }
  };

  // Parar nota (Note-Off con fundido de 50ms)
  const stopNoteAudio = (semitone) => {
    setActiveSemitones((prev) => prev.filter((s) => s !== semitone));

    const active = activeNodesRef.current[semitone];
    if (!active) return;

    const ctx = resolveAudioContext();
    const { type, source, osc, gainNode } = active;

    try {
      gainNode.gain.setValueAtTime(gainNode.gain.value, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.05);

      if (type === 'buffer' && source) source.stop(ctx.currentTime + 0.05);
      if (type === 'osc' && osc) osc.stop(ctx.currentTime + 0.05);
    } catch (e) {}

    delete activeNodesRef.current[semitone];
  };

  // Disparar nota (Note-On)
  const playNoteAudio = (semitone) => {
    setActiveSemitones((prev) => (prev.includes(semitone) ? prev : [...prev, semitone]));

    const ctx = resolveAudioContext();
    if (!ctx) return;

    if (activeNodesRef.current[semitone]) {
      stopNoteAudio(semitone);
    }

    if (loadedBuffer) {
      const source = ctx.createBufferSource();
      source.buffer = loadedBuffer;
      source.playbackRate.value = Math.pow(2, semitone / 12);

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(1.0, ctx.currentTime);

      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      source.start(0);
      activeNodesRef.current[semitone] = { type: 'buffer', source, gainNode };
    } else {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      const freq = 261.63 * Math.pow(2, semitone / 12);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.2, ctx.currentTime);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(0);
      activeNodesRef.current[semitone] = { type: 'osc', osc, gainNode };
    }
  };

  // Eventos de teclado del ordenador
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.repeat) return;
      const semitone = KEY_MAP[e.code];
      if (semitone !== undefined) {
        e.preventDefault();
        playNoteAudio(semitone);
      }
    };

    const handleKeyUp = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      const semitone = KEY_MAP[e.code];
      if (semitone !== undefined) {
        e.preventDefault();
        stopNoteAudio(semitone);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [loadedBuffer]);

  const handleGridClick = (pitch, stepIndex, semitone) => {
    const exists = notes.some(n => n.pitch === pitch && n.start === stepIndex * 40);
    if (!exists) {
      const newNote = { id: Date.now() + Math.random(), pitch, start: stepIndex * 40, duration: 40, semitone };
      setNotes([...notes, newNote]);
      playNoteAudio(semitone);
      setTimeout(() => stopNoteAudio(semitone), 200);
    }
  };

  const handleDeleteNote = (e, noteId) => {
    e.stopPropagation();
    setNotes(notes.filter(n => n.id !== noteId));
  };

  return (
    <div className="piano-roll-wrapper">
      <div className="piano-toolbar">
        <span className="piano-tool-label">Instrumento:</span>
        <select className="piano-sample-select" onChange={handleSelectInstrument} defaultValue="">
          <option value="" disabled>-- Sin sample (Usa sintetizador) --</option>
          {audioFiles.map((file, idx) => (
            <option key={idx} value={file.name}>{file.name}</option>
          ))}
        </select>
        <span className="piano-hint">🎹 Toca con A, W, S, E, D, F... Clic en una nota para borrarla</span>
      </div>

      <div className="piano-roll-container">
        <div className="piano-keys">
          {PITCHES.map((p, idx) => {
            const isSharp = p.name.includes('#');
            const isActive = activeSemitones.includes(p.semitone);
            return (
              <div
                key={idx}
                className={`piano-key ${isSharp ? 'sharp' : ''} ${isActive ? 'active' : ''}`}
                onMouseDown={() => playNoteAudio(p.semitone)}
                onMouseUp={() => stopNoteAudio(p.semitone)}
                onMouseLeave={() => stopNoteAudio(p.semitone)}
                style={
                  isActive
                    ? {
                        backgroundColor: '#8b5cf6',
                        color: '#ffffff',
                        boxShadow: 'inset 0 0 10px rgba(139, 92, 246, 0.9)',
                      }
                    : undefined
                }
              >
                {p.name}
              </div>
            );
          })}
        </div>
        <div className="piano-grid-area">
          {PITCHES.map((p, rowIdx) => (
            <div key={rowIdx} className="piano-row">
              {Array.from({ length: 48 }).map((_, stepIdx) => (
                <div
                  key={stepIdx}
                  className="piano-cell"
                  onClick={() => handleGridClick(p.name, stepIdx, p.semitone)}
                />
              ))}
            </div>
          ))}
          {notes.map((note) => {
            const topIndex = PITCHES.findIndex(p => p.name === note.pitch);
            return (
              <div
                key={note.id}
                className="midi-note"
                title="Haz clic para eliminar nota"
                onClick={(e) => handleDeleteNote(e, note.id)}
                style={{
                  top: `${topIndex * 30 + 2}px`,
                  left: `${note.start}px`,
                  width: `${note.duration - 2}px`,
                }}
              >
                <span>{note.pitch}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};