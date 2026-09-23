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

- `EVENING_PLANS_API_URL` — доступный **браузеру** полный URL endpoint.
  Локально без env используется `http://localhost:8090/api/evening-plans`.
  В Docker Compose production-адрес по умолчанию задан в `docker-compose.yml`;
  переменная окружения позволяет его переопределить. JavaScript не добавляет путь.
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

В Integra предстоит реализовать endpoint, валидацию контракта на сервере, геокодер,
погоду, KudaGo и API мест, нормализацию, фильтрацию и формирование вариантов.
При другом origin Integra должна разрешать CORS для origin портфолио,
POST / OPTIONS и заголовков Content-Type / Accept. Браузер может отправить
служебный OPTIONS preflight; бизнес-запрос остается одним POST.
Ключи внешних API хранятся только в Integra. AI-этап пока информационный.
