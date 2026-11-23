import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useWardrobe } from '../../store/wardrobeStore';
import { cameraRef } from './cameraRef';

/** Переключает камеру по пресетам (изометрия / фронт / сверху). */
export function CameraRig() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null;
  const { preset, nonce } = useWardrobe((s) => s.camera);
  const w = useWardrobe((s) => s.wardrobe);

  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  useEffect(() => {
    const W = w.width / 1000;
    const H = w.height / 1000;
    const D = w.depth / 1000;
    const dist = Math.max(W, H) * 1.6 + D;
    const target: [number, number, number] = [0, H / 2, 0];
    const pos: [number, number, number] =
      preset === 'front' ? [0, H / 2, dist] : preset === 'top' ? [0, H / 2 + dist, 0.001] : [dist * 0.6, H * 0.75 + dist * 0.25, dist * 0.8];
    camera.position.set(...pos);
    camera.lookAt(...target);
    if (controls) {
      controls.target.set(...target);
      controls.update();
    }
    // пересчитываем только при смене пресета
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, nonce, controls]);

  return null;
}
