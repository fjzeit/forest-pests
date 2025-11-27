# Forest Pests - First Person

A first-person Space Invaders homage game with 1970s/80s CRT aesthetic, viewed from inside the defender's turret looking up at approaching alien pests in a forest clearing.

## Tech Stack

- **Runtime**: Vite + TypeScript
- **Rendering**: Three.js with post-processing (EffectComposer, UnrealBloomPass)
- **Audio**: Web Audio API (oscillators, noise buffers, filters)
- **Build**: npm
- **PWA**: Standalone app with orientation lock support

## Project Structure

```
spaceinv/
  index.html              # Game container, CSS styling, UI overlay elements
  public/
    manifest.json         # PWA manifest (standalone, landscape orientation)
    images/               # Icons and social cards
  src/
    main.ts               # Entry point - creates Game instance
    game/
      Game.ts             # Main game loop, state management, collision handling
      GameConfig.ts       # Central configuration constants
    entities/
      Alien.ts            # Voxel-based alien sprites with 2-frame animation, dive bomber support
      AlienFormation.ts   # Formation movement, shooting, dive attacks, wave scaling
      PlayerTurret.ts     # Camera, movement, aiming, visible turret mesh
      Projectile.ts       # Player and alien projectiles
      Shield.ts           # Destructible voxel shields with tilt
    systems/
      InputManager.ts     # Keyboard/mouse/touch input, pointer lock (WebKit compatible), external input detection
      TouchInputManager.ts # Mobile touch controls (repositionable joystick, aim+fire zone)
      CollisionSystem.ts  # Sphere and voxel-based collision detection
      AudioManager.ts     # Web Audio sound effects and march beat
    rendering/
      SceneManager.ts     # Three.js scene, camera, lights, forest environment
      ExplosionEffect.ts  # Particle system with debris physics
      shaders/
        CRTEffect.ts      # Post-processing (scanlines, bloom, distortion)
  lode/
    summary.md            # This file
    lode-overview.md      # Lode documentation guidelines
    grok-sound-on-ios.md  # iOS Safari audio unlock guide
```

## Game States (Game.ts)

```typescript
export enum GameState {
  MENU,                 // Initial state, waiting for any key/click/tap
  PLAYING,              // Active gameplay
  PAUSED,               // Not currently used
  GAME_OVER,            // Final score displayed
  WAVE_COMPLETE,        // Showing wave complete message (auto-continues)
  WAVE_COMPLETE_DELAY,  // Waiting for explosions to finish
  LIFE_LOST,            // Showing life lost message (auto-continues)
  LIFE_LOST_DELAY,      // Waiting for turret explosion
  WAVE_INTRO,           // Aliens flying in from distance
  INVASION_LANDING,     // Game over sequence - aliens landing
  ROTATE_DEVICE,        // Mobile portrait mode - paused, showing rotate message
}
```

State transitions:
- `MENU` → `WAVE_INTRO` (any key/click/tap)
- `WAVE_INTRO` → `PLAYING` (aliens finished flying in)
- `PLAYING` → `WAVE_COMPLETE_DELAY` (all aliens killed)
- `WAVE_COMPLETE_DELAY` → `WAVE_COMPLETE` (explosions finished + 1s timer)
- `WAVE_COMPLETE` → `WAVE_INTRO` (auto after ~5s tune, calls nextWave())
- `PLAYING` → `LIFE_LOST_DELAY` (health reaches 0)
- `LIFE_LOST_DELAY` → `LIFE_LOST` (explosions finished + 1.5s timer)
- `LIFE_LOST` → `PLAYING` (auto after ~5s tune OR any input after 1s delay)
- `PLAYING` → `INVASION_LANDING` (aliens reach danger zone)
- `INVASION_LANDING` → `GAME_OVER` (aliens finish landing animation)
- `PLAYING` → `GAME_OVER` (lives = 0)
- `GAME_OVER` → `WAVE_INTRO` (any input after 1.5s delay, calls resetGame() + startGame())
- Any state → `ROTATE_DEVICE` (mobile portrait detected without orientation lock)
- `ROTATE_DEVICE` → previous state (landscape restored)

