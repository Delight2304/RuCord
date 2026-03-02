# MVP аналога Discord: архитектура, схема данных и roadmap

## 1) Рекомендуемый стек технологий (с обоснованием)

### Backend
- **TypeScript + NestJS (modular monolith → microservices-ready)**
  - Почему:
    - Чёткая модульность (Auth, Guilds, Channels, Chat, Voice, Media, Permissions).
    - Встроенная поддержка WebSocket gateway, Guards, DI, CQRS-паттернов.
    - Быстрый MVP без потери архитектурной дисциплины.
  - Масштабирование:
    - Горизонтальный scale stateless API/WebSocket узлов за LB.
    - Возможность выделять Voice Signaling и Chat Gateway в отдельные сервисы позже.

### Frontend
- **React + TypeScript + Next.js (App Router) + Zustand + WebSocket/WebRTC APIs**
  - Почему:
    - Быстрая разработка UX уровня Discord (sidebars, thread-like views, presence).
    - SSR/ISR для публичных страниц и auth flows, CSR для real-time областей.
    - Простой state management через Zustand + RTK Query/React Query.

### База данных
- **PostgreSQL 16** (основная OLTP)
  - Почему:
    - Транзакционность для membership/permissions.
    - JSONB для гибких метаданных (настройки каналов/серверов).
    - Проверенная масштабируемость + read replicas.
- **Миграции:** Prisma Migrate / Drizzle / Flyway (выбрать один).

### Кэш и ephemeral state
- **Redis 7**
  - use cases:
    - Session/JWT deny-list (для logout/revoke).
    - Presence (online/offline/last_seen), rate limits, idempotency keys.
    - Pub/Sub или Redis Streams для fan-out событий между WS-нодами.

### Message Broker / Event Bus
- **NATS JetStream** (для MVP) или **Kafka** (если ожидается очень большой throughput сразу)
  - Почему NATS для MVP:
    - Проще эксплуатация, низкая латентность, durable streams.
    - Отлично подходит для событий: `message.created`, `member.joined`, `voice.state.changed`.
  - Путь роста:
    - При росте до десятков/сотен тысяч msg/s можно перейти на Kafka для тяжёлой аналитики.

### Голос и медиа
- **WebRTC + SFU (LiveKit / mediasoup)**
  - Почему:
    - P2P плохо масштабируется >4–6 участников.
    - SFU пересылает потоки без дорогостоящего транскодинга (низкая задержка).
- **STUN/TURN:** coturn (обязательно TURN для NAT-restricted пользователей).

### Хранилище медиа
- **S3-compatible object storage** (AWS S3 / MinIO)
  - Почему:
    - Дёшево, масштабируемо, lifecycle policies.
    - Upload через pre-signed URL, backend не становится bottleneck.

### Инфраструктура
- Docker + Kubernetes (или ECS/Fargate) + Nginx/Envoy ingress + Prometheus/Grafana/Loki/Tempo.
- CI/CD: GitHub Actions.

---

## 2) ER-диаграмма (текстовый вид)

Ниже минимально достаточная схема для MVP.

