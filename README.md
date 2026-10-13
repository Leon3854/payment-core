# Payment Core

Платёжный микросервис на Node.js: создание счетов, расчёт комиссии, приём webhook с проверкой подписи и защитой от повторных атак.

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js)
![Express](https://img.shields.io/badge/Express-4-000000?style=for-the-badge&logo=express)
![MongoDB](https://img.shields.io/badge/MongoDB-8-47A248?style=for-the-badge&logo=mongodb)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis)
![Jest](https://img.shields.io/badge/Jest-29-C21325?style=for-the-badge&logo=jest)

## Что это

Изолированное «финтех-ядро» для приёма платежей: счёт создаётся с расчётом комиссии, статус оплаты приходит через подписанный webhook. Все денежные расчёты ведутся в минимальных денежных единицах (копейки/центы) целыми числами — без ошибок округления float.

## Возможности

- **Создание счёта** с расчётом комиссии от суммы и валюты
- **Проверка подписи webhook** — HMAC по заголовкам `X-Signature` / `X-Timestamp`
- **Защита от replay-атак** — nonce с TTL в Redis, окно валидности 5 минут
- **Идемпотентность** — повторный webhook по оплаченному счёту отвечает `200 Already processed`
- **Изоляция для тестов** — MongoDB Memory Server + `ioredis-mock`, сеть не трогается

## Стек

Express · Mongoose (MongoDB) · ioredis (Redis) · JSDoc · Jest + Supertest

## Быстрый старт

**Требования:** Node.js 18+, MongoDB 7, Redis

```bash
# 1. Установить зависимости
npm install

# 2. Настроить окружение: скопировать .env.example в .env и заполнить
cp .env.example .env

# 3. Поднять MongoDB и Redis локально

# 4. Запустить
npm start
```

Ожидаемый вывод:

```text
Connected to MongoDB
Server running on port 3000
```

## API

| Метод | Путь | Описание |
|---|---|---|
| `POST` | `/invoice` | Создание счёта |
| `POST` | `/webhook` | Приём статуса оплаты (подпись HMAC) |
| `GET` | `/invoice/:id` | Получение статуса счёта |

**Создание счёта:**

```json
POST /invoice
{
  "amount": 100.00,
  "currency": "RUB",
  "merchantId": "merchant_001"
}
```

**Webhook** — заголовки `X-Signature`, `X-Timestamp`, `X-Nonce`:

```json
POST /webhook
{
  "invoiceId": "...",
  "status": "paid"
}
```

## Тесты

```bash
npm test
```

## Структура

```text
src/
├── config/merchants.js        # конфигурация мерчантов и комиссий
├── models/Invoice.js          # модель счёта (Mongoose)
├── services/
│   ├── invoiceService.js      # создание и расчёт счёта
│   └── webhookService.js      # проверка подписи, nonce, идемпотентность
├── routes/
│   ├── invoice.js
│   └── webhook.js
├── utils/currency.js          # работа с минимальными единицами валют
└── app.js                     # сборка Express-приложения
tests/
├── invoice.test.js
└── webhook.test.js
```

## Допущения

- Комиссия хранится в конфигурации (в проде — в БД).
- Аутентификация мерчанта упрощена: `merchantId` из тела запроса. В проде — Bearer JWT.
- Предполагается синхронизация времени сервера с платёжной системой (окно webhook — 5 минут).

Подробное ТЗ — в [`REQUIREMENTS.md`](REQUIREMENTS.md).
