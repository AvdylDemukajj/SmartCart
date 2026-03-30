# Secrets Management Policy (SmartCart Backend)

## Scope
Ky dokument përkufizon menaxhimin e sekreteve për backend-in e SmartCart.

## Rules
- Asnjë secret nuk ruhet në source control (`.env` vetëm local).
- Rotacion i sekreteve JWT bëhet me `AUTH_JWT_SECRETS` (old,new).
- Në runtime lexohet vetëm nga environment variables.
- Incident response: në rrjedhje sekreti bëhet revokim i menjëhershëm + rotacion.

## Required environment variables
- `AUTH_JWT_SECRET` ose `AUTH_JWT_SECRETS`
- `AUTH_JWT_ISSUER` dhe `AUTH_JWT_AUDIENCE` (rekomandohen fuqishëm në production)
- `PORT` (opsional, jo secret)
- `ALLOW_INSECURE_DEV_AUTH=false` në production (mos lejo `x-user-id`/`dev-user:*`).

## Operational checklist
1. Gjenero secret të ri me entropi të lartë.
2. Vendos `AUTH_JWT_SECRETS=oldSecret,newSecret` për periudhë tranzicioni.
3. Verifiko token-et e reja.
4. Largo secret-in e vjetër pas afatit të tranzicionit.
