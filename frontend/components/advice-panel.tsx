'use client';
import { useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { api, isMock } from '@/lib/api';
import { useScenario } from './provider';
import { Button } from './ui/button';

export function AdvicePanel() {
  const { decisions, preview, measures, districts, change, busy } = useScenario();
  const [advice, setAdvice] = useState<Awaited<ReturnType<typeof api.advice>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  async function ask() {
    if (pending.current) return;
    pending.current = true;
    setLoading(true);
    setError('');
    setAdvice(null);
    try {
      setAdvice(await api.advice(decisions));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Советник временно недоступен.');
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }
  const current = advice?.base_scenario_id === preview?.scenarioId;
  return (
    <section className="panel advice-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">СОВЕТНИК ГОРОДА</span>
          <h2>С чего продолжить?</h2>
          <p className="muted small">
            AI предложит до трёх альтернатив. Допустимость каждого добавления проверяет сервер.
          </p>
        </div>
        <Button
          variant="secondary"
          disabled={isMock || busy || loading || decisions.length >= 5}
          onClick={() => void ask()}
        >
          <Sparkles size={18} />
          {loading ? 'Проверяем идеи…' : 'Получить совет'}
        </Button>
      </div>
      {decisions.length >= 5 && (
        <p className="muted small">
          План заполнен. На странице результатов можно найти улучшение одной заменой.
        </p>
      )}
      {isMock && (
        <p className="muted small">
          Советник доступен в режиме подключённого сервера с настроенным AI.
        </p>
      )}
      {error && (
        <p role="alert" className="critical-text">
          {error}
        </p>
      )}
      {advice && current && (
        <>
          <h3>{advice.priority}</h3>
          <p>{advice.reason}</p>
          <div className="replacement-actions">
            {advice.suggestions.map((s) => (
              <Button
                key={s.measure_id}
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  const added = await change([
                    ...decisions,
                    {
                      measureId: s.measure_id,
                      ...(s.district_id ? { districtId: s.district_id } : {}),
                    },
                  ]);
                  if (!added) setError('Сервер не подтвердил добавление. План не изменён.');
                }}
              >
                Добавить: {measures.find((m) => m.id === s.measure_id)?.name ?? s.measure_id} ·{' '}
                {s.district_id ? districts.find((d) => d.id === s.district_id)?.name : 'Весь город'}
              </Button>
            ))}
          </div>
          <p className="muted small">
            Это отдельные варианты, а не готовый набор. При добавлении решение проверяется повторно.
          </p>
        </>
      )}
    </section>
  );
}
