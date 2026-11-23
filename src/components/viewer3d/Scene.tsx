import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useRef, useState } from 'react';
import * as THREE from 'three';
import { useT } from '../../i18n/useT';
import { carcassDims, layoutSections } from '../../lib/geometry';
import { useWardrobe, type CameraPreset } from '../../store/wardrobeStore';
import { readDragKind, type DragKind } from '../panels/dragKinds';
import { cameraRef } from './cameraRef';
import { CameraRig } from './CameraRig';
import { DimensionLabels } from './DimensionLabels';
import { WardrobeMesh } from './WardrobeMesh';

/** Переводит точку экрана в координаты шкафа (мм) на плоскости задней стенки. */
function screenToWardrobe(clientX: number, clientY: number, el: HTMLElement): { x: number; y: number } | null {
  const cam = cameraRef.current;
  if (!cam) return null;
  const w = useWardrobe.getState().wardrobe;
  const r = el.getBoundingClientRect();
  const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, cam);
  const zMid = (carcassDims(w).bt + 100 - w.depth / 2) / 1000;
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -zMid);
  const hit = new THREE.Vector3();
  if (!ray.ray.intersectPlane(plane, hit)) return null;
  return { x: hit.x * 1000 + w.width / 2, y: hit.y * 1000 };
}

export function dropOnModel(kind: DragKind, xMm: number, yMm: number) {
  const st = useWardrobe.getState();
  const w = st.wardrobe;
  const d = carcassDims(w);
  const layout = layoutSections(w);
  const sec = layout.find((s) => xMm >= s.x - d.t && xMm <= s.x + s.width + d.t) ?? (xMm < w.width / 2 ? layout[0] : layout[layout.length - 1]);
  if (!sec) return;
  if (kind === 'section') {
    st.splitSection(sec.id);
    return;
  }
  st.addItem(sec.id, kind, yMm - d.innerBottom);
}

export function Scene() {
  const t = useT();
  const wrap = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const select = useWardrobe((s) => s.select);
  const setCamera = useWardrobe((s) => s.setCamera);
  const explode = useWardrobe((s) => s.explode);
  const showDoors = useWardrobe((s) => s.showDoors);
  const showDims = useWardrobe((s) => s.showDims);
  const toggle = useWardrobe((s) => s.toggle);
  const theme = useWardrobe((s) => s.theme);
  const preset = useWardrobe((s) => s.camera.preset);

  const presets: [CameraPreset, string][] = [
    ['iso', t('view.iso')],
    ['front', t('view.camFront')],
    ['top', t('view.camTop')],
  ];

  return (
    <div
      ref={wrap}
      className={`relative h-full w-full ${dragOver ? 'ring-4 ring-inset ring-blue-400' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const kind = readDragKind(e.dataTransfer);
        if (!kind || !wrap.current) return;
        const p = screenToWardrobe(e.clientX, e.clientY, wrap.current);
        if (p) dropOnModel(kind, p.x, p.y);
      }}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ fov: 35, near: 0.05, far: 100, position: [2.5, 2.2, 3.5] }}
        onPointerMissed={() => select(null)}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        aria-label="3D"
      >
        <color attach="background" args={[theme === 'dark' ? '#0f172a' : '#eef1f5']} />
        <ambientLight intensity={0.35} />
        <directionalLight
          position={[3, 5, 4]}
          intensity={1.6}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-4}
          shadow-camera-right={4}
          shadow-camera-top={4}
          shadow-camera-bottom={-1}
          shadow-bias={-0.0005}
        />
        <Environment resolution={128}>
          <Lightformer intensity={1.2} position={[0, 4, 3]} scale={[8, 2, 1]} />
          <Lightformer intensity={0.6} position={[-4, 2, 0]} rotation-y={Math.PI / 2} scale={[6, 3, 1]} />
          <Lightformer intensity={0.6} position={[4, 2, 0]} rotation-y={-Math.PI / 2} scale={[6, 3, 1]} />
          <Lightformer intensity={0.3} position={[0, 1, -4]} scale={[8, 3, 1]} color="#ffe9cf" />
        </Environment>
        <WardrobeMesh />
        <DimensionLabels />
        <ContactShadows position={[0, 0.0005, 0]} opacity={0.45} scale={8} blur={2.2} far={3} />
        <gridHelper args={[10, 100, theme === 'dark' ? '#334155' : '#cbd5e1', theme === 'dark' ? '#1e293b' : '#e2e8f0']} position={[0, 0, 0]} />
        <OrbitControls makeDefault enableDamping maxPolarAngle={Math.PI * 0.95} minDistance={0.5} maxDistance={15} />
        <CameraRig />
      </Canvas>

      <div className="absolute left-3 top-3 flex flex-wrap gap-1" role="toolbar" aria-label="3D">
        {presets.map(([p, label]) => (
          <button key={p} type="button" className={`chip ${preset === p ? 'chip-on' : ''}`} onClick={() => setCamera(p)}>
            {label}
          </button>
        ))}
      </div>
      <div className="absolute right-3 top-3 flex flex-wrap justify-end gap-1">
        <button type="button" aria-pressed={explode} className={`chip ${explode ? 'chip-on' : ''}`} onClick={() => toggle('explode')}>
          {t('view.explode')} <kbd className="kbd">E</kbd>
        </button>
        <button type="button" aria-pressed={showDoors} className={`chip ${showDoors ? 'chip-on' : ''}`} onClick={() => toggle('showDoors')}>
          {t('view.facades')} <kbd className="kbd">F</kbd>
        </button>
        <button type="button" aria-pressed={showDims} className={`chip ${showDims ? 'chip-on' : ''}`} onClick={() => toggle('showDims')}>
          {t('view.dims')}
        </button>
      </div>
      {dragOver && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 text-center">
          <span className="rounded bg-blue-600 px-3 py-1 text-sm text-white shadow">{t('view.dropHint')}</span>
        </div>
      )}
    </div>
  );
}
