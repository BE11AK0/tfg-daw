import React, { useEffect, useState } from 'react';
import './IntroSplash.css';
import logoImg from '../assets/logo.png';

export const IntroSplash = ({ onFinish }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.4);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch (e) {
      console.log('Audio bloqueado hasta interacción');
    }

    const timer = setTimeout(() => {
      setIsVisible(false);
      if (onFinish) onFinish();
    }, 1800);

    return () => clearTimeout(timer);
  }, [onFinish]);

  if (!isVisible) return null;

  return (
    <div className="intro-overlay">
      <div className="intro-content">
        <div className="intro-icon-wrapper">
          <img src={logoImg} alt="Logo TFG DAW" className="intro-logo-img" />
        </div>
        <h1 className="intro-title">TFG DAW Studio</h1>
        <p className="intro-subtitle">Powered by EL MIO</p>
      </div>
    </div>
  );
};