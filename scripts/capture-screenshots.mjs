#!/usr/bin/env node
// Знімки «після» для docs/img/design-after-*: справжній браузер (Edge чи Chrome) у headless-режимі через DevTools Protocol,
// без залежностей (Node 22+: глобальний WebSocket). Знімає світлу й темну теми: робочий стіл 1280×800 і телефон 390×844.
//
//   npm run dev                                   # застосунок на http://localhost:3000
//   node scripts/capture-screenshots.mjs --only login          # сторінка входу — без пароля
//   node --env-file=.env.local scripts/capture-screenshots.mjs # усе, з входом під admin@example.test
//   node --env-file=.env.local scripts/capture-screenshots.mjs --as member1@example.test --label requester  # інша роль: design-after-requester-*
//
// Пароль — лише з DEMO_USER_PASSWORD (наприклад, з .env.local, як у `npm run users:demo`); скрипт його не друкує.
// Лише синтетичний користувач: DEMO_USER_EMAIL за замовчуванням admin@example.test. Змінні: BASE_URL, BROWSER_PATH.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const OUT = new URL("../docs/img/", import.meta.url);
const arg = (name) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : null);
const only = arg("--only");
// --as <email> — вхід під іншим демо-користувачем, --label <роль> — префікс імені файлу (без нього — адміністратор).
const EMAIL = arg("--as") ?? process.env.DEMO_USER_EMAIL ?? "admin@example.test";
const LABEL = arg("--label");
const PASSWORD = process.env.DEMO_USER_PASSWORD ?? "";

// Запобіжники до будь-якого входу: пароль іде лише на localhost (або по https), лише синтетичному користувачеві,
// а мітка файлу — це роль, не шлях (інакше `--label ../x` виходить за межі docs/img/).
{
  const fail = (message) => {
    console.error(message);
    process.exit(1);
  };
  let baseUrl;
  try {
    baseUrl = new URL(BASE);
  } catch {
    fail(`BASE_URL не схожий на адресу: «${BASE}».`);
  }
  const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(baseUrl.hostname);
  if (!isLocal && baseUrl.protocol !== "https:") fail("BASE_URL поза localhost має бути https://, інакше пароль піде відкритим текстом.");
  if (PASSWORD && !/^[^@\s]+@example\.test$/i.test(EMAIL)) fail("Дозволені лише синтетичні користувачі (*@example.test).");
  if (Boolean(arg("--as")) !== Boolean(LABEL)) fail("Параметри --as і --label потрібні разом (або жоден з них).");
  if (LABEL && !/^[a-z0-9-]+$/.test(LABEL)) fail("--label: лише малі латинські літери, цифри й дефіс.");
}

const VIEWPORTS = {
  desktop: { width: 1280, height: 800, mobile: false },
  mobile: { width: 390, height: 844, mobile: true },
};
// name — частина імені файлу; auth — потрібен вхід; devices — де знімати.
const PAGES = [
  { name: "login", path: "/login", auth: false, devices: ["desktop", "mobile"] },
  { name: "home", path: "/", auth: true, devices: ["desktop", "mobile"] },
  { name: "requests", path: "/requests", auth: true, devices: ["desktop", "mobile"] },
  { name: "requests-new", path: "/requests/new", auth: true, devices: ["desktop"] },
  { name: "request-detail", path: "detail", auth: true, devices: ["desktop"] },
  { name: "users", path: "/admin/users", auth: true, devices: ["desktop"], forAdmin: true },
  // Не адміністратор відкриває адмін-сторінку: сторінка відмови.
  { name: "forbidden", path: "/admin/users", auth: true, devices: ["desktop"], forAdmin: false },
];

function findBrowser() {
  const candidates = [
    process.env.BROWSER_PATH,
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);
  const found = candidates.find((path) => existsSync(path));
  if (!found) throw new Error("Не знайдено Edge/Chrome. Вкажіть шлях у BROWSER_PATH.");
  return found;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function launch() {
  const profile = mkdtempSync(join(tmpdir(), "shots-"));
  const port = 9300 + Math.floor(Math.random() * 400);
  const child = spawn(
    findBrowser(),
    [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--headless=new", "--hide-scrollbars", "--no-first-run", "--disable-gpu", "about:blank"],
    { stdio: "ignore" },
  );
  let socket;
  const close = () => {
    try {
      socket?.close();
    } catch {
      // уже закрито
    }
    child.kill();
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      // профіль ще зайнятий — не критично
    }
  };
  try {
    let target;
    for (let attempt = 0; attempt < 60 && !target; attempt++) {
      await sleep(250);
      try {
        const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
        target = list.find((entry) => entry.type === "page");
      } catch {
        // браузер ще стартує
      }
    }
    if (!target) throw new Error("Браузер не відповів на DevTools-порту.");
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.onopen = resolve;
      socket.onerror = () => reject(new Error("Не вдалося відкрити WebSocket до браузера."));
    });
  } catch (error) {
    // Без цього браузер і тека профілю лишились би після помилки запуску (main().catch лише виходить).
    close();
    throw error;
  }
  let id = 0;
  const pending = new Map();
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const messageId = ++id;
      pending.set(messageId, { resolve, reject });
      socket.send(JSON.stringify({ id: messageId, method, params }));
    });
  return { send, close };
}

