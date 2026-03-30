# Sprint 3 Kickoff — Postgres + Drizzle + RLS

**Data nisjes:** 2026-03-30  
**Sprint:** 3 (Postgres + Drizzle + RLS)  
**Gjuhë pune:** Shqip  
**Modalitet:** Ekzekutim hap-pas-hapi (step-by-step)

---

## 1) Qëllimi i Sprint 3
Të ndërtohet shtresa e të dhënave enterprise me izolim tenant të verifikuar, duke kaluar nga baza tranzitore drejt modelit production-safe.

---

## 2) Task-et hap-pas-hapi (renditje operative)

### Hapi 1 — Finalizimi i skemës dhe migrimeve
**Owner:** Senior Database Engineer + Senior Software Architect  
- Finalizo schema për households, members, items, activity, budgets, receipts, ocr_jobs, pantry, pricing_staging/live, audit.
- Krijo migrime forward-only me emërtim/versionim të qartë.
- Verifiko backward compatibility për endpoint-et e Sprint 2.

**Output i pritshëm:** migration set i aprovuar + ERD i përditësuar.

### Hapi 2 — Repository layer tenant-safe
**Owner:** Senior Data Engineer + Senior Software Engineer  
- Implemento repository abstractions me `household_id` scope të detyrueshëm.
- Ndal query paths pa tenant context.
- Shto helper utilities për pagination/filtering pa rrezik data bleed.

**Output i pritshëm:** data-access layer i standardizuar dhe i testueshëm.

### Hapi 3 — Aktivizimi i RLS dhe politikat deny-by-default
**Owner:** Senior Cyber Security Engineer + Senior Database Engineer  
- Aktivizo RLS në tabelat tenant-bound.
- Defino policy set për owner/member/admin use-cases.
- Shto SQL checks për policy correctness.

**Output i pritshëm:** RLS policy pack i versionuar në migrime.

### Hapi 4 — Testim anti-data-bleed
**Owner:** Senior Test Engineer + Senior Software Engineer  
- Krijo integration tests negative për cross-tenant read/write.
- Testo bypass attempts me manipulim householdId.
- Krijo regression suite për query scoping.

**Output i pritshëm:** test evidence që izolimi tenant funksionon.

### Hapi 5 — CI/CD gates për database reliability
**Owner:** Senior DevOps Engineer + Senior Cloud Engineer  
- Shto stage që ngre DB ephemeral, aplikon migrime, dhe ekzekuton integration tests.
- Shto fail-fast gate në rast migration drift.
- Publiko artefakte test/migration për audit trail.

**Output i pritshëm:** pipeline me database gates të detyrueshme.

---

## 3) RACI i shkurtër
- **Responsible:** Database Engineer, Data Engineer, Software Engineer, Test Engineer.
- **Accountable:** Software Architect.
- **Consulted:** Cyber Security, DevOps, Cloud, Solution, Network.
- **Informed:** gjithë ekipi i sprint-it.

---

## 4) Risk-e dhe mitigim
1. **Risk:** migration conflicts mes branch-eve.  
   **Mitigim:** naming convention + migration lock process.
2. **Risk:** query path pa tenant scope.  
   **Mitigim:** static review checklist + integration negative tests.
3. **Risk:** performancë e dobët pas RLS.  
   **Mitigim:** indeksim i targetuar + explain analyze për query kritike.

---

## 5) Definition of Done për Sprint 3
- Skema dhe migrimet e Sprint 3 të stabilizuara dhe të verifikuara.
- Repository layer tenant-safe në përdorim.
- RLS aktive dhe e testuar për skenarë pozitiv/negativ.
- CI me database verification gates kalon pa gabime.

---

## 6) Status përmbylljeje (2026-03-30)
- ✅ Runtime përdor Postgres repository automatikisht kur `DATABASE_URL` ekziston.
- ✅ Tenant authorization checks në service layer mbështeten në repository DB (`assertMember`) dhe mbijetojnë restart.
- ✅ Activity log ruhet/lexohet nga Postgres në DB-first mode (`activity_log`).
- ✅ Testi DB-first për restart + membership authorization është shtuar në suite.
