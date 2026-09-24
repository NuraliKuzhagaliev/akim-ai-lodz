'use client';
import { ArrowUpRight, CircleDollarSign, Layers3, TrendingUp } from 'lucide-react';
import { number } from '@/lib/utils';
import { useScenario } from './provider';
export function Metrics() {
  const { preview, decisions, measures } = useScenario();
  const spent = decisions.reduce(
    (v, d) => v + (measures.find((m) => m.id === d.measureId)?.cost ?? 0),
    0,
  );
  return (
    <section className="metrics-grid" aria-label="Показатели сценария">
      <div className="metric-card">
        <div className="metric-title">
          Бюджет города
          <CircleDollarSign size={18} />
        </div>
        <div className="metric-value">
          {100 - spent}
          <span>/ 100 ед.</span>
          <span className="metric-tag">Осталось</span>
        </div>
        <div className="progress-track">
          <span style={{ width: `${Math.min(spent, 100)}%` }} />
        </div>
        <small>Инвестировано {spent} условных единиц</small>
      </div>
      <div className="metric-card">
        <div className="metric-title">
          Принятые решения
          <Layers3 size={18} />
        </div>
        <div className="metric-value">
          {decisions.length}
          <span>/ 5 решений</span>
        </div>
        <div className="decision-dots" aria-label={`${decisions.length} из 5`}>
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className={i < decisions.length ? 'filled' : ''} />
          ))}
        </div>
        <small>
          {decisions.length === 5 ? 'План укомплектован' : 'Каждое решение меняет город'}
        </small>
      </div>
      <div className="metric-card score-metric">
        <div className="metric-title">
          Качество жизни
          <TrendingUp size={18} />
        </div>
        <div className="metric-value">
          {preview?.after ? number(preview.after.score) : '—'}
          <span>/ 100</span>
          {preview?.scoreDelta !== null &&
            preview?.scoreDelta !== undefined &&
            preview.scoreDelta > 0 && (
              <span className="metric-tag">
                <ArrowUpRight size={12} />+{number(preview.scoreDelta)}
              </span>
            )}
        </div>
        <p>
          {decisions.length === 0
            ? 'Исходный Astana Quality of Life Score'
            : preview?.after
              ? 'Предварительный Score · ещё не итог'
              : 'Прогноз появится после расчёта API'}
        </p>
        <small>
          {preview?.source === 'fixture'
            ? 'Данные контрольного примера'
            : 'Расчёт математической модели'}
        </small>
      </div>
    </section>
  );
}
