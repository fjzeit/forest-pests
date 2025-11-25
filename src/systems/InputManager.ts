export class InputManager {
  private keys: Set<string> = new Set();
  private mouseMovement = { x: 0, y: 0 };
  private mouseButtons: Set<number> = new Set();
  private _isFiring: boolean = false;

  constructor() {
    // Keyboard events
    document.addEventListener('keydown', (e) => this.onKeyDown(e));
    document.addEventListener('keyup', (e) => this.onKeyUp(e));

    // Mouse events
    document.addEventListener('mousemove', (e) => this.onMouseMove(e));
    document.addEventListener('mousedown', (e) => this.onMouseDown(e));
    document.addEventListener('mouseup', (e) => this.onMouseUp(e));

    // Pointer lock change
    document.addEventListener('pointerlockchange', () => this.onPointerLockChange());
  }

  private onKeyDown(e: KeyboardEvent): void {
    this.keys.add(e.code);
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keys.delete(e.code);
  }

  private onMouseMove(e: MouseEvent): void {
    if (document.pointerLockElement) {
      this.mouseMovement.x += e.movementX;
      this.mouseMovement.y += e.movementY;
    }
  }

  private onMouseDown(e: MouseEvent): void {
    this.mouseButtons.add(e.button);
    if (e.button === 0) {
      this._isFiring = true;
    }
  }

  private onMouseUp(e: MouseEvent): void {
    this.mouseButtons.delete(e.button);
    if (e.button === 0) {
      this._isFiring = false;
    }
  }

  private onPointerLockChange(): void {
    if (!document.pointerLockElement) {
      // Reset state when pointer lock is lost
      this.keys.clear();
      this.mouseButtons.clear();
      this._isFiring = false;
    }
  }

  update(): void {
    // Called each frame - reset accumulated mouse movement after it's been read
  }

  // Input queries
  isKeyPressed(code: string): boolean {
    return this.keys.has(code);
  }

  isFiring(): boolean {
    return this._isFiring;  // Mouse click only - Space is used for menu
  }

  getMoveInput(): { x: number; y: number } {
    let x = 0;
    let y = 0;

    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;

    return { x, y };
  }

  getMouseDelta(): { x: number; y: number } {
    const delta = { x: this.mouseMovement.x, y: this.mouseMovement.y };
    // Reset after reading
    this.mouseMovement.x = 0;
    this.mouseMovement.y = 0;
    return delta;
  }

  isPointerLocked(): boolean {
    return document.pointerLockElement !== null;
  }
}
