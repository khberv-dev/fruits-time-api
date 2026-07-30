# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run start:dev` — run with watcher (NestJS).
- `npm run build` — `nest build` to `dist/`.
- `npm run start:prod` — runs `node dist/main`.
- `npm run lint` — ESLint with `--fix`.
- `npm run format` — Prettier over `src/` and `test/`.
- `npm run db:clean` — `typeorm schema:drop` against `src/shared/config/database.config.ts`.
- `npm run db:seed` — builds then runs `dist/seed.js` to insert the initial admin user from `INIT_ADMIN_LOGIN` / `INIT_ADMIN_PASSWORD`. Not idempotent: it does an unconditional `save`, so a second run fails on the `phone_number` unique constraint.

**There is no test suite.** `package.json` carries the stock NestJS Jest wiring (`test`, `test:cov`, `test:e2e`), but no `*.spec.ts` file and no `test/` directory exist — `npm test` exits with "no tests found" and `npm run test:e2e` fails because `test/jest-e2e.json` is missing. If you add the first test, `rootDir` is `src` and `testRegex` is `.*\.spec\.ts$`; run a single file with `npm test -- path/to/file.spec.ts`. `npm run format` also globs a non-existent `test/**/*.ts`.

Path alias: `@/*` → `src/*` (see `tsconfig.json`). Use this in imports rather than relative paths.

## Environment

`.env` is loaded by `dotenv/config` (imported in `src/shared/config/database.config.ts` and `src/seed.ts`). See `.env.example` for the full set; notable groups:

- `DB_*` — Postgres connection (TypeORM).
- `JWT_ACCESS_SECRET` / `JWT_ACCESS_EXPIRE` / `JWT_REFRESH_SECRET` / `JWT_REFRESH_EXPIRE`.
- `GENAI_KEY` / `GENAI_MODEL` — Google GenAI (`@google/genai`), used by both the `assistant` and `advisor` modules.
- `ESKIZ_SMS_*` — Eskiz SMS gateway used to deliver OTPs.
- `TELEGRAM_BOT_SECRET` — static shared secret the Telegram bot sends as the `x-telegram-bot-secret` header on `/auth/telegram/*` endpoints; checked by `TelegramBotGuard`.
- `POSTER_API_URL` / `POSTER_API_KEY` — Poster POS integration (branch sync, order creation, client creation).
- `DELIVERY_API_URL` / `DELIVERY_API_KEY` — Noor delivery service integration.
- `FIREBASE_SERVICE_ACCOUNT` — JSON string of a Firebase service-account credential; powers FCM push notifications via `firebase-admin`. If absent, `PushService` logs a warning and silently skips all sends.
- `PORT` — HTTP port (default `8000`).

## Architecture

NestJS 11 + TypeORM (Postgres) + Passport JWT. `src/main.ts` boots the app with global prefix `/api`, CORS enabled, and a global `validationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform: true`) defined in `src/common/pipes/validation.pipe.ts`. Swagger UI is served at `/docs` (no auth required).

### Module layout

- `src/core/*` — feature modules: `auth`, `user`, `catalog`, `product`, `banner`, `order`, `address`, `branch`, `stats`, `assistant`, `advisor`, `promotion`, `subscription`, `notify`, `poster`, `delivery`, `session`. Each is a self-contained NestJS module with controller/service/dto.
- `src/shared/` — cross-cutting code: TypeORM `entities/`, `enums/`, `dto/` (query/pagination/search), `types/`, `utils/lib.ts` (bcrypt + OTP helpers), and `config/database.config.ts` (the single TypeORM `DataSource`).
- `src/common/` — framework wiring: `guards/` (JWT access/refresh, role), `decorators/` (`@IsPublic`, `@Role`, `@RequestUser`), `pipes/`, and `interceptors/upload-file.interceptor.ts` (multer disk storage at `uploads/<entity>/<uuid><ext>`).

### Auth model

