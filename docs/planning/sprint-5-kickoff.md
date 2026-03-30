# Sprint 5 Kickoff — Receipts OCR + Budget + Workers

**Data nisjes:** 2026-03-30  
**Sprint:** 5 (Receipts OCR + Budget + Workers)  
**Gjuhë pune:** Shqip  
**Modalitet:** Ekzekutim hap-pas-hapi (step-by-step)

---

## 1) Qëllimi i Sprint 5
Të prodhohet pipeline i qëndrueshëm për OCR të faturave me workers asinkronë dhe integrim të plotë me buxhetin e familjes.

---

## 2) Task-et hap-pas-hapi (renditje operative)

### Hapi 1 — Upload flow i sigurt (presigned URL)
**Owner:** Senior Cloud Engineer + Senior Software Engineer  
- Implemento endpoint për presigned URL (S3/R2) me afat të kufizuar.
- Siguro që upload të bëhet direkt nga klienti në object storage (jo përmes API server).
- Implemento callback/webhook verifikues pas upload-it.

**Output i pritshëm:** upload pipeline i sigurt dhe i shkallëzueshëm.

### Hapi 2 — Queue/Worker architecture për OCR
**Owner:** Senior Software Engineer + Senior DevOps Engineer  
- Implemento BullMQ queue për OCR jobs.
- Shto worker process me retry policy, backoff dhe dead-letter queue.
- Ruaj job state timeline (queued/processing/failed/retried/succeeded).

**Output i pritshëm:** OCR workflow durable dhe i rikuperueshëm.

### Hapi 3 — OCR correction/apply flow
**Owner:** Senior Software Engineer + Senior Test Engineer  
- Implemento endpoints për manual correction dhe apply të rezultatit OCR.
- Siguro validation për payload-et e korrigjimit.
- Shto audit event për correction/apply veprime.

**Output i pritshëm:** correction loop i kontrolluar dhe i auditueshëm.

### Hapi 4 — Integrimi me buxhetin dhe listën
**Owner:** Senior Solution Engineer + Senior Database Engineer  
- Lidh apply OCR result me budget update.
- Implemento auto-marking të artikujve të listës kur përputhja është e vlefshme.
- Shto safeguards kundër double-apply.

**Output i pritshëm:** receipts -> budget/list flow end-to-end.

### Hapi 5 — Testim, observability dhe release gate
**Owner:** Senior Test Engineer + Senior DevOps Engineer + Senior Cyber Security Engineer  
- Shto E2E tests për skenarë normal/fail/retry/dead-letter/manual correction.
- Shto metrics për queue lag, retry ratio, fail ratio, apply success ratio.
- Aktivizo CI gate detyrues për OCR pipeline.

**Output i pritshëm:** quality + reliability gates aktive për Sprint 5.

---

## 3) RACI i shkurtër
- **Responsible:** Cloud Engineer, Software Engineer, Test Engineer.
- **Accountable:** Software Architect.
- **Consulted:** DevOps, Cyber Security, Database, Data, Solution, Network.
- **Informed:** gjithë ekipi i sprint-it.

---

## 4) Risk-e dhe mitigim
1. **Risk:** dështime intermitente OCR që krijojnë backlog.  
   **Mitigim:** retry/backoff + DLQ + observability alarms.
2. **Risk:** apply i dyfishtë dhe devijim i buxhetit.  
   **Mitigim:** idempotency key + apply guards.
3. **Risk:** upload abuse me payload të dëmshëm.  
   **Mitigim:** MIME/type checks + size limits + signed URL expiry.

---

## 5) Definition of Done për Sprint 5
- Presigned upload flow funksional dhe i sigurt.
- OCR workers me retry/DLQ aktive.
- Correction + apply flow i audituar dhe i testuar.
- Integrimi me budget/list i verifikuar end-to-end.
- CI gates dhe metrikat operacionale të Sprint 5 kalojnë.
