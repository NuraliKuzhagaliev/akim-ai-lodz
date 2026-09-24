'use client';
import { useRef, useState } from 'react';
import { Download, FileText, LoaderCircle } from 'lucide-react';
import { api, isMock } from '@/lib/api';
import { downloadText } from '@/lib/download';
import type { Simulation } from '@/lib/types';
import { Button } from './ui/button';

export function ExecutiveReport({ result }: { result: Simulation }) {
  const [report, setReport] = useState<Awaited<ReturnType<typeof api.report>> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const pending = useRef(false);
  async function generate() {
    if (pending.current) return;
    pending.current = true;
    setLoading(true);
    setError('');
    try {
      setReport(await api.report(result));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Отчёт временно недоступен.');
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }
  return (
    <section className="panel executive-report">
      <div className="section-heading">
        <div>
          <span className="eyebrow">ЗАЩИТИТЕ СВОЁ РЕШЕНИЕ</span>
          <h2>Краткий отчёт для защиты</h2>
          <p className="muted small">
            Проверенные числа, решения, сильные стороны и оставшиеся риски.
          </p>
        </div>
        <Button variant="secondary" disabled={isMock || loading} onClick={() => void generate()}>
          {loading ? <LoaderCircle className="spin" size={18} /> : <FileText size={18} />}
          {loading ? 'Готовим отчёт…' : report ? 'Обновить отчёт' : 'Подготовить отчёт'}
        </Button>
      </div>
      {isMock && <p className="muted">Для AI-отчёта подключите сервер и настройте ключ модели.</p>}
      {error && (
        <p role="alert" className="critical-text">
          {error} Расчётные показатели сохранены.
        </p>
      )}
      {report && (
        <>
          <pre className="report-preview">{report.markdown}</pre>
          <Button
            variant="outline"
            onClick={() =>
              downloadText('akim-ai-report.md', report.markdown, 'text/markdown;charset=utf-8')
            }
          >
            <Download size={16} />
            Скачать Markdown
          </Button>
        </>
      )}
    </section>
  );
}
