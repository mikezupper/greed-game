import { type Group, type Mesh, PerspectiveCamera, Quaternion, Raycaster, Scene, Vector2, Vector3, WebGLRenderer } from 'three';
import { FACE_NORMALS, type Roll } from '../physics/types.ts';
import type { Die } from '../game/table.ts';
import { diceAssets } from './die.ts';
import { ARENA, tableScene } from './table-scene.ts';

/**
 * `dice` are the choosable dice of the current roll, `enabled` unlocks picking and `hints`
 * marks scoring dice. The tray only draws and reports picks; it never decides a score.
 */
export interface TrayView {
  readonly roll: Roll | null; readonly kept: readonly Die[]; readonly selected: readonly number[];
  readonly dice?: readonly Die[]; readonly enabled?: boolean; readonly hints?: readonly number[];
}
const FOV = 20, UP = new Vector3(0, 1, 0);
/** Dice that are not in play wait along the near rail, showing faces 1–6. */
const rest = (id: number) => new Vector3((id - 2.5) * 1.3, 0.5, 2.45);
/** Held dice keep canonical poses outside the arena; the page shows them on the HTML rail. */
const shelf = (id: number) => new Vector3(-3.8 + id * 1.5, 0.5, -4.4);
const faceUp = (value: number) => {
  const normal = FACE_NORMALS.find(f => f.value === value)?.normal ?? UP;
  return new Quaternion().setFromUnitVectors(new Vector3(normal.x, normal.y, normal.z), UP);
};
const ids = (list?: readonly number[]) => (list ?? []).join();
const faces = (list?: readonly Die[]) => (list ?? []).map(d => `${d.id}:${d.value}`).join();
const GRID: Readonly<Record<number, readonly number[]>> = { 1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

export class DiceTray extends HTMLElement {
  private renderer?: WebGLRenderer;
  private scene?: Scene;
  private camera?: PerspectiveCamera;
  private table?: ReturnType<typeof tableScene>;
  private resize?: ResizeObserver;
  private dice = new Map<number, Group>();
  private glows = new Map<number, Mesh>();
  private hits = new Map<number, HTMLButtonElement>();
  private view?: TrayView;
  private shown?: Roll | null;
  private started = 0;
  private progress = 0;
  private height = 12;
  private announced?: boolean;
  private assets?: ReturnType<typeof diceAssets>;
  private reduce = matchMedia('(prefers-reduced-motion: reduce)');
  private onMotion = () => { this.progress = 1; this.draw(); };
  get snapshot(): TrayView | undefined { return this.view; }
  set snapshot(view: TrayView | undefined) {
    const previous = this.view;
    this.view = view;
    if (!this.isConnected) return;
    if (this.renderer && previous?.roll === view?.roll && previous?.kept === view?.kept && ids(previous?.selected) === ids(view?.selected)
      && faces(previous?.dice) === faces(view?.dice) && previous?.enabled === view?.enabled && ids(previous?.hints) === ids(view?.hints)) return;
    if (view?.roll !== this.shown) {
      // Snapshot parsing creates new objects: roll seed + engine identifies playback.
      const fresh = view?.roll && (view.roll.seed !== this.shown?.seed || view.roll.engine !== this.shown?.engine);
      this.shown = view?.roll;
      if (fresh) { this.started = performance.now(); this.progress = this.reduce.matches ? 1 : 0; this.announced = undefined; }
    }
    this.draw();
  }
  connectedCallback(): void {
    // Gyral can set this property before the lazily loaded element upgrades.
    if (Object.hasOwn(this, 'snapshot')) {
      const snapshot = this.snapshot;
      Reflect.deleteProperty(this, 'snapshot');
      this.snapshot = snapshot;
    }
    this.buildHits();
    if (this.renderer) return;
    try {
      this.scene = new Scene(); this.table = tableScene(this.scene); this.scene.background = this.table.background;
      this.camera = new PerspectiveCamera(FOV, 1, 0.1, 100);
      this.renderer = new WebGLRenderer({ antialias: true, alpha: false });
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); this.renderer.shadowMap.enabled = true;
      this.renderer.domElement.setAttribute('aria-hidden', 'true'); this.prepend(this.renderer.domElement);
      this.assets = diceAssets();
      for (let id = 0; id < 6; id++) {
        const die = this.assets.make(); die.position.copy(rest(id)); die.userData['id'] = id;
        this.dice.set(id, die); this.scene.add(die); this.glows.set(id, this.table.glow());
      }
      this.resize = new ResizeObserver(entries => {
        const rect = entries[0]?.contentRect;
        if (!rect || !this.renderer || rect.width === 0 || rect.height === 0) return;
        this.frame(rect.width, rect.height); this.renderer.setSize(rect.width, rect.height, false); this.draw();
      });
      this.resize.observe(this); this.reduce.addEventListener('change', this.onMotion);
      this.renderer.domElement.addEventListener('click', this.pick);
      this.renderer.setAnimationLoop(() => {
        const roll = this.view?.roll;
        if (!roll || this.progress >= 1) return;
        this.progress = Math.min(1, (performance.now() - this.started) / Math.min(4000, roll.steps * roll.dt * 1000)); this.draw();
      });
      this.classList.remove('flat');
      this.draw();
      this.snapshot = this.view;
    } catch {
      this.dispose(); this.classList.add('flat');
      this.progress = 1; this.draw();
    }
  }
  /** Look straight down so the arena is a rectangle that fills the canvas; turn it upright on tall screens. */
  private frame(width: number, height: number): void {
    if (!this.camera) return;
    const portrait = height > width * 1.05, tan = Math.tan(FOV / 2 * Math.PI / 180), aspect = width / height;
    const halfWide = portrait ? ARENA.halfZ : ARENA.halfX, halfTall = portrait ? ARENA.halfX : ARENA.halfZ;
    // Fit the arena at die-top height so dice against a wall stay fully visible.
    this.height = Math.max(halfTall / tan, halfWide / (tan * aspect)) + 1;
    this.camera.aspect = aspect; this.camera.position.set(0, this.height, 0);
    this.camera.up.set(portrait ? -1 : 0, 0, portrait ? 0 : -1); this.camera.lookAt(0, 0, 0); this.camera.updateProjectionMatrix();
    this.style.setProperty('--hit', `${Math.max(44, Math.round(height / (2 * (this.height - 0.5) * tan) * 1.2))}px`);
  }
  /** Real buttons over the dice: keyboard, screen readers and touch use the same controls as the pointer. */
  private buildHits(): void {
    if (this.hits.size) return;
    const group = document.createElement('div');
    group.className = 'dice-hits'; group.setAttribute('role', 'group'); group.setAttribute('aria-label', 'Dice on the table');
    for (let id = 0; id < 6; id++) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'die-button'; button.hidden = true; button.dataset['id'] = String(id);
      button.innerHTML = '<span class="pips" aria-hidden="true">' + '<i></i>'.repeat(9) + '</span><span class="visually-hidden"></span>';
      button.addEventListener('click', () => this.dispatchEvent(new CustomEvent('dice-pick', { detail: id, bubbles: true })));
      this.hits.set(id, button); group.append(button);
    }
    this.append(group);
  }
  private pick = (event: MouseEvent) => {
    if (!this.camera || !this.renderer || !this.view?.enabled) return;
    const rect = this.renderer.domElement.getBoundingClientRect(), ray = new Raycaster();
    ray.setFromCamera(new Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), this.camera);
    const hit = ray.intersectObjects([...this.dice.values()], true)[0];
    let object = hit?.object;
    while (object && object.userData['id'] === undefined) object = object.parent ?? undefined;
    if (object) this.dispatchEvent(new CustomEvent('dice-pick', { detail: object.userData['id'], bubbles: true }));
  };
  private draw(): void {
    const view = this.view, roll = view?.roll, playing = !!roll && this.progress < 1;
    const rolling = new Set(roll?.dice.map(d => d.id)), held = new Map(view?.kept.map(d => [d.id, d.value]));
    for (const [id, die] of this.dice) if (!rolling.has(id)) { die.position.copy(rest(id)); die.quaternion.copy(faceUp(id + 1)); }
    if (!roll) { delete this.dataset['seed']; delete this.dataset['poses']; }
    else {
      const targetStep = this.progress * roll.steps;
      const index = Math.min(roll.frames.length - 1, Math.floor(targetStep / 3));
      const a = roll.frames[index], b = roll.frames[index + 1] ?? a;
      if (a && b) for (const pose of a.poses) {
        const die = this.dice.get(pose.id), next = b.poses.find(p => p.id === pose.id) ?? pose;
        const t = b.step === a.step ? 1 : Math.max(0, Math.min(1, (targetStep - a.step) / (b.step - a.step)));
        if (!die) continue;
        die.position.set(pose.position.x, pose.position.y, pose.position.z).lerp(new Vector3(next.position.x, next.position.y, next.position.z), t);
        die.quaternion.set(pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w).normalize()
          .slerp(new Quaternion(next.rotation.x, next.rotation.y, next.rotation.z, next.rotation.w).normalize(), t);
      }
    }
    const choosable = new Set(view?.dice?.filter(d => !held.has(d.id)).map(d => d.id));
    for (const [id, die] of this.dice) {
      const value = held.get(id);
      if (value !== undefined) { die.position.copy(shelf(id)); die.quaternion.copy(faceUp(value)); }
      die.visible = value === undefined;
    }
    this.dataset['settled'] = String(this.progress >= 1);
    if (roll) {
      this.dataset['seed'] = String(roll.seed);
      this.dataset['poses'] = JSON.stringify([...this.dice].map(([id, die]) => ({ id, position: die.position.toArray(), rotation: die.quaternion.toArray() })));
    }
    // Selection is local to this viewer, so it is drawn after the shared poses are reported.
    for (const [id, die] of this.dice) {
      const selected = !playing && choosable.has(id) && (view?.selected.includes(id) ?? false);
      const hinted = !playing && choosable.has(id) && (view?.hints?.includes(id) ?? false);
      const glow = this.glows.get(id);
      if (glow && this.table) {
        glow.visible = selected || hinted; glow.material = selected ? this.table.materials.selected : this.table.materials.hint;
        glow.position.set(die.position.x, 0.012, die.position.z);
      }
      die.scale.setScalar(selected ? 1.06 : 1); if (selected) die.position.y += 0.18;
    }
    if (this.renderer && this.scene && this.camera) this.renderer.render(this.scene, this.camera);
    if (this.renderer) this.dataset['drawCalls'] = String(this.renderer.info.render.calls);
    this.syncHits(playing, choosable);
    if (this.announced !== playing) {
      this.announced = playing; this.dispatchEvent(new CustomEvent('dice-playback', { detail: playing, bubbles: true }));
      if (!playing && roll) document.dispatchEvent(new CustomEvent('greed-roll-complete'));
    }
  }
  private syncHits(playing: boolean, choosable: ReadonlySet<number>): void {
    const flat = this.classList.contains('flat'), values = new Map(this.view?.dice?.map(d => [d.id, d.value]));
    for (const [id, button] of this.hits) {
      const value = values.get(id), die = this.dice.get(id);
      button.hidden = value === undefined || !choosable.has(id) || (playing && !flat);
      if (button.hidden || value === undefined) continue;
      button.disabled = !this.view?.enabled;
      button.setAttribute('aria-pressed', String(this.view?.selected.includes(id) ?? false));
      if (button.dataset['value'] !== String(value)) {
        button.dataset['value'] = String(value);
        const label = button.querySelector('.visually-hidden'); if (label) label.textContent = `Die showing ${value}`;
        button.querySelectorAll('i').forEach((pip, index) => pip.classList.toggle('on', GRID[value]?.includes(index) ?? false));
      }
      if (!flat && die && this.camera) {
        const point = die.position.clone().project(this.camera);
        button.style.insetInlineStart = `${(point.x + 1) * 50}%`; button.style.insetBlockStart = `${(1 - point.y) * 50}%`;
      }
    }
  }
  private dispose(): void {
    this.resize?.disconnect(); this.reduce.removeEventListener('change', this.onMotion);
    this.renderer?.setAnimationLoop(null); this.renderer?.domElement.removeEventListener('click', this.pick);
    this.renderer?.dispose(); this.renderer?.forceContextLoss(); this.renderer?.domElement.remove(); this.renderer = undefined;
    this.table?.dispose(); this.table = undefined;
    this.assets?.dispose(); this.assets = undefined;
    this.dice.clear(); this.glows.clear(); this.scene = undefined; this.camera = undefined;
  }
  disconnectedCallback(): void { this.dispose(); }
}
if (!customElements.get('dice-tray')) customElements.define('dice-tray', DiceTray);
