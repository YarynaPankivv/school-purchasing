"use client";

// Поле «Note» зі лічильником символів: підказка «Up to N characters.» лишається, поруч — «n / N», що оновлюється під час набору.
import { useState } from "react";
import { Label, Textarea } from "@/components/ui";

export function NoteField({ defaultValue, max }: { defaultValue: string; max: number }) {
  const [length, setLength] = useState(defaultValue.length);
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="flex flex-col gap-1.5">
        Note
        <Textarea
          name="note"
          rows={3}
          maxLength={max}
          defaultValue={defaultValue}
          aria-describedby="note-hint"
          onChange={(event) => setLength(event.target.value.length)}
        />
      </Label>
      <div className="flex items-center justify-between gap-3 text-xs font-normal text-muted-foreground">
        <span id="note-hint">Up to {max} characters.</span>
        <span aria-hidden="true" className="tabular-nums">
          {length} / {max}
        </span>
      </div>
    </div>
  );
}
