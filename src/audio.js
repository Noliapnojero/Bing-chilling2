/**
 * Vintage Walkman Cassette Audio Engine
 * Features:
 * - Mechanical switch & latch sound synthesis (heavy click, spring return)
 * - Tape hiss generator (filtered pink noise)
 * - Wow & flutter analog pitch flutter simulation
 * - Retro 80s procedural synthwave / synth tracks (runs 100% offline & zero dependencies)
 * - Custom user audio loader (MP3 / WAV / OGG)
 * - Stereo VU Analyser for live frequency visualization
 * - Hot Line talkover filter (atenuates music and applies vintage radio filter)
 * - Analog Tone EQ filter
 */

export class WalkmanAudio {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.toneFilter = null;
    this.hotlineFilter = null;
    this.hotlineGain = null;
    this.analyserL = null;
    this.analyserR = null;
    this.splitter = null;

    // Vintage tape effects
    this.tapeHissNode = null;
    this.tapeHissGain = null;
    this.motorHumNode = null;
    this.motorHumGain = null;
    this.isHissEnabled = true;
    this.isWowFlutterEnabled = true;

    // State
    this.isPlaying = false;
    this.isPaused = false;
    this.isHotlineActive = false;
    this.isFastForward = false;
    this.isRewind = false;
    this.currentTrack = 'synthwave';
    this.volume = 0.85;
    this.tone = 0.75; // 0 = dark/warm, 1 = bright

    // Procedural synth player
    this.synthInterval = null;
    this.synthStep = 0;
    this.customAudioElement = null;
    this.customSourceNode = null;

