import { activeBalance, type DataSection, type PlanReference, type PrepaidForecast, type Quota, type SmtpMetric } from '@brevo-miniapp/contracts';

export const number = (value: number | null | undefined) => value === null || value === undefined ? '—' : new Intl.NumberFormat('ca-ES').format(value);
export function elapsedLabel(since: number, now: number) {
  const seconds = Math.max(0, Math.floor((now - since) / 1000));
  const days = Math.floor(seconds / 86400), hours = Math.floor(seconds / 3600) % 24;
  const minutes = Math.floor(seconds / 60) % 60, rest = seconds % 60;
  return `Fa ${days ? `${days} d ` : ''}${days || hours ? `${hours} h ` : ''}${days || hours || minutes ? `${minutes} min ` : ''}${rest} s`;
}
export const metricLabels: Record<SmtpMetric, string> = {
  requests: 'Sol·licituds d’enviament', delivered: 'Entregues', opens: 'Obertures totals', uniqueOpens: 'Obertures úniques reportades',
  clicks: 'Clics totals', uniqueClicks: 'Clics únics reportats', hardBounces: 'Rebots permanents', softBounces: 'Rebots temporals',
  blocked: 'Bloquejos', spamReports: 'Avisos de correu brossa', invalid: 'Adreces invàlides', unsubscribed: 'Baixes',
};
export function dateLabel(date: string, short = false) {
  return new Intl.DateTimeFormat('ca-ES', short ? { day: 'numeric', month: 'short', timeZone: 'UTC' } :
    { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
}
export function updatedLabel(value: string | null, timezone: string) {
  if (!value) return 'Sense dades disponibles';
  return new Intl.DateTimeFormat('ca-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: timezone }).format(new Date(value));
}
export function zoneLabel(timezone: string) {
  return new Intl.DateTimeFormat('ca-ES', { timeZone: timezone, timeZoneName: 'shortOffset' }).formatToParts(new Date())
    .find((part) => part.type === 'timeZoneName')?.value ?? timezone;
}
export function quotaPresentation(quota: Quota | null, declaredPlan: PlanReference['kind'] = 'auto') {
  const balance = activeBalance(quota, declaredPlan);
  if (balance.kind === 'prepaid') return { title: 'Saldo disponible', badge: balance.freePrepaid ? 'Free · prepagament' : 'Prepagament', available: balance.available, fraction: null,
    source: 'Crèdits prepagament segons Brevo', note: balance.freePrepaid ? 'El prepagament substitueix la quota Free; no s’hi suma.' : 'Crèdits prepagament; sense afegir-hi quota diària.' };
  if (quota?.regime === 'subscription') return { title: 'Saldo disponible', badge: quota.prepaidAvailable !== null ? 'Pla + prepagament' : 'Subscripció', available: quota.available, fraction: null,
    source: 'Emails del pla segons Brevo', note: declaredPlan === 'auto' && quota.prepaidAvailable !== null ? 'Si el teu pla és Free, indica-ho a Configuració.' : 'Saldo del pla; prepagament separat als detalls.' };
  if (quota?.regime === 'free') return { title: 'Saldo disponible', badge: 'Free · 300/dia', available: quota.available,
    source: 'Segons Brevo · quota de 300/dia',
    note: 'Brevo gestiona el reinici diari. L’hora exacta no està verificada.',
    fraction: quota.available <= quota.dailyLimit ? quota.available / quota.dailyLimit : null };
  return { title: 'Saldo disponible', badge: 'Pla per confirmar', available: null, fraction: null,
    source: 'Segons el pla de Brevo', note: 'El règim de quota encara no es pot confirmar.' };
}
export function forecastLabel(kind: ReturnType<typeof activeBalance>['kind'], forecast: PrepaidForecast | undefined, timezone: string, fresh: boolean) {
  if (kind === 'free') return 'No aplicable · quota diària';
  if (kind === 'subscription') return 'No aplicable · saldo del pla';
  if (kind !== 'prepaid' || !fresh) return 'No disponible';
  if (forecast?.status === 'estimated' && forecast.estimatedAt && Number.isFinite(Date.parse(forecast.estimatedAt))) {
    return new Intl.DateTimeFormat('ca-ES', { dateStyle: 'medium', timeZone: timezone }).format(new Date(forecast.estimatedAt));
  }
  if (forecast?.status === 'exhausted') return 'Crèdits esgotats';
  if (forecast?.status === 'unavailable') return 'No disponible';
  if (forecast?.status === 'no-consumption' || forecast?.status === 'out-of-range') return 'Sense previsió fiable';
  return 'Recollint historial · mínim 7 dies';
}
export function sectionStatus(section: DataSection<unknown>, locallyStale = false) {
  if (section.status === 'unavailable') return 'No disponible';
  if (section.status === 'stale' || locallyStale) return 'Dada antiga';
  return null;
}

// Buits = interrupcions; mai interpolar una mètrica desconeguda com a zero.
export function chartPoints(values: Array<number | null>, width = 320, height = 132) {
  const max = Math.max(1, ...values.filter((value): value is number => value !== null));
  return values.map((value, index) => value === null ? null : {
    x: 22 + index * ((width - 44) / Math.max(1, values.length - 1)),
    y: height - 16 - value / max * (height - 36), value,
  });
}
