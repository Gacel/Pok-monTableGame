/**
 * Cinematic evolution animation — fullscreen overlay with 4 phases + Web Audio.
 * Replaces the basic T11.6 version. Skip with Escape or click jumps to Phase 4.
 */

import { getSprite } from '../net/PokeSprites';

const FONT = "font-family:'Press Start 2P',monospace;";

let audioCtx: AudioContext | null = null;
function ctx(): AudioContext {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

interface ActiveNodes {
  oscs: OscillatorNode[];
  gains: GainNode[];
  sources: AudioBufferSourceNode[];
}

function stopAll(nodes: ActiveNodes) {
  for (const o of nodes.oscs) try { o.stop(); } catch { /* already stopped */ }
  for (const s of nodes.sources) try { s.stop(); } catch { /* already stopped */ }
  nodes.oscs.length = 0;
  nodes.gains.length = 0;
  nodes.sources.length = 0;
}

function phase1Audio(nodes: ActiveNodes): void {
  const ac = ctx();
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(80, now);
  osc.frequency.exponentialRampToValueAtTime(600, now + 0.6);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.15, now + 0.1);
  gain.gain.linearRampToValueAtTime(0.12, now + 0.5);
  gain.gain.linearRampToValueAtTime(0, now + 0.6);
  osc.connect(gain).connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.7);
  nodes.oscs.push(osc);
  nodes.gains.push(gain);
}

function phase2Audio(nodes: ActiveNodes): void {
  const ac = ctx();
  const now = ac.currentTime;

  const osc1 = ac.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(261.63, now);
  const osc2 = ac.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(329.63, now);
  const osc3 = ac.createOscillator();
  osc3.type = 'sine';
  osc3.frequency.setValueAtTime(392, now);

  const lfo = ac.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.setValueAtTime(5, now);
  const lfoGain = ac.createGain();
  lfoGain.gain.setValueAtTime(8, now);
  lfo.connect(lfoGain);
  lfoGain.connect(osc1.frequency);
  lfoGain.connect(osc2.frequency);
  lfoGain.connect(osc3.frequency);

  const chordGain = ac.createGain();
  chordGain.gain.setValueAtTime(0, now);
  chordGain.gain.linearRampToValueAtTime(0.08, now + 0.2);
  chordGain.gain.setValueAtTime(0.08, now + 1.0);
  chordGain.gain.linearRampToValueAtTime(0, now + 1.2);

  osc1.connect(chordGain);
  osc2.connect(chordGain);
  osc3.connect(chordGain);
  chordGain.connect(ac.destination);

  [osc1, osc2, osc3, lfo].forEach(o => { o.start(now); o.stop(now + 1.3); });
  nodes.oscs.push(osc1, osc2, osc3, lfo);
  nodes.gains.push(chordGain, lfoGain);

  const bufLen = ac.sampleRate * 1.2;
  const buf = ac.createBuffer(1, bufLen, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;
  const noise = ac.createBufferSource();
  noise.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(200, now);
  filter.frequency.exponentialRampToValueAtTime(3000, now + 1.2);
  const nGain = ac.createGain();
  nGain.gain.setValueAtTime(0, now);
  nGain.gain.linearRampToValueAtTime(0.06, now + 0.3);
  nGain.gain.linearRampToValueAtTime(0, now + 1.2);
  noise.connect(filter).connect(nGain).connect(ac.destination);
  noise.start(now);
  nodes.sources.push(noise);
  nodes.gains.push(nGain);
}

function phase3Audio(nodes: ActiveNodes): void {
  const ac = ctx();
  const now = ac.currentTime;
  const bufLen = ac.sampleRate * 0.2;
  const buf = ac.createBuffer(1, bufLen, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;
  const noise = ac.createBufferSource();
  noise.buffer = buf;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.25, now);
  gain.gain.linearRampToValueAtTime(0, now + 0.2);
  noise.connect(gain).connect(ac.destination);
  noise.start(now);
  nodes.sources.push(noise);
  nodes.gains.push(gain);
}

function phase4Audio(nodes: ActiveNodes): void {
  const ac = ctx();
  const now = ac.currentTime;
  const notes = [261.63, 329.63, 392, 523.25];
  notes.forEach((freq, i) => {
    const osc = ac.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, now + i * 0.15);
    const gain = ac.createGain();
    const start = now + i * 0.15;
    const dur = i === notes.length - 1 ? 0.6 : 0.12;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.1, start + 0.02);
    gain.gain.linearRampToValueAtTime(0, start + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(start);
    osc.stop(start + dur + 0.05);
    nodes.oscs.push(osc);
    nodes.gains.push(gain);
  });
}

