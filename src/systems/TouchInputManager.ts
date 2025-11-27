import { InputManager } from './InputManager';
import { GameConfig } from '../game/GameConfig';

interface TouchPoint {
  id: number;
  centerX: number;    // Joystick center (for movement calculation)
  centerY: number;
  touchStartX: number; // Actual touch start position (for tap detection)
  touchStartY: number;
  currentX: number;
  currentY: number;
  startTime: number;
}

// Tap detection thresholds
const TAP_MAX_DURATION = 200;  // ms - max time for a tap
const TAP_MAX_DISTANCE = 15;   // px - max movement for a tap

// Long press for repositioning
const LONG_PRESS_DURATION = 500;  // ms - time to trigger long press
const STORAGE_KEY = 'joystickPosition';

export class TouchInputManager {
  private inputManager: InputManager;

  // UI Elements
  private touchControls: HTMLElement;
  private joystickZone: HTMLElement;
  private joystickBase: HTMLElement;
  private joystickKnob: HTMLElement;
  private aimZone: HTMLElement;

  // Touch tracking
  private joystickTouch: TouchPoint | null = null;
  private aimTouch: TouchPoint | null = null;
  private isMoving = false;  // Track if we've committed to movement

  // Repositioning state
  private isRepositioning = false;
  private longPressTimer: number | null = null;
  private repositionOffset = { x: 0, y: 0 };  // Offset from touch to zone corner

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
    this.aimZone = document.getElementById('aim-zone')!;

    this.bindEvents();
    this.loadSavedPosition();

