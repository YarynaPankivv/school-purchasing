// Мутанти для scripts/mutation-check.mjs (npm run mutation:sql). Мутант = одне правило з AC, навмисно зламане.
// Джерело формату — демо-репо курсу, scripts/mutants.mjs (тег ws8-02-tests); там 11 SQL- і 2 TS-мутанти.
// Поля:
//   id, kind ("sql" | "ts"), ac (який AC це правило доводить), what (що зламано — людською мовою);
//   file — що мутуємо; tests — файли тестів, які мають довести правило (саме їх і запускаємо);
//   find — рядок або RegExp, що трапляється у файлі РІВНО один раз (надійніше за номери рядків, які зсуваються);
//   replace — заміна (вставляється буквально: «$$» у plpgsql лишається «$$»);
//   expect: "survive" + reason — лише для еквівалентного мутанта (поведінка не змінюється) з посиланням на те,
//   що робить його еквівалентним (рядок міграції, інший тест). Без reason скрипт мутант не приймає.
// Новий AC з відмовою, правило якого живе в SQL (політика, grant, функція, тригер), — новий мутант тут.
//
const PUR = "supabase/migrations/20261021140000_pur_drafts.sql";
const ORG = "supabase/migrations/20261018182200_org_departments.sql";
const REASON = "supabase/migrations/20261110075942_reason_whitespace.sql";
const SUBMIT = "supabase/migrations/20261103140000_submit_without_auto_approval.sql";
const FRM_APR_DB = "tests/db/frm-apr.test.ts";
const DEC_HIST_DB = "tests/db/dec-hist.test.ts";
const WRITE_GUARDS_DB = "tests/db/write-guards.test.ts";
const MIGRATION_LENGTH = "supabase/migrations/20261113170440_reason_purpose_length.sql";

