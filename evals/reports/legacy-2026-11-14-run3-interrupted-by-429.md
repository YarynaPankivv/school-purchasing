# Прогін 3 (2026-11-14, нова схема zod і набір курсу) — обірвано 429 на кейсі № 12

- Промпт: `suggest-v1`; ланцюжок моделей: `google/gemma-4-31b-it:free` → `google/gemma-4-26b-a4b-it:free` → `nvidia/nemotron-3.5-super-vl:free`; суддя не потрібен (у результаті немає вільного тексту)
- Прогонів: 1; кейсів у прогоні: 10
- **Частка успіху: 7/7 (100%)** — з кейсів, що отримали відповідь
- Поріг приймання PM (не менше 8 з 10, обов'язково № 1, 8, 11; перший прогін): **не прийнято**
- Не запущено (NOT RUN): 3 — ліміт 429, зупинено на: 12, прогін 1

| Модель, що відповіла | Пройшло | Усього |
|---|---|---|
| `nvidia/nemotron-3.5-super-vl:free` | 7 | 7 |

| Прогін | Кейс | Модель | Результат помічника | Кейс | Причина FAIL / помилка |
|---|---|---|---|---|---|
| 1 | 1 | `nvidia/nemotron-3.5-super-vl:free` | line | ✅ |  |
| 1 | 5 | `nvidia/nemotron-3.5-super-vl:free` | invalid_field | ✅ |  |
| 1 | 6 | `nvidia/nemotron-3.5-super-vl:free` | invalid_field | ✅ |  |
| 1 | 7 | `nvidia/nemotron-3.5-super-vl:free` | invalid_field | ✅ |  |
| 1 | 8 | `nvidia/nemotron-3.5-super-vl:free` | not_purchase | ✅ |  |
| 1 | 9 | `nvidia/nemotron-3.5-super-vl:free` | not_purchase | ✅ |  |
| 1 | 11 | `nvidia/nemotron-3.5-super-vl:free` | instruction | ✅ |  |
| 1 | 12 | `—` | — | NOT RUN | NOT RUN: 429 — free-model limit reached, try later |
| 1 | 13 | `—` | — | NOT RUN | NOT RUN: зупинено після 429 (12, прогін 1) |
| 1 | 14 | `—` | — | NOT RUN | NOT RUN: зупинено після 429 (12, прогін 1) |
