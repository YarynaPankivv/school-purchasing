---
target: login page
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Homework\\Homework 6\\school-purchasing\\src\\app\\login\\page.tsx"
target_fingerprint: "sha256:22a805d4f74db6a6b4971b7f36687eb28594d74b010e4188ab635e0baa829292"
target_path: "C:\\Homework\\Homework 6\\school-purchasing\\src\\app\\login\\page.tsx"
timestamp: 2026-10-26T09-21-49Z
slug: src-app-login-page-tsx
---
Method: dual-agent (A: design review · B: detector + browser)

## Design Health Score: 26/40 (Good, нижня межа)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Busy-стан кнопки є; поля й alert без aria-invalid/describedby |
| 2 | Match System / Real World | 3 | «database», «procurement» незрозумілі вчителю |
| 3 | User Control and Freedom | 3 | Виходів мало, і не потрібно |
| 4 | Consistency and Standards | 3 | h2 в aside раніше за h1 у DOM |
| 5 | Error Prevention | 2 | Немає show password; нативна валідація мовою браузера |
| 6 | Recognition Rather Than Recall | 3 | Підписи видимі, autocomplete є |
| 7 | Flexibility and Efficiency | 2 | Немає autofocus |
| 8 | Aesthetic and Minimalist Design | 3 | Ліва панель має 5 шарів |
| 9 | Error Recovery | 2 | Помилка стирає email; тупик «ask them» |
| 10 | Help and Documentation | 2 | Немає адресата для допомоги |

Design specificity: частково авторський (тепле тло, петроль, tabular-nums, текстові статуси), решта — типовий split-screen для SaaS.
Deterministic scan: 0 знахідок CLI; в браузері 1 — cream-palette на body (свідома тепла палітра, хибне спрацювання).

## Priority issues
- [P1] Мобільний вхід без контексту й ідентичності (adapt)
- [P1] Помилка стирає email, валідація браузерна, не англійською (harden)
- [P2] Ліва панель перевантажена й жаргонна (distill)
- [P2] Тупик «ask them to check your account» (clarify)
- [P3] Порядок заголовків і ландмарків (polish)
