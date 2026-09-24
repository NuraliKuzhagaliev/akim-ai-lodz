import type { Metadata } from 'next';
import { ScenarioProvider } from '@/components/provider';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'AKIM AI — Аким на 5 часов', template: '%s · AKIM AI' },
  description:
    'Пять решений. Один город. Учебная AI-симуляция управления Астаной на синтетических данных.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main-content">
          Перейти к содержимому
        </a>
        <ScenarioProvider>{children}</ScenarioProvider>
      </body>
    </html>
  );
}
