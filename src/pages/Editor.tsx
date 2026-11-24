import { useEffect, useState } from 'react';
import { DrawingView } from '../components/drawing2d/DrawingView';
import { FrontEditor } from '../components/drawing2d/FrontEditor';
import { TopEditor } from '../components/drawing2d/TopEditor';
import { BottomPanel } from '../components/panels/BottomPanel';
import { DndHint } from '../components/onboarding/DndHint';
import { Tour } from '../components/onboarding/Tour';
import { tourSeen } from '../components/onboarding/tourStorage';
import { HotkeysDialog } from '../components/panels/HotkeysDialog';
import { LeftPanel } from '../components/panels/LeftPanel';
import { RightPanel } from '../components/panels/RightPanel';
import { TopBar } from '../components/panels/TopBar';
import { Scene } from '../components/viewer3d/Scene';
import { useT } from '../i18n/useT';
import { createWardrobe } from '../lib/geometry';
import { getProject, saveProject } from '../lib/projects';
import { findSelectedItem, useWardrobe, type ViewMode } from '../store/wardrobeStore';

function isTyping(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName);
}

function useHotkeys(onHelp: () => void) {
  useEffect(() => {
    const views: ViewMode[] = ['3d', 'front', 'top', 'drawing'];
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      const s = useWardrobe.getState();
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'z' && !e.shiftKey) {
        e.preventDefault();
        s.undo();
      } else if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) {
        e.preventDefault();
        s.redo();
      } else if (mod && k === 'd') {
        e.preventDefault();
        if (s.selection?.type === 'item') s.duplicateItem(s.selection.sectionId, s.selection.itemId);
      } else if (mod) {
        return;
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        s.removeSelected();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const found = findSelectedItem(s.wardrobe, s.selection);
        if (!found) return;
        e.preventDefault();
        const d = (e.key === 'ArrowUp' ? 10 : -10) * (e.shiftKey ? 10 : 1);
        s.updateItem(found.section.id, found.item.id, { y: found.item.y + d });
      } else if (['1', '2', '3', '4'].includes(e.key)) {
        s.setView(views[Number(e.key) - 1]);
      } else if (k === 'e') {
        s.toggle('explode');
      } else if (k === 'f') {
        s.toggle('showDoors');
      } else if (e.key === 'Escape') {
        s.select(null);
      } else if (e.key === '?') {
        onHelp();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onHelp]);
}

export function Editor({ id }: { id: string }) {
  const t = useT();
  const load = useWardrobe((s) => s.load);
  const view = useWardrobe((s) => s.view);
  const loadedId = useWardrobe((s) => s.wardrobe.id);
  const [help, setHelp] = useState(false);
  const [side, setSide] = useState<'left' | 'right' | null>(null);
  const [tour, setTour] = useState(false);

  useEffect(() => {
    let w = getProject(id);
    if (!w) {
      w = { ...createWardrobe('swing', t('proj.defaultName')), id };
      saveProject(w);
    }
    load(w);
    // загрузка один раз при открытии проекта
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, load]);

  useHotkeys(() => setHelp(true));

  // Первый визит в редактор — короткое знакомство
  const ready = loadedId === id;
  useEffect(() => {
    if (!ready || tourSeen()) return;
    const timer = setTimeout(() => setTour(true), 600);
    return () => clearTimeout(timer);
  }, [ready]);

  if (!ready) return null;

  return (
    <div className="flex h-full flex-col">
      <TopBar onHotkeys={() => setHelp(true)} onTour={() => setTour(true)} />
      <div className="relative grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[256px_minmax(0,1fr)_320px]">
        <div
          data-tour="catalog"
          className={`${side === 'left' ? 'absolute inset-y-0 left-0 z-20 w-72 shadow-2xl' : 'hidden'} min-h-0 lg:static lg:block lg:w-auto lg:shadow-none`}
        >
          <LeftPanel />
        </div>
        <main className="flex min-h-0 min-w-0 flex-col">
          <div className="relative min-h-0 flex-1" data-tour="scene">
            {view === '3d' && <Scene />}
            {(view === '3d' || view === 'front') && !tour && <DndHint />}
            {view === 'front' && <FrontEditor />}
            {view === 'top' && <TopEditor />}
            {view === 'drawing' && <DrawingView />}
            <div className="absolute bottom-3 left-3 flex gap-1 lg:hidden">
              <button
                type="button"
                className="chip"
                aria-expanded={side === 'left'}
                onClick={() => setSide(side === 'left' ? null : 'left')}
              >
                ☰ {t('left.fill')}
              </button>
              <button
                type="button"
                className="chip"
                aria-expanded={side === 'right'}
                onClick={() => setSide(side === 'right' ? null : 'right')}
              >
                ⚙ {t('right.title')}
              </button>
            </div>
          </div>
          <div data-tour="bottom">
            <BottomPanel />
          </div>
        </main>
        <div
          data-tour="props"
          className={`${side === 'right' ? 'absolute inset-y-0 right-0 z-20 w-80 shadow-2xl' : 'hidden'} min-h-0 lg:static lg:block lg:w-auto lg:shadow-none`}
        >
          <RightPanel />
        </div>
      </div>
      <HotkeysDialog open={help} onClose={() => setHelp(false)} />
      <Tour open={tour} onClose={() => setTour(false)} />
    </div>
  );
}
