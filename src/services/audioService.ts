
class GameAudio {
  private ctx: AudioContext | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private turboOsc: OscillatorNode | null = null;
  private turboGain: GainNode | null = null;
  private ambientNoise: AudioBufferSourceNode | null = null;
  private ambientGain: GainNode | null = null;
  private initialized = false;

  constructor() {}

  public init() {
    if (this.initialized) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.setupEngine();
    this.setupAmbient();
    this.initialized = true;
  }

  private setupEngine() {
    if (!this.ctx) return;
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineGain = this.ctx.createGain();
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;

    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);
    
    this.engineOsc.start();
    this.engineGain.gain.value = 0.05;
  }

  private setupAmbient() {
    if (!this.ctx) return;
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    this.ambientNoise = this.ctx.createBufferSource();
    this.ambientNoise.buffer = noiseBuffer;
    this.ambientNoise.loop = true;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 400;
    filter.Q.value = 0.5;

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.02;

    this.ambientNoise.connect(filter);
    filter.connect(this.ambientGain);
    this.ambientGain.connect(this.ctx.destination);
    this.ambientNoise.start();
  }

  public update(speed: number, isTurbo: boolean) {
    if (!this.ctx || !this.engineOsc || !this.engineGain) return;
    
    // Engine pitch based on speed
    const baseFreq = 40 + (speed / 100) * 120;
    this.engineOsc.frequency.setTargetAtTime(baseFreq, this.ctx.currentTime, 0.1);
    
    // Engine volume based on speed (more aggressive when fast)
    const targetGain = 0.05 + (speed / 100) * 0.1;
    this.engineGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.1);

    if (isTurbo) {
      if (!this.turboOsc) {
        this.turboOsc = this.ctx.createOscillator();
        this.turboOsc.type = 'square';
        this.turboGain = this.ctx.createGain();
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 1000;

        this.turboOsc.connect(filter);
        filter.connect(this.turboGain);
        this.turboGain.connect(this.ctx.destination);
        this.turboOsc.start();
      }
      this.turboOsc.frequency.setTargetAtTime(400 + Math.random() * 50, this.ctx.currentTime, 0.05);
      this.turboGain!.gain.setTargetAtTime(0.03, this.ctx.currentTime, 0.1);
    } else if (this.turboGain) {
      this.turboGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
    }
  }

  public playCollision() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.3);
    
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.3);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
    
    // Add noise burst
    const bufferSize = 0.2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    noiseGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.2);
    noiseSource.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noiseSource.start();
  }

  public stop() {
    if (this.ctx) {
      this.ctx.suspend();
    }
  }

  public resume() {
    if (this.ctx) {
      this.ctx.resume();
    }
  }
}

export const audio = new GameAudio();
