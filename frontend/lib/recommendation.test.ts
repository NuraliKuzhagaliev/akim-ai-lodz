import { describe, expect, it } from 'vitest';
import { checkedReplacement } from './recommendation';
import { recommendationSchema, simulationSchema } from './types';
// Unmodified backend fixtures from feature/simulation 051401c, shared/fixtures.
import originalJson from './test-fixtures/official-result.json';
import recommendationJson from './test-fixtures/recommendation.json';
const original = () => simulationSchema.parse(originalJson);
const recommendation = () => recommendationSchema.parse(recommendationJson);

describe('verified one-replacement recommendation', () => {
  it('accepts actual backend results and preserves the cost/equity tradeoff', () => {
    const response = recommendation();
    const checked = checkedReplacement(original(), response)!;
    expect(checked.removed).toEqual({ measureId: 'M5', districtId: 'saryarka' });
    expect(checked.added).toEqual({ measureId: 'M3', districtId: 'nura' });
    expect(response.scoreDelta).toBe(0.66249);
    expect(response.costDelta).toBe(5);
    expect(response.weakestScoreDelta).toBe(2.02);
    expect(checked.result.after!.districts.find((d) => d.id === 'saryarka')!.score).toBeLessThan(
      original().after!.districts.find((d) => d.id === 'saryarka')!.score,
    );
  });
  it('ignores ordering of decisions and baseline districts', () => {
    const response = recommendation();
    response.decisions!.reverse();
    response.result!.before.districts.reverse();
    expect(checkedReplacement(original(), response)).not.toBeNull();
  });
  it('allows relocating one measure to a different district', () => {
    const response = recommendation();
    response.decisions!.find((d) => d.measureId === 'M3')!.measureId = 'M5';
    response.result!.decisions.find((d) => d.measureId === 'M3')!.measureId = 'M5';
    const checked = checkedReplacement(original(), response)!;
    expect(checked.removed.measureId).toBe(checked.added.measureId);
    expect(checked.removed.districtId).not.toBe(checked.added.districtId);
  });
  it.each(['modelVersion', 'dataChecksum'] as const)('rejects a changed %s', (field) => {
    const response = recommendation();
    response.result![field] = 'different';
    expect(() => checkedReplacement(original(), response)).toThrow('Данные модели изменились');
  });
  it('rejects a different baseline even when version strings match', () => {
    const response = recommendation();
    response.result!.before.districts[0].indicators.T1 += 1;
    expect(() => checkedReplacement(original(), response)).toThrow('Данные модели изменились');
  });
  it('rejects applying a result for another set of decisions', () => {
    const response = recommendation();
    response.decisions![0].districtId = 'esil';
    expect(() => checkedReplacement(original(), response)).toThrow('полный результат');
  });
  it('rejects two replacements', () => {
    const response = recommendation();
    response.decisions![0].districtId = 'esil';
    response.result!.decisions[0].districtId = 'esil';
    expect(() => checkedReplacement(original(), response)).toThrow('ровно одну замену');
  });
  it('rejects found=true without a full result', () => {
    const response = recommendation();
    delete response.result;
    expect(() => checkedReplacement(original(), response)).toThrow('полный результат');
  });
  it.each(['costDelta', 'scoreDelta', 'weakestScoreDelta'] as const)(
    'rejects a contradictory %s',
    (field) => {
      const response = recommendation();
      response[field] = 123;
      expect(() => checkedReplacement(original(), response)).toThrow('не согласованы');
    },
  );
  it('rejects invalid, empty, or fabricated simulation results', () => {
    for (const mutate of [
      (r: ReturnType<typeof original>) => {
        r.validation.status = 'invalid';
      },
      (r: ReturnType<typeof original>) => {
        r.after = null;
      },
      (r: ReturnType<typeof original>) => {
        r.source = 'fixture';
      },
    ]) {
      const response = recommendation();
      mutate(response.result!);
      expect(() => checkedReplacement(original(), response)).toThrow('полный результат');
    }
  });
  it('rejects a response claiming found=true for the original plan', () => {
    const response = recommendation();
    response.result = original();
    response.decisions = original().decisions;
    expect(() => checkedReplacement(original(), response)).toThrow('ровно одну замену');
  });
  it('accepts no-improvement without inventing an alternative', () => {
    const response = recommendationSchema.parse({
      found: false,
      explanation: 'Улучшений нет',
      candidatesChecked: 265,
      validCandidates: 117,
      costDelta: null,
      scoreDelta: null,
      weakestScoreDelta: null,
    });
    expect(checkedReplacement(original(), response)).toBeNull();
    expect(() => checkedReplacement(original(), { ...response, result: original() })).toThrow(
      'противоречивый',
    );
  });
});
