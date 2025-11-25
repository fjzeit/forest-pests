import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

// Combined CRT Shader - scanlines, chromatic aberration, barrel distortion, vignette
const CRTShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    time: { value: 0 },
    scanlineIntensity: { value: 0.15 },
    scanlineCount: { value: 800 },
    vignetteIntensity: { value: 0.3 },
    chromaticAberration: { value: 0.002 },
    barrelDistortion: { value: 0.04 },
  },

  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float time;
    uniform float scanlineIntensity;
    uniform float scanlineCount;
    uniform float vignetteIntensity;
    uniform float chromaticAberration;
    uniform float barrelDistortion;

    varying vec2 vUv;

    // Barrel distortion
    vec2 distort(vec2 uv) {
      vec2 centered = uv - 0.5;
      float r2 = dot(centered, centered);
      float distortion = 1.0 + r2 * barrelDistortion;
      return centered * distortion + 0.5;
    }

    void main() {
      // Apply barrel distortion
      vec2 distortedUv = distort(vUv);

      // Check if we're outside the screen after distortion
      if (distortedUv.x < 0.0 || distortedUv.x > 1.0 ||
          distortedUv.y < 0.0 || distortedUv.y > 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
      }

      // Chromatic aberration
      float aberration = chromaticAberration * length(distortedUv - 0.5);
      vec3 color;
      color.r = texture2D(tDiffuse, distortedUv + vec2(aberration, 0.0)).r;
      color.g = texture2D(tDiffuse, distortedUv).g;
      color.b = texture2D(tDiffuse, distortedUv - vec2(aberration, 0.0)).b;

      // Keep original colors - boost brightness slightly for CRT glow feel
      color *= 1.1;

      // Scanlines
      float scanline = sin(distortedUv.y * scanlineCount * 3.14159) * 0.5 + 0.5;
      scanline = pow(scanline, 1.5);
      color *= 1.0 - scanlineIntensity * (1.0 - scanline);

      // Subtle horizontal line flicker
      float flicker = 1.0 + 0.02 * sin(time * 10.0 + distortedUv.y * 100.0);
      color *= flicker;

      // Vignette
      vec2 vignetteUv = distortedUv - 0.5;
      float vignette = 1.0 - dot(vignetteUv, vignetteUv) * vignetteIntensity * 2.0;
      color *= vignette;

      // Subtle noise
      float noise = (fract(sin(dot(distortedUv + time * 0.001, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.02;
      color += noise;

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

export class CRTEffect {
  private composer: EffectComposer;
  private crtPass: ShaderPass;
  private clock: THREE.Clock;
  private container: HTMLElement;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera
  ) {
    this.clock = new THREE.Clock();
    this.container = document.getElementById('game-container')!;

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    // Create composer
    this.composer = new EffectComposer(renderer);

    // Render pass
    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    // Bloom pass (for the glow effect)
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.25,  // strength (reduced to avoid large muzzle flash)
      0.3,   // radius
      0.92   // threshold (increased so less blooms)
    );
    this.composer.addPass(bloomPass);

    // CRT shader pass
    this.crtPass = new ShaderPass(CRTShader);
    this.crtPass.uniforms.resolution.value.set(width, height);
    this.composer.addPass(this.crtPass);

    // Handle resize
    window.addEventListener('resize', () => this.onResize(renderer));
  }

  private onResize(_renderer: THREE.WebGLRenderer): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.composer.setSize(width, height);
    this.crtPass.uniforms.resolution.value.set(width, height);

    // Adjust scanline count based on height for consistent appearance
    this.crtPass.uniforms.scanlineCount.value = height;
  }

  render(): void {
    // Update time uniform for animated effects
    this.crtPass.uniforms.time.value = this.clock.getElapsedTime();
    this.composer.render();
  }

  // Allow runtime adjustment of CRT parameters
  setScanlineIntensity(intensity: number): void {
    this.crtPass.uniforms.scanlineIntensity.value = intensity;
  }

  setVignetteIntensity(intensity: number): void {
    this.crtPass.uniforms.vignetteIntensity.value = intensity;
  }

  setChromaticAberration(amount: number): void {
    this.crtPass.uniforms.chromaticAberration.value = amount;
  }

  setBarrelDistortion(amount: number): void {
    this.crtPass.uniforms.barrelDistortion.value = amount;
  }
}
