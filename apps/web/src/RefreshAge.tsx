import { useEffect, useState } from 'react';
import { elapsedLabel } from './presentation';

export function RefreshAge({ since }: { since: number | null }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const stop = () => { clearInterval(interval); interval = undefined; };
    const update = () => { if (!document.hidden) setNow(Date.now()); };
    const visibility = () => {
      stop();
      if (!document.hidden) { update(); interval = setInterval(update, 1000); }
    };
    visibility();
    document.addEventListener('visibilitychange', visibility); window.addEventListener('focus', update);
    return () => { stop(); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('focus', update); };
  }, [since]);
  return <span className="refresh-age" role="timer" aria-label="Temps des de l’última consulta correcta" aria-live="off" title="Temps des de l’última consulta correcta rebuda. No indica l’edat de cada dada de Brevo; consulta les seves dates d’actualització.">
    {since === null ? '—' : elapsedLabel(since, now)}
  </span>;
}
