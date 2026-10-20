import { Alert, PageShell, buttonClass, inputClass } from "@/app/_components/ui";
import { requireActiveUser } from "@/lib/auth/session";
import { selectableDepartments } from "@/lib/org/departments";
import { orgErrorMessage } from "@/lib/org/errors";
import { loadPermissions } from "@/lib/org/load-permissions";
import { allowedPurchaseTypes, allowedRequestTypes } from "@/lib/org/request-options";
import { PURCHASE_TYPE_LABELS, REQUEST_TYPE_LABELS } from "@/lib/org/requests";
import { createDraftRequest } from "./actions";

// Нова чернетка заявки: не-admin — лише від імені відділів, де він заявник (AC-ORG-01), admin — будь-якого
// (AC-ORG-22); типи заявки й закупівлі — за дозволами (AC-ORG-07, AC-ORG-08, AC-ORG-17, AC-ORG-23).
export default async function NewRequestPage({ searchParams }: PageProps<"/requests/new">) {
  const { supabase, user } = await requireActiveUser();
  const { error, created } = await searchParams;

  const [{ data: departments }, { data: memberships }, permissions] = await Promise.all([
    supabase.from("departments").select("id, name"),
    supabase.from("department_members").select("department_id, user_id").eq("user_id", user.id),
    loadPermissions(supabase, user.id),
  ]);
  const options = selectableDepartments(departments ?? [], memberships ?? [], user.id, user.role);
  const types = allowedRequestTypes(user.role, permissions);
  const purchaseTypes = allowedPurchaseTypes(user.role, permissions);

  return (
    <PageShell title="Нова заявка">
      <Alert message={orgErrorMessage(error)} />
      <Alert tone="ok" message={created === "1" ? "Чернетку заявки створено." : undefined} />

      {options.length === 0 ? (
        <p className="text-sm text-zinc-600" data-testid="no-departments">
          {user.role === "admin"
            ? "У системі ще немає жодного відділу, тож створити заявку поки не можна."
            : "Вас ще не додано до жодного відділу як заявника, тож створити заявку поки не можна."}
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
              {types.map((t) => (
                <option key={t} value={t}>
                  {REQUEST_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Тип закупівлі (лише для «{REQUEST_TYPE_LABELS.PUR}»)
            <select name="purchase_type" className={inputClass} data-testid="purchase-type-select">
              {purchaseTypes.map((p) => (
                <option key={p} value={p}>
                  {PURCHASE_TYPE_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={buttonClass}>
            Створити чернетку
          </button>
        </form>
      )}
    </PageShell>
  );
}
