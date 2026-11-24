import { useEffect, useState } from 'react';
import { Editor } from './pages/Editor';
import { Projects } from './pages/Projects';
import { useWardrobe } from './store/wardrobeStore';

type Route = { page: 'projects' } | { page: 'editor'; id: string };

function parseHash(): Route {
  const m = window.location.hash.match(/^#\/editor\/([\w-]+)/);
  return m ? { page: 'editor', id: m[1] } : { page: 'projects' };
}

export function App() {
  const [route, setRoute] = useState<Route>(parseHash);
  const theme = useWardrobe((s) => s.theme);
  const lang = useWardrobe((s) => s.lang);

  useEffect(() => {
    const on = () => setRoute(parseHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return route.page === 'editor' ? <Editor key={route.id} id={route.id} /> : <Projects />;
}
