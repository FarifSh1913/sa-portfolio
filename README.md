# SA Portfolio

Интерактивный сайт-портфолио системного аналитика на Spring Boot + Thymeleaf + Bootstrap.

## Локальный запуск

```bash
mvn spring-boot:run
```

Открыть: http://localhost:8080

## Docker

```bash
docker build -t sa-portfolio .
docker run --rm -p 8080:8080 sa-portfolio
```

## HTTPS через VPS + Caddy

1. Купить VPS с публичным IPv4.
2. Купить домен.
3. Создать A-запись домена на IP VPS.
4. В `Caddyfile` заменить `portfolio.example.com` на свой домен.
5. На сервере установить Docker + Docker Compose.
6. Скопировать проект на сервер.
7. Запустить:

```bash
docker compose up -d --build
```

Caddy автоматически запросит и обновит бесплатный TLS-сертификат Let's Encrypt.

## Архитектурная идея

Этап 1 — модульный монолит: один Spring Boot application.

Этап 2 — постепенно выносим функциональные блоки в микросервисы:
- API Gateway
- Process/Camunda service
- Kafka integration service
- AI agent service
- DB/data service

Это позволит на одном проекте показать и монолитную, и микросервисную архитектуру.

## Планы на вечер

Раздел: `/section/evening-plans`. Spring Boot + Thymeleaf + vanilla JS;
sa-portfolio собирает и валидирует ввод, затем отображает ответ без бизнес-правил.

- Браузер вызывает одноименный серверный proxy `/api/integration/evening-plans`.
  Сервер отправляет POST на `${integra.base-url}/rest/evening-plans`.
  `INTEGRA_BASE_URL` по умолчанию — `https://integra-preprod.7tech.cloud`.
  `EVENING_PLANS_API_URL` позволяет переопределить полный адрес на сервере.
  Основные настройки находятся в `src/main/resources/application.yml`.
- `EVENING_PLANS_MOCK_ENABLED=true` включает отдельный POST `/api/demo/evening-plans`
  со статичным `demo/evening-plans.json`. По умолчанию `false`, demo endpoint отсутствует.
  Демо явно обозначено на странице и не зависит от параметров формы.

Обычный режим отправляет один POST `{EVENING_PLANS_API_URL}`, без retry,
с `Content-Type: application/json` и таймаутом 45 секунд:

```json
{"city":"Москва","date":"2026-09-23","timeFrom":"18:00","timeTo":"23:00","budget":3000,"company":"couple","preferences":["walk","museum","cafe"]}
```

Поддерживается полный ответ (`requestId`, город/дата/время, `weather`, `plans` с
`estimatedBudget`, `durationMinutes`, `items`) и сокращенный
`{"weather":{"temperature":16,"rain":false},"plans":[{"title":"Музей + ресторан","budget":2900}]}`.
Необязательные отсутствующие поля не отображаются. Пустой `plans` — состояние «ничего не найдено».

HTTP-запросы идут через `IntegraService` с таймаутами подключения 5 секунд и чтения
35 секунд. Клиентский таймаут остается 45 секунд. Ответы не кэшируются;
ошибки upstream преобразуются в безопасные сообщения без stack trace.
CORS между браузером и Integra больше не требуется: браузер использует свой origin.
Бизнес-логика, JSON-запрос, mapping ответа и отображение результатов сохранены.

## Энерго

Раздел `/section/energo`: ЛК сверху, CRM и ЖКХ снизу; на мобильном — вертикально.
Все источники независимы. Базы данных и производственные mock-ответы не добавлялись.

| Локальный endpoint | Вызов Integra |
| --- | --- |
| POST `/api/integration/accaunt-info` | POST `/rest/accaunt-info`, JSON с новым UUID |
| GET `/api/integration/crm` | GET `/rest/accaunt-details/all` |
| GET `/api/integration/finance` | GET `/rest/fin-results`, без тела |

Методы обоих реестров закреплены как GET без тела. Старая переменная
`INTEGRA_FINANCE_METHOD` удалена. Ответы `null`, `{}`, `[]` безопасно нормализуются
в пустой реестр. Неожиданная структура вызывает отдельное состояние ошибки.
Реестры загружаются независимо; строки открывают нативный dialog с подробностями,
закрытием по X, кнопке, Esc и фону, удержанием и восстановлением фокуса.

Фактическая проверка preprod 05.10.2026 после публикации контрактов: оба реестра
отвечают 200, каждый содержит 3 записи в описанном формате. Финансы используют
плоские `lastPaymentAmount` / `lastPaymentDate`, а ЛК — вложенный `lastPayment`.

ЛК продолжает получать агрегированную сводку POST `/rest/accaunt-info` от Integra.
Обнаружена ошибка upstream: запрос `CL-100246 / 123456790` возвращает данные
`CL-100245 / 123456789`. Backend проверяет номер счета и Client ID в ответе;
при несовпадении показывает безопасную ошибку, не раскрывая чужую карточку.
Также адрес Иванова в CRM отличается от адреса в агрегированном ответе.
Исправление сопоставления и согласованности адресов требуется в Integra;
локальная подмена или повторная агрегация в портфолио не добавлялась.

Sidebar сворачивается кнопкой у правого края, сохраняет состояние в localStorage,
поддерживает клавиатуру и touch. На ширине ≤720px сохраняется исходное меню над контентом.
При отключенном localStorage работает без сохранения состояния.

Подробные изменения: [первый этап](docs/ENERGO-REPORT.md), [реестры и modal](docs/ENERGO-REGISTRIES.md).

## API Ланы

`AI_AGENT_API_URL` задает базовый адрес ai-agent-service (без пути `/api/v1`).
Для production: `AI_AGENT_API_URL=https://ai.lordfarif.ru`. Docker Compose
использует этот адрес по умолчанию, переменная окружения позволяет его переопределить.
Для локального запуска: `AI_AGENT_API_URL=http://localhost:8082`; это также
значение по умолчанию при запуске приложения без Docker Compose.

Адрес передается через `ai-agent.api-url` → PortfolioController → Thymeleaf meta.
Chat и process API сохраняют свои пути; относительные ссылки изображений
`/api/v1/images/{id}` разрешаются относительно адреса AI-сервиса.
Прежняя переменная `VITE_AI_AGENT_API_URL` заменена на `AI_AGENT_API_URL`.
