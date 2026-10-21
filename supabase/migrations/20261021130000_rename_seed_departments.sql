-- Інтерфейс став англійським, а seed.sql тепер створює відділи з англійськими назвами. seed.sql ідемпотентний за
-- lower(name) і вже наповнені бази не перейменує — без цього `on conflict do nothing` додав би дублікати
-- («Початкова школа» і «Primary School»). Перейменовуємо лише три відділи сиду, зберігаючи їхні id, а тому й
-- членство, схвалювачів та заявки. Ризик: деструктивних змін немає, але назви відділів, які бачать користувачі, зміняться.
-- Якщо англійська назва вже зайнята (унікальний індекс по lower(name)) — рядок не чіпаємо.

update public.departments as d
set name = renamed.new_name
from (
  values
    ('Початкова школа', 'Primary School'),
    ('Вища школа', 'Upper School'),
    ('Офіс', 'Office')
) as renamed (old_name, new_name)
where d.name = renamed.old_name
  and not exists (
    select 1 from public.departments as other where lower(other.name) = lower(renamed.new_name)
  );
