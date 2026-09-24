'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowUpRight,
  Building2,
  ChartNoAxesCombined,
  CircleHelp,
  GitCompareArrows,
  LayoutDashboard,
  Sparkles,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { isMock } from '@/lib/api';
import { useScenario } from './provider';
import { Modal } from './ui/dialog';
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="AKIM AI — главная">
      <span className="brand-mark">
        <Building2 size={23} />
      </span>
      <span>
        AKIM<span className="brand-ai"> AI</span>
        <small>ГОРОД НАЧИНАЕТСЯ С РЕШЕНИЙ</small>
      </span>
    </Link>
  );
}
export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [help, setHelp] = useState(false);
  const { error, clearError, storageWarning } = useScenario();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <span className="nav-label">ВАШ ГОРОД</span>
        <nav aria-label="Основная навигация">
          {[
            { href: '/simulator', icon: LayoutDashboard, label: 'Панель управления' },
            { href: '/results', icon: ChartNoAxesCombined, label: 'Результаты' },
            { href: '/compare', icon: GitCompareArrows, label: 'Сравнение планов' },
          ].map((item) => (
            <Link
              href={item.href}
              aria-label={item.label}
              key={item.href}
              className={`nav-item ${path === item.href ? 'active' : ''}`}
              aria-current={path === item.href ? 'page' : undefined}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
              {path === item.href && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-note">
          <Sparkles size={21} />
          <strong>
            У каждого решения
            <br />
            есть продолжение.
          </strong>
          <p>Помогите городу стать лучше — район за районом.</p>
          <span>HACKALEM · ASTANA</span>
        </div>
        <button className="help-button" onClick={() => setHelp(true)}>
          <CircleHelp size={18} />
          Как работает симуляция
          <ArrowUpRight size={16} />
        </button>
        <div className="sidebar-footer">
          <span className="avatar">АК</span>
          <div>
            <strong>Кабинет акима</strong>
            <small>Учебная симуляция</small>
          </div>
        </div>
      </aside>
      <div className="app-content">
        <header className="topbar">
          <div className="breadcrumb">
            Астана<span>/</span>
            <strong>
              {path === '/simulator'
                ? 'Панель управления'
                : path === '/results'
                  ? 'Результаты'
                  : 'Сравнение планов'}
            </strong>
          </div>
          <span className={`status-badge ${isMock ? 'demo' : ''}`}>
            <span />
            {isMock ? 'Демонстрационный режим' : 'Подключено к API'}
          </span>
          <span className="topbar-label">СИНТЕТИЧЕСКИЕ ДАННЫЕ</span>
        </header>
        {error && (
          <div role="alert" className="global-alert">
            <span>{error}</span>
            <button onClick={clearError} aria-label="Скрыть уведомление">
              <X size={18} />
            </button>
          </div>
        )}
        {storageWarning && (
          <div role="status" className="global-alert">
            Браузер не разрешил сохранение. Текущий план доступен до закрытия страницы.
          </div>
        )}
        <main id="main-content" className="workspace">
          {children}
        </main>
        <footer className="app-footer">
          <span>AKIM AI © 2026</span>
          <span>Учебная симуляция на синтетических данных · Не реальный прогноз</span>
          <span>Сделано для HackAlem</span>
        </footer>
      </div>
      <Modal
        open={help}
        onOpenChange={setHelp}
        title="Пять решений. Один город."
        description="Правила симуляции по датасету организаторов."
      >
        <ol className="rules-list">
          <li>Бюджет — 100 условных единиц. Остаток не даёт бонуса.</li>
          <li>Выберите ровно пять разных мероприятий, максимум два из одного направления.</li>
          <li>Для районных мер укажите район; городские действуют на весь город.</li>
          <li>Учитывайте несовместимости, синергии и задержки. Горизонт — восемь кварталов.</li>
          <li>Все показатели от 0 до 100: больше — лучше. Ниже 40 — критическая зона.</li>
          <li>Итог рассчитывает сервер. AI объясняет результат, не изменяя числа.</li>
        </ol>
        <p className="muted">
          В деморежиме полный результат доступен для сохранённого контрольного примера
          организаторов.
        </p>
      </Modal>
    </div>
  );
}
