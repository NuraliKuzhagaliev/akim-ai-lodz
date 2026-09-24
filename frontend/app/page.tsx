import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleDot,
  Globe2,
  Sparkles,
} from 'lucide-react';
import { Brand } from '@/components/shell';
import { CityMap } from '@/components/city-map';
import { Button } from '@/components/ui/button';
export default function Welcome() {
  return (
    <div className="welcome">
      <header className="welcome-nav">
        <Brand />
        <nav aria-label="Навигация главной">
          <a href="#how">Как это работает</a>
          <Link href="/compare">Сравнение планов</Link>
        </nav>
        <Button asChild variant="outline" size="sm">
          <Link href="/simulator">
            Открыть кабинет
            <ArrowUpRight size={16} />
          </Link>
        </Button>
      </header>
      <main id="main-content">
        <section className="welcome-hero">
          <div className="hero-copy">
            <span className="hero-label">
              <span />
              HACKALEM · ГОРОД БУДУЩЕГО
            </span>
            <h1>
              Пять решений.
              <br />
              Один город.
              <br />
              <em>Ваше влияние.</em>
            </h1>
            <p>
              Станьте акимом Астаны на 5 часов.
              <br />
              Распределите бюджет, поддержите районы и посмотрите, как ваши решения меняют качество
              жизни.
            </p>
            <div className="hero-actions">
              <Button asChild>
                <Link href="/simulator">
                  Начать управление
                  <ArrowRight size={19} />
                </Link>
              </Button>
              <a href="#how">
                Узнать больше
                <ChevronRight size={16} />
              </a>
            </div>
            <div className="hero-proof">
              <span>
                <Check size={14} />
                Без регистрации
              </span>
              <span>
                <Check size={14} />
                Синтетические данные
              </span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-visual-heading">
              <span>
                <Globe2 size={18} />
                Астана
              </span>
              <span>51°10′ N · 71°26′ E</span>
            </div>
            <CityMap hero />
            <div className="floating-score">
              <span>ASTANA QUALITY OF LIFE</span>
              <strong>
                52,56<small>/ 100</small>
              </strong>
              <p>
                <CircleDot size={12} />
                Отправная точка для перемен
              </p>
            </div>
            <span className="floating-tag">
              <Sparkles size={15} />
              Ваша следующая идея — новый город
            </span>
            <div className="hero-map-footer">
              <span>5 РАЙОНОВ</span>
              <span>14 ВОЗМОЖНОСТЕЙ</span>
              <ArrowUpRight size={21} />
            </div>
          </div>
        </section>
        <section className="welcome-numbers">
          <div>
            <strong>
              100<span>ед.</span>
            </strong>
            <p>Бюджет для важных изменений</p>
          </div>
          <div>
            <strong>
              5<span>решений</span>
            </strong>
            <p>Ваш управленческий план</p>
          </div>
          <div>
            <strong>
              5<span>районов</span>
            </strong>
            <p>У каждого — свои потребности</p>
          </div>
          <div>
            <strong>
              8<span>кварталов</span>
            </strong>
            <p>Чтобы увидеть последствия</p>
          </div>
        </section>
        <section className="how-section" id="how">
          <span className="eyebrow">ОТ ПЕРВОГО РЕШЕНИЯ ДО РЕЗУЛЬТАТА</span>
          <h2>
            Хороший город начинается
            <br />с осознанного выбора.
          </h2>
          <div className="how-grid">
            {[
              {
                n: '01',
                title: 'Познакомьтесь с городом',
                text: 'Изучите десять показателей каждого района. Найдите проблемы, которым нужно внимание.',
              },
              {
                n: '02',
                title: 'Соберите свой план',
                text: 'Выберите пять разных инициатив в пределах бюджета. Учитывайте задержки, конфликты и синергии.',
              },
              {
                n: '03',
                title: 'Увидьте последствия',
                text: 'Сравните показатели до и после. Получите объяснение сильных сторон, рисков и компромиссов.',
              },
            ].map((v) => (
              <article key={v.n}>
                <span>{v.n}</span>
                <h3>{v.title}</h3>
                <p>{v.text}</p>
              </article>
            ))}
          </div>
          <p className="welcome-disclaimer">
            Учебная симуляция на синтетических данных. Результаты описывают условия модели и не
            являются реальным прогнозом развития Астаны. В деморежиме показан сохранённый пример;
            расчёты собственных планов и AI доступны после подключения сервера.
          </p>
        </section>
      </main>
      <footer className="welcome-footer">
        <Brand />
        <span>Маленькие решения. Большое будущее.</span>
        <span>HACKALEM 2026</span>
      </footer>
    </div>
  );
}
