import { AmbientLight, BoxGeometry, Color, DirectionalLight, Group, Mesh, MeshStandardMaterial, PerspectiveCamera,
  Quaternion, Raycaster, Scene, Vector2, Vector3, WebGLRenderer } from 'three';
import { FACE_NORMALS, type Roll } from '../physics/types.ts';
import type { Die } from '../game/table.ts';
import { diceAssets } from './die.ts';

export interface TrayView { readonly roll: Roll | null; readonly kept: readonly Die[]; readonly selected: readonly number[] }
export class DiceTray extends HTMLElement {
  private renderer?: WebGLRenderer;
  private scene?: Scene;
  private camera?: PerspectiveCamera;
  private light?: DirectionalLight;
  private resize?: ResizeObserver;
  private dice = new Map<number, Group>();
  private view?: TrayView;
  private shown?: Roll | null;
  private started = 0;
  private progress = 0;
  private announced?: boolean;
  private materials: MeshStandardMaterial[] = [];
  private geometry: BoxGeometry[] = [];
  private assets?: ReturnType<typeof diceAssets>;
  private reduce = matchMedia('(prefers-reduced-motion: reduce)');
  private onMotion = () => { this.progress = 1; this.draw(); };
  get snapshot(): TrayView | undefined { return this.view; }
  set snapshot(view: TrayView | undefined) {
    const previous = this.view;
    this.view = view;
    if (!this.isConnected) return;
    if (this.renderer && previous?.roll === view?.roll && previous?.kept === view?.kept && previous?.selected === view?.selected) return;
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
    if (this.renderer) return;
    try {
      this.scene = new Scene(); this.scene.background = new Color('#183b34');
      this.camera = new PerspectiveCamera(35, 1, 0.1, 100); this.camera.position.set(0, 10.8, 11.8); this.camera.lookAt(0, 0, 0);
      this.renderer = new WebGLRenderer({ antialias: true, alpha: false });
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); this.renderer.shadowMap.enabled = true;
      this.renderer.domElement.setAttribute('aria-hidden', 'true'); this.append(this.renderer.domElement);
      this.scene.add(new AmbientLight('#fff1d5', 2));
      const light = new DirectionalLight('#fff2d6', 4); light.position.set(-3, 9, 5); light.castShadow = true;
      this.light = light;
      light.shadow.mapSize.set(1024, 1024); Object.assign(light.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7 }); this.scene.add(light);
      const box = (x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string) => {
        const geo = new BoxGeometry(sx, sy, sz), mat = new MeshStandardMaterial({ color, roughness: 0.9 });
        const mesh = new Mesh(geo, mat); mesh.position.set(x, y, z); mesh.receiveShadow = true; this.scene?.add(mesh);
        this.materials.push(mat); this.geometry.push(geo);
      };
      box(0, -0.2, 0, 10.4, 0.4, 7.4, '#255046');
      box(0, -0.2, -4.4, 10.4, 0.4, 1.3, '#795239');
      box(-5, 0.25, 0, 0.4, 0.9, 7.4, '#795239'); box(5, 0.25, 0, 0.4, 0.9, 7.4, '#795239');
      box(0, 0.25, -3.5, 10.4, 0.9, 0.4, '#795239'); box(0, 0.25, 3.5, 10.4, 0.9, 0.4, '#795239');
      this.assets = diceAssets();
      for (let id = 0; id < 6; id++) { const die = this.assets.make(); die.position.set((id % 3 - 1) * 1.8, 0.5, (Math.floor(id / 3) - 0.5) * 1.8); die.userData['id'] = id; this.dice.set(id, die); this.scene.add(die); }
      this.resize = new ResizeObserver(entries => {
        const rect = entries[0]?.contentRect;
        if (!rect || !this.renderer || !this.camera || rect.width === 0) return;
        this.camera.aspect = rect.width / rect.height; this.camera.zoom = Math.min(1, this.camera.aspect / 1.6);
        this.camera.updateProjectionMatrix(); this.renderer.setSize(rect.width, rect.height, false); this.draw();
      });
      this.resize.observe(this); this.reduce.addEventListener('change', this.onMotion);
      this.renderer.domElement.addEventListener('click', this.pick);
      this.renderer.setAnimationLoop(() => {
        const roll = this.view?.roll;
        if (!roll || this.progress >= 1) return;
        this.progress = Math.min(1, (performance.now() - this.started) / Math.min(4000, roll.steps * roll.dt * 1000)); this.draw();
      });
      this.draw();
      this.snapshot = this.view;
    } catch {
      this.dispose(); this.textContent = 'The 3D tray is unavailable. Use the dice buttons below to play.';
      this.progress = 1; this.dispatchEvent(new CustomEvent('dice-playback', { detail: false, bubbles: true }));
    }
  }
  private pick = (event: MouseEvent) => {
    if (!this.camera || !this.renderer) return;
    const rect = this.renderer.domElement.getBoundingClientRect(), ray = new Raycaster();
    ray.setFromCamera(new Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), this.camera);
    const hit = ray.intersectObjects([...this.dice.values()], true)[0];
    let object = hit?.object;
    while (object && object.userData['id'] === undefined) object = object.parent ?? undefined;
    if (object) this.dispatchEvent(new CustomEvent('dice-pick', { detail: object.userData['id'], bubbles: true }));
  };
  private draw(): void {
    const roll = this.view?.roll;
    const rolling = new Set(roll?.dice.map(d => d.id));
    for (const [id, die] of this.dice) if (!rolling.has(id)) {
      die.position.set((id % 3 - 1) * 1.8, 0.5, (Math.floor(id / 3) - 0.5) * 1.8); die.quaternion.identity();
    }
    if (!roll) {
      delete this.dataset['seed']; delete this.dataset['poses'];
      for (const [id, die] of this.dice) { die.position.set((id % 3 - 1) * 1.8, 0.5, (Math.floor(id / 3) - 0.5) * 1.8); die.quaternion.identity(); }
    }
    if (roll) {
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
    for (const [id, die] of this.dice) {
      const held = this.view?.kept.find(d => d.id === id);
      if (held) {
        die.position.set(-3.8 + id * 1.5, 0.5, -4.4);
        const normal = FACE_NORMALS.find(f => f.value === held.value)?.normal;
        if (normal) die.quaternion.setFromUnitVectors(new Vector3(normal.x, normal.y, normal.z), new Vector3(0, 1, 0));
      }
      const selected = this.view?.selected.includes(id) ?? false;
      die.scale.setScalar(selected ? 1.12 : 1);
    }
    if (this.renderer && this.scene && this.camera) this.renderer.render(this.scene, this.camera);
    if (this.renderer) this.dataset['drawCalls'] = String(this.renderer.info.render.calls);
    this.dataset['settled'] = String(this.progress >= 1);
    if (roll) {
      this.dataset['seed'] = String(roll.seed);
      this.dataset['poses'] = JSON.stringify([...this.dice].map(([id, die]) => ({ id, position: die.position.toArray(), rotation: die.quaternion.toArray() })));
    }
    const playing = !!roll && this.progress < 1;
    if (this.announced !== playing) {
      this.announced = playing; this.dispatchEvent(new CustomEvent('dice-playback', { detail: playing, bubbles: true }));
      if (!playing && roll) document.dispatchEvent(new CustomEvent('greed-roll-complete'));
    }
  }
  private dispose(): void {
    this.resize?.disconnect(); this.reduce.removeEventListener('change', this.onMotion);
    this.renderer?.setAnimationLoop(null); this.renderer?.domElement.removeEventListener('click', this.pick);
    this.light?.shadow.dispose(); this.light = undefined;
    this.renderer?.dispose(); this.renderer?.forceContextLoss(); this.renderer?.domElement.remove(); this.renderer = undefined;
    for (const geo of this.geometry) geo.dispose(); for (const mat of this.materials) mat.dispose();
    this.assets?.dispose(); this.assets = undefined;
    this.geometry = []; this.materials = []; this.dice.clear(); this.scene = undefined;
  }
  disconnectedCallback(): void { this.dispose(); }
}
if (!customElements.get('dice-tray')) customElements.define('dice-tray', DiceTray);
