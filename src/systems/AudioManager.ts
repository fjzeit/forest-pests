// AudioManager - Handles all game sounds
// Using Web Audio API - minimal sounds to reduce noise

export class AudioManager {
  private audioContext: AudioContext | null = null;
  private marchInterval: number | null = null;
  private marchNoteIndex: number = 0;
  private currentTempo: number = 1000; // ms between notes
  private unlocked: boolean = false;

  // Classic march notes (approximation)
  private readonly marchNotes = [
    { freq: 55, duration: 0.1 },   // A1
    { freq: 49, duration: 0.1 },   // G1
    { freq: 46, duration: 0.1 },   // F#1
    { freq: 41, duration: 0.1 },   // E1
  ];

  constructor() {
    // Initialize audio context on first user interaction (click or touch)
    // Use capture phase to ensure we get the event before it's prevented
    const initOnInteraction = () => {
      this.unlock();
    };
    document.addEventListener('click', initOnInteraction, { capture: true });
    document.addEventListener('touchstart', initOnInteraction, { capture: true });
    document.addEventListener('touchend', initOnInteraction, { capture: true });
  }

  // Public method to unlock audio - can be called explicitly from game code
  unlock(): void {
    if (this.unlocked) return;

    // Create context if needed
    if (!this.audioContext) {
      // Use webkitAudioContext for older Safari
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioContext = new AudioContextClass();
      }
    }

    if (!this.audioContext) return;

    // Mark as unlocked immediately to prevent multiple attempts
    this.unlocked = true;

