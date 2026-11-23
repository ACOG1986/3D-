import * as THREE from 'three';
import { getMaterial } from '../../lib/materials';

/** Процедурная текстура древесины (без внешних файлов). */
function woodTexture(base: string): THREE.CanvasTexture {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const col = new THREE.Color(base);
  let seed = col.getHex() % 9973;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed % 10000) / 10000;
  };
  for (let i = 0; i < 70; i++) {
    const x = rnd() * size;
    const dark = rnd() < 0.5;
    const shade = col.clone().offsetHSL(0, 0, dark ? -0.06 - rnd() * 0.06 : 0.03 + rnd() * 0.03);
    ctx.strokeStyle = `#${shade.getHexString()}`;
    ctx.globalAlpha = 0.25 + rnd() * 0.35;
    ctx.lineWidth = 0.5 + rnd() * 2;
    ctx.beginPath();
    let xx = x;
    ctx.moveTo(xx, 0);
    for (let y = 0; y <= size; y += 16) {
      xx += (rnd() - 0.5) * 3;
      ctx.lineTo(xx, y);
    }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const cache = new Map<string, THREE.Material>();

export function getThreeMaterial(id: string): THREE.Material {
  const hit = cache.get(id);
  if (hit) return hit;
  let m: THREE.Material;
  if (id === 'rod') {
    m = new THREE.MeshStandardMaterial({ color: '#c9ced3', metalness: 1, roughness: 0.25 });
  } else if (id === 'basket') {
    m = new THREE.MeshStandardMaterial({ color: '#9aa1a8', metalness: 0.9, roughness: 0.35, wireframe: true });
  } else {
    const mat = getMaterial(id);
    if (mat.kind === 'glass') {
      m = new THREE.MeshPhysicalMaterial({
        color: mat.color,
        roughness: mat.roughness,
        metalness: 0,
        transparent: true,
        opacity: mat.opacity ?? 0.5,
        transmission: 0.3,
        thickness: 4,
      });
    } else if (mat.kind === 'mirror') {
      m = new THREE.MeshPhysicalMaterial({ color: mat.color, roughness: mat.roughness, metalness: 1, envMapIntensity: 1.4 });
    } else {
      m = new THREE.MeshStandardMaterial({
        color: mat.grain ? '#ffffff' : mat.color,
        map: mat.grain ? woodTexture(mat.color) : null,
        roughness: mat.roughness,
        metalness: mat.metalness,
      });
    }
  }
  cache.set(id, m);
  return m;
}

const highlightCache = new Map<string, THREE.Material>();

/** Подсвеченная копия материала для выделенной детали. */
export function getHighlightMaterial(id: string): THREE.Material {
  const hit = highlightCache.get(id);
  if (hit) return hit;
  const base = getThreeMaterial(id).clone() as THREE.MeshStandardMaterial;
  base.emissive = new THREE.Color('#2563eb');
  base.emissiveIntensity = 0.35;
  highlightCache.set(id, base);
  return base;
}

export const unitBox = new THREE.BoxGeometry(1, 1, 1);
export const unitCylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
