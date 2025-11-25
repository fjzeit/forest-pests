import * as THREE from 'three';
import { GameConfig } from '../game/GameConfig';
import { Alien, AlienType, DiveState } from './Alien';

export type AlienShotType = 'rolling' | 'plunger' | 'squiggly';

// Dive bomber configuration
const DIVE_CONFIG = {
  diveSpeed: 60,            // Units per second during dive (slower than alien shot speed of 80)
  returnSpeed: 80,          // Units per second returning
  heightBoost: 40,          // How high above formation the squid rises
  waveAmplitude: 30,        // Side-to-side wave motion amplitude
  waveFrequency: 3,         // How many wave cycles during dive
  diveShootIntervalBase: 1.0,   // Seconds between strafe shots (wave 2)
  diveShootIntervalLate: 0.4,   // Seconds between strafe shots (wave 75+)
  minDiveInterval: 3,       // Minimum seconds between dive attacks (wave 1)
  maxDiveInterval: 8,       // Maximum seconds between dive attacks (wave 1)
  minDiveIntervalLate: 0.8, // Minimum seconds between dive attacks (wave 100)
  maxDiveIntervalLate: 2,   // Maximum seconds between dive attacks (wave 100)
  maxConcurrentDivers: 5,   // Maximum dive bombers at once
  maxConcurrentDiversBase: 1,  // Max concurrent at wave 2
  retreatZ: -200,           // Z position to retreat at (well before shields at -150)
};

export interface AlienShotData {
  position: THREE.Vector3;
  direction: THREE.Vector3;
  shotType: AlienShotType;
  sourceAlien?: Alien;  // Track which alien fired (for dive bomber shots)
}

export class AlienFormation {
  private aliens: Alien[] = [];
  private scene: THREE.Scene;

  // Formation state
  private formationX: number = 0;
  private formationZ: number;
  private formationY: number;
  private direction: number = 1; // 1 = right, -1 = left

  // Movement timing
  private moveTimer: number = 0;
  private waveMultiplier: number = 1;
  private shootChance: number = GameConfig.timing.alienShootChanceBase;

