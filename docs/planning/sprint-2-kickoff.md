# Sprint 2 Kickoff — Households + Lists + Real-time

**Data nisjes:** 2026-03-30  
**Sprint:** 2 (Households + Lists + Real-time)  
**Gjuhë pune:** Shqip  
**Modalitet:** Ekzekutim hap-pas-hapi (step-by-step)

---

## 1) Qëllimi i Sprint 2
Të portohet funksionaliteti core i bashkëpunimit familjar në runtime-in kanonik NestJS dhe të vendoset sinkronizimi realtime me kontrata të sigurta tenant.

---

## 2) Task-et hap-pas-hapi (renditje operative)

### Hapi 1 — Households module (core tenancy entry point)
**Owner:** Senior Software Engineer + Senior Software Architect  
- Implemento endpoint-et: create household, list households, invite member, accept invite, remove member.
- Defino role model minimal (owner/member) dhe rregullat e autorizimit për secilin veprim.
- Standardizo error codes (`FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `VALIDATION`).

**Output i pritshëm:** `households` module i plotë me DTO, service, controller, guards.

### Hapi 2 — Lists module (shopping workflow)
**Owner:** Senior Software Engineer + Senior Database Engineer  
- Implemento endpoint-et: list items, add item, patch/update item, toggle purchased.
- Ruaj optimistic concurrency (`version`) dhe responses konsistente për conflict.
- Shto categorization hook për item-et e reja.

**Output i pritshëm:** `lists` module funksional me API contracts të qëndrueshme.

### Hapi 3 — Activity log + realtime contract
**Owner:** Senior Solution Engineer + Senior Software Engineer  
- Defino modelin e event-it (`eventType`, `householdId`, `actorId`, `timestamp`, `payload`).
- Implemento stream delivery (SSE/WebSocket) me tenant channel isolation.
- Shto reconnect strategy (cursor/last-event-id) për humbje lidhjeje.

**Output i pritshëm:** kontratë realtime e dokumentuar + endpoint stream funksional.

### Hapi 4 — Security + data isolation verifikim
**Owner:** Senior Cyber Security Engineer + Senior Database Engineer  
- Enforce household membership checks për çdo endpoint në këtë sprint.
- Konfirmo që query layer respekton tenant scope.
- Shto audit events për membership changes dhe item updates kritike.

**Output i pritshëm:** security checklist e Sprint 2 e kaluar.

### Hapi 5 — Testing + CI gate për Sprint 2
**Owner:** Senior Test Engineer + Senior DevOps Engineer  
- Shto contract tests për households/lists/realtime.
- Shto integration tests për negative paths (cross-tenant denial).
- Lidhe test matrix në CI si gate detyrues.

**Output i pritshëm:** pipeline me gates për Sprint 2 flows.

---

## 3) RACI i shkurtër
- **Responsible:** Software Engineers, Solution Engineer, Test Engineer.
- **Accountable:** Software Architect.
- **Consulted:** Cyber Security, Database, DevOps, Cloud, Data, Network.
- **Informed:** gjithë ekipi i sprint-it.

---

## 4) Risk-e dhe mitigim
1. **Risk:** drift midis API contract dhe frontend expectations.  
   **Mitigim:** contract tests + versionim i endpoint map.
2. **Risk:** regressions në isolation tenant gjatë portimit.  
   **Mitigim:** mandatory negative integration tests në CI.
3. **Risk:** event storms në realtime channels.  
   **Mitigim:** backpressure limits + reconnect cursor strategy.

---

## 5) Definition of Done për Sprint 2
- Households + Lists funksionale në Nest runtime.
- Realtime events me tenant-safe delivery.
- Contract/integration tests të Sprint 2 kalojnë në CI.
- Security checklist e sprint-it e nënshkruar nga Cyber + Architecture.
