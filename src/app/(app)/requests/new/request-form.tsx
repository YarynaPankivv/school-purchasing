"use client";

// Форма нової чернетки: вибір відділу, типу заявки й (лише для «Закупівлі») типу закупівлі, особа «від імені».
// Варіанти приходять з сервера вже відфільтровані правилами ORG (AC-ORG-01, 07, 08, 16, 17, 22, 23) —
// тут лише залежність полів: особа «від імені» залежить від відділу, тип закупівлі — від типу заявки.
import { useState } from "react";
import { Field, LinkButton, Select, SubmitButton } from "@/components/ui";

type Option = { value: string; label: string };

export function RequestForm({
  action,
  departments,
  candidatesByDepartment,
  types,
  purchaseTypes,
  purchaseTypeRequestType,
}: {
  action: (formData: FormData) => void | Promise<void>;
  departments: Option[];
  candidatesByDepartment: Record<string, Option[]>;
  types: Option[];
  purchaseTypes: Option[];
  purchaseTypeRequestType: { value: string; label: string };
}) {
  const [departmentId, setDepartmentId] = useState(departments[0]?.value ?? "");
  const [type, setType] = useState(types[0]?.value ?? "");
  const candidates = candidatesByDepartment[departmentId] ?? [];
  const showPurchaseType = type === purchaseTypeRequestType.value;

  return (
    <form action={action} className="flex flex-col gap-6">
      {/* Два стовпці від sm: відділ і тип поряд, далі тип закупівлі (лише для «Purchase») і «від імені». */}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Department">
          <Select
            name="department_id"
            required
            value={departmentId}
            onChange={(event) => setDepartmentId(event.target.value)}
            data-testid="department-select"
          >
            {departments.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Request type">
          <Select
            name="type"
            required
            value={type}
            onChange={(event) => setType(event.target.value)}
            data-testid="type-select"
          >
            {types.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>

        {showPurchaseType ? (
          <Field
            label="Purchase type"
            hint={`Only for ${purchaseTypeRequestType.label} requests.`}
            hintId="purchase-type-hint"
          >
            <Select
              name="purchase_type"
              required
              aria-describedby="purchase-type-hint"
              data-testid="purchase-type-select"
            >
              {purchaseTypes.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <div className={showPurchaseType ? undefined : "sm:col-span-2"}>
          <Field
            label="On behalf of"
            hint="Optional: choose a colleague if you are submitting the request for them."
            hintId="on-behalf-hint"
          >
            <Select
              // key: при зміні відділу список варіантів інший — скидаємо вибір на «від свого імені».
              key={departmentId}
              name="on_behalf_of_id"
              defaultValue=""
              aria-describedby="on-behalf-hint"
              data-testid="on-behalf-select"
            >
              <option value="">On my own behalf</option>
              {candidates.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
        <SubmitButton>Create draft</SubmitButton>
        <LinkButton href="/requests" variant="ghost">
          Cancel
        </LinkButton>
      </div>
    </form>
  );
}