function injectStyles(): void {
  if (document.getElementById('evo-fx-styles')) return;
  const style = document.createElement('style');
  style.id = 'evo-fx-styles';
  style.textContent = `
    @keyframes evo-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes evo-particle {
      0% { transform: translate(-50%,-50%) rotate(var(--a)) translateY(0); opacity:0; }
      20% { opacity:1; }
      100% { transform: translate(-50%,-50%) rotate(var(--a)) translateY(calc(-1 * var(--d))); opacity:0; }
    }
    @keyframes evo-pulse {
      0% { transform: translate(-50%,-50%) scale(0.2); opacity:0.9; }
      100% { transform: translate(-50%,-50%) scale(3); opacity:0; }
    }
    @keyframes evo-star-scatter {
      0% { transform: translate(-50%,-50%) scale(0); opacity:1; }
      50% { opacity:1; }
      100% { transform: translate(var(--sx), var(--sy)) scale(1.2); opacity:0; }
    }
    @keyframes evo-bounce-in {
      0% { transform: translate(-50%,-50%) scale(0.5); opacity:0; }
      60% { transform: translate(-50%,-50%) scale(1.1); opacity:1; }
      80% { transform: translate(-50%,-50%) scale(0.95); }
      100% { transform: translate(-50%,-50%) scale(1); opacity:1; }
    }
    @keyframes evo-name-float {
      0% { transform: translateX(-50%) translateY(20px); opacity:0; }
      40% { opacity:1; }
      100% { transform: translateX(-50%) translateY(0); opacity:1; }
    }
  `;
  document.head.appendChild(style);
}

/**
 * Play the cinematic evolution effect. Fullscreen overlay, 4 phases, synthesized audio.
 * The _parent, _x, _y params are kept for backward compat but ignored — overlay is fullscreen.
 */
