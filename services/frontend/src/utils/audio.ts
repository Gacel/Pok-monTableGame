export const clickSound = new Audio('/assets/sounds/click.mp3');
clickSound.volume = 0.5;

export function playClickSound() {
  clickSound.currentTime = 0;
  clickSound.play().catch(() => { /* Evita errores si el navegador bloquea autoplay */ });
}
