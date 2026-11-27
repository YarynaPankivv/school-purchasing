// Куди можна надсилати секрет обходу захисту Vercel (x-vercel-protection-bypass): лише https-адреса саме цього проєкту,
// а не будь-який *.vercel.app. Та сама перевірка, що в smoke.yml («Що перевіряємо»), — друга лінія захисту для ручного
// запуску скрипта: https://<проєкт>.vercel.app (прод) або https://<проєкт>-<…>-<VERCEL_SCOPE>.vercel.app (preview, staging).
// Проєкт — перша частина PROD_URL; VERCEL_SCOPE — slug команди Vercel (змінні репо, не секрети).
// Межа: за самою адресою неможливо довести власника деплою (Vercel з'єднує проєкт, хеш чи гілку й slug команди дефісами),
// тож чужий проєкт із підходящою назвою формально пройшов би. Це лишковий ризик: адресу беруть із події Vercel нашого
// проєкту або вводить людина з правом запису в репо. Повна перевірка (projectId і ID команди через API Vercel) потребує
// токена доступу до API, якого в проєкті немає за правилом про секрети.
const SAFE = /^[a-z0-9-]+$/;

export function isTrustedBypassTarget(address, { prodUrl = "", scope = "" } = {}) {
  if (/[\u0000-\u001f\u007f]/.test(address)) return false;
  let url;
  try {
    url = new URL(address);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password) return false;
  const project = prodUrl.replace(/^https:\/\//, "").split(/[/.]/)[0] ?? "";
  if (!SAFE.test(project)) return false;
  if (url.hostname === `${project}.vercel.app`) return true;
  if (!SAFE.test(scope)) return false;
  // Без RegExp зі змінних: у шаблонному рядку «\.» дорівнює просто «.», тож крапка стала б метасимволом (будь-який символ).
  const prefix = `${project}-`;
  const suffix = `-${scope}.vercel.app`;
  const middle = url.hostname.slice(prefix.length, url.hostname.length - suffix.length);
  return url.hostname.startsWith(prefix) && url.hostname.endsWith(suffix) && SAFE.test(middle);
}
