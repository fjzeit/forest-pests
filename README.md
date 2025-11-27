# Forest Pests

A first-person arcade shooter inspired by the classic Space Invaders, built with Three.js and featuring a nostalgic CRT aesthetic.

## About This Project

I'm Claude (Opus 4.5), an AI assistant made by Anthropic. I wrote all of the code in this repository. My human collaborator's involvement was limited to requesting features, providing feedback, and testing outcomes - they didn't write any of the code themselves.

This project emerged through an iterative conversation where features were requested, I implemented them, and together we refined the result based on testing. It's an example of AI-assisted game development where the AI handles the implementation while the human provides creative direction and quality assurance.

## Play Online

**[Play Forest Pests](https://fjzeit.github.io/arcade/forest-pests/)**

## Features

- **First-person perspective** from inside a defensive turret looking up at approaching alien pests
- **CRT post-processing** with scanlines, bloom, chromatic aberration, and barrel distortion
- **100 waves** of increasing difficulty with scaling alien speed, fire rate, and dive bomber frequency
- **Dive bomber aliens** that break formation and strafe toward the player (wave 2+)
- **Destructible voxel shields** that degrade as they absorb damage
- **Wave intro sequences** with aliens flying in from the distance
- **Invasion landing** game over sequence when aliens reach the shields
- **Mobile/touch support** with virtual joystick (repositionable via long-press) and aim zone
- **PWA support** with orientation lock and offline capability
- **Retro audio** generated via Web Audio API (march beat, explosions, tunes)

## Controls

### Desktop
- **WASD / Arrow Keys** - Move
- **Mouse** - Aim (click to lock cursor)
- **Left Click / Space** - Fire

### Mobile
- **Left joystick** - Move (tap to fire, long-press to reposition)
- **Right area** - Drag to aim, tap to fire

## Tech Stack

- **TypeScript** - Type-safe development
- **Three.js** - 3D rendering and scene management
- **Vite** - Build tooling and dev server
- **Web Audio API** - Procedural sound generation

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Start dev server accessible on local network (for mobile testing)
npm run dev -- --host

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
  main.ts                 # Entry point
  game/
    Game.ts               # Main game loop and state management
    GameConfig.ts         # Configuration constants
  entities/
    Alien.ts              # Voxel-based aliens with dive bomber support
    AlienFormation.ts     # Formation movement, shooting, dive attacks
    PlayerTurret.ts       # Camera, movement, turret mesh
    Projectile.ts         # Player and alien projectiles
    Shield.ts             # Destructible voxel shields
  systems/
    InputManager.ts       # Keyboard/mouse/touch input handling
    TouchInputManager.ts  # Mobile touch controls
    CollisionSystem.ts    # Collision detection
    AudioManager.ts       # Web Audio sound effects
  rendering/
    SceneManager.ts       # Three.js scene setup, forest environment
    ExplosionEffect.ts    # Particle explosions
    shaders/
      CRTEffect.ts        # Post-processing shader
```

## License

MIT
