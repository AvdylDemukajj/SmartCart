# Sprint 4 Kickoff — Price/Flyers Pipeline

**Data nisjes:** 2026-03-30  
**Sprint:** 4 (Price/Flyers Pipeline)  
**Gjuhë pune:** Shqip  
**Modalitet:** Ekzekutim hap-pas-hapi (step-by-step)

---

## 1) Qëllimi i Sprint 4
Të ndërtohet pipeline i çmimeve i qeverisur (staging -> validim -> promotion) për të parandaluar data poisoning dhe për të mbështetur engine-in e vlerësimit të kostos së listës.

---

## 2) Task-et hap-pas-hapi (renditje operative)

### Hapi 1 — Ingestion në staging me metadata
**Owner:** Senior Data Engineer + Senior Solution Engineer  
- Implemento endpoint/ingestion path që shkruan vetëm në `prices_staging`.
- Ruaj metadata: burimi, timestamp, version broshure, confidence.
- Blloko direct-write në tabela live nga scraper flow.

**Output i pritshëm:** pipeline hyrëse e izoluar dhe e gjurmueshme.

### Hapi 2 — Rregullat e validimit dhe anomalive
**Owner:** Senior Data Engineer + Senior Cyber Security Engineer  
- Defino rregulla për outlier detection, zero-price anomaly dhe logical bounds.
- Implemento validator job me status-e (`valid`, `rejected`, `manual_review`).
- Log-o arsyet e refuzimit për audit.

**Output i pritshëm:** validator i automatizuar + raport anomalish.

### Hapi 3 — Promotion workflow i kontrolluar
**Owner:** Senior Software Engineer + Senior Database Engineer  
- Implemento promotion endpoint/job nga staging në live vetëm për batch-et e validuara.
- Shto transaksion atomic dhe rollback strategy në rast dështimi.
- Shto audit event për çdo promotion.

**Output i pritshëm:** promotion flow i sigurt dhe i rikuperueshëm.

### Hapi 4 — Cache dhe query performance
**Owner:** Senior Cloud Engineer + Senior Software Engineer  
- Implemento Redis caching për query-t e pricing estimate me TTL/invalidation strategy.
- Shto observability për cache hit/miss dhe latency.
- Verifiko performance target për endpoint-et e cost estimate.

**Output i pritshëm:** përgjigje më të shpejta me telemetri të plotë.

### Hapi 5 — Testing + release gates për Sprint 4
**Owner:** Senior Test Engineer + Senior DevOps Engineer  
- Shto test suite për ingestion/validation/promotion dhe poisoning scenarios.
- Shto integration tests me batch të pavlefshme dhe partial failures.
- Bëje CI gate detyrues për pipeline e çmimeve.

**Output i pritshëm:** quality gates të Sprint 4 aktive në CI.

---

## 3) RACI i shkurtër
- **Responsible:** Data Engineer, Software Engineer, Test Engineer.
- **Accountable:** Software Architect.
- **Consulted:** Cyber Security, Database, DevOps, Cloud, Solution, Network.
- **Informed:** gjithë ekipi i sprint-it.

---

## 4) Risk-e dhe mitigim
1. **Risk:** data poisoning nga burime scraping jo të sakta.  
   **Mitigim:** staging-only writes + validator strict + manual review path.
2. **Risk:** promotion jo-atomik dhe korruptim i dataset-it live.  
   **Mitigim:** transaksione + rollback plan + dry-run mode.
3. **Risk:** cache stale që jep çmime të vjetra.  
   **Mitigim:** TTL + invalidation hooks në promotion events.

---

## 5) Definition of Done për Sprint 4
- Ingestion në `prices_staging` funksionale dhe e izoluar.
- Validator + anomaly controls aktive dhe të testuara.
- Promotion workflow i auditueshëm dhe i sigurt.
- Cache/performance metrics në threshold dhe CI gates të Sprint 4 kalojnë.
