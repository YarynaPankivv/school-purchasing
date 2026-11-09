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
const SUBMIT = "supabase/migrations/20261103140000_submit_without_auto_approval.sql";
const FRM_APR_DB = "tests/db/frm-apr.test.ts";
const DEC_HIST_DB = "tests/db/dec-hist.test.ts";

export const mutants = [
  // ── Ваші мутанти: по одному на правило в SQL за кожним із ваших 3 AC ──────────────────────────────────────────
  // AC-APR-03 (і AC-FRM-08): схвалювач бачить і вирішує лише заявки відділів, які схвалює. Усі тести — tests/db/frm-apr.test.ts.
  {
    id: "A1", kind: "sql", ac: "AC-APR-03", file: PUR, tests: [FRM_APR_DB],
    what: "requests_select: схвалювач бачить подані заявки будь-якого відділу",
    find: "      or (status <> 'draft' and department_id is not null and private.is_department_approver(department_id))",
    replace: "      or (status <> 'draft')",
  },
  {
    id: "A2", kind: "sql", ac: "AC-APR-03", file: PUR, tests: [FRM_APR_DB],
    what: "can_view_request: рядки й історія чужої заявки видимі схвалювачу будь-якого відділу",
    find: "or (r.status <> 'draft' and r.department_id is not null and private.is_department_approver(r.department_id))",
    replace: "or (r.status <> 'draft')",
  },
  {
    id: "A3", kind: "sql", ac: "AC-APR-03", file: PUR, tests: [FRM_APR_DB],
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
    id: "D1", kind: "sql", ac: "AC-DEC-06", file: PUR, tests: [DEC_HIST_DB],
    what: "decide_purchase: причину перевіряємо лише для відхилення, повернення без причини дозволено",
    find: "    -- AC-PUR-20, 51: причина обов'язкова.\n    if clean_reason is null then",
    replace: "    -- AC-PUR-20, 51: причина обов'язкова.\n    if clean_reason is null and decision = 'reject' then",
  },
  // AC-DEC-01: відхилений рядок + схвалення = «Частково схвалено».
  {
    id: "D2", kind: "sql", ac: "AC-DEC-01", file: PUR, tests: [DEC_HIST_DB],
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
