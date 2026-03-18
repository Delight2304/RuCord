
# Вайбкод аналога Discord: архитектура, схема данных и роадмапа

## 1) Рекомендуемый стек технологий (с обоснованием)

### Backend
- **TypeScript + NestJS (modular monolith → microservices-ready)**
  - Почему:
    - Чёткая модульность (Auth, Guilds, Channels, Chat, Voice, Media, Permissions).
    - Встроенная поддержка WebSocket gateway
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


### Голос и медиа
- **WebRTC + SFU (LiveKit / mediasoup)**
  - Почему:
    - P2P плохо масштабируется >4–6 участников.
    - SFU пересылает потоки без дорогостоящего транскодинга (низкая задержка).
- **STUN/TURN:** coturn (обязательно TURN для NAT-restricted пользователей).

### Инфраструктура
- Docker + Kubernetes (или ECS/Fargate) + Nginx/Envoy ingress + Prometheus/Grafana/Loki/Tempo.
- CI/CD: GitHub Actions.

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

## 4) Роадмапа

## Foundation & Auth
- Инициализация монорепо (apps/api, apps/web, packages/shared).
- Поднять PostgreSQL + Redis + NATS в docker-compose.
- Реализовать:
  - Email/password signup/login.
  - JWT access + refresh, revoke flow.
  - OAuth2 (Google/GitHub) базовый login.
- Базовые таблицы: users, oauth_accounts, servers, members.
- Observability baseline: structured logs, metrics endpoint.


## Servers/Channels/Roles + Text Chat v1
- CRUD серверов, каналов (text/voice/category).
- Роли и permission bitmasks + channel overwrites.
- WebSocket gateway + subscribe rooms.
- Отправка/получение текстовых сообщений в real-time.
- История сообщений



## Voice + Media
- Интеграция SFU (например LiveKit) + signaling service.
- Join/leave voice channel, mute/deafen state sync.
- S3-compatible uploads через pre-signed URL.
- Attachments в сообщениях.
- Базовые лимиты по размеру/типу файлов.


 Hardening, Scale Tests, Release
- Нагрузочное тестирование WS и message fan-out.
- Оптимизация индексов PostgreSQL, hot-path кэширование в Redis.
- Rate limits, anti-spam, idempotency.
- Security hardening (CORS/CSRF policy, secrets, audit logs).
- Production-ready deployment manifests + runbooks.



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



---

## Рекомендованная целевая SLO/SLA рамка
- API p95 < 200ms (кроме тяжёлых операций).
- WS message delivery p95 < 150ms в регионе.
- Voice one-way latency target < 150ms.
- Доступность staging/prod: 99.5%+ на MVP этапе.

