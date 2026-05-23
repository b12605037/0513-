import { useState, useEffect } from 'react';
export function useDesktop() {
  const [is, setIs] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 768);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    setIs(mq.matches);
    const h = (e) => setIs(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return is;
}