    // Ensure joystick stays on screen after resize
    window.addEventListener('resize', () => this.clampToScreen());
  }

  // Check if CSS rotation is active (mobile in physical portrait)
  private isCssRotated(): boolean {
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isPhysicalPortrait = window.innerWidth < window.innerHeight;
    return isMobile && isPhysicalPortrait;
  }

  private loadSavedPosition(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const pos = JSON.parse(saved);
        this.applyPosition(pos.leftPercent, pos.topPercent);
      }
    } catch (e) {
      // Ignore errors, use default position
    }
  }

  private applyPosition(leftPercent: number, topPercent: number): void {
    // When CSS rotates the view 90deg, we need to transform coordinates
    // CSS rotation: physical Y becomes visual X, physical X becomes visual Y (inverted)
    if (this.isCssRotated()) {
      // Transform from logical (landscape) to physical (portrait) coordinates
      // Visual left% -> physical top%
      // Visual top% -> physical right% (100 - left)
      const physicalTop = leftPercent;
      const physicalLeft = 100 - topPercent - (this.joystickZone.offsetHeight / window.innerWidth) * 100;
      this.joystickZone.style.setProperty('right', 'auto', 'important');
      this.joystickZone.style.setProperty('bottom', 'auto', 'important');
      this.joystickZone.style.setProperty('left', `${physicalLeft}%`, 'important');
      this.joystickZone.style.setProperty('top', `${physicalTop}%`, 'important');
    } else {
      this.joystickZone.style.setProperty('right', 'auto', 'important');
      this.joystickZone.style.setProperty('bottom', 'auto', 'important');
      this.joystickZone.style.setProperty('left', `${leftPercent}%`, 'important');
      this.joystickZone.style.setProperty('top', `${topPercent}%`, 'important');
    }
  }

  private savePosition(): void {
    const rect = this.joystickZone.getBoundingClientRect();

    // When CSS rotates the view, transform physical coordinates to logical (landscape)
    if (this.isCssRotated()) {
      // Physical coords are in portrait space, transform to landscape logical coords
      // Physical top -> logical left
      // Physical left -> logical bottom (invert for top)
      const pos = {
        leftPercent: (rect.top / window.innerHeight) * 100,
        topPercent: 100 - (rect.left / window.innerWidth) * 100 - (rect.width / window.innerWidth) * 100
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
    } else {
      const pos = {
        leftPercent: (rect.left / window.innerWidth) * 100,
        topPercent: (rect.top / window.innerHeight) * 100
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
    }
  }

  // Ensure joystick stays within screen bounds after resize/orientation change
  private clampToScreen(): void {
    // Reload saved position - this handles coordinate transforms correctly
    this.loadSavedPosition();
  }

  private bindEvents(): void {
    // Joystick events on zone, base, and knob (for full coverage)
    const joystickElements = [this.joystickZone, this.joystickBase, this.joystickKnob];
    joystickElements.forEach(el => {
      el.addEventListener('touchstart', (e) => this.onJoystickStart(e), { passive: false });
      el.addEventListener('touchmove', (e) => this.onJoystickMove(e), { passive: false });
      el.addEventListener('touchend', (e) => this.onJoystickEnd(e), { passive: false });
      el.addEventListener('touchcancel', (e) => this.onJoystickEnd(e), { passive: false });
    });

    // Aim zone events
    this.aimZone.addEventListener('touchstart', (e) => this.onAimStart(e), { passive: false });
    this.aimZone.addEventListener('touchmove', (e) => this.onAimMove(e), { passive: false });
    this.aimZone.addEventListener('touchend', (e) => this.onAimEnd(e), { passive: false });
    this.aimZone.addEventListener('touchcancel', (e) => this.onAimEnd(e), { passive: false });
  }

  // Joystick handlers (combined movement + fire)
  private onJoystickStart(e: TouchEvent): void {
    e.preventDefault();
    if (this.joystickTouch) return; // Already tracking a touch

    const touch = e.changedTouches[0];
    const rect = this.joystickBase.getBoundingClientRect();
    const zoneRect = this.joystickZone.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    this.joystickTouch = {
      id: touch.identifier,
      centerX: centerX,           // Joystick center for movement
      centerY: centerY,
      touchStartX: touch.clientX, // Actual touch position for tap detection
      touchStartY: touch.clientY,
      currentX: touch.clientX,
      currentY: touch.clientY,
      startTime: Date.now()
    };

    this.isMoving = false;
    this.isRepositioning = false;

    // Store offset from touch to zone's top-left for smooth repositioning
    this.repositionOffset.x = touch.clientX - zoneRect.left;
    this.repositionOffset.y = touch.clientY - zoneRect.top;

    // Start long press timer
    this.longPressTimer = window.setTimeout(() => {
      this.enterRepositionMode();
    }, LONG_PRESS_DURATION);

    this.updateJoystick();
  }

  private enterRepositionMode(): void {
    this.isRepositioning = true;
    this.isMoving = false;
    // Reset joystick knob to center during repositioning
    this.joystickKnob.style.transform = 'translate(0, 0)';
    this.inputManager.setTouchMoveInput(0, 0);
    // Add visual feedback
    this.joystickZone.classList.add('repositioning');
  }

  private onJoystickMove(e: TouchEvent): void {
    e.preventDefault();
    if (!this.joystickTouch) return;

    const touch = this.findTouch(e.changedTouches, this.joystickTouch.id);
    if (!touch) return;

    this.joystickTouch.currentX = touch.clientX;
    this.joystickTouch.currentY = touch.clientY;

    // Check if we've moved enough from TOUCH START to commit to movement
    const dx = this.joystickTouch.currentX - this.joystickTouch.touchStartX;
    const dy = this.joystickTouch.currentY - this.joystickTouch.touchStartY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (this.isRepositioning) {
      // Move the joystick zone to follow the touch
      this.moveJoystickTo(touch.clientX, touch.clientY);
    } else if (distance > TAP_MAX_DISTANCE) {
      // Cancel long press timer if user starts moving
      this.cancelLongPress();
      this.isMoving = true;
      this.updateJoystick();
    } else {
      this.updateJoystick();
    }
  }

  private moveJoystickTo(touchX: number, touchY: number): void {
    const zoneRect = this.joystickZone.getBoundingClientRect();

    // Calculate new position, accounting for the offset from touch to zone corner
    let newLeft = touchX - this.repositionOffset.x;
    let newTop = touchY - this.repositionOffset.y;

    // Clamp to screen bounds (physical)
    const maxLeft = window.innerWidth - zoneRect.width;
    const maxTop = window.innerHeight - zoneRect.height;
    newLeft = Math.max(0, Math.min(newLeft, maxLeft));
    newTop = Math.max(0, Math.min(newTop, maxTop));

    // During live dragging, use physical coordinates directly
    // Touch events give physical coords, so just apply them
    this.joystickZone.style.setProperty('right', 'auto', 'important');
    this.joystickZone.style.setProperty('bottom', 'auto', 'important');
    this.joystickZone.style.setProperty('left', `${newLeft}px`, 'important');
    this.joystickZone.style.setProperty('top', `${newTop}px`, 'important');
  }

  private cancelLongPress(): void {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  private updateJoystick(): void {
    if (!this.joystickTouch) return;

    // Calculate displacement from center of joystick base (for visual + movement)
    let dx = this.joystickTouch.currentX - this.joystickTouch.centerX;
    let dy = this.joystickTouch.currentY - this.joystickTouch.centerY;

    // Clamp to radius
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > this.joystickRadius) {
      dx = (dx / distance) * this.joystickRadius;
      dy = (dy / distance) * this.joystickRadius;
    }

    // Update knob visual position
    this.joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;

    // Only send movement if we've committed to moving
    if (this.isMoving) {
      // Normalize to -1 to 1 range
      let normalX = dx / this.joystickRadius;
      let normalY = -dy / this.joystickRadius; // Invert Y for game coords (up = positive)

      // Apply deadzone
      if (Math.abs(normalX) < this.deadzone) normalX = 0;
      if (Math.abs(normalY) < this.deadzone) normalY = 0;

      // Send to InputManager
      this.inputManager.setTouchMoveInput(normalX, normalY);
    }
  }

  private onJoystickEnd(e: TouchEvent): void {
    e.preventDefault();
    if (!this.joystickTouch) return;

    const touch = this.findTouch(e.changedTouches, this.joystickTouch.id);
    if (touch || e.type === 'touchcancel') {
      // Cancel any pending long press
      this.cancelLongPress();

      if (this.isRepositioning) {
        // End repositioning - save position and remove visual feedback
        this.savePosition();
        this.joystickZone.classList.remove('repositioning');
      } else {
        // Check if this was a tap (fire) or drag (movement)
        // Use distance from TOUCH START, not joystick center
        const duration = Date.now() - this.joystickTouch.startTime;
        const dx = this.joystickTouch.currentX - this.joystickTouch.touchStartX;
        const dy = this.joystickTouch.currentY - this.joystickTouch.touchStartY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const wasTap = duration < TAP_MAX_DURATION && distance < TAP_MAX_DISTANCE;

        if (wasTap && e.type !== 'touchcancel') {
          // Fire once
          this.inputManager.triggerFire();
          // Visual feedback on both base and knob
          this.joystickBase.classList.add('firing');
          this.joystickKnob.classList.add('firing');
          setTimeout(() => {
            this.joystickBase.classList.remove('firing');
            this.joystickKnob.classList.remove('firing');
          }, 100);
        }
      }

      // Reset joystick
      this.joystickTouch = null;
      this.isMoving = false;
      this.isRepositioning = false;
      this.joystickKnob.style.transform = 'translate(0, 0)';
      this.inputManager.setTouchMoveInput(0, 0);
    }
  }

  // Aim handlers
  private onAimStart(e: TouchEvent): void {
    e.preventDefault();
    if (this.aimTouch) return; // Already tracking

    const touch = e.changedTouches[0];
    this.aimTouch = {
      id: touch.identifier,
      centerX: touch.clientX,
      centerY: touch.clientY,
      touchStartX: touch.clientX,
      touchStartY: touch.clientY,
      currentX: touch.clientX,
      currentY: touch.clientY,
      startTime: Date.now()
    };
    this.lastAimX = touch.clientX;
    this.lastAimY = touch.clientY;
  }

  private onAimMove(e: TouchEvent): void {
    e.preventDefault();
    if (!this.aimTouch) return;

    const touch = this.findTouch(e.changedTouches, this.aimTouch.id);
    if (!touch) return;

    // Update current position for tap detection
    this.aimTouch.currentX = touch.clientX;
    this.aimTouch.currentY = touch.clientY;

    // Calculate delta since last frame
    const deltaX = touch.clientX - this.lastAimX;
    const deltaY = touch.clientY - this.lastAimY;

    this.lastAimX = touch.clientX;
    this.lastAimY = touch.clientY;

    // Send aim delta to InputManager (accumulated like mouse)
    this.inputManager.setTouchAimDelta(deltaX, deltaY);
  }

  private onAimEnd(e: TouchEvent): void {
    e.preventDefault();
    if (!this.aimTouch) return;

    const touch = this.findTouch(e.changedTouches, this.aimTouch.id);
    if (touch || e.type === 'touchcancel') {
      // Check if this was a tap (fire) - quick touch without much movement
      const duration = Date.now() - this.aimTouch.startTime;
      const dx = this.aimTouch.currentX - this.aimTouch.touchStartX;
      const dy = this.aimTouch.currentY - this.aimTouch.touchStartY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const wasTap = duration < TAP_MAX_DURATION && distance < TAP_MAX_DISTANCE;

      if (wasTap && e.type !== 'touchcancel') {
        this.inputManager.triggerFire();
      }

      this.aimTouch = null;
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
    this.aimTouch = null;
    this.isMoving = false;
    this.joystickKnob.style.transform = 'translate(0, 0)';
    this.inputManager.setTouchMoveInput(0, 0);
  }

  isVisible(): boolean {
    return !this.touchControls.classList.contains('hidden');
  }
}
