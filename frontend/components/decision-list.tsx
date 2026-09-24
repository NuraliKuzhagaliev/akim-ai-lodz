'use client';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Check,
  FileCheck2,
  LoaderCircle,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { isMock } from '@/lib/api';
import { exampleDecisions } from '@/lib/fixtures';
import { useScenario } from './provider';
import { Button } from './ui/button';
export function DecisionList() {
  const { decisions, measures, districts, preview, change, busy, finalize } = useScenario();
  const router = useRouter();
  const spent = decisions.reduce(
    (n, d) => n + (measures.find((m) => m.id === d.measureId)?.cost ?? 0),
    0,
  );
  return (
    <aside className="plan-column">
      <section className="panel plan-panel">
        <div className="plan-heading">
          <span className="icon-box">
            <FileCheck2 size={21} />
          </span>
          <div>
            <h2>Ваш план</h2>
            <p>Большие перемены с малого</p>
          </div>
          <span className="count-badge">{decisions.length}/5</span>
        </div>
        <ol className="decision-list">
          {Array.from({ length: 5 }, (_, index) => {
            const d = decisions[index];
            const m = measures.find((m) => m.id === d?.measureId);
            return (
              <li key={d?.measureId ?? `empty-${index}`} className={d ? 'filled' : 'empty'}>
                {d && m ? (
                  <>
                    <span className="slot-number">{String(index + 1).padStart(2, '0')}</span>
                    <div>
                      <strong>{m.name}</strong>
                      <small>
                        {d.districtId
                          ? districts.find((v) => v.id === d.districtId)?.name
                          : 'Весь город'}
                        <span>·</span>
                        {m.cost} ед.
                      </small>
                    </div>
                    <button
                      disabled={busy}
                      onClick={() => void change(decisions.filter((_, i) => i !== index))}
                      aria-label={`Удалить ${m.name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="slot-number">{String(index + 1).padStart(2, '0')}</span>
                    <div>
                      Добавьте инициативу<small>Выберите из каталога</small>
                    </div>
                    <Plus size={15} />
                  </>
                )}
              </li>
            );
          })}
        </ol>
        <div className="plan-total">
          <span>Общая стоимость</span>
          <strong>
            {spent}
            <small> / 100 ед.</small>
          </strong>
        </div>
        <div className="plan-rule">
          <Check size={15} />
          Не более 2 мер одного направления
        </div>
        {preview?.synergies.map((s) => (
          <div className="synergy-alert" key={s.measureIds.join('-')}>
            <Sparkles size={16} />
            <div>
              <strong>Синергия активна</strong>
              <p>{s.description}</p>
            </div>
          </div>
        ))}
        <Button
          className="finalize-button"
          disabled={
            busy ||
            decisions.length !== 5 ||
            spent > 100 ||
            preview?.validation.status === 'invalid' ||
            (isMock && !preview?.after)
          }
          onClick={async () => {
            if (await finalize()) router.push('/results');
          }}
        >
          {busy ? <LoaderCircle className="spin" size={17} /> : null}Рассчитать результат
          <ArrowRight size={17} />
        </Button>
        <p className="plan-hint" aria-live="polite">
          {decisions.length < 5
            ? `Добавьте ещё ${5 - decisions.length} ${5 - decisions.length === 1 ? 'решение' : 5 - decisions.length === 5 ? 'решений' : 'решения'}, чтобы завершить план`
            : isMock && !preview?.after
              ? 'Для собственного плана подключите расчётный API.'
              : 'План будет повторно проверен перед расчётом.'}
        </p>
        {decisions.length > 0 && (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => void change([])}>
            <RotateCcw size={13} />
            Очистить план
          </Button>
        )}
      </section>
      <section className="city-insight">
        <span className="insight-label">
          <span />
          ФОКУС ГОРОДА
        </span>
        <h3>
          Кого нельзя
          <br />
          оставить позади?
        </h3>
        <p>
          В Нуре школы и медицина находятся в критической зоне. Общий рост начинается с внимания к
          слабым районам.
        </p>
        <div className="insight-values">
          <div>
            <strong>
              38<span>/100</span>
            </strong>
            <small>Школы и детсады</small>
          </div>
          <div>
            <strong>
              35<span>/100</span>
            </strong>
            <small>Медпомощь</small>
          </div>
        </div>
        <small className="insight-source">Исходные показатели датасета</small>
      </section>
      <button
        className="example-button"
        disabled={busy}
        onClick={() => void change(exampleDecisions)}
      >
        <Sparkles size={17} />
        <span>
          <strong>Попробовать пример</strong>
          <small>План организаторов · 95 ед.</small>
        </span>
        <ArrowRight size={16} />
      </button>
      {isMock && (
        <p className="demo-note">
          Деморежим использует сохранённый контрольный ответ. Собственные планы проверяет только
          подключённый сервер.
        </p>
      )}
    </aside>
  );
}
