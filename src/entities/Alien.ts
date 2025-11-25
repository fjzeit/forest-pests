import * as THREE from 'three';
import { GameConfig } from '../game/GameConfig';

export type AlienType = 'crab' | 'bug' | 'squid';

export interface AlienData {
  type: AlienType;
  points: number;
  gridX: number;  // Column in formation
  gridY: number;  // Row in formation (0 = front/closest to player)
}

// Pixel art patterns for each alien type (1 = filled, 0 = empty)
// Each alien has 2 animation frames
const ALIEN_SPRITES: Record<AlienType, number[][][]> = {
  // Squid - 8x8 sprite (top rows, high points)
  squid: [
    // Frame 1
    [
      [0,0,0,1,1,0,0,0],
      [0,0,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,0],
      [1,1,0,1,1,0,1,1],
      [1,1,1,1,1,1,1,1],
      [0,0,1,0,0,1,0,0],
      [0,1,0,1,1,0,1,0],
      [1,0,1,0,0,1,0,1],
    ],
    // Frame 2
    [
      [0,0,0,1,1,0,0,0],
      [0,0,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,0],
      [1,1,0,1,1,0,1,1],
      [1,1,1,1,1,1,1,1],
      [0,1,0,1,1,0,1,0],
      [1,0,0,0,0,0,0,1],
      [0,1,0,0,0,0,1,0],
    ],
  ],
  // Crab - 11x8 sprite (bottom row, low points)
  crab: [
    // Frame 1
    [
      [0,0,1,0,0,0,0,0,1,0,0],
      [0,0,0,1,0,0,0,1,0,0,0],
      [0,0,1,1,1,1,1,1,1,0,0],
      [0,1,1,0,1,1,1,0,1,1,0],
      [1,1,1,1,1,1,1,1,1,1,1],
      [1,0,1,1,1,1,1,1,1,0,1],
      [1,0,1,0,0,0,0,0,1,0,1],
      [0,0,0,1,1,0,1,1,0,0,0],
    ],
    // Frame 2
    [
      [0,0,1,0,0,0,0,0,1,0,0],
      [1,0,0,1,0,0,0,1,0,0,1],
      [1,0,1,1,1,1,1,1,1,0,1],
      [1,1,1,0,1,1,1,0,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1],
      [0,1,1,1,1,1,1,1,1,1,0],
      [0,0,1,0,0,0,0,0,1,0,0],
      [0,1,0,0,0,0,0,0,0,1,0],
    ],
  ],
  // Bug/Bee - 12x8 sprite (middle rows)
  bug: [
    // Frame 1
    [
      [0,0,0,0,1,1,1,1,0,0,0,0],
      [0,1,1,1,1,1,1,1,1,1,1,0],
      [1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,0,0,1,1,0,0,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],
      [0,0,0,1,1,0,0,1,1,0,0,0],
      [0,0,1,1,0,1,1,0,1,1,0,0],
      [1,1,0,0,0,0,0,0,0,0,1,1],
    ],
    // Frame 2
    [
      [0,0,0,0,1,1,1,1,0,0,0,0],
      [0,1,1,1,1,1,1,1,1,1,1,0],
      [1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,0,0,1,1,0,0,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],
      [0,0,1,1,0,1,1,0,1,1,0,0],
      [0,1,1,0,0,0,0,0,0,1,1,0],
      [0,0,1,1,0,0,0,0,1,1,0,0],
    ],
  ],
};

// Resolution multiplier - each sprite pixel becomes NxN voxels
const RESOLUTION_MULTIPLIER = 2;

// Distinct 8-bit style colors for each alien type (RGB components 0-255)
const ALIEN_COLORS: Record<AlienType, { r: number; g: number; b: number }> = {
  crab: { r: 255, g: 255, b: 0 },    // Yellow (front row)
  bug: { r: 0, g: 255, b: 255 },     // Cyan (middle rows)
  squid: { r: 255, g: 0, b: 128 },   // Hot pink/magenta (back rows)
};

// Dive bomber states
export enum DiveState {
  NONE,           // In formation
  DIVING,         // Flying toward player
  RETURNING,      // Flying back to formation
}

// Fly-in states for wave intro
export enum FlyInState {
  WAITING,        // Not yet started flying in
  FLYING,         // Flying toward formation position
  ARRIVED,        // In formation position
}

export class Alien {
  public alive: boolean = true;
  public readonly type: AlienType;
  public readonly points: number;
  public readonly gridX: number;
  public readonly gridY: number;

