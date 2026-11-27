-- WS11, SLO-2: запис у ai_call_log лише через функцію, а не прямим INSERT (частку SLO-2 не можна «намалювати» запитами з боку клієнта).
-- Було: колонковий `grant insert` для authenticated + політика «лише свій user_id» дозволяли будь-якому активному
-- користувачу дописувати через PostgREST скільки завгодно рядків `unavailable` і псувати частку SLO-2.
-- Стало: прямого INSERT немає; запис — `public.record_ai_call(...)` (security invoker, лише обгортка) → `private.record_ai_call`
-- (security definer, порожній search_path): перевіряє активного користувача, формат полів (CHECK таблиці) і ліміт на
-- користувача, тож підробити частку можна лише дуже повільно. Повністю закрити шлях не можна: секрету service_role у
-- Vercel немає за правилом проєкту, тож server action пише від імені користувача (docs/decisions/0009-ai-call-log-write-path.md).
create function private.record_ai_call(
  p_state text,
  p_error_kind text,
  p_model text,
  p_fallback_used boolean,
  p_latency_ms integer,
  p_prompt_version text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  recent integer;
begin
  if actor is null or not private.is_active_user() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  -- Ліміт на користувача: 20 запитів на хвилину — стеля безкоштовних моделей; більше за годину справжній працівник не дає.
  -- Транзакційне блокування на користувача: паралельні виклики одного користувача рахують і вставляють по черзі, тож за
  -- READ COMMITTED два виклики на межі 199 → 200 не проходять обидва.
  perform pg_advisory_xact_lock(hashtextextended(actor::text, 0));
  select count(*) into recent
    from public.ai_call_log
    where user_id = actor and created_at > now() - interval '1 hour';
  if recent >= 200 then
    raise exception 'too many records' using errcode = '54000';
  end if;
  insert into public.ai_call_log (user_id, state, error_kind, model, fallback_used, latency_ms, prompt_version)
  values (actor, p_state, p_error_kind, p_model, coalesce(p_fallback_used, false), p_latency_ms, p_prompt_version);
end;
$$;

revoke all on function private.record_ai_call(text, text, text, boolean, integer, text) from public, anon;
grant execute on function private.record_ai_call(text, text, text, boolean, integer, text) to authenticated;

-- Обгортка в public, бо PostgREST (supabase.rpc) викликає лише схему public; сама нічого не вирішує.
create function public.record_ai_call(
  p_state text,
  p_error_kind text,
  p_model text,
  p_fallback_used boolean,
  p_latency_ms integer,
  p_prompt_version text
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.record_ai_call(p_state, p_error_kind, p_model, p_fallback_used, p_latency_ms, p_prompt_version);
$$;

revoke all on function public.record_ai_call(text, text, text, boolean, integer, text) from public, anon;
grant execute on function public.record_ai_call(text, text, text, boolean, integer, text) to authenticated;

-- Прямий INSERT більше не потрібен: прибираємо і колонковий grant, і політику.
revoke insert on table public.ai_call_log from authenticated;
revoke insert (state, error_kind, model, fallback_used, latency_ms, prompt_version) on table public.ai_call_log from authenticated;
drop policy if exists ai_call_log_insert_own on public.ai_call_log;
