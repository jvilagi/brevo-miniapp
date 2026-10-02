import { smtpMetrics, type Quota, type SmtpMetrics } from '@brevo-miniapp/contracts';

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

// Mai deduir Free perquè el saldo prepagament arribi a zero.
export function normalizeQuota(account: unknown): Quota {
  const plans = object(account)?.['plan'];
  if (!Array.isArray(plans)) return { regime: 'unknown', available: null, dailyLimit: null };
  const emailPlans = plans.map(object).filter((plan) =>
    plan && ['free', 'payAsYouGo', 'subscription', 'reseller'].includes(String(plan['type'])));
  const prepaid = emailPlans.filter((plan) => plan?.['type'] === 'payAsYouGo');
  const otherActive = emailPlans.some((plan) => plan?.['type'] !== 'payAsYouGo' && count(plan?.['credits']) !== 0);
  const candidate = prepaid.length === 1 && !otherActive ? prepaid[0] : emailPlans.length === 1 ? emailPlans[0] : null;
  const available = count(candidate?.['credits']);
  if (candidate?.['creditsType'] === 'sendLimit' && available !== null) {
    if (candidate['type'] === 'payAsYouGo') return { regime: 'prepaid', available, dailyLimit: null };
    if (candidate['type'] === 'free') return { regime: 'free', available, dailyLimit: 300 };
  }
  return { regime: 'unknown', available: null, dailyLimit: null };
}

export function normalizeSmtpMetrics(report: unknown): SmtpMetrics {
  const source = object(report);
  return Object.fromEntries(smtpMetrics.map((metric) => [metric, count(source?.[metric])])) as SmtpMetrics;
}

export function sevenDayPeriod(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (name: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === name)?.value;
  const endDate = `${part('year')}-${part('month')}-${part('day')}`;
  const start = new Date(`${endDate}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 6);
  return { startDate: start.toISOString().slice(0, 10), endDate, timezone };
}
