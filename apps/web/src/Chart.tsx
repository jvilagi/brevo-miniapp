import { useId, useState } from 'react';
import type { DailyReport, SmtpMetric } from '@brevo-miniapp/contracts';
import { chartPoints, dateLabel, metricLabels, number } from './presentation';

const metrics = ['requests', 'delivered', 'opens', 'clicks'] as const;
export function Chart({ report }: { report: DailyReport }) {
  const [metric, setMetric] = useState<SmtpMetric>('requests');
  const [selected, setSelected] = useState<string | null>(null);
  const id = useId();
  const points = chartPoints(report.days.map((day) => day.metrics[metric]));
  const activeIndex = report.days.findIndex((day) => day.date === selected);
  const index = activeIndex >= 0 ? activeIndex : report.days.length - 1;
  const day = report.days[index];
  let drawing = false;
  const path = points.map((point) => {
    if (!point) { drawing = false; return ''; }
    const command = drawing ? 'L' : 'M'; drawing = true;
    return `${command}${point.x},${point.y}`;
  }).join(' ');
  return <section className={`chart-section metric-${metric}`} aria-labelledby={`${id}-title`}>
    <div className="section-heading"><h3 id={`${id}-title`}>Últims 7 dies</h3><span className="tiny-pill">Avui, en curs</span></div>
    <label className="sr-only" htmlFor={`${id}-metric`}>Mètrica del gràfic</label>
    <select id={`${id}-metric`} value={metric} onChange={(event) => setMetric(event.target.value as SmtpMetric)}>
      {metrics.map((value) => <option key={value} value={value}>{metricLabels[value]}</option>)}
    </select>
    <div className="chart-readout" aria-live="polite"><span>{day ? dateLabel(day.date, true) : 'Sense dades'}{day?.currentDay ? ' · avui' : ''}</span><strong>{number(day?.metrics[metric])}</strong></div>
    <svg className="chart" viewBox="0 0 320 132" role="img" aria-labelledby={`${id}-graph-title`} onPointerDown={(event) => {
      const bounds = event.currentTarget.getBoundingClientRect();
      const x = (event.clientX - bounds.left) * 320 / bounds.width;
      const position = Math.max(0, Math.min(report.days.length - 1, Math.round((x - 22) / 276 * (report.days.length - 1))));
      const chosen = report.days[position]; if (chosen) setSelected(chosen.date);
    }}>
      <title id={`${id}-graph-title`}>{metricLabels[metric]} dels últims set dies. Selecciona un dia als botons de sota o consulta la taula.</title>
      {[20, 68, 116].map((y) => <line key={y} x1="22" x2="298" y1={y} y2={y} className="chart-grid"/>)}
      <path d={path} className="chart-line"/>
      {points.map((point, position) => point ? <g key={position}>
        {position === index && <line x1={point.x} x2={point.x} y1="12" y2="122" className="chart-selected"/>}
        <circle cx={point.x} cy={point.y} r={position === index ? 5.5 : 3.5} className={position === index ? 'chart-point active' : 'chart-point'}/>
      </g> : null)}
    </svg>
    <div className="chart-days" aria-label="Selecciona un dia del gràfic">
      {report.days.map((item, position) => <button type="button" key={item.date} aria-pressed={position === index} onClick={() => setSelected(item.date)}
        aria-label={`${dateLabel(item.date)}, ${metricLabels[metric]}: ${number(item.metrics[metric])}${item.currentDay ? ', dia en curs' : ''}`}>
        <span>{new Intl.DateTimeFormat('ca-ES', { weekday: 'narrow', timeZone: 'UTC' }).format(new Date(`${item.date}T12:00:00Z`))}</span>
        <span>{Number(item.date.slice(-2))}</span>
      </button>)}
    </div>
    <p className="helper">Toca el gràfic o un dia per veure’n el valor. Els buits són dades desconegudes, no zeros.</p>
    <details className="chart-table"><summary>Veure les dades en una taula</summary><table>
      <caption className="sr-only">{metricLabels[metric]} per dia</caption>
      <thead><tr><th scope="col">Dia</th><th scope="col">{metricLabels[metric]}</th></tr></thead>
      <tbody>{report.days.map((item) => <tr key={item.date}><th scope="row">{dateLabel(item.date, true)}{item.currentDay ? ' · en curs' : ''}</th>
        <td>{number(item.metrics[metric])}{item.zeroFilled.includes(metric) ? <span title="Zero completat després de reconciliar amb l’agregat"> *</span> : null}</td></tr>)}</tbody>
    </table><p className="helper">* Dia absent completat amb zero després de reconciliar els totals del període.</p></details>
  </section>;
}
