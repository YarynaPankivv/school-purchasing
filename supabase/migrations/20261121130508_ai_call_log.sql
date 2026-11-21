-- WS11, SLO-2 (операційні вимоги PM, issue ValiaBihun/2026-quitcode-dream-team#83): частка запитів помічника
-- «Suggest lines» без стану «недоступний» за 28 днів. Журнали Vercel Hobby живуть 1 годину, Supabase Free — 1 день,
-- тому стан кожної відповіді зберігаємо в базі: тут лише технічні поля, БЕЗ тексту користувача, промпту й відповіді моделі
-- (такого стовпця немає, а формат кожного поля обмежений CHECK). Читає таблицю лише service_role (npm run ai:slo);
-- звичайний користувач може тільки дописати рядок про власний виклик. Рядки не видаляємо: обсяг малий (≈ 450 на місяць).
create table public.ai_call_log (
  id             bigint generated always as identity primary key,
  created_at     timestamptz not null default now(),
  user_id        uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  state          text not null,
  error_kind     text,
  model          text,
  fallback_used  boolean not null default false,
  latency_ms     integer,
  prompt_version text not null,
  constraint ai_call_log_state_check check (state in ('ok', 'needs_info', 'refused', 'unavailable')),
  -- КОД причини (timeout, limit, error), ніколи не текст повідомлення про помилку.
  constraint ai_call_log_error_kind_check check (error_kind is null or error_kind ~ '^[a-z_]{1,40}$'),
  constraint ai_call_log_model_check check (model is null or model ~ '^[A-Za-z0-9._:/-]{1,120}$'),
  constraint ai_call_log_prompt_version_check check (prompt_version ~ '^[A-Za-z0-9._-]{1,40}$'),
  constraint ai_call_log_latency_check check (latency_ms is null or latency_ms >= 0)
);

create index ai_call_log_created_at_idx on public.ai_call_log (created_at);

comment on table public.ai_call_log is
  'Журнал викликів AI-помічника (SLO-2): стан, причина, модель, затримка, версія промпту. Без тексту користувача. Читає service_role.';

alter table public.ai_call_log enable row level security;

revoke all on table public.ai_call_log from anon, authenticated;
-- Колонковий grant: користувач дописує лише ці поля; id, created_at і user_id — за замовчуванням (user_id = auth.uid()).
grant insert (state, error_kind, model, fallback_used, latency_ms, prompt_version) on table public.ai_call_log to authenticated;
grant select, insert on table public.ai_call_log to service_role;

-- Лише INSERT і лише про себе; SELECT, UPDATE, DELETE для authenticated політик немає.
create policy ai_call_log_insert_own on public.ai_call_log
  for insert to authenticated
  with check (user_id = (select auth.uid()));