## Configuration (GameConfig.ts)

All magic numbers centralized here. Key values:

```typescript
aliens: {
  columns: 10,
  rows: 5,
  spacingX: 22,         // Horizontal spacing between aliens
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
  basePitch: 0.15,      // Default camera angle (~8.5° up)
  height: 5,            // Camera Y position
  zPosition: -50,       // Camera Z position
  fireRate: 0.3,        // Seconds between shots
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
  playerDamageRadius: 1,
},

gameplay: {
  lives: 5,
  hitsPerLife: 20,        // Damage points before losing a life
  speedMultiplierMin: 0.3,
  dangerDistance: 100,    // Game over trigger (aliens reach shields)
},

timing: {
  baseMoveInterval: 55,          // Frames at 60fps
  alienShootChanceBase: 0.005,   // Wave 1
  alienShootChanceMax: 0.05,     // Wave 100
},

visual: {
  backgroundColor: 0x001100,
  fov: 75,
  nearPlane: 0.1,
  farPlane: 1000,
},

touch: {
  joystickSize: 120,       // Diameter of joystick base in pixels
  joystickKnobSize: 50,    // Diameter of joystick knob
  aimSensitivity: 0.004,   // 2x mouse sensitivity for touch
  deadzone: 0.1,           // Minimum joystick input threshold
},
```

## Entity Details

### Alien (Alien.ts)

**Sprite Patterns**: Defined as 2D arrays (1 = filled, 0 = empty)
- Squid: 8x8 pixels (back rows, can dive bomb)
- Crab: 11x8 pixels (front row)
- Bug: 12x8 pixels (middle rows)

**Resolution Multiplier**: Each sprite pixel = 2x2 voxels (RESOLUTION_MULTIPLIER = 2)

**Colors** (green theme):
- Crab (front): Bright green `0x00ff00`
- Bug (middle): Medium green `0x00dd00`
- Squid (back): Dark green `0x00bb00`

**Brightness System**:
- Front alien in column = 1.0 (full brightness)
- Each alien behind loses 0.15 brightness
- Minimum brightness = 0.3
- Recalculated via `updateBrightness(aliensInFront)` when aliens die

**Dive Bomber** (Squid type only):
- States: `NONE`, `DIVING`, `RETURNING`
- Tracks `diveProgress`, `diveStartPos`, `diveTargetX`
- Can fire strafing shots during dive

### AlienFormation (AlienFormation.ts)

**Movement**:
- Horizontal movement at `baseSpeed * direction`
- Reverses and drops `dropDistance` when any alive alien exceeds `edgeMargin`
- Speed scales with alive count: `moveInterval = baseMoveInterval * (aliveCount / totalAliens)`

**Shooting**:
- Only frontmost alien per column can shoot (`getFrontAliens()`)
- `shootChance` scales linearly: wave 1 = 0.5%, wave 100 = 5%
- Direction: Vertical angle to reach player height

**Dive Attacks** (Wave 2+):
- Only squid (back row) aliens can dive
- Dive bomber flies toward player position with wave motion
- Fires strafing shots during dive (interval scales with wave)
- Returns to formation after reaching retreat point
- Max concurrent divers: 1 (wave 2) → 5 (wave 100)
- Dive interval: 3-8s (wave 2) → 0.8-2s (wave 100)

**Wave Intro**:
- `startIntro()`: Aliens fly in from far distance
- `updateIntro()`: Returns true when all aliens in position
- Saucer sound plays during intro

**Invasion Landing**:
- `startLanding()`: Triggered when aliens reach danger zone
- `updateLanding()`: Aliens descend to ground, game over when complete

### Shield (Shield.ts)

**Structure**:
- Rectangular voxel grid (width × height × depth in voxel units)
- Tilted back 0.4 radians (~23°) to face incoming fire
- Health per voxel scales with wave: 3 (wave 1) → 1 (wave 100)

**Voxel Health Colors**:
- Blue `(0, 0.53, 1)`: healthRatio > 0.6
- Cyan `(0, 0.8, 1)`: healthRatio > 0.3
- Dark blue `(0.2, 0.2, 0.8)`: critical

