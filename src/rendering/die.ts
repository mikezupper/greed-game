import { CircleGeometry, Group, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, Quaternion, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { FACE_NORMALS } from '../physics/types.ts';

export const PIP_PATTERNS: Readonly<Record<number, readonly (readonly [number, number])[]>> = {
  1: [[0, 0]], 2: [[-1, 1], [1, -1]], 3: [[-1, 1], [0, 0], [1, -1]],
  4: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
  5: [[-1, -1], [-1, 1], [0, 0], [1, -1], [1, 1]],
  6: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]],
};
export function diceAssets() {
  const bodyGeometry = new RoundedBoxGeometry(1, 1, 1, 3, 0.07);
  const pipGeometry = new CircleGeometry(0.075, 16);
  const ivory = new MeshStandardMaterial({ color: '#eee5cd', roughness: 0.3 });
  const ink = new MeshStandardMaterial({ color: '#172b29', roughness: 0.7 });
  const instances: InstancedMesh[] = [];
  const make = (): Group => {
  const die = new Group(), body = new Mesh(bodyGeometry, ivory);
  body.castShadow = true; body.receiveShadow = true; die.add(body);
  const pips = new InstancedMesh(pipGeometry, ink, 21); let index = 0;
  instances.push(pips); die.add(pips);
  for (const { value, normal } of FACE_NORMALS) {
    const rotation = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), new Vector3(normal.x, normal.y, normal.z));
    for (const [x, y] of PIP_PATTERNS[value] ?? []) {
      const pip = new Object3D();
      pip.position.set(x * 0.24, y * 0.24, 0.502).applyQuaternion(rotation);
      pip.quaternion.copy(rotation); pip.updateMatrix(); pips.setMatrixAt(index++, pip.matrix);
    }
  }
  pips.instanceMatrix.needsUpdate = true;
  return die;
  };
  return { make, dispose: () => { instances.forEach(mesh => mesh.dispose()); bodyGeometry.dispose(); pipGeometry.dispose(); ivory.dispose(); ink.dispose(); } };
}
