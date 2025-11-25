# Space Invaders - First Person

A first-person Space Invaders homage game with 1970s/80s CRT aesthetic, viewed from inside the defender's turret looking up at ~40 degrees toward approaching aliens.

## Tech Stack

- **Runtime**: Vite + TypeScript
- **Rendering**: Three.js with post-processing (EffectComposer, UnrealBloomPass)
- **Audio**: Web Audio API (oscillators, noise buffers, filters)
- **Build**: npm

## Project Structure

```
spaceinv/
  index.html              # Game container, CSS styling, UI overlay elements
  src/
    main.ts               # Entry point - creates Game instance
    game/
      Game.ts             # Main game loop, state management, collision handling
      GameConfig.ts       # Central configuration constants
    entities/
      Alien.ts            # Voxel-based alien sprites with 2-frame animation
      AlienFormation.ts   # Formation movement, shooting logic, wave scaling
      PlayerTurret.ts     # Camera, movement, aiming, visible turret mesh
      Projectile.ts       # Player and alien projectiles
      Shield.ts           # Destructible voxel shields with tilt
    systems/
      InputManager.ts     # Keyboard/mouse input, pointer lock handling
      CollisionSystem.ts  # Sphere and voxel-based collision detection
      AudioManager.ts     # Web Audio sound effects and march beat
    rendering/
      SceneManager.ts     # Three.js scene, camera, lights, environment
      ExplosionEffect.ts  # Particle system with debris physics
      shaders/
        CRTEffect.ts      # Post-processing (scanlines, bloom, distortion)
  lode/
    summary.md            # This file
    lode-overview.md      # Lode documentation guidelines
```

## Game States (Game.ts)

```typescript
export enum GameState {
  MENU,                 // Initial state, waiting for SPACE
  PLAYING,              // Active gameplay
  PAUSED,               // Not currently used
  GAME_OVER,            // Final score displayed
  WAVE_COMPLETE,        // Showing wave complete message
  WAVE_COMPLETE_DELAY,  // Waiting for explosions to finish
  LIFE_LOST,            // Showing life lost message
  LIFE_LOST_DELAY,      // Waiting for turret explosion
}
```

State transitions:
- `MENU` → `PLAYING` (SPACE key)
- `PLAYING` → `WAVE_COMPLETE_DELAY` (all aliens killed)
- `WAVE_COMPLETE_DELAY` → `WAVE_COMPLETE` (explosions finished + 1s timer)
- `WAVE_COMPLETE` → `PLAYING` (SPACE key, calls nextWave())
- `PLAYING` → `LIFE_LOST_DELAY` (health reaches 0)
- `LIFE_LOST_DELAY` → `LIFE_LOST` (explosions finished + 1.5s timer)
- `LIFE_LOST` → `PLAYING` (SPACE key, resets health/turret)
- `PLAYING` → `GAME_OVER` (lives = 0 OR aliens reach danger zone)
- `GAME_OVER` → `PLAYING` (SPACE key, calls resetGame() + startGame())

## Configuration (GameConfig.ts)

All magic numbers centralized here. Key values:

```typescript
aliens: {
  columns: 11,
  rows: 5,
  spacingX: 16,         // Tight horizontal spacing
  spacingZ: 36,         // Depth between rows
  startDistance: 400,   // Initial Z distance
  startHeight: 60,      // Y position
  dropDistance: 15,     // Drop on edge hit
  baseSpeed: 4,         // Horizontal movement
  edgeMargin: 111,      // Field boundary
  scale: 2.0,           // Visual scale
},

player: {
  strafeSpeed: 80,
  strafeLimit: 111,     // Matches field boundary
  aimSensitivity: 0.002,
  maxPitch: 0.6,        // Vertical aim range (radians)
  maxYaw: 1.05,         // Horizontal aim (radians, ~60°)
  basePitch: 0.5,       // Default camera angle (~29° up)
  height: 5,            // Camera Y position
  zPosition: -50,       // Camera Z position
  fireRate: 0.4,        // Seconds between shots
},

projectiles: {
  playerSpeed: 150,
  alienSpeed: 80,
  playerColor: 0x00ff00,
  alienColor: 0xff0000,
},

shields: {
  count: 4,
  width: 24,
  height: 30,
  depth: 6,
  distance: 100,        // Z distance from player
  height_y: 0,          // Ground level
  spacing: 50,          // Horizontal spacing
  voxelSize: 2,
},

gameplay: {
  lives: 3,
  hitsPerLife: 20,
  speedMultiplierMin: 0.3,
  dangerDistance: 100,  // Game over trigger
},

timing: {
  baseMoveInterval: 55,         // Frames at 60fps
  alienShootChanceBase: 0.005,  // Wave 1
  alienShootChanceMax: 0.05,    // Wave 100
},
```

