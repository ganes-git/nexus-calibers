/**
 * Audio Alert Manager for City-Wide ANPR Trajectory & Route-Anomaly Engine.
 * Uses Web Audio API to synthesize realistic tactical alarms, warbling sirens,
 * and multi-shade frequency alerts based on severity levels.
 * Implements persistent mute state and volume intensity controls.
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

  /**
   * Play realistic tactical alarm based on alert severity level:
   * - Level 3 ('critical' / 'blacklist' / 'clone'): Loud, urgent dual-tone warbling siren alarm
   * - Level 2 ('warning' / 'anomaly' / 'speed'): Distinct tactical double alert chime
   * - Level 1 ('info' / 'normal'): Crisp single frequency notification ping
   */
  playAlertTone(level = 'critical') {
    if (this.isMuted) return;

    try {
      this._initContext();
      if (!this.audioCtx) return;

      const normLevel = (level || 'warning').toLowerCase();

      if (normLevel === 'critical' || normLevel === 'blacklist' || normLevel === 'clone' || normLevel === 'danger') {
        this._playSeriousAlarm();
      } else if (normLevel === 'warning' || normLevel === 'anomaly' || normLevel === 'speed') {
        this._playWarningChime();
      } else {
        this._playInfoPing();
      }
    } catch (e) {
      console.warn("[AudioAlertManager] Audio playback error:", e.message);
    }
  }

  /**
   * Realistic Tactical Klaxon / Siren for Serious Alerts
   * Synthesizes a high-urgency alternating siren sweep (850Hz to 1350Hz) with harmonics
   */
  _playSeriousAlarm() {
    const now = this.audioCtx.currentTime;
    const duration = 0.85;

    // Master gain for loudness & punch
    const masterGain = this.audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.38, now);
    masterGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    masterGain.connect(this.audioCtx.destination);

    // Primary Warbling Siren Oscillator (Sawtooth for tactical sharpness)
    const osc1 = this.audioCtx.createOscillator();
    osc1.type = "sawtooth";
    
    // Siren frequency sweep: pulses 3 times rapidly
    osc1.frequency.setValueAtTime(750, now);
    osc1.frequency.linearRampToValueAtTime(1250, now + 0.15);
    osc1.frequency.linearRampToValueAtTime(750, now + 0.30);
    osc1.frequency.linearRampToValueAtTime(1350, now + 0.45);
    osc1.frequency.linearRampToValueAtTime(750, now + 0.60);
    osc1.frequency.linearRampToValueAtTime(1400, now + 0.75);

    // Low-pass filter to give realistic acoustics
    const filter = this.audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2200, now);

    // Secondary Sub-Harmonic Oscillator for fullness
    const osc2 = this.audioCtx.createOscillator();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(375, now);
    osc2.frequency.linearRampToValueAtTime(625, now + 0.15);
    osc2.frequency.linearRampToValueAtTime(375, now + 0.30);
    osc2.frequency.linearRampToValueAtTime(675, now + 0.45);
    osc2.frequency.linearRampToValueAtTime(375, now + 0.60);

    const gain2 = this.audioCtx.createGain();
    gain2.gain.setValueAtTime(0.25, now);

    osc1.connect(filter);
    filter.connect(masterGain);

    osc2.connect(gain2);
    gain2.connect(masterGain);

    osc1.start(now);
    osc1.stop(now + duration);
    osc2.start(now);
    osc2.stop(now + duration);
  }

  /**
   * Tactical Double Warning Chime for Anomaly & Speed Alerts
   */
  _playWarningChime() {
    const now = this.audioCtx.currentTime;

    // Chime 1: 720Hz
    const osc1 = this.audioCtx.createOscillator();
    const gain1 = this.audioCtx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(720, now);
    gain1.gain.setValueAtTime(0.24, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc1.connect(gain1);
    gain1.connect(this.audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.14);

    // Chime 2: 960Hz (Harmonic step)
    const osc2 = this.audioCtx.createOscillator();
    const gain2 = this.audioCtx.createGain();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(960, now + 0.12);
    gain2.gain.setValueAtTime(0.26, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc2.connect(gain2);
    gain2.connect(this.audioCtx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.28);
  }

  /**
   * Clean Info Notification Ping
   */
  _playInfoPing() {
    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.08);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }
}

window.audioAlertManager = new AudioAlertManager();
window.AudioAlert = {
  isMuted: () => window.audioAlertManager.isMuted,
  toggleMute: () => window.audioAlertManager.toggleMute(),
  beep: (level) => window.audioAlertManager.playAlertTone(level),
  playAlertTone: (level) => window.audioAlertManager.playAlertTone(level),
  playSeriousAlarm: () => window.audioAlertManager._playSeriousAlarm(),
};
