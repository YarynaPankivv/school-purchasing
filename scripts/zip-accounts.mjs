#!/usr/bin/env node
// Шифрує accounts.txt у accounts.zip (AES-256) — запасний шлях, коли 7-Zip немає.
// Пароль — один на весь курс (оголошено в чаті курсу). Скрипт питає його в терміналі без відлуння
// і ніде не зберігає: ні в аргументах, ні у файлах, ні в змінних середовища.
//
// Встановлення (раз, з кореня вашого репо):
//   npm i -D --save-exact @zip.js/zip.js@2.24.0
//   npm pkg set scripts.accounts:zip="node scripts/zip-accounts.mjs"
// Використання:
//   npm run accounts:zip              — створити accounts.zip з accounts.txt і перевірити його
//   npm run accounts:zip -- --check   — перевірити, що архів відкривається паролем (спробуйте й хибний)
// Запускайте в PowerShell чи Windows Terminal: у Git Bash (mintty) прихований ввід не працює.
//
// Що робить скрипт:
//   1) перевіряє, що accounts.txt є, git його ігнорує (.gitignore) і він ніколи не потрапляв у git;
//   2) двічі питає пароль без відлуння;
//   3) пише accounts.zip: один запис accounts.txt, AES-256 (не слабкий ZipCrypto);
//   4) перевіряє архів: правильний пароль дає той самий вміст, хибний — відмову.
// Код виходу: 0 — гаразд, 1 — помилка (текст пояснює, що виправити).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { configure, Uint8ArrayReader, Uint8ArrayWriter, ZipReader, ZipWriter } from "@zip.js/zip.js";

configure({ useWebWorkers: false });

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const IN = opt("--in", "accounts.txt");
const OUT = opt("--out", "accounts.zip");
const ENTRY = "accounts.txt";

const fail = (msg) => {
  console.error(`ПОМИЛКА: ${msg}`);
  process.exitCode = 1;
};

const git = (...a) => {
  try {
    return { ok: true, out: execFileSync("git", a, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) };
  } catch (e) {
    return { ok: false, out: String(e.stdout || "") };
  }
};

// Пароль без відлуння. --stdin — лише для автоматичних перевірок (пароль з конвеєра), людині не радимо:
// рядок команди з паролем лишається в історії терміналу.
async function readPassword(question) {
  if (flag("--stdin")) {
    const chunks = [];
    for await (const c of process.stdin) chunks.push(c);
    const lines = Buffer.concat(chunks).toString("utf8").split(/\r?\n/);
    readPassword.lines ??= lines;
    return readPassword.lines.shift() ?? "";
  }
  const { stdin, stdout } = process;
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    throw new Error("NO_TTY");
  }
  return new Promise((resolve, reject) => {
    let value = "";
    const cleanup = () => {
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
    };
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          cleanup();
          stdout.write("\n");
          resolve(value);
          return;
        }
        if (ch === "\u0003") {
          cleanup();
          stdout.write("\n");
          reject(new Error("CANCELLED"));
          return;
        }
        if (ch === "\u007f" || ch === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        value += ch;
      }
    };
    stdout.write(question);
    stdin.setEncoding("utf8");
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

async function openEntry(zipBytes, password) {
  const reader = new ZipReader(new Uint8ArrayReader(zipBytes));
  try {
    const entries = await reader.getEntries();
    const entry = entries.find((e) => e.filename === ENTRY);
    if (!entry) throw new Error(`у архіві немає ${ENTRY}`);
    const data = await entry.getData(new Uint8ArrayWriter(), { password });
    return { entry, data };
  } finally {
    await reader.close();
  }
}

async function inspect(zipBytes) {
  const reader = new ZipReader(new Uint8ArrayReader(zipBytes));
  try {
    const entries = await reader.getEntries();
    return entries.map((e) => ({ name: e.filename, encrypted: e.encrypted, zipCrypto: e.zipCrypto }));
  } finally {
    await reader.close();
  }
}