  // Dive bomber state
  private currentWave: number = 1;
  private diveTimer: number = 0;
  private nextDiveTime: number = 5;  // First dive after 5 seconds
  private playerX: number = 0;       // Track player position for targeting
  private currentGameTime: number = 0;  // Track game time for dive shot timing

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.formationZ = -GameConfig.aliens.startDistance;
    this.formationY = GameConfig.aliens.startHeight;
    this.createFormation();
  }

  private createFormation(): void {
    const config = GameConfig.aliens;

    for (let row = 0; row < config.rows; row++) {
      for (let col = 0; col < config.columns; col++) {
        // Determine alien type based on row
        let type: AlienType;
        let points: number;

        if (GameConfig.alienTypes.squid.rows.includes(row)) {
          type = 'squid';
          points = GameConfig.alienTypes.squid.points;
        } else if (GameConfig.alienTypes.bug.rows.includes(row)) {
          type = 'bug';
          points = GameConfig.alienTypes.bug.points;
        } else {
          type = 'crab';
          points = GameConfig.alienTypes.crab.points;
        }

        const alien = new Alien({
          type,
          points,
          gridX: col,
          gridY: row,
        }, this.scene);

        this.aliens.push(alien);
      }
    }

    this.updateAlienPositions();
    this.updateAlienBrightness();
  }

  // Update brightness for all aliens based on their position in column
  updateAlienBrightness(): void {
    const columns = GameConfig.aliens.columns;

    for (let col = 0; col < columns; col++) {
      // Get all alive aliens in this column (excluding diving ones), sorted by gridY (front to back)
      const columnAliens = this.aliens
        .filter(a => a.alive && a.gridX === col && !a.isDiving())
        .sort((a, b) => a.gridY - b.gridY);

      // Update brightness for each alien in the column
      columnAliens.forEach((alien, index) => {
        alien.updateBrightness(index); // 0 = front (brightest), higher = dimmer
      });
    }

    // Diving aliens are always at full brightness
    this.aliens.forEach(alien => {
      if (alien.alive && alien.isDiving()) {
        alien.updateBrightness(0); // Full brightness
      }
    });
  }

  private updateAlienPositions(): void {
    const config = GameConfig.aliens;
    const totalWidth = (config.columns - 1) * config.spacingX;
    const startX = -totalWidth / 2;

    this.aliens.forEach(alien => {
      if (!alien.alive) return;
      // Skip aliens that are diving - they handle their own position
      if (alien.isDiving()) return;

      const x = startX + alien.gridX * config.spacingX + this.formationX;
      // Row 0 is front (closest to player), so positive Z offset for higher rows
      const z = this.formationZ - alien.gridY * config.spacingZ;
      const y = this.formationY;

      alien.setPosition(x, y, z);
      // Store formation position for returning divers
      alien.formationPos.set(x, y, z);
    });
  }

  update(deltaTime: number, playerX: number = 0, gameTime: number = 0): number {
    const aliveAliens = this.aliens.filter(a => a.alive);
    const aliveCount = aliveAliens.length;

    if (aliveCount === 0) return 0;

    // Track player position and game time for dive targeting
    this.playerX = playerX;
    this.currentGameTime = gameTime;

    // Calculate move interval based on remaining aliens
    const speedMultiplier = Math.max(
      GameConfig.gameplay.speedMultiplierMin,
      aliveCount / (GameConfig.aliens.columns * GameConfig.aliens.rows)
    );
    const moveInterval = GameConfig.timing.baseMoveInterval * speedMultiplier / 60; // Convert to seconds

    this.moveTimer += deltaTime * this.waveMultiplier;

    if (this.moveTimer >= moveInterval) {
      this.moveTimer = 0;
      this.moveFormation();
    }

    // Handle dive attacks (only after wave 1)
    if (this.currentWave > 1) {
      this.updateDiveAttacks(deltaTime);
    }

    return aliveCount;
  }

  // Update player position for targeting
  setPlayerX(x: number): void {
    this.playerX = x;
  }

  private moveFormation(): void {
    const config = GameConfig.aliens;

    // Move formation horizontally
    this.formationX += config.baseSpeed * this.direction;

    // Check if we hit the edge
    const totalWidth = (config.columns - 1) * config.spacingX;
    const halfWidth = totalWidth / 2;

    // Find actual bounds based on alive aliens
    let leftmost = Infinity;
    let rightmost = -Infinity;

    this.aliens.forEach(alien => {
      if (!alien.alive) return;
      const x = -halfWidth + alien.gridX * config.spacingX + this.formationX;
      leftmost = Math.min(leftmost, x);
      rightmost = Math.max(rightmost, x);
    });

    // If hit edge, reverse and drop
    if (rightmost > config.edgeMargin || leftmost < -config.edgeMargin) {
      this.direction *= -1;
      this.formationZ += config.dropDistance; // Move closer to player

      // Undo the move that went over the edge
      this.formationX += config.baseSpeed * this.direction;
    }

    // Animate all alive aliens
    this.aliens.forEach(alien => {
      if (alien.alive) alien.animate();
    });

    this.updateAlienPositions();
  }

  tryShoot(): AlienShotData[] {
    const shots: AlienShotData[] = [];

    // Only front-most alien in each column can shoot
    const frontAliens = this.getFrontAliens();

    frontAliens.forEach(alien => {
      if (Math.random() < this.shootChance) {
        const position = alien.getPosition();
        position.y -= 3; // Shoot from bottom of alien

        // Random shot type
        const shotTypes: AlienShotType[] = ['rolling', 'plunger', 'squiggly'];
        const shotType = shotTypes[Math.floor(Math.random() * shotTypes.length)];

        // Target player height but no horizontal tracking (shoot straight down column)
        const playerZ = GameConfig.player.zPosition;
        const playerHeight = 5; // Ground level target

        // Calculate direction: no X deviation, only Y angle to reach player height
        const dy = playerHeight - position.y;
        const dz = playerZ - position.z;

        const direction = new THREE.Vector3(0, dy, dz).normalize();

        shots.push({ position, direction, shotType });
      }
    });

    return shots;
  }

  // Get aliens that have no other alien in front of them (can fire)
  private getFrontAliens(): Alien[] {
    const frontAliens: Alien[] = [];

    for (const alien of this.aliens) {
      if (!alien.alive) continue;

      // Check if any other alive alien is in front of this one (lower gridY = closer to player)
      const hasAlienInFront = this.aliens.some(other =>
        other.alive &&
        other !== alien &&
        other.gridX === alien.gridX &&
        other.gridY < alien.gridY
      );

      if (!hasAlienInFront) {
        frontAliens.push(alien);
      }
    }

    return frontAliens;
  }

  getAllAliens(): Alien[] {
    return this.aliens;
  }

  // Dive bomber methods
  private updateDiveAttacks(deltaTime: number): void {
    // Update timer for starting new dives
    this.diveTimer += deltaTime;

    // Check if it's time to start a new dive
    if (this.diveTimer >= this.nextDiveTime) {
      this.tryStartDive();
      this.scheduleNextDive();
    }

    // Update all diving aliens
    this.aliens.forEach(alien => {
      if (!alien.alive || !alien.isDiving()) return;
      this.updateDivingAlien(alien, deltaTime);
    });
  }

  private tryStartDive(): void {
    // Count current divers
    const currentDivers = this.aliens.filter(a => a.alive && a.isDiving()).length;

    // Calculate max concurrent divers based on wave (1 at wave 2, up to 5 at wave 100)
    const waveProgress = Math.min((this.currentWave - 1) / 99, 1);
    const maxDivers = Math.floor(
      DIVE_CONFIG.maxConcurrentDiversBase +
      (DIVE_CONFIG.maxConcurrentDivers - DIVE_CONFIG.maxConcurrentDiversBase) * waveProgress
    );

    if (currentDivers >= maxDivers) return;

    // Get available squids (alive, not already diving)
    const availableSquids = this.aliens.filter(a =>
      a.alive &&
      a.type === 'squid' &&
      !a.isDiving()
    );

    if (availableSquids.length === 0) return;

    // Pick a random squid
    const squid = availableSquids[Math.floor(Math.random() * availableSquids.length)];

    // Start dive toward player's current position
    squid.startDive(this.playerX, this.currentGameTime);
  }

  private scheduleNextDive(): void {
    this.diveTimer = 0;

    // More frequent dives at higher waves (interpolate between base and late intervals)
    const waveProgress = Math.min((this.currentWave - 1) / 99, 1);
    const minInterval = DIVE_CONFIG.minDiveInterval +
      (DIVE_CONFIG.minDiveIntervalLate - DIVE_CONFIG.minDiveInterval) * waveProgress;
    const maxInterval = DIVE_CONFIG.maxDiveInterval +
      (DIVE_CONFIG.maxDiveIntervalLate - DIVE_CONFIG.maxDiveInterval) * waveProgress;

    this.nextDiveTime = minInterval + Math.random() * (maxInterval - minInterval);
  }

  private updateDivingAlien(alien: Alien, deltaTime: number): void {
    const pos = alien.getPosition();

    if (alien.diveState === DiveState.DIVING) {
      // Calculate dive path
      const startPos = alien.diveStartPos;
      const targetZ = GameConfig.player.zPosition + 20; // Stop just past player
      const totalDistance = startPos.z - targetZ;

      // Update progress
      alien.diveProgress += (DIVE_CONFIG.diveSpeed * deltaTime) / Math.abs(totalDistance);

      // Calculate position along dive path
      const t = alien.diveProgress;

      // Z moves linearly toward player
      const z = startPos.z + (targetZ - startPos.z) * t;

      // Check if we should retreat (based on calculated Z, not current pos)
      if (z >= DIVE_CONFIG.retreatZ) {
        // Start returning when reaching retreat Z (well before shields)
        alien.diveState = DiveState.RETURNING;
        alien.diveProgress = 0;
        alien.diveStartPos.copy(pos);
      } else {
        // Y: rise up, then swoop down (parabolic arc)
        const heightCurve = Math.sin(t * Math.PI); // 0 -> 1 -> 0
        const baseY = startPos.y + (10 - startPos.y) * t; // Descend toward ground level
        const y = baseY + DIVE_CONFIG.heightBoost * heightCurve;

        // X: wave motion toward target
        const waveOffset = Math.sin(t * Math.PI * DIVE_CONFIG.waveFrequency) * DIVE_CONFIG.waveAmplitude * (1 - t);
        const targetX = alien.diveTargetX;
        const x = startPos.x + (targetX - startPos.x) * t + waveOffset;

        alien.setPosition(x, y, z);

        // Rotate to face direction of travel
        const group = alien.getGroup();
        const roll = Math.sin(t * Math.PI * DIVE_CONFIG.waveFrequency) * 0.5; // Bank during turns
        const pitch = -0.3 - heightCurve * 0.3; // Nose down during dive
        group.rotation.set(pitch, 0, roll);

        // Animate faster during dive
        if (Math.random() < 0.1) alien.animate();
      }
    } else if (alien.diveState === DiveState.RETURNING) {
      // Return to formation position (which updates with the formation)
      const targetPos = alien.formationPos;
      const startPos = alien.diveStartPos;
      const returnDistance = startPos.distanceTo(targetPos);

      if (returnDistance < 1) {
        // Already at formation position
        alien.resetDive();
        return;
      }

      // Update progress
      alien.diveProgress += (DIVE_CONFIG.returnSpeed * deltaTime) / returnDistance;

      if (alien.diveProgress >= 1) {
        // Back in formation
        alien.resetDive();
        alien.setPosition(targetPos.x, targetPos.y, targetPos.z);
      } else {
        const t = alien.diveProgress;

        // Rise up in an arc back to formation
        const heightCurve = Math.sin(t * Math.PI) * 0.5; // Gentler arc

        const x = startPos.x + (targetPos.x - startPos.x) * t;
        const baseY = startPos.y + (targetPos.y - startPos.y) * t;
        const y = baseY + DIVE_CONFIG.heightBoost * 0.5 * heightCurve;
        const z = startPos.z + (targetPos.z - startPos.z) * t;

        alien.setPosition(x, y, z);

        // Rotate back to neutral
        const group = alien.getGroup();
        const pitch = -0.2 * (1 - t); // Level out
        group.rotation.set(pitch, 0, 0);
      }
    }
  }

  // Get shots from diving aliens (strafing fire)
  getDiveStrafeShots(currentTime: number): AlienShotData[] {
    const shots: AlienShotData[] = [];

    // Calculate strafe interval based on wave (1.0s at wave 2, 0.4s at wave 75+)
    const waveProgress = Math.min((this.currentWave - 2) / 73, 1); // 0 at wave 2, 1 at wave 75
    const shootInterval = DIVE_CONFIG.diveShootIntervalBase +
      (DIVE_CONFIG.diveShootIntervalLate - DIVE_CONFIG.diveShootIntervalBase) * waveProgress;

    this.aliens.forEach(alien => {
      if (!alien.alive || alien.diveState !== DiveState.DIVING) return;

      // Check if enough time has passed since last shot
      if (currentTime - alien.lastDiveShotTime < shootInterval) return;

      // Only shoot during middle portion of dive
      if (alien.diveProgress < 0.2 || alien.diveProgress > 0.8) return;

      alien.lastDiveShotTime = currentTime;

      const position = alien.getPosition();
      position.y -= 3;

      // Shoot toward player position
      const playerZ = GameConfig.player.zPosition;
      const playerHeight = 5;

      const dx = this.playerX - position.x;
      const dy = playerHeight - position.y;
      const dz = playerZ - position.z;

      const direction = new THREE.Vector3(dx, dy, dz).normalize();

      shots.push({
        position,
        direction,
        shotType: 'plunger', // Dive bombers use plunger shots
        sourceAlien: alien   // Track source for cleanup when alien dies
      });
    });

    return shots;
  }

  hasReachedDangerZone(): boolean {
    const frontAliens = this.aliens.filter(a => a.alive && a.gridY === 0);
    return frontAliens.some(alien => {
      const pos = alien.getPosition();
      return pos.z > -GameConfig.gameplay.dangerDistance;
    });
  }

  reset(wave: number = 1): void {
    // Destroy existing aliens
    this.aliens.forEach(alien => {
      if (alien.alive) {
        alien.destroy(this.scene);
      }
    });
    this.aliens = [];

    // Reset formation position
    this.formationX = 0;
    this.formationZ = -GameConfig.aliens.startDistance;
    this.formationY = GameConfig.aliens.startHeight;
    this.direction = 1;
    this.moveTimer = 0;

    // Store current wave for dive bomber logic
    this.currentWave = wave;

    // Reset dive attack timing
    this.diveTimer = 0;
    this.nextDiveTime = 5; // First dive after 5 seconds

    // Increase difficulty with wave
    this.waveMultiplier = 1 + (wave - 1) * 0.2;

    // Increase shoot chance with wave (linear from base to max over 100 waves)
    const baseChance = GameConfig.timing.alienShootChanceBase;
    const maxChance = GameConfig.timing.alienShootChanceMax;
    const waveProgress = Math.min((wave - 1) / 99, 1); // 0 at wave 1, 1 at wave 100
    this.shootChance = baseChance + (maxChance - baseChance) * waveProgress;

    // Create new formation
    this.createFormation();
  }

  // For collision detection
  getAlienAtPosition(point: THREE.Vector3, radius: number): Alien | null {
    for (const alien of this.aliens) {
      if (!alien.alive) continue;

      const sphere = alien.getBoundingSphere();
      const distance = sphere.center.distanceTo(point);

      if (distance < sphere.radius + radius) {
        return alien;
      }
    }
    return null;
  }
}
