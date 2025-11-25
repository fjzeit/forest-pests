import * as THREE from 'three';
import { GameConfig } from '../game/GameConfig';

interface Voxel {
  x: number;
  y: number;
  z: number;
  health: number;
  maxHealth: number;
  instanceId: number;
  alive: boolean;
}

export interface ShieldHitResult {
  hit: boolean;
  position: THREE.Vector3 | null;
}

export class Shield {
  private voxels: Voxel[] = [];
  private instancedMesh: THREE.InstancedMesh;
  private position: THREE.Vector3;
  private voxelSize: number;
  private width: number;
  private height: number;
  private depth: number;
  private dummy: THREE.Object3D = new THREE.Object3D();
  private tiltAngle: number = 0.4; // Tilt angle in radians (~23 degrees) - tilted back to face incoming fire

  private voxelHealth: number;

  constructor(position: THREE.Vector3, scene: THREE.Scene, voxelHealth: number = 3) {
    this.position = position;
    this.voxelSize = GameConfig.shields.voxelSize;
    this.width = GameConfig.shields.width;
    this.height = GameConfig.shields.height;
    this.depth = GameConfig.shields.depth;
    this.voxelHealth = voxelHealth;

    // Create instanced mesh for efficient rendering
    const voxelGeometry = new THREE.BoxGeometry(
      this.voxelSize,
      this.voxelSize,
      this.voxelSize
    );

    // Use a bright emissive material for visibility
    const voxelMaterial = new THREE.MeshBasicMaterial({
      color: 0x0088ff,
      transparent: true,
      opacity: 0.9,
    });

    // Calculate max voxels
    const maxVoxels = Math.ceil(this.width / this.voxelSize) *
                      Math.ceil(this.height / this.voxelSize) *
                      Math.ceil(this.depth / this.voxelSize);

    this.instancedMesh = new THREE.InstancedMesh(
      voxelGeometry,
      voxelMaterial,
      maxVoxels
    );

    // Enable per-instance color for density visualization
    this.instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(maxVoxels * 3),
      3
    );

    scene.add(this.instancedMesh);