### PlayerTurret (PlayerTurret.ts)

**Camera Setup**:
- Position: `(0, height, zPosition)` = `(0, 5, -50)`
- Rotation order: 'YXZ' (yaw, pitch, roll - standard FPS)
- Base pitch: 0.15 radians (~8.5° up)

**Turret Mesh** (solid grey 0x888888):
- Base: Cylinder (radius 6→8, height 3)
- Barrel: Box (2×2×12) at y=4, z=-6
- Side panels: Two angled boxes

### Projectile (Projectile.ts)

**Player Shots**:
- Geometry: Cylinder (radius 0.3, height 3)
- Color: Green (0x00ff00)
- Speed: 150 units/s

**Alien Shots**:
- Geometry: Sphere (radius 0.5)
- Color: Red (0xff0000)
- Speed: 80 units/s
- Shot Types: 'rolling' | 'plunger' | 'squiggly' (visual only)

## Input System (InputManager.ts, TouchInputManager.ts)

**Desktop Controls**:
- A/D or Arrow Left/Right: Strafe
- W/S or Arrow Up/Down: Forward/back movement
- Mouse: Aim (only when pointer locked)
- Left click: Fire
- Space bar: Fire (when pointer locked)
- Any key/click: Start game, continue after life lost/game over

**Pointer Lock** (WebKit Compatible):
- Uses `webkitPointerLockElement` and `webkitRequestPointerLock()` fallbacks
- Listens for both `pointerlockchange` and `webkitpointerlockchange` events
- Mouse delta accumulated between frames
- Input cleared when lock lost

**External Input Detection** (Mobile with keyboard/trackpad):
- Detects mouse movement on mobile devices
- Sets `_useExternalInput` flag on first real mouse movement
- Allows pointer lock to be requested on mobile when external input detected
- Touch controls hidden when using external input

**Mobile Detection**:
```typescript
this._isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  || ('ontouchstart' in window)
  || (navigator.maxTouchPoints > 0);
```

**TouchInputManager** (Mobile):
- Virtual joystick on left side of screen
- Aim zone on right side - drag to aim
- Tap on joystick OR aim zone to fire
- Multi-touch tracking via `touch.identifier`
- Joystick uses deadzone (0.1) and clamps to radius

**Joystick Repositioning**:
- Long-press (3 seconds) on joystick to enter reposition mode
- Drag to move joystick anywhere on screen
- Position saved to localStorage as percentage
- Persists across sessions
- Clamped to screen bounds on resize
- Instructions shown on mobile start screen

## Audio System (AudioManager.ts)

**iOS Safari Unlock**:
- AudioContext starts suspended
- `unlock()` method resumes context and plays silent buffer
- Called on first user interaction (click/touch)
- Uses `webkitAudioContext` fallback for older Safari

**March Beat**:
- 4 notes: A1 (55Hz), G1 (49Hz), F#1 (46Hz), E1 (41Hz)
- Square wave, 0.15 volume
- Tempo: 100ms (1 alien) to 1000ms (50 aliens)

**Sound Effects**:
| Sound | Status | Description |
|-------|--------|-------------|
| `playPlayerShoot()` | Enabled | Punchy sci-fi laser (sawtooth sweep + thump + noise) |
| `playAlienShoot()` | Disabled | Too noisy |
| `playAlienDeath()` | Enabled | Noise burst with low-pass filter |
| `playLifeLost()` | Enabled | ~5s melancholic tune |
| `playWaveComplete()` | Enabled | ~5s triumphant fanfare |
| `playGameOver()` | Enabled | ~5s sad dirge |
| `playWaveIntro()` | Enabled | ~4s quirky "here they come" tune |
| `playTurretShieldHit()` | Enabled | Big crunch sound (turret shot hits shield) |
| `playShieldHit()` | Disabled | Too noisy (alien shots) |
| `playPlayerHit()` | Disabled | Too noisy |
| `startSaucerSound()` | Enabled | UFO warble (sine + LFO modulation) |

**Saucer Sound State Management**:
- Started: `startGame()`, `nextWave()` (wave intro), `startInvasionLanding()`
- Stopped: Wave intro complete, `startWaveCompleteDelay()`, `startLifeLostSequence()`, `gameOver()`
- Critical: Must stop on all state transitions out of intro to prevent sound persisting

