# Sprint 7 Kickoff — Smart Inputs (Voice + Barcode)

**Data nisjes:** 2026-03-30  
**Sprint:** 7 (Smart Inputs: Voice + Barcode)  
**Gjuhë pune:** Shqip  
**Modalitet:** Ekzekutim hap-pas-hapi (step-by-step)

---

## 1) Qëllimi i Sprint 7
Të dorëzohen input-et inteligjente (zëri + barkodi) me kontrata të qarta API, normalizim të dhënash dhe integrim të sigurt në listën e blerjeve.

---

## 2) Task-et hap-pas-hapi (renditje operative)

### Hapi 1 — Voice contract dhe payload standard
**Owner:** Senior Solution Engineer + Senior Software Engineer  
- Defino contract për voice parsing request/response.
- Standardizo formatin e item-eve të nxjerra (`name`, `quantity`, `unit`, `confidence`).
- Shto versionim të contract-it për kompatibilitet të ardhshëm.

**Output i pritshëm:** API contract i formalizuar për voice flow.

### Hapi 2 — Voice parsing pipeline
**Owner:** Senior Software Engineer + Senior Data Engineer  
- Implemento pipeline: speech/text input -> parsing -> normalization -> validated items.
- Shto fallback paths për input ambigu.
- Ruaj metadata për confidence score dhe post-correction.

**Output i pritshëm:** voice-to-items pipeline funksional.

### Hapi 3 — Barcode lookup dhe product resolution
**Owner:** Senior Software Engineer + Senior Database Engineer  
- Implemento endpoint për barcode lookup.
- Lidhe me product catalog mapping dhe fallback query strategy.
- Normalizo rezultatet për insert direkt në listë.

**Output i pritshëm:** barcode-to-product flow i qëndrueshëm.

### Hapi 4 — Integrim me list module dhe security checks
**Owner:** Senior Cyber Security Engineer + Senior Software Engineer  
- Siguro household scope checks në voice/barcode add-to-list actions.
- Shto audit event për input source (`voice`/`barcode`) dhe actor.
- Verifiko rate limiting për input endpoints.

**Output i pritshëm:** input-et inteligjente të sigurta dhe të auditueshme.

### Hapi 5 — Testing + CI gate
**Owner:** Senior Test Engineer + Senior DevOps Engineer  
- Shto test suite për edge cases të voice parse (dialekte, quantity ambiguity).
- Shto test suite për barcode collisions dhe not-found handling.
- Aktivizo CI gate detyrues për modulet e Sprint 7.

**Output i pritshëm:** quality gates aktive për Smart Inputs.

---

## 3) RACI i shkurtër
- **Responsible:** Solution Engineer, Software Engineer, Test Engineer.
- **Accountable:** Software Architect.
- **Consulted:** Data, Database, Cyber Security, DevOps, Cloud, Network.
- **Informed:** gjithë ekipi i sprint-it.

---

## 4) Risk-e dhe mitigim
1. **Risk:** parse jo i saktë për input me ambiguite.  
   **Mitigim:** confidence threshold + user correction loop.
2. **Risk:** barcode jo i gjetur në katalog lokal.  
   **Mitigim:** fallback provider + manual quick-add.
3. **Risk:** abuse i endpoint-eve voice/barcode.  
   **Mitigim:** rate limiting + audit + anomaly detection.

---

## 5) Definition of Done për Sprint 7
- Voice contract + parser pipeline aktive.
- Barcode lookup + add-to-list flow funksional.
- Security/audit checks për smart input endpoints aktive.
- Testet e Sprint 7 kalojnë dhe CI gate është i detyrueshëm.

---

## 6) Status përmbylljeje (2026-03-30)
- ✅ Voice API contract është versionuar (`contractVersion: v1`) dhe output standard përfshin `name`, `quantity`, `unit`, `confidence`.
- ✅ Voice pipeline prodhon edhe `ambiguousSegments` për post-correction loop.
- ✅ Barcode lookup ka strategy me `catalog_exact` + `catalog_prefix_fallback` dhe metadata `resolutionSource/confidence`.
- ✅ Smart input endpoints kanë rate-limit të dedikuar dhe audit trail.
- ✅ Testet e Sprint 7 për contract/fallback/rate-limit janë shtuar në suite.
- ✅ CI enforce edhe `typecheck:v2` + test-pattern gate për smart-input contract.