Two global guards are registered as `APP_GUARD` providers in `AppModule` (order matters — JWT runs before role):

1. `JwtAccessGuard` — extends `AuthGuard('jwt-access')`. Routes are protected **by default**. `@IsPublic()` flips behavior to "try to authenticate but always allow"; the request still gets `req.user` if a valid token was present (this is how `AssistantController.ask` distinguishes anonymous vs. logged-in callers).
2. `RoleGuard` — checks `@Role(UserRole.ADMIN)` metadata. No decorator means any authenticated user passes. It reads `req.user.role` unguarded, so never combine `@Role(...)` with `@IsPublic()` on the same route — an anonymous request would throw a `TypeError` (500) instead of a 403.

Tokens are issued in `AuthService.issueTokens` with `sub` and `role` in the payload. Refresh uses a separate secret via `JwtRefreshStrategy` and `JwtRefreshGuard` on the `POST /auth/refresh` endpoint.

**OTP sessions are enforced on three axes** in `AuthService.verifyOtp`: the row must exist, must not be past `expiresAt` (`OTP_TTL_MINUTES`, 15), and must be under `MAX_OTP_ATTEMPTS` (3) failed tries — then the code itself has to match. A wrong code increments `attempts` and throws. This enforcement was disabled for a long stretch (the guard sat commented out with an inverted expiry comparison, and `attempts` was *decremented* from its `0` default so no limit could ever fire), so treat any older assumption that expiry/attempt limits are inert as stale.

`POST /auth/reset-password/:otpId` closes the loop: it requires the OTP row to have `verifiedAt` set and reads the phone number off that row, so the client never resends it.

In controllers, pull the caller via `@RequestUser() user: ReqUser` (`{ id, role }`). When a route is `@IsPublic()`, `user` may be `undefined` — handle that.

**Telegram bot registration bypasses OTP entirely.** `POST /auth/telegram/sign-up` and `GET /auth/telegram/check-phone/:phoneNumber` sit under the (also `@IsPublic()`) `AuthController` but additionally require `TelegramBotGuard` (`src/common/guards/telegram-bot.guard.ts`), which checks the `x-telegram-bot-secret` header against `TELEGRAM_BOT_SECRET`. The premise is that Telegram's own contact-share flow already gives a verified phone number, so no SMS OTP round-trip is needed. `AuthService.telegramSignUp`: if the phone number already has an account, it links that account's `telegramId` (if unset) and returns tokens for it rather than erroring; a `telegramId` or phone already linked to a *different* account throws `ConflictException`. New accounts are created with `password: null` — `User.password` is nullable specifically for this (telegram-only accounts never sign in via `POST /auth/sign-in`, `AuthService.validateUser` returns `null` for any user with no password). `User.telegramId` (nullable, unique) is otherwise unused by the rest of the app.

### Database

`src/shared/config/database.config.ts` is the single source of truth for the `DataSource`. It uses `entities: ['dist/**/*.entity.js']` and `synchronize: true`, so schema is auto-applied from compiled entity files — meaning `npm run build` is required before `db:clean` / `db:seed` can see new entities. Don't add migrations without removing `synchronize: true` first. All timestamp columns (`@CreateDateColumn`/`@UpdateDateColumn`/similar) are typed `timestamptz`, not the TypeORM default — match this on any new entity.

### Localization pattern

Three locales (`uz`, `ru`, `en` — `src/shared/enums/locale.enum.ts`). Translatable fields on entities are stored as `jsonb` typed `Localized<T>` (`src/shared/types/localized.type.ts`). Entities expose `getTitle(locale)` / `getDescription(locale)` / `getCompound(locale)` accessors that fall back via `getObjectDefaultValue` (first key in the JSON object) when the requested locale is missing — see `Product`, `Catalog`, and `Banner`. Controllers receive locale via `BasicQuery` (`?locale=uz`).

### File uploads