## Entity Details

### Alien (Alien.ts)

**Sprite Patterns**: Defined as 2D arrays (1 = filled, 0 = empty)
- Squid: 8x8 pixels
- Crab: 11x8 pixels
- Bug: 12x8 pixels

**Resolution Multiplier**: Each sprite pixel = 2x2 voxels (RESOLUTION_MULTIPLIER = 2)

**Colors** (ALIEN_COLORS constant):
- Crab (front): Yellow `{ r: 255, g: 255, b: 0 }`
- Bug (middle): Cyan `{ r: 0, g: 255, b: 255 }`
- Squid (back): Hot pink `{ r: 255, g: 0, b: 128 }`

**Brightness System**:
- Front alien in column = 1.0 (full brightness)
- Each alien behind loses 0.15 brightness
- Minimum brightness = 0.3
- Recalculated via `updateBrightness(aliensInFront)` when aliens die

**Key Methods**:
- `animate()`: Toggles between 2 animation frames
- `getCurrentColor()`: Returns current color for explosions
- `getBoundingSphere()`: For collision detection

### AlienFormation (AlienFormation.ts)

**Movement**:
- Horizontal movement at `baseSpeed * direction`
- Reverses and drops `dropDistance` when any alive alien exceeds `edgeMargin`
- Speed scales with alive count: `moveInterval = baseMoveInterval * (aliveCount / totalAliens)`

**Shooting**:
- Only frontmost alien per column can shoot (`getFrontAliens()`)
- `shootChance` scales linearly: wave 1 = 0.5%, wave 100 = 5%
- Direction: No horizontal tracking, only vertical angle to reach player height
  ```typescript
  const direction = new THREE.Vector3(0, dy, dz).normalize();
  ```

**Wave Reset**:
- `waveMultiplier = 1 + (wave - 1) * 0.2` (affects movement speed)
- Calculates `shootChance` based on wave progress

### Shield (Shield.ts)

**Structure**:
- Rectangular voxel grid (width × height × depth in voxel units)
- Tilted back 0.4 radians (~23°) to face incoming fire
- Health per voxel scales with wave: 3 (wave 1) → 1 (wave 100)

**Voxel Health Colors**:
- Blue `(0, 0.53, 1)`: healthRatio > 0.6
- Cyan `(0, 0.8, 1)`: healthRatio > 0.3
- Dark blue `(0.2, 0.2, 0.8)`: critical

**Hit Detection** (`checkHit()`):
- Transforms point to local untilted space
- Searches 2-voxel radius for closest alive voxel
- Returns world position for explosion effect

### PlayerTurret (PlayerTurret.ts)

**Camera Setup**:
- Position: `(0, height, zPosition)` = `(0, 5, -50)`
- Rotation order: 'YXZ' (yaw, pitch, roll - standard FPS)
- Base pitch: 0.5 radians (~29° up)

**Turret Mesh** (solid grey 0x888888):
- Base: Cylinder (radius 6→8, height 3)
- Barrel: Box (2×2×12) at y=4, z=-6
- Side panels: Two angled boxes

**Aiming Limits**:
- Horizontal (yaw): ±0.14 radians (~8°)
- Vertical (pitch): basePitch ± maxPitch = 0.5 ± 0.6 radians

**Key Methods**:
- `getTurretPosition()`: Returns mesh center for explosions
- `hideTurret()`/`showTurret()`: For life lost sequence
- `fire()`: Returns `{ position, direction }` based on camera quaternion

