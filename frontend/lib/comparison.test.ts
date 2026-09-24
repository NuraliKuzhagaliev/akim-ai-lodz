import { afterEach, describe, expect, it, vi } from 'vitest';
import { createComparisonRequest, normalizeComparison } from './ai-contract';
import { simulationSchema } from './types';
import originalJson from './test-fixtures/official-result.json';
import recommendationJson from './test-fixtures/recommendation.json';
const original = simulationSchema.parse(originalJson);
const alternative = simulationSchema.parse(recommendationJson.result);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});
describe('proposed AI comparison boundary', () => {
  it('sends only decision IDs, never browser scores or model instructions', () => {
    expect(createComparisonRequest(original, alternative)).toEqual({
      originalDecisions: original.decisions,
      alternativeDecisions: alternative.decisions,
    });
  });
  it('rejects mock and incompatible results', () => {
    expect(() => createComparisonRequest({ ...original, source: 'fixture' }, alternative)).toThrow(
      'подтверждённых',
    );
    expect(() =>
      createComparisonRequest(original, { ...alternative, dataChecksum: 'new' }),
    ).toThrow('разных версиях');
  });
  const response = {
    originalScenarioId: original.scenarioId!,
    alternativeScenarioId: alternative.scenarioId!,
    modelVersion: original.modelVersion,
    dataChecksum: original.dataChecksum!,
    analysis: {
      strengths: [{ text: 'Тестовый разбор', evidence: ['Тестовое подтверждение'] }],
      risks: [],
      tradeoffs: [],
      recommendations: [],
      answer: null,
    },
  };
  it('keeps AI evidence and binds explanations to both returned plan IDs', () => {
    expect(normalizeComparison(response, original, alternative).evidence?.['strengths:0']).toEqual([
      'Тестовое подтверждение',
    ]);
    expect(() =>
      normalizeComparison(
        { ...response, originalScenarioId: alternative.scenarioId! },
        original,
        alternative,
      ),
    ).toThrow('другим планам');
    expect(() =>
      normalizeComparison({ ...response, dataChecksum: 'new' }, original, alternative),
    ).toThrow('версии данных');
  });
  it('does not call a nonexistent endpoint unless explicitly enabled', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_API_MODE', 'live');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_AI_COMPARISON', 'false');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const { api } = await import('./api');
    await expect(api.comparePlans(original, alternative)).rejects.toThrow('ещё не подключён');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('uses the agreed simulation endpoint with recommendations enabled by default in live mode', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_API_MODE', 'live');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_RECOMMENDATIONS', undefined);
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(recommendationJson)));
    vi.stubGlobal('fetch', fetch);
    const { api } = await import('./api');
    expect((await api.recommend(original)).replacement?.added.measureId).toBe('M3');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ decisions: original.decisions });
    expect(fetch.mock.calls[0][0]).toContain('/api/recommend');
  });
  it('handles the future comparison endpoint only when the flag is enabled', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_API_MODE', 'live');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_AI_COMPARISON', 'true');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(response))));
    const { api } = await import('./api');
    expect((await api.comparePlans(original, alternative)).source).toBe('ai');
  });
});
