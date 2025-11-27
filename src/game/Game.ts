import * as THREE from 'three';
import { GameConfig } from './GameConfig';
import { SceneManager } from '../rendering/SceneManager';
import { InputManager } from '../systems/InputManager';
import { TouchInputManager } from '../systems/TouchInputManager';
import { PlayerTurret } from '../entities/PlayerTurret';
import { AlienFormation } from '../entities/AlienFormation';
import { Projectile, ProjectileType } from '../entities/Projectile';
import { Shield } from '../entities/Shield';
import { CollisionSystem } from '../systems/CollisionSystem';
import { CRTEffect } from '../rendering/shaders/CRTEffect';
import { AudioManager } from '../systems/AudioManager';
import { ExplosionManager } from '../rendering/ExplosionEffect';

export enum GameState {
  MENU,
  PLAYING,
  PAUSED,
  GAME_OVER,
  WAVE_COMPLETE,
  WAVE_COMPLETE_DELAY,
  LIFE_LOST,
  LIFE_LOST_DELAY,
  WAVE_INTRO,
  INVASION_LANDING,
}

export class Game {
  private sceneManager!: SceneManager;
  private inputManager!: InputManager;
  private touchInputManager?: TouchInputManager;
  private crtEffect!: CRTEffect;
  private audioManager!: AudioManager;
  private explosionManager!: ExplosionManager;

  private player!: PlayerTurret;
  private alienFormation!: AlienFormation;
  private shields: Shield[] = [];
  private projectiles: Projectile[] = [];

  private collisionSystem!: CollisionSystem;

  private state: GameState = GameState.MENU;
  private score: number = 0;
  private lives: number = GameConfig.gameplay.lives;
  private currentHealth: number = GameConfig.gameplay.hitsPerLife;
  private wave: number = 1;

  private lastTime: number = 0;
  private waveCompleteDelayTimer: number = 0;
  private lifeLostDelayTimer: number = 0;
  private waveCompleteTuneTimer: number = 0;  // Auto-continue after tune
  private lifeLostTuneTimer: number = 0;      // Auto-continue after tune
  private gameTime: number = 0;  // Track game time for dive shots

  // UI Elements
  private scoreElement!: HTMLElement;
  private livesElement!: HTMLElement;
  private waveElement!: HTMLElement;
  private messageElement!: HTMLElement;
  private startPrompt!: HTMLElement;
  private crosshair!: HTMLElement;
  private damageOverlay!: HTMLElement;
  private uiOverlay!: HTMLElement;
  private healthBar!: HTMLElement;

  init(): void {
    // Get UI elements
    this.scoreElement = document.getElementById('score')!;
    this.livesElement = document.getElementById('hud-right')!;
    this.waveElement = document.getElementById('wave')!;
    this.messageElement = document.getElementById('game-message')!;
    this.startPrompt = document.getElementById('start-screen')!;
    this.crosshair = document.getElementById('crosshair')!;
    this.damageOverlay = document.getElementById('damage-overlay')!;
    this.uiOverlay = document.getElementById('ui-overlay')!;
    this.healthBar = document.getElementById('health-bar')!;

    // Initialize systems
    this.sceneManager = new SceneManager();
    this.inputManager = new InputManager();
    this.audioManager = new AudioManager();
    this.collisionSystem = new CollisionSystem();
    this.explosionManager = new ExplosionManager(this.sceneManager.scene);

    // Initialize touch controls on mobile
    if (this.inputManager.isMobile()) {
      this.touchInputManager = new TouchInputManager(this.inputManager);
    }

    // Initialize CRT post-processing
    this.crtEffect = new CRTEffect(
      this.sceneManager.renderer,
      this.sceneManager.scene,
      this.sceneManager.camera
    );

    // Initialize player
    this.player = new PlayerTurret(this.sceneManager.camera, this.sceneManager.scene);

    // Initialize alien formation (hidden until game starts)
    this.alienFormation = new AlienFormation(this.sceneManager.scene);
    this.alienFormation.hideAll();

    // Initialize shields
    this.createShields();

    // Set up space to start, click for pointer lock during gameplay
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    document.addEventListener('click', () => this.handleClick());

    // Touch start for mobile (on start screen and game message for restart)
    if (this.inputManager.isMobile()) {
      this.startPrompt.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
      this.messageElement.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
    }

    // Start game loop
    this.lastTime = performance.now();
    this.animate();

    this.updateUI();
  }

