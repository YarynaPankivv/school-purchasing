"use client";

// Фільтр за відділом: вибір одразу відкриває відфільтрований список (без кнопки «Apply»). Адреси для кожного вибору
// будує сторінка (вона знає решту параметрів), тут лише перехід.
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui";

export function DepartmentFilter({
  current,
  options,
  hrefs,
}: {
  current: string;
  options: Array<{ value: string; label: string }>;
  hrefs: Record<string, string>;
}) {
  const router = useRouter();
  return (
    // key: після «Clear search» чи іншого фільтра вибір у списку скидається разом із адресою.
    <Select
      key={current}
      aria-label="Department"
      className="h-11 sm:h-9 sm:py-0"
      defaultValue={current}
      onChange={(event) => router.push(hrefs[event.target.value] ?? "/requests")}
    >
      <option value="">All departments</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}
