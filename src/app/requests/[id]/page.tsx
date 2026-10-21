import { notFound } from "next/navigation";
import { Alert, Badge, Card, DetailList, EmptyState, Field, PageShell, inputClass } from "@/app/_components/ui";
import { SubmitButton } from "@/app/_components/submit-button";
import { requireActiveUser } from "@/lib/auth/session";
import { isUuid, personLabel, selectableDepartments, type Approver, type Membership, type Person } from "@/lib/org/departments";
import { loadPermissions } from "@/lib/org/load-permissions";
import { allowedPurchaseTypes } from "@/lib/org/request-options";
import { PURCHASE_TYPE_LABELS } from "@/lib/org/requests";
import { isAppRole } from "@/lib/org/roles";
import { canAdminReject, canDecide, canReopen, decisionBlockReason, forwardedLines } from "@/lib/pur/decisions";
import { PUR_ERROR_MESSAGES, purErrorMessage } from "@/lib/pur/errors";
import { incompleteLinesFromDetail, incompleteLinesMessage, LINE_NAME_MAX, NOTE_MAX } from "@/lib/pur/lines";
import { purchaseNumberLabel } from "@/lib/pur/numbers";
import { toLineRow, toPurchaseRow } from "@/lib/pur/rows";
import { cancelOutcome } from "@/lib/pur/statuses";
import { formatDate, formatDateTime } from "@/lib/pur/time";
import { formatUsd, lineTotal, requestTotal } from "@/lib/pur/totals";
import type { Actor, LineRow } from "@/lib/pur/types";
import { purchaseOnBehalfCandidates } from "@/lib/pur/on-behalf";
import {
  canCancel,
  canChangeDepartment,
  canEditFields,
  canEditLines,
  canSetEditing,
  canSubmit,
} from "@/lib/pur/visibility";
import { canCopy } from "@/lib/pur/copy";
import {
  addLine,
  adminRejectPurchase,
  cancelPurchase,
  copyPurchase,
  decidePurchase,
  removeLine,
  reopenPurchase,
  saveDraft,
  setEditing,
  submitPurchase,
} from "./actions";
import { LineStatusBadge, PurchaseStatusBadge } from "../_components/status-badge";

const SAVED: Record<string, string> = {
  created: "Draft created. Fill in the lines, then submit it.",
  draft: "Changes saved.",
  line_added: "Line added.",
  line_removed: "Line removed.",
  submitted: "Request submitted and waiting for approval.",
  submitted_approved: "Request submitted and approved right away (auto-approval).",
  editing_on: "You are editing the request. Decisions are paused until you save.",
  editing_off: "Changes saved. The request is waiting for approval again.",
  cancelled: "Request cancelled.",
  copied: "Copy created as a new draft.",
  decided_approved: "Request approved.",
  decided_partially_approved: "Request partially approved: rejected lines are marked.",
  decided_rejected: "Request rejected.",
  decided_returned: "Request returned to the author for changes.",
  reopened: "Request returned to approval.",
  admin_rejected: "Request rejected.",
};

const HISTORY_LABELS: Record<string, string> = {
  submitted: "Submitted",
  approved: "Approved",
  partially_approved: "Partially approved",
  rejected: "Rejected",
  returned: "Returned for changes",
  reopened: "Returned to approval",
  cancelled: "Cancelled",
};

