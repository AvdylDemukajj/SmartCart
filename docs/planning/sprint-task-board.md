# SmartCart AI — Sprint Task Board (Ekzekutim Sekuencial)

Ky dokument e zbërthen `docs/planning/sprint-plan.md` në detyra konkrete, të menaxhueshme, dhe të ekzekutueshme **hap-pas-hapi** nga ekipi senior multidisiplinar.

> Rregull operativ: nuk hapet sprint-i pasues pa kaluar kriteret e daljes të sprint-it aktual.

---

## Legjenda e statusit

## Sprint Aktiv
- **Sprint i nisur:** Sprint 8 — CLOSED
- **Data e nisjes:** 2026-03-30
- **Shënim:** Sprinti final 8 u mbyll me hardening + go-live sign-off; të gjitha sprintet në këtë board janë të mbyllura.

---

- `TODO` — e pa nisur
- `IN_PROGRESS` — në punë
- `BLOCKED` — e bllokuar nga varësi
- `DONE` — e përfunduar me evidencë

---

## Sprint 0 — Stabilizim & Baseline

### Objektivi
Backend të parse-ojë, të ndizet dhe të testohet pa paqëndrueshmëri.

### Detyrat (sekuenciale)
1. `[DONE]` **(Senior Software Engineer)** Rregullo defektin parser në OCR retry në legacy store (`backend/src/store.js`) dhe hiq deklarimet e dyfishta.
2. `[DONE]` **(Senior Test Engineer)** Shto/ndreq testet për lifecycle të OCR retry (`failed -> queued -> processing -> succeeded/dead_letter`).
3. `[DONE]` **(Senior Software Architect)** Defino “baseline freeze” policy: pa feature të reja derisa testet bazë të jenë stabile.
4. `[DONE]` **(Senior DevOps Engineer)** Ekzekuto pipeline minimal për baseline dhe ruaj evidencën e rezultatit.

### Evidenca e detyrueshme
- Log testesh, hash commit-i i fix-it, dhe tabelë defektesh e përditësuar.

### Exit Gate
- Parser errors = 0
- Testet bazë kalojnë në mënyrë deterministike

---

## Sprint 1 — NestJS Core Platform

### Objektivi
NestJS + TypeScript bëhet runtime kanonik.

### Detyrat (sekuenciale)
1. `[DONE]` **(Senior Software Engineer)** Inicimi i app-it NestJS (`main.ts`, `app.module.ts`) dhe setup i moduleve bazë.
2. `[DONE]` **(Senior Software Architect)** Vendos konventat: module boundaries, dependency rules, error model.
3. `[DONE]` **(Senior Cyber Security Engineer)** Implemento auth guard bazë (JWT verification path) + policy për mjediset non-dev.
4. `[DONE]` **(Senior Software Engineer)** Shto global pipes/filters/interceptors (validation, error normalization, request-id).
5. `[DONE]` **(Senior DevOps Engineer)** Përditëso scripts CI/CD që `start/build/test` të targetojnë Nest runtime.

### Exit Gate
- Runtime default = NestJS TS
- Legacy runtime jo-kanonik për deploy

---

## Sprint 2 — Households + Lists + Real-time

### Objektivi
Porto funksionalitetin core të bashkëpunimit familjar në Nest.

### Detyrat (sekuenciale)
1. `[DONE]` **(Senior Software Engineer)** Implemento `households` module (create/list/invite/accept/remove).
2. `[DONE]` **(Senior Software Engineer)** Implemento `lists` module (add/update/toggle/items/activity).
3. `[DONE]` **(Senior Solution Engineer)** Dizajno event contract për SSE/WebSocket për sinkronizim në kohë reale.
4. `[DONE]` **(Senior Test Engineer)** Krijo contract tests për endpoint-et core + realtime event delivery.
5. `[DONE]` **(Senior Cyber Security Engineer)** Verifiko izolimin tenant në rrugët households/lists.

### Exit Gate
- Paritet funksional me core flows të dokumentit produkt.

---

## Sprint 3 — Postgres + Drizzle + RLS

### Objektivi
Shtresa e të dhënave enterprise me izolim tenant të verifikuar.

### Detyrat (sekuenciale)
1. `[DONE]` **(Senior Database Engineer)** Finalizo schema dhe migrations për modulet core.
2. `[DONE]` **(Senior Data Engineer)** Implemento repository layer me query helpers tenant-safe.
3. `[DONE]` **(Senior Cyber Security Engineer)** Aktivizo RLS policies dhe rregulla deny-by-default.
4. `[DONE]` **(Senior Test Engineer)** Shto integration tests anti-data-bleed (negative cross-tenant tests).
5. `[DONE]` **(Senior DevOps Engineer)** Shto migration verification stage në CI.

### Exit Gate
- Cross-tenant access tests kalojnë (denied as expected).

---