`uploadFileInterceptor('<entity>')` handles a single `file` field and writes to `uploads/<entity>/`; `uploadFileFieldsInterceptor('<entity>', [...])` handles several named single-file fields (banners use it for `file` + `thumbnail`). Files are served back at `/public/*` via `ServeStaticModule` (configured in `AppModule` with `fallthrough: false`).

### Poster POS integration

`PosterService` wraps the Poster POS REST API (token passed as a query param). `BranchService` runs a `@Cron(EVERY_10_MINUTES)` that calls `getSpots()` and upserts branches by `posId`. Before orders can be placed, both the `User` and each `Product` must have a `posId` set (linking them to Poster clients/products); `sendToPoster` throws a 500 if either is missing. `PosterService.createClient` is called from `AuthService.signUp`/`telegramSignUp` at registration time, and `UserService.syncMissingPosIds` retries on every boot for users where it failed.

Every `PosterService`/`DeliveryService` method swallows its own errors — logging and returning `[]`/`null`/`false`/an empty `Map` — so a POS outage degrades silently rather than throwing. Both clients also raise the max-listener cap on their keep-alive agents *and* on freed sockets; don't drop that, it's there to stop `MaxListenersExceededWarning` under socket reuse.

### Order creation flow

`OrderService.create` first rejects the request if the caller already has a `CREATED` or `ACCEPTED` order ("one active order at a time"), then delegates to the private `prepareOrder`, which is **shared with `evaluate`** and does all validation and pricing *outside* the transaction:

1. Loads the requested products (must all exist and be `isActive`) and the branch (must exist, be `isActive`, have `isWorking: true`, and pass `Branch.isOpenAt()` — see below). If the branch has a `storageId`, every product must show `left: true` for that storage in its `available[]` — otherwise a `BadRequestException` naming the unavailable products.
2. Resolves which mutually-exclusive promotion wins (`resolveExclusivePromotion`, using pre-auto-add quantities), then runs `applyAutoAddedItems` so 2+1's free units land in the cart server-side.
3. Resolves pricing: referral-tier discount (`computeUserStatus`/`getStatusDiscount`) combined per-item with whatever `PromotionService.computeItemDiscounts` and `SubscriptionService.computeFreeUnits` return, taking the max percent and summing free units per line (see `aggregatePromoByIndex` and `resolveFreeUnits`). Vitamin-type products are excluded from all promotions, but not from subscriptions. Exposed as the `getItemLinePrice`/`getItemUnitPrice` closures the caller uses for both the DB rows and the POS payload.
4. For `type === DELIVERY`: requires a saved `addressId`, builds the `DeliveryCreateOrderInput`, quotes it via `DeliveryService.evalOrder`, and subtracts any `PromotionService.getDeliveryDiscount` (clamped at 0).

`create` then opens a single TypeORM transaction that saves the `Order` + `OrderItem` rows, calls `PosterService.createOrder` and stores the returned `posId`, stores `deliveryCost`, and — for delivery orders — parks the delivery payload in `Order.deliveryPayload` (jsonb) instead of dispatching it. Dispatch is deferred to `processPosAcceptance` (see the cron table), which nulls `deliveryPayload` once the delivery service accepts it; `cancelOrder` nulls it too.

`OrderItem` stores **two** line totals, and the names are the opposite of what they suggest: `price` is the discounted amount actually charged, `actualPrice` is the undiscounted `product.price * quantity`. Both are line totals, not unit prices — don't multiply either by `quantity` again.

Any external API failure throws an `InternalServerErrorException` and rolls back the transaction. Both external service methods return `null`/`false` on failure; callers check and throw rather than propagating the raw error.

`POST /order/evaluate` mirrors `create`'s pricing logic (including `productsCount`/`productTypesCount` and a named discount breakdown) without persisting anything or contacting the POS — used by clients to preview price before checkout.

`POST /order/evaluate` is marked `@IsPublic()` but throws `BadRequestException` when there's no `req.user` — the decorator is only there so an expired token yields a clean 400 instead of a 401.

