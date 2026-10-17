#!/usr/bin/env node
// npm run spec:check — детерміновані перевірки специфікацій, яких не робить `openspec validate`:
//   1) кожен `#### Scenario:` в openspec/specs/** і openspec/changes/** (крім archive/)
//      починається з AC ID формату AC-<AREA>-<NN>;
//   2) сценарій з неправильним рівнем заголовка (### Scenario:) — помилка (OpenSpec його мовчки ігнорує);
//   3) AC ID унікальні в канонічних специфікаціях (openspec/specs/**);
//   3b) кожна активна зміна (openspec/changes/<id>, крім archive/) після archive не дасть дубля AC ID:
//      той самий ID двічі в зміні, ADDED-ID, який уже є в openspec/specs, MODIFIED-сценарій з ID чужої вимоги;
//      і дві активні зміни не вводять той самий новий ID;
//   4) жодне слово зі списку заборонених (product/denylist.txt + локальний product/denylist.local.txt
//      + змінна середовища SPEC_DENYLIST) не трапляється в requirements/ (знімок вимог PM), openspec/, docs/, src/,
//      supabase/, tests/ (без tests/scripts і tests/fixtures), README.md і AGENTS.md (без урахування регістру; збіг за
//      ПОЧАТКОМ слова, тож «Контосо» ловить і «Контосо», і «Контосою», і «Контосо-офіс»; фраза ловиться й
//      через перенесення рядка, латинські й кириличні літери-двійники рівноцінні; транслітерацію — ні);
//      поруч із product/denylist.local.txt немає «бродячих» копій (denylist.local.txt.txt тощо: .gitignore
//      їх ховає, але spec:check їх не читає);
//   5) у кожній зміні специфікації (openspec/changes/<id> і archive/<id> без `skip_specs: true` у .openspec.yaml:
//      add-<зріз>, уточнення після відповіді PM) є proposal.md з розділами Why, What Changes, Capabilities,
//      Users & roles, Non-goals, Assumptions, Open questions у цьому порядку (інші розділи, як-от Impact, — між ними
//      чи після них); план реалізації impl-<зріз> (skip_specs: true) цього не потребує.
// Код виходу: 0 — усе гаразд, 1 — є помилки.
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  acIdOf,
  isArchive,
  isMarkdown,
  parseScenarios,
  parseSpecFile,
  printList,
  readText,
  rel,
  root,
  walk,
} from "./lib/spec-lib.mjs";

const errors = { title: [], level: [], duplicate: [], changeDuplicate: [], denylist: [], stray: [], proposal: [] };
const specsDir = path.join(root(), "openspec", "specs");
const changesDir = path.join(root(), "openspec", "changes");

// 1–2. Назви й рівні сценаріїв.
const files = [
  ...walk(specsDir, { filter: isMarkdown }),
  ...walk(changesDir, { filter: isMarkdown, skip: isArchive }),
];
let scenarioCount = 0;
for (const file of files) {
  for (const s of parseScenarios(file)) {
    const where = `${rel(file)}:${s.line}`;
    if (s.level !== 4) {
      errors.level.push(`${where} — "${"#".repeat(s.level)} Scenario:" має бути "#### Scenario:"`);
      continue;
    }
    scenarioCount++;
    if (!acIdOf(s.title)) {
      // Схоже на AC ID, але не проходить (кирилична А/С/Е…, три цифри): підказуємо, чому саме.
      const nearMiss = /^[AАaа][CСcс]-\p{L}+-\d+/u.test(s.title.trim());
      const hint = nearMiss
        ? " — схоже на AC ID: AREA — 2–12 ВЕЛИКИХ ЛАТИНСЬКИХ літер (кириличні А, В, Е, І, К, М, Н, О, Р, С, Т, Х виглядають так само), NN — рівно дві цифри"
        : "";
      errors.title.push(`${where} — "${s.title}" не починається з AC-<AREA>-<NN> (напр. AC-LEAVE-01: …)${hint}`);
    }
  }
}

// 3. Унікальність AC ID у канонічних специфікаціях.
const seen = new Map();
for (const file of walk(specsDir, { filter: isMarkdown })) {
  for (const s of parseScenarios(file)) {
    const id = s.level === 4 ? acIdOf(s.title) : null;
    if (!id) continue;
    const where = `${rel(file)}:${s.line}`;
    if (seen.has(id)) errors.duplicate.push(`${id} — ${where} (уже є в ${seen.get(id)})`);
    else seen.set(id, where);
  }
}

