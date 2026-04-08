# 📊 GAP ANALYSIS: GROCIFY-EXPO vs SMARTCART AI PRD

**Data e Analizës:** 2026-01-01  
**Repozitori i Analizuar:** https://github.com/burakorkmez/grocify-expo  
**Krahasuar me:** SmartCart AI Master Plan & PRD

---

## 🎯 PËRMBLEDHJE EKZEKUTIVE

### Gjendja Aktuale (Grocify-Expo)
Repozitori ekzistues është një **aplikacion bazë liste blerjesh** me funksionalitete minimale:
- ✅ Listë e thjeshtë grocery items (CRUD)
- ✅ Authentication me Clerk (Google, Apple, GitHub)
- ✅ Database PostgreSQL në Neon + Drizzle ORM
- ✅ State management me Zustand
- ✅ UI me NativeWind (Tailwind)
- ✅ Sentry për error tracking
- ✅ 3 ekrane kryesore: List, Planner, Insights

### ❌ MANGËSITË KRITIKE NDAJ PRD
Nga 114 taskat e identifikuara në Master Plan, **vetëm 8 janë të implementuara** (~7% coverage).

---

## 📋 ANALIZA E DETAJUAR SIPAS FAZAVE

### 🔴 FAZA 0: Setup & Foundation (0/34 tasks completed)

#### Backend Setup (Nest.js) - **0% I IMPLEMENTUAR**
| Task | Status | Shënime |
|------|--------|---------|
| Krijo projekt Nest.js | ❌ MISSING | Nuk ka backend të ndarë. API routes janë brenda Expo app (serverless functions) |
| Instalo drizzle-orm, @neondatabase/serverless | ✅ EXISTS | Por janë në frontend, jo në backend të ndarë |
| Instalo @nestjs/websockets, socket.io | ❌ MISSING | Nuk ka real-time sync |
| Instalo @nestjs/throttler | ❌ MISSING | Nuk ka rate limiting |
| Konfiguro tsconfig.json me path aliases | ⚠️ PARTIAL | Ka vetëm për Expo, jo për NestJS |
| Setup environment variables template | ⚠️ PARTIAL | Ka .env por mungojnë shumë variabla kritike |
| Konfiguro Drizzle ORM me Neon | ✅ EXISTS | Implementuar por pa RLS |
| Setup database migrations scripts | ⚠️ PARTIAL | Ka vetëm `db:push`, mungon `db:generate`, `db:migrate` |
| Setup Jest testing environment | ❌ MISSING | Nuk ka asnjë test |
| Implemento structured logging me Pino | ❌ MISSING | Nuk ka logging të strukturuar |
| Konfiguro Helmet.js middleware | ❌ MISSING | Nuk ka security headers |
| Setup Swagger/OpenAPI docs | ❌ MISSING | Nuk ka API documentation |

#### Database Schema & Security - **15% I IMPLEMENTUAR**
| Tabelë | Status | Shënime |
|--------|--------|---------|
| `households` | ❌ MISSING | Nuk ekziston. Çdo user ka listën e vet pa mundësi bashkëpunimi |
| `users` | ⚠️ PARTIAL | Të dhënat vijnë nga Clerk, nuk ka tabelë lokale |
| `household_members` | ❌ MISSING | Nuk ka sistem anëtarësie |
| `grocery_lists` | ❌ MISSING | Nuk ka lists të shumëfishta, vetëm një listë globale |
| `grocery_items` | ✅ EXISTS | Por struktura është shumë bazike (mungon: list_id, household_id, added_by, purchased_by, unit) |
| `activity_logs` | ❌ MISSING | Nuk ka historik veprimesh |
| `receipts` | ❌ MISSING | Nuk ka skanim faturash |
| `receipt_items` | ❌ MISSING | - |
| `prices` | ❌ MISSING | Nuk ka databazë çmimesh |
| `prices_staging` | ❌ MISSING | - |
| `budgets` | ❌ MISSING | Nuk ka buxhete |
| `ai_requests` | ❌ MISSING | Nuk ka tracking të AI kostove |

**Row-Level Security (RLS):**
- ✅ PostgreSQL është në Neon
- ❌ RLS nuk është enable askund
- ❌ Nuk ka policies për isolation të të dhënave
- ❌ Nuk ka composite indexes