`GET /order/delivery-cost?branchId=&addressId=` is a pre-check endpoint that calls `DeliveryService.evalOrder` without creating an order, so the client can show the delivery fee before checkout. It repeats `prepareOrder`'s branch gates (`isActive`, `isWorking`, `isOpenAt()`) so it can't quote a fee for a branch that would then reject the order. Note that the real delivery price always comes from the Noor API — `haversineDistanceKm`/`calculateDeliveryCost` in `shared/utils/lib.ts` are leftovers with no callers.

### Branch working hours

`Branch.openTime`/`closeTime` are nullable bare `HH:mm` strings (validated by regex in `UpdateBranchRequest`, admin-set via `PATCH /branch/:id`) with no timezone attached. `Branch.isOpenAt(at = new Date())` interprets them against **`Asia/Tashkent`** wall-clock time (`BUSINESS_TIMEZONE` in `branch.entity.ts`, via the dayjs `utc`+`timezone` plugins), deliberately not the server's TZ. Semantics:

- Either bound null → always open, so branches without a configured schedule keep working.
- `open < close` → normal window, inclusive of `openTime` and exclusive of `closeTime`.
- `close <= open` → the window crosses midnight (`22:00`–`02:00`); identical bounds therefore mean open around the clock.

This is a per-request check only. Nothing writes back to `isWorking`, which stays a purely manual admin toggle — the two gates are independent and both must pass.

`GET /order/active` returns the caller's single `CREATED`/`ACCEPTED` order or `null`; `GET /order` lists their history; `GET /order/admin` is the paginated admin list (adds a trimmed `user` object per order).

`PATCH /order/:orderId/cancel` (admin-only) cancels an order that isn't already `CANCELLED`/`DONE`.

`POST /order/handle-order` (public, no auth) is a webhook endpoint that receives noor.uz delivery stage callbacks. `OrderService.handleDeliveryWebhook` fires-and-forgets `processDeliveryWebhook`, which maps stages 14/15 → `DONE` (all other stages leave `status` alone), persists `body.order.link` onto `Order.link` when present, and pushes an FCM notification using the hardcoded Uzbek `DELIVERY_STAGE_MESSAGE` map (stages 1–29 at the top of `order.service.ts`) — stages missing from that map send nothing. These messages are Uzbek-only and ignore `Session.locale`.

### Promotion module

`PromotionService` seeds one `Promotion` row per `PromotionType` on bootstrap (`OnApplicationBootstrap`) and admins toggle `isActive`/`productIds` via `PATCH /promotion/:id`. Each type has hardcoded eligibility/discount logic in `handlers`, keyed by type — the DB row only tracks on/off and (for product-scoped types) which products qualify:

- `FIRST_ORDER_FIRST_ITEM` — 30% off the full price of every eligible line item (i.e. all except vitamins and whatever's covered by 2+1) on a customer's very first order.
- `LOYALTY_EVERY_10TH_ITEM` — every 10th lifetime item (cumulative across orders, cancelled orders excluded) is free.
- `BUY_TWO_GET_ONE_FREE` ("2+1") — every 3rd unit of an admin-chosen product list is free, cumulative across the whole order. `PromotionService.applyAutoAddedItems` auto-adds the free units to the cart server-side before pricing, rather than requiring the client to add them.
- `FREE_DELIVERY_3KM` — flat amount knocked off the delivery quote, withheld until the customer has at least one prior `DONE` order.

**Cross-promotion rules:** `BUY_TWO_GET_ONE_FREE` ("2+1") always applies — it is not gated by exclusivity and runs whenever it's active and has eligible products, stacking with everything else. `FIRST_ORDER_FIRST_ITEM` (30%) and `FREE_DELIVERY_3KM` are mutually exclusive with each other, in that priority order: 30% applies if eligible, and free-delivery only applies when 30% did not. `PromotionService.resolveExclusivePromotion` decides that winner up front (checking each type's real eligibility, in priority order, without side effects) and `OrderService.prepareOrder` threads the result into `computeItemDiscounts`/`getDeliveryDiscount`, each of which no-ops for the type that didn't win. Additionally, the 30% discount never lands on a product that's eligible for 2+1 — `PromotionService` excludes 2+1's `productIds` from the 30% discount's own eligibility (both in `resolveExclusivePromotion` and `computeItemDiscounts`), so 2+1 always takes precedence on the products it covers, and 30% only discounts products outside that list. `LOYALTY_EVERY_10TH_ITEM` is **not** part of any of this — it's independent and always stacks on top of whichever (if any) of the above apply.

