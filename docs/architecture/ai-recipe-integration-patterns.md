# AI Recipe Integration Patterns (Pragmatic)

Ky dokument përmbledh pattern-et praktike të përdorura zakonisht nga aplikacionet që japin recipe suggestions me AI:

1. **Provider abstraction layer**
   - API route nuk lidhet direkt me modelin.
   - Kalohet përmes service/provider (`openai`, `stub fallback`) për portability.

2. **Strict JSON contract**
   - Prompt kërkon JSON strict për të shmangur parsing issues.
   - Output normalizohet dhe validohet para se të ekspozohet në API.

3. **Fallback strategy**
   - Nëse provider dështon ose nuk ka key, kalohet në deterministic fallback.
   - Kjo shmang outage në UX.

4. **Cache + rate limit**
   - Results cache me TTL për ulje kostoje dhe latency.
   - Rate-limit për endpoint-et AI për anti-abuse.

5. **Observability + audit**
   - Error rate / latency monitorim.
   - Audit events për auth/rate-limit anomalies.
