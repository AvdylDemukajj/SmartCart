# Sprint 8 Kickoff — Hardening + Go-Live (Sprinti Final)

**Data nisjes:** 2026-03-30  
**Sprint:** 8 (Hardening + Go-Live)  
**Gjuhë pune:** Shqip  
**Modalitet:** Ekzekutim hap-pas-hapi (step-by-step)

---

## 1) Qëllimi i Sprint 8
Të përfundohet hardening i plotë teknik/operacional dhe të arrihet vendimi final i go-live me sign-off ndër-disiplinor.

---

## 2) Task-et hap-pas-hapi (renditje operative)

### Hapi 1 — Network & perimeter hardening
**Owner:** Senior Network Engineer + Senior Cyber Security Engineer  
- Finalizo ingress/egress policy, segmentim rrjeti dhe access controls.
- Verifiko CORS allowlist dhe kufizimet e ekspozimit të endpoint-eve.
- Konfirmo ndarjen e trafikut API vs workers.

**Output i pritshëm:** network hardening checklist e mbyllur.

### Hapi 2 — Security validation dhe incident readiness
**Owner:** Senior Cyber Security Engineer + Senior DevOps Engineer  
- Ekzekuto security review final (authz, RLS, abuse controls, auditability).
- Kryej tabletop drills për incidente kritike (data breach, queue outage, key compromise).
- Finalizo incident response playbooks.

**Output i pritshëm:** security sign-off + incident readiness evidence.

### Hapi 3 — Reliability/SLO/observability closure
**Owner:** Senior DevOps Engineer + Senior Cloud Engineer  
- Finalizo SLO/SLI dhe alert thresholds (latency, error rate, queue lag, fail ratio).
- Verifiko dashboard-et e observability dhe trace correlation.
- Simulo degradim të kontrolluar dhe verifiko rollback procedures.

**Output i pritshëm:** operim production-ready i monitoruar.

### Hapi 4 — Staging soak dhe performance sign-off
**Owner:** Senior Cloud Engineer + Senior Test Engineer  
- Ekzekuto soak test në staging dhe verifiko stabilitetin e sistemit.
- Ekzekuto load/regression/security test matrix final.
- Raporto devijimet dhe mbylli bllokuesit kritikë.

**Output i pritshëm:** raport final i gatishmërisë teknike.

### Hapi 5 — Go-live governance dhe aprovimi final
**Owner:** Senior Software Architect + Senior Solution Engineer  
- Mblidh sign-off nga Architecture, Security, QA, Ops.
- Finalizo change ticket dhe planin e rollout-it gradual.
- Defino hypercare window dhe owner-on-call plan për post-launch.

**Output i pritshëm:** vendim formal Go-Live.

---

## 3) RACI i shkurtër
- **Responsible:** Network, DevOps, Cloud, Cyber Security, Test.
- **Accountable:** Software Architect.
- **Consulted:** Software, Solution, Data, Database.
- **Informed:** gjithë ekipi dhe stakeholder-ët e release.

---

## 4) Risk-e dhe mitigim
1. **Risk:** incident në orët e para të lansimit.  
   **Mitigim:** hypercare + rollback playbook + on-call matrix.
2. **Risk:** alert fatigue ose mungesë alarmesh kritike.  
   **Mitigim:** tuning i thresholds + test alerts para go-live.
3. **Risk:** regresion latent nën ngarkesë reale.  
   **Mitigim:** soak + phased rollout + canary checks.

---

## 5) Definition of Done për Sprint 8 (Final)
- Hardening teknik i mbyllur (network/security/ops).
- Test matrix final i kaluar (functional/load/security/regression).
- Sign-off formal nga ekipet kryesore.
- Go-live ticket i aprovuar dhe rollout plan i gatshëm.