## Explosion System (ExplosionEffect.ts)

**Alien Explosion** (`createAlienExplosion()`):
1. White flash sphere (radius 5, life 0.1s)
2. Colored glow sphere (radius 3, life 0.4s, expands)
3. 20 colored debris cubes (speed 25-60, life 0.6-1.0s)
4. 12 wireframe lines (life 0.3-0.5s)

**Shield Impact** (`createShieldImpact()`):
- 12 blue debris cubes (0x0088ff)
- Speed 15-35, life 0.4-0.7s

**Turret Shield Impact** (`createTurretShieldImpact()`):
- Larger explosion when player shot hits own shield

**Turret Explosion** (`createTurretExplosion()`):
1. White flash sphere (radius 8, life 0.15s)
2. 30 grey debris cubes (0x888888, speed 30-70, biased upward)
3. 15 orange fire particles (0xff4400, upward bias)

**Key Method**: `hasActiveParticles()` - Used to wait for explosions before showing messages

**Object Pooling**:
- Pre-allocates meshes: 80 box, 120 debris, 20 sphere particles
- `acquireFromPool()` / `releaseToPool()` avoid allocation during gameplay
- Shared geometries and materials across pool
- `dispose()` method for cleanup

## Rendering (SceneManager.ts, CRTEffect.ts)

**Scene Setup**:
- Background: 0x001100 (dark green)
- Ambient light: 0xffffff, intensity 0.6
- Main directional light: 0xffffff, intensity 1.0, from (0, 100, 100)
- Rim light: 0x4488ff, intensity 0.4, from (0, 50, -200)

**Forest Environment**:
- Tree silhouettes at horizon and sides (cones + cylinders)
- Back treeline: 100 trees, Z=-750 to -850, height 140-220
- Side treelines: 40 trees each, height 60-100
- Star field in upper hemisphere (1000 points)

**CRT Post-Processing** (CRTEffect.ts):
- UnrealBloomPass: strength 0.5, radius 0.4, threshold 0.85
- Custom shader with uniforms:
  - scanlineIntensity: 0.15
  - scanlineCount: 800 (adjusts to height)
  - vignetteIntensity: 0.3
  - chromaticAberration: 0.002
  - barrelDistortion: 0.04
  - time: animated for flicker

**FOV Adjustment**:
- Reference: 6:4 aspect (1.5) with 75° vertical FOV
- Adjusts FOV to maintain consistent horizontal view across aspect ratios

## Mobile / PWA

**Orientation Handling**:
1. Try `screen.orientation.lock('landscape')` (PWA/fullscreen only)
2. If lock succeeds, add `orientation-locked` class
3. If lock fails, show rotate overlay when in portrait
4. Game pauses in `ROTATE_DEVICE` state, resumes when landscape

**Rotate Overlay**:
- Full-screen black overlay with animated phone icon
- "Please rotate your device to landscape" message
- Created dynamically in `createRotateOverlay()`

**Fullscreen**:
- Requested on game start (mobile)
- Uses `webkitRequestFullscreen` fallback

**PWA Manifest** (public/manifest.json):
```json
{
  "display": "standalone",
  "orientation": "landscape",
  "background_color": "#000000",
  "theme_color": "#00ff88"
}
```

## UI Elements (index.html)

**Container**: `#game-container`
- 6:4 aspect ratio via CSS `aspect-ratio`
- 1984-style monitor surround (wood-tone gradient border)
- "FOREST PESTS" embossed title
- Screen reflection overlay

**Overlay Elements** (`#ui-overlay`):
- `#score-display`: Top-left
- `#hud-right`: Top-right, life icons (tree emojis)
- `#wave-display`: Below score
- `#health-bar-container`: Bottom center, 300px wide
- `#crosshair`: Center, 40px circle with cross
- `#game-message`: Center, for game state messages
- `#start-screen`: Start screen with title and controls info
- `#damage-overlay`: Full screen red flash

