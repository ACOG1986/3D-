import { Html, Line } from '@react-three/drei';
import { useState } from 'react';
import { useT } from '../../i18n/useT';
import { LIMITS } from '../../lib/geometry';
import { useWardrobe } from '../../store/wardrobeStore';
import { DimensionInput } from '../controls/DimensionInput';

const MM = 0.001;
type Dim = 'width' | 'height' | 'depth';

/** Габаритные размеры в 3D: клик по подписи — прямой ввод значения. */
export function DimensionLabels() {
  const w = useWardrobe((s) => s.wardrobe);
  const patch = useWardrobe((s) => s.patch);
  const show = useWardrobe((s) => s.showDims);
  const explode = useWardrobe((s) => s.explode);
  const t = useT();
  const [edit, setEdit] = useState<Dim | null>(null);
  if (!show || explode) return null;

  const W = w.width * MM;
  const H = w.height * MM;
  const D = w.depth * MM;
  const off = 0.08;
  const color = '#2563eb';

  const label = (dim: Dim, pos: [number, number, number]) => (
    <Html position={pos} center zIndexRange={[20, 0]}>
      {edit === dim ? (
        <div className="w-28 rounded-md bg-white p-1 shadow-lg dark:bg-slate-800">
          <DimensionInput
            label={t(`right.${dim}`)}
            hideLabel
            autoFocus
            value={w[dim]}
            min={LIMITS[dim].min}
            max={LIMITS[dim].max}
            unit={t('mm')}
            onCommit={(v) => {
              patch({ [dim]: Math.round(v) });
              setEdit(null);
            }}
            onCancel={() => setEdit(null)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEdit(dim)}
          aria-label={`${t(`right.${dim}`)}: ${w[dim]} ${t('mm')}`}
          className="whitespace-nowrap rounded bg-blue-600 px-1.5 py-0.5 text-xs font-medium text-white shadow hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
        >
          {w[dim]}
        </button>
      )}
    </Html>
  );

  const fz = D / 2 + off;
  return (
    <group>
      <Line
        points={[
          [-W / 2, H + off, fz],
          [W / 2, H + off, fz],
        ]}
        color={color}
        lineWidth={1}
      />
      {label('width', [0, H + off, fz])}
      <Line
        points={[
          [-W / 2 - off, 0, fz],
          [-W / 2 - off, H, fz],
        ]}
        color={color}
        lineWidth={1}
      />
      {label('height', [-W / 2 - off, H / 2, fz])}
      <Line
        points={[
          [W / 2 + off, 0, -D / 2],
          [W / 2 + off, 0, D / 2],
        ]}
        color={color}
        lineWidth={1}
      />
      {label('depth', [W / 2 + off, 0, 0])}
    </group>
  );
}
