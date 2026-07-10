# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run start:dev` — run with watcher (NestJS).
- `npm run build` — `nest build` to `dist/`.
- `npm run start:prod` — runs `node dist/main`.
- `npm run lint` — ESLint with `--fix`.
- `npm run format` — Prettier over `src/` and `test/`.
- `npm test` — Jest (config in `package.json`, `rootDir: src`, `testRegex: .*\\.spec\\.ts$`).
- `npm test -- path/to/file.spec.ts` — run a single spec.
- `npm run test:e2e` — uses `test/jest-e2e.json`.
- `npm run db:clean` — `typeorm schema:drop` against `src/shared/config/database.config.ts`.
- `npm run db:seed` — builds then runs `dist/seed.js` to insert the initial admin user from `INIT_ADMIN_LOGIN` / `INIT_ADMIN_PASSWORD`.

Path alias: `@/*` → `src/*` (see `tsconfig.json`). Use this in imports rather than relative paths.

## Environment

`.env` is loaded by `dotenv/config` (imported in `src/shared/config/database.config.ts` and `src/seed.ts`). See `.env.example` for the full set; notable groups:

- `DB_*` — Postgres connection (TypeORM).
- `JWT_ACCESS_SECRET` / `JWT_ACCESS_EXPIRE` / `JWT_REFRESH_SECRET` / `JWT_REFRESH_EXPIRE`.
- `GENAI_KEY` / `GENAI_MODEL` — Google GenAI (`@google/genai`), used by both the `assistant` and `advisor` modules.
- `ESKIZ_SMS_*` — Eskiz SMS gateway used to deliver OTPs.
- `POSTER_API_URL` / `POSTER_API_KEY` — Poster POS integration (branch sync, order creation, client creation).
- `DELIVERY_API_URL` / `DELIVERY_API_KEY` — Noor delivery service integration.
- `FIREBASE_SERVICE_ACCOUNT` — JSON string of a Firebase service-account credential; powers FCM push notifications via `firebase-admin`. If absent, `PushService` logs a warning and silently skips all sends.
- `PORT` — HTTP port (default `8000`).

## Architecture

NestJS 11 + TypeORM (Postgres) + Passport JWT. `src/main.ts` boots the app with global prefix `/api`, CORS enabled, and a global `validationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform: true`) defined in `src/common/pipes/validation.pipe.ts`. Swagger UI is served at `/docs` (no auth required).

### Module layout

- `src/core/*` — feature modules: `auth`, `user`, `catalog`, `product`, `banner`, `order`, `address`, `branch`, `stats`, `assistant`, `advisor`, `promotion`, `notify`, `poster`, `delivery`, `session`. Each is a self-contained NestJS module with controller/service/dto.
- `src/shared/` — cross-cutting code: TypeORM `entities/`, `enums/`, `dto/` (query/pagination/search), `types/`, `utils/lib.ts` (bcrypt + OTP helpers), and `config/database.config.ts` (the single TypeORM `DataSource`).
- `src/common/` — framework wiring: `guards/` (JWT access/refresh, role), `decorators/` (`@IsPublic`, `@Role`, `@RequestUser`), `pipes/`, and `interceptors/upload-file.interceptor.ts` (multer disk storage at `uploads/<entity>/<uuid><ext>`).

### Auth model

Two global guards are registered as `APP_GUARD` providers in `AppModule` (order matters — JWT runs before role):

1. `JwtAccessGuard` — extends `AuthGuard('jwt-access')`. Routes are protected **by default**. `@IsPublic()` flips behavior to "try to authenticate but always allow"; the request still gets `req.user` if a valid token was present (this is how `AssistantController.ask` distinguishes anonymous vs. logged-in callers).
2. `RoleGuard` — checks `@Role(UserRole.ADMIN)` metadata. No decorator means any authenticated user passes.

Tokens are issued in `AuthService.issueTokens` with `sub` and `role` in the payload. Refresh uses a separate secret via `JwtRefreshStrategy` and `JwtRefreshGuard` on the `POST /auth/refresh` endpoint.

**OTP verification is currently a no-op check.** `AuthService.verifyOtp` only checks that the `Otp` row exists (`if (!otp) throw ...`); the real guard — expiry and attempt-count (`dayjs(otp.expiresAt).isAfter(now) || otp.attempts > 3`) — is commented out in the source. Any code (`code === data.code`) still has to match, but an expired or already-exhausted OTP row will still verify. Don't assume expiry/attempts are enforced when touching this flow; re-enabling that check is a one-line uncomment if it's ever needed.

