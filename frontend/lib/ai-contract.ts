// Adapter for feature/ai @ 03cd8a0 (backend/app/ai/schemas.py).
// This translates already calculated facts; it never computes simulation results.
import { z } from 'zod';
import type { Analysis, Measure, Simulation } from './types';
const findingSchema = z.object({ text: z.string(), evidence: z.array(z.string()).default([]) });
export const aiResponseSchema = z.object({
  strengths: z.array(findingSchema),
  risks: z.array(findingSchema),
  tradeoffs: z.array(findingSchema),
  recommendations: z.array(z.string()),
  answer: z.string().nullable().optional(),
});
// Both plans are recalculated by /api/ai/compare before explanation.
export const comparisonResponseSchema = z.object({
  originalScenarioId: z.string(),
  alternativeScenarioId: z.string(),
  modelVersion: z.string(),
  dataChecksum: z.string(),
  analysis: aiResponseSchema,
});
export function createComparisonRequest(original: Simulation, alternative: Simulation) {
  for (const result of [original, alternative]) {
    if (
      result.source !== 'backend' ||
      result.validation.status !== 'valid' ||
      !result.after ||
      result.decisions.length !== 5 ||
      !result.scenarioId ||
      !result.dataChecksum
    ) {
      throw new Error('Для сравнения нужны два подтверждённых сервером плана.');
    }
  }
  if (
    original.modelVersion !== alternative.modelVersion ||
    original.dataChecksum !== alternative.dataChecksum
  ) {
    throw new Error('Планы рассчитаны на разных версиях данных. Пересчитайте их.');
  }
  return { originalDecisions: original.decisions, alternativeDecisions: alternative.decisions };
}
export function normalizeComparison(
  response: z.infer<typeof comparisonResponseSchema>,
  original: Simulation,
  alternative: Simulation,
) {
  if (
    response.originalScenarioId !== original.scenarioId ||
    response.alternativeScenarioId !== alternative.scenarioId ||
    response.modelVersion !== original.modelVersion ||
    response.dataChecksum !== original.dataChecksum
  ) {
    throw new Error(
      'AI-сравнение относится к другим планам или версии данных. Пересчитайте планы.',
    );
  }
  return normalizeAnalysis(response.analysis);
}
export function createAnalysisRequest(result: Simulation, catalog: Measure[]) {
  if (!result.after || result.scoreDelta === null || result.validation.status !== 'valid') {
    throw new Error('Для AI-анализа нужен подтверждённый результат симуляции.');
  }
  return {
    scenario: {
      score_before: result.before.score,
      score_after: result.after.score,
      score_delta: result.scoreDelta,
      budget: {
        initial: result.budget.total,
        spent: result.budget.spent,
        remaining: result.budget.remaining,
      },
      decisions: result.decisions.map((decision) => {
        const measure = catalog.find((item) => item.id === decision.measureId);
        if (!measure) throw new Error(`Мера ${decision.measureId} отсутствует в каталоге сервера.`);
        return {
          measure_id: decision.measureId,
          name: measure.name,
          category: measure.category,
          scope: measure.scope,
          cost: measure.cost,
          district_id: decision.districtId ?? null,
          district_name: decision.districtId
            ? result.before.districts.find((item) => item.id === decision.districtId)!.name
            : null,
          contribution:
            result.contributions.find(
              (item) =>
                item.measureId === decision.measureId && item.districtId === decision.districtId,
            )?.scoreImpact ?? null,
        };
      }),
      districts: result.after.districts.map((district) => {
        const before = result.before.districts.find((item) => item.id === district.id)!;
        return {
          district_id: district.id,
          district_name: district.name,
          before_score: before.score,
          after_score: district.score,
          indicators_before: before.indicators,
          indicators_after: district.indicators,
        };
      }),
      category_scores: [],
      critical_indicators_before: result.before.criticalCount,
      critical_indicators_after: result.after.criticalCount,
      synergies: result.synergies.map((item) => item.description),
    },
  };
}
export function normalizeAnalysis(response: z.infer<typeof aiResponseSchema>): Analysis {
  return {
    source: 'ai',
    summary: response.answer ?? '',
    strengths: response.strengths.map((item) => item.text),
    risks: response.risks.map((item) => item.text),
    tradeoffs: response.tradeoffs.map((item) => item.text),
    recommendations: response.recommendations,
    evidence: Object.fromEntries(
      ['strengths', 'risks', 'tradeoffs'].flatMap((key) =>
        response[key as 'strengths' | 'risks' | 'tradeoffs'].map((item, index) => [
          `${key}:${index}`,
          item.evidence,
        ]),
      ),
    ),
  };
}
