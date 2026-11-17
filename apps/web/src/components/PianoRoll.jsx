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
  'KeyA': 0, 'KeyW': 1, 'KeyS': 2, 'KeyE': 3, 'KeyD': 4,
  'KeyF': 5, 'KeyT': 6, 'KeyG': 7, 'KeyY': 8, 'KeyH': 9,
  'KeyU': 10, 'KeyJ': 11, 'KeyK': 12,
};

const TOTAL_STEPS = 96; // Ampliado a 96 pasos para mayor recorrido

export const PianoRoll = ({
  audioFiles = [],
  getAudioContext,
  isPlaying = false,
  bpm = 120,
  playheadPosition = 0,
  zoom = 50,
  onUpdatePlayhead,
  onExportMidiClip,
}) => {
  const [notes, setNotes] = useState([]);
  const [loadedBuffer, setLoadedBuffer] = useState(null);
  const [activeSemitones, setActiveSemitones] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [internalStep, setInternalStep] = useState(0);

  const activeNodesRef = useRef({});
  const recordingNotesRef = useRef({});
  const fallbackCtxRef = useRef(null);
  const lastTriggeredStepRef = useRef(-1);

  const stepWidth = Math.max(10, zoom / 4);
  const currentStep = isPlaying 
    ? Math.floor(playheadPosition / stepWidth) % TOTAL_STEPS 
    : internalStep;

  const currentStepRef = useRef(currentStep);
  currentStepRef.current = currentStep;

  const isRecordingRef = useRef(isRecording);
  isRecordingRef.current = isRecording;

  useEffect(() => {
    if (isPlaying || !isRecording) return;
    const stepMs = (60 / bpm / 4) * 1000;
    const timer = setInterval(() => {
      setInternalStep((prev) => (prev + 1) % TOTAL_STEPS);
    }, stepMs);
    return () => clearInterval(timer);
  }, [isPlaying, isRecording, bpm]);

  useEffect(() => {
    if (!isPlaying) {
      lastTriggeredStepRef.current = -1;
      return;
    }

    if (currentStep !== lastTriggeredStepRef.current) {
      lastTriggeredStepRef.current = currentStep;
      notes.forEach((note) => {
        const noteStartStep = Math.round(note.start / stepWidth);
        if (noteStartStep === currentStep) {
          playNoteAudio(note.semitone);
          const noteDurationSteps = Math.max(1, Math.round(note.duration / stepWidth));
          const durationMs = (60 / bpm / 4) * 1000 * noteDurationSteps;
          setTimeout(() => stopNoteAudio(note.semitone), durationMs);
        }
      });
    }
  }, [currentStep, isPlaying, notes, bpm, stepWidth]);

  const resolveAudioContext = () => {
    let ctx = typeof getAudioContext === 'function' ? getAudioContext() : null;
    if (!ctx) {
      if (!fallbackCtxRef.current) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        fallbackCtxRef.current = new AudioCtx();
      }
      ctx = fallbackCtxRef.current;
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  };

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

  const stopNoteAudio = (semitone) => {
    setActiveSemitones((prev) => prev.filter((s) => s !== semitone));

    const recNote = recordingNotesRef.current[semitone];
    if (recNote) {
      const endStep = currentStepRef.current;
      const stepSpan = endStep >= recNote.startStep ? Math.max(1, endStep - recNote.startStep + 1) : 1;
      const finalDuration = stepSpan * stepWidth;
      setNotes((prev) => prev.map((n) => (n.id === recNote.id ? { ...n, duration: finalDuration } : n)));
      delete recordingNotesRef.current[semitone];
    }

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

  const playNoteAudio = (semitone) => {
    setActiveSemitones((prev) => (prev.includes(semitone) ? prev : [...prev, semitone]));
    const ctx = resolveAudioContext();
    if (!ctx) return;

    if (activeNodesRef.current[semitone]) stopNoteAudio(semitone);

    if (isRecordingRef.current) {
      const pitchObj = PITCHES.find((p) => p.semitone === semitone);
      if (pitchObj) {
        const startStep = currentStepRef.current;
        const startPx = startStep * stepWidth;
        const noteId = Date.now() + Math.random();
        recordingNotesRef.current[semitone] = { id: noteId, startStep };

        setNotes((prev) => [
          ...prev.filter((n) => !(n.pitch === pitchObj.name && n.start === startPx)),
          { id: noteId, pitch: pitchObj.name, start: startPx, duration: stepWidth, semitone },
        ]);
      }
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
  }, [loadedBuffer, zoom]);

  const handleGridClick = (pitch, stepIndex, semitone) => {
    const startPx = stepIndex * stepWidth;
    const exists = notes.some(n => n.pitch === pitch && n.start === startPx);
    if (!exists) {
      const newNote = { id: Date.now() + Math.random(), pitch, start: startPx, duration: stepWidth, semitone };
      setNotes([...notes, newNote]);
      playNoteAudio(semitone);
      setTimeout(() => stopNoteAudio(semitone), 200);
    }
  };

  const handleDeleteNote = (e, noteId) => {
    e.stopPropagation();
    setNotes(notes.filter(n => n.id !== noteId));
  };

  // Clic en la regla del Piano Roll para mover el cabezal
  const handleTimelineClick = (e) => {
    if (typeof onUpdatePlayhead !== 'function') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newPos = Math.max(0, Math.round(clickX / stepWidth) * stepWidth);
    onUpdatePlayhead(newPos);
  };

  return (
    <div className="piano-roll-wrapper">
      <div className="piano-toolbar">
        <button
          type="button"
          onClick={() => { setInternalStep(0); setIsRecording((prev) => !prev); }}
          style={{
            backgroundColor: isRecording ? '#9333ea' : '#27272a',
            color: '#ffffff',
            border: isRecording ? '1px solid #c084fc' : '1px solid #3f3f46',
            borderRadius: '6px', padding: '4px 12px', fontWeight: 'bold', cursor: 'pointer',
            boxShadow: isRecording ? '0 0 12px rgba(168, 85, 247, 0.7)' : 'none',
          }}
        >
          {isRecording ? '● REC (Grabando)' : '● REC'}
        </button>

        <button
          type="button"
          onClick={() => {
            if (onExportMidiClip && notes.length > 0) {
              const maxPx = Math.max(...notes.map(n => n.start + n.duration), stepWidth * 16);
              onExportMidiClip({ name: 'Synth Melody', notes, width: maxPx, start: 0 });
            }
          }}
          style={{
            backgroundColor: '#6b21a8', color: '#fff', border: '1px solid #a855f7',
            borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontWeight: 'bold'
          }}
        >
          📤 Enviar a Pista 2
        </button>

        <button
          type="button"
          onClick={() => setNotes([])}
          style={{ backgroundColor: '#27272a', color: '#d4d4d8', border: '1px solid #3f3f46', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}
        >
          Limpiar
        </button>

        <span className="piano-tool-label">Instrumento:</span>
        <select className="piano-sample-select" onChange={handleSelectInstrument} defaultValue="">
          <option value="" disabled>-- Sin sample (Sintetizador) --</option>
          {audioFiles.map((file, idx) => (
            <option key={idx} value={file.name}>{file.name}</option>
          ))}
        </select>
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
                style={isActive ? { backgroundColor: '#8b5cf6', color: '#ffffff', boxShadow: 'inset 0 0 10px rgba(139, 92, 246, 0.9)' } : undefined}
              >
                {p.name}
              </div>
            );
          })}
        </div>
        <div className="piano-grid-area" style={{ position: 'relative', width: `${TOTAL_STEPS * stepWidth}px` }}>
          {/* Cabezal interactivo */}
          <div 
            onClick={handleTimelineClick}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '16px', background: '#18181b', borderBottom: '1px solid #3f3f46', cursor: 'pointer', zIndex: 5 }}
            title="Haz clic para colocar el cabezal"
          >
            {(isPlaying || isRecording) && (
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${currentStep * stepWidth}px`, width: '2px', backgroundColor: '#a855f7', boxShadow: '0 0 8px #a855f7', zIndex: 11 }} />
            )}
          </div>

          {PITCHES.map((p, rowIdx) => (
            <div key={rowIdx} className="piano-row" style={{ display: 'flex' }}>
              {Array.from({ length: TOTAL_STEPS }).map((_, stepIdx) => (
                <div
                  key={stepIdx}
                  className="piano-cell"
                  style={{ width: `${stepWidth}px`, minWidth: `${stepWidth}px`, height: '30px' }}
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
                  top: `${topIndex * 30 + 18}px`,
                  left: `${note.start}px`,
                  width: `${note.duration - 2}px`,
                  position: 'absolute',
                  height: '26px',
                  background: '#a855f7',
                  borderRadius: '4px',
                  border: '1px solid #c084fc',
                  color: '#fff',
                  fontSize: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: '4px',
                  cursor: 'pointer',
                  zIndex: 8,
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