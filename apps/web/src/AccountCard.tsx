import { useState } from 'react';
import { smtpMetrics, type AccountSnapshot, type DataSection } from '@brevo-miniapp/contracts';
import { Chart } from './Chart';
import { Icon } from './icons';
import { dateLabel, metricLabels, number, quotaPresentation, sectionStatus, updatedLabel, zoneLabel } from './presentation';

function Provenance({ section, timezone, locallyStale }: { section: DataSection<unknown>; timezone: string; locallyStale: boolean }) {
  const status = sectionStatus(section, locallyStale);
  return <span className={`provenance ${status ? 'is-warning' : ''}`}>
    {status && <span>{status} · </span>}{section.updatedAt ? `Actualitzat ${updatedLabel(section.updatedAt, timezone)}` : 'Sense actualització'}
  </span>;
}

export function AccountCard({ account, locallyStale }: { account: AccountSnapshot; locallyStale: boolean }) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<'today' | 'week'>('today');
  const { quota, smtp, marketing } = account;
  const info = quotaPresentation(quota.data);
  const timezone = smtp.period.timezone;
  const selected = period === 'today' ? smtp.today.report : smtp.totals;
  const detailsId = `account-${account.id}-details`;
  const dailyStatus = sectionStatus(smtp.daily, locallyStale);
  return <article className={`account-card account-${account.id}`} aria-labelledby={`account-${account.id}-name`}>
    <div className="account-heading">
      <div className="account-title"><span className="account-icon"><Icon name="mail"/></span><div>
        <span className="eyebrow">COMPTE {account.id}</span><h2 id={`account-${account.id}-name`}>{account.name}</h2>
      </div></div><span className={`plan-badge ${quota.data?.regime === 'unknown' || !quota.data ? 'is-unknown' : ''}`}>{info.badge}</span>
    </div>
    <div className="account-numbers">
      <div className="today-number"><span className="number-label">Sol·licituds avui</span><strong>{number(smtp.today.report.data?.requests)}</strong>
        <span className="number-source">Enviament transaccional</span><Provenance section={smtp.today.report} timezone={timezone} locallyStale={locallyStale}/>
      </div>
      <div className="balance-number"><span className="number-label">{info.title}</span><strong>{number(info.available)}</strong>
        <span className="number-source">{info.source}</span>
        <Provenance section={quota} timezone={timezone} locallyStale={locallyStale}/>
      </div>
    </div>
    {info.fraction !== null && <div className="quota-track" role="meter" aria-label="Saldo Free disponible segons Brevo" aria-valuemin={0} aria-valuemax={300} aria-valuenow={info.available!}>
      <span style={{ width: `${info.fraction * 100}%` }}/>
    </div>}
    <div className="account-note">{info.note}</div>
    <button type="button" className="expand-button" aria-expanded={open} aria-controls={detailsId} onClick={() => setOpen(!open)}>
      <span>{open ? 'Amaga les estadístiques' : 'Estadístiques i evolució'}</span><Icon name="chevron" className={open ? 'is-open' : ''}/>
    </button>
    {open && <div id={detailsId} className="account-details">
      <section aria-labelledby={`account-${account.id}-stats`}>
        <div className="section-heading"><h3 id={`account-${account.id}-stats`}>Activitat transaccional</h3></div>
        <div className="period-switch" role="group" aria-label={`Període d’estadístiques de ${account.name}`}>
          <button type="button" aria-pressed={period === 'today'} onClick={() => setPeriod('today')}>Avui</button>
          <button type="button" aria-pressed={period === 'week'} onClick={() => setPeriod('week')}>Últims 7 dies</button>
        </div>
        <p className="period-label">{period === 'today' ? `${dateLabel(smtp.period.endDate)} · dia en curs` : `${dateLabel(smtp.period.startDate, true)} — ${dateLabel(smtp.period.endDate, true)}`} · {zoneLabel(timezone)}</p>
        <Provenance section={selected} timezone={timezone} locallyStale={locallyStale}/>
        <dl className="stats-grid">{(['delivered', 'opens', 'clicks', 'blocked'] as const).map((metric) => <div key={metric} className={`metric-${metric}`}>
          <dt><Icon name={metric === 'delivered' ? 'delivered' : metric === 'opens' ? 'eye' : metric === 'clicks' ? 'cursor' : 'ban'}/>{metricLabels[metric]}</dt><dd>{number(selected.data?.[metric])}</dd>
        </div>)}</dl>
        <details className="more-metrics"><summary>Totes les mètriques</summary><dl className="metric-list">{smtpMetrics.map((metric) =>
          <div key={metric} className={`metric-${metric}`}><dt>{metricLabels[metric]}</dt><dd>{number(selected.data?.[metric])}</dd></div>)}</dl></details>
        <p className="helper">Font: informes SMTP de Brevo. Obertures i clics són esdeveniments, no persones. Els valors únics es llegeixen de l’agregat, no se sumen per dies.</p>
      </section>
      <div className="section-divider"/>
      {smtp.daily.data ? <><Provenance section={smtp.daily} timezone={timezone} locallyStale={locallyStale}/><Chart report={smtp.daily.data}/></> :
        <section className="empty-section"><h3>Últims 7 dies</h3><p>{dailyStatus ?? 'No disponible'}. No s’ha pogut obtenir la sèrie diària.</p></section>}
      <div className="marketing-note"><span className="eyebrow">MÀRQUETING · FONT SEPARADA</span>
        <p><strong>{number(marketing.campaigns.data?.count)}</strong> campanyes al filtre de dates dels set dies.</p>
        <Provenance section={marketing.campaigns} timezone={timezone} locallyStale={locallyStale}/>
        <p className="helper">És el nombre de campanyes, no d’emails. No està inclòs en les estadístiques SMTP.</p>
      </div>
      {quota.data?.regime === 'prepaid' && <p className="helper transition-note">Quan s’esgotin els crèdits, es tornarà a comprovar el pla. La quota Free de 300/dia només es mostrarà quan Brevo confirmi el règim.</p>}
    </div>}
  </article>;
}