#### Auth & Middleware - **20% I IMPLEMENTUAR**
| Task | Status | Shënime |
|------|--------|---------|
| Clerk JWT validation | ✅ EXISTS | Në frontend përmes `@clerk/expo` |
| @CurrentUser() decorator | ❌ MISSING | Nuk ka backend për ta përdorur |
| HouseholdGuard | ❌ MISSING | Nuk ka households |
| Rate limiting global | ❌ MISSING | Nuk ka fare |
| Exception filter për uniform errors | ⚠️ PARTIAL | Ka error handling базik në API routes |
| Request timeout middleware | ❌ MISSING | - |

---

### 🔴 FAZA 1: Core Features - Household & Lists (5/40 tasks completed)

#### Household Module API - **0% I IMPLEMENTUAR**
| Endpoint | Status | Shënime |
|----------|--------|---------|
| POST /api/households | ❌ MISSING | - |
| GET /api/households | ❌ MISSING | - |
| GET /api/households/:id | ❌ MISSING | - |
| PATCH /api/households/:id | ❌ MISSING | - |
| DELETE /api/households/:id | ❌ MISSING | - |
| POST /api/households/:id/invite | ❌ MISSING | Nuk ka sistem ftesash |
| POST /api/households/invite/accept | ❌ MISSING | - |
| DELETE /api/households/:id/members/:userId | ❌ MISSING | - |
| PATCH /api/households/:id/members/:userId/role | ❌ MISSING | - |

**Problemi Kryesor:** Aplikacioni aktual është **single-user**. Nuk ka konceptin e "household" ose bashkëpunimit familjar.

#### Lists & Items Module API - **40% I IMPLEMENTUAR**
| Endpoint | Status | Shënime |
|----------|--------|---------|
| POST /api/households/:id/lists | ❌ MISSING | Nuk ka lists të shumëfishta |
| GET /api/households/:id/lists | ❌ MISSING | - |
| GET /api/lists/:id | ❌ MISSING | - |
| PATCH /api/lists/:id | ❌ MISSING | - |
| DELETE /api/lists/:id | ❌ MISSING | - |
| POST /api/lists/:id/items | ⚠️ PARTIAL | Ka `/api/items/index+api.ts` POST, por pa list_id |
| GET /api/lists/:id/items | ⚠️ PARTIAL | Ka `/api/items/index+api.ts` GET, kthen të gjitha items |
| PATCH /api/items/:id | ⚠️ PARTIAL | Ka `/api/items/[id]+api.ts` për update quantity/purchased |
| DELETE /api/items/:id | ⚠️ PARTIAL | Ka delete në `[id]+api.ts` |
| POST /api/items/bulk | ❌ MISSING | - |
| POST /api/items/:id/complete | ⚠️ PARTIAL | Funksionaliteti ekziston por pa activity logging |

**Struktura aktuale e `grocery_items`:**
```typescript
{
  id: text,
  name: text,
  category: text,
  quantity: integer,
  purchased: boolean,
  priority: text,
  updated_at: bigint
}
```

**Struktura e nevojshme sipas PRD:**
```typescript
{
  id: text,
  list_id: text (FK),        // ❌ MISSING
  household_id: text (FK),   // ❌ MISSING
  name: text,
  category: text,
  quantity: integer,
  unit: text,                // ❌ MISSING
  is_purchased: boolean,
  purchased_by: text (FK),   // ❌ MISSING
  added_by: text (FK),       // ❌ MISSING
  notes: text,               // ❌ MISSING
  created_at: timestamp,     // ❌ MISSING (ka vetëm updated_at)
  updated_at: timestamp
}
```

#### Real-Time Sync (WebSocket) - **0% I IMPLEMENTUAR**
| Task | Status | Shënime |
|------|--------|---------|
| Setup Socket.io gateway | ❌ MISSING | Nuk ka WebSocket fare |
| Event list:updated | ❌ MISSING | - |
| Event item:added/updated/deleted | ❌ MISSING | - |
| Event household:member:joined/left | ❌ MISSING | - |
| Logic për të dërguar events te anëtarët e saktë | ❌ MISSING | - |
| Reconnection logic me exponential backoff | ❌ MISSING | - |
| Test me 50+ concurrent connections | ❌ MISSING | - |

**Pasojë:** Përdoruesit duhet të bëjnë manual refresh për të parë ndryshimet. Nuk ka sync në kohë reale.

#### Activity Log & Audit - **0% I IMPLEMENTUAR**
| Task | Status | Shënime |
|------|--------|---------|
| Auto-logging në activity_logs | ❌ MISSING | Nuk ka tabelë activity_logs |
| GET /api/households/:id/activity | ❌ MISSING | - |
| Filtering për activity logs | ❌ MISSING | - |
| "Undo" feature me Redis TTL 30s | ❌ MISSING | - |

