/**
 * Audio Alert Manager for City-Wide ANPR Trajectory & Route-Anomaly Engine.
 * Uses Web Audio API to synthesize a low-key, professional double-beep tone.
 * Implements persistent mute state via localStorage.
 * Single tone for all alert types per UI-UX.md design contract.
 */

class AudioAlertManager {
  constructor() {
    this.audioCtx = null;
    this.isMuted = localStorage.getItem("anpr_alert_muted") === "true";
  }

  _initContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem("anpr_alert_muted", this.isMuted ? "true" : "false");
    return this.isMuted;
  }

  setMuted(muted) {
    this.isMuted = !!muted;
    localStorage.setItem("anpr_alert_muted", this.isMuted ? "true" : "false");
  }

  playAlertTone() {
    if (this.isMuted) return;

    try {
      this._initContext();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;

      // Beep 1: 880Hz (A5), duration 70ms
      const osc1 = this.audioCtx.createOscillator();
      const gain1 = this.audioCtx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      osc1.connect(gain1);
      gain1.connect(this.audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.07);

      // Beep 2: 1046Hz (C6), duration 80ms, offset by 90ms
      const osc2 = this.audioCtx.createOscillator();
      const gain2 = this.audioCtx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1046, now + 0.09);
      gain2.gain.setValueAtTime(0.18, now + 0.09);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
      osc2.connect(gain2);
      gain2.connect(this.audioCtx.destination);
      osc2.start(now + 0.09);
      osc2.stop(now + 0.17);
    } catch (e) {
      console.warn("[AudioAlertManager] Audio playback prevented or uninitialized:", e.message);
    }
  }
}

window.audioAlertManager = new AudioAlertManager();
window.AudioAlert = {
  isMuted: () => window.audioAlertManager.isMuted,
  toggleMute: () => window.audioAlertManager.toggleMute(),
  beep: (tone) => window.audioAlertManager.playAlertTone(),
  playAlertTone: () => window.audioAlertManager.playAlertTone(),
};
