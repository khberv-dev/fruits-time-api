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
- `GENAI_KEY` / `GENAI_MODEL` — Google GenAI (`@google/genai`) used by the assistant.
- `ESKIZ_SMS_*` — Eskiz SMS gateway used to deliver OTPs.

## Architecture

NestJS 11 + TypeORM (Postgres) + Passport JWT. `src/main.ts` boots the app with global prefix `/api`, CORS enabled, and a global `validationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform: true`) defined in `src/common/pipes/validation.pipe.ts`.

### Module layout

- `src/core/*` — feature modules: `auth`, `user`, `catalog`, `product`, `banner`, `stats`, `assistant`, `notify`. Each is a self-contained NestJS module with controller/service/dto.
- `src/shared/` — cross-cutting code: TypeORM `entities/`, `enums/`, `dto/` (query/pagination/search), `types/`, `utils/lib.ts` (bcrypt + OTP helpers), and `config/database.config.ts` (the single TypeORM `DataSource`).
- `src/common/` — framework wiring: `guards/` (JWT access/refresh, role), `decorators/` (`@IsPublic`, `@Role`, `@RequestUser`), `pipes/`, and `interceptors/upload-file.interceptor.ts` (multer disk storage at `uploads/<entity>/<uuid><ext>`).

### Auth model

Two global guards are registered as `APP_GUARD` providers in `AppModule` (order matters — JWT runs before role):

1. `JwtAccessGuard` — extends `AuthGuard('jwt-access')`. Routes are protected **by default**. `@IsPublic()` flips behavior to "try to authenticate but always allow"; the request still gets `req.user` if a valid token was present (this is how `AssistantController.ask` distinguishes anonymous vs. logged-in callers).
2. `RoleGuard` — checks `@Role(UserRole.ADMIN)` metadata. No decorator means any authenticated user passes.

Tokens are issued in `AuthService.issueTokens` with `sub` and `role` in the payload. Refresh uses a separate secret via `JwtRefreshStrategy` and `JwtRefreshGuard` on the `POST /auth/refresh` endpoint. OTP flow (`/auth/send-otp`, `/auth/verify-otp/:otpId`) goes through `SmsService` → Eskiz.

In controllers, pull the caller via `@RequestUser() user: ReqUser` (`{ id, role }`). When a route is `@IsPublic()`, `user` may be `undefined` — handle that.

### Database

`src/shared/config/database.config.ts` is the single source of truth for the `DataSource`. It uses `entities: ['dist/**/*.entity.js']` and `synchronize: true`, so schema is auto-applied from compiled entity files — meaning `npm run build` is required before `db:clean` / `db:seed` can see new entities. Don't add migrations without removing `synchronize: true` first.

### Localization pattern

Three locales (`uz`, `ru`, `en` — `src/shared/enums/locale.enum.ts`). Translatable fields on entities are stored as `jsonb` typed `Localized<T>` (`src/shared/types/localized.type.ts`). Entities expose `getTitle(locale)` / `getDescription(locale)` / `getCompound(locale)` accessors that fall back via `getObjectDefaultValue` (first key in the JSON object) when the requested locale is missing — see `Product` and `Catalog`. Controllers receive locale via `BasicQuery` (`?locale=uz`).

### File uploads

`uploadFileInterceptor('<entity>')` writes to `uploads/<entity>/`. Files are served back at `/public/*` via `ServeStaticModule` (configured in `AppModule` with `fallthrough: false`).

### Assistant module

`AssistantService.ask` loads all active products and the calling user, hands them to `InstructionsService.buildNutritionistInstructions` as the system prompt, and calls Gemini via `@google/genai`. The model is instructed to return raw JSON `{ hasAnswer, text, suggestions }` where `suggestions` is an array of product IDs; the service then re-fetches each product and localizes its title/description/compound before returning. The endpoint is `@IsPublic()` but returns a localized "log in" message when `req.user` is missing rather than calling the model.
