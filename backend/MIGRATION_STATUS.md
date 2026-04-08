# SmartCart AI - Backend NestJS Migration Status

## 📁 Struktura e Krijuar në src-v2

### ✅ Komponentët e Implementuar

#### 1. **Core Application** (`src-v2/`)
- `main.ts` - Entry point (ekzistues, needs update)
- `app.module.ts` - Root module me të gjitha imports
- `app.controller.ts` - Health check endpoints
- `app.service.ts` - App service basic

#### 2. **Database Layer** (`src-v2/database/`)
- `database.module.ts` - Drizzle ORM + Neon PostgreSQL setup
- `redis.module.ts` - Redis connection për caching
- `schema.ts` - **COMPLETE** Database schema me 12 tabela:
  - households
  - users
  - household_members
  - grocery_lists
  - grocery_items
  - activity_logs
  - receipts
  - receipt_items
  - prices
  - prices_staging
  - budgets
  - ai_requests
  - stores

#### 3. **Auth Module** (`src-v2/modules/auth/`)
- `auth.module.ts` - Auth module exports
- `guards/auth.guard.ts` - JWT/Clerk validation
- `guards/household.guard.ts` - Household membership verification

#### 4. **Households Module** (`src-v2/modules/households/`)
- `households.module.ts` - Module definition
- `households.service.ts` - Business logic për households
- `households.controller.ts` - REST API endpoints:
  - POST /api/households - Create household
  - GET /api/households - List user's households
  - GET /api/households/:id - Get household details
  - PATCH /api/households/:id - Update household
  - DELETE /api/households/:id - Soft delete household
  - POST /api/households/:id/invite - Generate invite link
  - POST /api/households/invite/accept - Accept invite
  - DELETE /api/households/:id/members/:userId - Remove member
  - PATCH /api/households/:id/members/:userId/role - Update role

#### 5. **Lists Module** (`src-v2/modules/lists/`)
- `lists.module.ts` - Module definition (skeleton)
- TODO: lists.service.ts
- TODO: lists.controller.ts

## 📋 Module që Duhet të Krijohen

### Phase 1: Core Features (Javët 3-4)
```
src-v2/modules/items/
  ├── items.module.ts
  ├── items.service.ts
  └── items.controller.ts

src-v2/modules/activity/
  ├── activity.module.ts
  ├── activity.service.ts
  └── activity.controller.ts

src-v2/websockets/
  └── websockets.gateway.ts
```

### Phase 2: Advanced Features (Javët 5-6)
```
src-v2/modules/receipts/
  ├── receipts.module.ts
  ├── receipts.service.ts
  └── receipts.controller.ts

src-v2/modules/budgets/
  ├── budgets.module.ts
  ├── budgets.service.ts
  └── budgets.controller.ts

src-v2/modules/prices/
  ├── prices.module.ts
  ├── prices.service.ts
  └── prices.controller.ts

src-v2/modules/ai/
  ├── ai.module.ts
  ├── ai.service.ts
  └── ai.controller.ts
```

## 🔧 Konfigurimet e Nevojshme

### package.json Updates
```json
{
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/websockets": "^10.0.0",
    "@nestjs/platform-socket.io": "^10.0.0",
    "@nestjs/throttler": "^5.0.0",
    "@nestjs/config": "^3.0.0",
    "@nestjs/swagger": "^7.0.0",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.1",
    "drizzle-orm": "^0.30.0",
    "@neondatabase/serverless": "^0.9.0",
    "socket.io": "^4.6.0",
    "ioredis": "^5.3.0",
    "bullmq": "^4.0.0",
    "@clerk/clerk-sdk-node": "^4.13.0",
    "winston": "^3.11.0",
    "helmet": "^7.1.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@nestjs/testing": "^10.0.0",
    "drizzle-kit": "^0.21.0",
    "ts-jest": "^29.1.0",
    "@types/jest": "^29.5.0"
  }
}
```

### .env.example
```bash
# Database
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/smartcart?sslmode=require

# Redis
REDIS_URL=redis://localhost:6379

# Auth
CLERK_SECRET_KEY=sk_test_xxx
CLERK_PUBLISHABLE_KEY=pk_test_xxx

# AI
OPENAI_API_KEY=sk-proj-xxx

# Storage (Receipts)
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=eu-central-1
S3_BUCKET=smartcart-receipts

# App
PORT=4000
NODE_ENV=development
JWT_SECRET=your-secret-key
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "strictBindCallApply": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@/*": ["src-v2/*"]
    }
  }
}
```

### nest-cli.json
```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src-v2",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

### drizzle.config.ts
```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './src-v2/database/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

## 🚀 Hapat e Mbetur për Migrim

### 1. Install Dependencies (Lokal)
```bash
cd backend
npm install
```