**Touch Controls** (`#touch-controls`):
- `#joystick-zone`: Contains base and knob, repositionable
- `#aim-zone`: Right side touch area
- Visual feedback: `.firing` class on joystick, `.repositioning` class during move

## Wave Progression (100 Waves)

| Wave | Shield Voxel Health | Alien Fire Rate | Dive Interval | Max Divers |
|------|---------------------|-----------------|---------------|------------|
| 1    | 3 hits              | 0.5%            | No diving     | 0          |
| 2    | 3 hits              | 0.6%            | 3-8s          | 1          |
| 25   | 2-3 hits            | 1.7%            | 2.2-5.5s      | 2          |
| 50   | 2 hits              | 2.75%           | 1.5-4s        | 3          |
| 75   | 1-2 hits            | 3.9%            | 1.1-2.8s      | 4          |
| 100  | 1 hit               | 5%              | 0.8-2s        | 5          |

## Performance Optimizations

**Collision Detection** (CollisionSystem.ts, Alien.ts, Projectile.ts):
- Bounding spheres cached with dirty flags (recalculated only on position change)
- Squared distance comparisons (`distanceToSquared`) avoid expensive sqrt operations
- Temp vectors reused to reduce garbage collection pressure

**AlienFormation.ts**:
- Cached alive count updated on kill (avoids `.filter().length` each frame)
- Brightness update uses dirty flag (only recalculates when aliens die)
- `for-of` loops instead of `forEach` (avoids callback overhead)
- Pre-calculated `totalWidth` and `halfWidth` constants

**Shield.ts**:
- Static readonly color constants (avoid creating Color objects per cell)
- Cached world positions on each HexCell
- Cached bounding box (position never changes)
- Color state tracking (only updates GPU buffer when state changes)

**AudioManager.ts**:
- Web Audio API native scheduling via `playToneAt()` method
- `playSequence()` helper schedules all notes at once
- Eliminates 40-50 setTimeout calls per audio sequence

**DOM Optimizations** (TouchInputManager.ts, Game.ts):
- Cached DOMRect values with lazy invalidation on resize/reposition
- Cached zone dimensions for repositioning calculations
- `destroy()` method removes event listeners
- Cached life icon elements (avoids `querySelectorAll` each frame)
- Dirty checking for score/wave/health/lives (only updates DOM when changed)

**SceneManager.ts**:
- Debounced resize handler (100ms) prevents excessive recalculations during window drag

**InputManager.ts**:
- Boolean flags for movement keys (avoids 8× `Set.has()` lookups per frame)
- Flags updated on keydown/keyup events
- On keyup, checks if alternate key still pressed before clearing flag (e.g., KeyA + ArrowLeft)

## Bug Fixes (Recent)

**Movement Speed Not Increasing** (Game.ts, AlienFormation.ts):
- `onAlienKilled()` was never called when aliens died
- `cachedAliveCount` stayed at initial value, speed multiplier always 1.0
- Fix: Call `alienFormation.onAlienKilled()` in collision handler for each kill

**Saucer Sound Issues** (AudioManager.ts, Game.ts):
- LFO oscillator was local variable, never stopped - sound persisted indefinitely
- Fix: Store `saucerLfo` as class field, stop and disconnect in `stopSaucerSound()`
- Fix: Properly disconnect all audio nodes (lfo, oscillator, gain) on stop
- Sound not stopping during intro: Added `stopSaucerSound()` to `startWaveCompleteDelay()` and `startLifeLostSequence()`

**Touch Joystick Position Issues** (TouchInputManager.ts):
- Cached DOMRects stale after show/hide/reposition
- Fix: Call `updateCachedRects()` after repositioning ends
- Fix: Use `requestAnimationFrame` to update cache after `show()` and `reloadPosition()`
- Fix: Update cache in resize handler after `clampToScreen()`

## Development Commands

```bash
npm install                    # Install dependencies
npm run dev                    # Start dev server (Vite)
npm run dev -- --host          # Dev server on all interfaces (for mobile testing)
npm run build                  # Production build to dist/
npm run preview                # Preview production build
```

## Deployment

Manual deployment from `dist/` folder:
1. Run `npm run build`
2. Copy contents of `dist/` to hosting destination