### Projectile (Projectile.ts)

**Player Shots**:
- Geometry: Cylinder (radius 0.3, height 3)
- Color: Green (0x00ff00)
- Speed: 150 units/s
- Rotated to face direction of travel

**Alien Shots**:
- Geometry: Sphere (radius 0.5)
- Color: Red (0xff0000)
- Speed: 80 units/s
- Rotating visual effect

**Shot Types** (AlienShotType): 'rolling' | 'plunger' | 'squiggly'
- Currently visual only (same behavior)

## Collision System (CollisionSystem.ts)

**Player shots check**:
1. Aliens (sphere-sphere)
2. Shields (bounding box → voxel hit)

**Alien shots check**:
1. Shields (bounding box → voxel hit)
2. Player (horizontal distance only, 8-unit radius)

Player hit detection ignores Y (infinite vertical hit area):
```typescript
const horizontalDist = Math.sqrt(
  Math.pow(pos.x - playerPos.x, 2) +
  Math.pow(pos.z - playerPos.z, 2)
);
```

## Input System (InputManager.ts)

**Controls**:
- A/D or Arrow Left/Right: Strafe
- W/S or Arrow Up/Down: Not used (forward/back removed)
- Mouse: Aim (only when pointer locked)
- Left click: Fire
- SPACE: Fire (also handled in Game.ts for menus)

**Pointer Lock**:
- Requested on game start and after continuing
- Mouse delta accumulated between frames
- Input cleared when lock lost

## Audio System (AudioManager.ts)

**March Beat**:
- 4 notes: A1 (55Hz), G1 (49Hz), F#1 (46Hz), E1 (41Hz)
- Square wave, 0.15 volume
- Tempo: `minTempo + (maxTempo - minTempo) * (aliveCount / maxAliens)`
- Range: 100ms (1 alien) to 1000ms (55 aliens)

**Alien Death** (`playAlienDeath()`):
- White noise buffer with cubic decay
- Low-pass filter: 1500Hz → 300Hz
- Duration: 0.15s, Volume: 0.25

**Life Lost** (`playLifeLost()`):
- Descending tones: 400Hz → 300Hz → 200Hz → 100Hz
- Square wave, 0.15 volume, 0.2s each

**Wave Complete** (`playWaveComplete()`):
- Ascending tones: 440Hz → 554Hz → 659Hz → 880Hz
- Square wave, 0.2 volume

**Game Over** (`playGameOver()`):
- Descending tones: 440Hz → 330Hz → 262Hz → 196Hz

**Disabled** (too noisy): `playPlayerShoot()`, `playAlienShoot()`, `playPlayerHit()`, `playShieldHit()`

## Explosion System (ExplosionEffect.ts)

**Particle Interface**:
```typescript
interface Particle {
  mesh: THREE.Mesh | THREE.Line;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  rotationSpeed?: THREE.Vector3;
}
```

**Alien Explosion** (`createAlienExplosion()`):
1. White flash sphere (radius 5, life 0.1s)
2. Colored glow sphere (radius 3, life 0.4s, expands)
3. 20 colored debris cubes (speed 25-60, life 0.6-1.0s)
4. 12 wireframe lines (life 0.3-0.5s)

**Shield Impact** (`createShieldImpact()`):
- 12 blue debris cubes (0x0088ff)
- Speed 15-35, life 0.4-0.7s

**Turret Explosion** (`createTurretExplosion()`):
1. White flash sphere (radius 8, life 0.15s)
2. 30 grey debris cubes (0x888888, speed 30-70, biased upward)
3. 15 orange fire particles (0xff4400, upward bias)

**Update Loop**:
- Applies gravity: `velocity.y -= 40 * deltaTime`
- Applies rotation for debris
- Fades opacity based on life ratio
- Expands stationary elements, shrinks moving debris
- Cleans up dead particles

**Key Method**: `hasActiveParticles()` - Used to wait for explosions before showing messages

## Rendering (SceneManager.ts, CRTEffect.ts)