    // Callbacks
    this.onTrackEnd = null;
    this.onTimeUpdate = null;
  }

  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master output
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);

      // Tone Filter (High Shelf / Low Pass for vintage cassette warmth)
      this.toneFilter = this.ctx.createBiquadFilter();
      this.toneFilter.type = 'lowpass';
      this.updateToneFilter(this.tone);

      // Hotline talkover filter (telephone/bandpass effect)
      this.hotlineFilter = this.ctx.createBiquadFilter();
      this.hotlineFilter.type = 'allpass'; // normally transparent

      this.hotlineGain = this.ctx.createGain();
      this.hotlineGain.gain.setValueAtTime(1.0, this.ctx.currentTime);

      // Stereo Analysers for VU Meter
      this.splitter = this.ctx.createChannelSplitter(2);
      this.analyserL = this.ctx.createAnalyser();
      this.analyserR = this.ctx.createAnalyser();
      this.analyserL.fftSize = 64;
      this.analyserR.fftSize = 64;

      // Audio Graph routing:
      // Source -> hotlineFilter -> hotlineGain -> toneFilter -> masterGain -> Splitter -> Analysers -> Destination
      this.hotlineFilter.connect(this.hotlineGain);
      this.hotlineGain.connect(this.toneFilter);
      this.toneFilter.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.masterGain.connect(this.splitter);
      this.splitter.connect(this.analyserL, 0);
      this.splitter.connect(this.analyserR, 1);

      this.setupTapeHiss();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // --- Mechanical Cassette Sound Effects ---
  playMechanicalClick(type = 'press') {
    this.initContext();
    const now = this.ctx.currentTime;
    
    // Heavy mechanical metal clunk
    const osc = this.ctx.createOscillator();
    const noise = this.createNoiseBuffer(0.06);
    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = noise;

    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    if (type === 'press') {
      // Deep mechanical heavy latch click
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.08);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200, now);
      filter.Q.setValueAtTime(3.0, now);

      gain.gain.setValueAtTime(0.7, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    } else if (type === 'release') {
      // Spring pop release
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.07);

      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1800, now);

      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    } else { // 'hotline'
      // Snappy metallic switch toggle
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.04);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2400, now);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    }

    osc.connect(gain);
    noiseNode.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    noiseNode.start(now);
    osc.stop(now + 0.1);
    noiseNode.stop(now + 0.1);
  }

  // Tape hiss (authentic vintage cassette analogue background)
  setupTapeHiss() {
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Pink noise approximation
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      data[i] = (b0 + b1 + b2) * 0.12;
    }

    this.tapeHissNode = this.ctx.createBufferSource();
    this.tapeHissNode.buffer = buffer;
    this.tapeHissNode.loop = true;

    // Highpass + bandpass for cassette tape head frequency response
    const hissFilter = this.ctx.createBiquadFilter();
    hissFilter.type = 'bandpass';
    hissFilter.frequency.setValueAtTime(4500, this.ctx.currentTime);
    hissFilter.Q.setValueAtTime(0.8, this.ctx.currentTime);

    this.tapeHissGain = this.ctx.createGain();
    this.tapeHissGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    this.tapeHissNode.connect(hissFilter);
    hissFilter.connect(this.tapeHissGain);
    this.tapeHissGain.connect(this.masterGain);

    this.tapeHissNode.start();
  }

  createNoiseBuffer(duration = 0.1) {
    const size = Math.floor(this.ctx.sampleRate * duration);
    const buf = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
    const output = buf.getChannelData(0);
    for (let i = 0; i < size; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  updateToneFilter(val) {
    this.tone = val;
    if (this.toneFilter && this.ctx) {
      // Val is 0 to 1 -> maps to 1200Hz (warm retro cassette) to 16000Hz (crisp studio)
      const freq = 1200 + Math.pow(val, 2) * 14800;
      this.toneFilter.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05);
    }
  }

  setVolume(val) {
    this.volume = val;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.05);
    }
  }

  toggleHotline() {
    this.initContext();
    this.isHotlineActive = !this.isHotlineActive;
    this.playMechanicalClick('hotline');

    const now = this.ctx.currentTime;
    if (this.isHotlineActive) {
      // Hot line active: duck music volume to 25% and apply telephone / ambient voice filter
      this.hotlineGain.gain.setTargetAtTime(0.22, now, 0.05);
      this.hotlineFilter.type = 'bandpass';
      this.hotlineFilter.frequency.setTargetAtTime(1400, now, 0.05);
      this.hotlineFilter.Q.setTargetAtTime(2.5, now, 0.05);
    } else {
      // Hot line released: restore full sound
      this.hotlineGain.gain.setTargetAtTime(1.0, now, 0.08);
      this.hotlineFilter.type = 'allpass';
    }
    return this.isHotlineActive;
  }

  // --- Transport Controls ---
  play() {
    this.initContext();
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.isPaused = false;
    this.playMechanicalClick('press');

    // Fade in tape hiss if enabled
    if (this.isHissEnabled && this.tapeHissGain) {
      this.tapeHissGain.gain.setTargetAtTime(0.045, this.ctx.currentTime, 0.3);
    }

    if (this.currentTrack === 'custom' && this.customAudioElement) {
      this.customAudioElement.play();
    } else {
      this.startRetroSynthPlayer();
    }
  }

  stop() {
    if (!this.isPlaying && !this.isPaused) return;

    this.isPlaying = false;
    this.isPaused = false;
    this.playMechanicalClick('release');

    // Fade out tape hiss
    if (this.tapeHissGain && this.ctx) {
      this.tapeHissGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.1);
    }

    this.stopRetroSynthPlayer();

    if (this.customAudioElement) {
      this.customAudioElement.pause();
      this.customAudioElement.currentTime = 0;
    }
  }

  pause() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.isPaused = true;
    this.playMechanicalClick('press');

    if (this.tapeHissGain && this.ctx) {
      this.tapeHissGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.1);
    }

    this.stopRetroSynthPlayer();
    if (this.customAudioElement) {
      this.customAudioElement.pause();
    }
  }

  // Fast forward / rewind sound simulation
  fastForward(start = true) {
    this.isFastForward = start;
    if (start) {
      this.playMechanicalClick('press');
      // If playing synth, increase tempo 4x
      if (this.isPlaying && this.currentTrack !== 'custom') {
        this.startRetroSynthPlayer(75); // fast tempo
      }
    } else {
      if (this.isPlaying && this.currentTrack !== 'custom') {
        this.startRetroSynthPlayer(220); // normal tempo
      }
    }
  }

  rewind(start = true) {
    this.isRewind = start;
    if (start) {
      this.playMechanicalClick('press');
    }
  }

  // --- Procedural 80s Synth Tracks ---
  // Generates genuine vintage FM/analog synthesizers, basslines, and synth leads
  startRetroSynthPlayer(stepMs = 220) {
    this.stopRetroSynthPlayer();
    
    // Notes frequencies
    const notes = {
      'C2': 65.41, 'D2': 73.42, 'E2': 82.41, 'F2': 87.31, 'G2': 98.00, 'A2': 110.00, 'B2': 123.47,
      'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
      'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
      'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00,
    };

    // Tracks patterns: 16-step sequence per measure
    const synthwaveBass = [
      'A2', 'A2', 'A2', 'A2',  'F2', 'F2', 'F2', 'F2',  'C2', 'C2', 'C2', 'C2',  'G2', 'G2', 'G2', 'G2'
    ];
    const synthwaveLead = [
      'A4', null, 'C5', null,  'E5', 'D5', null, 'C5',  'G4', null, 'B4', null,  'D5', null, 'C5', 'B4'
    ];
    const cityPopBass = [
      'D2', null, 'D2', 'F2',  'G2', null, 'G2', 'A2',  'B2', null, 'A2', 'G2',  'E2', 'F2', 'G2', 'A2'
    ];
    const cityPopLead = [
      'F4', 'A4', 'C5', 'E5',  'D5', null, 'B4', null,  'G4', 'B4', 'D5', 'F5',  'E5', 'C5', 'A4', null
    ];
    const lofiBass = [
      'C2', null, null, 'C2',  'E2', null, null, 'E2',  'A2', null, null, 'A2',  'F2', null, 'G2', null
    ];
    const lofiLead = [
      'E4', null, 'G4', null,  'B4', null, 'A4', null,  'C5', null, 'B4', null,  'G4', null, null, null
    ];

    let patternBass = synthwaveBass;
    let patternLead = synthwaveLead;

    if (this.currentTrack === 'citypop') {
      patternBass = cityPopBass;
      patternLead = cityPopLead;
    } else if (this.currentTrack === 'lofi') {
      patternBass = lofiBass;
      patternLead = lofiLead;
    }

    this.synthInterval = setInterval(() => {
      if (!this.isPlaying || !this.ctx) return;

      const now = this.ctx.currentTime;
      const step = this.synthStep % patternBass.length;

      // Analog Wow & Flutter pitch drift
      let pitchMod = 1.0;
      if (this.isWowFlutterEnabled) {
        // Wow (0.5Hz ~ 1.5Hz drift) + Flutter (6Hz ~ 12Hz tremor)
        const wow = Math.sin(now * 2.1) * 0.007;
        const flutter = Math.sin(now * 8.4) * 0.003;
        pitchMod = 1.0 + wow + flutter;
      }

      // 1. Play Bass Note (Vintage Moog/Juno style Sawtooth)
      const bassNote = patternBass[step];
      if (bassNote && notes[bassNote]) {
        this.triggerSynthVoice({
          freq: notes[bassNote] * pitchMod,
          type: 'sawtooth',
          duration: 0.18,
          gainVal: 0.35,
          cutoff: 850,
          now
        });
      }

      // 2. Play Lead Note (Vintage Square / Dual Osc Synth)
      const leadNote = patternLead[step];
      if (leadNote && notes[leadNote]) {
        this.triggerSynthVoice({
          freq: notes[leadNote] * pitchMod,
          type: 'square',
          duration: 0.28,
          gainVal: 0.22,
          cutoff: 3200,
          detune: 4,
          now
        });
      }

      // 3. Vintage 80s Drum Machine Snare / Hi-Hat on specific beats
      if (step % 4 === 2) {
        // Snare / Rimshot
        this.triggerSnare(now);
      } else if (step % 2 === 0) {
        // Hi-Hat
        this.triggerHiHat(now);
      }

      this.synthStep++;
    }, stepMs);
  }

  triggerSynthVoice({ freq, type, duration, gainVal, cutoff, detune = 0, now }) {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (detune) osc.detune.setValueAtTime(detune, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, now);
    filter.frequency.exponentialRampToValueAtTime(cutoff * 0.4, now + duration);

    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.hotlineFilter);

    osc.start(now);
    osc.stop(now + duration);
  }

  triggerHiHat(now) {
    const noise = this.createNoiseBuffer(0.04);
    const node = this.ctx.createBufferSource();
    node.buffer = noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7000, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    node.connect(filter);
    filter.connect(gain);
    gain.connect(this.hotlineFilter);

    node.start(now);
    node.stop(now + 0.05);
  }

  triggerSnare(now) {
    // White noise burst + tone body
    const noise = this.createNoiseBuffer(0.12);
    const node = this.ctx.createBufferSource();
    node.buffer = noise;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2200, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    node.connect(filter);
    filter.connect(gain);
    gain.connect(this.hotlineFilter);

    node.start(now);
    node.stop(now + 0.13);
  }

  stopRetroSynthPlayer() {
    if (this.synthInterval) {
      clearInterval(this.synthInterval);
      this.synthInterval = null;
    }
  }

  // --- Custom User Audio Loading ---
  loadCustomAudioFile(file) {
    this.initContext();
    const url = URL.createObjectURL(file);

    if (this.customAudioElement) {
      this.customAudioElement.pause();
      this.customAudioElement.src = '';
    }

    this.customAudioElement = new Audio(url);
    this.customAudioElement.crossOrigin = 'anonymous';

    if (!this.customSourceNode) {
      this.customSourceNode = this.ctx.createMediaElementSource(this.customAudioElement);
      this.customSourceNode.connect(this.hotlineFilter);
    }

    this.currentTrack = 'custom';
    return file.name;
  }

  setTrack(trackKey) {
    if (trackKey === this.currentTrack) return;
    const wasPlaying = this.isPlaying;
    if (wasPlaying) {
      this.stop();
    }
    this.currentTrack = trackKey;
    this.synthStep = 0;
    if (wasPlaying) {
      this.play();
    }
  }

  // --- Live VU Data for Visualizer ---
  getVULevels() {
    if (!this.analyserL || !this.analyserR || !this.isPlaying) {
      return { left: 0, right: 0 };
    }

    const dataL = new Uint8Array(this.analyserL.frequencyBinCount);
    const dataR = new Uint8Array(this.analyserR.frequencyBinCount);
    this.analyserL.getByteFrequencyData(dataL);
    this.analyserR.getByteFrequencyData(dataR);

    // Calculate RMS / peak
    let sumL = 0, sumR = 0;
    for (let i = 0; i < dataL.length; i++) {
      sumL += dataL[i];
      sumR += dataR[i];
    }

    const avgL = sumL / (dataL.length * 255);
    const avgR = sumR / (dataR.length * 255);

    // Apply hot line reduction if active
    return {
      left: Math.min(1.0, avgL * 1.5),
      right: Math.min(1.0, avgR * 1.5)
    };
  }
}
