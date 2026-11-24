// Lightweight procedural Web Audio synthesizer for crisp arcade game SFX (no external audio assets needed)

class SoundFXManager {
  private ctx: AudioContext | null = null;
  public muted = false;

  private getCtx(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  private playTone(
    freq: number,
    endFreq: number,
    durationSec: number,
    type: OscillatorType = 'triangle',
    gainPeak = 0.08
  ): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + durationSec);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(gainPeak, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + durationSec + 0.02);
    } catch {
      // Ignore audio errors
    }
  }

  buildTower(): void {
    this.playTone(320, 560, 0.14, 'triangle', 0.09);
  }

  upgradeTower(): void {
    this.playTone(440, 880, 0.22, 'sine', 0.1);
    setTimeout(() => this.playTone(660, 1180, 0.18, 'triangle', 0.08), 80);
  }

  sellCoins(): void {
    this.playTone(760, 1120, 0.12, 'sine', 0.07);
  }

  waveStart(): void {
    this.playTone(220, 330, 0.24, 'sawtooth', 0.07);
    setTimeout(() => this.playTone(330, 495, 0.28, 'triangle', 0.08), 110);
  }

  enemyCoin(): void {
    this.playTone(880, 1320, 0.08, 'sine', 0.035);
  }

  shot(isSplash: boolean): void {
    if (isSplash) {
      this.playTone(150, 55, 0.14, 'sawtooth', 0.05);
    } else {
      this.playTone(540, 260, 0.06, 'triangle', 0.025);
    }
  }

  victory(): void {
    [523, 659, 784, 1046].forEach((f, idx) => {
      setTimeout(() => this.playTone(f, f * 1.02, 0.22, 'triangle', 0.09), idx * 110);
    });
  }

  defeat(): void {
    [392, 330, 262, 196].forEach((f, idx) => {
      setTimeout(() => this.playTone(f, f * 0.9, 0.26, 'sawtooth', 0.08), idx * 140);
    });
  }
}

export const soundFX = new SoundFXManager();