    // Resume if suspended (required for iOS Safari)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().then(() => {
        this.playSilentBuffer();
      });
    } else {
      this.playSilentBuffer();
    }
  }

  // Play a silent buffer to fully unlock audio on iOS Safari
  private playSilentBuffer(): void {
    if (!this.audioContext) return;

    // Use 0.1 seconds of silence at the context's sample rate
    const sampleRate = this.audioContext.sampleRate;
    const silentBuffer = this.audioContext.createBuffer(1, Math.floor(sampleRate * 0.1), sampleRate);
    const channelData = silentBuffer.getChannelData(0);
    for (let i = 0; i < channelData.length; i++) {
      channelData[i] = 0; // Explicit silence
    }
    const source = this.audioContext.createBufferSource();
    source.buffer = silentBuffer;
    source.connect(this.audioContext.destination);
    source.start(0);
  }

  private playTone(
    frequency: number,
    duration: number,
    type: OscillatorType = 'square',
    volume: number = 0.3
  ): void {
    if (!this.audioContext) return;
    // Try to resume if suspended (can happen on iOS after tab switch)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    this.playToneAt(frequency, duration, this.audioContext.currentTime, type, volume);
  }

  // Play a tone at a specific time using Web Audio scheduling (no setTimeout)
  private playToneAt(
    frequency: number,
    duration: number,
    startTime: number,
    type: OscillatorType = 'square',
    volume: number = 0.3
  ): void {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startTime);

    gainNode.gain.setValueAtTime(volume, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  }

  // Play a sequence of notes using Web Audio scheduling (avoids setTimeout overhead)
  private playSequence(
    notes: { freq: number; duration: number; delay: number; volume?: number }[],
    type: OscillatorType = 'square',
    baseVolume: number = 0.2
  ): void {
    if (!this.audioContext) return;
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    const baseTime = this.audioContext.currentTime;
    for (const note of notes) {
      const vol = note.volume !== undefined ? note.volume : baseVolume;
      this.playToneAt(note.freq, note.duration, baseTime + note.delay / 1000, type, vol);
    }
  }

  // March beat - the iconic 4-note bassline
  startMarch(): void {
    this.stopMarch();
    this.marchNoteIndex = 0;
    this.playMarchNote();
  }

  private playMarchNote(): void {
    if (!this.audioContext) {
      this.marchInterval = window.setTimeout(() => this.playMarchNote(), this.currentTempo);
      return;
    }

    const note = this.marchNotes[this.marchNoteIndex];
    this.playTone(note.freq, note.duration, 'square', 0.15);

    this.marchNoteIndex = (this.marchNoteIndex + 1) % this.marchNotes.length;

    this.marchInterval = window.setTimeout(() => this.playMarchNote(), this.currentTempo);
  }

  stopMarch(): void {
    if (this.marchInterval !== null) {
      clearTimeout(this.marchInterval);
      this.marchInterval = null;
    }
  }

  // Adjust tempo based on remaining aliens (faster = fewer aliens)
  setMarchTempo(aliveCount: number): void {
    // Map alive count to tempo: 55 aliens = 1000ms, 1 alien = 100ms
    const maxAliens = 55;
    const maxTempo = 1000;
    const minTempo = 100;

    const ratio = aliveCount / maxAliens;
    this.currentTempo = minTempo + (maxTempo - minTempo) * ratio;
  }

  // Punchy sci-fi laser blast
  playPlayerShoot(): void {
    if (!this.audioContext) return;
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    const now = this.audioContext.currentTime;

    // Layer 1: High-pitched zap with fast sweep down
    const zap = this.audioContext.createOscillator();
    const zapGain = this.audioContext.createGain();
    zap.type = 'sawtooth';
    zap.frequency.setValueAtTime(2000, now);
    zap.frequency.exponentialRampToValueAtTime(100, now + 0.15);
    zapGain.gain.setValueAtTime(0.15, now);
    zapGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    zap.connect(zapGain);
    zapGain.connect(this.audioContext.destination);
    zap.start(now);
    zap.stop(now + 0.15);

    // Layer 2: Punchy mid thump for impact
    const thump = this.audioContext.createOscillator();
    const thumpGain = this.audioContext.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(150, now);
    thump.frequency.exponentialRampToValueAtTime(50, now + 0.1);
    thumpGain.gain.setValueAtTime(0.25, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    thump.connect(thumpGain);
    thumpGain.connect(this.audioContext.destination);
    thump.start(now);
    thump.stop(now + 0.1);

    // Layer 3: Noise burst for sizzle
    const bufferSize = this.audioContext.sampleRate * 0.08;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const decay = Math.pow(1 - (i / bufferSize), 2);
      data[i] = (Math.random() * 2 - 1) * decay;
    }
    const noise = this.audioContext.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = this.audioContext.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(3000, now);
    const noiseGain = this.audioContext.createGain();
    noiseGain.gain.setValueAtTime(0.1, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.audioContext.destination);
    noise.start(now);
    noise.stop(now + 0.08);
  }

  // Disabled - too noisy
  playAlienShoot(): void {}

  // Alien explosion sound - noise burst bang
  playAlienDeath(): void {
    if (!this.audioContext) return;
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    const duration = 0.15;

    // Create noise buffer
    const bufferSize = this.audioContext.sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    // Fill with noise that rapidly decays
    for (let i = 0; i < bufferSize; i++) {
      const decay = Math.pow(1 - (i / bufferSize), 3);
      data[i] = (Math.random() * 2 - 1) * decay;
    }

    const noise = this.audioContext.createBufferSource();
    noise.buffer = buffer;

    // Low-pass filter for more of a thump
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1500, this.audioContext.currentTime);
    filter.frequency.exponentialRampToValueAtTime(300, this.audioContext.currentTime + duration);

    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(0.25, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    noise.start();
    noise.stop(this.audioContext.currentTime + duration);
  }

  // Life lost - moderately sad tune ~5 seconds (uses Web Audio scheduling)
  playLifeLost(): void {
    const vol = 0.18;
    this.playSequence([
      // Initial descending "uh oh" motif
      { freq: 440, duration: 0.25, delay: 0 },       // A4
      { freq: 392, duration: 0.25, delay: 300 },     // G4
      { freq: 349, duration: 0.4, delay: 600 },      // F4
      // Melancholic middle section
      { freq: 330, duration: 0.2, delay: 1200 },     // E4
      { freq: 349, duration: 0.2, delay: 1450 },     // F4
      { freq: 330, duration: 0.2, delay: 1700 },     // E4
      { freq: 294, duration: 0.35, delay: 1950 },    // D4
      // Slight recovery hint
      { freq: 330, duration: 0.2, delay: 2500 },     // E4
      { freq: 349, duration: 0.2, delay: 2750 },     // F4
      { freq: 330, duration: 0.5, delay: 3000 },     // E4
      // Ending - minor resolve
      { freq: 262, duration: 0.3, delay: 3700, volume: vol * 0.8 },  // C4
      { freq: 330, duration: 0.3, delay: 3750, volume: vol * 0.8 },  // E4
      { freq: 392, duration: 0.8, delay: 3800, volume: vol * 0.6 },  // G4
    ], 'square', vol);
  }

  // Disabled - too noisy
  playPlayerHit(): void {}

  // Disabled - too noisy (alien shots)
  playShieldHit(): void {}

  // Turret shot hitting shield - big crunch sound
  playTurretShieldHit(): void {
    if (!this.audioContext) return;
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    const duration = 0.2;

    // Create noise buffer for crunch
    const bufferSize = this.audioContext.sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    // Fill with noise that rapidly decays
    for (let i = 0; i < bufferSize; i++) {
      const decay = Math.pow(1 - (i / bufferSize), 2);
      data[i] = (Math.random() * 2 - 1) * decay;
    }

    const noise = this.audioContext.createBufferSource();
    noise.buffer = buffer;

    // Band-pass filter for crunchier sound
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, this.audioContext.currentTime);
    filter.Q.setValueAtTime(1, this.audioContext.currentTime);

    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    noise.start();
    noise.stop(this.audioContext.currentTime + duration);
  }

  playWaveComplete(): void {
    // Happy triumphant fanfare - ~5 seconds (uses Web Audio scheduling)
    const vol = 0.2;
    this.playSequence([
      // Opening flourish
      { freq: 523, duration: 0.1, delay: 0 },       // C5
      { freq: 659, duration: 0.1, delay: 100 },     // E5
      { freq: 784, duration: 0.1, delay: 200 },     // G5
      { freq: 1047, duration: 0.3, delay: 300 },    // C6
      // Victory melody
      { freq: 784, duration: 0.15, delay: 700 },    // G5
      { freq: 880, duration: 0.15, delay: 900 },    // A5
      { freq: 784, duration: 0.15, delay: 1100 },   // G5
      { freq: 659, duration: 0.15, delay: 1300 },   // E5
      { freq: 784, duration: 0.4, delay: 1500 },    // G5
      // Second phrase - higher
      { freq: 880, duration: 0.15, delay: 2100 },   // A5
      { freq: 988, duration: 0.15, delay: 2300 },   // B5
      { freq: 1047, duration: 0.15, delay: 2500 },  // C6
      { freq: 988, duration: 0.15, delay: 2700 },   // B5
      { freq: 1047, duration: 0.5, delay: 2900 },   // C6
      // Final triumphant chord arpeggio
      { freq: 523, duration: 0.8, delay: 3600, volume: vol * 0.8 },   // C5
      { freq: 659, duration: 0.8, delay: 3650, volume: vol * 0.8 },   // E5
      { freq: 784, duration: 0.8, delay: 3700, volume: vol * 0.8 },   // G5
      { freq: 1047, duration: 1.0, delay: 3750 },   // C6
    ], 'square', vol);
  }

  playGameOver(): void {
    // Very sad game over dirge - ~5 seconds (uses Web Audio scheduling)
    const vol = 0.2;
    this.playSequence([
      // Dramatic opening - descending doom
      { freq: 392, duration: 0.4, delay: 0 },       // G4
      { freq: 349, duration: 0.4, delay: 450 },     // F4
      { freq: 330, duration: 0.4, delay: 900 },     // E4
      { freq: 294, duration: 0.6, delay: 1350 },    // D4
      // Mournful melody
      { freq: 262, duration: 0.3, delay: 2100 },    // C4
      { freq: 294, duration: 0.3, delay: 2450 },    // D4
      { freq: 262, duration: 0.3, delay: 2800 },    // C4
      { freq: 247, duration: 0.5, delay: 3150 },    // B3
      // Final death knell - very low
      { freq: 196, duration: 0.3, delay: 3800 },    // G3
      { freq: 165, duration: 0.3, delay: 4150 },    // E3
      { freq: 131, duration: 1.2, delay: 4500, volume: vol * 0.7 }, // C3
    ], 'square', vol);
  }

  // Wacky intro tune - plays before aliens form up (~4 seconds) - uses Web Audio scheduling
  playWaveIntro(): void {
    const vol = 0.18;
    this.playSequence([
      // Quirky ascending "here they come!" opening
      { freq: 262, duration: 0.08, delay: 0 },      // C4
      { freq: 330, duration: 0.08, delay: 80 },     // E4
      { freq: 392, duration: 0.08, delay: 160 },    // G4
      { freq: 523, duration: 0.15, delay: 240 },    // C5
      // Bouncy descending riff
      { freq: 494, duration: 0.08, delay: 450 },    // B4
      { freq: 440, duration: 0.08, delay: 530 },    // A4
      { freq: 392, duration: 0.08, delay: 610 },    // G4
      { freq: 330, duration: 0.12, delay: 690 },    // E4
      // Wacky chromatic wiggle
      { freq: 349, duration: 0.06, delay: 900 },    // F4
      { freq: 370, duration: 0.06, delay: 960 },    // F#4
      { freq: 392, duration: 0.06, delay: 1020 },   // G4
      { freq: 370, duration: 0.06, delay: 1080 },   // F#4
      { freq: 349, duration: 0.06, delay: 1140 },   // F4
      { freq: 330, duration: 0.15, delay: 1200 },   // E4
      // Second phrase - higher energy
      { freq: 523, duration: 0.08, delay: 1500 },   // C5
      { freq: 587, duration: 0.08, delay: 1580 },   // D5
      { freq: 659, duration: 0.08, delay: 1660 },   // E5
      { freq: 698, duration: 0.15, delay: 1740 },   // F5
      // Silly descending slide
      { freq: 659, duration: 0.06, delay: 1950 },   // E5
      { freq: 622, duration: 0.06, delay: 2010 },   // Eb5
      { freq: 587, duration: 0.06, delay: 2070 },   // D5
      { freq: 554, duration: 0.06, delay: 2130 },   // C#5
      { freq: 523, duration: 0.12, delay: 2190 },   // C5
      // Bouncy buildup
      { freq: 392, duration: 0.08, delay: 2400 },   // G4
      { freq: 440, duration: 0.08, delay: 2500 },   // A4
      { freq: 494, duration: 0.08, delay: 2600 },   // B4
      { freq: 523, duration: 0.08, delay: 2700 },   // C5
      { freq: 587, duration: 0.08, delay: 2800 },   // D5
      { freq: 659, duration: 0.08, delay: 2900 },   // E5
      // Final "get ready!" flourish
      { freq: 784, duration: 0.1, delay: 3100 },    // G5
      { freq: 880, duration: 0.1, delay: 3200 },    // A5
      { freq: 784, duration: 0.1, delay: 3300 },    // G5
      { freq: 659, duration: 0.1, delay: 3400 },    // E5
      { freq: 784, duration: 0.4, delay: 3550, volume: vol * 1.2 }, // G5
    ], 'square', vol);
  }

  // Flying saucer sound for wave intro
  private saucerOscillator: OscillatorNode | null = null;
  private saucerGain: GainNode | null = null;

  startSaucerSound(): void {
    if (!this.audioContext) return;

    // If context is suspended, wait for it to resume before playing
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().then(() => {
        this.startSaucerSoundNow();
      });
    } else if (this.audioContext.state === 'running') {
      this.startSaucerSoundNow();
    }
    // If state is 'closed', do nothing
  }

  private startSaucerSoundNow(): void {
    if (!this.audioContext) return;
    this.stopSaucerSound();

    // Create warbling UFO sound
    this.saucerOscillator = this.audioContext.createOscillator();
    const lfo = this.audioContext.createOscillator();
    const lfoGain = this.audioContext.createGain();
    this.saucerGain = this.audioContext.createGain();

    // Main oscillator - sine wave for smooth UFO sound
    this.saucerOscillator.type = 'sine';
    this.saucerOscillator.frequency.setValueAtTime(400, this.audioContext.currentTime);

    // LFO to modulate the frequency (creates warble)
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(8, this.audioContext.currentTime); // Warble speed
    lfoGain.gain.setValueAtTime(50, this.audioContext.currentTime); // Warble depth

    // Connect LFO to main oscillator frequency
    lfo.connect(lfoGain);
    lfoGain.connect(this.saucerOscillator.frequency);

    // Volume
    this.saucerGain.gain.setValueAtTime(0.12, this.audioContext.currentTime);

    // Connect to output
    this.saucerOscillator.connect(this.saucerGain);
    this.saucerGain.connect(this.audioContext.destination);

    // Start
    lfo.start();
    this.saucerOscillator.start();
  }

  stopSaucerSound(): void {
    if (this.saucerOscillator) {
      try {
        this.saucerOscillator.stop();
      } catch (e) {}
      this.saucerOscillator = null;
    }
    if (this.saucerGain) {
      this.saucerGain = null;
    }
  }
}
