# Sprint 6 Kickoff — Pantry + AI Recipes + Quotas

**Data nisjes:** 2026-03-30  
**Sprint:** 6 (Pantry + AI Recipes + Quotas)  
**Gjuhë pune:** Shqip  
**Modalitet:** Ekzekutim hap-pas-hapi (step-by-step)

---

## 1) Qëllimi i Sprint 6
Të dorëzohet funksionaliteti Pantry + AI Recipes me kontroll të kostos, kufizim abuzimi dhe gjurmueshmëri operacionale.

---

## 2) Task-et hap-pas-hapi (renditje operative)

### Hapi 1 — Pantry freshness intelligence
**Owner:** Senior Software Engineer + Senior Data Engineer  
- Implemento logjikën e freshness/expiry hints bazuar në receipts/pantry timeline.
- Defino threshold-e për njoftime “prishje e mundshme”.
- Shto payload standard për sugjerime pantry.

**Output i pritshëm:** Pantry signals funksionale dhe të testueshme.

### Hapi 2 — AI recipe suggestion flow
**Owner:** Senior Software Engineer + Senior Solution Engineer  
- Implemento endpoint për recipe generation me context nga pantry + budget.
- Implemento flow “recipe -> add ingredients to list”.
- Normalizo model output në strukturë stabile për frontend.

**Output i pritshëm:** AI recipe flow end-to-end.

### Hapi 3 — Quotas dhe cost governance
**Owner:** Senior Cyber Security Engineer + Senior Cloud Engineer  
- Enforce rate limits / quotas sipas planit përdorues.
- Shto cost guardrails (daily caps, fail-closed behavior).
- Shto audit trail për request, quota-hit, throttle actions.

**Output i pritshëm:** AI abuse controls aktive dhe të monitorueshme.

### Hapi 4 — Caching + prompt/version management
**Owner:** Senior Data Engineer + Senior DevOps Engineer  
- Implemento cache për përgjigje AI me TTL të kontrolluar.
- Versiono prompt templates dhe ruaj provenance metadata.
- Implemento invalidation strategy kur ndryshon template/version.

**Output i pritshëm:** performancë më e mirë + riprodhueshmëri e rezultateve AI.

### Hapi 5 — Testim dhe release gate
**Owner:** Senior Test Engineer + Senior Cyber Security Engineer  
- Shto tests për quota bypass, abuse patterns, dhe fallback behavior.
- Shto tests për pantry-to-recipe correctness.
- Bëje CI gate detyrues për AI/pantry modules.

**Output i pritshëm:** quality gates të Sprint 6 aktive në CI.

---

## 3) RACI i shkurtër
- **Responsible:** Software Engineer, Data Engineer, Test Engineer.
- **Accountable:** Software Architect.
- **Consulted:** Cyber Security, Cloud, DevOps, Solution, Database, Network.
- **Informed:** gjithë ekipi i sprint-it.

---

## 4) Risk-e dhe mitigim
1. **Risk:** kosto e lartë e API AI nga abuzimi.  
   **Mitigim:** quotas + throttling + hard caps ditore.
2. **Risk:** receta jo relevante nga pantry data e paplotë.  
   **Mitigim:** fallback prompts + confidence flags.
3. **Risk:** stale cache me sugjerime të vjetruara.  
   **Mitigim:** TTL + invalidation në ndryshim pantry state.

---

## 5) Definition of Done për Sprint 6
- Pantry freshness logic aktive.
- Recipe suggestion + add-to-list flow funksional.
- AI quotas/cost controls të zbatuara dhe të testuara.
- Cache + prompt versioning operative.
- CI gates të Sprint 6 kalojnë me evidencë.
