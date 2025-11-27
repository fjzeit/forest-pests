import { Game } from './game/Game';
import { registerSW } from 'virtual:pwa-register';

// Register service worker with update prompt
const updateSW = registerSW({
  onNeedRefresh() {
    // Show update prompt
    const prompt = document.getElementById('update-prompt');
    if (prompt) {
      prompt.style.display = 'flex';
    }
  },
  onOfflineReady() {
    console.log('App ready for offline use');
  }
});

// Handle update button clicks
document.addEventListener('DOMContentLoaded', () => {
  const updateBtn = document.getElementById('update-btn');
  const dismissBtn = document.getElementById('dismiss-btn');
  const prompt = document.getElementById('update-prompt');

  if (updateBtn) {
    updateBtn.addEventListener('click', () => {
      updateSW(true); // Reload with new version
    });
  }

  if (dismissBtn && prompt) {
    dismissBtn.addEventListener('click', () => {
      prompt.style.display = 'none';
    });
  }

  // Start the game
  const game = new Game();
  game.init();
});
