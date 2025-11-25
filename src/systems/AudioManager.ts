// AudioManager - Handles all game sounds
// Using Web Audio API - minimal sounds to reduce noise

export class AudioManager {
  private audioContext: AudioContext | null = null;
  private marchInterval: number | null = null;
  private marchNoteIndex: number = 0;
  private currentTempo: number = 1000; // ms between notes

  // Classic march notes (approximation)
  private readonly marchNotes = [
    { freq: 55, duration: 0.1 },   // A1
    { freq: 49, duration: 0.1 },   // G1
    { freq: 46, duration: 0.1 },   // F#1
    { freq: 41, duration: 0.1 },   // E1
  ];

  constructor() {
    // Initialize audio context on first user interaction
    document.addEventListener('click', () => this.initAudio(), { once: true });
  }

  private initAudio(): void {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
  }

  private playTone(
    frequency: number,
    duration: number,
    type: OscillatorType = 'square',
    volume: number = 0.3
  ): void {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);

    gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      this.audioContext.currentTime + duration
    );

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + duration);
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

  // Life lost - moderately sad tune ~5 seconds
  playLifeLost(): void {
    if (!this.audioContext) return;

    const vol = 0.18;

    // Initial descending "uh oh" motif
    setTimeout(() => this.playTone(440, 0.25, 'square', vol), 0);     // A4
    setTimeout(() => this.playTone(392, 0.25, 'square', vol), 300);   // G4
    setTimeout(() => this.playTone(349, 0.4, 'square', vol), 600);    // F4

    // Melancholic middle section
    setTimeout(() => this.playTone(330, 0.2, 'square', vol), 1200);   // E4
    setTimeout(() => this.playTone(349, 0.2, 'square', vol), 1450);   // F4
    setTimeout(() => this.playTone(330, 0.2, 'square', vol), 1700);   // E4
    setTimeout(() => this.playTone(294, 0.35, 'square', vol), 1950);  // D4

    // Slight recovery hint (not as final as game over)
    setTimeout(() => this.playTone(330, 0.2, 'square', vol), 2500);   // E4
    setTimeout(() => this.playTone(349, 0.2, 'square', vol), 2750);   // F4
    setTimeout(() => this.playTone(330, 0.5, 'square', vol), 3000);   // E4

    // Ending - minor resolve
    setTimeout(() => this.playTone(262, 0.3, 'square', vol * 0.8), 3700);  // C4
    setTimeout(() => this.playTone(330, 0.3, 'square', vol * 0.8), 3750);  // E4
    setTimeout(() => this.playTone(392, 0.8, 'square', vol * 0.6), 3800);  // G4 - minor chord feel
  }

  // Disabled - too noisy
  playPlayerHit(): void {}

  // Disabled - too noisy (alien shots)
  playShieldHit(): void {}

  // Turret shot hitting shield - big crunch sound
  playTurretShieldHit(): void {
    if (!this.audioContext) return;

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
    // Happy triumphant fanfare - ~5 seconds
    const vol = 0.2;
    // Opening flourish
    setTimeout(() => this.playTone(523, 0.1, 'square', vol), 0);      // C5
    setTimeout(() => this.playTone(659, 0.1, 'square', vol), 100);    // E5
    setTimeout(() => this.playTone(784, 0.1, 'square', vol), 200);    // G5
    setTimeout(() => this.playTone(1047, 0.3, 'square', vol), 300);   // C6

    // Victory melody
    setTimeout(() => this.playTone(784, 0.15, 'square', vol), 700);   // G5
    setTimeout(() => this.playTone(880, 0.15, 'square', vol), 900);   // A5
    setTimeout(() => this.playTone(784, 0.15, 'square', vol), 1100);  // G5
    setTimeout(() => this.playTone(659, 0.15, 'square', vol), 1300);  // E5
    setTimeout(() => this.playTone(784, 0.4, 'square', vol), 1500);   // G5

    // Second phrase - higher
    setTimeout(() => this.playTone(880, 0.15, 'square', vol), 2100);  // A5
    setTimeout(() => this.playTone(988, 0.15, 'square', vol), 2300);  // B5
    setTimeout(() => this.playTone(1047, 0.15, 'square', vol), 2500); // C6
    setTimeout(() => this.playTone(988, 0.15, 'square', vol), 2700);  // B5
    setTimeout(() => this.playTone(1047, 0.5, 'square', vol), 2900);  // C6

    // Final triumphant chord arpeggio
    setTimeout(() => this.playTone(523, 0.8, 'square', vol * 0.8), 3600);  // C5
    setTimeout(() => this.playTone(659, 0.8, 'square', vol * 0.8), 3650);  // E5
    setTimeout(() => this.playTone(784, 0.8, 'square', vol * 0.8), 3700);  // G5
    setTimeout(() => this.playTone(1047, 1.0, 'square', vol), 3750);       // C6
  }

  playGameOver(): void {
    // Very sad game over dirge - ~5 seconds
    const vol = 0.2;

    // Dramatic opening - descending doom
    setTimeout(() => this.playTone(392, 0.4, 'square', vol), 0);      // G4
    setTimeout(() => this.playTone(349, 0.4, 'square', vol), 450);    // F4
    setTimeout(() => this.playTone(330, 0.4, 'square', vol), 900);    // E4
    setTimeout(() => this.playTone(294, 0.6, 'square', vol), 1350);   // D4

    // Mournful melody
    setTimeout(() => this.playTone(262, 0.3, 'square', vol), 2100);   // C4
    setTimeout(() => this.playTone(294, 0.3, 'square', vol), 2450);   // D4
    setTimeout(() => this.playTone(262, 0.3, 'square', vol), 2800);   // C4
    setTimeout(() => this.playTone(247, 0.5, 'square', vol), 3150);   // B3

    // Final death knell - very low
    setTimeout(() => this.playTone(196, 0.3, 'square', vol), 3800);   // G3
    setTimeout(() => this.playTone(165, 0.3, 'square', vol), 4150);   // E3
    setTimeout(() => this.playTone(131, 1.2, 'square', vol * 0.7), 4500); // C3 - long fade
  }

  // Wacky intro tune - plays before aliens form up (~4 seconds)
  playWaveIntro(): void {
    if (!this.audioContext) return;

    const vol = 0.18;

    // Quirky ascending "here they come!" opening
    setTimeout(() => this.playTone(262, 0.08, 'square', vol), 0);     // C4
    setTimeout(() => this.playTone(330, 0.08, 'square', vol), 80);    // E4
    setTimeout(() => this.playTone(392, 0.08, 'square', vol), 160);   // G4
    setTimeout(() => this.playTone(523, 0.15, 'square', vol), 240);   // C5

    // Bouncy descending riff
    setTimeout(() => this.playTone(494, 0.08, 'square', vol), 450);   // B4
    setTimeout(() => this.playTone(440, 0.08, 'square', vol), 530);   // A4
    setTimeout(() => this.playTone(392, 0.08, 'square', vol), 610);   // G4
    setTimeout(() => this.playTone(330, 0.12, 'square', vol), 690);   // E4

    // Wacky chromatic wiggle
    setTimeout(() => this.playTone(349, 0.06, 'square', vol), 900);   // F4
    setTimeout(() => this.playTone(370, 0.06, 'square', vol), 960);   // F#4
    setTimeout(() => this.playTone(392, 0.06, 'square', vol), 1020);  // G4
    setTimeout(() => this.playTone(370, 0.06, 'square', vol), 1080);  // F#4
    setTimeout(() => this.playTone(349, 0.06, 'square', vol), 1140);  // F4
    setTimeout(() => this.playTone(330, 0.15, 'square', vol), 1200);  // E4

    // Second phrase - higher energy
    setTimeout(() => this.playTone(523, 0.08, 'square', vol), 1500);  // C5
    setTimeout(() => this.playTone(587, 0.08, 'square', vol), 1580);  // D5
    setTimeout(() => this.playTone(659, 0.08, 'square', vol), 1660);  // E5
    setTimeout(() => this.playTone(698, 0.15, 'square', vol), 1740);  // F5

    // Silly descending slide
    setTimeout(() => this.playTone(659, 0.06, 'square', vol), 1950);  // E5
    setTimeout(() => this.playTone(622, 0.06, 'square', vol), 2010);  // Eb5
    setTimeout(() => this.playTone(587, 0.06, 'square', vol), 2070);  // D5
    setTimeout(() => this.playTone(554, 0.06, 'square', vol), 2130);  // C#5
    setTimeout(() => this.playTone(523, 0.12, 'square', vol), 2190);  // C5

    // Bouncy buildup
    setTimeout(() => this.playTone(392, 0.08, 'square', vol), 2400);  // G4
    setTimeout(() => this.playTone(440, 0.08, 'square', vol), 2500);  // A4
    setTimeout(() => this.playTone(494, 0.08, 'square', vol), 2600);  // B4
    setTimeout(() => this.playTone(523, 0.08, 'square', vol), 2700);  // C5
    setTimeout(() => this.playTone(587, 0.08, 'square', vol), 2800);  // D5
    setTimeout(() => this.playTone(659, 0.08, 'square', vol), 2900);  // E5

    // Final "get ready!" flourish
    setTimeout(() => this.playTone(784, 0.1, 'square', vol), 3100);   // G5
    setTimeout(() => this.playTone(880, 0.1, 'square', vol), 3200);   // A5
    setTimeout(() => this.playTone(784, 0.1, 'square', vol), 3300);   // G5
    setTimeout(() => this.playTone(659, 0.1, 'square', vol), 3400);   // E5
    setTimeout(() => this.playTone(784, 0.4, 'square', vol * 1.2), 3550); // G5 - strong finish
  }

  // Flying saucer sound for wave intro
  private saucerOscillator: OscillatorNode | null = null;
  private saucerGain: GainNode | null = null;

  startSaucerSound(): void {
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
