import type { DataSection, Quota, SmtpMetric } from '@brevo-miniapp/contracts';

export const number = (value: number | null | undefined) => value === null || value === undefined ? '—' : new Intl.NumberFormat('ca-ES').format(value);
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
export function quotaPresentation(quota: Quota | null) {
  if (quota?.regime === 'prepaid') return { title: 'Crèdits disponibles', badge: 'Prepagament', available: quota.available, fraction: null };
  if (quota?.regime === 'free') return { title: 'Disponibles avui', badge: 'Free · 300/dia', available: quota.available,
    fraction: quota.available <= quota.dailyLimit ? quota.available / quota.dailyLimit : null };
  return { title: 'Saldo disponible', badge: 'Pla per confirmar', available: null, fraction: null };
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
