"use client";

// Форма нової чернетки: вибір відділу, типу заявки й (лише для «Закупівлі») типу закупівлі, особа «від імені».
// Варіанти приходять з сервера вже відфільтровані правилами ORG (AC-ORG-01, 07, 08, 16, 17, 22, 23) —
// тут лише залежність полів: особа «від імені» залежить від відділу, тип закупівлі — від типу заявки.
import { useState } from "react";
import { Field, inputClass } from "@/app/_components/ui";
import { SubmitButton } from "@/app/_components/submit-button";

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

  return (
    <form action={action} className="flex flex-col gap-5">
      <Field label="Department">
        <select
          name="department_id"
          required
          value={departmentId}
          onChange={(event) => setDepartmentId(event.target.value)}
          className={inputClass}
          data-testid="department-select"
        >
          {departments.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Request type">
        <select
          name="type"
          required
          value={type}
          onChange={(event) => setType(event.target.value)}
          className={inputClass}
          data-testid="type-select"
        >
          {types.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>

      {type === purchaseTypeRequestType.value ? (
        <Field
          label="Purchase type"
          hint={`Only for ${purchaseTypeRequestType.label} requests.`}
          hintId="purchase-type-hint"
        >
          <select
            name="purchase_type"
            required
            aria-describedby="purchase-type-hint"
            className={inputClass}
            data-testid="purchase-type-select"
          >
            {purchaseTypes.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <Field
        label="On behalf of"
        hint="Optional: choose a colleague if you are submitting the request for them."
        hintId="on-behalf-hint"
      >
        <select
          // key: при зміні відділу список варіантів інший — скидаємо вибір на «від свого імені».
          key={departmentId}
          name="on_behalf_of_id"
          defaultValue=""
          aria-describedby="on-behalf-hint"
          className={inputClass}
          data-testid="on-behalf-select"
        >
          <option value="">On my own behalf</option>
          {candidates.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>

      <SubmitButton className="self-start">Create draft</SubmitButton>
    </form>
  );
}
