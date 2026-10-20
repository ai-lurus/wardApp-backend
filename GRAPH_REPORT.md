# Graph Report - wardApp-backend  (2026-05-08)

## Corpus Check
- 100 files · ~37,317 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 504 nodes · 783 edges · 40 communities (32 shown, 8 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]

## God Nodes (most connected - your core abstractions)
1. `withTenant()` - 77 edges
2. `AppError` - 26 edges
3. `registry` - 17 edges
4. `authMiddleware()` - 17 edges
5. `env` - 10 edges
6. `checkModuleAccess()` - 10 edges
7. `Ward.io Backend — Contexto para IA` - 9 edges
8. `Local Development Setup` - 7 edges
9. `sendWelcomeEmail()` - 6 edges
10. `UploadService` - 6 edges

## Surprising Connections (you probably didn't know these)
- `registerEntry()` --calls--> `withTenant()`  [EXTRACTED]
  src/services/inventory.service.ts → src/lib/prisma.ts
- `registerExit()` --calls--> `withTenant()`  [EXTRACTED]
  src/services/inventory.service.ts → src/lib/prisma.ts
- `listMovements()` --calls--> `withTenant()`  [EXTRACTED]
  src/services/inventory.service.ts → src/lib/prisma.ts
- `getStock()` --calls--> `withTenant()`  [EXTRACTED]
  src/services/inventory.service.ts → src/lib/prisma.ts
- `getAlerts()` --calls--> `withTenant()`  [EXTRACTED]
  src/services/inventory.service.ts → src/lib/prisma.ts

## Communities (40 total, 8 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (50): generateSwaggerSpec(), registry, authMiddleware(), Request, ACTIVE_STATUSES, checkModuleAccess(), router, body (+42 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (26): env, envSchema, env, buildSystemBlocks(), getClient(), streamWithCache(), StreamWithCacheParams, withToolCacheBreakpoint() (+18 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (24): UserSchema, AppError, errorHandler(), requireRole(), AppModuleEnum, body, CompanySchema, createCompanySchema (+16 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (21): argsContainCompanyId(), executeTool(), ExecuteToolParams, ExecuteToolResult, failureWithoutAudit(), WardenToolError, WardenToolErrorCode, get() (+13 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (27): 1. TODA query de negocio va dentro de `withTenant()`, 2. NUNCA hardcodear `company_id`, 3. Toda nueva tabla de negocio necesita RLS en la migración, 3b. `ALTER COLUMN ... TYPE` **re-añade los FKs en la misma migración**, 4. Módulos dinámicos — usar `checkModuleAccess` middleware, code:typescript (// CORRECTO), code:block10 (POST   /api/auth/login), code:typescript (// CORRECTO — siempre del JWT) (+19 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (20): body, createOperatorSchema, { docId }, documentTypeEnum, getOperatorsQuerySchema, { id }, idParamSchema, licenseTypeEnum (+12 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (23): 1. Install Dependencies, 2. Configure Environment Variables, 3. Start PostgreSQL using Docker (Optional), 4. Migrate the Database, 5. Seed the Database (Optional), 6. Start the Development Server, Available Scripts, code:bash (npm install) (+15 more)