#### Frontend Integration (Expo) - **30% I IMPLEMENTUAR**
| Task | Status | Shënime |
|------|--------|---------|
| Update Expo app config me backend URL | ❌ MISSING | Nuk ka backend të ndarë |
| Replace mock API calls me TanStack Query | ❌ MISSING | Përdor fetch të thjeshtë, nuk ka TanStack Query |
| Implemento useHouseholds() hook | ❌ MISSING | Nuk ka households |
| Implemento useList(listId) hook me WebSocket | ❌ MISSING | - |
| Krijo HouseholdContext me Zustand | ❌ MISSING | Ka vetëm `useGroceryStore` për items |
| Offline persistence me MMKV | ❌ MISSING | Nuk ka offline support |
| HouseholdSelector.tsx component | ❌ MISSING | - |
| LiveList.tsx me optimistic updates | ⚠️ PARTIAL | Ka list view por pa optimistic updates |
| ActivityFeed.tsx component | ❌ MISSING | - |
| Error boundaries dhe retry logic | ⚠️ PARTIAL | Ka error handling bazik në store |

**Struktura aktuale e store:**
```typescript
// src/store/grocery-store.ts
type GroceryStore = {
  items: GroceryItem[];
  isLoading: boolean;
  error: string | null;
  loadItems: () => Promise<void>;
  addItem: (input) => Promise<void>;
  updateQuantity: (id, quantity) => Promise<void>;
  togglePurchased: (id) => Promise<void>;
  removeItem: (id) => Promise<void>;
  clearPurchased: () => Promise<void>;
};
```

**Mungesa kritike:**
- ❌ Nuk ka TanStack Query (për caching dhe background sync)
- ❌ Nuk ka WebSocket subscription
- ❌ Nuk ka offline persistence
- ❌ Nuk ka optimistic updates

---

### 🔴 FAZA 2: Advanced Features - Price Engine & OCR (0/25 tasks completed)

#### Price Engine API - **0% I IMPLEMENTUAR**
| Task | Status | Shënime |
|------|--------|---------|
| GET /api/stores | ❌ MISSING | Nuk ka databazë dyqanesh |
| GET /api/households/:id/lists/:listId/price-comparison | ❌ MISSING | - |
| Service për fuzzy matching (Levenshtein) | ❌ MISSING | - |
| Caching strategy me Redis (TTL=6h) | ❌ MISSING | Nuk ka Redis fare |
| Fallback logic për çmime | ❌ MISSING | - |
| GET /api/flyers | ❌ MISSING | Nuk ka broshura |
| GET /api/lists/:id/deals | ❌ MISSING | - |
| Background job për cache invalidation | ❌ MISSING | - |

#### Receipt OCR Pipeline - **0% I IMPLEMENTUAR**
| Task | Status | Shënime |
|------|--------|---------|
| POST /api/receipts/upload-url (presigned URL) | ❌ MISSING | Nuk ka Cloudflare R2/S3 integration |
| Konfiguro Cloudflare R2 bucket | ❌ MISSING | - |
| Setup BullMQ queue receipt-ocr | ❌ MISSING | Nuk ka message queue |
| Krijo worker process për OCR | ❌ MISSING | - |
| Image preprocessing | ❌ MISSING | - |
| Parser për ekstraktim të të dhënave | ❌ MISSING | - |
| Validation (total ±5%) | ❌ MISSING | - |
| Status "needs_review" | ❌ MISSING | - |
| GET /api/receipts/:id | ❌ MISSING | - |
| POST /api/receipts/:id/correct | ❌ MISSING | - |

#### Budget Tracking - **0% I IMPLEMENTUAR**
| Task | Status | Shënime |
|------|--------|---------|
| GET /api/households/:id/budget | ❌ MISSING | Nuk ka tabelë budgets |
| POST /api/households/:id/budget | ❌ MISSING | - |
| Query aggregation (materialized view) | ❌ MISSING | - |
| Alert logic (80% threshold) | ❌ MISSING | - |
| Export endpoint (CSV) | ❌ MISSING | - |