export function playEvolutionFx(
  _parent: HTMLElement,
  _x: number,
  _y: number,
  newName?: string
): Promise<void> {
  injectStyles();

  const nodes: ActiveNodes = { oscs: [], gains: [], sources: [] };
  let skipped = false;
  let resolveMain: () => void;

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.85);';

  const spriteOld = document.createElement('div');
  spriteOld.style.cssText = 'position:absolute;left:50%;top:45%;transform:translate(-50%,-50%);width:96px;height:96px;image-rendering:pixelated;transition:filter 0.6s;';
  overlay.appendChild(spriteOld);

  const spriteNew = document.createElement('div');
  spriteNew.style.cssText = 'position:absolute;left:50%;top:45%;transform:translate(-50%,-50%) scale(0.5);width:120px;height:120px;image-rendering:pixelated;opacity:0;';
  overlay.appendChild(spriteNew);

  const pulseRing = document.createElement('div');
  pulseRing.style.cssText = 'position:absolute;left:50%;top:45%;width:60px;height:60px;border-radius:50%;border:3px solid rgba(255,255,255,0.7);transform:translate(-50%,-50%) scale(0.2);opacity:0;pointer-events:none;';
  overlay.appendChild(pulseRing);

  const vortex = document.createElement('div');
  vortex.style.cssText = 'position:absolute;left:50%;top:45%;width:200px;height:200px;transform:translate(-50%,-50%);opacity:0;pointer-events:none;';
  overlay.appendChild(vortex);

  const flashOverlay = document.createElement('div');
  flashOverlay.style.cssText = 'position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:1;';
  overlay.appendChild(flashOverlay);

  const nameLabel = document.createElement('div');
  nameLabel.style.cssText = `position:absolute;left:50%;top:65%;transform:translateX(-50%) translateY(20px);${FONT}font-size:14px;color:#fde047;text-shadow:2px 2px 0 #000,-2px 2px 0 #000,2px -2px 0 #000,-2px -2px 0 #000;white-space:nowrap;opacity:0;z-index:2;`;
  nameLabel.textContent = (newName ?? '').toUpperCase();
  overlay.appendChild(nameLabel);

  const skipHint = document.createElement('div');
  skipHint.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);${FONT}font-size:7px;color:rgba(255,255,255,0.4);z-index:3;`;
  skipHint.textContent = 'ESC / CLICK para saltar';
  overlay.appendChild(skipHint);

  document.body.appendChild(overlay);

  function doPhase4() {
    stopAll(nodes);
    skipped = true;
    spriteOld.style.display = 'none';
    vortex.style.opacity = '0';
    pulseRing.style.opacity = '0';
    flashOverlay.style.opacity = '0';
    skipHint.style.display = 'none';

    spriteNew.style.opacity = '1';
    spriteNew.style.animation = 'evo-bounce-in 0.8s ease-out forwards';

    nameLabel.style.animation = 'evo-name-float 0.6s ease-out 0.3s forwards';

    for (let i = 0; i < 16; i++) {
      const star = document.createElement('div');
      star.textContent = '✨';
      const sx = (Math.random() - 0.5) * 300;
      const sy = (Math.random() - 0.5) * 200;
      star.style.cssText = `position:absolute;left:50%;top:45%;font-size:${10 + Math.random() * 12}px;z-index:2;--sx:${sx}px;--sy:${sy}px;animation:evo-star-scatter ${0.6 + Math.random() * 0.4}s ease-out ${Math.random() * 0.3}s forwards;pointer-events:none;`;
      overlay.appendChild(star);
    }

    phase4Audio(nodes);

    setTimeout(() => {
      overlay.remove();
      resolveMain();
    }, 1200);
  }

  function onSkip() {
    if (skipped) return;
    doPhase4();
  }

  overlay.addEventListener('click', onSkip);
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onSkip(); };
  document.addEventListener('keydown', onKey);

  const promise = new Promise<void>((resolve) => {
    resolveMain = () => {
      document.removeEventListener('keydown', onKey);
      resolve();
    };
  });

  // Load new sprite in background
  if (newName) {
    void getSprite(newName).then(url => {
      if (!url) return;
      const img = document.createElement('img');
      img.src = url;
      img.style.cssText = 'width:100%;height:100%;object-fit:contain;image-rendering:pixelated;';
      spriteNew.appendChild(img);
    });
  }

  // Phase 1 — White flash (0–0.6s)
  phase1Audio(nodes);
  spriteOld.style.filter = 'brightness(1)';
  spriteOld.animate([
    { filter: 'brightness(1) saturate(1)' },
    { filter: 'brightness(3) saturate(0)', offset: 0.8 },
    { filter: 'brightness(4) saturate(0)' },
  ], { duration: 600, fill: 'forwards' });

  pulseRing.style.animation = 'evo-pulse 0.6s ease-out forwards';

  // Phase 2 — Vortex (0.6–1.8s)
  setTimeout(() => {
    if (skipped) return;
    phase2Audio(nodes);

    vortex.style.opacity = '1';
    vortex.style.animation = 'evo-spin 1.2s linear infinite';

    for (let i = 0; i < 24; i++) {
      const p = document.createElement('div');
      const angle = (i / 24) * 360;
      const dist = 60 + Math.random() * 40;
      p.style.cssText = `position:absolute;left:50%;top:50%;width:4px;height:4px;border-radius:50%;background:${['#fff','#fde047','#60a5fa','#f472b6'][i % 4]};--a:${angle}deg;--d:${dist}px;animation:evo-particle ${0.8 + Math.random() * 0.4}s ease-out ${(i * 0.05)}s infinite;pointer-events:none;`;
      vortex.appendChild(p);
    }

    spriteOld.style.transition = 'transform 1.2s ease-in-out';
    spriteOld.style.transform = 'translate(-50%,-50%) scale(1.4)';
  }, 600);

  // Phase 3 — Blinding flash (1.8–2.0s)
  setTimeout(() => {
    if (skipped) return;
    phase3Audio(nodes);

    flashOverlay.animate([
      { opacity: 0 },
      { opacity: 1, offset: 0.3 },
      { opacity: 1 },
    ], { duration: 200, fill: 'forwards' });
  }, 1800);

  // Phase 4 — Reveal (2.0–3.2s)
  setTimeout(() => {
    if (skipped) return;
    doPhase4();
  }, 2000);

  return promise;
}
