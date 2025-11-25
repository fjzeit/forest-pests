import * as THREE from 'three';
import { GameConfig } from '../game/GameConfig';
import { AlienShotType } from './AlienFormation';
import { Alien } from './Alien';

export enum ProjectileType {
  PLAYER,
  ALIEN,
}

export class Projectile {
  public readonly type: ProjectileType;
  public readonly shotType: AlienShotType | 'straight';
  public readonly sourceAlien: Alien | null;  // Track which alien fired this shot

  private mesh: THREE.Mesh;
  private velocity: THREE.Vector3;
  private time: number = 0;

  constructor(
    position: THREE.Vector3,
    direction: THREE.Vector3,
    type: ProjectileType,
    shotType: AlienShotType | 'straight',
    scene: THREE.Scene,
    sourceAlien: Alien | null = null  // Optional: alien that fired this shot
  ) {
    this.sourceAlien = sourceAlien;
    this.type = type;
    this.shotType = shotType;

    // Create projectile mesh
    const isPlayer = type === ProjectileType.PLAYER;
    const geometry = isPlayer
      ? new THREE.CylinderGeometry(0.3, 0.3, 3, 8)
      : new THREE.SphereGeometry(0.5, 8, 8);

    const color = isPlayer
      ? GameConfig.projectiles.playerColor
      : GameConfig.projectiles.alienColor;

    const material = new THREE.MeshBasicMaterial({
      color,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(position);

    // Rotate cylinder to point in direction of travel
    if (isPlayer) {
      const axis = new THREE.Vector3(0, 1, 0);
      const quaternion = new THREE.Quaternion().setFromUnitVectors(axis, direction);
      this.mesh.quaternion.copy(quaternion);
    }

    scene.add(this.mesh);

    // Calculate velocity
    const speed = isPlayer
      ? GameConfig.projectiles.playerSpeed
      : GameConfig.projectiles.alienSpeed;

    this.velocity = direction.clone().multiplyScalar(speed);
  }

  update(deltaTime: number): void {
    this.time += deltaTime;

    // Apply velocity - all shots travel straight (no lateral deviation)
    const movement = this.velocity.clone().multiplyScalar(deltaTime);
    this.mesh.position.add(movement);

    // Rotate for visual effect (alien shots)
    if (this.type === ProjectileType.ALIEN) {
      this.mesh.rotation.x += deltaTime * 5;
      this.mesh.rotation.z += deltaTime * 3;
    }
  }

  getPosition(): THREE.Vector3 {
    return this.mesh.position.clone();
  }

  getBoundingSphere(): THREE.Sphere {
    const radius = this.type === ProjectileType.PLAYER ? 0.5 : 0.7;
    return new THREE.Sphere(this.mesh.position.clone(), radius);
  }

  isOutOfBounds(): boolean {
    const pos = this.mesh.position;

    // Player shots go negative Z (away from player)
    // Alien shots go positive Z (toward player)
    if (this.type === ProjectileType.PLAYER) {
      return pos.z < -GameConfig.aliens.startDistance - 50 ||
             pos.y > 150 ||
             pos.y < 0;
    } else {
      return pos.z > 50 ||
             pos.y < 0 ||
             Math.abs(pos.x) > 150;
    }
  }

  destroy(scene: THREE.Scene): void {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
