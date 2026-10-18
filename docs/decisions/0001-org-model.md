# 0001. Модель відділів, ролей і доступу зрізу ORG

- Статус: прийнято
- Дата: 2026-10-18
- AC: AC-ORG-01, AC-ORG-02, AC-ORG-03, AC-ORG-04, AC-ORG-05, AC-ORG-06, AC-ORG-07, AC-ORG-08, AC-ORG-11, AC-ORG-12,
  AC-ORG-14, AC-ORG-15, AC-ORG-16, AC-ORG-17

## Контекст

Зріз ORG (специфікація `openspec/specs/{departments,request-permissions,user-administration}`) вимагає, щоб
налаштування відділів «не суперечили одне одному»: схвалювач — лише заявник відділу, зняття заявника знімає
схвалювача й автосхвалення, роль працівника випливає з того, що він схвалює. Supabase-js не має транзакцій, а server
actions доступні прямим POST-запитом, тож правила, які тримає лише застосунок, можна обійти через Data API.
Повний план — `openspec/changes/impl-org/design.md` (D2–D6).

## Рішення

- `departments` (назва до 100 символів, унікальна без регістру), `department_members(department_id, user_id,
  auto_approve)`, `department_approvers` зі **складеним FK** на `department_members … on delete cascade`: схвалювач
  лише із заявників (AC-ORG-02, код 23503), каскад знімає схвалювача (AC-ORG-03), автосхвалення — колонка членства
  (AC-ORG-06, AC-ORG-15).
- Роль `requester`/`approver` **похідна**: тригер на `department_approvers` викликає `private.sync_role()`; `admin`
  тригер не чіпає (AC-ORG-04, 05, 11; тимчасово Q3, Q4, Q6 — `design.md` D10).
- `profiles.is_active`; кожна нова політика RLS, крім `profiles_select_own`, вимагає активного користувача.
- Дозволи — окрема таблиця `user_permissions` (задача 2), а не колонки `profiles`: на `profiles` є політика «оновлюю
  свій рядок».
- Мінімальна `requests` з RLS, що відхиляє на сервері все, чого не показує UI (AC-ORG-01, 07, 08, 17); у задачі 1 —
  лише `PUR` + `procurement` або `RMB`.

## Розглянуті варіанти

- Одна таблиця членства з прапорцем `is_approver` — ні: правило «схвалювач ⇒ заявник» і каскад AC-ORG-03 тоді
  тримали б CHECK і тригер замість одного FK.
- Обчислювати роль у server action — ні: каскад AC-ORG-03 відбувається в базі, і роль розійшлася б із даними.
- Бан деактивованих через Admin API — ні: потрібен секретний ключ у Vercel, а його там не тримаємо.

## Наслідки

- Простіше: інваріанти перевіряє база, server actions — одна інструкція SQL без транзакцій у клієнті.
- Складніше: правила продубльовано в TS (`src/lib/org/*`) для UI й тестів; Vitest у CI працює без бази, тож RLS і
  тригери перевіряють `db-check` і ручний прохід на Preview.
- Відповіді PM на Q1–Q6 змінять `private.sync_role()` і `requests_insert` — новою міграцією.
