'use client';
import Link from 'next/link';
import { FileChartColumn, LoaderCircle } from 'lucide-react';
import { Results } from '@/components/results';
import { Shell } from '@/components/shell';
import { useScenario } from '@/components/provider';
import { Button } from '@/components/ui/button';
export default function ResultsPage() {
  const { result, loading } = useScenario();
  return (
    <Shell>
      {loading ? (
        <div role="status" className="loading-state">
          <LoaderCircle className="spin" />
          Загружаем сценарий…
        </div>
      ) : result ? (
        <Results key={JSON.stringify(result.decisions)} result={result} />
      ) : (
        <div className="empty-state">
          <FileChartColumn size={40} />
          <h1>История изменений ещё впереди</h1>
          <p>Соберите пять решений и завершите сценарий, чтобы увидеть результат.</p>
          <Button asChild>
            <Link href="/simulator">Перейти к управлению</Link>
          </Button>
        </div>
      )}
    </Shell>
  );
}