## Sprint 4 — Price/Flyers Pipeline

### Objektivi
Pipeline i çmimeve i qeverisur: staging -> validim -> promotion.

### Detyrat (sekuenciale)
1. `[DONE]` **(Senior Data Engineer)** Implemento ingestion në `prices_staging` me metadata burimi.
2. `[DONE]` **(Senior Solution Engineer)** Defino anomalitë (outlier/zero-price/inconsistent category).
3. `[DONE]` **(Senior Software Engineer)** Implemento validator job + promotion endpoint me audit.
4. `[DONE]` **(Senior Test Engineer)** Krijo test suite për poisoning scenarios.
5. `[DONE]` **(Senior Cloud Engineer)** Optimizo cache strategy (Redis TTL + invalidation policy).

### Exit Gate
- Asnjë shkrim direkt në tabela live nga scraper path.

---

## Sprint 5 — Receipts OCR + Budget + Workers

### Objektivi
OCR dhe workflows asinkrone të qëndrueshme në prod.

### Detyrat (sekuenciale)
1. `[DONE]` **(Senior Cloud Engineer)** Implemento presigned upload flow (S3/R2) me callback/webhook.
2. `[DONE]` **(Senior Software Engineer)** Implemento BullMQ queues/workers për OCR.
3. `[DONE]` **(Senior DevOps Engineer)** Vendos observability për queue lag/retries/DLQ.
4. `[DONE]` **(Senior Software Engineer)** Lidho apply OCR result me budget + list auto-mark.
5. `[DONE]` **(Senior Test Engineer)** E2E tests për OCR normal/fail/retry/manual correction.

### Exit Gate
- OCR pipeline durable + recoverable me DLQ dhe rerun procedural.

---

## Sprint 6 — Pantry + AI Recipes + Quotas

### Objektivi
Funksione AI të sigurta, të kontrolluara, dhe me kosto të menaxhuar.

### Detyrat (sekuenciale)
1. `[DONE]` **(Senior Software Engineer)** Implemento pantry freshness & expiry hints.
2. `[DONE]` **(Senior Software Engineer)** Implemento recipe suggestion + add-to-list expansion.
3. `[DONE]` **(Senior Cyber Security Engineer)** Enforce AI rate limits/quotas sipas planit.
4. `[DONE]` **(Senior Data Engineer)** Caching policy për AI responses dhe versionim prompts.
5. `[DONE]` **(Senior Test Engineer)** Testo abuse scenarios (spam generation / quota bypass).

### Exit Gate
- AI endpoints kalojnë limite dhe ruajnë gjurmueshmëri (audit + metrics).

---

## Sprint 7 — Smart Inputs (Voice + Barcode)

### Objektivi
Kompleto input-et inteligjente të dokumentit produkt.

### Detyrat (sekuenciale)
1. `[DONE]` **(Senior Solution Engineer)** Defino contract për voice-to-items parse.
2. `[DONE]` **(Senior Software Engineer)** Implemento endpoint voice parsing dhe normalization.
3. `[DONE]` **(Senior Software Engineer)** Implemento barcode lookup + add-to-list.
4. `[DONE]` **(Senior Data Engineer)** Ndërto product catalog mapping për tregjet KS/AL/DE.
5. `[DONE]` **(Senior Test Engineer)** Testo precision/edge-cases për voice dhe barcode.

### Exit Gate
- Voice + barcode flows funksionojnë end-to-end.

---

## Sprint 8 — Hardening + Go-Live

### Objektivi
Maturi operacionale enterprise dhe vendim Go-Live.

### Detyrat (sekuenciale)
1. `[DONE]` **(Senior Network Engineer)** Hardening i ingress/egress dhe segmentim rrjeti.
2. `[DONE]` **(Senior Cyber Security Engineer)** Security review final + incident response drills.
3. `[DONE]` **(Senior DevOps Engineer)** Finalizo SLO/alerting/runbooks dhe rollback automation.
4. `[DONE]` **(Senior Cloud Engineer)** Staging soak test + capacity validation.
5. `[DONE]` **(Senior Test Engineer)** Release test matrix final dhe sign-off raport.

### Exit Gate
- Nënshkrim formal nga Architecture, Security, QA, Ops për production.

---

## Regjistri i varësive kryesore (cross-sprint)
- Sprint 1 varet nga stabiliteti i Sprint 0.
- Sprint 3 varet nga kontratat e Sprint 2.
- Sprint 5 varet nga infrastruktura Redis/Object Storage.
- Sprint 8 varet nga mbyllja e të gjitha quality gates ndër-sprint.

---

## Kadenca e menaxhimit
- Daily: status i task-eve (`TODO/IN_PROGRESS/BLOCKED/DONE`).
- Weekly: sprint checkpoint + risk review.
- Sprint Close: demo + evidencë + retro + go/no-go për sprint pasues.
