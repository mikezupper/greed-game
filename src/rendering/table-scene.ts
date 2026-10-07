import { AmbientLight, CanvasTexture, CircleGeometry, Color, DirectionalLight, HemisphereLight, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, PlaneGeometry, RepeatWrapping, SRGBColorSpace, type Scene, type Texture } from 'three';

/** Physical arena inside the walls (see physics/simulate.ts): x ±4.8, z ±3.3. */
export const ARENA = { halfX: 4.8, halfZ: 3.3 } as const;

/** Renderer colors. These are scene inputs, not CSS tokens; they match the lamp-lit table palette. */
const FELT = '#1d5b43', LAMP = '#fff0d2', BRASS = '#e9b85a';

function canvasTexture(size: number, paint: (context: CanvasRenderingContext2D) => void): CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  if (context) paint(context);
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Deterministic fibre noise so every client draws the same cloth. */
function feltTexture(): Texture {
  const texture = canvasTexture(256, context => {
    const image = context.createImageData(256, 256);
    let seed = 0x2f6e2b1;
    for (let i = 0; i < image.data.length; i += 4) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const shade = 214 + (seed >>> 24) % 42;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = shade; image.data[i + 3] = 255;
    }
    context.putImageData(image, 0, 0);
  });
  texture.wrapS = texture.wrapT = RepeatWrapping; texture.repeat.set(9, 6);
  return texture;
}

function glowTexture(): Texture {
  return canvasTexture(128, context => {
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,255,255,1)'); gradient.addColorStop(0.45, 'rgba(255,255,255,0.55)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient; context.fillRect(0, 0, 128, 128);
  });
}

/** Felt, warm lamp light and the brass glows drawn under selected or scoring dice. */
export function tableScene(scene: Scene) {
  const textures = [feltTexture(), glowTexture()] as const;
  const feltGeometry = new PlaneGeometry(30, 30), glowGeometry = new CircleGeometry(0.95, 32);
  const felt = new MeshStandardMaterial({ color: FELT, map: textures[0], roughness: 1 });
  const selected = new MeshBasicMaterial({ color: BRASS, map: textures[1], transparent: true, opacity: 0.95, depthWrite: false });
  const hint = new MeshBasicMaterial({ color: BRASS, map: textures[1], transparent: true, opacity: 0.4, depthWrite: false });
  const cloth = new Mesh(feltGeometry, felt); cloth.rotation.x = -Math.PI / 2; cloth.receiveShadow = true; scene.add(cloth);
  scene.add(new HemisphereLight(LAMP, '#0b2018', 1.1), new AmbientLight(LAMP, 0.9));
  const lamp = new DirectionalLight(LAMP, 3.6); lamp.position.set(-2.4, 10, 3.2); lamp.castShadow = true;
  lamp.shadow.mapSize.set(1024, 1024); lamp.shadow.radius = 4;
  Object.assign(lamp.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7 }); scene.add(lamp);
  const glow = () => { const mesh = new Mesh(glowGeometry, hint); mesh.rotation.x = -Math.PI / 2; mesh.visible = false; scene.add(mesh); return mesh; };
  return {
    glow, materials: { selected, hint },
    background: new Color(FELT),
    dispose: () => {
      lamp.shadow.dispose(); feltGeometry.dispose(); glowGeometry.dispose();
      felt.dispose(); selected.dispose(); hint.dispose(); textures.forEach(texture => texture.dispose());
    },
  };
}