export const mutants = [
  // ── Ваші мутанти: по одному на правило в SQL за кожним із ваших 3 AC ──────────────────────────────────────────
  // AC-APR-03 (і AC-FRM-08): схвалювач бачить і вирішує лише заявки відділів, які схвалює. Усі тести — tests/db/frm-apr.test.ts.
  {
    id: "A1", kind: "sql", ac: "AC-APR-03", file: PUR, tests: [FRM_APR_DB, DEC_HIST_DB],
    what: "requests_select: схвалювач бачить подані заявки будь-якого відділу",
    find: "      or (status <> 'draft' and department_id is not null and private.is_department_approver(department_id))",
    replace: "      or (status <> 'draft')",
  },
  {
    id: "A2", kind: "sql", ac: "AC-APR-03", file: PUR, tests: [FRM_APR_DB, DEC_HIST_DB],
    what: "can_view_request: рядки й історія чужої заявки видимі схвалювачу будь-якого відділу",
    find: "or (r.status <> 'draft' and r.department_id is not null and private.is_department_approver(r.department_id))",
    replace: "or (r.status <> 'draft')",
  },
  {
    id: "A3", kind: "sql", ac: "AC-APR-03", file: REASON, tests: [FRM_APR_DB],
    what: "decide_purchase: рішення дозволено будь-кому, хто не автор, якщо у заявки є відділ",
    find: "    or (req.department_id is not null and private.is_department_approver(req.department_id))",
    replace: "    or (req.department_id is not null)",
  },
  {
    id: "A4", kind: "sql", ac: "AC-APR-03", file: PUR, tests: [FRM_APR_DB],
    what: "is_department_approver: не перевіряє, що схвалювач саме поточний користувач",
    find: "    where a.department_id = target_department\n      and a.user_id = (select auth.uid())",
    replace: "    where a.department_id = target_department",
  },
  // AC-FRM-09: гість (anon) не читає й не подає закупівлі.
  {
    id: "F1", kind: "sql", ac: "AC-FRM-09", file: PUR, tests: [FRM_APR_DB],
    what: "submit_purchase: execute дозволено гостю (anon)",
    expect: "survive",
    reason:
      "еквівалентний: public.submit_purchase — security invoker і лише викликає private.submit_purchase, а в нього execute " +
      "забрано в anon (20261021140000_pur_drafts.sql, \"revoke execute on function private.submit_purchase(uuid) from public, anon\"), " +
      "тож гість однаково отримує permission denied; справжню межу AC-FRM-09 тримають F2 і revoke на таблиці",
    find: "grant execute on function public.submit_purchase(uuid) to authenticated;",
    replace: "grant execute on function public.submit_purchase(uuid) to authenticated, anon;",
  },
  {
    id: "F2", kind: "sql", ac: "AC-FRM-09", file: ORG, tests: [FRM_APR_DB],
    what: "requests: select дозволено гостю (anon)",
    find: "grant select, insert on table public.requests to authenticated;",
    replace: "grant select, insert on table public.requests to authenticated, anon;",
  },
  // ── Зріз 3 (WS9): рішення схвалювача й повторне подання. Усі тести — tests/db/dec-hist.test.ts ──────────────────
  // AC-DEC-06: повернення на доопрацювання без причини не виконується.
  {
    id: "D1", kind: "sql", ac: "AC-DEC-06", file: REASON, tests: [DEC_HIST_DB],
    what: "decide_purchase: причину перевіряємо лише для відхилення, повернення без причини дозволено",
    find: "    -- AC-PUR-20, 51: причина обов'язкова.\n    if clean_reason is null then",
    replace: "    -- AC-PUR-20, 51: причина обов'язкова.\n    if clean_reason is null and decision = 'reject' then",
  },
  // AC-DEC-01: відхилений рядок + схвалення = «Частково схвалено».
  {
    id: "D2", kind: "sql", ac: "AC-DEC-01", file: REASON, tests: [DEC_HIST_DB],
    what: "decide_purchase: схвалення з відхиленим рядком дає «Схвалено», а не «Частково схвалено»",
    find: "new_status := case when rejected_count = 0 then 'approved' else 'partially_approved' end;",
    replace: "new_status := 'approved';",
  },
  // AC-DEC-07: подана знову повернена заявка очікує схвалення.
  {
    id: "D3", kind: "sql", ac: "AC-DEC-07", file: SUBMIT, tests: [DEC_HIST_DB],
    what: "submit_purchase: повернена заявка після повторного подання лишається «Повернено на доопрацювання»",
    find: "     set status = 'pending', editing = false, decision_reason = null",
    replace: "     set status = case when req.status = 'returned' then req.status else 'pending' end, editing = false, decision_reason = null",
  },
  // AC-DEC-06: причина з табуляцій і переведень рядка — теж «без причини» (btrim за замовчуванням прибирає лише пробіл).
  {
    id: "D4", kind: "sql", ac: "AC-DEC-06", file: REASON, tests: [DEC_HIST_DB],
    what: "pur_clean_reason: прибирає лише пробіли, причина з табуляцій і переведень рядка проходить як змістовна",
    find: "select nullif(btrim(reason_text, E' \\t\\r\\n\\f' || chr(11) || chr(160)), '');",
    replace: "select nullif(btrim(reason_text), '');",
  },
  // AC-DEC-06: \v у E'…' PostgreSQL — літера v, тож «valid» обрізається до «alid» (вертикальна табуляція — chr(11)).
  {
    id: "D5", kind: "sql", ac: "AC-DEC-06", file: REASON, tests: [DEC_HIST_DB],
    expect: "survive",
    reason:
      "еквівалентний у тестовому середовищі: PGlite — PostgreSQL 18, де E'\\v' = вертикальна табуляція (ascii 11), тож «valid» " +
      "не псується; у supabase/config.toml major_version = 17 (\\v там — літера v), і chr(11) у 20261110075942_reason_whitespace.sql " +
      "працює однаково в обох версіях; тести AC-DEC-06 (рядок \"\\v\" і «valid reason v») доводять результат на PG 18",
    what: "pur_clean_reason: набір символів містить E'\\v' (літеру v) замість chr(11), причина «valid» зберігається як «alid»",
    find: " || chr(11) || chr(160)",
    replace: " || E'\\v' || chr(160)",
  },
  // AC-DEC-04: повернення на доопрацювання дає статус «returned», а не «rejected».
  {
    id: "D6", kind: "sql", ac: "AC-DEC-04", file: REASON, tests: [DEC_HIST_DB],
    what: "decide_purchase: повернення на доопрацювання з причиною дає статус «Відхилено», а не «Повернено на доопрацювання»",
    find: "new_status := case when decision = 'reject' then 'rejected' else 'returned' end;",
    replace: "new_status := 'rejected';",
  },
  // Межі довжини причини й мети (рев'ю PM до WS9, п. 11): без CHECK база приймає текст будь-якої довжини.
  {
    id: "L1", kind: "sql", ac: "AC-DEC-06", file: MIGRATION_LENGTH, tests: [WRITE_GUARDS_DB],
    what: "requests_decision_reason_length: межу причини знято (2000 → 2000000)",
    find: "check (char_length(decision_reason) <= 2000)",
    replace: "check (char_length(decision_reason) <= 2000000)",
  },
  {
    id: "L3", kind: "sql", ac: "AC-DEC-06", file: MIGRATION_LENGTH, tests: [WRITE_GUARDS_DB],
    what: "request_history_reason_length: межу причини в історії знято (2000 → 2000000)",
    find: "check (char_length(reason) <= 2000)",
    replace: "check (char_length(reason) <= 2000000)",
  },
  {
    id: "L2", kind: "sql", ac: "AC-DEC-06", file: MIGRATION_LENGTH, tests: [WRITE_GUARDS_DB],
    what: "request_lines_purpose_length: межу мети рядка знято (500 → 500000)",
    find: "check (char_length(purpose) <= 500)",
    replace: "check (char_length(purpose) <= 500000)",
  },
  // Пряме записування службових колонок (п. 12): column grant на requests.status відкрито автору.
  {
    id: "G1", kind: "sql", ac: "AC-DEC-01", file: PUR, tests: [WRITE_GUARDS_DB],
    what: "requests: колонковий update дозволено й для status (автор міг би сам схвалити свою заявку)",
    find: "grant update (department_id, purchase_type, note, delivery_date, on_behalf_of_id, updated_at)",
    replace: "grant update (department_id, purchase_type, note, delivery_date, on_behalf_of_id, updated_at, status)",
  },
  // AC-HIST-10: історію чужого відділу не видно — політика читання історії спирається на can_view_request.
  {
    id: "H1", kind: "sql", ac: "AC-HIST-10", file: PUR, tests: [DEC_HIST_DB],
    what: "request_history_select: історію бачить будь-який активний користувач, а не лише той, хто бачить заявку",
    find: "create policy request_history_select\n  on public.request_history\n  for select\n  to authenticated\n  using (\n    (select private.is_active_user())\n    and private.can_view_request(request_id)",
    replace: "create policy request_history_select\n  on public.request_history\n  for select\n  to authenticated\n  using (\n    (select private.is_active_user())\n    and true",
  },
  // AC-HIST-06: подання пише в історію запис «submitted» (ім'я автора й час беруться з цього рядка).
  {
    id: "H2", kind: "sql", ac: "AC-HIST-06", file: SUBMIT, tests: [DEC_HIST_DB],
    what: "submit_purchase: запис «submitted» в історію не пишеться",
    find: "perform private.pur_log(target_request, actor, 'submitted');",
    replace: "null;",
  },
  // AC-HIST-01: перша закупівля на порожній базі має номер PUR-1, а не наступний за пропущеним.
  {
    id: "N1", kind: "sql", ac: "AC-HIST-01", file: PUR, tests: [DEC_HIST_DB],
    what: "purchase_number_seq: початкове значення послідовності зсунуто на 1 (перша закупівля — PUR-2)",
    find: "coalesce((select max(number) from public.requests where type = 'PUR'), 0) + 1,",
    replace: "coalesce((select max(number) from public.requests where type = 'PUR'), 0) + 2,",
  },
  // TS-мутанти зрізу 3 (п. 6 рев'ю PM): правила HIST-02 і LANG-09 живуть у TypeScript, тож звіт Stryker замінює цей вердикт.
  {
    id: "T1", kind: "ts", ac: "AC-HIST-02", file: "src/lib/pur/totals.ts", tests: ["tests/pur/lines.test.ts", "tests/pur/pages.test.tsx"],
    what: "requestTotalCents: до суми заявки зайве додано 1 цент",
    find: "(sum, line) => sum + lineTotalCents(line), 0)",
    replace: "(sum, line) => sum + lineTotalCents(line) + 1, 0)",
  },
  {
    id: "T2", kind: "ts", ac: "AC-LANG-09", file: "src/lib/pur/statuses.ts", tests: ["tests/pur/pages.test.tsx", "tests/ui/interface-language.test.ts"],
    what: "PURCHASE_STATUS_LABELS: підпис «Partially approved» замінено на «Approved»",
    find: 'partially_approved: "Partially approved",',
    replace: 'partially_approved: "Approved",',
  },
];

