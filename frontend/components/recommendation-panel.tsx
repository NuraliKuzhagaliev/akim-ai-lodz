'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCheck, LoaderCircle, Save, Sparkles, WandSparkles } from 'lucide-react';
import { api, aiComparisonEnabled, isMock, recommendationsEnabled } from '@/lib/api';
import { saveScenario } from '@/lib/storage';
import { number } from '@/lib/utils';
import type { Decision, Simulation } from '@/lib/types';
import { useScenario } from './provider';
import { Button } from './ui/button';

const signed = (value: number) => `${value > 0 ? '+' : ''}${number(value)}`;
type SearchResult = Awaited<ReturnType<typeof api.recommend>>;

export function RecommendationPanel({
  result,
  renderAnalysis,
  renderComparison,
}: {
  result: Simulation;
  renderAnalysis: (result: Simulation) => ReactNode;
  renderComparison: (result: Simulation) => ReactNode;
}) {
  const router = useRouter();
  const { measures, districts, change, busy, error: scenarioError } = useScenario();
  const [search, setSearch] = useState<SearchResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [saved, setSaved] = useState('');
  const [applyFailed, setApplyFailed] = useState(false);
  const pending = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const disabled = isMock || !recommendationsEnabled || result.source !== 'backend';
  const replacement = search?.replacement;
  const recommendation = search?.recommendation;
  const describe = (decision: Decision) => ({
    name: measures.find((m) => m.id === decision.measureId)?.name ?? decision.measureId,
    area: decision.districtId
      ? districts.find((d) => d.id === decision.districtId)?.name
      : 'Весь город',
  });
  async function findReplacement() {
    if (pending.current || disabled) return;
    pending.current = true;
    setLoading(true);
    setError('');
    setSearch(null);
    setShowAnalysis(false);
    setShowComparison(false);
    setSaved('');
    setApplyFailed(false);
    try {
      const response = await api.recommend(result);
      if (active.current) setSearch(response);
    } catch (e) {
      if (active.current) setError(e instanceof Error ? e.message : 'Поиск временно недоступен.');
    } finally {
      pending.current = false;
      if (active.current) setLoading(false);
    }
  }
  async function applyReplacement() {
    if (!replacement || pending.current) return;
    pending.current = true;
    setApplyFailed(false);
    const applied = await change(replacement.decisions);
    // change clears the finalized result and unmounts this panel; successful navigation is intentional.
    if (applied) router.push('/simulator');
    else if (active.current) setApplyFailed(true);
    pending.current = false;
  }
  return (
    <section className="panel replacement-panel" aria-labelledby="replacement-heading">
      <div className="section-heading">
        <div>
          <span className="eyebrow">ОДИН ШАГ К ЛУЧШЕМУ ПЛАНУ</span>
          <h2 id="replacement-heading">Что изменит одна замена</h2>
          <p className="muted small">Сравните выгоду и компромиссы, прежде чем менять решения.</p>
        </div>
        <Button
          variant="secondary"
          disabled={disabled || loading || busy}
          onClick={() => void findReplacement()}
        >
          {loading ? <LoaderCircle className="spin" size={16} /> : <WandSparkles size={16} />}
          {loading ? 'Ищем замену…' : search ? 'Проверить ещё раз' : 'Улучшить одной заменой'}
        </Button>
      </div>
      {disabled && (
        <p className="muted small">
          Поиск замены доступен в режиме подключённого расчётного сервера.
        </p>
      )}
      {loading && (
        <p role="status" className="loading-line">
          Проверяем допустимые варианты. Исходный план остаётся на месте.
        </p>
      )}
      {error && (
        <p role="alert" className="critical-text">
          {error} Исходный план не изменён.
        </p>
      )}
      {recommendation && (
        <div role="status" className="replacement-status">
          <CheckCheck size={18} />
          <div>
            <strong>
              {recommendation.found
                ? 'Допустимая замена найдена'
                : 'Улучшение одной заменой не найдено'}
            </strong>
            <p>{recommendation.explanation}</p>
            <small>
              Проверено вариантов: {recommendation.candidatesChecked}; допустимых:{' '}
              {recommendation.validCandidates}. Поиск ограничен одной заменой.
            </small>
          </div>
        </div>
      )}
      {replacement && recommendation && (
        <>
          <div className="replacement-decisions">
            <div>
              <span className="eyebrow">УБИРАЕМ</span>
              <h3>
                {replacement.removed.measureId} · {describe(replacement.removed).name}
              </h3>
              <p>{describe(replacement.removed).area}</p>
            </div>
            <ArrowRight aria-hidden="true" size={24} />
            <div>
              <span className="eyebrow">ДОБАВЛЯЕМ</span>
              <h3>
                {replacement.added.measureId} · {describe(replacement.added).name}
              </h3>
              <p>{describe(replacement.added).area}</p>
            </div>
          </div>
          <div className="table-scroll">
            <table className="data-table replacement-table">
              <caption>Исходный план и предложенный вариант · итог через 8 кварталов</caption>
              <thead>
                <tr>
                  <th>Показатель</th>
                  <th>Исходный план</th>
                  <th>С заменой</th>
                  <th>Разница</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th>Качество жизни · Score</th>
                  <td>{number(result.after!.score)}</td>
                  <td>{number(replacement.result.after!.score)}</td>
                  <td className="positive-text">{signed(recommendation.scoreDelta!)} балла</td>
                </tr>
                <tr>
                  <th>Расход бюджета</th>
                  <td>{number(result.budget.spent)} ед.</td>
                  <td>{number(replacement.result.budget.spent)} ед.</td>
                  <td>{signed(recommendation.costDelta!)} ед.</td>
                </tr>
                <tr>
                  <th>Остаток бюджета</th>
                  <td>{number(result.budget.remaining)} ед.</td>
                  <td>{number(replacement.result.budget.remaining)} ед.</td>
                  <td>
                    {signed(replacement.result.budget.remaining - result.budget.remaining)} ед.
                  </td>
                </tr>
                <tr>
                  <th>Слабейший район</th>
                  <td>
                    {replacement.originalWeakest.name} · {number(replacement.originalWeakest.score)}
                  </td>
                  <td>
                    {replacement.suggestedWeakest.name} ·{' '}
                    {number(replacement.suggestedWeakest.score)}
                  </td>
                  <td
                    className={
                      recommendation.weakestScoreDelta! >= 0 ? 'positive-text' : 'critical-text'
                    }
                  >
                    {signed(recommendation.weakestScoreDelta!)} балла
                  </td>
                </tr>
                <tr>
                  <th>Критические показатели</th>
                  <td>{result.after!.criticalCount}</td>
                  <td>{replacement.result.after!.criticalCount}</td>
                  <td>
                    {signed(replacement.result.after!.criticalCount - result.after!.criticalCount)}
                  </td>
                </tr>
                {result.after!.districts.map((district) => {
                  const next = replacement.result.after!.districts.find(
                    (d) => d.id === district.id,
                  )!;
                  const delta = next.score - district.score;
                  return (
                    <tr key={district.id}>
                      <th>{district.name}</th>
                      <td>{number(district.score)}</td>
                      <td>{number(next.score)}</td>
                      <td
                        className={delta < 0 ? 'critical-text' : delta > 0 ? 'positive-text' : ''}
                      >
                        {signed(delta)} балла
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="muted small">
            Рост общего Score может сопровождаться ухудшением отдельных районов. Разница показана
            между итогами двух планов; все расчётные значения получены от сервера.
          </p>
          <div className="replacement-actions">
            <Button disabled={busy || loading} onClick={() => void applyReplacement()}>
              <ArrowRight size={16} />
              Применить замену и открыть план
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const ok = saveScenario(result, 'Исходный план перед заменой');
                setSaved(
                  ok
                    ? 'Исходный план сохранён в коллекции этого браузера.'
                    : 'Не удалось сохранить план: хранилище браузера недоступно.',
                );
              }}
            >
              <Save size={16} />
              Сохранить исходный
            </Button>
            <Button variant="ghost" disabled={showAnalysis} onClick={() => setShowAnalysis(true)}>
              <Sparkles size={16} />
              Разобрать предложенный план
            </Button>
            {aiComparisonEnabled && (
              <Button
                variant="outline"
                disabled={showComparison}
                onClick={() => setShowComparison(true)}
              >
                <Sparkles size={16} />
                Объяснить различия с AI
              </Button>
            )}
          </div>
          <p className="muted small">
            Применение повторно проверит пять решений на сервере и откроет редактор. Для нового
            итога нажмите «Рассчитать результат». Сохраните исходный план, чтобы вернуться к нему
            позже.
          </p>
          {saved && <p role="status">{saved}</p>}
          {applyFailed && (
            <p role="alert" className="critical-text">
              {scenarioError ?? 'Не удалось применить замену. Повторите попытку.'} Исходный план
              сохранён.
            </p>
          )}
          {showComparison && (
            <div className="replacement-analysis">{renderComparison(replacement.result)}</div>
          )}
          {showAnalysis && (
            <div className="replacement-analysis">
              <p className="muted small">
                AI разбирает предложенный план отдельно. Числовое сравнение с исходным — в таблице
                выше.{!aiComparisonEnabled && ' Совместный AI-разбор двух планов ещё не подключён.'}
              </p>
              {renderAnalysis(replacement.result)}
            </div>
          )}
        </>
      )}
    </section>
  );
}
