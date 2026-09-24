'use client';
import { useEffect, useState } from 'react';
import {
  BusFront,
  Check,
  Clock3,
  Globe2,
  HeartPulse,
  Leaf,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Zap,
} from 'lucide-react';
import { api } from '@/lib/api';
import { categoryLabels, indicatorLabels } from '@/lib/labels';
import {
  categories,
  type Category,
  type DistrictId,
  type Measure,
  type Simulation,
} from '@/lib/types';
import { number } from '@/lib/utils';
import { useScenario } from './provider';
import { Button } from './ui/button';
import { Modal } from './ui/dialog';
export const categoryIcons = {
  transport: BusFront,
  ecology: Leaf,
  social: HeartPulse,
  safety: ShieldCheck,
  services: Zap,
};
function MeasureModal({
  measure,
  selected,
  onClose,
}: {
  measure: Measure;
  selected: DistrictId;
  onClose: () => void;
}) {
  const { districts, decisions, change, busy, measures } = useScenario();
  const [district, setDistrict] = useState<DistrictId>(selected);
  const [forecast, setForecast] = useState<Simulation | null>(null);
  const [forecastError, setForecastError] = useState('');
  const [pending, setPending] = useState(true);
  const candidate =
    measure.scope === 'city'
      ? { measureId: measure.id }
      : { measureId: measure.id, districtId: district };
  const spent = decisions.reduce(
    (v, d) => v + (measures.find((m) => m.id === d.measureId)?.cost ?? 0),
    0,
  );
  const budgetExceeded = spent + measure.cost > 100;
  const full = decisions.length >= 5;
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        setPending(true);
        setForecast(null);
        setForecastError('');
      }
    });
    const decision =
      measure.scope === 'city'
        ? { measureId: measure.id }
        : { measureId: measure.id, districtId: district };
    void api
      .simulate([...decisions, decision])
      .then((data) => {
        if (active) setForecast(data);
      })
      .catch((e) => {
        if (active) setForecastError(e instanceof Error ? e.message : 'Прогноз недоступен');
      })
      .finally(() => {
        if (active) setPending(false);
      });
    return () => {
      active = false;
    };
  }, [measure, district, decisions]);
  const invalid = forecast?.validation.status === 'invalid';
  return (
    <Modal
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title={measure.name}
      description={measure.description}
    >
      <div className="modal-meta">
        <span className={`category-pill ${measure.category}`}>
          {categoryLabels[measure.category]}
        </span>
        <span>{measure.cost} ед.</span>
        <span>Лаг {measure.lag} кв.</span>
      </div>
      {measure.scope === 'district' ? (
        <label className="field-label">
          Район реализации
          <select value={district} onChange={(e) => setDistrict(e.target.value as DistrictId)}>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div className="info-box">
          <Globe2 size={18} />
          Городская мера: эффект для всех пяти районов
        </div>
      )}
      <h3 className="modal-subtitle">Полный эффект из каталога</h3>
      <div className="effect-list">
        {Object.entries(measure.effects).map(([id, value]) => (
          <div key={id}>
            <span>{indicatorLabels[id as keyof typeof indicatorLabels]}</span>
            <strong className={value < 0 ? 'critical-text' : 'positive-text'}>
              {value > 0 ? '+' : ''}
              {value}
            </strong>
          </div>
        ))}
      </div>
      <p className="muted small">
        Эффект до учёта задержки. Горизонт симуляции — 8 кварталов. Итоговое влияние рассчитывает
        сервер.
      </p>
      {measure.notes.length > 0 && (
        <div className="measure-notes">
          {measure.notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
      )}
      <div className="forecast-box" aria-live="polite">
        <strong>
          <Sparkles size={16} />
          Прогноз сценария
        </strong>
        {pending ? (
          <p>Проверяем решение…</p>
        ) : forecastError ? (
          <p role="alert">{forecastError}</p>
        ) : invalid ? (
          <div role="alert">
            {forecast?.validation.errors.map((e) => (
              <p key={e.code}>{e.message}</p>
            ))}
          </div>
        ) : forecast?.after ? (
          <p>
            Score набора: <b>{number(forecast.after.score)}</b> ·{' '}
            {forecast.source === 'fixture' ? 'контрольный пример' : 'предварительный расчёт'}
          </p>
        ) : (
          <p>В деморежиме прогноз своего плана недоступен. Для него требуется расчётный API.</p>
        )}
      </div>
      {budgetExceeded && (
        <p role="alert" className="critical-text">
          Недостаточно бюджета: не хватает {spent + measure.cost - 100} ед.
        </p>
      )}
      {full && <p role="alert">Пять решений уже выбраны. Сначала удалите одно.</p>}
      <div className="modal-actions">
        <Button variant="outline" onClick={onClose}>
          Отмена
        </Button>
        <Button
          disabled={busy || pending || invalid || !!forecastError || budgetExceeded || full}
          onClick={async () => {
            if (await change([...decisions, candidate])) onClose();
          }}
        >
          <Plus size={16} />
          Добавить решение
        </Button>
      </div>
    </Modal>
  );
}
export function Catalog({ selected }: { selected: DistrictId }) {
  const { measures, decisions, busy } = useScenario();
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [query, setQuery] = useState('');
  const [opened, setOpened] = useState<Measure | null>(null);
  const filtered = measures.filter(
    (m) =>
      (category === 'all' || m.category === category) &&
      `${m.name} ${m.id} ${m.description}`
        .toLocaleLowerCase('ru')
        .includes(query.toLocaleLowerCase('ru')),
  );
  return (
    <section className="catalog">
      <div className="section-heading">
        <div>
          <span className="eyebrow">ОТ ИДЕИ К ИЗМЕНЕНИЯМ</span>
          <h2>
            Городские инициативы <span className="count-badge">14</span>
          </h2>
        </div>
        <span className="catalog-subtitle">
          <SlidersHorizontal size={15} />
          Выберите свой приоритет
        </span>
      </div>
      <div className="catalog-toolbar">
        <div className="category-tabs" role="group" aria-label="Фильтр по направлению">
          <button
            className={category === 'all' ? 'selected' : ''}
            onClick={() => setCategory('all')}
            aria-pressed={category === 'all'}
          >
            Все
          </button>
          {categories.map((c) => (
            <button
              key={c}
              className={category === c ? 'selected' : ''}
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
            >
              {categoryLabels[c]}
            </button>
          ))}
        </div>
        <label className="search-field">
          <Search size={17} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти инициативу"
            aria-label="Поиск инициатив"
          />
        </label>
      </div>
      <div className="measure-grid">
        {filtered.map((m) => {
          const Icon = categoryIcons[m.category];
          const chosen = decisions.some((d) => d.measureId === m.id);
          return (
            <article className={`measure-card ${chosen ? 'is-selected' : ''}`} key={m.id}>
              <div className="measure-top">
                <span className={`measure-icon ${m.category}`}>
                  <Icon size={22} />
                </span>
                <span className="measure-id">{m.id}</span>
                <span className="measure-cost">
                  {m.cost}
                  <small>ед.</small>
                </span>
              </div>
              <span className={`category-label ${m.category}`}>{categoryLabels[m.category]}</span>
              <h3>{m.name}</h3>
              <p>{m.description}</p>
              <div className="measure-scope">
                <span>
                  {m.scope === 'city' ? <Globe2 size={13} /> : <MapPin size={13} />}{' '}
                  {m.scope === 'city' ? 'Весь город' : 'Один район'}
                </span>
                <span>
                  <Clock3 size={13} />
                  {m.lag} кв.
                </span>
              </div>
              <div className="measure-bottom">
                <div className="effect-chips">
                  {Object.entries(m.effects)
                    .slice(0, 3)
                    .map(([id, v]) => (
                      <span
                        key={id}
                        title={`${indicatorLabels[id as keyof typeof indicatorLabels]}: полный эффект`}
                        className={v < 0 ? 'negative' : ''}
                      >
                        {id} {v > 0 ? '+' : ''}
                        {v}
                      </span>
                    ))}
                </div>
                <button
                  aria-label={chosen ? `${m.name} уже добавлено` : `Подробнее: ${m.name}`}
                  disabled={chosen || busy}
                  className="add-measure"
                  onClick={() => setOpened(m)}
                >
                  {chosen ? <Check size={18} /> : <Plus size={19} />}
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {filtered.length === 0 && (
        <div className="empty-state">
          <Search size={24} />
          <h3>Инициативы не найдены</h3>
          <p>Попробуйте другое название или направление.</p>
          <Button
            variant="outline"
            onClick={() => {
              setQuery('');
              setCategory('all');
            }}
          >
            Сбросить фильтры
          </Button>
        </div>
      )}
      {opened && (
        <MeasureModal
          key={opened.id}
          measure={opened}
          selected={selected}
          onClose={() => setOpened(null)}
        />
      )}
    </section>
  );
}
