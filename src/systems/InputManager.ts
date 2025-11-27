// WebKit compatibility for pointer lock
const getPointerLockElement = (): Element | null => {
  const doc = document as Document & { webkitPointerLockElement?: Element };
  return document.pointerLockElement || doc.webkitPointerLockElement || null;
};

export class InputManager {
  private keys: Set<string> = new Set();
  private mouseMovement = { x: 0, y: 0 };
  private mouseButtons: Set<number> = new Set();
  private fireQueue: number = 0;  // Number of shots queued

  // Cached movement flags (avoid Set.has lookups every frame)
  private moveLeft = false;
  private moveRight = false;
  private moveUp = false;
  private moveDown = false;

  // Mobile/touch support
  private _isMobile: boolean;
  private _useExternalInput = false;  // True when mouse/keyboard detected on mobile
  private touchMoveInput = { x: 0, y: 0 };
  private touchAimDelta = { x: 0, y: 0 };

  constructor() {
    // Detect mobile device
    this._isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      || ('ontouchstart' in window)
      || (navigator.maxTouchPoints > 0);
    // Keyboard events
    document.addEventListener('keydown', (e) => this.onKeyDown(e));
    document.addEventListener('keyup', (e) => this.onKeyUp(e));

    // Mouse events
    document.addEventListener('mousemove', (e) => this.onMouseMove(e));
    document.addEventListener('mousedown', (e) => this.onMouseDown(e));
    document.addEventListener('mouseup', (e) => this.onMouseUp(e));

    // Pointer lock change (with WebKit prefix)
    document.addEventListener('pointerlockchange', () => this.onPointerLockChange());
    document.addEventListener('webkitpointerlockchange', () => this.onPointerLockChange());

    // On mobile, detect external mouse/keyboard and allow switching to pointer lock mode
    if (this._isMobile) {
      document.addEventListener('mousemove', (e) => this.onExternalMouseDetected(e), { once: true });
    }
  }

  private onExternalMouseDetected(e: MouseEvent): void {
    // Only trigger if there's actual mouse movement (not a touch-simulated event)
    // Touch-simulated mouse events typically have zero movement values
    if (e.movementX !== 0 || e.movementY !== 0) {
      this._useExternalInput = true;
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    this.keys.add(e.code);
    // Update cached movement flags
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.moveLeft = true;
    else if (e.code === 'KeyD' || e.code === 'ArrowRight') this.moveRight = true;
    else if (e.code === 'KeyW' || e.code === 'ArrowUp') this.moveUp = true;
    else if (e.code === 'KeyS' || e.code === 'ArrowDown') this.moveDown = true;
    // Space bar to fire (when pointer locked)
    else if (e.code === 'Space' && getPointerLockElement()) {
      this.fireQueue = 1;
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keys.delete(e.code);
    // Update cached movement flags
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.moveLeft = false;
    else if (e.code === 'KeyD' || e.code === 'ArrowRight') this.moveRight = false;
    else if (e.code === 'KeyW' || e.code === 'ArrowUp') this.moveUp = false;
    else if (e.code === 'KeyS' || e.code === 'ArrowDown') this.moveDown = false;
  }

  private onMouseMove(e: MouseEvent): void {
    if (getPointerLockElement()) {
      this.mouseMovement.x += e.movementX;
      this.mouseMovement.y += e.movementY;
    }
  }

  private onMouseDown(e: MouseEvent): void {
    this.mouseButtons.add(e.button);
    // Trigger single shot on click
    if (e.button === 0 && getPointerLockElement()) {
      this.fireQueue = 1;
    }
  }

  private onMouseUp(e: MouseEvent): void {
    this.mouseButtons.delete(e.button);
  }

  private onPointerLockChange(): void {
    if (!getPointerLockElement()) {
      // Reset state when pointer lock is lost
      this.keys.clear();
      this.mouseButtons.clear();
      this.fireQueue = 0;
      // Reset cached movement flags
      this.moveLeft = false;
      this.moveRight = false;
      this.moveUp = false;
      this.moveDown = false;
    }
  }

  update(): void {
    // Called each frame - reset accumulated mouse movement after it's been read
  }

  // Input queries
  isKeyPressed(code: string): boolean {
    return this.keys.has(code);
  }

  // Check if fire is pending (does NOT consume)
  isFiring(): boolean {
    return this.fireQueue > 0;
  }

  // Consume one shot from the queue (call after actually firing)
  consumeFire(): void {
    if (this.fireQueue > 0) {
      this.fireQueue--;
    }
  }

  // Trigger single shot (called by touch input and mouse)
  triggerFire(): void {
    this.fireQueue = 1;
  }

  getMoveInput(): { x: number; y: number } {
    // On mobile, use touch joystick input
    if (this._isMobile && (this.touchMoveInput.x !== 0 || this.touchMoveInput.y !== 0)) {
      return { x: this.touchMoveInput.x, y: this.touchMoveInput.y };
    }

    // Desktop keyboard input - use cached flags instead of Set.has()
    let x = 0;
    let y = 0;

    if (this.moveLeft) x -= 1;
    if (this.moveRight) x += 1;
    if (this.moveUp) y += 1;
    if (this.moveDown) y -= 1;

    return { x, y };
  }

  getMouseDelta(): { x: number; y: number } {
    // On mobile, use accumulated touch aim delta
    if (this._isMobile) {
      const delta = { x: this.touchAimDelta.x, y: this.touchAimDelta.y };
      // Reset after reading
      this.touchAimDelta.x = 0;
      this.touchAimDelta.y = 0;
      return delta;
    }

    // Desktop mouse delta
    const delta = { x: this.mouseMovement.x, y: this.mouseMovement.y };
    // Reset after reading
    this.mouseMovement.x = 0;
    this.mouseMovement.y = 0;
    return delta;
  }

  isPointerLocked(): boolean {
    return getPointerLockElement() !== null;
  }

  // Mobile detection
  isMobile(): boolean {
    return this._isMobile;
  }

  // External input detection (mouse/keyboard on mobile device)
  useExternalInput(): boolean {
    return this._useExternalInput;
  }

  // Touch input injection methods (called by TouchInputManager)
  setTouchMoveInput(x: number, y: number): void {
    this.touchMoveInput.x = x;
    this.touchMoveInput.y = y;
  }

  setTouchAimDelta(dx: number, dy: number): void {
    // Accumulate delta like mouse movement
    this.touchAimDelta.x += dx;
    this.touchAimDelta.y += dy;
  }
}
