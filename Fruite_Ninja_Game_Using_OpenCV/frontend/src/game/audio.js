// Audio Manager for Fruit Ninja Web
class SoundManager {
  constructor() {
    this.ctx = null;
    this.buffers = {};
    this.muted = false;
    this.volume = 0.8;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.loadAll();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  async loadAudio(name, path) {
    try {
      const response = await fetch(path);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      this.buffers[name] = audioBuffer;
    } catch {
      // Audio loading error handled gracefully
    }
  }

  loadAll() {
    this.loadAudio('splat', '/assets/audio/Fruit Splat Score 01 Sound Effect 056561276 Nw Prev.wav');
    this.loadAudio('splat2', '/assets/audio/Fruit Splat Score 02 Sound Effect 056561283 Nw Prev.wav');
    this.loadAudio('bomb', '/assets/audio/bomb explosion sound.wav');
    this.loadAudio('start', '/assets/audio/37. U I Game Start.mp3');
    this.loadAudio('over', '/assets/audio/36. U I Game Over.mp3');
    this.loadAudio('combo', '/assets/audio/Asian Rising Combo Hit 01 Sound Effect 066793498 Nw Prev.wav');
  }

  play(name) {
    if (this.muted) return;
    this.init();

    const buffer = this.buffers[name] || this.buffers['splat'];
    if (!buffer || !this.ctx) {
      // Synthesize quick sound fallback
      this.playSynthFallback(name);
      return;
    }

    try {
      const source = this.ctx.createBufferSource();
      const gainNode = this.ctx.createGain();
      gainNode.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      source.buffer = buffer;
      source.connect(gainNode);
      gainNode.connect(this.ctx.destination);
      source.start(0);
    } catch {
      // Catch playback errors
    }
  }

  playSynthFallback(type) {
    if (this.muted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      if (type === 'splat') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
      } else if (type === 'bomb') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
      }
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.3);
    } catch {
      // Ignore
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }
}

export const soundManager = new SoundManager();
