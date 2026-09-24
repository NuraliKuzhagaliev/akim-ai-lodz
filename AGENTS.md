# AKIM AI — Аким на 5 часов

Задание пользователя: учебный AI-симулятор Астаны на синтетических данных организаторов. Старое описание протоколов совещаний к этому заданию не относится.

## Владение

- FRONTEND: `frontend/**` (Next.js).
- BACKEND / SIMULATION / INTEGRATOR: `backend/app/simulation/**`, `backend/app/models/**`, `backend/app/api/simulation/**`, `backend/app/main.py`, `backend/tests/**`, `backend/scripts/**`, `backend/docs/**`, зависимости backend, `shared/**`, общие README/AGENTS/Docker/CI.
- AI: `backend/app/ai/**`, `backend/app/api/ai/**`, `backend/app/report/**`.

Чужие модули читать можно; не изменять без явного согласования. Общий API: `shared/api-contract.md`; он согласован с `frontend/INTEGRATION.md` и `frontend/lib/types.ts`. Публичный JSON camelCase, AI-внутренние модели snake_case; адаптер находится у интегратора. Не подключать дублирующие AI-роутеры поверх адаптера.

## Расчёты

Единственная математическая реализация — Python в `backend/app/simulation/`. LLM и frontend не рассчитывают Score. Исходные данные: shared JSON. Бюджет 100, ровно 5 мер для finalize, максимум 2 одного направления, без повторов. Все несовместимости и синергии из датасета обязательны. Контроли: 52.55768 и 56.54307 при стоимости 95. Никакого округления до границы отображения. Preview явно обозначается предварительным.

## Работа

Отдельные ветки feature/frontend, feature/simulation, feature/ai. Не писать напрямую в main, не force-push. Перед публикацией читать новые версии контракта и веток участников; проверять изменения общих файлов. Не коммитить .env, ключи, виртуальные окружения, кэши и персональные данные.

## Проверки backend

Из `backend/`: `python -m pip install -r requirements-dev.txt`, `python -m pytest --cov=app --cov-report=term-missing`, `python -m ruff check app/api/simulation app/models app/simulation app/main.py tests scripts`, `python -m ruff format --check app/api/simulation app/models app/simulation app/main.py tests scripts`. Из корня: `python backend/scripts/export_fixtures.py`. После объединения с AI: `python backend/scripts/check_ai_contract.py`. После объединения с frontend: `node backend/scripts/check_frontend_contract.mjs`. Не форматировать чужие AI/frontend-файлы в backend-ветке. Проверки внешнего LLM без ключа не объявлять пройденными.
