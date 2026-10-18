import { Alert, PageShell, buttonClass, inputClass } from "@/app/_components/ui";
import { requireActiveUser } from "@/lib/auth/session";
import { selectableDepartments } from "@/lib/org/departments";
import { orgErrorMessage } from "@/lib/org/errors";
import { BASE_REQUEST_TYPES, PURCHASE_TYPE_LABELS, REQUEST_TYPE_LABELS } from "@/lib/org/requests";
import { createDraftRequest } from "./actions";

// Нова чернетка заявки: лише від імені відділів, де працівник заявник (AC-ORG-01).
// Типи поки «Закупівля» й «Відшкодування»; решта — за дозволами (задача 2).
export default async function NewRequestPage({ searchParams }: PageProps<"/requests/new">) {
  const { supabase, user } = await requireActiveUser();
  const { error, created } = await searchParams;

  const [{ data: departments }, { data: memberships }] = await Promise.all([
    supabase.from("departments").select("id, name"),
    supabase.from("department_members").select("department_id, user_id").eq("user_id", user.id),
  ]);
  const options = selectableDepartments(departments ?? [], memberships ?? [], user.id);

  return (
    <PageShell title="Нова заявка">
      <Alert message={orgErrorMessage(error)} />
      <Alert tone="ok" message={created === "1" ? "Чернетку заявки створено." : undefined} />

      {options.length === 0 ? (
        <p className="text-sm text-zinc-600" data-testid="no-departments">
          Вас ще не додано до жодного відділу як заявника, тож створити заявку поки не можна.
        </p>
      ) : (
        <form action={createDraftRequest} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Відділ
            <select name="department_id" required className={inputClass} data-testid="department-select">
              {options.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Тип заявки
            <select name="type" required className={inputClass} data-testid="type-select">
              {BASE_REQUEST_TYPES.map((t) => (
                <option key={t} value={t}>
                  {REQUEST_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-zinc-500">
            Тип закупівлі: «{PURCHASE_TYPE_LABELS.procurement}».
          </p>
          <button type="submit" className={buttonClass}>
            Створити чернетку
          </button>
        </form>
      )}
    </PageShell>
  );
}
