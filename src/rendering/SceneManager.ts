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

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x004400, 0.5);
    this.scene.add(ambientLight);

    // Add directional light (simulates stars/sky illumination)
    const directionalLight = new THREE.DirectionalLight(0x00ff00, 0.8);
    directionalLight.position.set(0, 100, -100);
    this.scene.add(directionalLight);

    // Create vector grid ground
    this.createVectorGround();

    // Create star field background
    this.createStarField();

    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize());
  }

  private createVectorGround(): void {
    const gridSize = 500;
    const gridDivisions = 25;
    const gridSpacing = gridSize / gridDivisions;

    // Create grid lines
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x004400,
      transparent: true,
      opacity: 0.6
    });

    // Lines along X axis (going into the distance)
    for (let i = -gridDivisions / 2; i <= gridDivisions / 2; i++) {
      const points = [
        new THREE.Vector3(i * gridSpacing, 0, gridSize / 2),
        new THREE.Vector3(i * gridSpacing, 0, -gridSize / 2)
      ];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geometry, lineMaterial);
      this.scene.add(line);
    }

    // Lines along Z axis (side to side)
    for (let i = -gridDivisions / 2; i <= gridDivisions / 2; i++) {
      const points = [
        new THREE.Vector3(-gridSize / 2, 0, i * gridSpacing),
        new THREE.Vector3(gridSize / 2, 0, i * gridSpacing)
      ];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geometry, lineMaterial);
      this.scene.add(line);
    }

    // Add field boundary lines (brighter)
    const boundaryMaterial = new THREE.LineBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.4
    });

    const fieldWidth = 111; // Matches game field
    const boundaryPoints = [
      new THREE.Vector3(-fieldWidth, 0, 50),
      new THREE.Vector3(-fieldWidth, 0, -500),
    ];
    const leftBoundary = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(boundaryPoints),
      boundaryMaterial
    );
    this.scene.add(leftBoundary);

    const rightBoundaryPoints = [
      new THREE.Vector3(fieldWidth, 0, 50),
      new THREE.Vector3(fieldWidth, 0, -500),
    ];
    const rightBoundary = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(rightBoundaryPoints),
      boundaryMaterial
    );
    this.scene.add(rightBoundary);
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
      color: 0x00ff00,
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
