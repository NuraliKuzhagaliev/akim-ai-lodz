import { afterEach, expect, it, vi } from 'vitest';
import official from './test-fixtures/official-result.json';
import { simulationSchema } from './types';
import { adviceSchema } from './report-contract';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function liveApi() {
  vi.stubEnv('NEXT_PUBLIC_API_MODE', 'live');
  vi.resetModules();
  return (await import('./api')).api;
}

function report() {
  return {
    title: 'Отчёт',
    score_before: 52.55768,
    score_after: 56.54307,
    score_delta: 3.98539,
    budget: { initial: 100, spent: 95, remaining: 5 },
    decisions: official.decisions.map((d) => ({
      measure_id: d.measureId,
      district_id: 'districtId' in d ? d.districtId : null,
    })),
    major_improvements: [],
    remaining_risks: [],
    equity: [],
    recommendations: [],
    markdown: '# Отчёт',
  };
}

it('accepts the report only for the current verified result and sends only decisions', async () => {
  const api = await liveApi();
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(report())));
  vi.stubGlobal('fetch', fetch);
  expect((await api.report(simulationSchema.parse(official))).markdown).toBe('# Отчёт');
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ decisions: official.decisions });
});

it.each(['score', 'decisions'])('rejects a report with mismatched %s', async (kind) => {
  const api = await liveApi();
  const bad = report();
  if (kind === 'score') bad.score_after = 99;
  else bad.decisions[0].district_id = 'esil';
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(bad))));
  await expect(api.report(simulationSchema.parse(official))).rejects.toThrow('другому результату');
});

it('rejects advice that claims suggestions form a validated batch', () => {
  expect(
    adviceSchema.safeParse({
      priority: 'Школы',
      reason: 'Дефицит',
      suggestions: [],
      validation_mode: 'batch',
      base_scenario_id: 'plan',
    }).success,
  ).toBe(false);
});

it('passes only selections to the server for advisor validation', async () => {
  const api = await liveApi();
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({
          priority: 'Школы',
          reason: 'Дефицит',
          suggestions: [{ measure_id: 'M7', district_id: 'nura' }],
          validation_mode: 'individual_additions',
          base_scenario_id: 'plan',
        }),
      ),
    );
  vi.stubGlobal('fetch', fetch);
  expect((await api.advice([])).suggestions[0].measure_id).toBe('M7');
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ decisions: [] });
});
