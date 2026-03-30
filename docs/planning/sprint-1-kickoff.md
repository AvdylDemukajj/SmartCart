# Sprint 1 Kickoff — NestJS Core Platform

**Data nisjes:** 2026-03-30  
**Sprint:** 1 (NestJS Core Platform)  
**Gjuhë pune:** Shqip  
**Modalitet:** Ekzekutim hap-pas-hapi (step-by-step)

---

## 1) Qëllimi i Sprint 1
Të vendoset runtime-i kanonik NestJS + TypeScript, me guardrails të arkitekturës, sigurisë dhe DevOps.

---

## 2) Task-et hap-pas-hapi (renditje operative)

### Hapi 1 — Arkitektura dhe Bootstrap
**Owner:** Senior Software Architect + Senior Software Engineer  
- Finalizo strukturën e moduleve: `auth`, `health`, `observability`, `common`, `config`.
- Defino rregullat e varësive ndër-module (no circular deps, boundaries të qarta).
- Krijo skeletin `main.ts` dhe `app.module.ts` si pikë hyrëse zyrtare.

**Output i pritshëm:** dokument i shkurtër i boundaries + skeleton i runtime-it Nest.

### Hapi 2 — Konfigurimi i mjedisit dhe boot policy
**Owner:** Senior Software Engineer + Senior Cloud Engineer  
- Defino env schema për `NODE_ENV`, `PORT`, `AUTH_*`, `REDIS_URL`, `DATABASE_URL`.
- Vendos fail-fast policy në boot nëse mungojnë variablat kritike.
- Specifiko profile dev/staging/prod.

**Output i pritshëm:** config module dhe validim strikt i env.

### Hapi 3 — Security baseline
**Owner:** Senior Cyber Security Engineer + Senior Software Engineer  
- Implemento auth guard bazë për JWT verification path.
- Blloko dev fallback auth në mjedise jo-dev.
- Defino audit event model minimal për auth failures.

**Output i pritshëm:** guard + policy dokumentuar + audit event contract.

### Hapi 4 — Cross-cutting concerns
**Owner:** Senior Software Engineer + Senior Solution Engineer  
- Global validation pipe.
- Exception filter i unifikuar (error codes + shape standard).
- Interceptor për request-id/correlation-id.

**Output i pritshëm:** sjellje e unifikuar e request lifecycle.

### Hapi 5 — CI/CD alignment për Sprint 1
**Owner:** Senior DevOps Engineer + Senior Test Engineer  
- Update scripts/pipeline që `start/build/test` targetojnë runtime-in Nest.
- Shto check bazë: lint/typecheck/test smoke.
- Publiko artefaktin e parë të build-it.

**Output i pritshëm:** pipeline minimal i Sprint 1 funksional.

---

## 3) RACI i shkurtër
- **Responsible:** Software Engineers, DevOps Engineer, Cyber Security Engineer.
- **Accountable:** Software Architect.
- **Consulted:** Cloud, Solution, Test, Database, Data, Network.
- **Informed:** gjithë ekipi i sprint-it.

---

## 4) Risk-e dhe mitigim
1. **Risk:** varësi nga stabilizimi i Sprint 0.  
   **Mitigim:** zhvillim paralel vetëm për scaffolding/organizim; pa sign-off final pa Exit Gate të Sprint 0.
2. **Risk:** drift i arkitekturës (mixed runtime).  
   **Mitigim:** policy “NestJS canonical” + PR checklist gate.
3. **Risk:** regresion në auth flow.  
   **Mitigim:** test matrix për auth success/failure dhe environment modes.

---

## 5) Definition of Done për Sprint 1
- Runtime kanonik NestJS i inicializuar.
- Guard/validation/filter/interceptor funksionalë.
- Pipeline minimal CI/CD i lidhur me runtime-in e ri.
- Evidencë e qartë e deliverables dhe risk log i përditësuar.