  // Dive bomber properties
  public diveState: DiveState = DiveState.NONE;
  public diveProgress: number = 0;        // 0-1 progress through dive
  public diveStartPos: THREE.Vector3 = new THREE.Vector3();
  public formationPos: THREE.Vector3 = new THREE.Vector3();  // Position in formation to return to
  public diveTargetX: number = 0;         // X position to strafe toward
  public lastDiveShotTime: number = 0;    // For strafing shots

  // Fly-in properties for wave intro
  public flyInState: FlyInState = FlyInState.ARRIVED;  // Default to arrived for normal gameplay
  public flyInStartPos: THREE.Vector3 = new THREE.Vector3();
  public flyInProgress: number = 0;
  public flyInDelay: number = 0;          // Staggered start time

  private group: THREE.Group;
  private voxels: THREE.InstancedMesh[] = []; // One for each frame
  private animationFrame: number = 0;
  private currentBrightness: number = 1.0;

  constructor(data: AlienData, scene: THREE.Scene) {
    this.type = data.type;
    this.points = data.points;
    this.gridX = data.gridX;
    this.gridY = data.gridY;

    this.group = new THREE.Group();
    this.createVoxelSprite();
    scene.add(this.group);
  }

  private createVoxelSprite(): void {
    const scale = GameConfig.aliens.scale || 1;
    const baseVoxelSize = 1.0 * scale;
    // Smaller voxels for higher resolution
    const voxelSize = baseVoxelSize / RESOLUTION_MULTIPLIER;
    const sprite = ALIEN_SPRITES[this.type];
    const color = this.getColor(1.0); // Start at full brightness

    // Create geometry for voxels - full depth for blocky 3D look
    const geometry = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize * 2);

