import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadDraft, loadResult, loadScenarios, saveScenario, writeStored } from './storage';
import { exampleResult } from './fixtures';
describe('browser persistence', () => {
  let values: Map<string, string>;
  beforeEach(() => {
    values = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => values.set(k, v),
    });
  });
  it('ignores corrupted JSON without crashing', () => {
    values.set('akim-ai:v1:draft', '{broken');
    expect(loadDraft()).toEqual([]);
  });
  it('ignores drafts with unknown district IDs', () => {
    writeStored('draft', [{ measureId: 'M7', districtId: 'unknown' }]);
    expect(loadDraft()).toEqual([]);
  });
  it('does not trust incomplete saved results', () => {
    writeStored('result', { after: { score: 100 } });
    expect(loadResult()).toBeNull();
  });
  it('reports unavailable storage', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw Error('blocked');
      },
      setItem: () => {
        throw Error('quota');
      },
    });
    expect(loadScenarios()).toEqual([]);
    expect(writeStored('draft', [])).toBe(false);
  });
  it('caps saved plans and retains the latest result', () => {
    for (let i = 0; i < 14; i++) saveScenario(exampleResult, `Plan ${i}`);
    expect(loadScenarios()).toHaveLength(12);
    expect(loadScenarios()[0].name).toBe('Plan 13');
  });
});
