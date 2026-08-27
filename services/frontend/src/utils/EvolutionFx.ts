/**
 * Multi-phase evolution animation using CSS keyframes + Web Animations API.
 * Usable over a hex (combat) or over an arbitrary screen position (hub).
 */

export function playEvolutionFx(
  parent: HTMLElement,
  x: number,
  y: number,
  newName?: string
): Promise<void> {
  const overlay = document.createElement('div');
  overlay.className = 'absolute pointer-events-none';
  overlay.style.left = `${x}px`;
  overlay.style.top = `${y}px`;
  overlay.style.transform = 'translate(-50%, -50%)';
  overlay.style.zIndex = '10000';
  parent.appendChild(overlay);

  const halo = document.createElement('div');
  halo.style.cssText =
    'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);' +
    'border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,0.9) 0%,rgba(255,255,200,0.4) 50%,transparent 70%);' +
    'width:20px;height:20px;';
  overlay.appendChild(halo);

  const stars = document.createElement('div');
  stars.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:0;height:0;';
  overlay.appendChild(stars);

  for (let i = 0; i < 12; i++) {
    const star = document.createElement('div');
    star.textContent = '✦';
    const angle = (i / 12) * 360;
    star.style.cssText =
      `position:absolute;left:50%;top:50%;color:#fde047;font-size:14px;` +
      `transform:translate(-50%,-50%) rotate(${angle}deg) translateY(0px);opacity:0;`;
    stars.appendChild(star);
  }

  const labelEl = newName ? document.createElement('div') : null;
  if (labelEl && newName) {
    labelEl.textContent = newName.toUpperCase();
    labelEl.style.cssText =
      'position:absolute;left:50%;top:50%;transform:translate(-50%,40px);' +
      'font-family:"Press Start 2P",monospace;font-size:10px;color:#fde047;white-space:nowrap;' +
      'text-shadow:2px 0 0 #000,-2px 0 0 #000,0 2px 0 #000,0 -2px 0 #000;opacity:0;';
    overlay.appendChild(labelEl);
  }

  return new Promise<void>((resolve) => {
    // Phase 1 (0-0.5s): halo expands, white pulse
    halo.animate(
      [
        { width: '20px', height: '20px', opacity: 0.3 },
        { width: '120px', height: '120px', opacity: 1, offset: 0.5 },
        { width: '160px', height: '160px', opacity: 0.8 },
      ],
      { duration: 500, easing: 'ease-out', fill: 'forwards' }
    );

    // Phase 2 (0.5-1.5s): stars spiral outward
    setTimeout(() => {
      const starEls = stars.querySelectorAll('div');
      starEls.forEach((s, i) => {
        const angle = (i / 12) * 360;
        const dist = 50 + Math.random() * 30;
        (s as HTMLElement).animate(
          [
            { transform: `translate(-50%,-50%) rotate(${angle}deg) translateY(0px)`, opacity: 0 },
            { transform: `translate(-50%,-50%) rotate(${angle + 180}deg) translateY(-${dist}px)`, opacity: 1, offset: 0.4 },
            { transform: `translate(-50%,-50%) rotate(${angle + 360}deg) translateY(-${dist + 20}px)`, opacity: 0 },
          ],
          { duration: 1000, easing: 'ease-out', fill: 'forwards', delay: i * 30 }
        );
      });
    }, 500);

    // Phase 3 (1.5-2.5s): final flash + name label
    setTimeout(() => {
      halo.animate(
        [
          { width: '160px', height: '160px', opacity: 0.8 },
          { width: '200px', height: '200px', opacity: 1, offset: 0.3 },
          { width: '40px', height: '40px', opacity: 0 },
        ],
        { duration: 800, easing: 'ease-in-out', fill: 'forwards' }
      );
      if (labelEl) {
        labelEl.animate(
          [
            { opacity: 0, transform: 'translate(-50%,50px)' },
            { opacity: 1, transform: 'translate(-50%,30px)', offset: 0.4 },
            { opacity: 1, transform: 'translate(-50%,30px)', offset: 0.8 },
            { opacity: 0, transform: 'translate(-50%,20px)' },
          ],
          { duration: 1000, easing: 'ease-out', fill: 'forwards' }
        );
      }
    }, 1500);

    setTimeout(() => {
      overlay.remove();
      resolve();
    }, 2500);
  });
}
