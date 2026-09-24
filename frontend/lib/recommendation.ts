import { indicatorIds, type Decision, type Recommendation, type Simulation } from './types';

const key = (decision: Decision) => `${decision.measureId}:${decision.districtId ?? ''}`;
const keys = (decisions: Decision[]) => decisions.map(key).sort().join('|');
const complete = (result: Simulation) =>
  result.source === 'backend' &&
  result.validation.status === 'valid' &&
  result.validation.errors.length === 0 &&
  result.after !== null &&
  result.decisions.length === 5 &&
  new Set(result.decisions.map((d) => d.measureId)).size === 5;

// These checks bind a response to its original plan; simulation remains server-owned.
export function checkedReplacement(original: Simulation, recommendation: Recommendation) {
  if (!complete(original)) throw new Error('Сначала завершите расчёт исходного плана на сервере.');
  if (recommendation.validCandidates > recommendation.candidatesChecked) {
    throw new Error('Сервер вернул несогласованную статистику поиска.');
  }
  if (!recommendation.found) {
    if (
      recommendation.result ||
      recommendation.decisions ||
      recommendation.costDelta !== null ||
      recommendation.scoreDelta !== null ||
      recommendation.weakestScoreDelta !== null
    ) {
      throw new Error('Сервер вернул противоречивый результат поиска. Повторите запрос.');
    }
    return null;
  }
  const { result, decisions } = recommendation;
  if (!result || !decisions || !complete(result) || keys(decisions) !== keys(result.decisions)) {
    throw new Error('Сервер не подтвердил полный результат предложенной замены.');
  }
  const sameBaseline =
    original.before.score === result.before.score &&
    original.before.cityAverage === result.before.cityAverage &&
    original.before.weakestDistrictId === result.before.weakestDistrictId &&
    original.before.criticalCount === result.before.criticalCount &&
    original.before.districts.every((district) => {
      const other = result.before.districts.find((d) => d.id === district.id);
      return (
        other &&
        district.score === other.score &&
        district.populationShare === other.populationShare &&
        indicatorIds.every((id) => district.indicators[id] === other.indicators[id])
      );
    });
  if (
    result.modelVersion !== original.modelVersion ||
    result.dataChecksum !== original.dataChecksum ||
    !sameBaseline ||
    result.budget.total !== original.budget.total
  ) {
    throw new Error('Данные модели изменились. Пересчитайте исходный план перед сравнением.');
  }
  const removed = original.decisions.filter(
    (d) => !result.decisions.some((other) => key(d) === key(other)),
  );
  const added = result.decisions.filter(
    (d) => !original.decisions.some((other) => key(d) === key(other)),
  );
  if (removed.length !== 1 || added.length !== 1) {
    throw new Error('Ответ сервера должен содержать ровно одну замену. Исходный план сохранён.');
  }
  const originalWeakest = original.after!.districts.find(
    (d) => d.id === original.after!.weakestDistrictId,
  )!;
  const suggestedWeakest = result.after!.districts.find(
    (d) => d.id === result.after!.weakestDistrictId,
  )!;
  // Only compare returned values, never recalculate scores or select alternatives.
  const matches = (value: number | null, expected: number) =>
    value !== null && Math.abs(value - expected) < 0.00002;
  if (
    !matches(recommendation.costDelta, result.budget.spent - original.budget.spent) ||
    !matches(recommendation.scoreDelta, result.after!.score - original.after!.score) ||
    !matches(recommendation.weakestScoreDelta, suggestedWeakest.score - originalWeakest.score) ||
    result.after!.score <= original.after!.score
  ) {
    throw new Error('Показатели замены не согласованы с результатами планов. Повторите запрос.');
  }
  return {
    result,
    decisions,
    removed: removed[0],
    added: added[0],
    originalWeakest,
    suggestedWeakest,
  };
}