Vitamin-type products (`excludedProductIds`) never receive any promotion discount, enforced both at the caller (order/evaluate) and defensively inside each handler.

`PromotionService.getProductPromotions` is the read-side counterpart: every product-list response (`findAll`, `findAllPaginated`, `search`) attaches a `promotions: [{ type, name }]` array built from the active *product-scoped* promotions, so the client can badge 2+1 items. Display names are hardcoded Uzbek strings in `PROMOTION_NAMES` — they are not localized through the `Localized<T>` mechanism, and the same is true of the discount names in `evaluate`'s breakdown.

### Subscription module

A subscription grants its holder **one free unit of each listed product per business-local day** (`DAILY_FREE_UNITS_PER_PRODUCT` in `subscription.service.ts`). Three entities:

- `Subscription` — localized `title`, `productIds` jsonb (same id-array pattern as `Promotion`, not a join table), `isActive`.
- `SubscriptionCode` — a 36-character code (a `randomUUID()`, so no uniqueness retry loop is needed, unlike `generateReferralCode`). **A redeemed code *is* the user↔subscription link** — there's no separate assignment table. Admins generate codes and hand them out; `POST /subscription/redeem` binds one to the caller. Single-use, but re-redeeming one's own code is idempotent rather than an error.
- `SubscriptionRedemption` — one row per free unit granted, written inside `OrderService.create`'s transaction. `OrderItem` can't back the quota because it doesn't record *why* a unit was free. Cancelling an order doesn't delete these rows; the quota query skips cancelled orders instead, which hands the allowance back — same trick as `getLifetimeItemCount`.

A user may hold several subscriptions; their product lists are unioned and deduped, so overlapping lists still yield one free unit per product per day. Deactivating a subscription withdraws the entitlement from every holder at once without touching their codes, so reactivating restores it.

**Interaction with promotions:** subscription free units are *not* part of `resolveExclusivePromotion` — they stack, like loyalty. They're also **not** vitamin-gated, unlike every promotion, since an admin chose the product list explicitly. `OrderService.resolveFreeUnits` consumes subscription units first and caps promotion free units at `quantity - subscription`, so the two sources can never zero out more than a line's quantity between them; `buildDiscountBreakdown` uses that same function, which is what keeps the named breakdown summing to `discountTotal`.

`GET /subscription/me` returns the caller's subscriptions plus each covered product's `remainingToday`. Admin routes: `GET /subscription`, `POST /subscription`, `PATCH /subscription/:id` (edit/activate/deactivate), `POST /subscription/:id/codes` (generate N), `GET /subscription/:id/codes` (with redeemer).

### Business timezone

`BUSINESS_TIMEZONE` (`Asia/Tashkent`) and the `businessTime`/`businessDayRange` helpers in `shared/utils/lib.ts` are the single source of truth for wall-clock reasoning — branch working hours and the subscription daily reset both go through them rather than inheriting the deploy host's TZ. Anything new that means "today" or "what time is it" should use them too.

### User referral / status tiers

`STATUS_TIERS` in `user.service.ts` maps referral count → `UserStatus` (SILVER / GOLD / VIP / PREMIUM) and discount percentage (0 / 3 / 7 / 12 %). `computeUserStatus` and `getStatusDiscount` are exported and consumed by `OrderService` to price order items; the promotion discount is combined with this per-item (max percent wins), not stacked additively.

