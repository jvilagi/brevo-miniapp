export interface HealthResponse {
  status: 'ok';
  service: 'brevo-miniapp';
}

export interface ApiError {
  error: 'UNAUTHORIZED' | 'NOT_FOUND' | 'INTERNAL_ERROR' | 'BAD_REQUEST' | 'PAYLOAD_TOO_LARGE' | 'FORBIDDEN' | 'RATE_LIMITED' | 'AUTH_NOT_CONFIGURED' | 'CURRENT_PASSWORD_INCORRECT' | 'PASSWORD_CHANGE_UNAVAILABLE' | 'SETTINGS_CONFLICT' | 'BREVO_VALIDATION_FAILED';
}

export type Quota =
  | { regime: 'prepaid'; available: number; dailyLimit: null }
  | { regime: 'free'; available: number; dailyLimit: 300 }
  | { regime: 'subscription'; available: number; dailyLimit: null; prepaidAvailable: number | null }
  | { regime: 'unknown'; available: null; dailyLimit: null };

export const smtpMetrics = [
  'requests', 'delivered', 'opens', 'uniqueOpens', 'clicks', 'uniqueClicks',
  'hardBounces', 'softBounces', 'blocked', 'spamReports', 'invalid', 'unsubscribed',
] as const;

export type SmtpMetric = (typeof smtpMetrics)[number];
export type SmtpMetrics = Record<SmtpMetric, number | null>;

export interface ReportPeriod {
  startDate: string;
  endDate: string;
  timezone: string;
}

export interface DataSection<T> {
  status: 'fresh' | 'stale' | 'unavailable';
  updatedAt: string | null;
  data: T | null;
  error: 'BREVO_UNAVAILABLE' | null;
}

export interface DailyReport {
  days: Array<{ date: string; currentDay: boolean; metrics: SmtpMetrics; zeroFilled: SmtpMetric[] }>;
}

export interface AccountSnapshot {
  id: string;
  name: string;
  appearance?: Appearance;
  reference?: PlanReference;
  source: 'brevo';
  quota: DataSection<Quota>;
  smtp: {
    source: 'smtp';
    period: ReportPeriod;
    today: { period: ReportPeriod; report: DataSection<SmtpMetrics> };
    totals: DataSection<SmtpMetrics>;
    daily: DataSection<DailyReport>;
  };
  marketing: {
    source: 'marketing';
    period: ReportPeriod;
    // Nombre de campanyes retornades pel filtre de data d'enviament, no volum d'emails.
    campaigns: DataSection<{ count: number }>;
  };
}

export interface AccountsResponse { generatedAt: string; accounts: AccountSnapshot[] }
export interface SessionResponse { authenticated: boolean; configured: boolean }
export type AccountNames = Record<'1' | '2', string>;
export interface AccountSettings { names: AccountNames }

export const accountIcons = ['mail', 'home', 'work', 'school', 'heart', 'globe'] as const;
export const accountColors = ['green', 'purple', 'blue', 'teal', 'amber', 'rose'] as const;
export interface Appearance { icon: typeof accountIcons[number]; color: typeof accountColors[number] }
export interface PlanReference { kind: 'auto' | 'free' | 'prepaid' | 'subscription'; allowance: number | null; renewalDay: number | null }
export interface ManagedAccount {
  id: string; name: string; appearance: Appearance; reference: PlanReference;
  connected: boolean; lowBalance: number | null; lowPercent: number | null;
}
export interface EmailAlerts {
  enabled: boolean; recipient: string; senderAccountId: string; senderId: number | null;
  connectionErrors: boolean; repeatMinutes: number;
}
export interface AlertDelivery {
  id: string; accountId: string | null; at: string; kind: 'alert' | 'test'; channel: 'email' | 'push'; status: 'pending' | 'accepted' | 'rejected' | 'uncertain';
}
export interface WorkspaceSettings {
  revision: number; accounts: ManagedAccount[]; alerts: EmailAlerts; deliveries: AlertDelivery[]; deliveryEnabled: boolean;
  pushEnabled: boolean; pushDevices: Array<{ id: string; label: string; createdAt: string }>;
}
export interface SenderOption { id: number; name: string; email: string }