### Community 7 - "Community 7"
Cohesion: 0.12
Nodes (10): COMPANY_SELECT, createCompany(), createCompanyUser(), USER_SELECT, forgotPassword(), log(), passwordResetHtml(), sendPasswordResetEmail() (+2 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (21): body, completeTripSchema, costBreakdown, costPreviewBodySchema, createTripSchema, filters, getTripsQuerySchema, { id } (+13 more)

### Community 9 - "Community 9"
Cohesion: 0.12
Nodes (13): loginGuard(), AuthResponseSchema, baseUrl, body, changePasswordSchema, { currentPassword, newPassword }, { email }, forgotPasswordSchema (+5 more)

### Community 10 - "Community 10"
Cohesion: 0.11
Nodes (15): { axles }, body, costPreviewQuerySchema, createRouteSchema, getRoutesQuerySchema, { id }, idParamSchema, query (+7 more)

### Community 11 - "Community 11"
Cohesion: 0.13
Nodes (14): body, createUnitSchema, getUnitsQuerySchema, { id }, idParamSchema, message, router, { status } (+6 more)

### Community 12 - "Community 12"
Cohesion: 0.31
Nodes (7): cleanupTestData(), createTestTenant(), TestTenant, globalForPrisma, app, tollboothA, tenantATrips

### Community 13 - "Community 13"
Cohesion: 0.14
Nodes (12): AlertaCard, AlertaCardSchema, Card, CARD_PAYLOAD_SCHEMAS, CardSchema, CardType, CardTypeSchema, IsoDateSchema (+4 more)

### Community 14 - "Community 14"
Cohesion: 0.15
Nodes (12): createCategory(), createMaterial(), CreateMaterialData, deleteCategory(), deleteMaterial(), getMaterial(), listCategories(), listMaterials() (+4 more)

### Community 15 - "Community 15"
Cohesion: 0.3
Nodes (11): withTenant(), addDocument(), createOperator(), deleteOperator(), getExpiringDocumentsAlerts(), getOperatorById(), getOperators(), OperatorFilters (+3 more)

### Community 16 - "Community 16"
Cohesion: 0.23
Nodes (10): ERROR_META, normalizeError(), sanitizeMessage(), sendError(), toErrorFrame(), toErrorPayload(), WardenError, WardenErrorCode (+2 more)

### Community 17 - "Community 17"
Cohesion: 0.2
Nodes (9): completeTrip(), CompleteTripDto, createTrip(), CreateTripDto, getTripById(), getTrips(), TripFilters, updateTripStatus() (+1 more)

### Community 18 - "Community 18"
Cohesion: 0.2
Nodes (9): createRoute(), CreateRouteInput, deleteRoute(), getRouteById(), getRouteCostPreview(), getRoutes(), RouteTollboothInput, updateRoute() (+1 more)

### Community 19 - "Community 19"
Cohesion: 0.2
Nodes (9): createZone(), CreateZoneData, deleteZone(), getMap(), getOrCreateConfig(), listZones(), updateConfig(), updateZone() (+1 more)

### Community 20 - "Community 20"
Cohesion: 0.2
Nodes (9): code:json ({), code:json ({), Configuración del Tenant, Decisiones de Diseño, Descripción General, Endpoint de previsualización, Estructura de Respuesta, Motor de Cálculo de Costos (WARD-027) (+1 more)

### Community 21 - "Community 21"
Cohesion: 0.22
Nodes (8): EntryData, ExitData, getAlerts(), getStock(), listMovements(), ListMovementsParams, registerEntry(), registerExit()

### Community 22 - "Community 22"
Cohesion: 0.25
Nodes (7): createTollbooth(), CreateTollboothInput, deleteTollbooth(), getTollboothById(), getTollbooths(), updateTollbooth(), UpdateTollboothInput

### Community 23 - "Community 23"
Cohesion: 0.25
Nodes (7): createUnit(), getInsuranceAlerts(), getUnitById(), getUnits(), UnitFilters, updateUnit(), updateUnitStatus()

### Community 24 - "Community 24"
Cohesion: 0.67
Nodes (3): daysAgo(), main(), prisma

### Community 25 - "Community 25"
Cohesion: 0.5
Nodes (3): getSettings(), updateSettings(), UpdateSettingsDto

## Knowledge Gaps
- **252 isolated node(s):** `prisma`, `prisma`, `prisma`, `prisma`, `prisma` (+247 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `withTenant()` connect `Community 15` to `Community 0`, `Community 2`, `Community 3`, `Community 12`, `Community 14`, `Community 17`, `Community 18`, `Community 19`, `Community 21`, `Community 22`, `Community 23`, `Community 25`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._
- **Why does `AppError` connect `Community 2` to `Community 0`, `Community 1`, `Community 5`, `Community 7`, `Community 8`, `Community 9`, `Community 10`, `Community 11`, `Community 14`, `Community 15`, `Community 17`, `Community 18`, `Community 19`, `Community 21`, `Community 23`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **Why does `env` connect `Community 1` to `Community 0`, `Community 12`, `Community 5`, `Community 7`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **What connects `prisma`, `prisma`, `prisma` to the rest of the system?**
  _252 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._