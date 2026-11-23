import React, { useMemo, useRef, useState, useEffect } from 'react';
import { dawEngine } from '../audio/dawEngine';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MIN_SEMITONE = -12; // C3
const MAX_SEMITONE = 24;  // C6

function semitoneToLabel(semitone) {
  const midi = 60 + semitone;
  const name = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

function isBlackSemitone(semitone) {
  const midi = 60 + semitone;
  return [1, 3, 6, 8, 10].includes(midi % 12);
}

export const PianoRoll = ({
  bpm = 120,
  zoom = 50,
  playheadPosition = 0,
  onUpdatePlayhead,
  onExportMidiClip,
  totalBeats = 16,
  stepBeats = 0.25,
  rowHeight = 20
}) => {
  const gridRef = useRef(null);
  const [notes, setNotes] = useState([]);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [dragState, setDragState] = useState(null);

  const pixelsPerBeat = zoom;
  const stepPx = Math.max(4, stepBeats * pixelsPerBeat);

  const semitones = useMemo(() => {
    const list = [];
    for (let s = MAX_SEMITONE; s >= MIN_SEMITONE; s--) {
      list.push(s);
    }
    return list;
  }, []);

  const snapPx = (px) => {
    const maxPx = totalBeats * pixelsPerBeat;
    const snapped = Math.round(px / stepPx) * stepPx;
    return Math.max(0, Math.min(maxPx - stepPx, snapped));
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNoteId) {
        e.preventDefault();
        setNotes((prev) => prev.filter((n) => n.id !== selectedNoteId));
        setSelectedNoteId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNoteId]);

  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e) => {
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      const deltaRows = Math.round(dy / rowHeight);
      const maxPx = totalBeats * pixelsPerBeat;

      if (dragState.mode === 'move') {
        const nextStart = snapPx(dragState.initialStart + dx);
        const nextSemitone = Math.max(
          MIN_SEMITONE,
          Math.min(MAX_SEMITONE, dragState.initialSemitone - deltaRows)
        );

        setNotes((prev) =>
          prev.map((n) =>
            n.id === dragState.noteId
              ? {
                  ...n,
                  start: Math.min(nextStart, maxPx - n.duration),
                  semitone: nextSemitone
                }
              : n
          )
        );
      } else if (dragState.mode === 'resize') {
        const rawDur = dragState.initialDuration + dx;
        const snappedDur = Math.max(stepPx, Math.round(rawDur / stepPx) * stepPx);

        setNotes((prev) =>
          prev.map((n) =>
            n.id === dragState.noteId
              ? {
                  ...n,
                  duration: Math.min(snappedDur, maxPx - n.start)
                }
              : n
          )
        );
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, pixelsPerBeat, rowHeight, stepPx, totalBeats]);

  const handleGridMouseDown = (e) => {
    if (e.button !== 0 || !gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const rowIndex = Math.floor(y / rowHeight);
    const semitone = semitones[rowIndex];
    if (semitone === undefined) return;

    const startPx = snapPx(x);
    const existing = notes.find(
      (n) =>
        n.semitone === semitone &&
        startPx >= n.start &&
        startPx < n.start + n.duration
    );

    if (existing) {
      setSelectedNoteId(existing.id);
      dawEngine.previewSemitone(existing.semitone, 0.25);
      setDragState({
        mode: 'move',
        noteId: existing.id,
        startX: e.clientX,
        startY: e.clientY,
        initialStart: existing.start,
        initialSemitone: existing.semitone
      });
      return;
    }

    const newNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      semitone,
      start: startPx,
      duration: Math.max(stepPx, pixelsPerBeat * 0.5)
    };

    dawEngine.previewSemitone(newNote.semitone, 0.25);
    setSelectedNoteId(newNote.id);
    setNotes((prev) => [...prev, newNote]);
    setDragState({
      mode: 'move',
      noteId: newNote.id,
      startX: e.clientX,
      startY: e.clientY,
      initialStart: newNote.start,
      initialSemitone: newNote.semitone
    });
  };

  const handleNoteContextMenu = (e, noteId) => {
    e.preventDefault();
    e.stopPropagation();
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    if (selectedNoteId === noteId) setSelectedNoteId(null);
  };

  const handleSendToTrack = () => {
    if (!onExportMidiClip || notes.length === 0) return;
    const maxEnd = notes.reduce((acc, n) => Math.max(acc, n.start + n.duration), pixelsPerBeat * 4);
    onExportMidiClip({
      name: 'Patrón Piano Roll',
      start: 0,
      width: Math.max(pixelsPerBeat * 2, maxEnd),
      notes: notes.map(({ semitone, start, duration }) => ({ semitone, start, duration }))
    });
  };

  const gridWidth = totalBeats * pixelsPerBeat;
  const gridHeight = semitones.length * rowHeight;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '4px 10px', borderBottom: '1px solid rgba(168, 85, 247, 0.2)', fontSize: '12px' }}>
        <button
          type="button"
          onClick={handleSendToTrack}
          style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Enviar a Pista 2
        </button>
        <button
          type="button"
          onClick={() => {
            setNotes([]);
            setSelectedNoteId(null);
          }}
          style={{ background: '#27272a', color: '#e9d5ff', border: '1px solid #7c3aed', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer' }}
        >
          Limpiar notas
        </button>
        {onUpdatePlayhead && (
          <button
            type="button"
            onClick={() => onUpdatePlayhead(0)}
            style={{ background: '#27272a', color: '#e9d5ff', border: '1px solid #7c3aed', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer' }}
          >
            Cursor a 0 ({bpm} BPM)
          </button>
        )}
        <span style={{ opacity: 0.75 }}>Clic: crear/mover · Borde derecho: alargar · Clic derecho / Supr: borrar</span>
      </div>

      <div className="piano-roll-container" style={{ display: 'flex', overflow: 'auto', flex: 1 }}>
        <div className="piano-keys" style={{ width: '64px', flexShrink: 0 }}>
          {semitones.map((semitone) => {
            const black = isBlackSemitone(semitone);
            return (
              <button
                key={semitone}
                type="button"
                onMouseDown={() => dawEngine.previewSemitone(semitone, 0.25)}
                style={{
                  width: '100%',
                  height: `${rowHeight}px`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingRight: '6px',
                  fontSize: '11px',
                  border: '1px solid rgba(168, 85, 247, 0.18)',
                  background: black ? '#1e162b' : '#f3e8ff',
                  color: black ? '#e9d5ff' : '#2e1065',
                  cursor: 'pointer'
                }}
              >
                {semitoneToLabel(semitone)}
              </button>
            );
          })}
        </div>

        <div
          ref={gridRef}
          className="piano-grid"
          onMouseDown={handleGridMouseDown}
          style={{
            position: 'relative',
            width: `${gridWidth}px`,
            height: `${gridHeight}px`,
            backgroundColor: '#140d1f',
            backgroundImage: `
              repeating-linear-gradient(to right, rgba(192, 132, 252, 0.25) 0px, rgba(192, 132, 252, 0.25) 1px, transparent 1px, transparent ${pixelsPerBeat * 4}px),
              repeating-linear-gradient(to right, rgba(147, 51, 234, 0.12) 0px, rgba(147, 51, 234, 0.12) 1px, transparent 1px, transparent ${pixelsPerBeat}px),
              repeating-linear-gradient(to bottom, rgba(147, 51, 234, 0.14) 0px, rgba(147, 51, 234, 0.14) 1px, transparent 1px, transparent ${rowHeight}px)
            `,
            cursor: 'crosshair'
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${playheadPosition}px`,
              width: '2px',
              backgroundColor: '#e9d5ff',
              pointerEvents: 'none',
              zIndex: 15
            }}
          />

          {notes.map((note) => {
            const rowIdx = MAX_SEMITONE - note.semitone;
            const top = rowIdx * rowHeight + 1;
            const height = rowHeight - 2;
            const isSelected = note.id === selectedNoteId;

            return (
              <div
                key={note.id}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setSelectedNoteId(note.id);
                  dawEngine.previewSemitone(note.semitone, 0.25);
                  setDragState({
                    mode: 'move',
                    noteId: note.id,
                    startX: e.clientX,
                    startY: e.clientY,
                    initialStart: note.start,
                    initialSemitone: note.semitone
                  });
                }}
                onContextMenu={(e) => handleNoteContextMenu(e, note.id)}
                title={`${semitoneToLabel(note.semitone)}`}
                style={{
                  position: 'absolute',
                  left: `${note.start}px`,
                  top: `${top}px`,
                  width: `${Math.max(8, note.duration - 2)}px`,
                  height: `${height}px`,
                  borderRadius: '4px',
                  background: isSelected ? '#c084fc' : '#9333ea',
                  border: isSelected ? '1px solid #faf5ff' : '1px solid #d8b4fe',
                  boxSizing: 'border-box',
                  cursor: 'grab'
                }}
              >
                <div
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setSelectedNoteId(note.id);
                    setDragState({
                      mode: 'resize',
                      noteId: note.id,
                      startX: e.clientX,
                      startY: e.clientY,
                      initialDuration: note.duration
                    });
                  }}
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    width: '7px',
                    height: '100%',
                    cursor: 'ew-resize',
                    background: 'rgba(250, 245, 255, 0.25)',
                    borderTopRightRadius: '4px',
                    borderBottomRightRadius: '4px'
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};