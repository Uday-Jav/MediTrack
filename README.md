# MediVault Backend

Production-ready Express backend for:

- AI medical assistant chat (`/api/chat`)
- Page/chat translation (`/api/translate`)
- Existing auth + record routes (`/api/auth`, `/api/records`)

## Stack

- Node.js + Express
- PostgreSQL (`patient_records`, `chat_history`)
- OpenAI API (medical assistant responses)
- Open translation library (`@vitalets/google-translate-api`)
- Security middleware: Helmet, CORS allowlist, rate limiting, input validation

## Project Structure

```text
backend/
  controllers/
    chatController.js
    translationController.js
    authController.js
    recordController.js
  db/
    postgres.js
    schema.sql
  middleware/
    errorHandler.js
    rateLimiters.js
    validation.js
    authMiddleware.js
  routes/
    chat.js
    translation.js
    authRoutes.js
    recordRoutes.js
  services/
    translationService.js
  validators/
    chatSchemas.js
    translationSchemas.js
  server.js
  .env.example
```

## Environment

Copy `.env.example` to `.env` and set:

- `OPENAI_API_KEY`
- PostgreSQL credentials (`DATABASE_URL` or `POSTGRES_*`)
- `CORS_ORIGIN`

Optional local fallback flags:

- `POSTGRES_FALLBACK_MEMORY=true` to run with in-memory PostgreSQL emulation if real PostgreSQL is unavailable
- `MOCK_OPENAI_RESPONSE=true` to return deterministic mock medical guidance when `OPENAI_API_KEY` is not set

Mongo env vars are optional unless you also use legacy `/api/auth` and `/api/records` endpoints.

## Database Setup

Run schema:

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

If you do not use `DATABASE_URL`:

```bash
psql -h localhost -U postgres -d medivault -f db/schema.sql

# Optional sample patient row
psql "$DATABASE_URL" -f db/seed.sql
```

## Run

```bash
npm install
npm run dev
```

## Core API

### `POST /api/chat`

Request body:

```json
{
  "userId": "patient_123",
  "message": "I have sore throat and mild fever",
  "language": "en",
  "conversationId": "optional-existing-id",
  "stream": false
}
```

Behavior:

1. Fetch patient medical record from PostgreSQL
2. Build medical-safe OpenAI prompt with history + symptom message
3. Generate guidance with disclaimer
4. Save chat history in `chat_history`

If `stream: true`, the endpoint responds as `text/event-stream` and emits chunked updates.

### `GET /api/chat/history/:userId`

Query params:

- `conversationId` (optional)
- `limit` (optional, default 20, max 50)

### `POST /api/translate`

```json
{
  "text": "Hello world",
  "targetLanguage": "hi",
  "sourceLanguage": "auto"
}
```

### `POST /api/translate/batch`

```json
{
  "texts": ["Hello", "How are you?"],
  "targetLanguage": "ta",
  "sourceLanguage": "auto"
}
```

## Supported Languages

- `en` English
- `hi` Hindi
- `pa` Punjabi
- `ta` Tamil
- `bn` Bengali
- `mr` Marathi
