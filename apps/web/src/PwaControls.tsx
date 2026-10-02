import { useEffect, useState } from 'react';
import { Icon } from './icons';
interface InstallEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> }

export function PwaControls() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [instructions, setInstructions] = useState(false);
  const [standalone, setStandalone] = useState(window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
  const [updating, setUpdating] = useState(false);
  useEffect(() => {
    const install = (event: Event) => { event.preventDefault(); setInstallEvent(event as InstallEvent); };
    const installed = () => { setStandalone(true); setInstallEvent(null); };
    window.addEventListener('beforeinstallprompt', install); window.addEventListener('appinstalled', installed);
    return () => { window.removeEventListener('beforeinstallprompt', install); window.removeEventListener('appinstalled', installed); };
  }, []);
  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    let disposed = false;
    let current: ServiceWorkerRegistration | null = null;
    let lastCheck = 0;
    const controllerChanged = () => { if (updating) window.location.reload(); };
    const check = () => {
      if (!document.hidden && current && Date.now() - lastCheck > 60_000) {
        lastCheck = Date.now(); void current.update().catch(() => { /* Offline: conservem els estàtics, no dades privades. */ });
      }
    };
    void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then((result) => {
      if (disposed) return;
      current = result; setRegistration(result);
      if (result.waiting) setWaiting(result.waiting);
      result.addEventListener('updatefound', () => {
        const worker = result.installing;
        worker?.addEventListener('statechange', () => {
          if (!disposed && worker.state === 'installed' && navigator.serviceWorker.controller) setWaiting(worker);
        });
      });
    }).catch(() => { /* Una fallada de SW no bloqueja l'app en línia. */ });
    document.addEventListener('visibilitychange', check); window.addEventListener('online', check);
    navigator.serviceWorker.addEventListener('controllerchange', controllerChanged);
    return () => {
      disposed = true; document.removeEventListener('visibilitychange', check); window.removeEventListener('online', check);
      navigator.serviceWorker.removeEventListener('controllerchange', controllerChanged);
    };
  }, [updating]);
  async function install() {
    if (installEvent) { await installEvent.prompt(); await installEvent.userChoice; setInstallEvent(null); }
    else setInstructions(!instructions);
  }
  return <aside className="pwa-controls" aria-label="Instal·lació i actualitzacions de l’app">
    {waiting && <div className="pwa-update" role="status"><span>Hi ha una versió nova de la MiniApp.</span>
      <button type="button" disabled={updating} onClick={() => {
        const worker = registration?.waiting ?? waiting;
        setUpdating(true);
        // El listener existeix abans de demanar l'activació; l'HTML es recarrega amb la nova cache.
        navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
        worker.postMessage({ type: 'SKIP_WAITING' });
      }}>{updating ? 'Actualitzant…' : 'Actualitza l’app'}</button>
    </div>}
    {!standalone && <><button className="quiet-button install-button" type="button" onClick={() => { void install(); }} aria-expanded={instructions}>
      <Icon name="install"/><span>{installEvent ? 'Instal·la l’app' : 'Instal·la al mòbil'}</span></button>
      {instructions && <p className="install-instructions">A l’iPhone, obre aquesta pàgina amb Safari, toca Compartir i «Afegeix a la pantalla d’inici». Si apareix «Obre com a app web», activa-ho i toca Afegeix. En altres navegadors, utilitza l’opció «Instal·la l’app» del menú.</p>}
    </>}
  </aside>;
}
