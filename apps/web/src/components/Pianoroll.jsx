import React, { useState, useRef, useEffect } from 'react';
import './PianoRoll.css';

export const PianoRoll = ({ audioFiles = [], getAudioContext }) => {
  const [notes, setNotes] = useState([]);
  const [loadedBuffer, setLoadedBuffer] = useState(null);

  const pitches = [
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

  // Mapeo de teclas del PC a semitonos desde C4
  const keyMap = {
    'KeyA': { semitone: 0 },
    'KeyW': { semitone: 1 },
    'KeyS': { semitone: 2 },
    'KeyE': { semitone: 3 },
    'KeyD': { semitone: 4 },
    'KeyF': { semitone: 5 },
    'KeyT': { semitone: 6 },
    'KeyG': { semitone: 7 },
    'KeyY': { semitone: 8 },
    'KeyH': { semitone: 9 },
    'KeyU': { semitone: 10 },
    'KeyJ': { semitone: 11 },
    'KeyK': { semitone: 12 },
  };

  const activeNodesRef = useRef({});

  // Cargar sample personalizado
  const handleSelectInstrument = async (e) => {
    const fileName = e.target.value;
    const fileItem = audioFiles.find(f => f.name === fileName);
    if (!fileItem) return;

    try {
      const file = await fileItem.getFile();
      const arrayBuffer = await file.arrayBuffer();
      const ctx = getAudioContext();
      const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
      setLoadedBuffer(decodedBuffer);
    } catch (err) {
      console.error('Error al cargar instrumento:', err);
    }
  };

  // Disparar nota (Note-On)
  const playNoteAudio = (semitone) => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

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
      // Sintetizador por defecto si no hay sample seleccionado
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

  // Parar nota (Note-Off con fundido de 50ms)
  const stopNoteAudio = (semitone) => {
    const active = activeNodesRef.current[semitone];
    if (!active) return;

    const ctx = getAudioContext();
    const { type, source, osc, gainNode } = active;

    try {
      gainNode.gain.setValueAtTime(gainNode.gain.value, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      
      if (type === 'buffer' && source) source.stop(ctx.currentTime + 0.05);
      if (type === 'osc' && osc) osc.stop(ctx.currentTime + 0.05);
    } catch (e) {}

    delete activeNodesRef.current[semitone];
  };

  // Eventos de teclado del ordenador
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.repeat) return;
      const mapped = keyMap[e.code];
      if (mapped !== undefined) {
        e.preventDefault();
        playNoteAudio(mapped.semitone);
      }
    };

    const handleKeyUp = (e) => {
      if (e.target.tagName === 'INPUT') return;
      const mapped = keyMap[e.code];
      if (mapped !== undefined) {
        e.preventDefault();
        stopNoteAudio(mapped.semitone);
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
          {pitches.map((p, idx) => (
            <div key={idx} className={`piano-key ${p.name.includes('#') ? 'sharp' : ''}`}>
              {p.name}
            </div>
          ))}
        </div>
        <div className="piano-grid-area">
          {pitches.map((p, rowIdx) => (
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
            const topIndex = pitches.findIndex(p => p.name === note.pitch);
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