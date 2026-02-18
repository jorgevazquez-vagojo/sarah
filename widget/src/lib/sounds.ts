// Inline audio generation — no external files needed
const AudioCtx = typeof AudioContext !== 'undefined' ? AudioContext : (typeof (window as any).webkitAudioContext !== 'undefined' ? (window as any).webkitAudioContext : null);

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (!AudioCtx) return null;
  if (!ctx) ctx = new AudioCtx();
  return ctx;
}

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.3) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime);
  gain.gain.setValueAtTime(volume, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + duration);
}

export function playNotification() {
  playTone(880, 0.15, 'sine', 0.2);
  setTimeout(() => playTone(1100, 0.15, 'sine', 0.2), 150);
}

export function playChime() {
  playTone(523, 0.2, 'sine', 0.15);
  setTimeout(() => playTone(659, 0.2, 'sine', 0.15), 100);
  setTimeout(() => playTone(784, 0.3, 'sine', 0.15), 200);
}

export function playRing() {
  const ring = () => {
    playTone(440, 0.3, 'sine', 0.2);
    setTimeout(() => playTone(480, 0.3, 'sine', 0.2), 350);
  };
  ring();
  setTimeout(ring, 800);
}

export function playSound(name: string) {
  switch (name) {
    case 'notification': return playNotification();
    case 'chime': return playChime();
    case 'ring': return playRing();
  }
}
