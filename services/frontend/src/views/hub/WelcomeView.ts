export class WelcomeView {
  private container: HTMLElement;
  private onStart: () => void;
  private state: 'INITIAL' | 'CINEMATIC' | 'READY' = 'INITIAL';

  constructor(container: HTMLElement, onStart: () => void) {
    this.container = container;
    this.onStart = onStart;
  }

  public render() {
    this.container.innerHTML = `
      <style>
        @keyframes welcomeFloat {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-20px) scale(1); }
        }
        @keyframes logoZoomIn {
          0% { transform: scale(0.1) translateY(100px); opacity: 0; filter: blur(10px) drop-shadow(0 4px 4px rgba(0,0,0,0)); }
          100% { transform: scale(1) translateY(0); opacity: 1; filter: blur(0) drop-shadow(0 4px 4px rgba(0,0,0,0.8)); }
        }
        @keyframes logoPulse {
          0% { transform: scale(1); filter: drop-shadow(0 4px 4px rgba(0,0,0,0.8)); }
          50% { transform: scale(1.15); filter: brightness(1.2) drop-shadow(0 0 30px rgba(255,255,255,0.6)); }
          100% { transform: scale(1); filter: drop-shadow(0 4px 4px rgba(0,0,0,0.8)); }
        }
        .animate-welcome-float {
          animation: welcomeFloat 5s ease-in-out infinite;
        }
        .animate-logo-intro {
          animation: logoZoomIn 4.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
        .animate-logo-pulse {
          animation: logoPulse 0.5s ease-out forwards;
        }
      </style>
      <div id="welcome-screen" class="absolute inset-0 w-full h-full bg-black flex flex-col items-center justify-center cursor-pointer overflow-hidden group">
        
        <!-- Background -->
        <img id="welcome-bg" src="/assets/welcome/fondo.png" alt="" class="absolute inset-0 w-full h-full object-cover transition-all duration-[5000ms] brightness-[0.15]" onerror="this.style.display='none'">
        
        <!-- Title / Logo placeholder -->
        <div id="logo-container" class="relative z-10 flex flex-col items-center origin-center w-full px-4 hidden">
          <img src="/assets/welcome/logo.png" alt="Logo" class="animate-logo-intro object-contain drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] max-w-[90vw]">
        </div>

        <!-- Press Start prompt -->
        <div id="press-start" class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse text-white flex items-center justify-center gap-8 text-4xl md:text-6xl lg:text-7xl w-full z-20" style="font-family: 'Press Start 2P', monospace; text-shadow: 4px 4px 0 #000, -4px -4px 0 #000, 4px -4px 0 #000, -4px 4px 0 #000, 4px 0 0 #000, -4px 0 0 #000, 0 4px 0 #000, 0 -4px 0 #000;">
          <span class="text-yellow-400 transform -translate-y-1">▶</span> PRESS START <span class="text-yellow-400 transform -translate-y-1">◀</span>
        </div>

        <p class="absolute bottom-6 right-6 text-xs text-white z-10 drop-shadow-lg" style="font-family: 'Press Start 2P', monospace; text-shadow: 2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000;">© 2026 ft_transcendence</p>
        
        <!-- Audio placeholder -->
        <audio id="welcome-music" loop src="/assets/welcome/theme.mp3"></audio>
      </div>
    `;

    const audio = this.container.querySelector('#welcome-music') as HTMLAudioElement;
    audio.volume = 0.5;
    
    const screen = document.getElementById('welcome-screen');
    const pressStart = document.getElementById('press-start');
    const bg = document.getElementById('welcome-bg');
    const logoContainer = document.getElementById('logo-container');
    const logoImg = logoContainer?.querySelector('img');

    const handleInteraction = () => {
      if (this.state === 'CINEMATIC') {
        // Locked during cinematic
        return;
      }

      if (this.state === 'INITIAL') {
        this.state = 'CINEMATIC';
        
        // Start audio (since it's a real click, browser allows it)
        audio.play().catch(console.error);

        // Hide PRESS START instantly
        if (pressStart) pressStart.style.display = 'none';

        // Illuminate background slightly
        if (bg) {
          bg.classList.remove('brightness-[0.15]');
          bg.classList.add('brightness-[0.35]');
        }

        // Show logo with intro animation
        if (logoContainer) {
          logoContainer.classList.remove('hidden');
        }

        // At 4.2 seconds (exactly 3s before 7.2s), trigger the strong pulse
        setTimeout(() => {
          if (logoImg) {
            logoImg.classList.remove('animate-logo-intro');
            logoImg.classList.add('animate-logo-pulse');
          }
        }, 4200);

        // Wait 7 seconds before floating
        setTimeout(() => {
          // Switch to infinite float animation
          if (logoImg) {
            logoImg.classList.remove('animate-logo-pulse');
            logoImg.classList.add('animate-welcome-float');
          }
        }, 7000);

        // Wait 7.2 seconds before showing PRESS START again
        setTimeout(() => {
          // State READY: Show PRESS START at bottom-third, and scale it down a bit
          this.state = 'READY';
          if (pressStart) {
            pressStart.classList.remove('top-1/2', '-translate-y-1/2', 'text-4xl', 'md:text-6xl', 'lg:text-7xl', 'gap-8');
            pressStart.classList.add('bottom-[25%]', 'text-3xl', 'md:text-4xl', 'lg:text-5xl', 'gap-6');
            pressStart.style.display = 'flex';
          }
          // Fully illuminate background instantly
          if (bg) {
            bg.classList.remove('transition-all', 'duration-[5000ms]', 'brightness-[0.35]');
            bg.classList.add('brightness-100');
          }
        }, 7200);

        return;
      }

      if (this.state === 'READY') {
        // Fade out screen
        if (screen) {
          screen.style.transition = 'opacity 0.5s ease';
          screen.style.opacity = '0';
        }

        // Audio fade out
        const fadeAudio = setInterval(() => {
          if (audio.volume >= 0.05) {
            audio.volume -= 0.05;
          } else {
            audio.pause();
            clearInterval(fadeAudio);
          }
        }, 50);

        // Remove keydown listener so it doesn't leak to other views
        document.removeEventListener('keydown', keydownHandler);

        setTimeout(() => {
          clearInterval(fadeAudio);
          audio.pause();
          this.onStart();
        }, 500);
      }
    };

    // Attach click listener
    screen?.addEventListener('click', handleInteraction);

    // Attach keyboard listener (Space or Enter)
    const keydownHandler = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault(); // Prevent scrolling down with Space
        handleInteraction();
      }
    };
    document.addEventListener('keydown', keydownHandler);
  }
}
