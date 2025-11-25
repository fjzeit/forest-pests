// Game Configuration Constants

export const GameConfig = {
  // Alien Formation
  // Field of play: 1 shield width beyond leftmost/rightmost shields
  // 4 shields at spacing 50 = span of 150 (-75 to +75), shield width 24
  // Field edge = 75 + 12 (half shield) + 24 (one shield width) = 111
  aliens: {
    columns: 11,
    rows: 5,
    spacingX: 16,       // Horizontal spacing between aliens (tighter to fit field)
    spacingZ: 36,       // Depth spacing between rows
    startDistance: 400, // Starting Z distance from player
    startHeight: 60,    // Y position (height above ground)
    dropDistance: 15,   // How much closer aliens get on each drop
    baseSpeed: 4,       // Base horizontal movement speed
    edgeMargin: 111,    // Field boundary - 1 shield width beyond outer shields
    scale: 2.0,         // Scale multiplier for alien size
  },

  // Alien Types (row assignments from front to back)
  alienTypes: {
    // Front row (closest to player) - Crab type
    crab: { rows: [0] as number[], points: 10, color: 0x00ff00 },
    // Middle rows - Bug type
    bug: { rows: [1, 2] as number[], points: 20, color: 0x00dd00 },
    // Back rows - Squid type
    squid: { rows: [3, 4] as number[], points: 30, color: 0x00bb00 },
  },

  // Player
  player: {
    strafeSpeed: 80,       // Lateral movement speed
    strafeLimit: 111,      // Maximum strafe distance - matches field boundary
    aimSensitivity: 0.002, // Mouse sensitivity
    maxPitch: 0.6,         // Max vertical aim (radians from base)
    maxYaw: 1.05,          // Max horizontal aim (radians, ~60 degrees)
    basePitch: 0.5,        // Base camera pitch (~29 degrees up)
    height: 5,             // Camera height
    zPosition: -50,        // Z position (50% closer to shields)
    fireRate: 0.4,         // Minimum seconds between shots
  },

  // Projectiles
  projectiles: {
    playerSpeed: 150,      // Player shot speed
    alienSpeed: 80,        // Alien shot speed
    playerColor: 0x00ff00,
    alienColor: 0xff0000,
  },

  // Shields
  shields: {
    count: 4,
    width: 24,
    height: 30,     // Taller to block all incoming shots
    depth: 6,
    distance: 100,  // Z distance from player
    height_y: 0,    // Start at ground level
    spacing: 50,    // Horizontal spacing between shields
    voxelSize: 2,
  },

  // Gameplay
  gameplay: {
    lives: 3,
    hitsPerLife: 20,          // Damage points before losing a life
    speedMultiplierMin: 0.3,  // Speed when 1 alien left vs full formation
    dangerDistance: 100,      // Game over if aliens reach the shields
  },

  // Timing (in frames at 60fps, matching original arcade timing feel)
  timing: {
    baseMoveInterval: 55,  // Frames between alien movements at full count
    alienShootChanceBase: 0.005, // Starting per-alien chance to shoot per update (wave 1)
    alienShootChanceMax: 0.05,   // Maximum shoot chance (wave 100)
  },

  // Visual
  visual: {
    backgroundColor: 0x001100,
    fov: 75,
    nearPlane: 0.1,
    farPlane: 1000,
  },
} as const;
