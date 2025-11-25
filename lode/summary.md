# Space Invaders - First Person

A first-person Space Invaders homage game with 1970s CRT aesthetic, viewed from inside the defender's turret looking up at ~40 degrees toward approaching aliens.

## Tech Stack

- **Runtime**: Vite + TypeScript
- **Rendering**: Three.js with post-processing
- **Build**: npm

## Core Architecture

### Directory Structure
```
src/
  main.ts              # Entry point
  game/
    Game.ts            # Main game loop and state management
    GameConfig.ts      # Central configuration constants
  entities/
    Alien.ts           # Voxel-based alien sprites with animation
    AlienFormation.ts  # Formation movement and shooting logic
    PlayerTurret.ts    # Player camera, movement, and visible turret
    Projectile.ts      # Player and alien projectiles
    Shield.ts          # Destructible voxel shields
  systems/
    InputManager.ts    # Keyboard/mouse input handling
    CollisionSystem.ts # Projectile-entity collision detection
    AudioManager.ts    # Sound effects and march beat
  rendering/
    SceneManager.ts    # Three.js scene, camera, renderer setup
    ExplosionEffect.ts # Particle explosions
    shaders/
      CRTEffect.ts     # Post-processing (scanlines, bloom, distortion)
```

## Game Mechanics

### Player Controls
- **A/D or Arrow Keys**: Strafe left/right within field boundaries
- **Mouse**: Limited vertical aiming (~0.6 radians), minimal horizontal (~8 degrees)
- **Click**: Fire projectile (with cooldown)
- Movement is primary method of targeting - strafing to align with aliens

### Alien Formation
- 11 columns × 5 rows of aliens
- Three alien types by row:
  - **Crab** (front row): Yellow, 10 points
  - **Bug** (middle rows): Cyan, 20 points
  - **Squid** (back rows): Hot pink, 30 points
- Moves horizontally, drops closer when hitting field edge
- Speed increases as aliens are destroyed
- Only frontmost alien in each column can shoot

### Alien Brightness
- Brightness based on position within column (not grid position)
- Frontmost alien in column is brightest
- Each alien behind is progressively dimmer
- Recalculates when aliens are destroyed

### Alien Shooting
- Shots fire straight down their column (no horizontal tracking)
- Vertical angle calculated to reach player height
- Player must strafe to avoid shots from directly overhead aliens

### Field of Play
- Bounded by 1 shield width beyond outer shields (±111 units)
- 4 shields at spacing 50 = span of 150 (-75 to +75)
- Shield width 24, so field edge = 75 + 12 + 24 = 111

### Shields
- 4 rectangular destructible shields
- Voxel-based damage system
- Positioned at ground level, tall enough to block all incoming shots
- Block both player and alien projectiles

### Collision Detection
- Sphere-based for aliens and projectiles
- Voxel-based for shields
- Player hit detection uses horizontal distance only (infinite vertical)
- Hit radius of 8 units around player position

### Health System
- 20 hits per life, 3 lives total
- Horizontal health bar at bottom center of screen
- Changes color: green → orange (warning) → red (critical)
- Screen flash and shake on damage

### Game Over Conditions
- Lose all lives
- Aliens reach shield line (dangerDistance: 100)

## Visual Style

### CRT Post-Processing
- Scanlines with subtle flicker
- Chromatic aberration
- Barrel distortion
- Vignette effect
- Bloom glow
- Original colors preserved (no green phosphor tinting)

### Environment
- Vector grid ground (dark green lines)
- Field boundary lines at ±111
- Star field hemisphere backdrop
- Wireframe visible turret at player position

### Alien Sprites
- 8-bit pixel art style
- 2-frame animation synced to march
- Rendered as 3D voxels (2x2 per pixel)
- Distinct colors per alien type

## Configuration

Key settings in `GameConfig.ts`:
- `aliens.edgeMargin: 111` - Field boundary
- `player.strafeLimit: 111` - Player movement limit
- `player.zPosition: -50` - Player distance from origin
- `player.maxPitch: 0.6` - Vertical aim limit
- `shields.height_y: 0` - Shields at ground level
- `shields.height: 30` - Shield height
- `gameplay.dangerDistance: 100` - Game over trigger distance
- `gameplay.hitsPerLife: 20` - Damage before losing life

## Audio
- March beat tempo scales with remaining alien count
- Most sound effects disabled for minimal audio
