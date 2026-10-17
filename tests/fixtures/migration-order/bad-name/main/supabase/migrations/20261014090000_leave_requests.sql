-- Фікстура: заявки (застосована міграція).
create table if not exists public.leave_requests (id bigint generated always as identity primary key);
