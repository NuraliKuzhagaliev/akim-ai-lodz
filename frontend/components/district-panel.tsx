'use client';
import { ArrowUpRight, Users } from 'lucide-react';
import { indicatorLabels } from '@/lib/labels';
import { indicatorIds, type DistrictId } from '@/lib/types';
import { number } from '@/lib/utils';
import { useScenario } from './provider';
import { CityMap } from './city-map';
export function DistrictPanel({
  selected,
  onSelect,
}: {
  selected: DistrictId;
  onSelect: (id: DistrictId) => void;
}) {
  const { districts, preview } = useScenario();
  const base = districts.find((d) => d.id === selected);
  const district = preview?.after?.districts.find((d) => d.id === selected) ?? base;
  if (!district || !base) return null;
  return (
    <section className="panel district-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">ГОРОД В ДЕТАЛЯХ</span>
          <h2>Пять районов. Общая цель.</h2>
        </div>
        <span className="quiet-badge">Астана, KZ</span>
      </div>
      <div className="district-tabs" role="group" aria-label="Выбор района">
        {districts.map((d) => (
          <button
            key={d.id}
            onClick={() => onSelect(d.id)}
            aria-pressed={selected === d.id}
            className={selected === d.id ? 'selected' : ''}
          >
            {d.name}
            {d.id === 'nura' && <span className="attention-dot" />}
          </button>
        ))}
      </div>
      <div className="district-content">
        <CityMap selected={selected} onSelect={onSelect} />
        <div className="district-detail">
          <div className="district-title">
            <h3>
              {district.name}
              <ArrowUpRight size={18} />
            </h3>
            <span>
              <Users size={13} />
              {number(district.populationShare * 100, 0)}% населения
            </span>
          </div>
          <p className="district-profile">{district.profile}</p>
          <div className="indicators">
            {indicatorIds.map((id) => (
              <div className="indicator" key={id}>
                <span>
                  <i>{id}</i>
                  {indicatorLabels[id]}
                </span>
                <strong className={district.indicators[id] < 40 ? 'critical-text' : ''}>
                  {number(district.indicators[id], 1)}
                </strong>
                <div className="indicator-track">
                  <span
                    className={district.indicators[id] < 40 ? 'critical' : ''}
                    style={{ width: `${district.indicators[id]}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="indicator-legend">
            <span />
            <small>Больше — лучше</small>
            <span className="critical" />
            <small>Ниже 40 — критично</small>
          </div>
        </div>
      </div>
    </section>
  );
}
