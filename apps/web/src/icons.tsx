export function Icon({ name, className = '' }: { name: 'settings' | 'refresh' | 'logout' | 'chevron' | 'lock' | 'mail' | 'arrow' | 'install' | 'delivered' | 'eye' | 'cursor' | 'ban'; className?: string }) {
  const paths = {
    settings: <><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2" fill="white"/><circle cx="16" cy="12" r="2" fill="white"/><circle cx="10" cy="18" r="2" fill="white"/></>,
    refresh: <><path d="M4 8h15l-4-4m5 12H5l4 4M4 8v5m16 3v-5"/></>,
    logout: <><path d="M9 4H4v16h5m5-12 4 4-4 4m-5-4h12"/></>,
    chevron: <path d="m6 9 6 6 6-6"/>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
    install: <><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M12 6v8m-3-3 3 3 3-3m-4 4h2"/></>,
    delivered: <><path d="M21 11V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8M3 6l9 7 9-7m-6 12 3 3 5-6"/></>,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
    cursor: <><path d="m5 3 13 9-6 2-3 6-4-17Zm7 11 5 7"/></>,
    ban: <><circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/></>,
  };
  return <svg className={`icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