#### AI Recipe Integration - **0% I IMPLEMENTUAR**
| Task | Status | Shënime |
|------|--------|---------|
| OpenAI client wrapper | ❌ MISSING | Nuk ka integration me OpenAI |
| Prompt templates për receta | ❌ MISSING | - |
| POST /api/ai/recipes | ❌ MISSING | - |
| Rate limiting specifik për AI | ❌ MISSING | - |
| Caching për responses (Redis TTL=24h) | ❌ MISSING | - |
| POST /api/ai/recipe-to-list | ❌ MISSING | - |
| Tracking i kostove në ai_requests | ❌ MISSING | - |
| Fallback për receta lokale | ❌ MISSING | - |

---

### 🔴 FAZA 3: Smart Inputs & Polish (0/15 tasks completed)

#### Voice Input & Barcode Scanner - **0% I IMPLEMENTUAR**
| Task | Status | Shënime |
|------|--------|---------|
| POST /api/ai/voice-to-list | ❌ MISSING | Nuk ka speech-to-text |
| Parsing sasish dhe njësish | ❌ MISSING | - |
| POST /api/items/lookup-by-barcode | ❌ MISSING | Nuk ka barcode scanning |
| Fallback për barcode të panjohur | ❌ MISSING | - |
| Integro me frontend buttons | ❌ MISSING | - |

#### Testing & Quality Assurance - **0% I IMPLEMENTUAR**
| Task | Status | Shënime |
|------|--------|---------|
| Unit tests me Jest (>90% coverage) | ❌ MISSING | Nuk ka asnjë test |
| Integration tests me Testcontainers | ❌ MISSING | - |
| E2E test për user journey | ❌ MISSING | - |
| Contract tests me Pact | ❌ MISSING | - |
| OWASP ZAP scan në CI | ❌ MISSING | Nuk ka CI pipeline |
| Tests specifikë për RLS | ❌ MISSING | - |
| Test rate limiting (429 status) | ❌ MISSING | - |
| Load testing me k6/Artillery | ❌ MISSING | - |

#### Monitoring, Logging & Observability - **10% I IMPLEMENTUAR**
| Task | Status | Shënime |
|------|--------|---------|
| Integro Sentry | ✅ EXISTS | Në frontend, por mungon në backend |
| Setup Prometheus metrics /metrics | ❌ MISSING | - |
| Konfiguro Grafana dashboard | ❌ MISSING | - |
| Health check endpoints (/health, /ready) | ❌ MISSING | - |
| Alert rules në Prometheus | ❌ MISSING | - |
| Synthetic monitoring cron job | ❌ MISSING | - |

#### Security Hardening & Compliance - **0% I IMPLEMENTUAR**
| Task | Status | Shënime |
|------|--------|---------|
| Audit të gjitha input DTOs | ❌ MISSING | Nuk ka class-validator |
| Sanitize user-generated content | ❌ MISSING | - |
| GDPR endpoints (export/delete) | ❌ MISSING | - |
| Consent tracking për AI features | ❌ MISSING | - |
| Encrypt sensitive fields në DB | ❌ MISSING | - |
| Automated backup për Neon | ⚠️ PARTIAL | Neon ka backup automatik, por nuk është konfiguruar manualisht |
| Runbook për incident response | ❌ MISSING | - |

#### Deployment & CI/CD - **0% I IMPLEMENTUAR**
| Task | Status | Shënime |
|------|--------|---------|
| Krijo Dockerfile për Nest.js | ❌ MISSING | Nuk ka Docker setup |
| GitHub Actions pipeline | ❌ MISSING | Nuk ka CI/CD |
| Database migration workflow në CI | ❌ MISSING | - |
| Preview environments për PR | ❌ MISSING | - |
| Blue-green deployment | ❌ MISSING | - |
| Rollback script | ❌ MISSING | - |
| Environment promotion (dev→staging→prod) | ❌ MISSING | - |

#### Documentation & Developer Experience - **0% I IMPLEMENTUAR**
| Task | Status | Shënime |
|------|--------|---------|
| OpenAPI spec në /api/docs | ❌ MISSING | - |
| TypeScript client library | ❌ MISSING | - |
| Postman collection | ❌ MISSING | - |
| "Getting Started" guide | ⚠️ PARTIAL | Ka vetëm README bazik |
| ADRs (Architecture Decision Records) | ❌ MISSING | - |
| Runbook për on-call | ❌ MISSING | - |

#### Pre-Launch Checklist - **0% I IMPLEMENTUAR**
| Task | Status | Shënime |
|------|--------|---------|
| Security audit manual | ❌ MISSING | - |
| Test në devices reale (iOS/Android) | ❌ MISSING | - |
| Verifiko GDPR compliance | ❌ MISSING | - |
| Test me pilot users (5-10 households) | ❌ MISSING | - |
| App store assets | ❌ MISSING | - |
| Analytics events tracking | ❌ MISSING | - |
| Emergency contact list | ❌ MISSING | - |
| Final cost review | ❌ MISSING | - |

