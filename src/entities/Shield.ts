import * as THREE from 'three';
import { GameConfig } from '../game/GameConfig';

interface HexCell {
  x: number;
  y: number;
  worldX: number;
  worldY: number;
  worldZ: number;
  health: number;
  maxHealth: number;
  instanceId: number;
  alive: boolean;
  phase: number; // For shimmer animation
}

export interface ShieldHitResult {
  hit: boolean;
  position: THREE.Vector3 | null;
}

// Create hexagon shape
function createHexagonGeometry(radius: number, depth: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 6;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  }
  shape.closePath();

  const extrudeSettings = {
    depth: depth,
    bevelEnabled: false,
  };

  return new THREE.ExtrudeGeometry(shape, extrudeSettings);
}

export class Shield {
  private cells: HexCell[] = [];
  private instancedMesh: THREE.InstancedMesh;
  private edgeMesh: THREE.InstancedMesh; // Glowing edges
  private position: THREE.Vector3;
  private width: number;
  private height: number;
  private depth: number;
  private dummy: THREE.Object3D = new THREE.Object3D();
  private cellHealth: number;
  private time: number = 0;

  private hexRadius: number = 3; // Size of each hexagon
  private hexDepth: number = 2; // Thicker energy field

  constructor(position: THREE.Vector3, scene: THREE.Scene, cellHealth: number = 3) {
    this.position = position;
    this.width = GameConfig.shields.width;
    this.height = GameConfig.shields.height;
    this.depth = GameConfig.shields.depth;
    this.cellHealth = cellHealth;

    // Create hexagon geometry for energy cells - vertical wall facing player
    const hexGeometry = createHexagonGeometry(this.hexRadius * 0.9, this.hexDepth);
    // No rotation needed - hexagon is in XY plane, extrusion goes in Z (toward player)

    // Glowing energy field material
    const cellMaterial = new THREE.MeshBasicMaterial({
      color: 0x0088ff,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    });

    // Edge geometry - slightly larger hexagon outline
    const edgeGeometry = createHexagonGeometry(this.hexRadius, this.hexDepth * 0.5);
    // No rotation needed

    const edgeMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.8,
      wireframe: true,
    });

    // Calculate hex grid
    const cols = Math.ceil(this.width / (this.hexRadius * 1.8)) + 1;
    const rows = Math.ceil(this.height / (this.hexRadius * 1.6)) + 1;
    const maxCells = cols * rows;

    this.instancedMesh = new THREE.InstancedMesh(hexGeometry, cellMaterial, maxCells);
    this.edgeMesh = new THREE.InstancedMesh(edgeGeometry, edgeMaterial, maxCells);

    this.instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(maxCells * 3),
      3
    );

    scene.add(this.instancedMesh);
    scene.add(this.edgeMesh);

    this.createHexGrid();
    this.updateInstancedMesh();
  }

  private createHexGrid(): void {
    const hexWidth = this.hexRadius * 1.8;  // Horizontal spacing
    const hexHeight = this.hexRadius * 1.6; // Vertical spacing

    const cols = Math.ceil(this.width / hexWidth) + 1;
    const rows = Math.ceil(this.height / hexHeight) + 1;

    let instanceId = 0;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Offset every other row for hex pattern
        const xOffset = (row % 2) * (hexWidth / 2);
        const localX = -this.width / 2 + col * hexWidth + xOffset;
        const localY = row * hexHeight;

        // Skip if outside shield bounds
        if (localX < -this.width / 2 - this.hexRadius ||
            localX > this.width / 2 + this.hexRadius ||
            localY > this.height + this.hexRadius) {
          continue;
        }

        // Vertical wall - no tilt, just offset slightly back in Z
        this.cells.push({
          x: col,
          y: row,
          worldX: this.position.x + localX,
          worldY: this.position.y + localY,
          worldZ: this.position.z,
          health: this.cellHealth,
          maxHealth: this.cellHealth,
          instanceId: instanceId++,
          alive: true,
          phase: Math.random() * Math.PI * 2, // Random phase for shimmer
        });
      }
    }
  }

  private updateInstancedMesh(): void {
    // Hide all instances first
    for (let i = 0; i < this.instancedMesh.count; i++) {
      this.dummy.position.set(0, -1000, 0);
      this.dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
      this.edgeMesh.setMatrixAt(i, this.dummy.matrix);
    }

    // Position alive cells
    this.cells.forEach(cell => {
      if (!cell.alive || cell.health <= 0) {
        cell.alive = false;
        return;
      }

      this.dummy.position.set(cell.worldX, cell.worldY, cell.worldZ);
      // No rotation - hexagons are in XY plane, facing player (extruded in Z)
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(cell.instanceId, this.dummy.matrix);
      this.edgeMesh.setMatrixAt(cell.instanceId, this.dummy.matrix);

      // Color based on health - more vibrant when healthy
      const healthRatio = cell.health / cell.maxHealth;
      const color = new THREE.Color();

      if (healthRatio > 0.6) {
        color.setRGB(0, 0.6, 1); // Bright blue
      } else if (healthRatio > 0.3) {
        color.setRGB(0, 0.9, 1); // Cyan - damaged
      } else {
        color.setRGB(0.5, 0.2, 1); // Purple - critical
      }

      this.instancedMesh.setColorAt(cell.instanceId, color);
    });

    this.instancedMesh.instanceMatrix.needsUpdate = true;
    this.edgeMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true;
    }
  }

  // Call this from game loop for shimmer effect
  update(deltaTime: number): void {
    this.time += deltaTime;

    // Update opacity for shimmer effect
    const baseMaterial = this.instancedMesh.material as THREE.MeshBasicMaterial;
    const shimmer = 0.3 + Math.sin(this.time * 3) * 0.1;
    baseMaterial.opacity = shimmer;

    const edgeMaterial = this.edgeMesh.material as THREE.MeshBasicMaterial;
    const edgeShimmer = 0.6 + Math.sin(this.time * 4) * 0.2;
    edgeMaterial.opacity = edgeShimmer;
  }

  // Check if a point hits the shield and damage it - returns hit info for explosion
  // damage parameter: 1 for alien shots, 50 for player shots
  checkHit(point: THREE.Vector3, radius: number, damage: number = 1): ShieldHitResult {
    // Find closest alive hex cell to the hit point
    let closestCell: HexCell | null = null;
    let closestDist = Infinity;
    let hitPosition: THREE.Vector3 | null = null;

    const hitThreshold = this.hexRadius * 1.5 + radius;

    for (const cell of this.cells) {
      if (!cell.alive || cell.health <= 0) continue;

      const cellPos = new THREE.Vector3(cell.worldX, cell.worldY, cell.worldZ);
      const dist = point.distanceTo(cellPos);

      if (dist < hitThreshold && dist < closestDist) {
        closestDist = dist;
        closestCell = cell;
        hitPosition = cellPos.clone();
      }
    }

    if (closestCell) {
      // For high damage (player shots), destroy multiple cells in a radius
      if (damage > 1) {
        const blastRadius = this.hexRadius * GameConfig.shields.playerDamageRadius;
        for (const cell of this.cells) {
          if (!cell.alive) continue;
          const cellPos = new THREE.Vector3(cell.worldX, cell.worldY, cell.worldZ);
          const dist = hitPosition!.distanceTo(cellPos);
          if (dist <= blastRadius) {
            cell.health = 0;
            cell.alive = false;
          }
        }
      } else {
        // Alien shots - just damage the closest cell
        closestCell.health -= damage;
        if (closestCell.health <= 0) {
          closestCell.alive = false;
        }
      }
      this.updateInstancedMesh();
      return { hit: true, position: hitPosition };
    }

    return { hit: false, position: null };
  }

  // Get bounding box for quick collision pre-check
  getBoundingBox(): THREE.Box3 {
    return new THREE.Box3(
      new THREE.Vector3(
        this.position.x - this.width / 2 - this.hexRadius * 2,
        this.position.y - this.hexRadius * 2,
        this.position.z - this.hexDepth - this.hexRadius * 2
      ),
      new THREE.Vector3(
        this.position.x + this.width / 2 + this.hexRadius * 2,
        this.position.y + this.height + this.hexRadius * 2,
        this.position.z + this.hexDepth + this.hexRadius * 2
      )
    );
  }

  hasAliveCells(): boolean {
    return this.cells.some(c => c.alive && c.health > 0);
  }

  // Keep old method name for compatibility
  hasAliveVoxels(): boolean {
    return this.hasAliveCells();
  }

  destroy(scene: THREE.Scene): void {
    scene.remove(this.instancedMesh);
    scene.remove(this.edgeMesh);
    this.instancedMesh.geometry.dispose();
    this.edgeMesh.geometry.dispose();
    (this.instancedMesh.material as THREE.Material).dispose();
    (this.edgeMesh.material as THREE.Material).dispose();
  }
}
