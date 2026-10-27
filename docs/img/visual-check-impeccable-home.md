---
target: home page
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:src/app/page.tsx"
target_fingerprint: "sha256:8dca59f348b2e6df87cfbbf484bc83dfd85a186f2d3f198887cd15934c8f2fbf"
target_path: "src/app/page.tsx"
current_path: "src/app/(app)/(home)/page.tsx"
note: "target_fingerprint is a hash of the uncommitted working-tree file at critique time (26.10) and matches no commit; the page was reworked afterwards in PR #27. Local absolute paths were made repo-relative."
timestamp: 2026-10-26T10-26-31Z
slug: src-app-page-tsx
---
Method: dual-agent (A: design review sub-agent · B: detector sub-agent)

# Critique: src/app/page.tsx (home page)

## Design Health Score: 28/40 (Good, 70%)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Summary can misstate state ("caught up" over own drafts) |
| 2 | Match System / Real World | 3 | "To decide" vs "Awaiting decision" near-synonyms |
| 3 | User Control and Freedom | 3 | |
| 4 | Consistency and Standards | 3 | Same RequestList as /requests |
| 5 | Error Prevention | 3 | Read-only page |
| 6 | Recognition Rather Than Recall | 3 | |
| 7 | Flexibility and Efficiency | 2 | "View all" always unfiltered, no sort |
| 8 | Aesthetic and Minimalist Design | 3 | Filler summary, redundant author on "My requests" |
| 9 | Error Recovery | 3 | |
| 10 | Help and Documentation | 2 | Empty states say what is missing, not what to do |

## Design Specificity Verdict
LLM: interchangeable, 2/5. Shell is authored (warm paper, petrol, aligned rule); page content is a greeting over a stack of lists, no workflow idea (submit -> approve -> process).
Deterministic scan: impeccable detect over 6 files, 0 findings.

## Priority Issues
- [P1] Greeting and summary do not earn their space; summary says "caught up" over drafts (page.tsx counts only toDecide/awaiting). Fix: truthful role-aware summary from existing counts. Command: clarify.
- [P1] No dominant focus / role-specific first screen. Fix: count strip (Badge tones, bg-card) linking to /requests?q=<status>; order sections by urgency. Command: layout.
- [P2] Empty sections look like headings, px-1 misaligns by ~4px, bare 0 badge. Fix: drop px-1, mute titles, merge empty lists. Command: distill.
- [P2] "My requests" rows repeat the author (the viewer) and drafts at $0.00 bury live requests. Fix: status-relative date line, drafts last, oldest-waiting first for approvers. Command: layout.
- [P3] Mobile first screen: badge wraps, amount/status cluster misaligned, 3-line card header. Fix: badge in title row, hide description below sm, justify-between. Command: adapt.

## Persona Red Flags
- Alex (approver): 5 rows in arbitrary updated_at order, unfiltered View all, no hint about "/".
- Sam: count badges without context, links underline only on hover, similar section names.
- Casey: primary action icon-only below sm, first viewport mostly chrome.

## Minor Observations
- Three routes to New request (sidebar item, top-bar button, empty-state link).
- Row hover (-mx-5) spills past card rounded corners on first/last rows.
- Dark mode: light teal New request fill is the loudest element.
- Test data ("dep") makes screenshots look unfinished.

## Questions to Consider
- If Home and Requests show the same rows, why does Home exist?
- Should an approver's first screen be 5 rows or the single oldest pending request?
- Does the greeting need a name at all, given the sidebar user block?
