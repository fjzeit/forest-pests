import * as THREE from 'three';
import { GameConfig } from '../game/GameConfig';
import { InputManager } from '../systems/InputManager';

export interface ShotData {
  position: THREE.Vector3;
  direction: THREE.Vector3;
}

// Maximum yaw angle in radians (~18 degrees each way, 36 total)
const MAX_YAW = 0.31;

export class PlayerTurret {
  private camera: THREE.PerspectiveCamera;
  private position: THREE.Vector3;
  private yaw: number = 0;       // Horizontal rotation
  private pitch: number;          // Vertical rotation (starts at base pitch)
  private lastFireTime: number = 0;

  // Simple gun group
  private gunGroup: THREE.Group;
  private recoilOffset: number = 0;

  // HUD aim indicator
  private aimIndicator: HTMLElement | null = null;

  constructor(camera: THREE.PerspectiveCamera, scene: THREE.Scene) {
    this.camera = camera;
    this.position = new THREE.Vector3(0, GameConfig.player.height, GameConfig.player.zPosition);
    this.pitch = GameConfig.player.basePitch;

    // Materials - clean space laser
    const hull = new THREE.MeshBasicMaterial({ color: 0x667788 });
    const hullLight = new THREE.MeshBasicMaterial({ color: 0x8899aa });
    const energyGlow = new THREE.MeshBasicMaterial({ color: 0x00ff66 });

    // === SPACE LASER CANNON ===
    this.gunGroup = new THREE.Group();

    // Rear housing
    const rearGeom = new THREE.CylinderGeometry(0.7, 0.8, 2, 16);
    const rear = new THREE.Mesh(rearGeom, hull);
    rear.rotation.x = Math.PI / 2;
    rear.position.set(0, 0, -2.5);
    this.gunGroup.add(rear);

    // Main barrel - long sleek cylinder
    const barrelGeom = new THREE.CylinderGeometry(0.45, 0.5, 10, 16);
    const barrel = new THREE.Mesh(barrelGeom, hullLight);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0, -8.5);
    this.gunGroup.add(barrel);

    // Muzzle tip - glowing
    const muzzleGeom = new THREE.CylinderGeometry(0.35, 0.45, 1, 16);
    const muzzle = new THREE.Mesh(muzzleGeom, energyGlow);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0, -14);
    this.gunGroup.add(muzzle);

    scene.add(this.gunGroup);

    // Create HUD aim arc
    this.createAimIndicator();

    this.updateCamera();
    this.updateGunPosition();
  }

  private createAimIndicator(): void {
    // Create SVG arc showing aim limits
    this.aimIndicator = document.getElementById('aim-arc');
    if (!this.aimIndicator) {
      this.aimIndicator = document.createElement('div');
      this.aimIndicator.id = 'aim-arc';
      this.aimIndicator.innerHTML = `
        <svg viewBox="0 0 200 30" preserveAspectRatio="xMidYMax meet">
          <path d="M 10 25 Q 100 0 190 25" fill="none" stroke="rgba(0,170,255,0.4)" stroke-width="3"/>
          <circle id="aim-dot" cx="100" cy="12" r="4" fill="#00ff44"/>
        </svg>
      `;
      document.getElementById('ui-overlay')?.appendChild(this.aimIndicator);
    }
  }

  private updateAimIndicator(): void {
    const dot = document.getElementById('aim-dot');
    if (dot) {
      // Map yaw (-MAX_YAW to +MAX_YAW) to t parameter (0 to 1)
      // Inverted so dot shows turret position relative to arc (aim left = dot right)
      const normalizedYaw = (this.yaw / MAX_YAW); // -1 to 1
      const t = (-normalizedYaw + 1) / 2; // 0 to 1, inverted

      // Quadratic bezier: P0=(10,25), P1=(100,0), P2=(190,25)
      // B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
      const oneMinusT = 1 - t;
      const dotX = oneMinusT * oneMinusT * 10 + 2 * oneMinusT * t * 100 + t * t * 190;
      const dotY = oneMinusT * oneMinusT * 25 + 2 * oneMinusT * t * 0 + t * t * 25;

      dot.setAttribute('cx', dotX.toString());
      dot.setAttribute('cy', dotY.toString());
    }
  }

  private updateGunPosition(): void {
    // Position gun protruding from viewer, low in view
    const offset = new THREE.Vector3(0, -2.5, 0);
    offset.applyQuaternion(this.camera.quaternion);
    this.gunGroup.position.copy(this.camera.position).add(offset);

    // Match gun rotation to camera with recoil
    this.gunGroup.quaternion.copy(this.camera.quaternion);
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

    // Handle aim (mouse for desktop, touch for mobile). Pointer lock enables
    // unbounded mouse deltas where supported, but aiming also works when the
    // browser does not implement the Pointer Lock API.
    const aimDelta = input.getMouseDelta();
    // Use touch sensitivity on mobile for better responsiveness. On desktop
    // without Pointer Lock active, bump sensitivity (especially vertical) so
    // less physical mouse travel is needed before hitting the window edge.
    const baseSensitivity = input.isMobile()
      ? GameConfig.touch.aimSensitivity
      : GameConfig.player.aimSensitivity;

    let yawSensitivity = baseSensitivity;
    let pitchSensitivity = baseSensitivity;

    if (!input.isMobile() && !input.isPointerLocked()) {
      // Desktop, pointer not locked (e.g., browsers without working Pointer
      // Lock API): make movement larger.
      yawSensitivity *= 3;
      pitchSensitivity *= 5;
    }

    // Limited horizontal aiming - use MAX_YAW constant
    this.yaw -= aimDelta.x * yawSensitivity;
    this.yaw = Math.max(-MAX_YAW, Math.min(MAX_YAW, this.yaw));

    // Update pitch (vertical)
    this.pitch -= aimDelta.y * pitchSensitivity;
    // Clamp pitch around the base pitch
    const minPitch = GameConfig.player.basePitch - GameConfig.player.maxPitch;
    const maxPitch = GameConfig.player.basePitch + GameConfig.player.maxPitch;
    this.pitch = Math.max(minPitch, Math.min(maxPitch, this.pitch));

    // Animate recoil recovery
    if (this.recoilOffset > 0) {
      this.recoilOffset -= deltaTime * 8; // Recover speed
      if (this.recoilOffset < 0) this.recoilOffset = 0;
    }

    this.updateCamera();
    this.updateGunPosition();
    this.updateAimIndicator();
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

    // Start projectile at muzzle position (end of barrel)
    const muzzleLocal = new THREE.Vector3(0, 0.3, -14.5);
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
    if (this.aimIndicator) this.aimIndicator.style.display = 'block';
    this.updateCamera();
    this.updateGunPosition();
    this.updateAimIndicator();
  }

  // For collision detection - returns a bounding sphere around player
  getBoundingSphere(): THREE.Sphere {
    return new THREE.Sphere(this.position.clone(), 2);
  }

  // Get gun position for explosions (in world space)
  getTurretPosition(): THREE.Vector3 {
    return this.position.clone();
  }

  // Hide turret (for death animation)
  hideTurret(): void {
    this.gunGroup.visible = false;
    if (this.aimIndicator) this.aimIndicator.style.display = 'none';
  }

  // Show turret
  showTurret(): void {
    this.gunGroup.visible = true;
    if (this.aimIndicator) this.aimIndicator.style.display = 'block';
  }
}