    // Use MeshLambertMaterial for shaded 3D look
    const material = new THREE.MeshLambertMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.3, // Slight glow so they're still visible
    });

    // Create instanced mesh for each animation frame
    for (let frame = 0; frame < 2; frame++) {
      const pattern = sprite[frame];
      const height = pattern.length;
      const width = pattern[0].length;

      // Count filled voxels (each sprite pixel = RESOLUTION_MULTIPLIER^2 voxels)
      let count = 0;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (pattern[y][x] === 1) {
            count += RESOLUTION_MULTIPLIER * RESOLUTION_MULTIPLIER;
          }
        }
      }

      const instancedMesh = new THREE.InstancedMesh(geometry, material.clone(), count);

      // Position each voxel
      const matrix = new THREE.Matrix4();
      let index = 0;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (pattern[y][x] === 1) {
            // Create NxN voxels for each sprite pixel
            for (let dy = 0; dy < RESOLUTION_MULTIPLIER; dy++) {
              for (let dx = 0; dx < RESOLUTION_MULTIPLIER; dx++) {
                // Center the sprite and flip Y so top of sprite is at top
                const px = (x - width / 2 + 0.5) * baseVoxelSize + (dx - (RESOLUTION_MULTIPLIER - 1) / 2) * voxelSize;
                const py = (height / 2 - y - 0.5) * baseVoxelSize + ((RESOLUTION_MULTIPLIER - 1) / 2 - dy) * voxelSize;
                const pz = 0;

                matrix.setPosition(px, py, pz);
                instancedMesh.setMatrixAt(index, matrix);
                index++;
              }
            }
          }
        }
      }

      instancedMesh.instanceMatrix.needsUpdate = true;
      instancedMesh.visible = frame === 0; // Only first frame visible initially
      this.group.add(instancedMesh);
      this.voxels.push(instancedMesh);
    }
  }

  private getColor(brightness: number): number {
    const baseColor = ALIEN_COLORS[this.type];
    const r = Math.floor(baseColor.r * brightness);
    const g = Math.floor(baseColor.g * brightness);
    const b = Math.floor(baseColor.b * brightness);
    return (r << 16) | (g << 8) | b;
  }

  // Update brightness based on position in column (0 = front, more = dimmer)
  updateBrightness(aliensInFront: number): void {
    // Brightness: front alien = 1.0, each alien behind loses 0.15 brightness
    // Minimum brightness is 0.3
    const brightness = Math.max(0.3, 1.0 - aliensInFront * 0.15);

    if (brightness === this.currentBrightness) return;
    this.currentBrightness = brightness;

    const color = new THREE.Color(this.getColor(brightness));

    // Update material color and emissive for both animation frames
    this.voxels.forEach(mesh => {
      const mat = mesh.material as THREE.MeshLambertMaterial;
      mat.color = color;
      mat.emissive = color;
      mat.emissiveIntensity = 0.3 * brightness;
    });
  }

  setPosition(x: number, y: number, z: number): void {
    this.group.position.set(x, y, z);
  }

  getPosition(): THREE.Vector3 {
    return this.group.position.clone();
  }

  getBoundingBox(): THREE.Box3 {
    return new THREE.Box3().setFromObject(this.group);
  }

  getBoundingSphere(): THREE.Sphere {
    const sphere = new THREE.Sphere();
    this.getBoundingBox().getBoundingSphere(sphere);
    return sphere;
  }

  // Toggle between animation frames
  animate(): void {
    this.animationFrame = 1 - this.animationFrame;
    this.voxels[0].visible = this.animationFrame === 0;
    this.voxels[1].visible = this.animationFrame === 1;
  }

  destroy(scene: THREE.Scene): void {
    this.alive = false;
    scene.remove(this.group);
    this.voxels.forEach(mesh => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    });
  }

  hide(): void {
    this.group.visible = false;
    this.alive = false;
  }

  show(): void {
    this.group.visible = true;
    this.alive = true;
  }

  // Get current color for explosion effects
  getCurrentColor(): number {
    return this.getColor(this.currentBrightness);
  }

  // Dive bomber methods
  startDive(targetX: number, currentTime: number): void {
    if (this.type !== 'squid' || this.diveState !== DiveState.NONE) return;

    this.diveState = DiveState.DIVING;
    this.diveProgress = 0;
    this.diveStartPos.copy(this.group.position);
    this.formationPos.copy(this.group.position);
    this.diveTargetX = targetX;
    this.lastDiveShotTime = currentTime;  // Initialize to current time so shots don't fire immediately

    // Set to full brightness when diving
    this.updateBrightness(0);
  }

  isDiving(): boolean {
    return this.diveState !== DiveState.NONE;
  }

  // Get the group for rotation during dive
  getGroup(): THREE.Group {
    return this.group;
  }

  // Reset dive state (when killed or wave ends)
  resetDive(): void {
    this.diveState = DiveState.NONE;
    this.diveProgress = 0;
    this.group.rotation.set(0, 0, 0);
  }

  // Fly-in methods for wave intro
  startFlyIn(startPos: THREE.Vector3, targetPos: THREE.Vector3, delay: number): void {
    this.flyInState = FlyInState.WAITING;
    this.flyInStartPos.copy(startPos);
    this.formationPos.copy(targetPos);
    this.flyInProgress = 0;
    this.flyInDelay = delay;
    this.setPosition(startPos.x, startPos.y, startPos.z);
    this.group.visible = false;  // Hidden until fly-in starts
  }

  updateFlyIn(deltaTime: number, elapsedTime: number): boolean {
    if (this.flyInState === FlyInState.ARRIVED) return true;

    if (this.flyInState === FlyInState.WAITING) {
      if (elapsedTime >= this.flyInDelay) {
        this.flyInState = FlyInState.FLYING;
        this.group.visible = true;
      }
      return false;
    }

    // Flying state
    const flySpeed = 120;  // Units per second
    const totalDistance = this.flyInStartPos.distanceTo(this.formationPos);
    this.flyInProgress += (flySpeed * deltaTime) / totalDistance;

    if (this.flyInProgress >= 1) {
      // Arrived at formation
      this.flyInState = FlyInState.ARRIVED;
      this.flyInProgress = 1;
      this.setPosition(this.formationPos.x, this.formationPos.y, this.formationPos.z);
      this.group.rotation.set(0, 0, 0);
      return true;
    }

    // Smooth ease-out interpolation
    const t = 1 - Math.pow(1 - this.flyInProgress, 2);

    const x = this.flyInStartPos.x + (this.formationPos.x - this.flyInStartPos.x) * t;
    const y = this.flyInStartPos.y + (this.formationPos.y - this.flyInStartPos.y) * t;
    const z = this.flyInStartPos.z + (this.formationPos.z - this.flyInStartPos.z) * t;

    this.setPosition(x, y, z);

    // Rotate to face direction of travel
    const dx = this.formationPos.x - x;
    const dz = this.formationPos.z - z;
    const roll = Math.atan2(dx, Math.abs(dz)) * 0.5;
    this.group.rotation.set(0, 0, roll);

    // Animate during flight
    if (Math.random() < 0.15) this.animate();

    return false;
  }

  isFlyingIn(): boolean {
    return this.flyInState !== FlyInState.ARRIVED;
  }
}
