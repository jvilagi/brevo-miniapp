import type { DataSection, PlanReference, Quota, SmtpMetric } from '@brevo-miniapp/contracts';

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
  if (quota?.regime === 'subscription') return { title: 'Emails del pla', badge: quota.prepaidAvailable !== null ? 'Pla + prepagament' : 'Subscripció', available: quota.available, fraction: null,
    source: declaredPlan === 'free' && quota.prepaidAvailable !== null ? 'Saldo retornat · no s’afegeix al prepagament' : 'Restants segons Brevo',
    note: quota.prepaidAvailable === null ? 'El saldo prepagament no està disponible a la resposta de Brevo; no se suposa que sigui zero.' :
      declaredPlan === 'free' ? 'Pla declarat Free: els crèdits prepagament substitueixen els 300 emails/dia. No són dos saldos disponibles alhora. Brevo ha de confirmar el retorn a Free.' :
        'Els saldos es mostren separats. En Free, el prepagament substitueix els 300 emails/dia; no s’hi afegeixen. Brevo determina quin saldo es consumeix.' };
  if (quota?.regime === 'prepaid') return { title: 'Crèdits disponibles', badge: 'Prepagament', available: quota.available, fraction: null,
    source: 'Saldo prepagament', note: declaredPlan === 'free' ? 'Pla declarat Free: el prepagament substitueix els 300 emails/dia. Brevo ha de confirmar el retorn a Free; un saldo zero no l’activa automàticament.' : 'Saldo prepagament segons Brevo. No s’hi afegeix cap quota diària.' };
  if (quota?.regime === 'free') return { title: 'Saldo disponible', badge: 'Free · 300/dia', available: quota.available,
    source: 'Segons Brevo · quota de 300/dia',
    note: 'Brevo gestiona el reinici diari. L’hora exacta no està verificada.',
    fraction: quota.available <= quota.dailyLimit ? quota.available / quota.dailyLimit : null };
  return { title: 'Saldo disponible', badge: 'Pla per confirmar', available: null, fraction: null,
    source: 'Segons el pla de Brevo', note: 'El règim de quota encara no es pot confirmar.' };
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