In controllers, pull the caller via `@RequestUser() user: ReqUser` (`{ id, role }`). When a route is `@IsPublic()`, `user` may be `undefined` — handle that.

### Database

`src/shared/config/database.config.ts` is the single source of truth for the `DataSource`. It uses `entities: ['dist/**/*.entity.js']` and `synchronize: true`, so schema is auto-applied from compiled entity files — meaning `npm run build` is required before `db:clean` / `db:seed` can see new entities. Don't add migrations without removing `synchronize: true` first. All timestamp columns (`@CreateDateColumn`/`@UpdateDateColumn`/similar) are typed `timestamptz`, not the TypeORM default — match this on any new entity.

### Localization pattern

Three locales (`uz`, `ru`, `en` — `src/shared/enums/locale.enum.ts`). Translatable fields on entities are stored as `jsonb` typed `Localized<T>` (`src/shared/types/localized.type.ts`). Entities expose `getTitle(locale)` / `getDescription(locale)` / `getCompound(locale)` accessors that fall back via `getObjectDefaultValue` (first key in the JSON object) when the requested locale is missing — see `Product`, `Catalog`, and `Banner`. Controllers receive locale via `BasicQuery` (`?locale=uz`).

### File uploads

`uploadFileInterceptor('<entity>')` writes to `uploads/<entity>/`. Files are served back at `/public/*` via `ServeStaticModule` (configured in `AppModule` with `fallthrough: false`).

### Poster POS integration

`PosterService` wraps the Poster POS REST API (token passed as a query param). `BranchService` runs a `@Cron(EVERY_10_MINUTES)` that calls `getSpots()` and upserts branches by `posId`. Before orders can be placed, both the `User` and each `Product` must have a `posId` set (linking them to Poster clients/products). `PosterService.createClient` is called from `UserService` at registration time to register the user in Poster.

### Order creation flow

`OrderService.create` runs inside a single TypeORM transaction:
1. Resolves pricing: referral-tier discount (`computeUserStatus`/`getStatusDiscount`) combined per-item with whatever `PromotionService.computeItemDiscounts` returns (see below for which promotions can actually fire together), taking the max percent and summing free units per line (see `aggregatePromoByIndex`). Vitamin-type products are excluded from all promotions.
2. Saves the `Order` + `OrderItem` rows with the resolved prices applied.
3. Calls `DeliveryService.evalOrder` to get the delivery cost (if `type === DELIVERY`), minus any `PromotionService.getDeliveryDiscount`; stores it on the order.
4. Calls `PosterService.createOrder` to push the order to the POS; stores the returned `posId` on the order.
5. If `type === DELIVERY`, the actual dispatch to the delivery service is deferred — see the cron below, not done inline here.

Any external API failure throws an `InternalServerErrorException` and rolls back the transaction. Both external service methods return `null`/`false` on failure; callers check and throw rather than propagating the raw error.

`POST /order/evaluate` mirrors `create`'s pricing logic (including `productsCount`/`productTypesCount` and a named discount breakdown) without persisting anything or contacting the POS — used by clients to preview price before checkout.

`GET /order/delivery-cost?branchId=&addressId=` is a pre-check endpoint that calls `DeliveryService.evalOrder` without creating an order, so the client can show the delivery fee before checkout.

`PATCH /order/:orderId/cancel` (admin-only) cancels an order that isn't already `CANCELLED`/`DONE`.

`POST /order/handle-order` (public, no auth) is a webhook endpoint that receives noor.uz delivery stage callbacks. `OrderService.handleDeliveryWebhook` fires-and-forgets `processDeliveryWebhook`, which maps stages 14/15 → `DONE`, sends an FCM push notification, and ignores unrecognized stages.

### Promotion module

`PromotionService` seeds one `Promotion` row per `PromotionType` on bootstrap (`OnApplicationBootstrap`) and admins toggle `isActive`/`productIds` via `PATCH /promotion/:id`. Each type has hardcoded eligibility/discount logic in `handlers`, keyed by type — the DB row only tracks on/off and (for product-scoped types) which products qualify:

