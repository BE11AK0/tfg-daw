import React from 'react';
import './Track.css';

export const Track = ({ track, onUpdate, onDelete }) => {
  const handleVolumeChange = (e) => {
    onUpdate(track.id, { volume: parseFloat(e.target.value) });
  };

  const toggleMute = () => {
    onUpdate(track.id, { muted: !track.muted });
  };

  const toggleSolo = () => {
    onUpdate(track.id, { solo: !track.solo });
  };

  const handleNameChange = (e) => {
    onUpdate(track.id, { name: e.target.value });
  };

  return (
    <div className={`track-row ${track.muted ? 'is-muted' : ''} ${track.solo ? 'is-solo' : ''}`}>
      <div className="track-header-controls">
        <input 
          type="text" 
          value={track.name} 
          onChange={handleNameChange}
          className="track-name-input"
        />
        <div className="track-buttons">
          <button 
            className={`btn-control ${track.muted ? 'active-mute' : ''}`} 
            onClick={toggleMute}
            title="Silenciar pista"
          >
            M
          </button>
          <button 
            className={`btn-control ${track.solo ? 'active-solo' : ''}`} 
            onClick={toggleSolo}
            title="Solo pista"
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
          onChange={handleVolumeChange}
          className="track-volume-slider"
        />
        <span className="volume-val">{Math.round(track.volume * 100)}%</span>
      </div>

      <div className="track-timeline-area">
        <div className="track-clips-placeholder">
          <span>Pista de {track.type.toUpperCase()} (Arrastra clips aquí)</span>
        </div>
      </div>

      <button className="btn-delete-track" onClick={() => onDelete(track.id)} title="Eliminar pista">
        ✕
      </button>
    </div>
  );
};