// Розмітка помічника «Запропонувати рядки» без логіки й без server actions (design.md D5): її рендерить і сторінка, і
// unit-тест станів AC-AI-03 (очікування: «Шукаю рядки…», неактивна кнопка, опис у полі) і повідомлень AC-AI-02, 04, 05, 06.
import type { ReactNode, Ref } from "react";
import { Alert, Button, Label, Textarea } from "@/components/ui";
import { AI_UI } from "@/lib/ai/messages";
import type { SuggestResult } from "@/lib/ai/draft";

export type Proposal = Extract<SuggestResult, { kind: "line" }>["line"];

export type Notice = { tone: "info" | "warn"; message: string } | null;

export function AiHelperView({
  description,
  pending,
  notice,
  proposal = null,
  accepting = false,
  onDescription,
  onAsk,
  onAccept,
  rootRef,
}: {
  description: string;
  pending: boolean;
  notice: Notice;
  proposal?: Proposal | null;
  accepting?: boolean;
  onDescription?: (value: string) => void;
  onAsk?: () => void;
  onAccept?: () => void;
  rootRef?: Ref<HTMLDivElement>;
}): ReactNode {
  return (
    <div ref={rootRef} className="flex flex-col gap-2" data-testid="ai-helper">
      <Label htmlFor="ai-description">{AI_UI.label}</Label>
      {/* Без name: опис не входить до збереження чернетки (saveDraft читає лише відомі поля). */}
      <Textarea
        id="ai-description"
        rows={3}
        value={description}
        placeholder={AI_UI.placeholder}
        onChange={(event) => onDescription?.(event.target.value)}
        data-testid="ai-description"
      />
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" disabled={pending} aria-busy={pending} onClick={onAsk} data-testid="ai-suggest">
          {AI_UI.button}
        </Button>
        {pending ? (
          <span role="status" className="text-sm text-muted-foreground" data-testid="ai-loading">
            {AI_UI.loading}
          </span>
        ) : null}
      </div>
      <Alert tone={notice?.tone} message={notice?.message} />
      {proposal ? (
        // Немає порожнього рядка: пропозиція нічого не пише в БД, поки людина не натисне «Додати рядок».
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted p-3" data-testid="ai-proposal">
          <p className="text-sm font-medium text-foreground">{AI_UI.proposal}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm text-foreground">
            <dt className="text-muted-foreground">{AI_UI.fields.name}</dt>
            <dd>{proposal.name}</dd>
            <dt className="text-muted-foreground">{AI_UI.fields.purpose}</dt>
            <dd>{proposal.purpose}</dd>
            <dt className="text-muted-foreground">{AI_UI.fields.quantity}</dt>
            <dd>{proposal.quantity}</dd>
            <dt className="text-muted-foreground">{AI_UI.fields.unitPrice}</dt>
            <dd>{proposal.unitPrice.toFixed(2)}</dd>
          </dl>
          <div>
            <Button type="button" disabled={accepting} aria-busy={accepting} onClick={onAccept} data-testid="ai-accept">
              {AI_UI.accept}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
