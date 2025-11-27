import { InputManager } from './InputManager';
import { GameConfig } from '../game/GameConfig';

interface TouchPoint {
  id: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export class TouchInputManager {
  private inputManager: InputManager;

  // UI Elements
  private touchControls: HTMLElement;
  private joystickZone: HTMLElement;
  private joystickBase: HTMLElement;
  private joystickKnob: HTMLElement;
  private aimFireZone: HTMLElement;

  // Touch tracking
  private joystickTouch: TouchPoint | null = null;
  private aimFireTouch: TouchPoint | null = null;

  // Joystick config
  private joystickRadius: number;
  private deadzone: number;

  // Aim tracking
  private lastAimX = 0;
  private lastAimY = 0;

  constructor(inputManager: InputManager) {
    this.inputManager = inputManager;
    this.joystickRadius = GameConfig.touch.joystickSize / 2;
    this.deadzone = GameConfig.touch.deadzone;

    // Get UI elements
    this.touchControls = document.getElementById('touch-controls')!;
    this.joystickZone = document.getElementById('joystick-zone')!;
    this.joystickBase = document.getElementById('joystick-base')!;
    this.joystickKnob = document.getElementById('joystick-knob')!;
    this.aimFireZone = document.getElementById('aim-fire-zone')!;

    this.bindEvents();
  }

  private bindEvents(): void {
    // Joystick zone events
    this.joystickZone.addEventListener('touchstart', (e) => this.onJoystickStart(e), { passive: false });
    this.joystickZone.addEventListener('touchmove', (e) => this.onJoystickMove(e), { passive: false });
    this.joystickZone.addEventListener('touchend', (e) => this.onJoystickEnd(e), { passive: false });
    this.joystickZone.addEventListener('touchcancel', (e) => this.onJoystickEnd(e), { passive: false });

    // Aim+Fire zone events (touch to aim and fire simultaneously)
    this.aimFireZone.addEventListener('touchstart', (e) => this.onAimFireStart(e), { passive: false });
    this.aimFireZone.addEventListener('touchmove', (e) => this.onAimFireMove(e), { passive: false });
    this.aimFireZone.addEventListener('touchend', (e) => this.onAimFireEnd(e), { passive: false });
    this.aimFireZone.addEventListener('touchcancel', (e) => this.onAimFireEnd(e), { passive: false });
  }

  // Joystick handlers
  private onJoystickStart(e: TouchEvent): void {
    e.preventDefault();
    if (this.joystickTouch) return; // Already tracking a touch

    const touch = e.changedTouches[0];
    const rect = this.joystickBase.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    this.joystickTouch = {
      id: touch.identifier,
      startX: centerX,
      startY: centerY,
      currentX: touch.clientX,
      currentY: touch.clientY
    };

    this.updateJoystick();
  }

  private onJoystickMove(e: TouchEvent): void {
    e.preventDefault();
    if (!this.joystickTouch) return;

    const touch = this.findTouch(e.changedTouches, this.joystickTouch.id);
    if (!touch) return;

    this.joystickTouch.currentX = touch.clientX;
    this.joystickTouch.currentY = touch.clientY;

    this.updateJoystick();
  }

  private updateJoystick(): void {
    if (!this.joystickTouch) return;

    // Calculate displacement from center of joystick base
    let dx = this.joystickTouch.currentX - this.joystickTouch.startX;
    let dy = this.joystickTouch.currentY - this.joystickTouch.startY;

    // Clamp to radius
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > this.joystickRadius) {
      dx = (dx / distance) * this.joystickRadius;
      dy = (dy / distance) * this.joystickRadius;
    }

    // Update knob visual position
    this.joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;

    // Normalize to -1 to 1 range
    let normalX = dx / this.joystickRadius;
    let normalY = -dy / this.joystickRadius; // Invert Y for game coords (up = positive)

    // Apply deadzone
    if (Math.abs(normalX) < this.deadzone) normalX = 0;
    if (Math.abs(normalY) < this.deadzone) normalY = 0;

    // Send to InputManager
    this.inputManager.setTouchMoveInput(normalX, normalY);
  }

  private onJoystickEnd(e: TouchEvent): void {
    e.preventDefault();
    if (!this.joystickTouch) return;

    const touch = this.findTouch(e.changedTouches, this.joystickTouch.id);
    if (touch || e.type === 'touchcancel') {
      this.joystickTouch = null;
      this.joystickKnob.style.transform = 'translate(0, 0)';
      this.inputManager.setTouchMoveInput(0, 0);
    }
  }

  // Aim+Fire handlers - touch to aim and fire simultaneously
  private onAimFireStart(e: TouchEvent): void {
    e.preventDefault();
    if (this.aimFireTouch) return; // Already tracking

    const touch = e.changedTouches[0];
    this.aimFireTouch = {
      id: touch.identifier,
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      currentY: touch.clientY
    };
    this.lastAimX = touch.clientX;
    this.lastAimY = touch.clientY;

    // Start firing when touching
    this.inputManager.setTouchFiring(true);
  }

  private onAimFireMove(e: TouchEvent): void {
    e.preventDefault();
    if (!this.aimFireTouch) return;

    const touch = this.findTouch(e.changedTouches, this.aimFireTouch.id);
    if (!touch) return;

    // Calculate delta since last frame
    const deltaX = touch.clientX - this.lastAimX;
    const deltaY = touch.clientY - this.lastAimY;

    this.lastAimX = touch.clientX;
    this.lastAimY = touch.clientY;

    // Send aim delta to InputManager (accumulated like mouse)
    this.inputManager.setTouchAimDelta(deltaX, deltaY);
  }

  private onAimFireEnd(e: TouchEvent): void {
    e.preventDefault();
    if (!this.aimFireTouch) return;

    const touch = this.findTouch(e.changedTouches, this.aimFireTouch.id);
    if (touch || e.type === 'touchcancel') {
      this.aimFireTouch = null;
      // Stop firing when releasing
      this.inputManager.setTouchFiring(false);
    }
  }

  // Utility
  private findTouch(touches: TouchList, id: number): Touch | null {
    for (let i = 0; i < touches.length; i++) {
      if (touches[i].identifier === id) return touches[i];
    }
    return null;
  }

  // Public methods
  show(): void {
    this.touchControls.classList.remove('hidden');
  }

  hide(): void {
    this.touchControls.classList.add('hidden');
    // Reset all input when hiding
    this.joystickTouch = null;
    this.aimFireTouch = null;
    this.joystickKnob.style.transform = 'translate(0, 0)';
    this.inputManager.setTouchMoveInput(0, 0);
    this.inputManager.setTouchFiring(false);
  }

  isVisible(): boolean {
    return !this.touchControls.classList.contains('hidden');
  }
}
