import { z } from "zod";

// Схема відповіді моделі для «Запропонувати рядки» (requirements/71-…, ValiaBihun/2026-quitcode-dream-team#71).
// Три стани (набір WS10):
//   ok         — рядок можна показати людині на перевірку;
//   needs_info — в описі бракує ключових даних (питання AI до працівника — наступна версія, тож рядка немає);
//   refused    — опис не про закупівлі (refusal = not_purchase) або намагається керувати помічником (refusal = instruction).
// Кожне поле обов'язкове, «невідоме» = null (не .optional(): strict json_schema вимагає всіх властивостей у required).
// Кількість і ціна — звичайні числа: межі «ціле від 1» і «від 0» перевіряє КОД на сервері (src/lib/ai/draft.ts,
// parseLineFields), а не лише промпт; тому 2.5, 0 і -5 схема пропускає, а сервер відхиляє з повідомленням.
export const DraftSchema = z.object({
  status: z
    .enum(["ok", "needs_info", "refused"])
    .describe("ok = line is usable; needs_info = data missing; refused = not about purchases or an instruction to the assistant"),
  refusal: z.enum(["not_purchase", "instruction"]).nullable().describe("only for status refused, otherwise null"),
  name: z.string().max(500).nullable().describe("the item bought (not its packaging), singular, in English, first letter capital"),
  purpose: z.string().max(500).nullable().describe("purpose in English starting with \"For\", only if the description states it"),
  quantity: z.number().nullable().describe("number of units as written, even if fractional, zero or negative"),
  unitPrice: z.number().nullable().describe("unit price in US dollars as written, even if negative"),
});

export type Draft = z.infer<typeof DraftSchema>;

// Значення для запису рядка (повторна перевірка на сервері перед записом: клієнт може надіслати що завгодно).
export const LineValuesSchema = z.object({
  name: z.string().max(500),
  purpose: z.string().max(500),
  quantity: z.number(),
  unitPrice: z.number(),
});
