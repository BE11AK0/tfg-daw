class DawAudioEngine {
  constructor() {
    this.ctx = null;
    this.activeSources = [];
    this.scheduledTimeouts = [];
    this.analysers = {};
  }

  async ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    return this.ctx;
  }

  getAnalysersRef() {
    return this.analysers;
  }

  createTrackChain(targetCtx, track, destinationNode, analyserNode = null) {
    const lowFilter = targetCtx.createBiquadFilter();
    lowFilter.type = 'lowshelf';
    lowFilter.frequency.value = 250;
    lowFilter.gain.value = track.eqLow || 0;

    const midFilter = targetCtx.createBiquadFilter();
    midFilter.type = 'peaking';
    midFilter.frequency.value = 1500;
    midFilter.gain.value = track.eqMid || 0;

    const highFilter = targetCtx.createBiquadFilter();
    highFilter.type = 'highshelf';
    highFilter.frequency.value = 4000;
    highFilter.gain.value = track.eqHigh || 0;

    const delayNode = targetCtx.createDelay(2.0);
    delayNode.delayTime.value = Math.max(0, Math.min(1.5, track.delayTime ?? 0));

    const gainNode = targetCtx.createGain();
    gainNode.gain.value = typeof track.volume === 'number' ? track.volume : 0.75;

    const pannerNode = targetCtx.createStereoPanner ? targetCtx.createStereoPanner() : null;
    if (pannerNode) {
      pannerNode.pan.value = typeof track.pan === 'number' ? track.pan : 0;
    }

    lowFilter.connect(midFilter);
    midFilter.connect(highFilter);
    highFilter.connect(delayNode);
    delayNode.connect(gainNode);

    let tailNode = gainNode;
    if (analyserNode) {
      gainNode.connect(analyserNode);
      tailNode = analyserNode;
    }

    if (pannerNode) {
      tailNode.connect(pannerNode);
      pannerNode.connect(destinationNode);
    } else {
      tailNode.connect(destinationNode);
    }

    return {
      input: lowFilter,
      lowFilter,
      midFilter,
      highFilter,
      delayNode,
      gainNode,
      pannerNode
    };
  }

  playClickSound(ctx, whenSec = null) {
    try {
      const now = whenSec ?? ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, now);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
      this.activeSources.push(osc);
    } catch (e) {}
  }

  playDrumPad(ctx, padType, volume = 0.8, destinationNode = null, whenSec = null) {
    try {
      const now = whenSec ?? ctx.currentTime;
      const out = destinationNode || ctx.destination;
      const master = ctx.createGain();
      master.gain.value = Math.max(0, Math.min(1, volume));
      master.connect(out);

      if (padType === 'kick') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(145, now);
        osc.frequency.exponentialRampToValueAtTime(42, now + 0.14);
        gain.gain.setValueAtTime(0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.connect(gain);
        gain.connect(master);
        osc.start(now);
        osc.stop(now + 0.24);
        this.activeSources.push(osc);
      } else if (padType === 'snare' || padType === 'clap') {
        const bufferSize = Math.floor(ctx.sampleRate * 0.18);
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;

        const filter = ctx.createBiquadFilter();
        filter.type = padType === 'clap' ? 'bandpass' : 'highpass';
        filter.frequency.value = padType === 'clap' ? 1300 : 900;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(padType === 'clap' ? 0.35 : 0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        noise.start(now);
        noise.stop(now + 0.18);
        this.activeSources.push(noise);
      } else {
        // Hi-hat / tom / perc
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = padType === 'tom' ? 'triangle' : 'square';
        const baseFreq = padType === 'tom' ? 110 : padType === 'openhat' ? 5200 : 7200;
        const dur = padType === 'openhat' ? 0.22 : padType === 'tom' ? 0.18 : 0.06;
        osc.frequency.setValueAtTime(baseFreq, now);
        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
        osc.connect(gain);
        gain.connect(master);
        osc.start(now);
        osc.stop(now + dur + 0.01);
        this.activeSources.push(osc);
      }
    } catch (e) {}
  }

  async previewDrumPad(padType) {
    const ctx = await this.ensureContext();
    this.playDrumPad(ctx, padType, 0.85, ctx.destination);
  }

  playSynthNote(ctx, semitone, durationSec, track, analyser, whenSec = null) {
    try {
      const now = whenSec ?? ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const safeDur = Math.max(0.04, durationSec);

      const freq = 261.63 * Math.pow(2, semitone / 12);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.linearRampToValueAtTime(0.001, now + safeDur);

      const chain = this.createTrackChain(ctx, track, ctx.destination, analyser);
      osc.connect(gain);
      gain.connect(chain.input);

      osc.start(now);
      osc.stop(now + Math.max(0.05, safeDur));
      this.activeSources.push(osc);
    } catch (e) {}
  }

  async previewSemitone(semitone = 0, durationSec = 0.25) {
    const ctx = await this.ensureContext();
    const dummyTrack = {
      volume: 0.75,
      pan: 0,
      eqLow: 0,
      eqMid: 0,
      eqHigh: 0,
      delayTime: 0
    };
    if (!this.analysers.__preview) {
      this.analysers.__preview = ctx.createAnalyser();
    }
    this.playSynthNote(ctx, semitone, durationSec, dummyTrack, this.analysers.__preview);
  }

  stopAll() {
    this.scheduledTimeouts.forEach((id) => clearTimeout(id));
    this.scheduledTimeouts = [];
    this.activeSources.forEach((source) => {
      try {
        source.stop();
      } catch (e) {}
      try {
        source.disconnect();
      } catch (e) {}
    });
    this.activeSources = [];
  }

  schedulePlayback({ ctx, tracks, startPx, zoom, bpm, isPlayingRef }) {
    this.stopAll();
    const pxPerSec = zoom * (bpm / 60);
    const startTime = ctx.currentTime - (startPx / pxPerSec);
    const anySolo = tracks.some((t) => Boolean(t.solo));

    tracks.forEach((track) => {
      const isAudible = !track.muted && (!anySolo || Boolean(track.solo));
      if (!isAudible) return;

      if (!this.analysers[track.id]) {
        this.analysers[track.id] = ctx.createAnalyser();
      }
      const analyser = this.analysers[track.id];

      (track.clips || []).forEach((clip) => {
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

            const chain = this.createTrackChain(ctx, track, ctx.destination, analyser);
            source.connect(chain.input);

            if (clipStartTime >= now) {
              source.start(clipStartTime, clipOffsetSec, clipDurationSec);
              this.activeSources.push(source);
            } else {
              const playheadOffset = now - clipStartTime;
              const bufferStartOffset = (clipOffsetSec + playheadOffset) % clip.audioBuffer.duration;
              const playDuration = Math.max(0.02, clipDurationSec - playheadOffset);

              source.start(now, bufferStartOffset, playDuration);
              this.activeSources.push(source);
            }
          } catch (err) {
            console.error('Error al reproducir clip de audio:', err);
          }
        }

        if (clip.notes && clip.notes.length > 0) {
          clip.notes.forEach((note) => {
            const noteAbsolutePx = clip.start + note.start;
            const noteTimeSec = noteAbsolutePx / pxPerSec;
            const noteDurationSec = note.duration / pxPerSec;
            const notePlayTime = startTime + noteTimeSec;
            const now = ctx.currentTime;

            if (notePlayTime >= now) {
              const timerId = setTimeout(() => {
                if (!isPlayingRef.current) return;
                this.playSynthNote(ctx, note.semitone, noteDurationSec, track, analyser);
              }, (notePlayTime - now) * 1000);
              this.scheduledTimeouts.push(timerId);
            }
          });
        }
      });
    });

    return startTime;
  }

  encodeWavFromAudioBuffer(audioBuffer) {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    const samplesLength = audioBuffer.length * numChannels;
    const buffer = new ArrayBuffer(44 + samplesLength * 2);
    const view = new DataView(buffer);

    const writeString = (offset, str) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samplesLength * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
    view.setUint16(32, numChannels * (bitDepth / 8), true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, samplesLength * 2, true);

    const channels = [];
    for (let c = 0; c < numChannels; c++) {
      channels.push(audioBuffer.getChannelData(c));
    }

    let offset = 44;
    for (let i = 0; i < audioBuffer.length; i++) {
      for (let c = 0; c < numChannels; c++) {
        const s = Math.max(-1, Math.min(1, channels[c][i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
      }
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  async renderMixToWavBlob(tracks, zoom, bpm) {
    let maxDurationSec = 4;
    const pxPerSec = zoom * (bpm / 60);

    tracks.forEach((t) => {
      (t.clips || []).forEach((c) => {
        const endSec = (c.start + c.width) / pxPerSec;
        if (endSec > maxDurationSec) maxDurationSec = endSec;
      });
    });

    const totalSeconds = Math.min(120, Math.max(2, maxDurationSec + 0.5));
    const sampleRate = 44100;
    const offlineCtx = new OfflineAudioContext(2, Math.ceil(sampleRate * totalSeconds), sampleRate);
    const anySolo = tracks.some((t) => Boolean(t.solo));

    tracks.forEach((track) => {
      const isAudible = !track.muted && (!anySolo || Boolean(track.solo));
      if (!isAudible) return;

      (track.clips || []).forEach((clip) => {
        if (clip.audioBuffer) {
          const source = offlineCtx.createBufferSource();
          source.buffer = clip.audioBuffer;
          source.loop = true;
          const chain = this.createTrackChain(offlineCtx, track, offlineCtx.destination);
          source.connect(chain.input);
          const clipStartSec = clip.start / pxPerSec;
          const clipDurSec = clip.width / pxPerSec;
          source.start(clipStartSec, (clip.clipOffset || 0) / pxPerSec, clipDurSec);
        }

        if (clip.notes && clip.notes.length > 0) {
          clip.notes.forEach((note) => {
            const whenSec = (clip.start + note.start) / pxPerSec;
            const durSec = Math.max(0.05, note.duration / pxPerSec);
            const osc = offlineCtx.createOscillator();
            const gain = offlineCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(261.63 * Math.pow(2, note.semitone / 12), whenSec);
            gain.gain.setValueAtTime(0.25, whenSec);
            gain.gain.linearRampToValueAtTime(0.001, whenSec + durSec);
            const chain = this.createTrackChain(offlineCtx, track, offlineCtx.destination);
            osc.connect(gain);
            gain.connect(chain.input);
            osc.start(whenSec);
            osc.stop(whenSec + durSec + 0.02);
          });
        }
      });
    });

    const renderedBuffer = await offlineCtx.startRendering();
    return this.encodeWavFromAudioBuffer(renderedBuffer);
  }
}

export const dawEngine = new DawAudioEngine();