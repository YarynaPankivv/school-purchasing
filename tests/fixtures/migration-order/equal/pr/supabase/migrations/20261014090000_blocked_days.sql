-- Фікстура: нова міграція з PR.
create table if not exists public.blocked_days (day date primary key);