// Приклади з демо (інша схема — у вашому репо цих файлів немає, тож не розкоментовуйте як є):
//
// SQL, межа з AC — діапазон напіввідкритий, останній день заявки не рахується:
//   { id: "L2", kind: "sql", ac: "AC-LEAVE-11", file: RULES, tests: [LEAVE_DB],
//     what: "перетин: діапазон НОВОЇ заявки напіввідкритий [початок, кінець)",
//     find: "pg_catalog.daterange(p_start_date, p_end_date, '[]')",
//     replace: "pg_catalog.daterange(p_start_date, p_end_date, '[)')" },
//
// SQL, політика послаблена до true (а не видалена: без політики RLS забороняє все, і тест відмови лишився б зеленим):
//   { id: "L5", kind: "sql", ac: "передумова AC-LEAVE-04/10", file: LEAVE, tests: [LEAVE_DB],
//     what: "blocked_days: insert дозволено будь-кому з входом, а не лише адміністратору",
//     find: "on public.blocked_days for insert to authenticated\n  with check ((select private.current_app_role()) = 'admin');",
//     replace: "on public.blocked_days for insert to authenticated\n  with check (true);" },
//
// Еквівалентний мутант — лише з reason, що посилається на рядок, який робить його зайвим:
//   { id: "L6", kind: "sql", ac: "AC-LEAVE-06/07", file: RECORDS, tests: [LEAVE_DB],
//     what: "політика рішень: прибрано role = 'manager'", expect: "survive",
//     reason: "еквівалентний: з 20261018000000_manager_helpers_require_role.sql private.is_division_manager() сама " +
//       "перевіряє current_app_role() = 'manager'", find: "…", replace: "…" },
//
// TS, точковий мутант на межі з AC (повний перебір TS — npm run mutation:ts, Stryker):
//   { id: "T1", kind: "ts", ac: "AC-LEAVE-11", file: "src/lib/leave/calendar.ts", tests: ["tests/leave/calendar.test.ts"],
//     what: "rangesOverlap: <= → <", find: "b.startDate <= a.endDate", replace: "b.startDate < a.endDate" },
