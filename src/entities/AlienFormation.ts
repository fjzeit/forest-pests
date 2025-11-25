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
  minDiveInterval: 3,       // Minimum seconds between dive attacks (wave 2)
  maxDiveInterval: 8,       // Maximum seconds between dive attacks (wave 2)
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

  // Fly-in intro state
  private introElapsedTime: number = 0;
  private introActive: boolean = false;

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

      const x = startX + alien.gridX * config.spacingX + this.formationX;
      // Row 0 is front (closest to player), so positive Z offset for higher rows
      const z = this.formationZ - alien.gridY * config.spacingZ;
      const y = this.formationY;

      // Always update formation position (for returning divers)
      alien.formationPos.set(x, y, z);

      // Skip setting position for diving aliens - they handle their own position
      if (alien.isDiving()) return;

      alien.setPosition(x, y, z);
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
    // Don't dive bomb if only squids are left - need other aliens to provide cover fire
    const hasNonSquidAliens = this.aliens.some(a => a.alive && a.type !== 'squid');
    if (!hasNonSquidAliens) return;

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
      // Safety check: if current position is already past retreat point, retreat immediately
      if (pos.z >= DIVE_CONFIG.retreatZ) {
        alien.diveState = DiveState.RETURNING;
        alien.diveProgress = 0;
        alien.diveStartPos.copy(pos);
        return;
      }

      // Calculate dive path
      const startPos = alien.diveStartPos;
      const targetZ = DIVE_CONFIG.retreatZ; // Target the retreat point, not past player
      const totalDistance = Math.abs(startPos.z - targetZ);

      // Safety: if no distance to travel, retreat
      if (totalDistance < 1) {
        alien.diveState = DiveState.RETURNING;
        alien.diveProgress = 0;
        alien.diveStartPos.copy(pos);
        return;
      }

      // Update progress
      alien.diveProgress += (DIVE_CONFIG.diveSpeed * deltaTime) / totalDistance;

      // Calculate position along dive path
      const t = Math.min(alien.diveProgress, 1); // Clamp to prevent overshoot

      // Z moves linearly toward retreat point
      const z = startPos.z + (targetZ - startPos.z) * t;

      // Y: rise up, then swoop down (parabolic arc)
      const heightCurve = Math.sin(t * Math.PI); // 0 -> 1 -> 0
      const baseY = startPos.y + (10 - startPos.y) * t; // Descend toward ground level
      const y = baseY + DIVE_CONFIG.heightBoost * heightCurve;

      // X: wave motion toward target
      const waveOffset = Math.sin(t * Math.PI * DIVE_CONFIG.waveFrequency) * DIVE_CONFIG.waveAmplitude * (1 - t);
      const targetX = alien.diveTargetX;
      const x = startPos.x + (targetX - startPos.x) * t + waveOffset;

      // Set position
      alien.setPosition(x, y, z);

      // Check if we should retreat (reached end of dive or retreat Z)
      if (t >= 1) {
        // Start returning
        alien.diveState = DiveState.RETURNING;
        alien.diveProgress = 0;
        alien.diveStartPos.set(x, y, z);
      } else {
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
    // Check ALL alive aliens, not just front row (front row might be dead)
    return this.aliens.some(alien => {
      if (!alien.alive) return false;
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

  // Start the fly-in intro sequence
  startIntro(): void {
    this.introActive = true;
    this.introElapsedTime = 0;

    const config = GameConfig.aliens;
    const totalWidth = (config.columns - 1) * config.spacingX;
    const startX = -totalWidth / 2;

    // Set up each alien with a random start position and staggered delay
    this.aliens.forEach((alien) => {
      // Calculate target formation position
      const targetX = startX + alien.gridX * config.spacingX + this.formationX;
      const targetZ = this.formationZ - alien.gridY * config.spacingZ;
      const targetY = this.formationY;
      const targetPos = new THREE.Vector3(targetX, targetY, targetZ);

      // Random start position - mostly from above/back (coming from space)
      const side = Math.random();
      let startPos: THREE.Vector3;

      if (side < 0.15) {
        // From left (rare)
        startPos = new THREE.Vector3(
          -250 - Math.random() * 100,
          120 + Math.random() * 80,
          -500 - Math.random() * 150
        );
      } else if (side < 0.3) {
        // From right (rare)
        startPos = new THREE.Vector3(
          250 + Math.random() * 100,
          120 + Math.random() * 80,
          -500 - Math.random() * 150
        );
      } else {
        // From top/space (most common)
        startPos = new THREE.Vector3(
          (Math.random() - 0.5) * 400,
          150 + Math.random() * 100,
          -600 - Math.random() * 200
        );
      }

      // Stagger delays - back rows come in first, front rows last
      // Also add some randomness within each row
      const rowDelay = (config.rows - 1 - alien.gridY) * 0.3;
      const randomDelay = Math.random() * 0.4;
      const delay = rowDelay + randomDelay;

      alien.startFlyIn(startPos, targetPos, delay);
    });
  }

  // Update the fly-in intro sequence
  updateIntro(deltaTime: number): boolean {
    if (!this.introActive) return true;

    this.introElapsedTime += deltaTime;

    let allArrived = true;
    this.aliens.forEach(alien => {
      if (!alien.updateFlyIn(deltaTime, this.introElapsedTime)) {
        allArrived = false;
      }
    });

    if (allArrived) {
      this.introActive = false;
      this.updateAlienBrightness();
      return true;
    }

    return false;
  }

  isIntroActive(): boolean {
    return this.introActive;
  }

  // Hide all aliens (for menu screen)
  hideAll(): void {
    this.aliens.forEach(alien => {
      alien.getGroup().visible = false;
    });
  }

  // Show all aliens
  showAll(): void {
    this.aliens.forEach(alien => {
      alien.getGroup().visible = true;
    });
  }

  // Landing sequence state
  private landingActive: boolean = false;
  private landingElapsedTime: number = 0;
  private landingTargets: Map<Alien, { startPos: THREE.Vector3; targetPos: THREE.Vector3; delay: number }> = new Map();

  // Start the invasion landing sequence
  startLanding(): void {
    this.landingActive = true;
    this.landingElapsedTime = 0;
    this.landingTargets.clear();

    // Calculate landing positions - aliens spread out and land on the ground
    const groundY = 0;
    const landingZ = 50; // In front of where player was
    const spreadX = 200; // Total width to spread across

    const aliveAliens = this.aliens.filter(a => a.alive);

    aliveAliens.forEach((alien, index) => {
      const currentPos = alien.getPosition();

      // Spread aliens across the landing zone
      const row = Math.floor(index / 8);
      const col = index % 8;
      const targetX = -spreadX / 2 + (col + 0.5) * (spreadX / 8) + (Math.random() - 0.5) * 10;
      const targetZ = landingZ - row * 25 + (Math.random() - 0.5) * 10;

      // Stagger the landing - front aliens land first
      const delay = (currentPos.z + 400) / 200 * 0.5 + Math.random() * 0.3;

      this.landingTargets.set(alien, {
        startPos: currentPos.clone(),
        targetPos: new THREE.Vector3(targetX, groundY + 5, targetZ),
        delay: delay
      });

      // Reset any dive state
      if (alien.isDiving()) {
        alien.resetDive();
      }
    });
  }

  // Update landing animation - returns true when complete
  updateLanding(deltaTime: number): boolean {
    if (!this.landingActive) return true;

    this.landingElapsedTime += deltaTime;

    let allLanded = true;
    const landingDuration = 2.0; // Seconds for each alien to land

    this.landingTargets.forEach((target, alien) => {
      if (!alien.alive) return;

      const timeSinceStart = this.landingElapsedTime - target.delay;

      if (timeSinceStart < 0) {
        // Not started yet
        allLanded = false;
        return;
      }

      const progress = Math.min(timeSinceStart / landingDuration, 1);

      if (progress < 1) {
        allLanded = false;

        // Swooping arc toward landing position
        const t = progress;
        const easeOut = 1 - Math.pow(1 - t, 3); // Ease out cubic

        // Position interpolation with arc
        const x = target.startPos.x + (target.targetPos.x - target.startPos.x) * easeOut;
        const z = target.startPos.z + (target.targetPos.z - target.startPos.z) * easeOut;

        // Y follows an arc - rise up first then descend
        const arcHeight = 30;
        const yArc = Math.sin(t * Math.PI) * arcHeight;
        const baseY = target.startPos.y + (target.targetPos.y - target.startPos.y) * easeOut;
        const y = baseY + yArc * (1 - t); // Arc diminishes as we land

        alien.setPosition(x, y, z);

        // Rotate to face forward and wobble during flight
        const group = alien.getGroup();
        const wobble = Math.sin(this.landingElapsedTime * 10 + target.delay * 5) * 0.2 * (1 - t);
        const pitch = -0.3 * (1 - t); // Level out as landing
        group.rotation.set(pitch, wobble, wobble * 0.5);

        // Animate faster during descent
        if (Math.random() < 0.15) alien.animate();
      } else {
        // Landed - set final position and level rotation
        alien.setPosition(target.targetPos.x, target.targetPos.y, target.targetPos.z);
        const group = alien.getGroup();
        group.rotation.set(0, 0, 0);
      }
    });

    // Add a small delay after all aliens land
    if (allLanded && this.landingElapsedTime > 3.5) {
      this.landingActive = false;
      return true;
    }

    return false;
  }

  isLandingActive(): boolean {
    return this.landingActive;
  }
}
