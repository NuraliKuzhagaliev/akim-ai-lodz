import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { api, decisionKey, request } from './api';
import { exampleDecisions, exampleResult } from './fixtures';
import { simulationSchema, districtsSchema } from './types';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe('API boundary', () => {
  it('rejects duplicate district IDs rather than crashing the results page', () => {
    expect(
      districtsSchema.safeParse(Array(5).fill(exampleResult.before.districts[0])).success,
    ).toBe(false);
  });
  it('sends decisions only and parses server JSON', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(exampleResult), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const result = await request('/api/simulate', simulationSchema, {
      decisions: exampleDecisions,
    });
    expect(result.after?.score).toBe(56.54307);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ decisions: exampleDecisions });
  });
  it('surfaces FastAPI validation details without replacing them with mocks', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ detail: [{ msg: 'Бюджет превышен' }] }), { status: 422 }),
        ),
    );
    await expect(request('/api/simulate', simulationSchema, {})).rejects.toThrow('Бюджет превышен');
  });
  it('rejects a malformed successful response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"score":999}')));
    await expect(request('/api/simulate', simulationSchema, {})).rejects.toThrow('не совпадает');
  });
  it('handles non-JSON responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 })),
    );
    await expect(request('/api/measures', z.array(z.string()))).rejects.toThrow(
      'не в формате JSON',
    );
  });
  it('handles network loss', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(request('/api/districts', z.array(z.string()))).rejects.toThrow(
      'Не удалось связаться',
    );
  });
  it('aborts requests after the timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, init) =>
          new Promise((_resolve, reject) =>
            init.signal.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            ),
          ),
      ),
    );
    const promise = request('/api/simulate', simulationSchema, {});
    const check = expect(promise).rejects.toThrow('20 секунд');
    await vi.advanceTimersByTimeAsync(20000);
    await check;
  });
});
describe('AI latency budget', () => {
  it.each([
    '/api/ai/analyze',
    '/api/ai/advice',
    '/api/ai/compare',
    '/api/explain',
    '/api/report/executive-brief',
  ])('accepts %s responses that take longer than the old 20s timeout', async (path) => {
    vi.useFakeTimers();
    const fetch = vi.fn(
      (_url, init) =>
        new Promise<Response>((resolve, reject) => {
          setTimeout(() => resolve(new Response('{"ok":true}')), 25000);
          init.signal.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );
    vi.stubGlobal('fetch', fetch);
    const promise = request(path, z.object({ ok: z.boolean() }), {});
    const check = expect(promise).resolves.toEqual({ ok: true });
    await vi.advanceTimersByTimeAsync(25000);
    await check;
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('aborts a hanging AI request at 60s without retrying', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(
      (_url, init) =>
        new Promise((_resolve, reject) =>
          init.signal.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          ),
        ),
    );
    vi.stubGlobal('fetch', fetch);
    const check = expect(request('/api/ai/analyze', z.object({}), {})).rejects.toThrow(
      'AI не ответил за 60 секунд. Расчётные результаты сохранены.',
    );
    await vi.advanceTimersByTimeAsync(59999);
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await check;
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('reports a timeout while reading JSON as a timeout, not malformed JSON', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn((_url, init) =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            new Promise((_resolve, reject) =>
              init.signal.addEventListener('abort', () =>
                reject(new DOMException('Aborted', 'AbortError')),
              ),
            ),
        }),
      ),
    );
    const check = expect(request('/api/ai/analyze', z.object({}), {})).rejects.toThrow('60 секунд');
    await vi.advanceTimersByTimeAsync(60000);
    await check;
  });
  it('preserves the backend error and clears its timer on AI 503', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'AI недоступен. Расчётные результаты сохранены.' }), {
        status: 503,
      }),
    );
    vi.stubGlobal('fetch', fetch);
    await expect(request('/api/ai/analyze', z.object({}), {})).rejects.toMatchObject({
      status: 503,
      message: 'AI недоступен. Расчётные результаты сохранены.',
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
describe('honest UI fixtures', () => {
  it('recognizes the organizer example regardless of decision order', async () => {
    const reversed = [...exampleDecisions].reverse();
    expect(decisionKey(reversed)).toBe(decisionKey(exampleDecisions));
    const result = await api.finalize(reversed);
    expect(result.source).toBe('fixture');
    expect(result.budget.spent).toBe(95);
    expect(result.after?.score).toBe(56.54307);
  });
  it('does not fabricate a result for an arbitrary plan', async () => {
    const result = await api.simulate([{ measureId: 'M1', districtId: 'esil' }]);
    expect(result.after).toBeNull();
    expect(result.scoreDelta).toBeNull();
    expect(result.validation.status).toBe('unverified');
  });
  it('rejects finalize when the official example has a different district', async () => {
    const different = exampleDecisions.map((d, i) =>
      i === 0 ? { ...d, districtId: 'esil' as const } : d,
    );
    await expect(api.finalize(different)).rejects.toThrow('только для контрольного примера');
  });
  it('returns independent fixtures that cannot pollute subsequent requests', async () => {
    const first = await api.finalize(exampleDecisions);
    first.after!.score = 0;
    expect((await api.finalize(exampleDecisions)).after?.score).toBe(56.54307);
  });
  it('marks the sample explanation as a template', async () =>
    expect((await api.analyze(exampleResult)).source).toBe('template'));
});
