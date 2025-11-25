import * as THREE from 'three';
import { GameConfig } from '../game/GameConfig';

export class SceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private container: HTMLElement;

  constructor() {
    // Get game container
    this.container = document.getElementById('game-container')!;

    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(GameConfig.visual.backgroundColor);

    // Get container dimensions
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    // Create camera with 6:4 aspect ratio
    this.camera = new THREE.PerspectiveCamera(
      GameConfig.visual.fov,
      width / height,
      GameConfig.visual.nearPlane,
      GameConfig.visual.farPlane
    );

    // Position camera at player height, looking up at ~40 degrees
    this.camera.position.set(0, GameConfig.player.height, 0);
    this.camera.rotation.order = 'YXZ'; // Yaw, Pitch, Roll - standard FPS order

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.container.insertBefore(this.renderer.domElement, this.container.firstChild);

    // Add ambient light - brighter base illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    // Main directional light from above-front for good shading on aliens
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.0);
    mainLight.position.set(0, 100, 100); // From player's perspective
    this.scene.add(mainLight);

    // Rim light from behind to highlight edges
    const rimLight = new THREE.DirectionalLight(0x4488ff, 0.4);
    rimLight.position.set(0, 50, -200);
    this.scene.add(rimLight);

    // Create forest ground
    this.createForestGround();

    // Create star field background
    this.createStarField();

    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize());
  }

  private createForestGround(): void {
    // Create simple tree silhouette (tall shapes visible against sky)
    const createTree = (x: number, z: number, height: number) => {
      const group = new THREE.Group();

      // Trunk - brighter brown
      const trunkGeometry = new THREE.BoxGeometry(3, height * 0.4, 3);
      const trunkMaterial = new THREE.MeshBasicMaterial({ color: 0x664433 });
      const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
      trunk.position.y = height * 0.2;
      group.add(trunk);

      // Foliage - brighter green
      const foliageMaterial = new THREE.MeshBasicMaterial({ color: 0x2a8a3a });

      const cone1 = new THREE.Mesh(
        new THREE.ConeGeometry(height * 0.3, height * 0.5, 6),
        foliageMaterial
      );
      cone1.position.y = height * 0.55;
      group.add(cone1);

      const cone2 = new THREE.Mesh(
        new THREE.ConeGeometry(height * 0.25, height * 0.4, 6),
        foliageMaterial
      );
      cone2.position.y = height * 0.8;
      group.add(cone2);

      const cone3 = new THREE.Mesh(
        new THREE.ConeGeometry(height * 0.15, height * 0.3, 6),
        foliageMaterial
      );
      cone3.position.y = height;
      group.add(cone3);

      group.position.set(x, 0, z);
      return group;
    };

    // Create forest treeline at the horizon and sides
    // Trees need to be tall enough to be visible (camera looks up at ~30 degrees)

    // Back treeline (horizon) - very tall trees, pushed much further back
    for (let i = 0; i < 100; i++) {
      const x = -500 + i * 10 + Math.random() * 5;
      const z = -750 - Math.random() * 100;  // Much further back
      const height = 140 + Math.random() * 80;  // Taller trees
      const tree = createTree(x, z, height);
      this.scene.add(tree);
    }

    // Left side treeline
    for (let i = 0; i < 40; i++) {
      const z = -50 - i * 18 - Math.random() * 10;
      const x = -150 - Math.random() * 50;
      const height = 60 + Math.random() * 40;
      const tree = createTree(x, z, height);
      this.scene.add(tree);
    }

    // Right side treeline
    for (let i = 0; i < 40; i++) {
      const z = -50 - i * 18 - Math.random() * 10;
      const x = 150 + Math.random() * 50;
      const height = 60 + Math.random() * 40;
      const tree = createTree(x, z, height);
      this.scene.add(tree);
    }

    // No boundary lines
  }

  private createStarField(): void {
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 1000;
    const positions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      // Distribute stars in a hemisphere above the player
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.5; // Only upper hemisphere
      const radius = 400 + Math.random() * 100;

      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.cos(phi) + 50; // Offset upward
      positions[i3 + 2] = radius * Math.sin(phi) * Math.sin(theta) - 200; // Push back
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const starMaterial = new THREE.PointsMaterial({
      color: 0xaaddff,
      size: 1.5,
      sizeAttenuation: true
    });

    const stars = new THREE.Points(starGeometry, starMaterial);
    this.scene.add(stars);
  }

  private onWindowResize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