```text
users
- id (uuid, pk)
- email (citext, unique)
- username (varchar, unique)
- password_hash (varchar, nullable for oauth-only)
- avatar_url (text, nullable)
- status (varchar) -- online/offline/dnd/idle
- created_at (timestamptz)
- updated_at (timestamptz)

oauth_accounts
- id (uuid, pk)
- user_id (uuid, fk -> users.id)
- provider (varchar) -- google/github/discord/etc
- provider_user_id (varchar)
- access_token_encrypted (text, nullable)
- refresh_token_encrypted (text, nullable)
- created_at
UNIQUE(provider, provider_user_id)

servers (guilds)
- id (uuid, pk)
- owner_id (uuid, fk -> users.id)
- name (varchar)
- icon_url (text, nullable)
- description (text, nullable)
- created_at

server_members
- id (uuid, pk)
- server_id (uuid, fk -> servers.id)
- user_id (uuid, fk -> users.id)
- nickname (varchar, nullable)
- joined_at
UNIQUE(server_id, user_id)

roles
- id (uuid, pk)
- server_id (uuid, fk -> servers.id)
- name (varchar)
- color (int, nullable)
- position (int)
- permissions (bigint) -- битовая маска прав
- is_managed (bool)
- created_at
UNIQUE(server_id, name)

member_roles
- member_id (uuid, fk -> server_members.id)
- role_id (uuid, fk -> roles.id)
PK(member_id, role_id)

channels
- id (uuid, pk)
- server_id (uuid, fk -> servers.id)
- parent_id (uuid, fk -> channels.id, nullable) -- category
- type (varchar) -- text/voice/category
- name (varchar)
- topic (text, nullable)
- position (int)
- bitrate (int, nullable, for voice)
- user_limit (int, nullable, for voice)
- created_at

channel_overwrites
- id (uuid, pk)
- channel_id (uuid, fk -> channels.id)
- target_type (varchar) -- role/member
- target_id (uuid) -- role.id or server_members.id
- allow_mask (bigint)
- deny_mask (bigint)
UNIQUE(channel_id, target_type, target_id)

messages
- id (bigint, pk) -- snowflake/ksuid/ulid recommended
- channel_id (uuid, fk -> channels.id)
- author_id (uuid, fk -> users.id)
- content (text)
- message_type (varchar) -- default/system
- reply_to_message_id (bigint, fk -> messages.id, nullable)
- edited_at (timestamptz, nullable)
- created_at (timestamptz)
INDEX(channel_id, created_at desc)

message_attachments
- id (uuid, pk)
- message_id (bigint, fk -> messages.id)
- file_key (text) -- object storage key
- file_name (varchar)
- mime_type (varchar)
- size_bytes (bigint)
- width (int, nullable)
- height (int, nullable)
- created_at

voice_sessions
- id (uuid, pk)
- channel_id (uuid, fk -> channels.id)
- user_id (uuid, fk -> users.id)
- sfu_session_id (varchar)
- joined_at
- left_at (timestamptz, nullable)
```

### Ключевые замечания по модели
- Права через `permissions bigint` (битовые флаги) + channel overwrites (как в Discord).
- `server_members` отделены от `users` для nickname/локальных ролей.
- Сообщения лучше хранить ID с временной сортируемостью (Snowflake/ULID) для эффективной пагинации.

---

## 3) Архитектура взаимодействия клиентов и серверов (high concurrency)

### Логические компоненты
1. **API Gateway / BFF**
   - REST: auth, CRUD серверов/каналов, presigned upload.
2. **WebSocket Gateway (Chat/Presence)**
   - Поддержка rooms по `server_id/channel_id`.
   - Приём/рассылка real-time событий.
3. **Chat Service**
   - Валидация прав, запись сообщений в PostgreSQL.
   - Публикация событий в NATS (`message.created`).
4. **Presence Service**
   - Presence state в Redis с TTL heartbeats.
5. **Voice Signaling Service**
   - SDP/ICE signaling, orchestration с SFU.
6. **SFU Cluster**
   - Маршрутизация аудиопотоков, адаптивные профили.
7. **Media Service**
   - Выдача pre-signed URL, AV scan hook, metadata extraction.

### Поток текстового сообщения
1. Клиент отправляет WS event `SEND_MESSAGE(channel_id, content)`.
2. Gateway проверяет JWT + membership cache.
3. Chat Service проверяет permission (`SEND_MESSAGES`) с учетом role + overwrite.
4. Пишет в PostgreSQL.
5. Публикует `message.created` в NATS.
6. WS-ноды подписаны на события и делают fan-out в нужные rooms.
7. ACK отправителю + delivery event подписчикам.

### Как держать тысячи/десятки тысяч одновременных WS соединений
- **Stateless WS nodes** за L4/L7 LB, sticky sessions не обязательны при внешнем pub/sub.
- **Redis/NATS backplane** для межнодовой маршрутизации событий.
- **Shard strategy**:
  - По `server_id % N` распределять hot guilds между WS pods.
  - Выделять отдельные pods для крупных guilds (isolation).
- **Backpressure**:
  - Ограничения на частоту сообщений на user/channel.
  - Drop policy для не-критичных событий (typing/presence burst).
- **Payload discipline**:
  - Компактные DTO, опционально protobuf/msgpack.
- **Connection lifecycle**:
  - Ping/pong heartbeat, idle timeout, reconnect with session resume token.

### Голос (WebRTC + SFU)
- Клиент получает voice token + endpoint SFU через Voice Signaling.
- ICE negotiation: STUN first, TURN fallback.
- Для масштабирования:
  - Региональные SFU узлы (EU/US/ASIA).
  - Affinity пользователя к ближайшему региону.
  - Перекладка channel в другой SFU при saturation.

