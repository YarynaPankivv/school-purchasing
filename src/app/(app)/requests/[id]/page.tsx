import type { Metadata } from "next";
import { Suspense } from "react";
import { RequestDetailSkeleton } from "@/components/ui";
import { notFound } from "next/navigation";
import {
  Alert,
  Badge,
  Card,
  Checkbox,
  DateField,
  DetailList,
  EmptyState,
  Field,
  Input,
  PageShell,
  Select,
  SubmitButton,
  SummaryStrip,
  Textarea,
} from "@/components/ui";
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
import { itemsSummary } from "@/lib/pur/summary";
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
import { safeBack } from "../_lib/nav";

const SAVED: Record<string, string> = {
  created: "Draft created. Fill in the lines, then submit it.",
  draft: "Changes saved.",
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

export const metadata: Metadata = { title: "Request · School Purchasing" };

// Закупівля: чернетка з рядками (AC-PUR-01…10), подання (05, 09, 14, 16, 23), редагування поданої (26), скасування й копія
// (29…32), рішення схвалювача й відділу закупівель (17…28, 36, 50…52, 54), історія (37, 39, 43), видимість (03, 11, 35, 49).
// Видимість рядка вирішує RLS: чужу заявку база просто не віддає, тож сторінка дає 404 (AC-PUR-03, 49).
export async function RequestPageContent({ params, searchParams }: PageProps<"/requests/[id]">) {
  const { supabase, user } = await requireActiveUser();
  const { id } = await params;
  const { saved, error, detail, back: rawBack } = await searchParams;
  if (!isUuid(id)) notFound();
  // Куди повертає «Back» і сусіди в порядку списку, з якого людина прийшла (лише адреса, дані читає RLS).
  const back = safeBack(rawBack);

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

  // Підзаголовок: відділ і тип закупівлі, а за ними що саме купують (перша назва й «+N more») — той самий рядок, що у списках.
  const subline = [
    departmentName ? `${departmentName} · ${PURCHASE_TYPE_LABELS[request.purchase_type ?? "procurement"]}` : "Draft without a department",
    itemsSummary(lines),
  ]
    .filter(Boolean)
    .join(" · ");

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
      description={subline}
      // Основна дія на цій сторінці — рішення чи подання, тож кнопки «New request» у верхній смузі немає.
      hideNewRequest
      back={back === "/" ? { href: "/", label: "Back to home" } : { href: back ?? "/requests", label: "All requests" }}
      // Дії над заявкою (редагувати, копія, скасувати) — у рядку заголовка, а не окремою карткою.
      actions={
        showActions ? (
          <div className="flex flex-wrap items-center gap-2">
            {canSetEditing(request, actor) && !request.editing ? (
              <form>
                <input type="hidden" name="id" value={request.id} />
                <SubmitButton variant="outline" formAction={setEditing.bind(null, true)} testId="edit-request">
                  Edit request
                </SubmitButton>
              </form>
            ) : null}
            {canCopy(request, actor) ? (
              <form>
                <input type="hidden" name="id" value={request.id} />
                <SubmitButton variant="outline" formAction={copyPurchase} testId="copy">
                  Copy as new draft
                </SubmitButton>
              </form>
            ) : null}
            {canCancel(request, actor) ? (
              <form>
                <input type="hidden" name="id" value={request.id} />
                <SubmitButton
                  variant="destructive-ghost"
                  formAction={cancelPurchase}
                  confirm={cancelOutcome(request.status) === "delete" ? "Delete this draft?" : "Cancel this request?"}
                  testId="cancel"
                >
                  {cancelOutcome(request.status) === "delete" ? "Delete draft" : "Cancel request"}
                </SubmitButton>
              </form>
            ) : null}
          </div>
        ) : null
      }
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

      <SummaryStrip
        label="Request summary"
        items={[
          { label: "Total", value: formatUsd(total), testId: "request-total" },
          { label: "Status", value: <PurchaseStatusBadge status={request.status} /> },
          { label: "Delivery date", value: formatDate(request.delivery_date) },
        ]}
      />

      {editable ? (
        <form className="flex flex-col gap-6" data-testid="purchase-form">
          <input type="hidden" name="id" value={request.id} />

          {editFields ? (
            <Card title="Details" description="Department, purchase type, delivery date and a note for the approver.">
              <div className="grid gap-4 sm:grid-cols-2">
                {canChangeDepartment(request, actor) ? (
                  <Field label="Department">
                    <Select name="department_id" defaultValue={request.department_id ?? ""} data-testid="department-select">
                      <option value="">Select a department</option>
                      {departmentOptions.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : (
                  <div className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
                    Department
                    <p className="font-normal text-muted-foreground">{departmentName ?? "—"}</p>
                    <input type="hidden" name="department_id" value={request.department_id ?? ""} />
                  </div>
                )}
                <Field label="Purchase type">
                  <Select name="purchase_type" defaultValue={request.purchase_type ?? "procurement"}>
                    {purchaseTypes.map((p) => (
                      <option key={p} value={p}>
                        {PURCHASE_TYPE_LABELS[p]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Delivery date">
                  <DateField name="delivery_date" defaultValue={request.delivery_date ?? ""} />
                </Field>
                <div className="flex flex-col gap-2 text-sm font-medium text-foreground">
                  <label className="flex cursor-pointer items-center gap-2">
                    <Checkbox name="on_behalf_flag" defaultChecked={request.on_behalf_of_id !== null} />
                    Submitting on behalf of a colleague
                  </label>
                  <Select
                    name="on_behalf_of_id"
                    defaultValue={request.on_behalf_of_id ?? ""}
                    aria-label="Colleague"
                    data-testid="on-behalf-select"
                  >
                    <option value="">Choose a colleague</option>
                    {candidates.map((p) => (
                      <option key={p.id} value={p.id}>
                        {personLabel(p)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Note" hint={`Up to ${NOTE_MAX} characters.`} hintId="note-hint">
                    <Textarea
                      name="note"
                      rows={3}
                      maxLength={NOTE_MAX}
                      defaultValue={request.note ?? ""}
                      aria-describedby="note-hint"
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
              <SubmitButton variant="outline" formAction={addLine} formNoValidate testId="add-line">
                Add line
              </SubmitButton>
            }
          >
            <div className="overflow-x-auto" role="region" aria-label="Request lines" tabIndex={0}>
              <table className="w-full text-left text-sm max-md:block md:min-w-176" data-testid="lines">
                <thead className="text-xs text-muted-foreground max-md:hidden">
                  <tr>
                    <th className="pb-2 pr-2 font-medium">#</th>
                    <th className="pb-2 pr-2 font-medium">Name</th>
                    <th className="pb-2 pr-2 font-medium">Purpose</th>
                    <th className="pb-2 pr-2 font-medium">Qty</th>
                    <th className="pb-2 pr-2 font-medium">Unit price</th>
                    <th className="pb-2 pr-2 text-right font-medium">Total</th>
                    <th className="pb-2">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                {/* Нижче md кожен рядок — блок: «Line N» і «Remove» зверху, назва й призначення на всю ширину, кількість і ціна поряд, сума. */}
                <tbody className="divide-y divide-border max-md:block">
                  {lines.map((line) => (
                    <tr key={line.id} data-testid="line-row" className="max-md:grid max-md:grid-cols-2 max-md:items-center max-md:gap-x-3 max-md:gap-y-3 max-md:py-4 max-md:first:pt-0 max-md:last:pb-0">
                      <td className="py-2 pr-2 text-muted-foreground max-md:order-1 max-md:p-0 max-md:text-sm max-md:font-medium max-md:text-foreground">
                        <span className="md:hidden">Line </span>
                        {line.position}
                      </td>
                      <td className="py-2 pr-2 max-md:order-3 max-md:col-span-2 max-md:p-0">
                        <span className="mb-1 block text-xs text-muted-foreground md:hidden">Name</span>
                        <input type="hidden" name="line_id" value={line.id} />
                        <Input
                          name={`line_${line.id}_name`}
                          defaultValue={line.name ?? ""}
                          maxLength={LINE_NAME_MAX}
                          autoComplete="off"
                          aria-label={`Line ${line.position} name`}
                          disabled={!editLines}
                        />
                      </td>
                      <td className="py-2 pr-2 max-md:order-4 max-md:col-span-2 max-md:p-0">
                        <span className="mb-1 block text-xs text-muted-foreground md:hidden">Purpose</span>
                        <Input
                          name={`line_${line.id}_purpose`}
                          defaultValue={line.purpose ?? ""}
                          autoComplete="off"
                          aria-label={`Line ${line.position} purpose`}
                          disabled={!editLines}
                        />
                      </td>
                      <td className="w-24 py-2 pr-2 max-md:order-5 max-md:w-auto max-md:p-0">
                        <span className="mb-1 block text-xs text-muted-foreground md:hidden">Qty</span>
                        <Input
                          name={`line_${line.id}_quantity`}
                          type="number"
                          min={1}
                          step={1}
                          defaultValue={line.quantity ?? ""}
                          aria-label={`Line ${line.position} quantity`}
                          disabled={!editLines}
                        />
                      </td>
                      <td className="w-32 py-2 pr-2 max-md:order-6 max-md:w-auto max-md:p-0">
                        <span className="mb-1 block text-xs text-muted-foreground md:hidden">Unit price</span>
                        <Input
                          name={`line_${line.id}_unit_price`}
                          type="number"
                          min={0}
                          step="0.01"
                          defaultValue={line.unit_price ?? ""}
                          aria-label={`Line ${line.position} unit price`}
                          disabled={!editLines}
                        />
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums max-md:order-7 max-md:col-span-2 max-md:flex max-md:justify-between max-md:p-0 max-md:text-sm">
                        <span className="text-muted-foreground md:hidden">Total</span>
                        {formatUsd(lineTotal(line))}
                      </td>
                      <td className="py-2 text-right max-md:order-2 max-md:p-0">
                        {editLines && lines.length > 1 ? (
                          <SubmitButton
                            variant="destructive-ghost"
                            className="px-3 py-1.5"
                            ariaLabel={`Remove line ${line.position}`}
                            confirm={`Remove line ${line.position}?`}
                            formAction={removeLine.bind(null, line.id)}
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
          </Card>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {request.editing ? (
              <SubmitButton formAction={setEditing.bind(null, false)} testId="save-changes">
                Save changes
              </SubmitButton>
            ) : (
              <>
                <SubmitButton variant="outline" formAction={saveDraft} formNoValidate testId="save-draft">
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
              columns={2}
              items={[
                { label: "Department", value: departmentName ?? "—" },
                { label: "Purchase type", value: PURCHASE_TYPE_LABELS[request.purchase_type ?? "procurement"] },
                { label: "Author", value: names.get(request.author_id) ?? "—" },
                { label: "On behalf of", value: request.on_behalf_of_id ? (names.get(request.on_behalf_of_id) ?? "—") : "—" },
                { label: "Created", value: formatDateTime(request.created_at) },
                { label: "Note", value: request.note ?? "—", wide: true },
              ]}
            />
          </Card>

          <Card title="Lines" action={<Badge>{lines.length}</Badge>}>
            <div className="overflow-x-auto" role="region" aria-label="Request lines" tabIndex={0}>
              <table className="w-full text-left text-sm max-md:block md:min-w-176" data-testid="lines">
                <thead className="text-xs text-muted-foreground max-md:hidden">
                  <tr>
                    <th className="pb-2 pr-2 font-medium">#</th>
                    <th className="pb-2 pr-2 font-medium">Name</th>
                    <th className="pb-2 pr-2 font-medium">Purpose</th>
                    <th className="pb-2 pr-2 font-medium">Qty</th>
                    <th className="pb-2 pr-2 font-medium">Unit price</th>
                    <th className="pb-2 pr-2 text-right font-medium">Total</th>
                    <th className="pb-2 font-medium md:pl-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border max-md:block">
                  {lines.map((line) => (
                    <tr key={line.id} data-testid="line-row" className="max-md:grid max-md:grid-cols-2 max-md:items-center max-md:gap-x-3 max-md:gap-y-2 max-md:py-4 max-md:first:pt-0 max-md:last:pb-0">
                      <td className="py-2 pr-2 text-muted-foreground max-md:order-1 max-md:p-0 max-md:text-sm max-md:font-medium max-md:text-foreground">
                        <span className="md:hidden">Line </span>
                        {line.position}
                      </td>
                      <td className="py-2 pr-2 text-foreground max-md:order-3 max-md:col-span-2 max-md:p-0">{line.name ?? "—"}</td>
                      <td className="py-2 pr-2 text-muted-foreground max-md:order-4 max-md:col-span-2 max-md:p-0">{line.purpose ?? "—"}</td>
                      <td className="py-2 pr-2 tabular-nums max-md:order-5 max-md:p-0">
                        <span className="text-muted-foreground md:hidden">Qty </span>
                        {line.quantity ?? "—"}
                      </td>
                      <td className="py-2 pr-2 tabular-nums max-md:order-6 max-md:p-0 max-md:text-right">
                        <span className="text-muted-foreground md:hidden">Unit price </span>
                        {line.unit_price === null ? "—" : formatUsd(line.unit_price)}
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums max-md:order-7 max-md:col-span-2 max-md:flex max-md:justify-between max-md:p-0 max-md:text-sm max-md:font-medium">
                        <span className="font-normal text-muted-foreground md:hidden">Total</span>
                        {formatUsd(lineTotal(line))}
                      </td>
                      <td className="py-2 max-md:order-2 max-md:p-0 max-md:text-right md:pl-4">
                        <LineStatusBadge status={line.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {decide ? (
        <Card title="Decision" description="Approve the request (optionally rejecting some lines), reject it or return it to the author.">
          <form className="flex flex-col gap-4" data-testid="decision-form">
            <input type="hidden" name="id" value={request.id} />
            {lines.length > 1 ? (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium text-foreground">Lines to reject when approving</legend>
                {lines.map((line) => (
                  <label key={line.id} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                    <Checkbox name="rejected_line_id" value={line.id} />
                    {line.position}. {line.name ?? "Unnamed line"}
                  </label>
                ))}
              </fieldset>
            ) : null}
            <Field label="Reason" hint="Required to reject the request or return it to the author." hintId="reason-hint">
              <Textarea name="reason" rows={3} aria-describedby="reason-hint" />
            </Field>
            <div className="flex flex-wrap gap-3">
              <SubmitButton formAction={decidePurchase.bind(null, "approve")} formNoValidate testId="approve">
                Approve
              </SubmitButton>
              <SubmitButton variant="outline" formAction={decidePurchase.bind(null, "return")} formNoValidate testId="return">
                Return to author
              </SubmitButton>
              <SubmitButton
                variant="destructive"
                formAction={decidePurchase.bind(null, "reject")}
                formNoValidate
                confirm="Reject this request?"
                testId="reject"
              >
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
            <SubmitButton variant="outline" formAction={reopenPurchase} testId="reopen">
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
              <Textarea name="reason" rows={2} aria-describedby="admin-reason-hint" />
            </Field>
            <SubmitButton
              variant="destructive"
              formAction={adminRejectPurchase}
              formNoValidate
              confirm="Reject this approved request?"
              testId="admin-reject"
            >
              Reject request
            </SubmitButton>
          </form>
        </Card>
      ) : null}

      <Card title="History">
        {(historyRes.data ?? []).length === 0 ? (
          <EmptyState>No history yet.</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-border" data-testid="history">
            {(historyRes.data ?? []).map((h) => (
              <li key={h.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm first:pt-0 last:pb-0">
                <span className="text-foreground">
                  <span className="font-medium">{HISTORY_LABELS[h.action] ?? h.action}</span>
                  <span className="text-muted-foreground"> · {h.actor_name ?? names.get(h.actor_id) ?? "—"}</span>
                  {h.reason ? <span className="block text-muted-foreground">Reason: {h.reason}</span> : null}
                </span>
                <span className="text-xs text-muted-foreground">{formatDateTime(h.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageShell>
  );
}

// Скелет — частина відповіді саме цієї сторінки (Suspense тут, а не loading.tsx): при переході показується її власний скелет.
export default function RequestPage(props: PageProps<"/requests/[id]">) {
  return (
    <Suspense fallback={<RequestDetailSkeleton />}>
      <RequestPageContent {...props} />
    </Suspense>
  );
}
