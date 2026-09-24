import { z } from 'zod';
import {
  decisionSchema,
  savedScenarioSchema,
  simulationSchema,
  type Decision,
  type SavedScenario,
  type Simulation,
} from './types';
const prefix = 'akim-ai:v1:';
export function readStored<T>(key: string, schema: z.ZodType<T>, fallback: T): T {
  try {
    const raw = localStorage.getItem(prefix + key);
    if (!raw) return fallback;
    const value = schema.safeParse(JSON.parse(raw));
    return value.success ? value.data : fallback;
  } catch {
    return fallback;
  }
}
export function writeStored(key: string, value: unknown) {
  try {
    localStorage.setItem(prefix + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export const loadDraft = (): Decision[] => readStored('draft', z.array(decisionSchema).max(5), []);
export const loadResult = (): Simulation | null =>
  readStored('result', simulationSchema.nullable(), null);
export const loadScenarios = (): SavedScenario[] =>
  readStored('scenarios', z.array(savedScenarioSchema).max(12), []);
export function saveScenario(result: Simulation, name: string): boolean {
  const scenarios = loadScenarios();
  const entry: SavedScenario = {
    id: crypto.randomUUID(),
    name: name.trim().slice(0, 80) || `План ${scenarios.length + 1}`,
    savedAt: new Date().toISOString(),
    result,
  };
  return writeStored('scenarios', [entry, ...scenarios].slice(0, 12));
}
