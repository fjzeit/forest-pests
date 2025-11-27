import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh | THREE.Line;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  rotationSpeed?: THREE.Vector3;
  poolType?: 'box' | 'debris' | 'sphere' | 'line';
  originalScale?: number;
}

interface PooledMesh {
  mesh: THREE.Mesh;
  inUse: boolean;
}

export class ExplosionManager {
  private scene: THREE.Scene;
  private particles: Particle[] = [];

  // Shared geometries (never cloned)
  private particleGeometry: THREE.BoxGeometry;
  private debrisGeometry: THREE.BoxGeometry;
  private sphereGeometry: THREE.SphereGeometry;

  // Object pools
  private boxPool: PooledMesh[] = [];
  private debrisPool: PooledMesh[] = [];
  private spherePool: PooledMesh[] = [];

  // Pool sizes
  private static readonly BOX_POOL_SIZE = 80;
  private static readonly DEBRIS_POOL_SIZE = 120;
  private static readonly SPHERE_POOL_SIZE = 20;

  // Reusable temp vectors to avoid allocation in update loop
  private tempVelocity = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.particleGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.debrisGeometry = new THREE.BoxGeometry(2, 2, 2);
    this.sphereGeometry = new THREE.SphereGeometry(1, 8, 8);

    this.initializePools();
  }

  private initializePools(): void {
    // Pre-allocate box particles
    for (let i = 0; i < ExplosionManager.BOX_POOL_SIZE; i++) {
      const material = new THREE.MeshBasicMaterial({ transparent: true });
      const mesh = new THREE.Mesh(this.particleGeometry, material);
      mesh.visible = false;
      this.scene.add(mesh);
      this.boxPool.push({ mesh, inUse: false });
    }

    // Pre-allocate debris particles
    for (let i = 0; i < ExplosionManager.DEBRIS_POOL_SIZE; i++) {
      const material = new THREE.MeshBasicMaterial({ transparent: true });
      const mesh = new THREE.Mesh(this.debrisGeometry, material);
      mesh.visible = false;
      this.scene.add(mesh);
      this.debrisPool.push({ mesh, inUse: false });
    }

    // Pre-allocate sphere particles (for flash/glow effects)
    for (let i = 0; i < ExplosionManager.SPHERE_POOL_SIZE; i++) {
      const material = new THREE.MeshBasicMaterial({ transparent: true });
      const mesh = new THREE.Mesh(this.sphereGeometry, material);
      mesh.visible = false;
      this.scene.add(mesh);
      this.spherePool.push({ mesh, inUse: false });
    }
  }

  private acquireFromPool(pool: PooledMesh[], color: number, opacity: number = 1): THREE.Mesh | null {
    for (const pooled of pool) {
      if (!pooled.inUse) {
        pooled.inUse = true;
        pooled.mesh.visible = true;
        const mat = pooled.mesh.material as THREE.MeshBasicMaterial;
        mat.color.setHex(color);
        mat.opacity = opacity;
        pooled.mesh.rotation.set(0, 0, 0);
        pooled.mesh.scale.set(1, 1, 1);
        return pooled.mesh;
      }
    }
    return null; // Pool exhausted
  }

  private releaseToPool(mesh: THREE.Mesh, poolType: 'box' | 'debris' | 'sphere'): void {
    const pool = poolType === 'box' ? this.boxPool : poolType === 'debris' ? this.debrisPool : this.spherePool;
    for (const pooled of pool) {
      if (pooled.mesh === mesh) {
        pooled.inUse = false;
        pooled.mesh.visible = false;
        return;
      }
    }
  }

  createExplosion(position: THREE.Vector3, color: number = 0x00ff00, count: number = 8, scale: number = 1): void {
    for (let i = 0; i < count; i++) {
      const mesh = this.acquireFromPool(this.boxPool, color);
      if (!mesh) continue; // Pool exhausted

      mesh.position.copy(position);
      const particleScale = scale * (0.5 + Math.random() * 0.5);
      mesh.scale.setScalar(particleScale);

      // Random velocity in all directions
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 30
      );

      const life = 0.5 + Math.random() * 0.3;
      this.particles.push({
        mesh,
        velocity,
        life,
        maxLife: life,
        poolType: 'box',
        originalScale: particleScale,
        rotationSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10
        ),
      });
    }
  }

  createShieldImpact(position: THREE.Vector3): void {
    const color = 0x0088ff;

    // Voxel debris
    const debrisCount = 12;
    for (let i = 0; i < debrisCount; i++) {
      const mesh = this.acquireFromPool(this.debrisPool, color);
      if (!mesh) continue;

      mesh.position.copy(position);
      const debrisScale = 0.6 + Math.random() * 0.6;
      mesh.scale.setScalar(debrisScale);

      // Debris flies outward in all directions
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = 15 + Math.random() * 20;
      const velocity = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.sin(phi) * Math.sin(theta) * speed,
        Math.cos(phi) * speed
      );

      const life = 0.4 + Math.random() * 0.3;
      this.particles.push({
        mesh,
        velocity,
        life,
        maxLife: life,
        poolType: 'debris',
        originalScale: debrisScale,
        rotationSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 15,
          (Math.random() - 0.5) * 15,
          (Math.random() - 0.5) * 15
        ),
      });
    }
  }

  // Big explosion for turret shots hitting shields
  createTurretShieldImpact(position: THREE.Vector3): void {
    const color = 0x0088ff;

    // White flash (using sphere pool)
    const flash = this.acquireFromPool(this.spherePool, 0xffffff, 0.9);
    if (flash) {
      flash.position.copy(position);
      flash.scale.setScalar(4);
      this.particles.push({
        mesh: flash,
        velocity: new THREE.Vector3(0, 0, 0),
        life: 0.1,
        maxLife: 0.1,
        poolType: 'sphere',
        originalScale: 4,
      });
    }

    // Blue glow sphere (using sphere pool)
    const glow = this.acquireFromPool(this.spherePool, color, 0.7);
    if (glow) {
      glow.position.copy(position);
      glow.scale.setScalar(3);
      this.particles.push({
        mesh: glow,
        velocity: new THREE.Vector3(0, 0, 0),
        life: 0.3,
        maxLife: 0.3,
        poolType: 'sphere',
        originalScale: 3,
      });
    }

    // Lots of voxel debris (using debris pool)
    const debrisCount = 25;
    for (let i = 0; i < debrisCount; i++) {
      const mesh = this.acquireFromPool(this.debrisPool, color);
      if (!mesh) continue;

      mesh.position.copy(position);
      const debrisScale = 0.8 + Math.random() * 1.2;
      mesh.scale.setScalar(debrisScale);

      // Debris flies outward in all directions
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = 25 + Math.random() * 40;
      const velocity = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.abs(Math.sin(phi) * Math.sin(theta)) * speed + 10, // Bias upward
        Math.cos(phi) * speed
      );

      const life = 0.5 + Math.random() * 0.4;
      this.particles.push({
        mesh,
        velocity,
        life,
        maxLife: life,
        poolType: 'debris',
        originalScale: debrisScale,
        rotationSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20
        ),
      });
    }

    // Spark lines (not pooled - less frequent, unique geometry)
    const lineCount = 8;
    for (let i = 0; i < lineCount; i++) {
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 1.0,
      });

      const theta = (i / lineCount) * Math.PI * 2;
      const length = 6 + Math.random() * 4;
      const points = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(
          Math.cos(theta) * length,
          (Math.random() - 0.3) * length,
          Math.sin(theta) * length
        ),
      ];
      const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(lineGeometry, lineMaterial);
      line.position.copy(position);
      this.scene.add(line);

      const life = 0.2 + Math.random() * 0.15;
      this.particles.push({
        mesh: line,
        velocity: new THREE.Vector3(0, 0, 0),
        life,
        maxLife: life,
        poolType: 'line',
      });
    }
  }

  createAlienExplosion(position: THREE.Vector3, color: number = 0x00ff00): void {
    // Create multiple layers of explosion

    // 1. Core flash (using sphere pool)
    const flash = this.acquireFromPool(this.spherePool, 0xffffff, 1.0);
    if (flash) {
      flash.position.copy(position);
      flash.scale.setScalar(5);
      this.particles.push({
        mesh: flash,
        velocity: new THREE.Vector3(0, 0, 0),
        life: 0.1,
        maxLife: 0.1,
        poolType: 'sphere',
        originalScale: 5,
      });
    }

    // 2. Colored expanding sphere (using sphere pool)
    const glow = this.acquireFromPool(this.spherePool, color, 0.8);
    if (glow) {
      glow.position.copy(position);
      glow.scale.setScalar(3);
      this.particles.push({
        mesh: glow,
        velocity: new THREE.Vector3(0, 0, 0),
        life: 0.4,
        maxLife: 0.4,
        poolType: 'sphere',
        originalScale: 3,
      });
    }

    // 3. Voxel debris in alien's color (using debris pool)
    const debrisCount = 20;
    for (let i = 0; i < debrisCount; i++) {
      const mesh = this.acquireFromPool(this.debrisPool, color);
      if (!mesh) continue;

      mesh.position.copy(position);
      const debrisScale = 1.0 + Math.random() * 1.0;
      mesh.scale.setScalar(debrisScale);

      // Debris flies outward in all directions
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = 25 + Math.random() * 35;
      const velocity = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.sin(phi) * Math.sin(theta) * speed,
        Math.cos(phi) * speed
      );

      const life = 0.6 + Math.random() * 0.4;
      this.particles.push({
        mesh,
        velocity,
        life,
        maxLife: life,
        poolType: 'debris',
        originalScale: debrisScale,
        rotationSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20
        ),
      });
    }

    // 4. Wireframe explosion lines (not pooled)
    const lineCount = 12;
    for (let i = 0; i < lineCount; i++) {
      const lineMaterial = new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: 1.0,
      });

      const theta = (i / lineCount) * Math.PI * 2;
      const length = 8 + Math.random() * 4;
      const points = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(
          Math.cos(theta) * length,
          (Math.random() - 0.3) * length,
          Math.sin(theta) * length
        ),
      ];
      const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(lineGeometry, lineMaterial);
      line.position.copy(position);
      this.scene.add(line);

      const life = 0.3 + Math.random() * 0.2;
      this.particles.push({
        mesh: line,
        velocity: new THREE.Vector3(0, 0, 0),
        life,
        maxLife: life,
        poolType: 'line',
      });
    }
  }

  update(deltaTime: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];

      // Update position using reusable temp vector (avoids allocation)
      this.tempVelocity.copy(particle.velocity).multiplyScalar(deltaTime);
      particle.mesh.position.add(this.tempVelocity);

      // Apply gravity to debris (check lengthSq to avoid sqrt)
      if (particle.velocity.lengthSq() > 0) {
        particle.velocity.y -= 40 * deltaTime;
      }

      // Apply rotation
      if (particle.rotationSpeed && particle.mesh instanceof THREE.Mesh) {
        particle.mesh.rotation.x += particle.rotationSpeed.x * deltaTime;
        particle.mesh.rotation.y += particle.rotationSpeed.y * deltaTime;
        particle.mesh.rotation.z += particle.rotationSpeed.z * deltaTime;
      }

      // Update life
      particle.life -= deltaTime;
      const lifeRatio = particle.life / particle.maxLife;

      // Fade out
      const material = particle.mesh.material as THREE.MeshBasicMaterial | THREE.LineBasicMaterial;
      material.opacity = Math.max(0, lifeRatio);

      // Scale effects for expanding elements (glow, ring) vs shrinking debris
      if (particle.velocity.lengthSq() === 0 && particle.mesh instanceof THREE.Mesh) {
        // Expanding effect (flash, glow, ring) - use originalScale as base
        const baseScale = particle.originalScale || 1;
        const expandScale = baseScale * (1 + (1 - lifeRatio) * 3);
        particle.mesh.scale.setScalar(expandScale);
      } else if (particle.mesh instanceof THREE.Mesh) {
        // Shrinking debris
        particle.mesh.scale.multiplyScalar(0.98);
      }

      // Remove dead particles
      if (particle.life <= 0) {
        if (particle.poolType && particle.poolType !== 'line') {
          // Return to pool instead of disposing
          this.releaseToPool(particle.mesh as THREE.Mesh, particle.poolType);
        } else {
          // Lines are not pooled - dispose them
          this.scene.remove(particle.mesh);
          particle.mesh.geometry.dispose();
          (particle.mesh.material as THREE.Material).dispose();
        }
        this.particles.splice(i, 1);
      }
    }
  }

  clear(): void {
    for (const particle of this.particles) {
      if (particle.poolType && particle.poolType !== 'line') {
        // Return to pool
        this.releaseToPool(particle.mesh as THREE.Mesh, particle.poolType);
      } else {
        // Lines are not pooled - dispose them
        this.scene.remove(particle.mesh);
        particle.mesh.geometry.dispose();
        (particle.mesh.material as THREE.Material).dispose();
      }
    }
    this.particles = [];
  }

  hasActiveParticles(): boolean {
    return this.particles.length > 0;
  }

  createTurretExplosion(position: THREE.Vector3): void {
    const color = 0x888888; // Grey like the turret

    // Large grey debris pieces (using debris pool)
    const debrisCount = 30;
    for (let i = 0; i < debrisCount; i++) {
      const mesh = this.acquireFromPool(this.debrisPool, color);
      if (!mesh) continue;

      mesh.position.copy(position);
      const debrisScale = 1.5 + Math.random() * 2.0;
      mesh.scale.setScalar(debrisScale);

      // Debris flies outward in all directions
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = 30 + Math.random() * 40;
      const velocity = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.abs(Math.sin(phi) * Math.sin(theta)) * speed + 10, // Bias upward
        Math.cos(phi) * speed
      );

      const life = 0.8 + Math.random() * 0.5;
      this.particles.push({
        mesh,
        velocity,
        life,
        maxLife: life,
        poolType: 'debris',
        originalScale: debrisScale,
        rotationSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20
        ),
      });
    }

    // Orange/red fire particles (using box pool)
    const fireCount = 15;
    for (let i = 0; i < fireCount; i++) {
      const mesh = this.acquireFromPool(this.boxPool, 0xff4400);
      if (!mesh) continue;

      mesh.position.copy(position);
      const fireScale = 2 + Math.random() * 2;
      mesh.scale.setScalar(fireScale);

      const theta = Math.random() * Math.PI * 2;
      const speed = 15 + Math.random() * 20;
      const velocity = new THREE.Vector3(
        Math.cos(theta) * speed,
        10 + Math.random() * 20,
        Math.sin(theta) * speed
      );

      const life = 0.5 + Math.random() * 0.3;
      this.particles.push({
        mesh,
        velocity,
        life,
        maxLife: life,
        poolType: 'box',
        originalScale: fireScale,
      });
    }
  }

  dispose(): void {
    // Dispose all pooled meshes when manager is destroyed
    this.clear();

    for (const pooled of this.boxPool) {
      this.scene.remove(pooled.mesh);
      (pooled.mesh.material as THREE.Material).dispose();
    }
    for (const pooled of this.debrisPool) {
      this.scene.remove(pooled.mesh);
      (pooled.mesh.material as THREE.Material).dispose();
    }
    for (const pooled of this.spherePool) {
      this.scene.remove(pooled.mesh);
      (pooled.mesh.material as THREE.Material).dispose();
    }

    // Dispose shared geometries
    this.particleGeometry.dispose();
    this.debrisGeometry.dispose();
    this.sphereGeometry.dispose();

    this.boxPool = [];
    this.debrisPool = [];
    this.spherePool = [];
  }
}
