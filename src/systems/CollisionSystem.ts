import * as THREE from 'three';
import { Projectile, ProjectileType } from '../entities/Projectile';
import { AlienFormation } from '../entities/AlienFormation';
import { Alien } from '../entities/Alien';
import { Shield } from '../entities/Shield';
import { PlayerTurret } from '../entities/PlayerTurret';

export interface CollisionResult {
  destroyedProjectiles: Projectile[];
  alienHits: { alien: Alien; points: number; position: THREE.Vector3 }[];
  shieldHits: { shield: Shield; position: THREE.Vector3; isPlayerShot: boolean }[];
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
    // Check against aliens using squared distance (avoids sqrt)
    const aliens = alienFormation.getAllAliens();
    for (const alien of aliens) {
      if (!alien.alive) continue;

      const alienSphere = alien.getBoundingSphere();
      const radiusSum = sphere.radius + alienSphere.radius;
      const radiusSumSq = radiusSum * radiusSum;
      // Use distanceToSquared to avoid sqrt calculation
      if (sphere.center.distanceToSquared(alienSphere.center) < radiusSumSq) {
        // Hit!
        const hitPos = alien.getPosition().clone();  // Clone needed here since we store it
        alien.hide();
        result.alienHits.push({ alien, points: alien.points, position: hitPos });
        result.destroyedProjectiles.push(projectile);
        return; // Projectile is destroyed, stop checking
      }
    }

    // Check against shields (player shots can damage shields from below)
    // Player shots do 50x damage to shields
    for (const shield of shields) {
      const boundingBox = shield.getBoundingBox();
      if (boundingBox.containsPoint(pos)) {
        const hitResult = shield.checkHit(pos, sphere.radius, 50);
        if (hitResult.hit && hitResult.position) {
          result.shieldHits.push({ shield, position: hitResult.position, isPlayerShot: true });
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
          result.shieldHits.push({ shield, position: hitResult.position, isPlayerShot: false });
          result.destroyedProjectiles.push(projectile);
          return;
        }
      }
    }

    // Check against player - use horizontal squared distance (avoids sqrt)
    const playerPos = player.getPosition();
    const dx = pos.x - playerPos.x;
    const dz = pos.z - playerPos.z;
    const horizontalDistSq = dx * dx + dz * dz;
    const hitRadius = 8 + sphere.radius;
    const hitRadiusSq = hitRadius * hitRadius;

    if (horizontalDistSq < hitRadiusSq) {
      result.playerHit = true;
      result.destroyedProjectiles.push(projectile);
      return;
    }
  }
}
