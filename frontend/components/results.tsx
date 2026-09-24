'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCheck,
  Download,
  FileText,
  LoaderCircle,
  Save,
  Sparkles,
  TriangleAlert,
  WandSparkles,
} from 'lucide-react';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { api, isMock } from '@/lib/api';
import { indicatorLabels } from '@/lib/labels';
import { saveScenario } from '@/lib/storage';
import { indicatorIds, type Analysis, type Simulation } from '@/lib/types';
import { number } from '@/lib/utils';
import { useScenario } from './provider';
import { Button } from './ui/button';
import { RecommendationPanel } from './recommendation-panel';
import { ExecutiveReport } from './executive-report';
import { downloadText } from '@/lib/download';
export function AIAnalysis({
  result,
  original,
  title = 'Разбор вашего плана',
}: {
  result: Simulation;
  original?: Simulation;
  title?: string;
}) {
  const { measures } = useScenario();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        setLoading(true);
        setError('');
        setAnalysis(null);
      }
    });
    void (original ? api.comparePlans(original, result) : api.analyze(result, measures))
      .then((a) => {
        if (active) setAnalysis(a);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'AI-анализ временно недоступен.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [result, original, attempt, measures]);
  return (
    <section className="panel ai-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">СМЫСЛ ЗА ЦИФРАМИ</span>
          <h2>
            <Sparkles size={21} />
            {title}
          </h2>
        </div>
        <span className="quiet-badge">
          {isMock || analysis?.source === 'template' ? 'Шаблон · не AI' : 'AI-аналитик'}
        </span>
      </div>
      {loading ? (
        <p className="loading-line" role="status">
          <LoaderCircle className="spin" size={18} />
          Подготавливаем объяснение…
        </p>
      ) : error ? (
        <div role="alert">
          <p>AI-анализ временно недоступен. Рассчитанные показатели сохранены.</p>
          <p className="muted">{error}</p>
          <Button variant="outline" onClick={() => setAttempt((v) => v + 1)}>
            Повторить AI-анализ
          </Button>
        </div>
      ) : (
        analysis && (
          <>
            {analysis.summary && <p className="analysis-summary">{analysis.summary}</p>}
            <div className="analysis-grid">
              {[
                {
                  key: 'strengths',
                  title: 'Сильные стороны',
                  values: analysis.strengths,
                  icon: CheckCheck,
                },
                { key: 'risks', title: 'Риски', values: analysis.risks, icon: TriangleAlert },
                {
                  key: 'tradeoffs',
                  title: 'Компромиссы',
                  values: analysis.tradeoffs,
                  icon: ArrowDownRight,
                },
                {
                  key: 'recommendations',
                  title: 'Рекомендации',
                  values: analysis.recommendations,
                  icon: WandSparkles,
                },
              ].map((block) => (
                <div key={block.title}>
                  <h3>
                    <block.icon size={17} />
                    {block.title}
                  </h3>
                  {block.values.length ? (
                    <ul>
                      {block.values.map((text, i) => (
                        <li key={i}>
                          {text}
                          {analysis.evidence?.[`${block.key}:${i}`]?.map((evidence, index) => (
                            <small className="finding-evidence" key={index}>
                              {evidence}
                            </small>
                          ))}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">Нет дополнительных замечаний.</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )
      )}
    </section>
  );
}
export function Results({ result }: { result: Simulation }) {
  const { measures, districts } = useScenario();
  const [districtId, setDistrictId] = useState(result.after?.weakestDistrictId ?? 'nura');
  const [name, setName] = useState('Мой план для Астаны');
  const [saveMessage, setSaveMessage] = useState('');
  const after = result.after;
  if (!after) return null;
  const beforeDistrict = result.before.districts.find((d) => d.id === districtId)!;
  const afterDistrict = after.districts.find((d) => d.id === districtId)!;
  const radar = indicatorIds.map((id) => ({
    id,
    before: beforeDistrict.indicators[id],
    after: afterDistrict.indicators[id],
  }));
  const weakest = after.districts.find((d) => d.id === after.weakestDistrictId)!;
  const criticals = after.districts.flatMap((d) =>
    indicatorIds
      .filter((id) => d.indicators[id] < 40)
      .map((id) => ({
        district: d.name,
        id,
        before: result.before.districts.find((x) => x.id === d.id)!.indicators[id],
        after: d.indicators[id],
      })),
  );
  const download = () => {
    downloadText('akim-ai-scenario.json', JSON.stringify(result, null, 2), 'application/json');
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">РЕШЕНИЯ СТАЛИ ИЗМЕНЕНИЯМИ</span>
          <h1>
            Город после вашего плана<span className="heading-dot">.</span>
          </h1>
          <p>Посмотрите, что удалось улучшить и кому ещё нужно внимание.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/simulator">
            Изменить решения
            <ArrowUpRight size={16} />
          </Link>
        </Button>
      </div>
      {result.source === 'fixture' && (
        <div className="fixture-notice">
          <FileText size={17} />
          <span>
            Демонстрация: сохранённый контрольный пример организаторов. Это не результат работы
            подключённого сервера.
          </span>
        </div>
      )}
      <section className="result-hero">
        <div>
          <span className="eyebrow">ASTANA QUALITY OF LIFE SCORE</span>
          <div className="score-comparison">
            <span>
              {number(result.before.score)}
              <small>До решений</small>
            </span>
            <ArrowRight size={30} />
            <strong>
              {number(after.score)}
              <small>После решений</small>
            </strong>
          </div>
          <span className="score-gain">
            <ArrowUpRight size={18} />
            {(result.scoreDelta ?? 0) >= 0 ? '+' : ''}
            {number(result.scoreDelta ?? 0)} балла к качеству жизни
          </span>
        </div>
        <div className="result-hero-stats">
          <div>
            <span>Инвестировано</span>
            <strong>
              {result.budget.spent}
              <small> / {result.budget.total} ед.</small>
            </strong>
          </div>
          <div>
            <span>Критических показателей</span>
            <strong>
              {result.before.criticalCount}
              <ArrowRight size={18} />
              {after.criticalCount}
            </strong>
          </div>
          <div>
            <span>Среднее по городу</span>
            <strong>
              {number(after.cityAverage)}
              <small> / 100</small>
            </strong>
          </div>
        </div>
      </section>
      <div className="results-two-columns">
        <section className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">БАЛАНС ИЗМЕНЕНИЙ</span>
              <h2>Профиль района</h2>
            </div>
            <select
              aria-label="Район для сравнения"
              value={districtId}
              onChange={(e) => setDistrictId(e.target.value as typeof districtId)}
            >
              {after.districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div
            className="radar-chart"
            role="img"
            aria-label={`Показатели района ${afterDistrict.name} до и после; точные значения в таблице ниже.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radar} outerRadius="72%">
                <PolarGrid stroke="#d8e4df" />
                <PolarAngleAxis dataKey="id" tick={{ fontSize: 12, fill: '#506960' }} />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  tick={{ fontSize: 10 }}
                  tickCount={3}
                />
                <Radar
                  name="До"
                  dataKey="before"
                  stroke="#a4b2ad"
                  fill="#a4b2ad"
                  fillOpacity={0.12}
                />
                <Radar
                  name="После"
                  dataKey="after"
                  stroke="#168467"
                  fill="#168467"
                  fillOpacity={0.23}
                />
                <Tooltip formatter={(value) => number(Number(value))} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-legend">
            <span className="before" />
            До решений
            <span />
            После решений
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <caption className="sr-only">Десять показателей района {afterDistrict.name}</caption>
              <thead>
                <tr>
                  <th>Показатель</th>
                  <th>До</th>
                  <th>После</th>
                  <th>Изменение</th>
                </tr>
              </thead>
              <tbody>
                {indicatorIds.map((id) => (
                  <tr key={id}>
                    <td>
                      <span className="table-code">{id}</span>
                      {indicatorLabels[id]}
                    </td>
                    <td>{number(beforeDistrict.indicators[id])}</td>
                    <td className={afterDistrict.indicators[id] < 40 ? 'critical-text' : ''}>
                      {number(afterDistrict.indicators[id])}
                    </td>
                    <td
                      className={
                        afterDistrict.indicators[id] - beforeDistrict.indicators[id] >= 0
                          ? 'positive-text'
                          : 'critical-text'
                      }
                    >
                      {afterDistrict.indicators[id] - beforeDistrict.indicators[id] > 0 ? '+' : ''}
                      {number(afterDistrict.indicators[id] - beforeDistrict.indicators[id])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <div className="result-side">
          <section className="panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">НИКОГО НЕ ОСТАВИТЬ ПОЗАДИ</span>
                <h2>Город — это все районы</h2>
              </div>
            </div>
            <div className="district-score-list">
              {after.districts.map((d) => (
                <div key={d.id}>
                  <strong>{d.name}</strong>
                  <span>
                    {number(result.before.districts.find((x) => x.id === d.id)!.score)}
                    <ArrowRight size={13} />
                    <b>{number(d.score)}</b>
                  </span>
                </div>
              ))}
            </div>
            <div className="equity-note">
              <TriangleAlert size={20} />
              <div>
                <strong>{weakest.name} всё ещё требует внимания</strong>
                <p>
                  Слабейший район: {number(weakest.score)} из 100. Общий рост не означает
                  равномерного улучшения.
                </p>
              </div>
            </div>
            {criticals.length ? (
              <div>
                <h3>Оставшиеся критические показатели</h3>
                {criticals.map((c) => (
                  <p key={`${c.district}-${c.id}`}>
                    {c.district} · {indicatorLabels[c.id]}: {number(c.before)} →{' '}
                    <strong>{number(c.after)}</strong>
                  </p>
                ))}
              </div>
            ) : (
              <p className="positive-text check-line">
                <CheckCheck size={17} />
                Показателей ниже 40 не осталось
              </p>
            )}
          </section>
          <section className="panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">ОТЛОЖЕННЫЙ ЭФФЕКТ</span>
                <h2>Когда начнутся изменения</h2>
              </div>
            </div>
            <div className="timeline-axis">
              <span>Старт</span>
              <span>4 кв.</span>
              <span>8 кв.</span>
            </div>
            {result.decisions.map((d) => {
              const m = measures.find((m) => m.id === d.measureId);
              return m ? (
                <div className="timeline-row" key={d.measureId}>
                  <div>
                    <strong>{m.id}</strong>
                    <span>{m.name}</span>
                    <small>Лаг {m.lag} кв.</small>
                  </div>
                  <div className="timeline-track">
                    <span
                      style={{
                        marginLeft: `${(m.lag / 8) * 100}%`,
                        width: `${((8 - m.lag) / 8) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ) : null;
            })}
            <p className="muted small">
              Визуализация задержек из каталога. Вклад в показатели возвращает расчётный модуль.
            </p>
          </section>
        </div>
      </div>
      <section className="panel contribution-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">ЧТО СТОИТ ЗА РЕЗУЛЬТАТОМ</span>
            <h2>Решения и их вклад</h2>
          </div>
        </div>
        <div className="contribution-grid">
          {result.decisions.map((d) => {
            const m = measures.find((m) => m.id === d.measureId);
            const c = result.contributions.find(
              (c) => c.measureId === d.measureId && c.districtId === d.districtId,
            );
            return (
              <div key={d.measureId}>
                <span className="quiet-badge">{d.measureId}</span>
                <h3>{m?.name ?? d.measureId}</h3>
                <p>
                  {d.districtId ? districts.find((x) => x.id === d.districtId)?.name : 'Весь город'}
                </p>
                <strong>
                  {c
                    ? `${c.scoreImpact > 0 ? '+' : ''}${number(c.scoreImpact)} балла`
                    : 'Вклад не предоставлен'}
                </strong>
              </div>
            );
          })}
        </div>
        {result.contributions.length === 0 && (
          <p className="muted small">
            Контрольный пример не содержит разложения вклада. Числа появятся в ответе backend;
            фронтенд их не оценивает.
          </p>
        )}
        {result.synergies.map((s) => (
          <div className="synergy-alert" key={s.measureIds.join('-')}>
            <Sparkles size={18} />
            <p>{s.description}</p>
          </div>
        ))}
      </section>
      <AIAnalysis result={result} />
      <ExecutiveReport result={result} />
      <RecommendationPanel
        key={JSON.stringify(result)}
        result={result}
        renderAnalysis={(suggested) => (
          <AIAnalysis result={suggested} title="Разбор предложенного плана" />
        )}
        renderComparison={(suggested) => (
          <AIAnalysis result={suggested} original={result} title="Почему замена меняет результат" />
        )}
      />
      <section className="panel result-save-section">
        <div>
          <h2>Сохраните свой сценарий</h2>
          <label className="field-label">
            Название плана
            <input maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="save-actions">
            <Button
              onClick={() =>
                setSaveMessage(
                  saveScenario(result, name)
                    ? 'План сохранён в этом браузере.'
                    : 'Не удалось сохранить план: хранилище браузера недоступно.',
                )
              }
            >
              <Save size={16} />
              Сохранить
            </Button>
            <Button variant="outline" onClick={download}>
              <Download size={16} />
              JSON
            </Button>
            <Button asChild variant="ghost">
              <Link href="/compare">
                Сравнить
                <ArrowRight size={15} />
              </Link>
            </Button>
          </div>
          {saveMessage && <p role="status">{saveMessage}</p>}
          <p className="muted small">
            До 12 планов в этом браузере. Это личная коллекция, не рейтинг команд.
          </p>
        </div>
      </section>
    </>
  );
}
