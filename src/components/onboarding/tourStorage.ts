/** Флаг «тур уже показан» в localStorage (безопасно для приватного режима). */
const TOUR_KEY = 'wardrobe.tour.v1';

export function tourSeen(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === '1';
  } catch {
    return true;
  }
}

export function markSeen() {
  try {
    localStorage.setItem(TOUR_KEY, '1');
  } catch {
    /* приватный режим — не критично */
  }
}
