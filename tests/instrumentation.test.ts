// Трекер помилок сервера (WS11, власний onRequestError): повідомлення в Telegram має маршрут, назву помилки й верхні рядки
// стеку, але НЕ текст помилки (може містити дані користувача), не заголовки, не cookie і не рядок запиту. Назви без AC ID:
// операційна перевірка, а не критерій приймання PM.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onRequestError } from "@/instrumentation";

const USER_TEXT = "Buy paper for olena.test@example.test, note secret-note-123";
const request = { path: "/requests/abc?token=secret-query", method: "POST", headers: { cookie: "sb-access-token=secret-cookie" } };
const context = { routerKind: "App Router", routePath: "/requests/[id]", routeType: "action", renderSource: "react-server-components", revalidateReason: undefined } as const;

describe("onRequestError (трекер помилок)", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "123456:test-token");
    vi.stubEnv("TELEGRAM_CHAT_ID", "-1000000000000");
    vi.stubEnv("APP_ENV", "staging");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("надсилає маршрут, назву помилки, середовище й стек, але без тексту помилки, заголовків і рядка запиту", async () => {
    const error = new TypeError(USER_TEXT);
    await onRequestError(error, request, context);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(url).toContain("api.telegram.org");
    const { text } = JSON.parse(init.body) as { text: string };
    expect(text).toContain("SERVER ERROR");
    expect(text).toContain("Environment: staging");
    expect(text).toContain("Route: POST /requests/[id]");
    expect(text).toContain("Error: TypeError");
    for (const marker of ["olena", "secret-note", "secret-query", "secret-cookie", "sb-access-token", "123456:test-token"]) {
      expect(text).not.toContain(marker);
    }
  });

  it("без TELEGRAM_BOT_TOKEN чи TELEGRAM_CHAT_ID мовчки нічого не робить", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    await onRequestError(new Error("boom"), request, context);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("збій Telegram не кидає виняток, а та сама помилка повторно не надсилається щохвилини", async () => {
    fetchMock.mockRejectedValue(new Error("network: https://api.telegram.org/bot123456:test-token/sendMessage"));
    const error = Object.assign(new Error("boom"), { digest: "d1g3st" });
    await expect(onRequestError(error, request, { ...context, routePath: "/other/[x]" })).resolves.toBeUndefined();
    await onRequestError(error, request, { ...context, routePath: "/other/[x]" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
