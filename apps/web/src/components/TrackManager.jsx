import React, { useState } from 'react';
import './TrackManager.css';

export const TrackManager = () => {
  const [tracks, setTracks] = useState([
    { id: 1, name: 'Pista 1 (Kick)', type: 'audio', volume: 0.8, muted: false, solo: false },
    { id: 2, name: 'Pista 2 (Melodía)', type: 'midi', volume: 0.7, muted: false, solo: false }
  ]);

  const addTrack = (type) => {
    const newTrack = {
      id: Date.now(),
      name: `Pista ${tracks.length + 1} (${type === 'audio' ? 'Audio' : 'MIDI'})`,
      type,
      volume: 0.75,
      muted: false,
      solo: false
    };
    setTracks([...tracks, newTrack]);
  };

  const updateTrack = (id, updatedFields) => {
    setTracks(tracks.map(t => t.id === id ? { ...t, ...updatedFields } : t));
  };

  const deleteTrack = (id) => {
    setTracks(tracks.filter(t => t.id !== id));
  };

  const duplicateTrack = (id) => {
    const trackToClone = tracks.find(t => t.id === id);
    if (!trackToClone) return;

    const duplicated = {
      ...trackToClone,
      id: Date.now(),
      name: `${trackToClone.name} (Copia)`
    };

    setTracks([...tracks, duplicated]);
  };

  return (
    <div className="track-manager-container">
      <div className="track-manager-header">
        <h2>Mezclador y Pistas</h2>
        <div className="track-add-buttons">
          <button className="btn-add" onClick={() => addTrack('audio')}>+ Pista Audio</button>
          <button className="btn-add" onClick={() => addTrack('midi')}>+ Pista MIDI</button>
        </div>
      </div>

      <div className="tracks-list">
        {tracks.map(track => (
          <div key={track.id} className={`track-row ${track.muted ? 'is-muted' : ''} ${track.solo ? 'is-solo' : ''}`}>
            <div className="track-header-controls">
              <input 
                type="text" 
                value={track.name} 
                onChange={(e) => updateTrack(track.id, { name: e.target.value })}
                className="track-name-input"
              />
              <div className="track-buttons">
                <button 
                  className={`btn-control ${track.muted ? 'active-mute' : ''}`} 
                  onClick={() => updateTrack(track.id, { muted: !track.muted })}
                  title="Silenciar"
                >
                  M
                </button>
                <button 
                  className={`btn-control ${track.solo ? 'active-solo' : ''}`} 
                  onClick={() => updateTrack(track.id, { solo: !track.solo })}
                  title="Solo"
                >
                  S
                </button>
              </div>
            </div>

            <div className="track-mixer-strip">
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.01" 
                value={track.volume} 
                onChange={(e) => updateTrack(track.id, { volume: parseFloat(e.target.value) })}
                className="track-volume-slider"
              />
              <span className="volume-val">{Math.round(track.volume * 100)}%</span>
            </div>

            <div className="track-timeline-area">
              <div className="track-clips-placeholder">
                <span>Pista de {track.type.toUpperCase()}</span>
              </div>
            </div>

            <div className="track-actions">
              <button className="btn-action" onClick={() => duplicateTrack(track.id)} title="Duplicar pista">
                📋
              </button>
              <button className="btn-delete-track" onClick={() => deleteTrack(track.id)} title="Eliminar pista">
                ✕
              </button>
            </div>
          </div>
        ))}
        {tracks.length === 0 && (
          <p className="no-tracks-msg">No hay pistas creadas. Añade una para empezar.</p>
        )}
      </div>
    </div>
  );
};