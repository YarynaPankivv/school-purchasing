-- Фікстура: заявки (застосована міграція).
create table if not exists public.leave_requests (id bigint generated always as identity primary key);
-- додано в PR
alter table public.leave_requests add column note text;
