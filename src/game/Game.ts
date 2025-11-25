import * as THREE from 'three';
import { GameConfig } from './GameConfig';
import { SceneManager } from '../rendering/SceneManager';
import { InputManager } from '../systems/InputManager';
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
}

export class Game {
  private sceneManager!: SceneManager;
  private inputManager!: InputManager;
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
    this.livesElement = document.getElementById('lives')!;
    this.waveElement = document.getElementById('wave')!;
    this.messageElement = document.getElementById('game-message')!;
    this.startPrompt = document.getElementById('start-prompt')!;
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

    // Initialize CRT post-processing
    this.crtEffect = new CRTEffect(
      this.sceneManager.renderer,
      this.sceneManager.scene,
      this.sceneManager.camera
    );

    // Initialize player
    this.player = new PlayerTurret(this.sceneManager.camera, this.sceneManager.scene);

    // Initialize alien formation
    this.alienFormation = new AlienFormation(this.sceneManager.scene);

    // Initialize shields
    this.createShields();

    // Set up space to start, click for pointer lock during gameplay
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    document.addEventListener('click', () => this.handleClick());

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
    if (e.code === 'Space') {
      e.preventDefault();
      if (this.state === GameState.MENU) {
        this.startGame();
      } else if (this.state === GameState.GAME_OVER) {
        this.resetGame();
        this.startGame();
      } else if (this.state === GameState.WAVE_COMPLETE) {
        this.nextWave();
      } else if (this.state === GameState.LIFE_LOST) {
        this.continueAfterLifeLost();
      }
    }
  }

  private handleClick(): void {
    if (this.state === GameState.PLAYING) {
      // Request pointer lock for mouse control
      document.body.requestPointerLock();
    }
  }

  private startGame(): void {
    this.state = GameState.PLAYING;
    this.startPrompt.style.display = 'none';
    this.messageElement.style.display = 'none';
    this.crosshair.style.display = 'block';
    document.body.requestPointerLock();
    this.audioManager.startMarch();
  }

  private resetGame(): void {
    this.score = 0;
    this.lives = GameConfig.gameplay.lives;
    this.currentHealth = GameConfig.gameplay.hitsPerLife;
    this.wave = 1;

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
    this.state = GameState.PLAYING;
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

    this.audioManager.startMarch();
    this.updateUI();
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate());

    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1); // Cap delta to prevent huge jumps
    this.lastTime = currentTime;

    if (this.state === GameState.PLAYING) {
      this.update(deltaTime);
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
    }

    this.render();
  }

  private update(deltaTime: number): void {
    // Update input
    this.inputManager.update();

    // Update player
    this.player.update(deltaTime, this.inputManager);

    // Handle player shooting
    if (this.inputManager.isFiring() && this.player.canFire()) {
      this.firePlayerShot();
    }

    // Update alien formation
    const aliveCount = this.alienFormation.update(deltaTime);
    this.audioManager.setMarchTempo(aliveCount);

    // Aliens shoot back
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

    // Handle shield hits
    result.shieldHits.forEach(hit => {
      this.audioManager.playShieldHit();
      this.explosionManager.createShieldImpact(hit.position);
    });

    this.updateUI();
  }

  private checkGameConditions(): void {
    // Check if all aliens destroyed
    if (this.alienFormation.getAllAliens().filter(a => a.alive).length === 0) {
      this.startWaveCompleteDelay();
      return;
    }

    // Check if aliens reached danger zone
    if (this.alienFormation.hasReachedDangerZone()) {
      this.gameOver();
    }
  }

  private startWaveCompleteDelay(): void {
    this.state = GameState.WAVE_COMPLETE_DELAY;
    this.audioManager.stopMarch();
    this.waveCompleteDelayTimer = 1.0; // 1 second delay for explosion to finish
  }

  private showWaveComplete(): void {
    this.state = GameState.WAVE_COMPLETE;
    this.audioManager.playWaveComplete();
    this.showMessage('WAVE COMPLETE\nPRESS SPACE TO CONTINUE');
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
    this.crosshair.style.display = 'none';
    document.exitPointerLock();
    this.showMessage(`LIFE LOST\nLIVES REMAINING: ${this.lives}\nPRESS SPACE TO CONTINUE`);
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
    document.body.requestPointerLock();

    this.updateUI();
  }

  private gameOver(): void {
    this.state = GameState.GAME_OVER;
    this.audioManager.stopMarch();
    this.audioManager.playGameOver();
    document.exitPointerLock();
    this.crosshair.style.display = 'none';
    this.showMessage(`GAME OVER\nFINAL SCORE: ${this.score}\nPRESS SPACE TO RESTART`);
  }

  private showMessage(text: string): void {
    this.messageElement.textContent = text;
    this.messageElement.style.display = 'block';
    this.messageElement.style.whiteSpace = 'pre-line';
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
    this.scoreElement.textContent = this.score.toString().padStart(4, '0');
    this.livesElement.textContent = this.lives.toString();
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
