import type { Camera } from 'three';

/** Камера сцены для расчёта точки сброса при drag & drop из HTML. */
export const cameraRef: { current: Camera | null } = { current: null };
