// AudioManager - Handles all game sounds
// Using Web Audio API - minimal sounds to reduce noise

export class AudioManager {
  private audioContext: AudioContext | null = null;
  private marchInterval: number | null = null;
  private marchNoteIndex: number = 0;
  private currentTempo: number = 1000; // ms between notes

  // Classic Space Invaders march notes (approximation)
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

  // Disabled - too noisy
  playPlayerShoot(): void {}

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

  // Life lost - sad descending tones
  playLifeLost(): void {
    if (!this.audioContext) return;

    // Descending sad tones
    const notes = [
      { freq: 400, time: 0, duration: 0.2 },
      { freq: 300, time: 0.2, duration: 0.2 },
      { freq: 200, time: 0.4, duration: 0.2 },
      { freq: 100, time: 0.6, duration: 0.4 },
    ];

    notes.forEach(note => {
      setTimeout(() => {
        this.playTone(note.freq, note.duration, 'square', 0.15);
      }, note.time * 1000);
    });
  }

  // Disabled - too noisy
  playPlayerHit(): void {}

  // Disabled - too noisy
  playShieldHit(): void {}

  playWaveComplete(): void {
    // Triumphant ascending tones
    setTimeout(() => this.playTone(440, 0.1, 'square', 0.2), 0);
    setTimeout(() => this.playTone(554, 0.1, 'square', 0.2), 100);
    setTimeout(() => this.playTone(659, 0.1, 'square', 0.2), 200);
    setTimeout(() => this.playTone(880, 0.3, 'square', 0.2), 300);
  }

  playGameOver(): void {
    // Descending sad tones
    setTimeout(() => this.playTone(440, 0.2, 'square', 0.2), 0);
    setTimeout(() => this.playTone(330, 0.2, 'square', 0.2), 200);
    setTimeout(() => this.playTone(262, 0.2, 'square', 0.2), 400);
    setTimeout(() => this.playTone(196, 0.4, 'square', 0.2), 600);
  }
}
