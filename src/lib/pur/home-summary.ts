// Підсумок на головній: одне речення про те, що потребує уваги людини. Лише те, що підтверджують дані: «caught up» —
// коли немає ні рішень, ні повернених заявок, ні власних чернеток; збій читання — не «все гаразд».
export type SummaryCounts = { toDecide: number; awaiting: number; returned: number; drafts: number };

const plural = (n: number) => (n === 1 ? "request is" : "requests are");

export function homeSummary(loaded: boolean, counts: SummaryCounts): string {
  if (!loaded) return "Your request summary is unavailable.";
  const { toDecide, awaiting, returned, drafts } = counts;
  if (toDecide > 0) return `${toDecide} ${plural(toDecide)} waiting for your decision.`;
  if (awaiting > 0) return `${awaiting} ${plural(awaiting)} waiting because the department has no approver who can decide.`;
  // Повернена на доопрацювання заявка чекає на автора — це не «все гаразд».
  if (returned > 0) return `${returned} of your ${returned === 1 ? "request was" : "requests were"} returned for revision.`;
  if (drafts > 0) return `You have ${drafts} ${drafts === 1 ? "draft" : "drafts"} to submit.`;
  return "You are all caught up.";
}
