import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh | THREE.Line;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  rotationSpeed?: THREE.Vector3;
}

export class ExplosionManager {
  private scene: THREE.Scene;
  private particles: Particle[] = [];
  private particleGeometry: THREE.BoxGeometry;
  private debrisGeometry: THREE.BoxGeometry;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.particleGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.debrisGeometry = new THREE.BoxGeometry(2, 2, 2);
  }

  createExplosion(position: THREE.Vector3, color: number = 0x00ff00, count: number = 8, scale: number = 1): void {
    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
    });

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.particleGeometry.clone(), material.clone());
      mesh.position.copy(position);
      mesh.scale.setScalar(scale * (0.5 + Math.random() * 0.5));

      // Random velocity in all directions
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 30
      );

      const life = 0.5 + Math.random() * 0.3;
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        velocity,
        life,
        maxLife: life,
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
      const material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
      });

      const mesh = new THREE.Mesh(this.debrisGeometry.clone(), material);
      mesh.position.copy(position);
      mesh.scale.setScalar(0.6 + Math.random() * 0.6);

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
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        velocity,
        life,
        maxLife: life,
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

    // White flash
    const flashGeometry = new THREE.SphereGeometry(4, 8, 8);
    const flashMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
    });
    const flash = new THREE.Mesh(flashGeometry, flashMaterial);
    flash.position.copy(position);
    this.scene.add(flash);
    this.particles.push({
      mesh: flash,
      velocity: new THREE.Vector3(0, 0, 0),
      life: 0.1,
      maxLife: 0.1,
    });

    // Blue glow sphere
    const glowGeometry = new THREE.SphereGeometry(3, 12, 12);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.7,
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.copy(position);
    this.scene.add(glow);
    this.particles.push({
      mesh: glow,
      velocity: new THREE.Vector3(0, 0, 0),
      life: 0.3,
      maxLife: 0.3,
    });

    // Lots of voxel debris
    const debrisCount = 25;
    for (let i = 0; i < debrisCount; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
      });

      const mesh = new THREE.Mesh(this.debrisGeometry.clone(), material);
      mesh.position.copy(position);
      mesh.scale.setScalar(0.8 + Math.random() * 1.2);

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
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        velocity,
        life,
        maxLife: life,
        rotationSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20
        ),
      });
    }

    // Spark lines
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
      });
    }
  }

  createAlienExplosion(position: THREE.Vector3, color: number = 0x00ff00): void {
    // Create multiple layers of explosion

    // 1. Core flash
    const flashGeometry = new THREE.SphereGeometry(5, 8, 8);
    const flashMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1.0,
    });
    const flash = new THREE.Mesh(flashGeometry, flashMaterial);
    flash.position.copy(position);
    this.scene.add(flash);
    this.particles.push({
      mesh: flash,
      velocity: new THREE.Vector3(0, 0, 0),
      life: 0.1,
      maxLife: 0.1,
    });

    // 2. Colored expanding sphere
    const glowGeometry = new THREE.SphereGeometry(3, 12, 12);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.8,
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.copy(position);
    this.scene.add(glow);
    this.particles.push({
      mesh: glow,
      velocity: new THREE.Vector3(0, 0, 0),
      life: 0.4,
      maxLife: 0.4,
    });

    // 3. Voxel debris in alien's color
    const debrisCount = 20;
    for (let i = 0; i < debrisCount; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
      });

      const mesh = new THREE.Mesh(this.debrisGeometry.clone(), material);
      mesh.position.copy(position);
      mesh.scale.setScalar(1.0 + Math.random() * 1.0);

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
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        velocity,
        life,
        maxLife: life,
        rotationSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20
        ),
      });
    }

    // 4. Wireframe explosion lines
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
      });
    }
  }

  update(deltaTime: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];

      // Update position
      particle.mesh.position.add(
        particle.velocity.clone().multiplyScalar(deltaTime)
      );

      // Apply gravity to debris
      if (particle.velocity.length() > 0) {
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
      if (particle.velocity.length() === 0 && particle.mesh instanceof THREE.Mesh) {
        // Expanding effect (flash, glow, ring)
        const expandScale = 1 + (1 - lifeRatio) * 3;
        particle.mesh.scale.setScalar(expandScale);
      } else if (particle.mesh instanceof THREE.Mesh) {
        // Shrinking debris
        const shrinkScale = Math.max(0.1, lifeRatio);
        particle.mesh.scale.multiplyScalar(0.98);
      }

      // Remove dead particles
      if (particle.life <= 0) {
        this.scene.remove(particle.mesh);
        particle.mesh.geometry.dispose();
        (particle.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  clear(): void {
    for (const particle of this.particles) {
      this.scene.remove(particle.mesh);
      particle.mesh.geometry.dispose();
      (particle.mesh.material as THREE.Material).dispose();
    }
    this.particles = [];
  }

  hasActiveParticles(): boolean {
    return this.particles.length > 0;
  }

  createTurretExplosion(position: THREE.Vector3): void {
    const color = 0x888888; // Grey like the turret

    // Large grey debris pieces
    const debrisCount = 30;
    for (let i = 0; i < debrisCount; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
      });

      const mesh = new THREE.Mesh(this.debrisGeometry.clone(), material);
      mesh.position.copy(position);
      mesh.scale.setScalar(1.5 + Math.random() * 2.0);

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
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        velocity,
        life,
        maxLife: life,
        rotationSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20
        ),
      });
    }

    // 3. Orange/red fire particles
    const fireCount = 15;
    for (let i = 0; i < fireCount; i++) {
      const fireMaterial = new THREE.MeshBasicMaterial({
        color: 0xff4400,
        transparent: true,
      });

      const mesh = new THREE.Mesh(this.particleGeometry.clone(), fireMaterial);
      mesh.position.copy(position);
      mesh.scale.setScalar(2 + Math.random() * 2);

      const theta = Math.random() * Math.PI * 2;
      const speed = 15 + Math.random() * 20;
      const velocity = new THREE.Vector3(
        Math.cos(theta) * speed,
        10 + Math.random() * 20,
        Math.sin(theta) * speed
      );

      const life = 0.5 + Math.random() * 0.3;
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        velocity,
        life,
        maxLife: life,
      });
    }
  }
}