---

## 4) Roadmap на 4 недели (MVP)

## Неделя 1 — Foundation & Auth
- Инициализация монорепо (apps/api, apps/web, packages/shared).
- Поднять PostgreSQL + Redis + NATS в docker-compose.
- Реализовать:
  - Email/password signup/login.
  - JWT access + refresh, revoke flow.
  - OAuth2 (Google/GitHub) базовый login.
- Базовые таблицы: users, oauth_accounts, servers, members.
- Observability baseline: structured logs, metrics endpoint.

**DoD:** пользователь может зарегистрироваться/войти и создать сервер.

## Неделя 2 — Servers/Channels/Roles + Text Chat v1
- CRUD серверов, каналов (text/voice/category).
- Роли и permission bitmasks + channel overwrites.
- WebSocket gateway + subscribe rooms.
- Отправка/получение текстовых сообщений в real-time.
- История сообщений с пагинацией (cursor-based).

**DoD:** несколько пользователей в одном канале видят сообщения мгновенно.

## Неделя 3 — Voice + Media
- Интеграция SFU (например LiveKit) + signaling service.
- Join/leave voice channel, mute/deafen state sync.
- S3-compatible uploads через pre-signed URL.
- Attachments в сообщениях.
- Базовые лимиты по размеру/типу файлов.

**DoD:** 3–10 участников устойчиво в голосовом канале + отправка файлов в чат.

## Неделя 4 — Hardening, Scale Tests, Release
- Нагрузочное тестирование WS и message fan-out.
- Оптимизация индексов PostgreSQL, hot-path кэширование в Redis.
- Rate limits, anti-spam, idempotency.
- Security hardening (CORS/CSRF policy, secrets, audit logs).
- Production-ready deployment manifests + runbooks.

**DoD:** стабильный MVP в staging, SLO и алерты настроены.

---

## 5) Основные технические риски и mitigation

1. **Высокая задержка/дропы в голосе**
   - Риски: плохой NAT traversal, перегруженный SFU, удалённый регион.
   - Mitigation:
     - TURN обязателен, региональный routing, autoscale SFU.
     - QoS метрики (RTT, packet loss, jitter) + adaptive bitrate.

2. **Перегрузка PostgreSQL из-за чата**
   - Риски: write burst, тяжёлые выборки истории.
   - Mitigation:
     - Индексы `(channel_id, created_at DESC)` и cursor pagination.
     - Batch inserts для системных событий.
     - Read replicas для history/read-heavy запросов.

3. **WS fan-out bottleneck**
   - Риски: hot channels, межнодовой broadcast overhead.
   - Mitigation:
     - Sharding по guild/channel, backplane на Redis/NATS.
     - Ограничение high-frequency events (typing/presence coalescing).

4. **Сложность permission checks**
   - Риски: дорогие вычисления при каждом сообщении.
   - Mitigation:
     - Кэш effective permissions per (member, channel) в Redis с коротким TTL.
     - Инвалидация кэша при изменениях ролей/overwrites.

5. **Злоупотребление upload и безопасность медиа**
   - Риски: вредоносные файлы, перерасход storage/трафика.
   - Mitigation:
     - Presigned URL с коротким TTL и лимитами.
     - MIME/size validation + async antivirus scan + quarantine bucket.

6. **Auth/session compromise**
   - Риски: кража refresh token, replay атак.
   - Mitigation:
     - HttpOnly secure cookies, refresh rotation, token jti deny-list в Redis.
     - Device/session tracking + forced logout.

7. **Неуправляемый рост стоимости инфраструктуры**
   - Риски: ранний over-engineering.
   - Mitigation:
     - Начать с modular monolith + выделять сервисы по профилю нагрузки.
     - Вести cost observability (per-service, per-feature).

---

## Рекомендованная целевая SLO/SLA рамка для MVP
- API p95 < 200ms (кроме тяжёлых операций).
- WS message delivery p95 < 150ms в регионе.
- Voice one-way latency target < 150ms.
- Доступность staging/prod: 99.5%+ на MVP этапе.

Это даст рабочий MVP, который можно быстро выпустить и эволюционно масштабировать до production-grade RTC платформы.
