import { notFound } from "next/navigation";
import {
  Alert,
  Forbidden,
  PageShell,
  buttonClass,
  inputClass,
  secondaryButtonClass,
} from "@/app/_components/ui";
import { requireAdmin } from "@/lib/auth/session";
import {
  NO_APPROVER_LABEL,
  approverCandidates,
  departmentHasActiveApprover,
  memberRemovalEffects,
  personLabel,
  type RemovalEffect,
} from "@/lib/org/departments";
import { orgErrorMessage } from "@/lib/org/errors";
import { ROLE_LABELS, isAppRole } from "@/lib/org/roles";
import { addApprover, addMember, removeApprover, removeMember, setAutoApprove } from "../actions";

const EFFECT_LABELS: Record<RemovalEffect, string> = {
  approver: "схвалювача цього відділу",
  auto_approve: "автосхвалення в цьому відділі",
};

// Заявники (AC-ORG-01, 03, 15), автосхвалення (AC-ORG-06), схвалювачі (AC-ORG-02, 04, 05). Лише для admin.
export default async function DepartmentPage({ params, searchParams }: PageProps<"/admin/departments/[id]">) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return <Forbidden />;
  const { supabase } = ctx;
  const { id } = await params;
  const { error } = await searchParams;

  const [{ data: department }, { data: members }, { data: approvers }, { data: people }] = await Promise.all([
    supabase.from("departments").select("id, name").eq("id", id).maybeSingle(),
    supabase.from("department_members").select("department_id, user_id, auto_approve").eq("department_id", id),
    supabase.from("department_approvers").select("department_id, user_id").eq("department_id", id),
    supabase.from("profiles").select("id, email, full_name, role, is_active").order("email"),
  ]);
  if (!department) notFound();

  const memberRows = members ?? [];
  const approverRows = approvers ?? [];
  const everyone = people ?? [];
  const byId = new Map(everyone.map((p) => [p.id, p]));
  const memberIds = new Set(memberRows.map((m) => m.user_id));
  const notMembers = everyone.filter((p) => p.is_active && !memberIds.has(p.id));
  const candidates = approverCandidates(id, approverRows, everyone);

  return (
    <PageShell title={department.name}>
      <Alert message={orgErrorMessage(error)} />
      {departmentHasActiveApprover(id, approverRows, everyone) ? null : (
        <p className="text-sm text-amber-800">{NO_APPROVER_LABEL}</p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Заявники</h2>
        <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800" data-testid="members">
          {memberRows.map((m) => {
            const person = byId.get(m.user_id);
            const isApprover = approverRows.some((a) => a.user_id === m.user_id);
            const effects = memberRemovalEffects(id, m.user_id, memberRows, approverRows);
            return (
              <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <span>
                  {person ? personLabel(person) : m.user_id}
                  {person && isAppRole(person.role) ? (
                    <span className="ml-2 text-zinc-500">({ROLE_LABELS[person.role]})</span>
                  ) : null}
                  {isApprover ? <span className="ml-2 font-medium">схвалювач</span> : null}
                  {person && !person.is_active ? <span className="ml-2 text-zinc-500">деактивований</span> : null}
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <form action={setAutoApprove} className="flex items-center gap-2">
                    <input type="hidden" name="department_id" value={id} />
                    <input type="hidden" name="user_id" value={m.user_id} />
                    <label className="flex items-center gap-1">
                      <input type="checkbox" name="auto_approve" defaultChecked={m.auto_approve} />
                      Автосхвалення
                    </label>
                    <button type="submit" className={secondaryButtonClass}>
                      Зберегти
                    </button>
                  </form>
                  <form action={removeMember}>
                    <input type="hidden" name="department_id" value={id} />
                    <input type="hidden" name="user_id" value={m.user_id} />
                    <button
                      type="submit"
                      className={secondaryButtonClass}
                      title={
                        effects.length
                          ? `Також буде знято: ${effects.map((e) => EFFECT_LABELS[e]).join(", ")}`
                          : undefined
                      }
                    >
                      Прибрати
                    </button>
                  </form>
                </span>
                {effects.length ? (
                  <span className="w-full text-xs text-zinc-500">
                    Якщо прибрати, буде знято також: {effects.map((e) => EFFECT_LABELS[e]).join(", ")}.
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>

        <form action={addMember} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="department_id" value={id} />
          <label className="flex flex-col gap-1 text-sm">
            Додати заявника
            <select name="user_id" required className={inputClass}>
              {notMembers.map((p) => (
                <option key={p.id} value={p.id}>
                  {personLabel(p)}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={buttonClass} disabled={notMembers.length === 0}>
            Додати
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Схвалювачі</h2>
        <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800" data-testid="approvers">
          {approverRows.map((a) => {
            const person = byId.get(a.user_id);
            return (
              <li key={a.user_id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span>{person ? personLabel(person) : a.user_id}</span>
                <form action={removeApprover}>
                  <input type="hidden" name="department_id" value={id} />
                  <input type="hidden" name="user_id" value={a.user_id} />
                  <button type="submit" className={secondaryButtonClass}>
                    Зняти
                  </button>
                </form>
              </li>
            );
          })}
        </ul>

        <form action={addApprover} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="department_id" value={id} />
          <label className="flex flex-col gap-1 text-sm">
            Призначити схвалювача
            <select name="user_id" required className={inputClass}>
              {candidates.map((p) => (
                <option key={p.id} value={p.id}>
                  {personLabel(p)}
                  {memberIds.has(p.id) ? "" : " — не заявник"}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={buttonClass} disabled={candidates.length === 0}>
            Призначити
          </button>
        </form>
      </section>
    </PageShell>
  );
}
