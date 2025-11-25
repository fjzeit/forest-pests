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

export class Alien {
  public alive: boolean = true;
  public readonly type: AlienType;
  public readonly points: number;
  public readonly gridX: number;
  public readonly gridY: number;

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

    // Create geometry for voxels
    const geometry = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize * 0.5);

    // Use MeshBasicMaterial for maximum brightness (unlit)
    const material = new THREE.MeshBasicMaterial({
      color: color,
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

    // Update material color for both animation frames
    this.voxels.forEach(mesh => {
      (mesh.material as THREE.MeshBasicMaterial).color = color;
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
}