    // Create shield shape (simple rectangular wall)
    this.createShieldShape();
    this.updateInstancedMesh();
  }

  private createShieldShape(): void {
    const voxelsX = Math.ceil(this.width / this.voxelSize);
    const voxelsY = Math.ceil(this.height / this.voxelSize);
    const voxelsZ = Math.ceil(this.depth / this.voxelSize);

    let instanceId = 0;
    const maxHealth = this.voxelHealth;

    // Simple rectangular shape - no cutouts
    for (let x = 0; x < voxelsX; x++) {
      for (let y = 0; y < voxelsY; y++) {
        for (let z = 0; z < voxelsZ; z++) {
          this.voxels.push({
            x,
            y,
            z,
            health: maxHealth,
            maxHealth: maxHealth,
            instanceId: instanceId++,
            alive: true
          });
        }
      }
    }
  }

  private updateInstancedMesh(): void {
    const offsetX = -this.width / 2;
    const offsetY = 0;
    const offsetZ = -this.depth / 2;

    // Hide all instances first
    for (let i = 0; i < this.instancedMesh.count; i++) {
      this.dummy.position.set(0, -1000, 0); // Move off-screen
      this.dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
    }

    // Position alive voxels with tilt
    this.voxels.forEach(voxel => {
      if (!voxel.alive || voxel.health <= 0) {
        voxel.alive = false;
        return;
      }

      // Calculate local position
      const localX = offsetX + voxel.x * this.voxelSize;
      const localY = offsetY + voxel.y * this.voxelSize;
      const localZ = offsetZ + voxel.z * this.voxelSize;

      // Apply tilt rotation around X axis (lean back toward aliens)
      const tiltedY = localY * Math.cos(this.tiltAngle) - localZ * Math.sin(this.tiltAngle);
      const tiltedZ = localY * Math.sin(this.tiltAngle) + localZ * Math.cos(this.tiltAngle);

      const worldX = this.position.x + localX;
      const worldY = this.position.y + tiltedY;
      const worldZ = this.position.z + tiltedZ;

      this.dummy.position.set(worldX, worldY, worldZ);
      this.dummy.rotation.set(this.tiltAngle, 0, 0);
      this.dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(voxel.instanceId, this.dummy.matrix);

      // Update color based on health (blue -> cyan -> dark blue)
      const healthRatio = voxel.health / voxel.maxHealth;
      const color = new THREE.Color();
      if (healthRatio > 0.6) {
        color.setRGB(0, 0.53, 1); // Blue - healthy
      } else if (healthRatio > 0.3) {
        color.setRGB(0, 0.8, 1); // Cyan - damaged
      } else {
        color.setRGB(0.2, 0.2, 0.8); // Dark blue - critical
      }
      this.instancedMesh.setColorAt(voxel.instanceId, color);
    });

    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true;
    }
  }

  // Check if a point hits the shield and damage it - returns hit info for explosion
  // damage parameter: 1 for alien shots, 5 for player shots
  checkHit(point: THREE.Vector3, radius: number, damage: number = 1): ShieldHitResult {
    // Transform point to local space accounting for shield tilt
    const localPoint = point.clone().sub(this.position);

    // Inverse tilt rotation to get to untilted local space
    const untiltedY = localPoint.y * Math.cos(-this.tiltAngle) - localPoint.z * Math.sin(-this.tiltAngle);
    const untiltedZ = localPoint.y * Math.sin(-this.tiltAngle) + localPoint.z * Math.cos(-this.tiltAngle);

    // Convert to voxel grid coordinates
    const localX = localPoint.x + this.width / 2;
    const localY = untiltedY;
    const localZ = untiltedZ + this.depth / 2;

    const voxelX = Math.floor(localX / this.voxelSize);
    const voxelY = Math.floor(localY / this.voxelSize);
    const voxelZ = Math.floor(localZ / this.voxelSize);

    // Find the closest alive voxel to damage
    let closestVoxel: Voxel | null = null;
    let closestDist = Infinity;
    let hitPosition: THREE.Vector3 | null = null;

    // Search radius in voxels
    const searchRadius = 2;

    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      for (let dy = -searchRadius; dy <= searchRadius; dy++) {
        for (let dz = -searchRadius; dz <= searchRadius; dz++) {
          const voxel = this.getVoxelAt(voxelX + dx, voxelY + dy, voxelZ + dz);
          if (voxel && voxel.alive && voxel.health > 0) {
            // Calculate distance to voxel center
            const voxelCenterX = (voxelX + dx + 0.5) * this.voxelSize;
            const voxelCenterY = (voxelY + dy + 0.5) * this.voxelSize;
            const voxelCenterZ = (voxelZ + dz + 0.5) * this.voxelSize;

            const dist = Math.sqrt(
              Math.pow(localX - voxelCenterX, 2) +
              Math.pow(localY - voxelCenterY, 2) +
              Math.pow(localZ - voxelCenterZ, 2)
            );

            // Check if within hit radius
            const hitThreshold = radius + this.voxelSize * 1.5;
            if (dist < hitThreshold && dist < closestDist) {
              closestDist = dist;
              closestVoxel = voxel;

              // Calculate world position for explosion effect
              const voxelLocalX = -this.width / 2 + voxelCenterX;
              const voxelLocalY = voxelCenterY;
              const voxelLocalZ = -this.depth / 2 + voxelCenterZ;

              const tiltedY = voxelLocalY * Math.cos(this.tiltAngle) - voxelLocalZ * Math.sin(this.tiltAngle);
              const tiltedZ = voxelLocalY * Math.sin(this.tiltAngle) + voxelLocalZ * Math.cos(this.tiltAngle);

              hitPosition = new THREE.Vector3(
                this.position.x + voxelLocalX,
                this.position.y + tiltedY,
                this.position.z + tiltedZ
              );
            }
          }
        }
      }
    }

    if (closestVoxel) {
      closestVoxel.health -= damage;
      if (closestVoxel.health <= 0) {
        closestVoxel.alive = false;
      }
      this.updateInstancedMesh();
      return { hit: true, position: hitPosition };
    }

    return { hit: false, position: null };
  }

  private getVoxelAt(x: number, y: number, z: number): Voxel | undefined {
    return this.voxels.find(v => v.x === x && v.y === y && v.z === z);
  }

  // Get bounding box for quick collision pre-check (expanded to account for tilt)
  getBoundingBox(): THREE.Box3 {
    const expandedHeight = this.height * 1.5; // Account for tilted shield
    const expandedDepth = this.depth + this.height * Math.sin(Math.abs(this.tiltAngle));

    return new THREE.Box3(
      new THREE.Vector3(
        this.position.x - this.width / 2 - this.voxelSize * 2,
        this.position.y - this.voxelSize * 2,
        this.position.z - expandedDepth - this.voxelSize * 2
      ),
      new THREE.Vector3(
        this.position.x + this.width / 2 + this.voxelSize * 2,
        this.position.y + expandedHeight + this.voxelSize * 2,
        this.position.z + this.depth / 2 + this.voxelSize * 2
      )
    );
  }

  hasAliveVoxels(): boolean {
    return this.voxels.some(v => v.alive && v.health > 0);
  }

  destroy(scene: THREE.Scene): void {
    scene.remove(this.instancedMesh);
    this.instancedMesh.geometry.dispose();
    (this.instancedMesh.material as THREE.Material).dispose();
  }
}
