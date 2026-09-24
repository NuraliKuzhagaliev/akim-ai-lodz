'use client';
import { useState } from 'react';
import { ArrowUpRight, CalendarDays, LoaderCircle } from 'lucide-react';
import type { DistrictId } from '@/lib/types';
import { Shell } from '@/components/shell';
import { useScenario } from '@/components/provider';
import { Metrics } from '@/components/metrics';
import { DistrictPanel } from '@/components/district-panel';
import { Catalog } from '@/components/catalog';
import { DecisionList } from '@/components/decision-list';
import { Button } from '@/components/ui/button';
import { AdvicePanel } from '@/components/advice-panel';
export default function Simulator() {
  const [selected, setSelected] = useState<DistrictId>('nura');
  const { loading, districts, reload, decisions } = useScenario();
  return (
    <Shell>
      <div className="page-heading">
        <div>
          <span className="eyebrow">КАБИНЕТ ГОРОДСКИХ РЕШЕНИЙ</span>
          <h1>
            Город в ваших руках<span className="heading-dot">.</span>
          </h1>
          <p>Выберите пять инициатив. Создайте Астану, в которой хочется жить.</p>
        </div>
        <span className="horizon">
          <CalendarDays size={16} />
          <span>
            Горизонт планирования<strong>8 кварталов · 2 года</strong>
          </span>
          <ArrowUpRight size={17} />
        </span>
      </div>
      {loading ? (
        <div className="loading-state" role="status">
          <LoaderCircle className="spin" />
          Загружаем данные города…
        </div>
      ) : districts.length === 0 ? (
        <div className="empty-state">
          <h2>Данные пока недоступны</h2>
          <p>Проверьте подключение к серверу и повторите загрузку.</p>
          <Button onClick={() => void reload()}>Повторить загрузку</Button>
        </div>
      ) : (
        <>
          <Metrics />
          <AdvicePanel key={JSON.stringify(decisions)} />
          <div className="simulator-grid">
            <div className="main-column">
              <DistrictPanel selected={selected} onSelect={setSelected} />
              <Catalog selected={selected} />
            </div>
            <DecisionList />
          </div>
        </>
      )}
    </Shell>
  );
}
