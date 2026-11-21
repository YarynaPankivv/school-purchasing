// Трекер помилок сервера без Sentry: Next.js викликає onRequestError на кожну необроблену помилку сервера
// (сторінка, маршрут API, Server Action, proxy), а ми надсилаємо КОРОТКЕ повідомлення в той самий Telegram-чат,
// що й алерт smoke: маршрут, метод, назва помилки, digest, до 5 верхніх рядків стеку, деплой, середовище.
// Куди: src/instrumentation.ts у вашому репо (перейменуйте, прибравши .example). Якщо ви обрали Sentry — цей файл
// НЕ потрібен: майстер `npx @sentry/wizard@latest -i nextjs` створює власний instrumentation.ts з onRequestError.
// Завдання README: B (трекер помилок сервера: власний onRequestError у instrumentation.ts).
// Секрети (лише назви): TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID — тут це змінні середовища VERCEL (Settings →
// Environment Variables, Production і Preview), без префікса NEXT_PUBLIC_; GitHub Secrets сюди не потрапляють.
// Нема змінних — функція мовчки нічого не робить.
// Тексти повідомлення — англійською: tests/ui/interface-language.test.ts сканує src/ на українські слова поза коментарями.
// Джерело: materials/ops-kit/src/instrumentation.ts.example курсу WS11; Next.js docs «instrumentation.js» (onRequestError, з'явився у v15.0.0; типи з next 16.4.3) і Vercel docs
// «System environment variables» (VERCEL_DEPLOYMENT_ID, VERCEL_ENV, VERCEL_GIT_COMMIT_REF), станом на 09.11.2026.
//
// Що НЕ надсилаємо ніколи: заголовки запиту (там cookie сесії), тіло запиту, рядок запиту (?query) і error.message
// (може містити дані користувача). Зі стеку беремо лише рядки «at …» (функція, файл, рядок коду): перший рядок
// error.stack — це «Назва: текст помилки», його відкидаємо. Повний стек — у Runtime Logs Vercel (за digest чи часом
// і маршрутом); на Hobby вони живуть 1 годину, тож дивіться одразу після повідомлення.
// Як перевірити: тимчасовий маршрут, що кидає помилку, на preview чи staging → повідомлення в чаті з маршрутом і
// рядками стеку → маршрут прибрати (або закрити роллю адміністратора). Тест локально: TELEGRAM_* у .env.local, npm run dev.
import type { Instrumentation } from "next";

const TIMEOUT_MS = 2_500; // не тримаємо відповідь користувачу довше: Telegram недоступний — повідомлення пропадає
const SAME_ERROR_PAUSE_MS = 60_000; // та сама помилка на тому самому маршруті — не частіше разу на хвилину
const STACK_FRAMES = 5; // скільки верхніх рядків «at …» стеку надсилати
const lastSent = new Map<string, number>();

/**
 * Лише рядки «at …» зі стеку. Заголовок «Назва: текст помилки» відрізаємо цілим (текст може бути багаторядковим і
 * містити дані користувача), беремо лише рядки виду «at … файл:рядок:колонка», а абсолютний шлях скорочуємо до
 * .next/…, src/… чи node_modules/… — щоб у чат не потрапило ім'я користувача ОС з локального шляху.
 */
function stackFrames(error: unknown): string[] {
  if (!(error instanceof Error) || typeof error.stack !== "string") return [];
  const header = error.message ? `${error.name}: ${error.message}` : error.name;
  const body = error.stack.startsWith(header)
    ? error.stack.slice(header.length)
    : error.stack.split("\n").slice(header.split("\n").length).join("\n"); // заголовок інший — пропускаємо стільки ж рядків
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("at ") && /:\d+:\d+\)?$/.test(line))
    // Лишаємо лише відносну частину від .next/, src/ чи node_modules/ до :рядок:колонка; не вдалося визначити — кадр відкидаємо
    // (абсолютний префікс із пробілами, напр. /home/<імʼя>/Моя тека/src/…, інакше потрапив би в повідомлення).
    .flatMap((line) => {
      const location = line.match(/[\\/]((?:\.next|src|node_modules)[\\/][^?\r\n]*:\d+:\d+)\)?$/)?.[1];
      return location ? [`at ${location.replaceAll("\\", "/")}`] : []; // Windows-шлях показуємо зі скісною рискою
    })
    .slice(0, STACK_FRAMES)
    .map((line) => line.slice(0, 160));
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const name = error instanceof Error ? error.name : typeof error;
  const rawDigest = (error as { digest?: unknown } | null)?.digest;
  const digest = typeof rawDigest === "string" ? rawDigest.slice(0, 40) : "";
  // routePath — шаблон маршруту (/requests/[id]), без id і без ?query. request.path не беремо.
  const route = context.routePath;

  const key = `${route}|${digest || name}`;
  const now = Date.now();
  if (now - (lastSent.get(key) ?? 0) < SAME_ERROR_PAUSE_MS) return;
  lastSent.set(key, now);

  const env = process.env.APP_ENV ?? process.env.VERCEL_ENV ?? "local"; // APP_ENV=staging — змінна лише для гілки staging
  const branch = process.env.VERCEL_GIT_COMMIT_REF;
  const frames = stackFrames(error);
  const text = [
    "SERVER ERROR",
    `Environment: ${env}${branch ? ` (branch ${branch})` : ""}`,
    `Route: ${request.method} ${route} (${context.routeType}, ${context.routerKind})`,
    `Error: ${name}${digest ? `, digest ${digest}` : ""}`,
    `Deployment: ${process.env.VERCEL_DEPLOYMENT_ID ?? "?"}, commit ${(process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7)}`,
    ...(frames.length ? ["Stack (top frames):", ...frames] : []),
  ].join("\n");

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // Навмисно нічого не пишемо: помилка fetch містить адресу запиту, а в ній — токен бота.
  }
};
