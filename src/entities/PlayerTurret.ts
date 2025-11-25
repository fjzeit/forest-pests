import * as THREE from 'three';
import { GameConfig } from '../game/GameConfig';
import { InputManager } from '../systems/InputManager';

export interface ShotData {
  position: THREE.Vector3;
  direction: THREE.Vector3;
}

export class PlayerTurret {
  private camera: THREE.PerspectiveCamera;
  private position: THREE.Vector3;
  private yaw: number = 0;       // Horizontal rotation
  private pitch: number;          // Vertical rotation (starts at base pitch)
  private lastFireTime: number = 0;

  // FPS gun and hands attached to camera
  private gunGroup: THREE.Group;
  private recoilOffset: number = 0;  // For recoil animation

  constructor(camera: THREE.PerspectiveCamera, scene: THREE.Scene) {
    this.camera = camera;
    this.position = new THREE.Vector3(0, GameConfig.player.height, GameConfig.player.zPosition);
    this.pitch = GameConfig.player.basePitch;

    // Create FPS gun and hands group
    this.gunGroup = new THREE.Group();

    // Materials - sci-fi laser pistol
    const gunBody = new THREE.MeshBasicMaterial({ color: 0x444455 });
    const gunGlow = new THREE.MeshBasicMaterial({ color: 0x00ff44 });
    const gunAccent = new THREE.MeshBasicMaterial({ color: 0x222233 });

    // === LASER PISTOL (no arms, larger gun) ===
    const gunBodyGroup = new THREE.Group();
    const gunScale = 1.8; // Scale up the gun

    // Main body - sleek angular shape
    const bodyGeom = new THREE.BoxGeometry(0.6 * gunScale, 0.8 * gunScale, 3 * gunScale);
    const body = new THREE.Mesh(bodyGeom, gunBody);
    body.position.set(0.6, -1.2, -5);
    gunBodyGroup.add(body);

    // Top rail/sight mount
    const railGeom = new THREE.BoxGeometry(0.3 * gunScale, 0.2 * gunScale, 2 * gunScale);
    const rail = new THREE.Mesh(railGeom, gunAccent);
    rail.position.set(0.6, -0.4, -5);
    gunBodyGroup.add(rail);

    // Energy cell/power pack (glowing)
    const cellGeom = new THREE.BoxGeometry(0.4 * gunScale, 0.6 * gunScale, 0.8 * gunScale);
    const cell = new THREE.Mesh(cellGeom, gunGlow);
    cell.position.set(0.6, -2.2, -3.5);
    gunBodyGroup.add(cell);

    // Pistol grip
    const gripGeom = new THREE.BoxGeometry(0.4 * gunScale, 1.2 * gunScale, 0.6 * gunScale);
    const grip = new THREE.Mesh(gripGeom, gunAccent);
    grip.position.set(0.6, -2.8, -3);
    grip.rotation.x = -0.3;
    gunBodyGroup.add(grip);

    // Barrel shroud - angular
    const shroudGeom = new THREE.BoxGeometry(0.5 * gunScale, 0.5 * gunScale, 2.5 * gunScale);
    const shroud = new THREE.Mesh(shroudGeom, gunBody);
    shroud.position.set(0.6, -1.2, -8);
    gunBodyGroup.add(shroud);

    // Barrel - glowing emitter
    const barrelGeom = new THREE.CylinderGeometry(0.12 * gunScale, 0.15 * gunScale, 1.5 * gunScale, 8);
    const barrel = new THREE.Mesh(barrelGeom, gunGlow);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0.6, -1.2, -10);
    gunBodyGroup.add(barrel);

    // Muzzle emitter ring
    const muzzleGeom = new THREE.TorusGeometry(0.25 * gunScale, 0.06 * gunScale, 8, 16);
    const muzzle = new THREE.Mesh(muzzleGeom, gunGlow);
    muzzle.position.set(0.6, -1.2, -11);
    gunBodyGroup.add(muzzle);

    this.gunGroup.add(gunBodyGroup);

    // Add gun to scene (not camera) - we'll position it manually each frame
    scene.add(this.gunGroup);