  private createShields(): void {
    const config = GameConfig.shields;
    const totalWidth = (config.count - 1) * config.spacing;
    const startX = -totalWidth / 2;

    // Shield health decreases with wave: 3 at wave 1, down to 1 at wave 100
    const baseHealth = 3;
    const minHealth = 1;
    const waveProgress = Math.min((this.wave - 1) / 99, 1);
    const shieldHealth = Math.max(minHealth, Math.round(baseHealth - (baseHealth - minHealth) * waveProgress));

    for (let i = 0; i < config.count; i++) {
      const x = startX + i * config.spacing;
      const shield = new Shield(
        new THREE.Vector3(x, config.height_y, -config.distance),
        this.sceneManager.scene,
        shieldHealth
      );
      this.shields.push(shield);
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (this.state === GameState.MENU) {
      e.preventDefault();
      this.startGame();
    } else if (this.state === GameState.GAME_OVER && e.code === 'Space') {
      e.preventDefault();
      this.resetGame();
      this.startGame();
    }
  }

  private handleTouchStart(e: TouchEvent): void {
    if (this.state === GameState.MENU) {
      e.preventDefault();
      this.startGame();
    } else if (this.state === GameState.GAME_OVER) {
      e.preventDefault();
      this.resetGame();
      this.startGame();
    }
  }

  private handleClick(): void {
    if (this.state === GameState.PLAYING && !this.inputManager.isMobile()) {
      // Request pointer lock for mouse control (desktop only)
      document.body.requestPointerLock();
    }
  }

  private startGame(): void {
    this.state = GameState.WAVE_INTRO;
    this.startPrompt.style.display = 'none';
    this.messageElement.style.display = 'none';
    this.crosshair.style.display = 'block';

    if (this.inputManager.isMobile()) {
      // Mobile: request fullscreen and show touch controls
      this.requestFullscreen();
      this.touchInputManager?.show();
    } else {
      // Desktop: request pointer lock
      document.body.requestPointerLock();
    }

    // Start the fly-in intro sequence
    this.alienFormation.startIntro();
    this.audioManager.startSaucerSound();
  }

  private async requestFullscreen(): Promise<void> {
    // Request fullscreen on document element so body centering still works
    const elem = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
      msRequestFullscreen?: () => Promise<void>;
    };

    try {
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) {
        await elem.msRequestFullscreen();
      }
    } catch (err) {
      // Fullscreen request may fail silently on some browsers
      console.log('Fullscreen request failed:', err);
    }
  }

  private resetGame(): void {
    this.score = 0;
    this.lives = GameConfig.gameplay.lives;
    this.currentHealth = GameConfig.gameplay.hitsPerLife;
    this.wave = 1;
    this.gameTime = 0;

    // Clear projectiles
    this.projectiles.forEach(p => p.destroy(this.sceneManager.scene));
    this.projectiles = [];

    // Reset shields
    this.shields.forEach(s => s.destroy(this.sceneManager.scene));
    this.shields = [];
    this.createShields();

    // Reset alien formation
    this.alienFormation.reset();

    // Reset player position
    this.player.reset();

    this.updateUI();
  }

  private nextWave(): void {
    this.wave++;
    this.state = GameState.WAVE_INTRO;
    this.messageElement.style.display = 'none';

    // Clear remaining projectiles
    this.projectiles.forEach(p => p.destroy(this.sceneManager.scene));
    this.projectiles = [];

    // Reset shields (partially damaged from previous wave could be kept, but reset for simplicity)
    this.shields.forEach(s => s.destroy(this.sceneManager.scene));
    this.shields = [];
    this.createShields();

    // Reset alien formation with increased difficulty
    this.alienFormation.reset(this.wave);

    // Start the fly-in intro sequence
    this.alienFormation.startIntro();
    this.audioManager.startSaucerSound();
    this.updateUI();
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate());

    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1); // Cap delta to prevent huge jumps
    this.lastTime = currentTime;

    if (this.state === GameState.PLAYING) {
      this.update(deltaTime);
    } else if (this.state === GameState.WAVE_INTRO) {
      // Update fly-in sequence - player can shoot during intro
      this.inputManager.update();
      this.player.update(deltaTime, this.inputManager);

      // Allow player to shoot during intro
      if (this.inputManager.isFiring() && this.player.canFire()) {
        this.firePlayerShot();
        this.inputManager.consumeFire();
      }

      // Update projectiles
      this.projectiles = this.projectiles.filter(projectile => {
        projectile.update(deltaTime);
        if (projectile.isOutOfBounds()) {
          projectile.destroy(this.sceneManager.scene);
          return false;
        }
        return true;
      });

      // Check collisions (only player shots vs aliens during intro)
      this.checkCollisions();

      // Update explosions
      this.explosionManager.update(deltaTime);

      const introComplete = this.alienFormation.updateIntro(deltaTime);
      if (introComplete) {
        // Intro finished, start playing
        this.state = GameState.PLAYING;
        this.audioManager.stopSaucerSound();
        this.audioManager.startMarch();
      }
    } else if (this.state === GameState.WAVE_COMPLETE_DELAY) {
      // Continue updating explosions during delay
      this.explosionManager.update(deltaTime);
      this.waveCompleteDelayTimer -= deltaTime;
      // Wait for both timer and all explosions to finish
      if (this.waveCompleteDelayTimer <= 0 && !this.explosionManager.hasActiveParticles()) {
        this.showWaveComplete();
      }
    } else if (this.state === GameState.LIFE_LOST_DELAY) {
      // Continue updating explosions during delay
      this.explosionManager.update(deltaTime);
      this.lifeLostDelayTimer -= deltaTime;
      // Wait for both timer and all explosions to finish
      if (this.lifeLostDelayTimer <= 0 && !this.explosionManager.hasActiveParticles()) {
        this.showLifeLost();
      }
    } else if (this.state === GameState.WAVE_COMPLETE) {
      // Auto-continue after tune plays
      this.waveCompleteTuneTimer -= deltaTime;
      if (this.waveCompleteTuneTimer <= 0) {
        this.nextWave();
      }
    } else if (this.state === GameState.LIFE_LOST) {
      // Auto-continue after tune plays
      this.lifeLostTuneTimer -= deltaTime;
      if (this.lifeLostTuneTimer <= 0) {
        this.continueAfterLifeLost();
      }
    } else if (this.state === GameState.INVASION_LANDING) {
      // Update the alien landing animation
      const landingComplete = this.alienFormation.updateLanding(deltaTime);
      this.explosionManager.update(deltaTime);

      if (landingComplete) {
        this.gameOver();
      }
    }

    this.render();
  }

  private update(deltaTime: number): void {
    // Track game time
    this.gameTime += deltaTime;

    // Update input
    this.inputManager.update();

    // Update player
    this.player.update(deltaTime, this.inputManager);

    // Handle player shooting
    if (this.inputManager.isFiring() && this.player.canFire()) {
      this.firePlayerShot();
      this.inputManager.consumeFire();
    }

    // Get player position for dive targeting
    const playerPos = this.player.getPosition();

    // Update alien formation (pass player X and game time for dive targeting)
    const aliveCount = this.alienFormation.update(deltaTime, playerPos.x, this.gameTime);
    this.audioManager.setMarchTempo(aliveCount);

    // Aliens shoot back (formation shots)
    const alienShots = this.alienFormation.tryShoot();
    alienShots.forEach(shotData => {
      const projectile = new Projectile(
        shotData.position,
        shotData.direction,
        ProjectileType.ALIEN,
        shotData.shotType,
        this.sceneManager.scene
      );
      this.projectiles.push(projectile);
      this.audioManager.playAlienShoot();
    });

    // Dive bomber strafing shots
    const diveShots = this.alienFormation.getDiveStrafeShots(this.gameTime);
    diveShots.forEach(shotData => {
      const projectile = new Projectile(
        shotData.position,
        shotData.direction,
        ProjectileType.ALIEN,
        shotData.shotType,
        this.sceneManager.scene,
        shotData.sourceAlien  // Track source alien for cleanup
      );
      this.projectiles.push(projectile);
      this.audioManager.playAlienShoot();
    });

    // Update projectiles
    this.projectiles = this.projectiles.filter(projectile => {
      projectile.update(deltaTime);

      // Remove if out of bounds
      if (projectile.isOutOfBounds()) {
        projectile.destroy(this.sceneManager.scene);
        return false;
      }
      return true;
    });

    // Collision detection
    this.checkCollisions();

    // Update explosions
    this.explosionManager.update(deltaTime);

    // Update shields (shimmer effect)
    this.shields.forEach(shield => shield.update(deltaTime));

    // Check win/lose conditions
    this.checkGameConditions();
  }

  private firePlayerShot(): void {
    const shotData = this.player.fire();
    if (shotData) {
      const projectile = new Projectile(
        shotData.position,
        shotData.direction,
        ProjectileType.PLAYER,
        'straight',
        this.sceneManager.scene
      );
      this.projectiles.push(projectile);
      this.audioManager.playPlayerShoot();
    }
  }

  private checkCollisions(): void {
    const result = this.collisionSystem.checkAll(
      this.projectiles,
      this.alienFormation,
      this.shields,
      this.player
    );

    // Handle destroyed projectiles
    result.destroyedProjectiles.forEach(projectile => {
      projectile.destroy(this.sceneManager.scene);
      const index = this.projectiles.indexOf(projectile);
      if (index > -1) {
        this.projectiles.splice(index, 1);
      }
    });

    // Handle alien kills
    if (result.alienHits.length > 0) {
      result.alienHits.forEach(hit => {
        this.score += hit.points;
        this.audioManager.playAlienDeath();
        const alienColor = hit.alien.getCurrentColor();
        this.explosionManager.createAlienExplosion(hit.position, alienColor);

      });
      // Update brightness for remaining aliens
      this.alienFormation.updateAlienBrightness();
    }

    // Handle player hits
    if (result.playerHit) {
      this.currentHealth--;
      this.audioManager.playShieldHit(); // Lighter sound for damage
      this.showDamageEffect();

      if (this.currentHealth <= 0) {
        this.lives--;
        if (this.lives <= 0) {
          this.gameOver();
        } else {
          // Trigger life lost sequence
          this.startLifeLostSequence();
        }
      }
    }

    // Handle shield hits - distinguish between player shots (turret) and alien shots
    result.shieldHits.forEach(hit => {
      if (hit.isPlayerShot) {
        // Turret shot hitting shield - big spectacular explosion
        this.audioManager.playTurretShieldHit();
        this.explosionManager.createTurretShieldImpact(hit.position);
      } else {
        // Alien shot hitting shield - smaller impact
        this.audioManager.playShieldHit();
        this.explosionManager.createShieldImpact(hit.position);
      }
    });

    this.updateUI();
  }

  private checkGameConditions(): void {
    // Check if all aliens destroyed
    if (this.alienFormation.getAllAliens().filter(a => a.alive).length === 0) {
      this.startWaveCompleteDelay();
      return;
    }

    // Check if aliens reached danger zone - trigger landing sequence
    if (this.alienFormation.hasReachedDangerZone()) {
      this.startInvasionLanding();
    }
  }

  private startInvasionLanding(): void {
    this.state = GameState.INVASION_LANDING;
    this.audioManager.stopMarch();
    this.audioManager.startSaucerSound(); // Ominous UFO sound during landing

    // Clear all projectiles
    this.projectiles.forEach(p => p.destroy(this.sceneManager.scene));
    this.projectiles = [];

    // Explode the turret - player is overwhelmed
    const turretPos = this.player.getTurretPosition();
    this.explosionManager.createTurretExplosion(turretPos);
    this.player.hideTurret();

    // Start the alien landing animation
    this.alienFormation.startLanding();
  }

  private startWaveCompleteDelay(): void {
    this.state = GameState.WAVE_COMPLETE_DELAY;
    this.audioManager.stopMarch();
    this.waveCompleteDelayTimer = 1.0; // 1 second delay for explosion to finish

    // Clear all projectiles
    this.projectiles.forEach(p => p.destroy(this.sceneManager.scene));
    this.projectiles = [];
  }

  private showWaveComplete(): void {
    this.state = GameState.WAVE_COMPLETE;
    this.audioManager.playWaveComplete();
    this.showMessage(`WAVE ${this.wave}`, 'COMPLETE');
    this.waveCompleteTuneTimer = 5.0; // Auto-continue after tune (~5 seconds)
  }

  private startLifeLostSequence(): void {
    this.state = GameState.LIFE_LOST_DELAY;
    this.audioManager.stopMarch();

    // Explode the turret
    const turretPos = this.player.getTurretPosition();
    this.explosionManager.createTurretExplosion(turretPos);
    this.player.hideTurret();

    // Play sad sound
    this.audioManager.playLifeLost();

    // Clear projectiles
    this.projectiles.forEach(p => p.destroy(this.sceneManager.scene));
    this.projectiles = [];

    this.lifeLostDelayTimer = 1.5; // Wait for explosion to finish
  }

  private showLifeLost(): void {
    this.state = GameState.LIFE_LOST;
    this.showMessage('LIFE LOST', '');
    this.lifeLostTuneTimer = 5.0; // Auto-continue after tune (~5 seconds)
  }

  private continueAfterLifeLost(): void {
    this.state = GameState.PLAYING;
    this.messageElement.style.display = 'none';
    this.crosshair.style.display = 'block';

    // Reset health and show turret
    this.currentHealth = GameConfig.gameplay.hitsPerLife;
    this.player.showTurret();
    this.player.reset();

    // Restart march
    this.audioManager.startMarch();

    if (this.inputManager.isMobile()) {
      // Mobile: show touch controls
      this.touchInputManager?.show();
    } else {
      // Desktop: request pointer lock
      document.body.requestPointerLock();
    }

    this.updateUI();
  }

  private gameOver(): void {
    this.state = GameState.GAME_OVER;
    this.audioManager.stopMarch();
    this.audioManager.stopSaucerSound(); // Stop landing sound if playing
    this.audioManager.playGameOver();
    this.crosshair.style.display = 'none';

    if (this.inputManager.isMobile()) {
      // Mobile: hide touch controls
      this.touchInputManager?.hide();
    } else {
      // Desktop: exit pointer lock
      document.exitPointerLock();
    }

    // Clear all projectiles
    this.projectiles.forEach(p => p.destroy(this.sceneManager.scene));
    this.projectiles = [];

    const restartText = this.inputManager.isMobile() ? 'TAP TO RESTART' : 'PRESS SPACE TO RESTART';
    this.showMessage('GAME OVER', `SCORE: ${this.score}`, restartText);
  }

  private showMessage(title: string, info?: string, prompt?: string): void {
    let html = `<div class="message-title">${title}</div>`;
    if (info) {
      html += `<div class="message-info">${info}</div>`;
    }
    if (prompt) {
      html += `<div class="message-prompt">${prompt}</div>`;
    }
    this.messageElement.innerHTML = html;
    this.messageElement.style.display = 'flex';
  }

  private showDamageEffect(): void {
    // Red flash overlay
    this.damageOverlay.classList.remove('flash');
    // Force reflow to restart animation
    void this.damageOverlay.offsetWidth;
    this.damageOverlay.classList.add('flash');

    // Screen shake
    this.uiOverlay.classList.remove('screen-shake');
    void this.uiOverlay.offsetWidth;
    this.uiOverlay.classList.add('screen-shake');

    // Clean up after animation
    setTimeout(() => {
      this.damageOverlay.classList.remove('flash');
      this.uiOverlay.classList.remove('screen-shake');
    }, 500);
  }

  private updateUI(): void {
    this.scoreElement.textContent = this.score.toString();
    // Update life icons
    const lifeIcons = this.livesElement.querySelectorAll('.life-icon');
    lifeIcons.forEach((icon, index) => {
      if (index < this.lives) {
        icon.classList.remove('spent');
      } else {
        icon.classList.add('spent');
      }
    });
    this.waveElement.textContent = this.wave.toString();
    this.updateHealthBar();
  }

  private updateHealthBar(): void {
    const maxHealth = GameConfig.gameplay.hitsPerLife;
    const healthPercent = (this.currentHealth / maxHealth) * 100;
    this.healthBar.style.width = `${healthPercent}%`;

    // Update color based on health level
    this.healthBar.classList.remove('critical', 'warning');
    if (healthPercent <= 20) {
      this.healthBar.classList.add('critical');
    } else if (healthPercent <= 50) {
      this.healthBar.classList.add('warning');
    }
  }

  private render(): void {
    this.crtEffect.render();
  }
}