---

## 📊 STATISTIKAT E COVERAGE

| Kategori | Tasks Total | Tasks Completed | Coverage |
|----------|-------------|-----------------|----------|
| **Faza 0: Foundation** | 34 | 5 | 15% |
| **Faza 1: Core Features** | 40 | 8 | 20% |
| **Faza 2: Advanced Features** | 25 | 0 | 0% |
| **Faza 3: Polish & QA** | 15 | 0 | 0% |
| **TOTAL** | **114** | **13** | **~11%** |

---

## 🚨 PROBLEMET KRITIKE QË DUHEN ZGJIDHUR MENJËHERË

### 1. **Arkitektura Monolitike (Critical)**
**Problem:** API routes janë brenda aplikacionit Expo (`src/app/api/`). Kjo është arkitekturë serverless për web, jo për mobile app enterprise.

**Rreziku:**
- Nuk mund të kesh WebSocket për real-time sync
- Nuk mund të kesh BullMQ workers për OCR/AI
- Nuk mund të kesh rate limiting të saktë
- Performance e keqe kur rritet numri i përdoruesve

**Zgjidhja:** Migrimi i plotë në **Nest.js backend të ndarë**.

### 2. **Mungesa e Household System (Critical)**
**Problem:** Çdo përdorues ka listën e vet. Nuk ka bashkëpunim familjar.

**Rreziku:** E gjithë ideja kryesore e SmartCart AI (bashkëpunimi familjar) nuk funksionon.

**Zgjidhja:** 
- Krijo tabelat `households`, `household_members`, `grocery_lists`
- Implemento RLS policies
- Rishkruaj të gjitha query-të për të filtruar sipas household_id

### 3. **Mungesa e Row-Level Security (High)**
**Problem:** Nuk ka RLS në databazë.

**Rreziku:** Data bleed midis përdoruesve. Një bug në kod mund të shfaqë të dhënat e familjes A te familja B.

**Zgjidhja:** Enable RLS në të gjitha tabelat dhe krijo policies.

### 4. **Mungesa e Real-Time Sync (High)**
**Problem:** Nuk ka WebSocket. Përdoruesit nuk e shohin ndryshimin menjëherë.

**Rreziku:** Përvojë e keqe përdoruesi. Dy anëtarë të së njëjtës familje mund të blejnë të njëjtin produkt sepse nuk e shohin që tjetri e ka shënuar si "të blerë".

**Zgjidhja:** Implemento Socket.io në Nest.js backend.

### 5. **Mungesa e Testing (High)**
**Problem:** 0% code coverage. Asnjë test.

**Rreziku:** Regressions, bugs në production, refactoring i vështirë.

**Zgjidhja:** Setup Jest + Testcontainers + k6.

### 6. **Mungesa e CI/CD (Medium)**
**Problem:** Nuk ka pipeline automatik.

**Rreziku:** Deployment manual, human errors, downtime.

**Zgjidhja:** GitHub Actions me lint → test → build → deploy.

---

## 🛠️ PLANI I MIGRIMIT

### Hapi 1: Setup Nest.js Backend (Javët 1-2)
```bash
# Krijo backend të ri
cd /workspace
nest new smartcart-backend --package-manager npm

# Install dependencies
cd smartcart-backend
npm install drizzle-orm @neondatabase/serverless
npm install @nestjs/websockets socket.io
npm install @nestjs/throttler @nestjs/schedule
npm install bullmq ioredis
npm install class-validator class-transformer
npm install @nestjs/swagger
npm install pino pino-http
npm install helmet
```

### Hapi 2: Database Schema Migration (Javët 2-3)
- Krijo skemën e re me 12 tabela
- Enable RLS
- Migrimi i të dhënave ekzistuese (nëse ka)
- Composite indexes

### Hapi 3: API Endpoints Rewrite (Javët 3-5)
- Shkruaj të gjitha endpoints nga e para në Nest.js
- Implemento Guards dhe Filters
- Setup Swagger docs

### Hapi 4: Real-Time Sync (Javët 5-6)
- Setup Socket.io gateway
- Implemento events
- Test me concurrent users

### Hapi 5: Frontend Refactor (Javët 6-8)
- Replace fetch me TanStack Query
- Add WebSocket subscriptions
- Implemento offline persistence me MMKV
- Optimistic updates

