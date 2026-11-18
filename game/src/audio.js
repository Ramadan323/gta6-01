// All sound is synthesized with WebAudio: no audio files, nothing fetched. The engine is a
// low sawtooth whose pitch follows the car's speed; the siren is two alternating tones while
// police chase; the rest are short blips and noise bursts. Sound unlocks on the first user
// gesture (a browser rule) and M toggles it. Nothing here allocates while a tone plays except
// the short-lived nodes a one-shot creates.

export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenPhase = 0;
  let sirenTimer = 0;
  let muted = false;
  let unlocked = false;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      // Engine: a sawtooth through a lowpass, quiet until the car moves.
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      const engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: a sine that hops between two tones, silent until police are close.
      sirenOsc = context.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 720;
      sirenGain = context.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      unlocked = true;
      return true;
    } catch {
      return false;
    }
  }

  /** Call from any user gesture: creates (and resumes) the context. */
  function unlock() {
    if (ensure() && context.state === 'suspended') context.resume();
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!context || muted) return;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, context.currentTime + dur);
    gain.gain.setValueAtTime(vol, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(context.currentTime + dur);
  }

  function noise(dur, vol, freq) {
    if (!context || muted) return;
    const len = Math.max(1, Math.floor(context.sampleRate * dur));
    const buffer = context.createBuffer(1, len, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = context.createGain();
    gain.gain.value = vol;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
  }

  return {
    unlock,
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    /** speed 0..1 while driving; 0 and silent on foot. */
    engine(speed) {
      if (!context) return;
      const target = muted ? 0 : speed * 0.12;
      engineGain.gain.setTargetAtTime(target, context.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + speed * 110, context.currentTime, 0.08);
    },
    /** Call every frame: siren on while police are chasing, off otherwise. */
    siren(on, dt) {
      if (!context) return;
      if (!on) {
        sirenGain.gain.setTargetAtTime(0, context.currentTime, 0.1);
        return;
      }
      sirenGain.gain.setTargetAtTime(muted ? 0 : 0.05, context.currentTime, 0.1);
      sirenTimer -= dt;
      if (sirenTimer <= 0) {
        sirenPhase = 1 - sirenPhase;
        sirenOsc.frequency.setTargetAtTime(sirenPhase ? 720 : 540, context.currentTime, 0.03);
        sirenTimer = 0.32;
      }
    },
    chime() {
      tone(660, 0.09, 'sine', 0.22);
      setTimeout(() => tone(880, 0.12, 'sine', 0.22), 80);
    },
    mission() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'sine', 0.22), i * 95));
    },
    crash() {
      noise(0.22, 0.5, 900);
      tone(90, 0.2, 'sine', 0.4, 45);
    },
    punch() {
      noise(0.1, 0.35, 1400);
    },
    steal() {
      tone(440, 0.08, 'square', 0.12);
      setTimeout(() => tone(587, 0.1, 'square', 0.12), 70);
    },
    busted() {
      [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.25), i * 140));
    },
  };
}
