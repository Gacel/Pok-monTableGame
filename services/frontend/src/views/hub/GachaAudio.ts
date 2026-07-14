class GachaAudioEngine {
  private ctx: AudioContext | null = null;

  private initCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Juega un bip corto
  private playBeep(freq: number, startTime: number, duration: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, startTime);
    
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.1, startTime + 0.05);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  // Tensión absurda (Nivel Dios +2)
  public playTension() {
    this.initCtx();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    const totalDuration = 2.5;
    
    // Bips hiper-acelerados
    let beeps = 80;
    for (let i = 0; i < beeps; i++) {
      let t = i / beeps;
      let timeOffset = Math.pow(t, 2.0) * totalDuration; 
      let freq = 100 + (t * 1200); 
      this.playBeep(freq, now + timeOffset, 0.05);
    }

    // Sawtooth subiendo como una turbina
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(50, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + totalDuration);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + totalDuration * 0.8);
    gain.gain.linearRampToValueAtTime(0, now + totalDuration);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + totalDuration);
  }

  // Whoosh de meteorito cayendo
  public playMeteor() {
    this.initCtx();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    const bufferSize = this.ctx.sampleRate * 1.5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(4000, now);
    filter.frequency.exponentialRampToValueAtTime(100, now + 1.5);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    
    noise.start(now);
  }

  // Secuencia Épica Sideral (Bajos y arpegio)
  public playEpicSky() {
    this.initCtx();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Deep Bass drone (Inception style)
    const bass = this.ctx.createOscillator();
    bass.type = 'sawtooth';
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(100, now);
    filter.frequency.linearRampToValueAtTime(300, now + 3.5);
    
    bass.frequency.setValueAtTime(40, now);
    bass.frequency.exponentialRampToValueAtTime(80, now + 3.5);
    
    const bassGain = this.ctx.createGain();
    bassGain.gain.setValueAtTime(0, now);
    bassGain.gain.linearRampToValueAtTime(0.6, now + 0.5);
    bassGain.gain.linearRampToValueAtTime(0, now + 3.5);
    
    bass.connect(filter);
    filter.connect(bassGain);
    bassGain.connect(this.ctx.destination);
    bass.start(now);
    bass.stop(now + 3.5);
    
    // Arpegio mágico ascendente
    const freqs = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98, 2093.00];
    const notes = 40;
    const duration = 3.0; 
    for (let i=0; i<notes; i++) {
        let t = i/notes;
        let timeOffset = Math.pow(t, 1.5) * duration;
        let fIndex = Math.floor(t * (freqs.length - 1));
        this.playBeep(freqs[fIndex], now + timeOffset, 0.1);
    }
  }

  // Explosión (white noise sintetizado muy rápido)
  public playExplosion() {
    this.initCtx();
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 0.5; // Medio segundo de ruido
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    
    noise.start();
  }

  // Melodía de victoria según tier
  public playVictory(tier: number) {
    this.initCtx();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    let freqs: number[] = [];
    if (tier === 1) freqs = [392.00, 523.25]; // G4, C5
    else if (tier === 2) freqs = [392.00, 493.88, 587.33]; // G4, B4, D5
    else if (tier === 3) freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    else freqs = [523.25, 587.33, 659.25, 698.46, 783.99, 880.00, 987.77, 1046.50]; // C Mayor scale épica rápida
    
    freqs.forEach((freq, index) => {
      let duration = (index === freqs.length - 1) ? 1.0 : 0.15;
      this.playBeep(freq, now + (index * 0.15), duration);
    });
  }

  private currentTrack: HTMLAudioElement | null = null;

  // Reproduce un track y devuelve una promesa que se resuelve cuando termina
  public playTrack(url: string): Promise<void> {
    this.stopTrack();
    return new Promise((resolve) => {
      const audio = new Audio(url);
      this.currentTrack = audio;
      audio.onended = () => resolve();
      audio.onerror = () => resolve(); // Si falla, continuamos
      audio.play().catch(() => resolve());
    });
  }

  // Detiene el track actual
  public stopTrack(): void {
    if (this.currentTrack) {
      this.currentTrack.pause();
      this.currentTrack.currentTime = 0;
      this.currentTrack = null;
    }
  }
}

export const gachaAudio = new GachaAudioEngine();
