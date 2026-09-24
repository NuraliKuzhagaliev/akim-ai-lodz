# Контракты frontend и backend

Действующий общий контракт: [shared/api-contract.md](../shared/api-contract.md). Машинная схема: [OpenAPI](../shared/openapi.json). В этой локальной версии все перечисленные маршруты реализованы.

| Метод | Путь | Назначение |
| --- | --- | --- |
| GET | /api/districts | Пять районов |
| GET | /api/measures | 14 мер |
| POST | /api/simulate | Preview для 0–5 решений |
| POST | /api/scenario/finalize | Итог ровно пяти допустимых решений |
| POST | /api/recommend | Лучшая допустимая замена одного решения |
| POST | /api/ai/analyze | Анализ полного плана |
| POST | /api/ai/advice | Совет по одному добавлению |
| POST | /api/ai/compare | Объяснение различий двух планов |
| POST | /api/report/executive-brief | JSON-отчёт с полем markdown |

Decision: `{measureId:"M7", districtId:"nura"}`; для общегородской меры districtId отсутствует.
Районы: esil, almaty, saryarka, baikonur, nura.
Для simulate/finalize/recommend/advice/report отправляется `{decisions:Decision[]}`.
Анализ использует адаптер `createAnalysisRequest`; сервер извлекает решения и заново считает факты.

## AI-сравнение

Вход: `{originalDecisions:Decision[], alternativeDecisions:Decision[], question?:string}`.
Сервер финализирует оба набора; ошибочный набор даёт 422 до вызова AI.
Ответ: `{originalScenarioId, alternativeScenarioId, modelVersion, dataChecksum, analysis}`.
analysis: strengths, risks, tradeoffs — массивы `{text,evidence:string[]}`; recommendations — строки; answer — строка или null.
Frontend сверяет оба ID и версию данных, отбрасывает ответ для других планов. SDK-таймаут 45 секунд без повторов, frontend 60 секунд. Ошибка провайдера — 503, числовое сравнение сохраняется.

## Советник и отчёт

Советник принимает 0–4 решения. Возвращает priority, reason, suggestions с measure_id/district_id, validation_mode=individual_additions и base_scenario_id. Предложения — отдельные варианты. При изменении плана совет сбрасывается, применение снова вызывает simulate.

Отчёт принимает только решения. На сервере заново формируются snapshot и AI-анализ. Frontend проверяет схему, соответствие решений, Score и бюджета текущему результату; Markdown показывается как текст, не как HTML. Скачивание использует Blob и временную ссылку в документе.

## Окружение

Скопируйте `.env.example` в `.env.local`. Режим live, URL API без /api, оба флага true.
Backend CORS должен разрешать фактический origin сайта. localhost и 127.0.0.1 — разные origin.
После смены NEXT_PUBLIC-переменных перезапустите dev или пересоберите production. Ключ модели находится только на сервере.

## Приёмка

Контрольный план: 95 → 56.54307. Замена M5/Сарыарка на M3/Нура: 100 → 57.20556, прирост 0.66249 и потеря Сарыарки 1.2125.
Проверить сохранение, сравнение, повторный finalize после замены, недопустимый набор, ошибку AI без потери чисел, совет и Markdown-отчёт.
Настоящий AI требует ключа; контролируемые провайдеры в тестах подтверждают формат и интеграцию, а не качество внешней модели.