async function main() {
  // Для іншої ролі сторінка входу не повторюється; адмінські сторінки — лише для адміна, сторінка відмови — лише для інших.
  const wanted = PAGES.filter(
    (page) => (!only || page.name === only) && (page.forAdmin === undefined || page.forAdmin === !LABEL) && (page.auth || !LABEL),
  );
  if (wanted.length === 0) throw new Error(`Немає сторінки «${only}». Доступні: ${PAGES.map((p) => p.name).join(", ")}`);
  const needsAuth = wanted.some((page) => page.auth);
  if (needsAuth && !PASSWORD) {
    console.error("Для сторінок за входом потрібен DEMO_USER_PASSWORD (node --env-file=.env.local …). Можна лише --only login.");
    process.exit(1);
  }

  const { send, close } = await launch();
  // CDP не відхиляє проміс, коли вираз кидає виняток: помилку віддає exceptionDetails — без перевірки вона мовчки губиться.
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) {
      throw new Error(`Помилка в сторінці: ${result.exceptionDetails.exception?.description ?? result.exceptionDetails.text}`);
    }
    return result.result?.value;
  };
  const goto = async (path) => {
    // Маркер на старому документі: готовою вважаємо лише нову сторінку (інакше знімається ще попередня).
    await evaluate("window.__stale = true").catch(() => {});
    const { errorText } = await send("Page.navigate", { url: `${BASE}${path}` });
    if (errorText) throw new Error(`Не вдалося відкрити ${path}: ${errorText}. Чи запущено npm run dev?`);
    let ready = false;
    for (let attempt = 0; attempt < 80 && !ready; attempt++) {
      await sleep(250);
      // Під час навігації контекст знищується — це «ще не готово», а не помилка.
      ready = await evaluate(
        `!window.__stale && document.readyState === "complete" && !!document.querySelector("h1, form") && !document.querySelector('[class*="animate-pulse"]')`,
      ).catch(() => false);
    }
    if (!ready) throw new Error(`Сторінка ${path} не завантажилась за 20 с: знімок не збережено.`);
    // Індикатор dev-режиму Next.js у кадр не потрапляє.
    await evaluate(`document.querySelectorAll("nextjs-portal").forEach((element) => element.remove()); 0`);
    await sleep(300);
  };
  const emulate = async (device, theme) => {
    const { width, height, mobile } = VIEWPORTS[device];
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: theme }] });
  };
  const shot = async (name, device, theme) => {
    const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    const file = `design-after-${LABEL ? `${LABEL}-` : ""}${device === "mobile" ? "mobile-" : ""}${name}-${theme}.png`;
    writeFileSync(new URL(file, OUT), Buffer.from(data, "base64"));
    console.log("збережено", file);
  };

  try {
    await send("Page.enable");
    await send("Runtime.enable");
    // Спершу сторінки без входу (login не відкривається авторизованому).
    for (const page of wanted.filter((p) => !p.auth)) {
      for (const device of page.devices) {
        for (const theme of ["light", "dark"]) {
          await emulate(device, theme);
          await goto(page.path);
          await shot(page.name, device, theme);
        }
      }
    }
    if (needsAuth) {
      await emulate("desktop", "light");
      await goto("/login");
      await evaluate(`(async () => {
        const fill = (name, value) => {
          const input = document.querySelector('input[name="' + name + '"]');
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value);
          input.dispatchEvent(new Event("input", { bubbles: true }));
        };
        fill("email", ${JSON.stringify(EMAIL)});
        fill("password", ${JSON.stringify(PASSWORD)});
        document.querySelector('form button[type="submit"]').click();
      })()`);
      for (let attempt = 0; attempt < 60 && (await evaluate("location.pathname")) === "/login"; attempt++) await sleep(250);
      if ((await evaluate("location.pathname")) === "/login") throw new Error("Вхід не вдався: перевірте DEMO_USER_EMAIL / DEMO_USER_PASSWORD.");

      for (const page of wanted.filter((p) => p.auth)) {
        let path = page.path;
        if (path === "detail") {
          // Картка заявки: перша заявка зі списку (краще схвалена: з позиціями й сумою).
          await goto("/requests");
          path = await evaluate(`(() => {
            const links = [...document.querySelectorAll('a[href^="/requests/"]')].filter((a) => /\\/requests\\/[0-9a-f-]{36}/.test(a.getAttribute("href")));
            const approved = links.find((a) => /Approved/.test((a.closest("tr") ?? a).textContent));
            return (approved ?? links[0])?.getAttribute("href") ?? "/requests";
          })()`);
        }
        for (const device of page.devices) {
          for (const theme of ["light", "dark"]) {
            await emulate(device, theme);
            await goto(path);
            await shot(page.name, device, theme);
          }
        }
      }
    }
  } finally {
    close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