// 3b. Активні зміни: чи не з'явиться дубль AC ID після archive.
// Моделюємо archive кожної зміни поверх openspec/specs: RENAMED → REMOVED → MODIFIED → ADDED (блок вимоги
// замінюється цілком), потім шукаємо ID, що трапляється більше одного разу. MODIFIED/REMOVED законно
// повторюють канонічні ID своєї ж вимоги — це не дубль.
const capOf = (file, base) => path.relative(base, path.dirname(file)).split(path.sep).join("/");
const reqKey = (cap, name) => `${cap}\u0000${name ?? ""}`;
function blocksOf(parsed, kind) {
  // { requirement → [{id, where}] } для секції kind ("" — канонічна специфікація).
  const blocks = new Map();
  for (const r of parsed.requirements) if (r.kind === kind) blocks.set(r.name, []);
  for (const s of parsed.scenarios) {
    if (s.kind !== kind || s.level !== 4 || s.requirement === null) continue;
    const id = acIdOf(s.title);
    if (!id) continue;
    if (!blocks.has(s.requirement)) blocks.set(s.requirement, []);
    blocks.get(s.requirement).push({ id, where: `${rel(s.file)}:${s.line}` });
  }
  return blocks;
}
function renamesOf(text) {
  // ## RENAMED Requirements: пари «- FROM: `### Requirement: Стара`» / «- TO: `### Requirement: Нова`».
  const pairs = [];
  let inRenamed = false;
  let from = null;
  const clean = (v) => v.replace(/`/g, "").replace(/^#+\s*Requirement:\s*/i, "").trim();
  for (const line of text.split("\n")) {
    const h2 = line.match(/^##\s+(.*)$/);
    if (h2) inRenamed = /^RENAMED\s+Requirements/i.test(h2[1].trim());
    if (!inRenamed) continue;
    const m = line.match(/^\s*-?\s*\**(FROM|TO)\**:\s*(.+)$/i);
    if (!m) continue;
    if (m[1].toUpperCase() === "FROM") from = clean(m[2]);
    else if (from !== null) {
      pairs.push([from, clean(m[2])]);
      from = null;
    }
  }
  return pairs;
}

const canonical = new Map(); // reqKey → [{id, where}]
for (const file of walk(specsDir, { filter: isMarkdown })) {
  const cap = capOf(file, specsDir);
  for (const [name, list] of blocksOf(parseSpecFile(file), "")) canonical.set(reqKey(cap, name), list);
}
const canonicalIds = new Set([...canonical.values()].flat().map((x) => x.id));
const introducedBy = new Map(); // новий ID → [{change, where}]
const changeNames = existsSync(changesDir)
  ? walk(changesDir, { filter: isMarkdown, skip: isArchive })
      .map((f) => path.relative(changesDir, f).split(path.sep)[0])
      .filter((v, i, all) => all.indexOf(v) === i)
  : [];
for (const change of changeNames) {
  const changeSpecs = path.join(changesDir, change, "specs");
  const state = new Map([...canonical].map(([k, v]) => [k, [...v]]));
  const touched = [];
  for (const file of walk(changeSpecs, { filter: isMarkdown })) {
    const cap = capOf(file, changeSpecs);
    const parsed = parseSpecFile(file);
    for (const [from, to] of renamesOf(parsed.text)) {
      if (!state.has(reqKey(cap, from))) continue;
      state.set(reqKey(cap, to), state.get(reqKey(cap, from)));
      state.delete(reqKey(cap, from));
    }
    for (const name of blocksOf(parsed, "REMOVED").keys()) state.delete(reqKey(cap, name));
    for (const kind of ["MODIFIED", "ADDED"]) {
      for (const [name, list] of blocksOf(parsed, kind)) {
        state.set(reqKey(cap, name), list);
        touched.push(...list);
      }
    }
  }
  const touchedWhere = new Set(touched.map((x) => x.where));
  const byId = new Map();
  for (const x of [...state.values()].flat()) {
    if (!byId.has(x.id)) byId.set(x.id, []);
    byId.get(x.id).push(x.where);
  }
  for (const [id, wheres] of byId) {
    if (wheres.length < 2 || !wheres.some((w) => touchedWhere.has(w))) continue;
    errors.changeDuplicate.push(`${id} — після archive зміни ${change} буде в кількох місцях: ${wheres.join(", ")}`);
  }
  for (const x of touched) {
    if (canonicalIds.has(x.id)) continue;
    if (!introducedBy.has(x.id)) introducedBy.set(x.id, []);
    const list = introducedBy.get(x.id);
    if (!list.some((y) => y.change === change)) list.push({ change, where: x.where });
  }
}
for (const [id, list] of introducedBy) {
  if (list.length > 1) {
    errors.changeDuplicate.push(
      `${id} — новий ID вводять кілька активних змін: ${list.map((x) => `${x.change} (${x.where})`).join(", ")}`,
    );
  }
}

// 4. Denylist — три джерела (рядки, # — коментар); тека product/ — лише для цих двох файлів (і README):
//    product/denylist.txt        — публічний (ваш, необов'язковий): слова, які не мають потрапити в репо;
//    product/denylist.local.txt  — ЛОКАЛЬНИЙ, у .gitignore: справжні назви клієнтів (список PM надсилає особисто);
//    SPEC_DENYLIST               — секрет CI (через кому або з нового рядка): ті самі назви для GitHub Actions.
//    Справжні назви клієнтів у публічному репо — лише в локальному файлі й секреті: інакше сам файл стане витоком.
//    Значення з локального файлу й секрету не друкуємо (екран можуть бачити інші — демонстрація, запис).
const DENYLIST_FILES = [
  { file: "product/denylist.txt", secret: false },
  { file: "product/denylist.local.txt", secret: true },
];
const words = []; // { word, source, secret }
for (const { file, secret } of DENYLIST_FILES) {
  const full = path.join(root(), ...file.split("/"));
  if (!existsSync(full)) continue;
  for (const raw of readText(full).split("\n")) {
    const word = raw.trim();
    if (word && !word.startsWith("#")) words.push({ word, source: file, secret });
  }
}
for (const raw of (process.env.SPEC_DENYLIST ?? "").split(/[\n,]/)) {
  if (raw.trim()) words.push({ word: raw.trim(), source: "SPEC_DENYLIST", secret: true });
}
// «Бродячий» локальний denylist: Провідник Windows із прихованими розширеннями дає denylist.local.txt.txt.
// .gitignore (/product/denylist.local*) його ховає, але spec:check читає лише product/denylist.local.txt.
const productDir = path.join(root(), "product");
if (existsSync(productDir)) {
  for (const name of readdirSync(productDir)) {
    if (name.startsWith("denylist.local") && name !== "denylist.local.txt") {
      errors.stray.push(`product/${name} — перейменуйте на denylist.local.txt`);
    }
  }
}
if (words.length) {
  const escape = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Латинські й кириличні літери-двійники рівноцінні: «Kонтосо» з латинською K ловиться як «Контосо».
  // Транслітерацію (Kontoso) це не ловить — таку форму пишуть у denylist окремим рядком.
  const TWINS = ["aа", "bв", "cс", "eе", "hн", "iі", "kк", "mм", "oо", "pр", "tт", "xх", "yу"];
  const twinClass = new Map(TWINS.flatMap((pair) => [...pair].map((ch) => [ch, `[${pair}]`])));
  const toPattern = (word) =>
    word
      .trim()
      .split(/\s+/)
      .map((part) => [...part].map((ch) => twinClass.get(ch.toLowerCase()) ?? escape(ch)).join(""))
      // Пробіли всередині фрази — будь-які, зокрема перенесення рядка у відформатованому markdown.
      .join("\\s+");
  const secretIndex = new Map(); // джерело → лічильник
  const patterns = words.map(({ word, source, secret }) => {
    const n = (secretIndex.get(source) ?? 0) + 1;
    if (secret) secretIndex.set(source, n);
    return {
      // Збіг за початком слова (без межі в кінці): у тексті українською назви відмінюються,
      // тож «Контосо» має ловити й «Контосою». Ціна — «Контосовіль» теж збіг (перефразуйте).
      re: new RegExp(`(?<![\\p{L}\\p{N}])${toPattern(word)}`, "giu"),
      // Секретні значення не друкуємо — лише номер слова в його джерелі.
      label: secret ? `слово #${n} із ${source}` : `"${word}"`,
    };
  });
  const denylistPaths = new Set(DENYLIST_FILES.map((d) => d.file));
  // Не лише спека: знімок вимог PM (requirements/), а ще розробник пише назви в docs/, коді, сидах і тестах.
  // product/ не скануємо: там лише самі списки denylist. Не скануємо lock-файли (base64-хеші
  // дають хибні збіги), бінарні файли, згенеровані типи й тести самих скриптів (tests/scripts, tests/fixtures:
  // там слова denylist навмисно).
  const skipScan = (r) =>
    denylistPaths.has(r) ||
    /^product\/denylist\.local/.test(r) ||
    /(^|\/)(node_modules|\.next|\.git|\.temp|\.branches)(\/|$)/.test(r) ||
    /^tests\/(fixtures|scripts)(\/|$)/.test(r) ||
    r === "src/lib/supabase/database.types.ts" ||
    /\.(png|jpe?g|gif|webp|ico|svg|pdf|woff2?|ttf|otf|mp4|webm|zip|lock)$/i.test(r) ||
    /(^|\/)package-lock\.json$/.test(r);
  const SCAN_DIRS = ["requirements", "openspec", "docs", "src", "supabase", "tests"];
  const scanned = [
    ...SCAN_DIRS.flatMap((d) => walk(path.join(root(), d), { skip: skipScan })),
    ...["README.md", "AGENTS.md"].map((f) => path.join(root(), f)).filter((f) => existsSync(f)),
  ];
  for (const file of scanned) {
    // Увесь файл, а не рядок за рядком: фраза могла перенестися на інший рядок. М'який перенос і символи
    // нульової ширини прибираємо, &nbsp; вважаємо пробілом (переноси рядків лишаються — номери рядків точні).
    const text = readText(file).replace(/[­​-‍⁠]/g, "").replace(/&nbsp;/gi, " ");
    const found = new Set();
    for (const p of patterns) {
      for (const m of text.matchAll(p.re)) {
        found.add(`${rel(file)}:${text.slice(0, m.index).split("\n").length} — ${p.label}`);
      }
    }
    errors.denylist.push(...found);
  }
}

