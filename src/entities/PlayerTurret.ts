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

  // Visible turret mesh
  private turretGroup: THREE.Group;
  private turretBase: THREE.Mesh;
  private turretBarrel: THREE.Mesh;

  constructor(camera: THREE.PerspectiveCamera, scene: THREE.Scene) {
    this.camera = camera;
    this.position = new THREE.Vector3(0, GameConfig.player.height, GameConfig.player.zPosition);
    this.pitch = GameConfig.player.basePitch;

    // Create visible turret
    this.turretGroup = new THREE.Group();

    // Turret base - flat cylinder
    const baseGeometry = new THREE.CylinderGeometry(6, 8, 3, 8);
    const turretMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      wireframe: true
    });
    this.turretBase = new THREE.Mesh(baseGeometry, turretMaterial);
    this.turretBase.position.y = 1.5;
    this.turretGroup.add(this.turretBase);

    // Turret barrel - elongated box
    const barrelGeometry = new THREE.BoxGeometry(2, 2, 12);
    this.turretBarrel = new THREE.Mesh(barrelGeometry, turretMaterial);
    this.turretBarrel.position.set(0, 4, -6);
    this.turretGroup.add(this.turretBarrel);

    // Side panels for visibility
    const panelGeometry = new THREE.BoxGeometry(8, 4, 1);
    const leftPanel = new THREE.Mesh(panelGeometry, turretMaterial);
    leftPanel.position.set(-5, 3, 0);
    leftPanel.rotation.y = Math.PI / 4;
    this.turretGroup.add(leftPanel);

    const rightPanel = new THREE.Mesh(panelGeometry, turretMaterial);
    rightPanel.position.set(5, 3, 0);
    rightPanel.rotation.y = -Math.PI / 4;
    this.turretGroup.add(rightPanel);

    scene.add(this.turretGroup);

    this.updateCamera();
    this.updateTurretPosition();
  }

  update(deltaTime: number, input: InputManager): void {
    // Handle strafe movement
    const moveInput = input.getMoveInput();
    if (moveInput.x !== 0) {
      this.position.x += moveInput.x * GameConfig.player.strafeSpeed * deltaTime;
      // Clamp to strafe limits
      this.position.x = Math.max(
        -GameConfig.player.strafeLimit,
        Math.min(GameConfig.player.strafeLimit, this.position.x)
      );
    }

    // Handle mouse aim (only when pointer is locked)
    if (input.isPointerLocked()) {
      const mouseDelta = input.getMouseDelta();

      // Limited horizontal aiming (~8 degrees = 0.14 radians)
      const maxYawLimit = 0.14;
      this.yaw -= mouseDelta.x * GameConfig.player.aimSensitivity;
      this.yaw = Math.max(-maxYawLimit, Math.min(maxYawLimit, this.yaw));

      // Update pitch (vertical)
      this.pitch -= mouseDelta.y * GameConfig.player.aimSensitivity;
      // Clamp pitch around the base pitch
      const minPitch = GameConfig.player.basePitch - GameConfig.player.maxPitch;
      const maxPitch = GameConfig.player.basePitch + GameConfig.player.maxPitch;
      this.pitch = Math.max(minPitch, Math.min(maxPitch, this.pitch));
    }

    this.updateCamera();
    this.updateTurretPosition();
  }

  private updateCamera(): void {
    this.camera.position.copy(this.position);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  private updateTurretPosition(): void {
    // Position turret at player's X position, on the ground
    this.turretGroup.position.set(
      this.position.x,
      0,
      this.position.z
    );
    // Rotate turret base to match yaw
    this.turretGroup.rotation.y = this.yaw;
  }

  canFire(): boolean {
    const now = performance.now() / 1000;
    return now - this.lastFireTime >= GameConfig.player.fireRate;
  }

  fire(): ShotData | null {
    if (!this.canFire()) return null;

    this.lastFireTime = performance.now() / 1000;

    // Get direction camera is facing
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(this.camera.quaternion);
    direction.normalize();

    // Start projectile slightly in front of camera
    const position = this.position.clone();
    position.add(direction.clone().multiplyScalar(2));

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
    this.updateCamera();
    this.updateTurretPosition();
  }

  // For collision detection - returns a bounding sphere around player
  getBoundingSphere(): THREE.Sphere {
    return new THREE.Sphere(this.position.clone(), 2);
  }
}
