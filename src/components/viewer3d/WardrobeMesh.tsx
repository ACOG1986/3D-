import { Edges } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { memo, useMemo } from 'react';
import { computePanels } from '../../lib/geometry';
import { sameRef, useWardrobe } from '../../store/wardrobeStore';
import type { EntityRef, Panel, Wardrobe } from '../../types/wardrobe';
import { getHighlightMaterial, getThreeMaterial, unitBox, unitCylinder } from './materials3d';

const MM = 0.001;

interface PanelMeshProps {
  panel: Panel;
  offset: [number, number, number];
  selected: boolean;
  onSelect: (ref: EntityRef) => void;
  origin: [number, number, number];
}

const PanelMesh = memo(function PanelMesh({ panel: p, offset, selected, onSelect, origin }: PanelMeshProps) {
  const pos: [number, number, number] = [
    (p.x + p.sx / 2) * MM + origin[0] + offset[0],
    (p.y + p.sy / 2) * MM + origin[1] + offset[1],
    (p.z + p.sz / 2) * MM + origin[2] + offset[2],
  ];
  const handle = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(p.ref);
  };
  const material = selected ? getHighlightMaterial(p.material) : getThreeMaterial(p.material);

  if (p.name === 'rod' || p.name === 'pantograph') {
    const alongZ = p.axis === 'z';
    const len = alongZ ? p.sz : p.sx;
    return (
      <group position={pos} onClick={handle}>
        <mesh
          geometry={unitCylinder}
          material={material}
          rotation={alongZ ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2]}
          scale={[25 * MM, len * MM, 25 * MM]}
          castShadow
        />
        {p.name === 'pantograph' &&
          [-1, 1].map((s) => {
            const o = (s * len * MM) / 2 - s * 0.01;
            return (
              <mesh
                key={s}
                geometry={unitBox}
                material={material}
                position={alongZ ? [0, -0.06, o] : [o, -0.06, 0]}
                scale={[0.015, 0.14, 0.015]}
              />
            );
          })}
      </group>
    );
  }
  return (
    <mesh
      geometry={unitBox}
      material={material}
      position={pos}
      scale={[p.sx * MM, p.sy * MM, p.sz * MM]}
      onClick={handle}
      castShadow={!p.nonBoard}
      receiveShadow
    >
      {!p.nonBoard && <Edges color={selected ? '#2563eb' : '#3f3f46'} threshold={15} transparent opacity={selected ? 1 : 0.35} />}
    </mesh>
  );
});

function explodeOffset(p: Panel, w: Wardrobe): [number, number, number] {
  const k = 0.35;
  const cx = (p.x + p.sx / 2 - w.width / 2) * MM;
  const cy = (p.y + p.sy / 2 - w.height / 2) * MM;
  let dz = 0;
  if (p.group === 'facade') dz = 0.6;
  else if (p.group === 'drawer') dz = 0.35;
  else if (p.group === 'back') dz = -0.3;
  else if (p.ref.type === 'item') dz = 0.18;
  else if (p.group === 'plinth') dz = 0.1;
  let dx = cx * k;
  let dy = cy * k * 0.6;
  if (p.name === 'side') dx = Math.sign(cx) * 0.25;
  if (p.name === 'top') dy = 0.25;
  if (p.name === 'bottom' || p.group === 'plinth') dy = -0.15;
  return [dx, dy, dz];
}

export function WardrobeMesh() {
  const w = useWardrobe((s) => s.wardrobe);
  const explode = useWardrobe((s) => s.explode);
  const showDoors = useWardrobe((s) => s.showDoors);
  const selection = useWardrobe((s) => s.selection);
  const select = useWardrobe((s) => s.select);

  const panels = useMemo(() => computePanels(w), [w]);
  const origin: [number, number, number] = [(-w.width / 2) * MM, 0, (-w.depth / 2) * MM];
  const zero: [number, number, number] = [0, 0, 0];

  return (
    <group>
      {panels.map((p) => {
        if (!showDoors && p.group === 'facade') return null;
        const selected =
          sameRef(selection, p.ref) || (selection?.type === 'section' && p.ref.type === 'item' && p.ref.sectionId === selection.sectionId);
        return (
          <PanelMesh
            key={p.key}
            panel={p}
            origin={origin}
            offset={explode ? explodeOffset(p, w) : zero}
            selected={selected}
            onSelect={select}
          />
        );
      })}
    </group>
  );
}