    this.updateCamera();
    this.updateGunPosition();
  }

  private updateGunPosition(): void {
    // Position gun relative to camera - very close, bottom right
    // Offset: right, down, forward from camera
    const offset = new THREE.Vector3(1.5, -1.2, -2);

    // Apply camera rotation to offset
    offset.applyQuaternion(this.camera.quaternion);

    // Position gun at camera position + rotated offset
    this.gunGroup.position.copy(this.camera.position).add(offset);

    // Match gun rotation to camera, with recoil
    this.gunGroup.quaternion.copy(this.camera.quaternion);

    // Apply recoil rotation (pitch up slightly)
    if (this.recoilOffset > 0) {
      const recoilQuat = new THREE.Quaternion();
      recoilQuat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -this.recoilOffset * 0.3);
      this.gunGroup.quaternion.multiply(recoilQuat);
    }
  }

  update(deltaTime: number, input: InputManager): void {
    // Handle strafe movement (A/D)
    const moveInput = input.getMoveInput();
    if (moveInput.x !== 0) {
      this.position.x += moveInput.x * GameConfig.player.strafeSpeed * deltaTime;
      // Clamp to strafe limits
      this.position.x = Math.max(
        -GameConfig.player.strafeLimit,
        Math.min(GameConfig.player.strafeLimit, this.position.x)
      );
    }

    // Handle forward/backward movement (W/S)
    if (moveInput.y !== 0) {
      const moveSpeed = GameConfig.player.strafeSpeed * 0.7; // Slightly slower forward/back
      this.position.z -= moveInput.y * moveSpeed * deltaTime; // Negative because forward is -Z
      // Clamp Z position: from starting position to just before shield
      const minZ = GameConfig.player.zPosition; // Starting position (back)
      const maxZ = -(GameConfig.shields.distance - 15); // Just before shield
      this.position.z = Math.max(maxZ, Math.min(minZ, this.position.z));
    }

    // Handle mouse aim (only when pointer is locked)
    if (input.isPointerLocked()) {
      const mouseDelta = input.getMouseDelta();

      // Limited horizontal aiming (~18 degrees = 0.31 radians)
      const maxYawLimit = 0.31;
      this.yaw -= mouseDelta.x * GameConfig.player.aimSensitivity;
      this.yaw = Math.max(-maxYawLimit, Math.min(maxYawLimit, this.yaw));

      // Update pitch (vertical)
      this.pitch -= mouseDelta.y * GameConfig.player.aimSensitivity;
      // Clamp pitch around the base pitch
      const minPitch = GameConfig.player.basePitch - GameConfig.player.maxPitch;
      const maxPitch = GameConfig.player.basePitch + GameConfig.player.maxPitch;
      this.pitch = Math.max(minPitch, Math.min(maxPitch, this.pitch));
    }

    // Animate recoil recovery
    if (this.recoilOffset > 0) {
      this.recoilOffset -= deltaTime * 8; // Recover speed
      if (this.recoilOffset < 0) this.recoilOffset = 0;
    }

    this.updateCamera();
    this.updateGunPosition();
  }

  private updateCamera(): void {
    this.camera.position.copy(this.position);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  canFire(): boolean {
    const now = performance.now() / 1000;
    return now - this.lastFireTime >= GameConfig.player.fireRate;
  }

  fire(): ShotData | null {
    if (!this.canFire()) return null;

    this.lastFireTime = performance.now() / 1000;

    // Trigger recoil animation
    this.recoilOffset = 0.08;

    // Get direction camera is facing
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(this.camera.quaternion);
    direction.normalize();

    // Start projectile at muzzle position (end of gun barrel)
    // Muzzle emitter is at local position (0.6, -1.2, -11) relative to gun group
    const muzzleLocal = new THREE.Vector3(0.6, -1.2, -11.5);
    const position = this.gunGroup.localToWorld(muzzleLocal.clone());

    return { position, direction };
  }

  getPosition(): THREE.Vector3 {
    return this.position.clone();
  }

  getAimDirection(): THREE.Vector3 {
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(this.camera.quaternion);
    return direction.normalize();
  }

  reset(): void {
    this.position.set(0, GameConfig.player.height, GameConfig.player.zPosition);
    this.yaw = 0;
    this.pitch = GameConfig.player.basePitch;
    this.lastFireTime = 0;
    this.recoilOffset = 0;
    this.gunGroup.visible = true;
    this.updateCamera();
    this.updateGunPosition();
  }

  // For collision detection - returns a bounding sphere around player
  getBoundingSphere(): THREE.Sphere {
    return new THREE.Sphere(this.position.clone(), 2);
  }

  // Get gun position for explosions (in world space)
  getTurretPosition(): THREE.Vector3 {
    return this.position.clone();
  }

  // Hide gun (for death animation)
  hideTurret(): void {
    this.gunGroup.visible = false;
  }

  // Show gun
  showTurret(): void {
    this.gunGroup.visible = true;
  }
}