### Hapi 6: Advanced Features (Javët 8-11)
- Price engine me Redis caching
- OCR pipeline me BullMQ
- AI recipes me OpenAI
- Voice input dhe barcode scanning

---

## 📝 KONKLUZIONI

**Grocify-Expo** është një **fillim i mirë për një aplikacion personal liste blerjesh**, por është **shumë larg** nga kërkesat e **SmartCart AI** si sistem enterprise multi-family.

**Çfarë mund të ruhet:**
- ✅ UI components (NativeWind styling)
- ✅ Clerk authentication flow
- ✅ Drizzle ORM configuration
- ✅ Zustand state management pattern
- ✅ Sentry integration

**Çfarë duhet rishkruar plotësisht:**
- ❌ E gjithë arkitektura e backend-it (duhet Nest.js i ndarë)
- ❌ Database schema (duhet 12 tabela me RLS)
- ❌ API endpoints (duhet REST + WebSocket)
- ❌ Frontend data fetching (duhet TanStack Query)
- ❌ Testing infrastructure
- ❌ CI/CD pipeline

**Rekomandimi:** Fillo nga e para me Nest.js backend duke përdorur komponentët e UI nga Grocify-Expo. Mos u përpiq të "ndreqësh" arkitekturën ekzistuese sepse do të jetë më e shtrenjtë se ta ndërtosh siç duhet që në fillim.

---

## 📎 APPENDIX: Struktura Aktuale e Skedarëve

```
grocify-expo/
├── src/
│   ├── app/
│   │   ├── (tabs)/
│   │   │   ├── index.tsx          # Lista e items (vetëm UI)
│   │   │   ├── planner.tsx        # Shto item të ri
│   │   │   └── insights.tsx       # Stats + profile
│   │   ├── api/
│   │   │   └── items/
│   │   │       ├── index+api.ts   # GET/POST items
│   │   │       └── [id]+api.ts    # PATCH/DELETE item
│   │   ├── (auth)/
│   │   │   └── sign-in.tsx
│   │   ├── _layout.tsx            # Clerk + Sentry setup
│   │   └── sso-callback.tsx
│   ├── components/
│   │   ├── list/
│   │   ├── planner/
│   │   └── insights/
│   ├── lib/
│   │   └── server/
│   │       └── db/
│   │           ├── client.ts      # Drizzle + Neon connection
│   │           ├── schema.ts      # Vetëm grocery_items table
│   │           └── db-actions.ts  # CRUD functions
│   └── store/
│       └── grocery-store.ts       # Zustand store
├── drizzle.config.ts
├── package.json
└── README.md
```

**Struktura e Nevojshme për SmartCart AI:**
```
smartcart-ai/
├── apps/
│   ├── mobile/                  # Expo app (refactored)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── components/
│   │   │   ├── hooks/           # TanStack Query hooks
│   │   │   ├── store/           # Zustand (vetëm për UI state)
│   │   │   └── lib/
│   │   │       └── api-client.ts # Generated from OpenAPI
│   │   └── package.json
│   │
│   └── backend/                 # Nest.js (NEW)
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── households/
│       │   │   ├── lists/
│       │   │   ├── items/
│       │   │   ├── prices/
│       │   │   ├── receipts/
│       │   │   ├── budgets/
│       │   │   └── ai/
│       │   ├── common/
│       │   │   ├── decorators/
│       │   │   ├── guards/
│       │   │   ├── filters/
│       │   │   └── pipes/
│       │   ├── database/
│       │   │   ├── schema/
│       │   │   ├── migrations/
│       │   │   └── rls-policies/
│       │   ├── websocket/
│       │   │   └── gateway.ts
│       │   ├── queue/
│       │   │   └── bullmq.config.ts
│       │   └── main.ts
│       ├── test/
│       ├── Dockerfile
│       └── package.json
│
├── services/
│   ├── scraper/                 # Python script (NEW)
│   │   ├── scrapers/
│   │   ├── proxies/
│   │   └── validator.py
│   │
│   └── ocr-worker/              # Node.js worker (NEW)
│       └── processor.ts
│
├── infra/
│   ├── docker-compose.yml
│   ├── k8s/
│   └── terraform/
│
└── docs/
    ├── API.md
    ├── ARCHITECTURE.md
    └── RUNBOOKS/
```

---

**Dokument i përgatitur nga:** Senior Software Architect Team  
**Data:** 2026-01-01  
**Status:** Ready for migration planning