### Session module

`Session` (one per user, `OneToOne`) stores `fcmToken`, `os` (`Os` enum), and `locale` for push-notification targeting. `POST /session` upserts on `user_id` conflict; `PATCH /session` updates an existing record and throws `NotFoundException` if none exists.

### Scheduled cron jobs

Four `@Cron` tasks run continuously:

| Job | Interval | What it does |
|-----|----------|--------------|
| `BranchService.sync` | every 10 min | Upserts branches from Poster `spots.getSpots` by `posId` (also exposed as admin `POST /branch/sync`) |
| `ProductService.syncIngredients` | every 5 min | Fetches ingredient IDs per product from `menu.getProduct` |
| `ProductService.syncAvailability` | every 10 min | Computes per-branch `available[]` from storage leftovers |
| `OrderService.processPosAcceptance` | every minute | For every `CREATED` order, branches on type. `DELIVERY`: if it now shows up as a Poster transaction, marks it `ACCEPTED`, pushes an FCM notification, and dispatches the deferred `DeliveryService.createOrder` call; if still unaccepted after 10 minutes, cancels it instead. `PICKUP`: if it shows up as a Poster transaction within 15 minutes of creation, marks it `DONE` directly (no `ACCEPTED` intermediate) and pushes an FCM notification; if still not found after 15 minutes, cancels it. |

`syncAvailability` depends on `ingredients` being populated by `syncIngredients`: it prefers "every ingredient has stock left", and only falls back to the product's own `posId` leftover when `ingredients` is null/empty. Availability is stored as `jsonb ProductAvailability[]` on `Product` (`{ storage_id, left }`), one entry per active branch that has a `storageId`.

Two more non-cron background jobs run on bootstrap: `UserService.syncMissingPosIds` (`OnApplicationBootstrap`) backfills `posId` for every user still missing one, and `PromotionService.onApplicationBootstrap` seeds the promotion rows.

### Assistant vs. Advisor (two separate Gemini-backed chatbots)

Both use `@google/genai` and the same request/response/history pattern (`{ hasAnswer, text }` JSON schema, conversation persisted as `{user, model}` message pairs, `history` endpoint replays and re-parses stored JSON) but serve different audiences:

- **`assistant`** (`src/core/assistant`) — public-facing nutritionist chatbot for customers. `AssistantService.ask` loads active products (60s in-memory cache) and the calling user, builds a system prompt via `InstructionsService.buildNutritionistInstructions`, and additionally supports `suggestions` (full product payloads to show) and `cart` (product ids to auto-add) in the response schema. `POST /assistant/ask` is `@IsPublic()` and returns a localized "log in" message when `req.user` is missing rather than calling the model.

  Two invariants in `ask`/`history`: `cart` is filtered down to products with stock somewhere (`available.some(a => a.left)`), and `suggestions` is always a **superset of `cart`** — cart entries are bare ids that the client resolves against `suggestions`, so anything in the cart must also ship its product payload. `loadHistory(userId, since?)` serves two callers with different needs: `ask` passes `since` (`CONTEXT_WINDOW_MINUTES`, 60) so only the recent window is replayed as model context, while `GET /assistant/history` omits it and returns the whole conversation for the client to render. `AdvisorService` still replays its full history unbounded.
- **`advisor`** (`src/core/advisor`) — admin-only business-analytics chatbot. `AdvisorController` is gated with `@Role(UserRole.ADMIN)`. `AdvisorInstructionsService.buildSnapshot` queries live aggregates (orders by status/type, revenue, top 10 products, branches, active products, last 30 orders) and serializes them into the system prompt on every call, so answers are grounded in current data rather than the model's training knowledge. No product suggestions/cart in the response — just `{ hasAnswer, text }`.
