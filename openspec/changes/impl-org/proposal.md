# Proposal

## Why

Реалізуємо зріз WS6 «адміністратор налаштовує відділи, схвалювачів, автосхвалення й дозволи працівників» за власною
специфікацією `openspec/specs/{departments,request-permissions,user-administration}` (переклад вимоги
ValiaBihun/2026-quitcode-dream-team#2, знімок 2026-10-17). Без цих налаштувань наступні зрізи (подання й схвалення
заявок) не знають, хто від імені якого відділу подає і хто схвалює.

## What Changes

Зміна покриває всі AC зрізу з `openspec/specs/`:

- `departments`: AC-ORG-01, AC-ORG-02, AC-ORG-03, AC-ORG-04, AC-ORG-05, AC-ORG-06, AC-ORG-11, AC-ORG-14, AC-ORG-15;
- `request-permissions`: AC-ORG-07, AC-ORG-08, AC-ORG-17;
- `user-administration`: AC-ORG-09, AC-ORG-10, AC-ORG-12, AC-ORG-13, AC-ORG-16, AC-ORG-18, AC-ORG-21.

Відкриті питання до PM Q1–Q6 (ValiaBihun/2026-quitcode-dream-team#9 … #14) реалізуємо за тимчасовими рішеннями з
`design.md`; після відповідей PM — нова зміна специфікації й, за потреби, правка реалізації.
