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