- `FIRST_ORDER_FIRST_ITEM` — 30% off the first eligible line item on a customer's very first order.
- `LOYALTY_EVERY_10TH_ITEM` — every 10th lifetime item (cumulative across orders, cancelled orders excluded) is free.
- `BUY_TWO_GET_ONE_FREE` ("2+1") — every 3rd unit of an admin-chosen product list is free, cumulative across the whole order. `PromotionService.applyAutoAddedItems` auto-adds the free units to the cart server-side before pricing, rather than requiring the client to add them.
- `FREE_DELIVERY_3KM` — flat amount knocked off the delivery quote, withheld until the customer has at least one prior `DONE` order.

**Cross-promotion exclusivity:** `BUY_TWO_GET_ONE_FREE`, `FIRST_ORDER_FIRST_ITEM`, and `FREE_DELIVERY_3KM` are mutually exclusive per order — only one of them ever applies, in that priority order (2+1 beats first-order-30%, which beats free-delivery). `PromotionService.resolveExclusivePromotion` decides the winner up front (checking each type's real eligibility, in priority order, without side effects) and `OrderService.prepareOrder` threads that result into `applyAutoAddedItems`/`computeItemDiscounts`/`getDeliveryDiscount`, each of which no-ops for the exclusive types it didn't win. `LOYALTY_EVERY_10TH_ITEM` is **not** part of this — it's independent and always stacks on top of whichever (if any) of the three wins.

Vitamin-type products (`excludedProductIds`) never receive any promotion discount, enforced both at the caller (order/evaluate) and defensively inside each handler.

### User referral / status tiers

`STATUS_TIERS` in `user.service.ts` maps referral count → `UserStatus` (SILVER / GOLD / VIP / PREMIUM) and discount percentage (0 / 3 / 7 / 12 %). `computeUserStatus` and `getStatusDiscount` are exported and consumed by `OrderService` to price order items; the promotion discount is combined with this per-item (max percent wins), not stacked additively.

### Session module

`Session` (one per user, `OneToOne`) stores `fcmToken`, `os` (`Os` enum), and `locale` for push-notification targeting. `POST /session` upserts on `user_id` conflict; `PATCH /session` updates an existing record and throws `NotFoundException` if none exists.

### Scheduled cron jobs

Four `@Cron` tasks run continuously:

| Job | Interval | What it does |
|-----|----------|--------------|
| `BranchService.syncSpots` | every 10 min | Upserts branches from Poster `spots.getSpots` by `posId` |
| `ProductService.syncIngredients` | every 5 min | Fetches ingredient IDs per product from `menu.getProduct` |
| `ProductService.syncAvailability` | every 10 min | Computes per-branch `available[]` from storage leftovers |
| `OrderService.processPosAcceptance` | every minute | For every `CREATED` order: if it now shows up as a Poster transaction, marks it `ACCEPTED`, pushes an FCM notification, and (for delivery orders) dispatches the deferred `DeliveryService.createOrder` call. If a `DELIVERY` order is still unaccepted after 10 minutes, cancels it instead. Pickup orders are never auto-cancelled by this job. |

`syncAvailability` depends on `ingredients` being populated by `syncIngredients`. Availability is stored as `jsonb ProductAvailability[]` on `Product` (`{ storage_id, left }`).

### Assistant vs. Advisor (two separate Gemini-backed chatbots)

Both use `@google/genai` and the same request/response/history pattern (`{ hasAnswer, text }` JSON schema, conversation persisted as `{user, model}` message pairs, `history` endpoint replays and re-parses stored JSON) but serve different audiences:

- **`assistant`** (`src/core/assistant`) — public-facing nutritionist chatbot for customers. `AssistantService.ask` loads active products (60s in-memory cache) and the calling user, builds a system prompt via `InstructionsService.buildNutritionistInstructions`, and additionally supports `suggestions` (product ids to show) and `cart` (product ids to auto-add) in the response schema. `POST /assistant/ask` is `@IsPublic()` and returns a localized "log in" message when `req.user` is missing rather than calling the model.
- **`advisor`** (`src/core/advisor`) — admin-only business-analytics chatbot. `AdvisorController` is gated with `@Role(UserRole.ADMIN)`. `AdvisorInstructionsService.buildSnapshot` queries live aggregates (orders by status/type, revenue, top 10 products, branches, active products, last 30 orders) and serializes them into the system prompt on every call, so answers are grounded in current data rather than the model's training knowledge. No product suggestions/cart in the response — just `{ hasAnswer, text }`.