// Закупівля: чернетка з рядками (AC-PUR-01…10), подання (05, 09, 14, 16, 23), редагування поданої (26), скасування й копія
// (29…32), рішення схвалювача й відділу закупівель (17…28, 36, 50…52, 54), історія (37, 39, 43), видимість (03, 11, 35, 49).
// Видимість рядка вирішує RLS: чужу заявку база просто не віддає, тож сторінка дає 404 (AC-PUR-03, 49).
export default async function RequestPage({ params, searchParams }: PageProps<"/requests/[id]">) {
  const { supabase, user } = await requireActiveUser();
  const { id } = await params;
  const { saved, error, detail } = await searchParams;
  if (!isUuid(id)) notFound();

  const [requestRes, linesRes, historyRes, departmentsRes, approversRes, peopleRes, membersRes, permissions] = await Promise.all([
    supabase.from("requests").select("*").eq("id", id).eq("type", "PUR").maybeSingle(),
    supabase.from("request_lines").select("*").eq("request_id", id).order("position"),
    supabase.from("request_history").select("*").eq("request_id", id).order("created_at", { ascending: false }),
    supabase.from("departments").select("id, name"),
    supabase.from("department_approvers").select("department_id, user_id"),
    supabase.from("profiles").select("id, email, full_name, is_active, role"),
    supabase.from("department_members").select("department_id, user_id, auto_approve"),
    loadPermissions(supabase, user.id),
  ]);
  for (const result of [requestRes, linesRes, historyRes, departmentsRes, approversRes, peopleRes, membersRes]) {
    if (result.error) throw new Error(`Failed to read the request: ${result.error.message}`);
  }
  const request = requestRes.data ? toPurchaseRow(requestRes.data) : null;
  if (!request) notFound();

  const actor: Actor = { id: user.id, role: user.role, is_active: user.isActive };
  const lines = (linesRes.data ?? []).map(toLineRow).filter((l): l is LineRow => l !== null);
  const departments = departmentsRes.data ?? [];
  const approvers: Approver[] = approversRes.data ?? [];
  const people: Person[] = peopleRes.data ?? [];
  const memberships: Membership[] = (membersRes.data ?? []).map((m) => ({ ...m }));
  const names = new Map(people.map((p) => [p.id, personLabel(p)]));
  const departmentName = request.department_id ? (departments.find((d) => d.id === request.department_id)?.name ?? "—") : null;

  const editFields = canEditFields(request, actor);
  const editLines = canEditLines(request, actor);
  const editable = editFields || editLines;
  const total = requestTotal(forwardedLines(lines));
  const decide = canDecide(request, actor, approvers.filter((a) => a.department_id === request.department_id));
  const blocked = decisionBlockReason(request, actor, approvers.filter((a) => a.department_id === request.department_id));
  const isAuthor = request.author_id === user.id;
  const showActions =
    (canSetEditing(request, actor) && !request.editing) || canCopy(request, actor) || canCancel(request, actor);
  const departmentOptions = selectableDepartments(departments, memberships, user.id, user.role);
  const purchaseTypes = allowedPurchaseTypes(user.role, permissions);
  const candidates = purchaseOnBehalfCandidates(request, memberships, people, isAppRole(user.role) ? user.role : "requester");

  const savedMessage = typeof saved === "string" && Object.hasOwn(SAVED, saved) ? SAVED[saved] : undefined;
  const incomplete = error === "lines_incomplete" && typeof detail === "string" ? incompleteLinesFromDetail(detail) : [];
  const errorMessage =
    incomplete.length > 0
      ? incompleteLinesMessage(incomplete)
      : error === "invalid_input" && typeof detail === "string"
        ? detail
        : purErrorMessage(error);

  return (
    <PageShell
      title={purchaseNumberLabel(request.number)}
      description={departmentName ? `${departmentName} · ${PURCHASE_TYPE_LABELS[request.purchase_type ?? "procurement"]}` : "Draft without a department"}
      user={user}
      size="lg"
      back={{ href: "/requests", label: "All requests" }}
      actions={<PurchaseStatusBadge status={request.status} />}
    >
      <Alert message={errorMessage} />
      <Alert tone="ok" message={savedMessage} />
      {request.decision_reason && (request.status === "rejected" || request.status === "returned") ? (
        <Alert tone="warn" message={`Reason: ${request.decision_reason}`} />
      ) : null}
      {request.editing ? (
        <Alert
          tone="info"
          message={
            isAuthor
              ? "You are editing this request. Decisions are paused until you save the changes."
              : PUR_ERROR_MESSAGES.author_editing
          }
        />
      ) : null}
      {blocked === "own_request" && request.status === "pending" && actor.role !== "requester" ? (
        <Alert tone="info" message={PUR_ERROR_MESSAGES.own_request} />
      ) : null}

      {editable ? (
        <form className="flex flex-col gap-6" data-testid="purchase-form">
          <input type="hidden" name="id" value={request.id} />

          {editFields ? (
            <Card title="Details" description="Department, purchase type, delivery date and a note for the approver.">
              <div className="grid gap-4 sm:grid-cols-2">
                {canChangeDepartment(request, actor) ? (
                  <Field label="Department">
                    <select name="department_id" defaultValue={request.department_id ?? ""} className={inputClass} data-testid="department-select">
                      <option value="">Select a department</option>
                      {departmentOptions.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <div className="flex flex-col gap-1.5 text-sm font-medium text-ink">
                    Department
                    <p className="font-normal text-muted">{departmentName ?? "—"}</p>
                    <input type="hidden" name="department_id" value={request.department_id ?? ""} />
                  </div>
                )}
                <Field label="Purchase type">
                  <select name="purchase_type" defaultValue={request.purchase_type ?? "procurement"} className={inputClass}>
                    {purchaseTypes.map((p) => (
                      <option key={p} value={p}>
                        {PURCHASE_TYPE_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Delivery date">
                  <input type="date" name="delivery_date" defaultValue={request.delivery_date ?? ""} className={inputClass} />
                </Field>
                <div className="flex flex-col gap-2 text-sm font-medium text-ink">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input type="checkbox" name="on_behalf_flag" defaultChecked={request.on_behalf_of_id !== null} className="size-4" />
                    Submitting on behalf of a colleague
                  </label>
                  <select
                    name="on_behalf_of_id"
                    defaultValue={request.on_behalf_of_id ?? ""}
                    aria-label="Colleague"
                    className={inputClass}
                    data-testid="on-behalf-select"
                  >
                    <option value="">Choose a colleague</option>
                    {candidates.map((p) => (
                      <option key={p.id} value={p.id}>
                        {personLabel(p)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Note" hint={`Up to ${NOTE_MAX} characters.`} hintId="note-hint">
                    <textarea
                      name="note"
                      rows={3}
                      maxLength={NOTE_MAX}
                      defaultValue={request.note ?? ""}
                      aria-describedby="note-hint"
                      className={inputClass}
                    />
                  </Field>
                </div>
              </div>
            </Card>
          ) : null}

          <Card
            title="Lines"
            description="What you want to buy. Quantity is a whole number, unit price may be 0 when unknown."
            action={
              <SubmitButton variant="secondary" formAction={addLine} formNoValidate testId="add-line">
                Add line
              </SubmitButton>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-176 text-left text-sm" data-testid="lines">
                <thead className="text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="pb-2 pr-2 font-medium">#</th>
                    <th className="pb-2 pr-2 font-medium">Name</th>
                    <th className="pb-2 pr-2 font-medium">Purpose</th>
                    <th className="pb-2 pr-2 font-medium">Qty</th>
                    <th className="pb-2 pr-2 font-medium">Unit price</th>
                    <th className="pb-2 pr-2 text-right font-medium">Total</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {lines.map((line) => (
                    <tr key={line.id} data-testid="line-row">
                      <td className="py-2 pr-2 text-muted">{line.position}</td>
                      <td className="py-2 pr-2">
                        <input type="hidden" name="line_id" value={line.id} />
                        <input
                          name={`line_${line.id}_name`}
                          defaultValue={line.name ?? ""}
                          maxLength={LINE_NAME_MAX}
                          aria-label={`Line ${line.position} name`}
                          className={inputClass}
                          disabled={!editLines}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          name={`line_${line.id}_purpose`}
                          defaultValue={line.purpose ?? ""}
                          aria-label={`Line ${line.position} purpose`}
                          className={inputClass}
                          disabled={!editLines}
                        />
                      </td>
                      <td className="w-24 py-2 pr-2">
                        <input
                          name={`line_${line.id}_quantity`}
                          type="number"
                          min={1}
                          step={1}
                          defaultValue={line.quantity ?? ""}
                          aria-label={`Line ${line.position} quantity`}
                          className={inputClass}
                          disabled={!editLines}
                        />
                      </td>
                      <td className="w-32 py-2 pr-2">
                        <input
                          name={`line_${line.id}_unit_price`}
                          type="number"
                          min={0}
                          step="0.01"
                          defaultValue={line.unit_price ?? ""}
                          aria-label={`Line ${line.position} unit price`}
                          className={inputClass}
                          disabled={!editLines}
                        />
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums">{formatUsd(lineTotal(line))}</td>
                      <td className="py-2 text-right">
                        {editLines && lines.length > 1 ? (
                          <SubmitButton
                            variant="danger-ghost"
                            className="px-3 py-1.5"
                            formAction={removeLine}
                            name="line_id_to_remove"
                            value={line.id}
                            formNoValidate
                          >
                            Remove
                          </SubmitButton>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-right text-sm text-muted">
              Request total <span className="ml-2 text-base font-semibold tabular-nums text-ink" data-testid="request-total">{formatUsd(total)}</span>
            </p>
          </Card>

          <div className="flex flex-wrap items-center gap-3">
            {request.editing ? (
              <SubmitButton formAction={setEditing} name="editing" value="0" testId="save-changes">
                Save changes
              </SubmitButton>
            ) : (
              <>
                <SubmitButton variant="secondary" formAction={saveDraft} formNoValidate testId="save-draft">
                  Save
                </SubmitButton>
                {canSubmit(request, actor) ? (
                  <SubmitButton formAction={submitPurchase} testId="submit">
                    Submit for approval
                  </SubmitButton>
                ) : null}
              </>
            )}
          </div>
        </form>
      ) : (
        <>
          <Card title="Details">
            <DetailList
              items={[
                { label: "Department", value: departmentName ?? "—" },
                { label: "Purchase type", value: PURCHASE_TYPE_LABELS[request.purchase_type ?? "procurement"] },
                { label: "Delivery date", value: formatDate(request.delivery_date) },
                { label: "Author", value: names.get(request.author_id) ?? "—" },
                { label: "On behalf of", value: request.on_behalf_of_id ? (names.get(request.on_behalf_of_id) ?? "—") : "—" },
                { label: "Note", value: request.note ?? "—" },
                { label: "Created", value: formatDateTime(request.created_at) },
              ]}
            />
          </Card>

          <Card title="Lines" action={<Badge>{lines.length}</Badge>}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-176 text-left text-sm" data-testid="lines">
                <thead className="text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="pb-2 pr-2 font-medium">#</th>
                    <th className="pb-2 pr-2 font-medium">Name</th>
                    <th className="pb-2 pr-2 font-medium">Purpose</th>
                    <th className="pb-2 pr-2 font-medium">Qty</th>
                    <th className="pb-2 pr-2 font-medium">Unit price</th>
                    <th className="pb-2 pr-2 text-right font-medium">Total</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {lines.map((line) => (
                    <tr key={line.id} data-testid="line-row">
                      <td className="py-2 pr-2 text-muted">{line.position}</td>
                      <td className="py-2 pr-2 text-ink">{line.name ?? "—"}</td>
                      <td className="py-2 pr-2 text-muted">{line.purpose ?? "—"}</td>
                      <td className="py-2 pr-2 tabular-nums">{line.quantity ?? "—"}</td>
                      <td className="py-2 pr-2 tabular-nums">{line.unit_price === null ? "—" : formatUsd(line.unit_price)}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{formatUsd(lineTotal(line))}</td>
                      <td className="py-2">
                        <LineStatusBadge status={line.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-right text-sm text-muted">
              Request total <span className="ml-2 text-base font-semibold tabular-nums text-ink" data-testid="request-total">{formatUsd(total)}</span>
            </p>
          </Card>
        </>
      )}

      {decide ? (
        <Card title="Decision" description="Approve the request (optionally rejecting some lines), reject it or return it to the author.">
          <form className="flex flex-col gap-4" data-testid="decision-form">
            <input type="hidden" name="id" value={request.id} />
            {lines.length > 1 ? (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium text-ink">Lines to reject when approving</legend>
                {lines.map((line) => (
                  <label key={line.id} className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                    <input type="checkbox" name="rejected_line_id" value={line.id} className="size-4" />
                    {line.position}. {line.name ?? "Unnamed line"}
                  </label>
                ))}
              </fieldset>
            ) : null}
            <Field label="Reason" hint="Required to reject the request or return it to the author." hintId="reason-hint">
              <textarea name="reason" rows={3} aria-describedby="reason-hint" className={inputClass} />
            </Field>
            <div className="flex flex-wrap gap-3">
              <SubmitButton formAction={decidePurchase} name="decision" value="approve" formNoValidate testId="approve">
                Approve
              </SubmitButton>
              <SubmitButton variant="secondary" formAction={decidePurchase} name="decision" value="return" formNoValidate testId="return">
                Return to author
              </SubmitButton>
              <SubmitButton variant="danger" formAction={decidePurchase} name="decision" value="reject" formNoValidate testId="reject">
                Reject
              </SubmitButton>
            </div>
          </form>
        </Card>
      ) : null}

      {canReopen(request, actor) ? (
        <Card title="Procurement department" description="Send this request back to the approvers.">
          <form>
            <input type="hidden" name="id" value={request.id} />
            <SubmitButton variant="secondary" formAction={reopenPurchase} testId="reopen">
              Return to approval
            </SubmitButton>
          </form>
        </Card>
      ) : null}

      {canAdminReject(request, actor) ? (
        <Card title="Reject approved request" description="Available to administrators until the request is being processed.">
          <form className="flex flex-col gap-4">
            <input type="hidden" name="id" value={request.id} />
            <Field label="Reason" hintId="admin-reason-hint" hint="Required.">
              <textarea name="reason" rows={2} aria-describedby="admin-reason-hint" className={inputClass} />
            </Field>
            <SubmitButton variant="danger" formAction={adminRejectPurchase} formNoValidate testId="admin-reject">
              Reject request
            </SubmitButton>
          </form>
        </Card>
      ) : null}

      {showActions ? (
        <Card title="Actions">
          <div className="flex flex-wrap gap-3">
            {canSetEditing(request, actor) && !request.editing ? (
              <form>
                <input type="hidden" name="id" value={request.id} />
                <input type="hidden" name="editing" value="1" />
                <SubmitButton variant="secondary" formAction={setEditing} testId="edit-request">
                  Edit request
                </SubmitButton>
              </form>
            ) : null}
            {canCopy(request, actor) ? (
              <form>
                <input type="hidden" name="id" value={request.id} />
                <SubmitButton variant="secondary" formAction={copyPurchase} testId="copy">
                  Copy as new draft
                </SubmitButton>
              </form>
            ) : null}
            {canCancel(request, actor) ? (
              <form>
                <input type="hidden" name="id" value={request.id} />
                <SubmitButton
                  variant="danger-ghost"
                  formAction={cancelPurchase}
                  confirm={cancelOutcome(request.status) === "delete" ? "Delete this draft?" : "Cancel this request?"}
                  testId="cancel"
                >
                  {cancelOutcome(request.status) === "delete" ? "Delete draft" : "Cancel request"}
                </SubmitButton>
              </form>
            ) : null}
          </div>
        </Card>
      ) : null}

      <Card title="History">
        {(historyRes.data ?? []).length === 0 ? (
          <EmptyState>No history yet.</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-line" data-testid="history">
            {(historyRes.data ?? []).map((h) => (
              <li key={h.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm first:pt-0 last:pb-0">
                <span className="text-ink">
                  <span className="font-medium">{HISTORY_LABELS[h.action] ?? h.action}</span>
                  <span className="text-muted"> · {h.actor_name ?? names.get(h.actor_id) ?? "—"}</span>
                  {h.reason ? <span className="block text-muted">Reason: {h.reason}</span> : null}
                </span>
                <span className="text-xs text-muted">{formatDateTime(h.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageShell>
  );
}
