import { z } from 'zod';
import {
  districtsSchema,
  measuresSchema,
  recommendationSchema,
  simulationSchema,
  type Decision,
  type Measure,
  type Simulation,
} from './types';
import {
  baseline,
  districts,
  exampleAnalysis,
  exampleDecisions,
  exampleResult,
  measures,
} from './fixtures';
import { aiResponseSchema, createAnalysisRequest, normalizeAnalysis } from './ai-contract';
import {
  comparisonResponseSchema,
  createComparisonRequest,
  normalizeComparison,
} from './ai-contract';
import { checkedReplacement } from './recommendation';
import { adviceSchema, reportSchema } from './report-contract';
export const isMock = process.env.NEXT_PUBLIC_API_MODE !== 'live';
export const recommendationsEnabled = process.env.NEXT_PUBLIC_ENABLE_RECOMMENDATIONS !== 'false';
export const aiComparisonEnabled = process.env.NEXT_PUBLIC_ENABLE_AI_COMPARISON === 'true';
const origin = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '');
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
export async function request<T>(path: string, schema: z.ZodType<T>, body?: unknown): Promise<T> {
  const controller = new AbortController();
  // AI generation has a 45s server timeout; leave time for transport and JSON validation.
  const isAiRequest = [
    '/api/ai/analyze',
    '/api/ai/advice',
    '/api/ai/compare',
    '/api/explain',
    '/api/report/executive-brief',
  ].includes(path);
  const timeoutMs = isAiRequest ? 60000 : 20000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${origin}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
      cache: 'no-store',
    });
    const data: unknown = await response.json().catch(() => {
      throw new ApiError('Сервер вернул ответ не в формате JSON.', response.status);
    });
    if (!response.ok) {
      const parsed = z
        .object({
          message: z.string().optional(),
          detail: z.union([z.string(), z.array(z.object({ msg: z.string() }))]).optional(),
        })
        .safeParse(data);
      const detail = parsed.success ? parsed.data.detail : undefined;
      throw new ApiError(
        parsed.success && parsed.data.message
          ? parsed.data.message
          : typeof detail === 'string'
            ? detail
            : Array.isArray(detail)
              ? detail.map((e) => e.msg).join('; ')
              : `Сервер не принял запрос (${response.status}).`,
        response.status,
      );
    }
    const parsed = schema.safeParse(data);
    if (!parsed.success)
      throw new ApiError(
        'Формат ответа сервера не совпадает с контрактом фронтенда. Проверьте интеграцию.',
        response.status,
      );
    return parsed.data;
  } catch (error) {
    if (controller.signal.aborted)
      throw new ApiError(
        isAiRequest
          ? 'AI не ответил за 60 секунд. Расчётные результаты сохранены. Попробуйте ещё раз.'
          : 'Сервер не ответил за 20 секунд. Попробуйте ещё раз.',
      );
    if (error instanceof ApiError) throw error;
    throw new ApiError('Не удалось связаться с сервером. Проверьте подключение и адрес API.');
  } finally {
    clearTimeout(timeout);
  }
}
export const decisionKey = (decisions: Decision[]) =>
  decisions
    .map((d) => `${d.measureId}:${d.districtId ?? ''}`)
    .sort()
    .join('|');
const isExample = (decisions: Decision[]) =>
  decisionKey(decisions) === decisionKey(exampleDecisions);
const delay = () => new Promise<void>((resolve) => setTimeout(resolve, 300));
export const api = {
  async districts() {
    return isMock ? structuredClone(districts) : request('/api/districts', districtsSchema);
  },
  async measures() {
    return isMock ? structuredClone(measures) : request('/api/measures', measuresSchema);
  },
  async simulate(decisions: Decision[]): Promise<Simulation> {
    if (!isMock) return request('/api/simulate', simulationSchema, { decisions });
    await delay();
    if (isExample(decisions)) return structuredClone(exampleResult);
    const spent = decisions.reduce(
      (sum, d) => sum + (measures.find((m) => m.id === d.measureId)?.cost ?? 0),
      0,
    );
    return {
      modelVersion: 'organizer-dataset-v1',
      source: 'fixture',
      decisions,
      validation: { status: decisions.length === 0 ? 'valid' : 'unverified', errors: [] },
      budget: { total: 100, spent, remaining: 100 - spent },
      before: structuredClone(baseline),
      after: decisions.length === 0 ? structuredClone(baseline) : null,
      scoreDelta: decisions.length === 0 ? 0 : null,
      synergies: [],
      contributions: [],
      notice:
        'Деморежим: произвольные наборы требуют backend. Для полного просмотра загрузите контрольный пример.',
    };
  },
  async finalize(decisions: Decision[]) {
    if (!isMock) return request('/api/scenario/finalize', simulationSchema, { decisions });
    await delay();
    if (!isExample(decisions))
      throw new ApiError(
        'В деморежиме итог доступен только для контрольного примера. Подключите backend для расчёта своего плана.',
      );
    return structuredClone(exampleResult);
  },
  async analyze(result: Simulation, catalog: Measure[] = []) {
    if (!isMock)
      return normalizeAnalysis(
        await request('/api/ai/analyze', aiResponseSchema, createAnalysisRequest(result, catalog)),
      );
    await delay();
    return structuredClone(exampleAnalysis);
  },
  async comparePlans(original: Simulation, alternative: Simulation) {
    if (isMock || !aiComparisonEnabled)
      throw new ApiError('Совместный AI-разбор двух планов ещё не подключён.');
    const response = await request(
      '/api/ai/compare',
      comparisonResponseSchema,
      createComparisonRequest(original, alternative),
    );
    return normalizeComparison(response, original, alternative);
  },
  async recommend(original: Simulation) {
    if (isMock || !recommendationsEnabled)
      throw new ApiError('Поиск замены станет доступен после подключения расчётного API.');
    const recommendation = await request('/api/recommend', recommendationSchema, {
      decisions: original.decisions,
    });
    return { recommendation, replacement: checkedReplacement(original, recommendation) };
  },
  async advice(decisions: Decision[], question?: string) {
    if (isMock) throw new ApiError('Советник доступен при подключённом сервере.');
    return request('/api/ai/advice', adviceSchema, {
      decisions,
      ...(question ? { question } : {}),
    });
  },
  async report(result: Simulation) {
    if (
      isMock ||
      result.source !== 'backend' ||
      !result.after ||
      result.validation.status !== 'valid'
    )
      throw new ApiError('Для отчёта нужен результат подключённого сервера.');
    const report = await request('/api/report/executive-brief', reportSchema, {
      decisions: result.decisions,
    });
    const decisions = report.decisions.map((d) => ({
      measureId: d.measure_id,
      ...(d.district_id ? { districtId: d.district_id } : {}),
    }));
    if (
      decisionKey(decisions) !== decisionKey(result.decisions) ||
      report.score_after !== result.after.score ||
      report.budget.spent !== result.budget.spent
    )
      throw new ApiError('Отчёт относится к другому результату. Пересчитайте сценарий.');
    return report;
  },
};