// 5. Розділи proposal.md у змінах специфікації (план impl-<зріз> має skip_specs: true і цього не потребує).
const PROPOSAL_SECTIONS = ["Why", "What Changes", "Capabilities", "Users & roles", "Non-goals", "Assumptions", "Open questions"];
const changeDirs = (dir) =>
  existsSync(dir) ? readdirSync(dir).filter((n) => n !== "archive" && statSync(path.join(dir, n)).isDirectory()) : [];
for (const dir of [changesDir, path.join(changesDir, "archive")]) {
  for (const name of changeDirs(dir)) {
    const full = path.join(dir, name);
    const meta = path.join(full, ".openspec.yaml");
    if (existsSync(meta) && /^skip_specs:\s*true\b/m.test(readText(meta))) continue;
    const proposal = path.join(full, "proposal.md");
    const headings = existsSync(proposal)
      ? readText(proposal)
          .split("\n")
          .map((l) => l.match(/^##\s+(.+?)\s*$/)?.[1])
          .filter(Boolean)
      : [];
    let pos = 0;
    let gap = existsSync(proposal) ? null : "proposal.md";
    for (const section of PROPOSAL_SECTIONS) {
      if (gap) break;
      const i = headings.findIndex((h, k) => k >= pos && h.toLowerCase() === section.toLowerCase());
      if (i === -1) gap = `розділу «${section}»`;
      else pos = i + 1;
    }
    if (gap) {
      errors.proposal.push(
        `${rel(full)} — бракує ${gap} (порядок: Why, What Changes, Capabilities, Users & roles, Non-goals, Assumptions, Open questions; ` +
          `якщо це план реалізації impl-<зріз> без specs/ — додайте skip_specs: true у .openspec.yaml)`,
      );
    }
  }
}

const total = Object.values(errors).reduce((n, list) => n + list.length, 0);
console.log(
  `spec:check — markdown-файлів: ${files.length}, сценаріїв: ${scenarioCount}, ` +
    `AC у канонічних специфікаціях: ${seen.size}, слів у denylist: ${words.length}`,
);
printList("BAD-TITLE: сценарій без AC ID на початку назви", errors.title);
printList("BAD-LEVEL: неправильний рівень заголовка сценарію", errors.level);
printList("DUPLICATE: AC ID повторюється в openspec/specs", errors.duplicate);
printList("DUPLICATE-CHANGE: активна зміна дасть дубль AC ID після archive", errors.changeDuplicate);
printList("DENYLIST: заборонене слово (анонімізація)", errors.denylist);
printList("STRAY-DENYLIST: локальний denylist під іншим іменем (spec:check його не читає)", errors.stray);
printList("PROPOSAL: зміна специфікації (без skip_specs) без proposal.md або без розділу з правил openspec/config.yaml", errors.proposal);
if (total) {
  console.log(`\nFAIL: помилок — ${total}.`);
  process.exit(1);
}
console.log("OK");
