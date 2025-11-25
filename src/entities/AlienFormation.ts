import * as THREE from 'three';
import { GameConfig } from '../game/GameConfig';
import { Alien, AlienType } from './Alien';

export type AlienShotType = 'rolling' | 'plunger' | 'squiggly';

export interface AlienShotData {
  position: THREE.Vector3;
  direction: THREE.Vector3;
  shotType: AlienShotType;
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
      // Get all alive aliens in this column, sorted by gridY (front to back)
      const columnAliens = this.aliens
        .filter(a => a.alive && a.gridX === col)
        .sort((a, b) => a.gridY - b.gridY);

      // Update brightness for each alien in the column
      columnAliens.forEach((alien, index) => {
        alien.updateBrightness(index); // 0 = front (brightest), higher = dimmer
      });
    }
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

      alien.setPosition(x, y, z);
    });
  }

  update(deltaTime: number): number {
    const aliveAliens = this.aliens.filter(a => a.alive);
    const aliveCount = aliveAliens.length;

    if (aliveCount === 0) return 0;

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

    return aliveCount;
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
