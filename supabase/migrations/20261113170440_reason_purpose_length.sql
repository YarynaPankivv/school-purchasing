-- Межі довжини вільного тексту (рев'ю PM до WS9, пункт 11): причина рішення, запис історії й мета рядка були без обмеження.
-- Межі такі самі, як у суміжних полів: причина ≤ 2000 (як нотатка заявки), мета ≤ 500 (як назва рядка).
-- NOT VALID: наявні рядки не перевіряємо (міграція не може впасти на старих даних), а новий insert і update перевіряє база;
-- помилка CHECK (23514) в застосунку показується як «Some of the entered values are not valid.».
alter table public.requests
  add constraint requests_decision_reason_length check (char_length(decision_reason) <= 2000) not valid;

alter table public.request_history
  add constraint request_history_reason_length check (char_length(reason) <= 2000) not valid;

alter table public.request_lines
  add constraint request_lines_purpose_length check (char_length(purpose) <= 500) not valid;
