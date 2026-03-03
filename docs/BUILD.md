# Build and Run (MVP Workspace)

## Prerequisites
- Node.js 20+
- npm 10+
- PostgreSQL + Redis (for full API runtime)

## Install
```bash
npm install
```

## Build all
```bash
npm run build
```

## Build frontend only
```bash
npm run build:web
```

## Build backend only
```bash
npm run build:api
```

## Run frontend dev server
```bash
npm run dev:web
```

## Run backend (after build)
```bash
npm run start:api
```

## Notes
- API uses NestJS WebSocket gateways under `/chat` and `/voice` namespaces.
- Frontend entrypoint is `src/client/main.tsx` and `index.html`.
- If package installation is blocked by network/security policy, builds cannot be executed until registry access is available.

- API is compiled as CommonJS (`tsconfig.api.json`), so `node dist-api/main.js` must run under default Node CJS mode.