const wrongPasswordRejected = async (zipBytes) => {
  try {
    await openEntry(zipBytes, randomBytes(18).toString("base64url"));
    return false;
  } catch {
    return true;
  }
};

async function check() {
  if (!existsSync(OUT)) return fail(`${OUT} не знайдено. Спершу: npm run accounts:zip`);
  const zipBytes = new Uint8Array(readFileSync(OUT));
  const list = await inspect(zipBytes);
  const bad = list.filter((e) => !e.encrypted || e.zipCrypto);
  if (bad.length) return fail(`у ${OUT} є незашифровані або ZipCrypto-записи: ${bad.map((e) => e.name).join(", ")}`);
  const password = await readPassword(`Пароль курсу для перевірки ${OUT}: `);
  try {
    const { data } = await openEntry(zipBytes, password);
    console.log(`OK: ${OUT} відкривається цим паролем (${data.length} байт, AES-256).`);
  } catch {
    console.log(`Хибний пароль: ${OUT} цим паролем не відкривається.`);
    process.exitCode = 1;
  }
}

async function create() {
  if (!existsSync(IN)) {
    return fail(`${IN} не знайдено. Створіть його в корені репо: ролі, логіни й паролі тестових акаунтів.`);
  }
  if (git("ls-files", "--error-unmatch", IN).ok) {
    return fail(`${IN} уже відстежується git. Виконайте git rm --cached ${IN}, змініть паролі тестових акаунтів і запустіть знову.`);
  }
  if (git("log", "--all", "--oneline", "--", IN).out.trim()) {
    return fail(`${IN} є в історії git. Змініть паролі всіх тестових акаунтів на проді: старі вже публічні.`);
  }
  if (!git("check-ignore", "-q", IN).ok) {
    return fail(`git не ігнорує ${IN}. Додайте рядок «${IN}» у .gitignore і запустіть знову.`);
  }

  const password = await readPassword("Пароль курсу (не відображається): ");
  const again = await readPassword("Ще раз: ");
  if (!password) return fail("порожній пароль.");
  if (password !== again) return fail("паролі не збігаються. Нічого не записано.");

  const plain = new Uint8Array(readFileSync(IN));
  const writer = new ZipWriter(new Uint8ArrayWriter(), { password, encryptionStrength: 3, zipCrypto: false });
  await writer.add(ENTRY, new Uint8ArrayReader(plain));
  const zipBytes = await writer.close();

  // Перевірка до запису на диск: AES (не ZipCrypto), правильний пароль — той самий вміст, хибний — відмова.
  const list = await inspect(zipBytes);
  if (list.length !== 1 || !list[0].encrypted || list[0].zipCrypto) return fail("архів не зашифровано AES. Нічого не записано.");
  const { data } = await openEntry(zipBytes, password);
  if (Buffer.compare(Buffer.from(data), Buffer.from(plain)) !== 0) return fail("вміст після розшифрування не збігся. Нічого не записано.");
  if (!(await wrongPasswordRejected(zipBytes))) return fail("архів відкрився хибним паролем. Нічого не записано.");

  writeFileSync(OUT, zipBytes);
  console.log(`OK: ${OUT} записано (AES-256, ${plain.length} байт вмісту).`);
  console.log("Перевірено: правильний пароль дає той самий вміст, хибний — відмова.");
  console.log(`Комітьте лише ${OUT}. ${IN} лишається тільки на вашому диску.`);
}

try {
  await (flag("--check") ? check() : create());
} catch (e) {
  if (e?.message === "NO_TTY") {
    fail("термінал не підтримує прихований ввід. Запустіть у PowerShell чи Windows Terminal (у Git Bash — через winpty).");
  } else if (e?.message === "CANCELLED") {
    fail("скасовано. Нічого не записано.");
  } else {
    fail(e?.message || String(e));
  }
}
