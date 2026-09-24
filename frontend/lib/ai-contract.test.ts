import { describe, expect, it } from 'vitest';
import { aiResponseSchema, createAnalysisRequest, normalizeAnalysis } from './ai-contract';
import { exampleResult, measures } from './fixtures';
describe('existing AI module contract', () => {
  it('maps calculated values to the existing snake_case request without computing scores', () => {
    const payload = createAnalysisRequest(exampleResult, measures);
    expect(payload.scenario.score_after).toBe(56.54307);
    expect(payload.scenario.budget).toEqual({ initial: 100, spent: 95, remaining: 5 });
    expect(payload.scenario.decisions[3].district_id).toBeNull();
    expect(payload.scenario.decisions[0].contribution).toBeNull();
    expect(
      payload.scenario.districts.find((d) => d.district_id === 'nura')?.indicators_after.S1,
    ).toBe(48);
  });
  it('keeps the evidence supplied by AI and never substitutes missing summary text', () => {
    const response = aiResponseSchema.parse({
      strengths: [{ text: 'Закрыт дефицит школ', evidence: ['Нура S1: 38 → 48'] }],
      risks: [],
      tradeoffs: [],
      recommendations: [],
      answer: null,
    });
    const normalized = normalizeAnalysis(response);
    expect(normalized.source).toBe('ai');
    expect(normalized.summary).toBe('');
    expect(normalized.evidence?.['strengths:0']).toEqual(['Нура S1: 38 → 48']);
  });
  it('does not send an incomplete calculation to AI', () => {
    expect(() => createAnalysisRequest({ ...exampleResult, after: null }, measures)).toThrow(
      'подтверждённый результат',
    );
  });
});