**Scene Setup**:
- Background: 0x001100 (dark green)
- Ambient light: 0x004400, intensity 0.5
- Directional light: 0x00ff00, intensity 0.8, from (0, 100, -100)

**Vector Grid Ground**:
- 500×500 units, 25 divisions
- Dark green lines (0x004400, opacity 0.6)
- Bright boundary lines at ±111 (0x00ff00, opacity 0.4)

**Star Field**:
- 1000 points in upper hemisphere
- Radius 400-500, offset upward and back
- Green color (0x00ff00), size 1.5

**CRT Post-Processing** (CRTEffect.ts):
- UnrealBloomPass: strength 0.5, radius 0.4, threshold 0.85
- Custom shader with uniforms:
  - scanlineIntensity: 0.15
  - scanlineCount: 800 (adjusts to height)
  - vignetteIntensity: 0.3
  - chromaticAberration: 0.002
  - barrelDistortion: 0.04
  - time: animated for flicker

## UI Elements (index.html)

**Container**: `#game-container`
- 6:4 aspect ratio via CSS `aspect-ratio`
- 1984-style monitor surround (wood-tone gradient border)
- "SPACE INVADERS" embossed title via `::before`
- Screen reflection overlay via `::after`

**Overlay Elements** (`#ui-overlay`):
- `#score-display`: Top-left, "SCORE: 0000"
- `#lives-display`: Top-right, "LIVES: 3"
- `#wave-display`: Below score, "WAVE: 1"
- `#health-bar-container`: Bottom center, 300px wide
- `#crosshair`: Center, 40px circle with cross
- `#game-message`: Center, for game state messages
- `#start-prompt`: Bottom, "PRESS SPACE TO START"
- `#damage-overlay`: Full screen red flash

**Responsive Sizing** (vmin units):
```css
#game-message {
  font-size: 4vmin;
  padding: 2vmin 4vmin;
  border: 0.3vmin solid rgba(255, 255, 255, 0.7);
  background: rgba(128, 128, 128, 0.7);
}
```

**Animations**:
- `@keyframes blink`: Start prompt pulsing
- `@keyframes damageFlash`: Red screen flash
- `@keyframes shake`: Screen shake on damage
- `@keyframes pulse-critical`: Health bar pulse when critical

## Wave Progression (100 Waves)

| Wave | Shield Voxel Health | Alien Fire Rate | Wave Speed Multiplier |
|------|---------------------|-----------------|----------------------|
| 1    | 3 hits              | 0.5%            | 1.0x                 |
| 25   | 2-3 hits            | 1.7%            | 5.8x                 |
| 50   | 2 hits              | 2.75%           | 10.8x                |
| 75   | 1-2 hits            | 3.9%            | 15.8x                |
| 100  | 1 hit               | 5%              | 20.8x                |

Shield health formula:
```typescript
const waveProgress = Math.min((wave - 1) / 99, 1);
const shieldHealth = Math.max(1, Math.round(3 - 2 * waveProgress));
```

## Field of Play Calculation

```
4 shields at spacing 50 → span of 150 (-75 to +75)
Shield width = 24
Field edge = 75 + 12 (half shield) + 24 (one shield width) = 111
Player strafe limit = 111
Alien edge margin = 111
```

## Common Patterns

**Creating Three.js Objects**:
```typescript
const geometry = new THREE.BoxGeometry(w, h, d);
const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);
```

**Cleanup Pattern**:
```typescript
destroy(scene: THREE.Scene): void {
  scene.remove(this.mesh);
  this.mesh.geometry.dispose();
  (this.mesh.material as THREE.Material).dispose();
}
```

**InstancedMesh for Voxels**:
```typescript
const instancedMesh = new THREE.InstancedMesh(geometry, material, count);
const matrix = new THREE.Matrix4();
matrix.setPosition(x, y, z);
instancedMesh.setMatrixAt(index, matrix);
instancedMesh.instanceMatrix.needsUpdate = true;
```

## Development Commands

```bash
npm install      # Install dependencies
npm run dev      # Start dev server (Vite)
npm run build    # Production build
```
