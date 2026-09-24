'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, decisionKey, isMock } from '@/lib/api';
import { loadDraft, loadResult, writeStored } from '@/lib/storage';
import type { Decision, District, Measure, Simulation } from '@/lib/types';
type State = {
  districts: District[];
  measures: Measure[];
  decisions: Decision[];
  preview: Simulation | null;
  result: Simulation | null;
  loading: boolean;
  busy: boolean;
  error: string | null;
  storageWarning: boolean;
  reload: () => Promise<void>;
  change: (value: Decision[]) => Promise<boolean>;
  finalize: () => Promise<boolean>;
  clearError: () => void;
};
const Context = createContext<State | null>(null);
export function ScenarioProvider({ children }: { children: ReactNode }) {
  const [districts, setDistricts] = useState<District[]>([]);
  const [measures, setMeasures] = useState<Measure[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [preview, setPreview] = useState<Simulation | null>(null);
  const [result, setResult] = useState<Simulation | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState(false);
  const operation = useRef(false);
  const reloadGeneration = useRef(0);
  const reload = useCallback(async () => {
    const generation = ++reloadGeneration.current;
    setLoading(true);
    setError(null);
    try {
      const draft = loadDraft();
      const [ds, ms, initial] = await Promise.all([
        api.districts(),
        api.measures(),
        api.simulate(draft),
      ]);
      if (generation !== reloadGeneration.current) return;
      setError(null);
      setDistricts(ds);
      setMeasures(ms);
      setDecisions(draft);
      setPreview(initial);
      const saved = loadResult();
      setResult(
        saved &&
          (saved.source === 'fixture') === isMock &&
          saved.modelVersion === initial.modelVersion &&
          saved.dataChecksum === initial.dataChecksum &&
          decisionKey(saved.decisions) === decisionKey(draft)
          ? saved
          : null,
      );
    } catch (e) {
      if (generation === reloadGeneration.current)
        setError(e instanceof Error ? e.message : 'Не удалось загрузить город.');
    } finally {
      if (generation === reloadGeneration.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(reload);
    return () => {
      reloadGeneration.current += 1;
    };
  }, [reload]);
  const persist = (key: string, value: unknown) => {
    if (!writeStored(key, value)) setStorageWarning(true);
  };
  const change = async (value: Decision[]) => {
    if (operation.current) return false;
    operation.current = true;
    setBusy(true);
    setError(null);
    try {
      const next = await api.simulate(value);
      if (decisionKey(next.decisions) !== decisionKey(value)) {
        throw new Error('Сервер вернул прогноз для другого набора решений. Повторите запрос.');
      }
      if (next.validation.status === 'invalid') {
        setError(
          next.validation.errors.map((e) => e.message).join(' · ') ||
            'Сервер отклонил этот набор решений.',
        );
        return false;
      }
      setDecisions(value);
      setPreview(next);
      setResult(null);
      persist('draft', value);
      persist('result', null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось проверить решение.');
      return false;
    } finally {
      operation.current = false;
      setBusy(false);
    }
  };
  const finalize = async () => {
    if (operation.current) return false;
    operation.current = true;
    setBusy(true);
    setError(null);
    try {
      const response = await api.finalize(decisions);
      if (
        response.validation.status !== 'valid' ||
        !response.after ||
        response.decisions.length !== 5 ||
        decisionKey(response.decisions) !== decisionKey(decisions)
      ) {
        throw new Error(
          response.validation.errors.map((e) => e.message).join(' · ') ||
            'Сервер не подтвердил итог для пяти выбранных решений.',
        );
      }
      setResult(response);
      persist('result', response);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось завершить сценарий.');
      return false;
    } finally {
      operation.current = false;
      setBusy(false);
    }
  };
  return (
    <Context.Provider
      value={{
        districts,
        measures,
        decisions,
        preview,
        result,
        loading,
        busy,
        error,
        storageWarning,
        reload,
        change,
        finalize,
        clearError: () => setError(null),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useScenario() {
  const value = useContext(Context);
  if (!value) throw new Error('ScenarioProvider is missing');
  return value;
}