### 2. Krijo Modules e Mbetura
```bash
# Items Module
nest g module items --directory src-v2/modules
nest g service items --directory src-v2/modules
nest g controller items --directory src-v2/modules

# Activity Module
nest g module activity --directory src-v2/modules
nest g service activity --directory src-v2/modules
nest g controller activity --directory src-v2/modules

# Receipts Module
nest g module receipts --directory src-v2/modules
nest g service receipts --directory src-v2/modules
nest g controller receipts --directory src-v2/modules

# Budgets Module
nest g module budgets --directory src-v2/modules
nest g service budgets --directory src-v2/modules
nest g controller budgets --directory src-v2/modules

# Prices Module
nest g module prices --directory src-v2/modules
nest g service prices --directory src-v2/modules
nest g controller prices --directory src-v2/modules

# AI Module
nest g module ai --directory src-v2/modules
nest g service ai --directory src-v2/modules
nest g controller ai --directory src-v2/modules
```

### 3. Setup WebSocket Gateway
```typescript
// src-v2/websockets/websockets.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*', // Configure for production
  },
})
export class WebSocketsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    // Authenticate and join household room
  }

  handleDisconnect(client: Socket) {
    // Cleanup
  }

  @SubscribeMessage('join_household')
  handleJoinHousehold(client: Socket, householdId: string) {
    client.join(`household:${householdId}`);
  }

  emitListUpdated(householdId: string, data: any) {
    this.server.to(`household:${householdId}`).emit('list:updated', data);
  }
}
```

### 4. Migrate Logic nga src/ në src-v2/

Logjika ekzistuese në `src/` që duhet migruar:
- `src/http/household-routes.js` → `src-v2/modules/households/households.controller.ts` ✅ (pjesërisht)
- `src/http/websocket-upgrade.js` → `src-v2/websockets/websockets.gateway.ts`
- `src/services/receipt-ocr.service.js` → `src-v2/modules/receipts/receipts.service.ts`
- `src/services/pricing.service.js` → `src-v2/modules/prices/prices.service.ts`
- `src/services/audit-log.service.js` → `src-v2/modules/activity/activity.service.ts`
- `src/repositories/postgres-household-repository.js` → `src-v2/modules/*/`.service.ts files
- `src/store.js` → Services + WebSocket Gateway
- `src/security.js` → Guards + Throttler
- `src/cache.js` → RedisModule
- `src/telemetry.js` → Winston Logger + Prometheus

### 5. Setup Database Migrations
```bash
npm run db:generate
npm run db:migrate
```

### 6. Enable Row-Level Security (RLS)
```sql
-- Run after migrations
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE grocery_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE grocery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY household_isolation ON households
  USING (
    EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = households.id
      AND hm.user_id = auth.uid()
    )
  );
```

### 7. Testimi
```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Type checking
npm run typecheck:v2

# Start dev server
npm run nest:start:dev
```

## 📊 Gap Analysis: Çfarë Mungon nga PRD

| Feature | Status | Notes |
|---------|--------|-------|
| Household CRUD | ✅ 80% | Controller & Service created, DB integration pending |
| Real-time Sync | ❌ 0% | WebSocket Gateway needed |
| Activity Logging | ❌ 0% | Service needed |
| Lists & Items CRUD | ❌ 0% | Modules needed |
| Receipt OCR | ❌ 0% | BullMQ queue + worker needed |
| Price Comparison | ❌ 0% | Scraper integration needed |
| Budget Tracking | ❌ 0% | Module needed |
| AI Recipes | ❌ 0% | OpenAI integration needed |
| Voice Input | ❌ 0% | Speech-to-text integration needed |
| Barcode Scanner | ❌ 0% | Product lookup needed |
| RLS Policies | ❌ 0% | SQL migration needed |
| Rate Limiting | ⚠️ 50% | Throttler configured, needs Redis store |
| Clerk Auth | ⚠️ 50% | Guard skeleton, JWT validation needed |
| Swagger Docs | ❌ 0% | Decorators needed on controllers |

## 🎯 Next Steps Immediate

1. **Install dependencies locally** (disk space issue in workspace)
2. **Complete Items Module** (service + controller)
3. **Complete Activity Module** (auto-logging decorator)
4. **Setup WebSocket Gateway** (real-time sync)
5. **Implement Clerk JWT validation** in AuthGuard
6. **Create database migrations** with Drizzle Kit
7. **Write integration tests** for all endpoints

## 📝 Shënime

- Disk space në workspace është i kufizuar (504MB total)
- Kodin ekzistues në `src/` mund ta përdorim si referencë për logjikën e biznesit
- Schema e databazës është e plotë dhe gati për migrations
- Struktura modulare ndjek best practices të NestJS
- Të gjitha endpoint-et janë të dizajnuara sipas PRD-së
