'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, GitCompareArrows, Trash2 } from 'lucide-react';
import { Shell } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { loadScenarios, writeStored } from '@/lib/storage';
import type { SavedScenario } from '@/lib/types';
import { number } from '@/lib/utils';
import { useScenario } from '@/components/provider';
import { AIAnalysis } from '@/components/results';
import { aiComparisonEnabled, isMock } from '@/lib/api';
export default function Compare() {
  const [saved, setSaved] = useState<SavedScenario[]>([]);
  const [selection, setSelection] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [analysisPair, setAnalysisPair] = useState('');
  const { measures, districts } = useScenario();
  useEffect(() => {
    Promise.resolve().then(() => {
      const values = loadScenarios();
      setSaved(values);
      setSelection(values.slice(0, 2).map((v) => v.id));
      setLoaded(true);
    });
  }, []);
  const chosen = selection
    .map((id) => saved.find((s) => s.id === id))
    .filter((s): s is SavedScenario => !!s);
  return (
    <Shell>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ДВА ПЛАНА. ОСОЗНАННЫЙ ВЫБОР.</span>
          <h1>
            Какой город выберете вы<span className="heading-dot">?</span>
          </h1>
          <p>Сравните результаты, бюджет и распределение внимания между районами.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/simulator">
            Новый план
            <ArrowRight size={16} />
          </Link>
        </Button>
      </div>
      {error && (
        <p role="alert" className="global-alert">
          {error}
        </p>
      )}
      {!loaded ? (
        <div role="status" className="loading-state">
          Загружаем планы…
        </div>
      ) : saved.length === 0 ? (
        <div className="empty-state">
          <GitCompareArrows size={40} />
          <h2>Здесь встретятся ваши идеи</h2>
          <p>Сохраните сценарии на странице результатов, чтобы сравнить их рядом.</p>
          <Button asChild>
            <Link href="/simulator">Создать первый план</Link>
          </Button>
        </div>
      ) : (
        <>
          <section className="panel saved-list">
            <h2>
              Сохранённые сценарии <span className="count-badge">{saved.length}</span>
            </h2>
            <p className="muted">Выберите до двух планов. Они сохранены только в этом браузере.</p>
            {saved.map((s) => (
              <div className="saved-item" key={s.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={selection.includes(s.id)}
                    disabled={!selection.includes(s.id) && selection.length >= 2}
                    onChange={() =>
                      setSelection((v) =>
                        v.includes(s.id) ? v.filter((id) => id !== s.id) : [...v, s.id],
                      )
                    }
                  />
                  <span>
                    <strong>{s.name}</strong>
                    <small>
                      {new Date(s.savedAt).toLocaleString('ru-RU')} ·{' '}
                      {s.result.source === 'fixture' ? 'Демопример' : 'Расчёт API'}
                    </small>
                  </span>
                </label>
                <span>{s.result.after ? number(s.result.after.score) : '—'} балла</span>
                <button
                  aria-label={`Удалить план ${s.name}`}
                  onClick={() => {
                    const next = saved.filter((v) => v.id !== s.id);
                    if (writeStored('scenarios', next)) {
                      setSaved(next);
                      setSelection((v) => v.filter((id) => id !== s.id));
                    } else setError('Не удалось удалить план из хранилища.');
                  }}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
          </section>
          <div className="compare-grid">
            {chosen.map((s) => (
              <section className="panel comparison-card" key={s.id}>
                <span className="eyebrow">
                  {s.result.source === 'fixture' ? 'КОНТРОЛЬНЫЙ ПРИМЕР' : 'ВАШ СЦЕНАРИЙ'}
                </span>
                <h2>{s.name}</h2>
                <strong className="compare-score">
                  {s.result.after ? number(s.result.after.score) : '—'}
                  <small> / 100</small>
                </strong>
                <dl>
                  <div>
                    <dt>Инвестировано</dt>
                    <dd>{s.result.budget.spent} ед.</dd>
                  </div>
                  <div>
                    <dt>Слабейший район</dt>
                    <dd>
                      {districts.find((d) => d.id === s.result.after?.weakestDistrictId)?.name ??
                        '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>Критических показателей</dt>
                    <dd>{s.result.after?.criticalCount ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Версия модели</dt>
                    <dd>{s.result.modelVersion}</dd>
                  </div>
                </dl>
                <h3>Пять решений</h3>
                <ul className="compare-decisions">
                  {s.result.decisions.map((d) => {
                    const different =
                      chosen.length === 2 &&
                      !chosen
                        .find((x) => x.id !== s.id)
                        ?.result.decisions.some(
                          (v) => v.measureId === d.measureId && v.districtId === d.districtId,
                        );
                    return (
                      <li className={different ? 'different' : ''} key={d.measureId}>
                        <span>
                          {measures.find((m) => m.id === d.measureId)?.name ?? d.measureId}
                        </span>
                        <small>
                          {d.districtId
                            ? districts.find((x) => x.id === d.districtId)?.name
                            : 'Весь город'}
                          {different ? ' · Отличается' : ''}
                        </small>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            {chosen.length < 2 && (
              <div className="empty-state">
                <GitCompareArrows size={30} />
                <h3>Выберите {chosen.length === 0 ? 'планы' : 'второй план'} для сравнения</h3>
                <p>Сохраните новый сценарий на странице результатов.</p>
              </div>
            )}
          </div>
          {chosen.length === 2 &&
            chosen[0].result.modelVersion !== chosen[1].result.modelVersion && (
              <p role="alert" className="fixture-notice">
                Версии модели отличаются. Сравнение результатов требует учёта изменений датасета.
              </p>
            )}
          {chosen.length === 2 &&
            !isMock &&
            aiComparisonEnabled &&
            chosen.every((s) => s.result.source === 'backend') &&
            (analysisPair === selection.join('|') ? (
              <AIAnalysis
                key={analysisPair}
                original={chosen[0].result}
                result={chosen[1].result}
                title="AI-сравнение двух планов"
              />
            ) : (
              <Button variant="secondary" onClick={() => setAnalysisPair(selection.join('|'))}>
                Объяснить различия с AI
              </Button>
            ))}
        </>
      )}
    </Shell>
  );
}
