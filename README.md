
# SMILE Backend

## About
This document aims to provide a guide for installing the SMILE backend.

## Stacks

- Node.js 18+
- TypeScript 5+
- Native ESM Modules
- [tsx: Node.js enhanced to run TypeScript & ESM files](https://github.com/privatenumber/tsx)
- [tsc-alias: Import path alias using `@/` prefix](https://github.com/justkey007/tsc-alias)
- Hono.js
- Kysely for query Builder & migrations
- Pino for logging
- RabbitMQ for job queue
- ESLint & Prettier — linting & formatting
- [jsx-email](https://github.com/shellscape/jsx-email) for email templating
- vitest for testing
- znv for type safe env
- Faker for generate fake data
- dayjs for handling date-time

## Quick Start

### 1. Clone repo

clone repo without commit history

```bash
git clone git@github.com/smile-health/backend.git
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Setup .env in each apps folder

```bash
cp .env.example .env
```

### 4. Run build (will run kysely-codegen)

```bash
turbo build
```

### 5. Run the development server

```bash
turbo dev
```

## Available scripts

- `npm run dev` - Starts the application in development mode at.
- `npm run build` - Compile the application.
- `npm start` - Starts the application in production mode.
- `npm run lint` - Check code using ESLint.
- `npm run lint:fix` - Fix autofixable ESLint problem.
- `npm run format:all` - Format code using Prettier for all files.
- `npm run format:check` - Check code format using prettier.

## Kysely/migration scripts

- `npx kysely migrate:down` - Undo the last/specified migration that was run.
- `npx kysely migrate:latest` - Update the database schema to the latest version.
- `npx kysely migrate:list` - List both completed and pending migrations.
- `npx kysely migrate:make` - Create a new migration file.
- `npx kysely migrate:rollback` - Rollback all the completed migrations.
- `npx kysely seed:run` - Run seed files.
- `npx kysely seed:make` - Create a new seed file.
- `npx kysely migrate:up` - Run the next migration that has not yet been run.
- `npx kysely migrate` - Migrate the database schema.
- `npx kysely seed` - Populate your database with test or seed data independent of your migration files
