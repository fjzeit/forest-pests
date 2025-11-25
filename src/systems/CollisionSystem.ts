import * as THREE from 'three';
import { Projectile, ProjectileType } from '../entities/Projectile';
import { AlienFormation } from '../entities/AlienFormation';
import { Alien } from '../entities/Alien';
import { Shield } from '../entities/Shield';
import { PlayerTurret } from '../entities/PlayerTurret';

export interface CollisionResult {
  destroyedProjectiles: Projectile[];
  alienHits: { alien: Alien; points: number; position: THREE.Vector3 }[];
  shieldHits: { shield: Shield; position: THREE.Vector3 }[];
  playerHit: boolean;
}

export class CollisionSystem {
  checkAll(
    projectiles: Projectile[],
    alienFormation: AlienFormation,
    shields: Shield[],
    player: PlayerTurret
  ): CollisionResult {
    const result: CollisionResult = {
      destroyedProjectiles: [],
      alienHits: [],
      shieldHits: [],
      playerHit: false,
    };

    for (const projectile of projectiles) {
      const pos = projectile.getPosition();
      const sphere = projectile.getBoundingSphere();

      if (projectile.type === ProjectileType.PLAYER) {
        // Player shots can hit aliens and shields
        this.checkPlayerProjectile(projectile, pos, sphere, alienFormation, shields, result);
      } else {
        // Alien shots can hit player and shields
        this.checkAlienProjectile(projectile, pos, sphere, shields, player, result);
      }
    }

    return result;
  }

  private checkPlayerProjectile(
    projectile: Projectile,
    pos: THREE.Vector3,
    sphere: THREE.Sphere,
    alienFormation: AlienFormation,
    shields: Shield[],
    result: CollisionResult
  ): void {
    // Check against aliens
    const aliens = alienFormation.getAllAliens();
    for (const alien of aliens) {
      if (!alien.alive) continue;

      const alienSphere = alien.getBoundingSphere();
      if (sphere.center.distanceTo(alienSphere.center) < sphere.radius + alienSphere.radius) {
        // Hit!
        const hitPos = alien.getPosition();
        alien.hide();
        result.alienHits.push({ alien, points: alien.points, position: hitPos });
        result.destroyedProjectiles.push(projectile);
        return; // Projectile is destroyed, stop checking
      }
    }

    // Check against shields (player shots can damage shields from below)
    for (const shield of shields) {
      const boundingBox = shield.getBoundingBox();
      if (boundingBox.containsPoint(pos)) {
        const hitResult = shield.checkHit(pos, sphere.radius);
        if (hitResult.hit && hitResult.position) {
          result.shieldHits.push({ shield, position: hitResult.position });
          result.destroyedProjectiles.push(projectile);
          return;
        }
      }
    }
  }

  private checkAlienProjectile(
    projectile: Projectile,
    pos: THREE.Vector3,
    sphere: THREE.Sphere,
    shields: Shield[],
    player: PlayerTurret,
    result: CollisionResult
  ): void {
    // Check against shields
    for (const shield of shields) {
      const boundingBox = shield.getBoundingBox();
      if (boundingBox.containsPoint(pos)) {
        const hitResult = shield.checkHit(pos, sphere.radius);
        if (hitResult.hit && hitResult.position) {
          result.shieldHits.push({ shield, position: hitResult.position });
          result.destroyedProjectiles.push(projectile);
          return;
        }
      }
    }

    // Check against player - use horizontal distance only (infinite vertical hit area)
    const playerPos = player.getPosition();
    const horizontalDist = Math.sqrt(
      Math.pow(pos.x - playerPos.x, 2) +
      Math.pow(pos.z - playerPos.z, 2)
    );
    const hitRadius = 8; // Horizontal hit radius

    if (horizontalDist < hitRadius + sphere.radius) {
      result.playerHit = true;
      result.destroyedProjectiles.push(projectile);
      return;
    }
  }
}
