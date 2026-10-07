# Отчет: Энерго и навигация

> История первого этапа. Актуальные GET-контракты, реестры, modal и результаты
> повторной проверки Integra описаны в [доработке реестров](ENERGO-REGISTRIES.md).
> Ограничения по неизвестному методу ЖКХ ниже относятся только к первому этапу.

## Архитектура и изменения

Исходный проект: Spring Boot 3.5.6 / Java 21, Thymeleaf, Bootstrap 5.3.8,
обычный JavaScript, CSS без сборщика. Общий sidebar — Thymeleaf fragment;
меню формируется PortfolioController. Мобильное меню изначально расположено
над контентом, drawer отсутствует. Интеграции AI и evening-plans раньше
вызывались из браузера. Сервисов/DTO Integra и БД в приложении не было.
AI-интеграция, артефакты, архитектурная диаграмма и игра сохранены.

### Измененные файлы

- `src/main/java/ru/portfolio/sa/controller/PortfolioController.java`: меню и маршруты.
- `src/main/resources/application.yml`: центральные настройки Integra.
- `src/main/resources/templates/fragments/sidebar.html`: общий контрол сворачивания.
- `src/main/resources/static/css/app.css`: плавное изменение sidebar и контента.
- `docker-compose.yml`: preprod base URL, настройка метода ЖКХ.
- `src/test/java/ru/portfolio/sa/EveningPlansTest.java`: локальный proxy URL в странице.
- `src/test/java/ru/portfolio/sa/PortfolioRoutesTest.java`: новые/удаленные маршруты;
  исправлен устаревший assert `messageHistory.scrollTo` → `history.scrollTo`
  в ранее существующем тесте. Сам AI-чат не менялся.
- `README.md`: актуальная конфигурация и ограничения контрактов.

### Добавленные файлы

- `src/main/java/ru/portfolio/sa/controller/IntegrationController.java`
- `src/main/java/ru/portfolio/sa/integration/IntegraConfiguration.java`
- `src/main/java/ru/portfolio/sa/integration/IntegraService.java`
- `src/main/java/ru/portfolio/sa/dto/AccountRequest.java`
- `src/main/resources/templates/energo.html`
- `src/main/resources/static/css/energo.css`
- `src/main/resources/static/js/energo.js`
- `src/main/resources/static/js/sidebar.js`
- `src/test/java/ru/portfolio/sa/IntegrationTest.java`
- `docs/ENERGO-REPORT.md`

### Удаления

Удален единственный неиспользуемый шаблон `src/main/resources/templates/section.html`.
Убраны `/section/rest`, `/section/kafka`, `/section/camunda`, `/section/soap`,
`/section/database`: возвращают 404, ссылок в меню нет. Общий fallback
`/section/{slug}` удален, все действующие страницы имеют явные маршруты.
Общие компоненты не удалялись. Термины Kafka/Camunda/БД в учебных материалах
и самостоятельный действующий раздел «Camunda + AI агент» сохранены.

## Evening-plans

Endpoint по умолчанию: `POST https://integra-preprod.7tech.cloud/rest/evening-plans`.
Хранится в `application.yml` как `${integra.base-url}/rest/evening-plans`;
base URL можно изменить через `INTEGRA_BASE_URL`, полный адрес — через
`EVENING_PLANS_API_URL`. Docker Compose больше не переопределяет его старым доменом.

Браузер вызывает `/api/integration/evening-plans`, контроллер делегирует
`IntegraService.evening`. Сохраняются POST, application/json, исходные поля,
JSON-сериализация, mapping plans/weather, loading/error/empty и вся логика UI.
Старый явно включаемый demo-режим сохранен, по умолчанию отключен;
новых mock-ответов в приложении нет.

## Sidebar

Кнопка с chevron появляется при наведении на правый край и при фокусе клавиатурой.
На touch-планшете видна постоянно. Ширина плавно уменьшается до 44px, контент
расширяется через синхронный transition margin-left. Состояние сохраняется
в localStorage; запрет storage не ломает меню. Скрытые ссылки получают inert.
Есть aria-expanded, aria-controls, понятные label/title и reduced-motion.
При ширине ≤720px меню остается над контентом и полностью доступно независимо
от сохраненного desktop-состояния.

## Энерго и ЛК

Маршрут `/section/energo`, существующие shell/sidebar/шрифты Bootstrap.
ЛК сверху на всю ширину; горизонтальный divider; CRM слева и ЖКХ справа
с тонким вертикальным разделителем. На мобильном все три блока вертикальны.
Изображения `/Users/user/Downloads/сводка.jpg` и `морда.jpg` просмотрены:
использованы расположение систем, оранжевые действия, белый фон и светлые подложки.
Радиусы 12/16/24px и легкие тени продолжают текущий интерфейс.
Зеленый и красный в новой странице используются для финансовых статусов/ошибок.

ЛК: редактируемые Client ID и лицевой счет с заданными тестовыми значениями,
кнопка «Запросить сводку», новый crypto.randomUUID() на каждый запрос и retry.
Backend проверяет UUID и обязательные поля. Адрес собирается с устранением
дублирующихся region/city. Деньги — Intl.NumberFormat ru-RU, ₽, ноль без копеек.
Статусы переводятся и окрашиваются; неизвестный статус показывается без сбоя.
Период/дата форматируются Intl.DateTimeFormat, отсутствующие значения — «—».
Сводка выводится карточками, не JSON. Сервер не кэширует ответы с данными клиента.

## Интеграционные вызовы и модели

Все реальные вызовы реализованы в `IntegraService.java`:

| Метод сервиса | Локальный API | Integra |
| --- | --- | --- |
| account | POST /api/integration/accaunt-info | POST /rest/accaunt-info |
| crm | GET /api/integration/crm | GET /rest/accaunt-details/all |
| finance | GET /api/integration/finance | Настраиваемый метод /rest/fin-results |
| evening | POST /api/integration/evening-plans | POST /rest/evening-plans |

Добавлен DTO `AccountRequest(UUID requestId, String clientId, String personalAccount)`.
Ответы передаются как JsonNode: строгие модели CRM/ЖКХ не выдуманы без контракта.
JS проверяет структуру сводки; карточки источников отображают фактически пришедшие
поля с переводом известных названий и форматированием финансов, включая вложенные
объекты/списки. Неизвестные названия полей сохраняются, значения не придумываются.

RestClient: connect timeout 5s, read timeout 35s; браузерный timeout 45s.
Upstream ошибки → безопасные 502/504, некорректный запрос → 400,
неопределенный метод ЖКХ → 503. Upstream body/stack trace не передаются пользователю.
Секреты не добавлены; browser → backend запросы same-origin, CORS Integra не нужен.

## Состояния

ЛК блокирует поля/кнопку при запросе, показывает «Формируем сводку...»,
затем сводку, пустое состояние или ошибку с «Повторить».
CRM и ЖКХ запускаются независимо, у каждого собственные loading/skeleton,
aria-live/aria-busy, empty/error/retry. Ошибка источника не блокирует соседний
источник и ЛК. Данные из ответов вставляются через textContent, не innerHTML.

## Неопределенные контракты и реальный preprod

Проверено 05.10.2026:

- CRM GET `/rest/accaunt-details/all`: 200 application/json, `{}`. Метод подтвержден;
  непустая структура ответа не подтверждена.
- GET `/rest/fin-results`: 404 «Connector for /fin-results not found».
  OPTIONS сообщает общий Allow (все методы), это не подтверждает контракт коннектора.
- POST `/rest/accaunt-info` с тестовыми ID: timeout 40 секунд без ответа.
- POST `/rest/evening-plans` с исходной структурой запроса: HTTP 500.

Метод ЖКХ намеренно не угадан: `INTEGRA_FINANCE_METHOD` по умолчанию пустой.
После подтверждения можно установить GET или POST. Тело для POST сейчас
не отправляется: если оно требуется, необходимо получить точный контракт.
До этого ЖКХ показывает независимую ошибку и не отправляет неподтвержденный запрос.
Проверенная успешная end-to-end интеграция с preprod пока невозможна.

## Проверки

- `mvn clean package`: BUILD SUCCESS, 16 тестов, 0 failures/errors.
- Новые HTTP-тесты: точный путь с `accaunt`, методы, JSON, Content-Type,
  UUID/валидация, no-store, независимость источников, ошибки, отсутствие утечки тела.
- Проверки маршрутов: существующие страницы 200, удаленные 404, общее меню.
- `node --check`: новые JS-файлы без синтаксических ошибок.
- `git diff --check`: без ошибок.
- Приложение запущено из собранного JAR на порту 8097; реальные CRM/ЖКХ
  состояния проверены через браузер и backend (пустой ответ / 503).
- Headless Chrome: 1440×1000, 800×1100, 390×844; нет горизонтального переполнения
  на tablet/mobile; проверены collapse/expand, inert, возврат мобильного меню.
- Браузерные сценарии: независимая автозагрузка, loading/disabled, сводка,
  формат денег/адреса, error/retry, новый UUID, empty, неизвестный статус,
  результат evening-plans, навигация. JavaScript-исключений не обнаружено.
- Успешные и ошибочные ответы в браузерных сценариях подставлялись только через
  Chrome DevTools Fetch interception. Они не входят в приложение и не доказывают
  успешную работу upstream. Java HTTP-тесты отдельно проверяют реальный адаптер.
- Bootstrap CDN недоступен из среды проверки (timeout). После предварительного
  теста с кэшем 5.3.3 удалось получить Bootstrap 5.3.8 из npm. Финальный браузерный
  прогон выполнен с точной версией CSS 5.3.8, подставленной только в тестовом Chrome.
  Production подключение не менялось; доступность CDN надо проверить после деплоя.
- Просмотрены снимки desktop и mobile; desktop screenshot использует обычный
  viewport, поскольку full-page capture Chrome искажал фиксированный sidebar.
  Проверенная геометрия раскрытого sidebar: 290px, отступ основного контента: 290px.

## После деплоя

1. Проверить сетевую доступность preprod из контейнера приложения.
2. Подтвердить метод/тело и непустой ответ fin-results, настроить INTEGRA_FINANCE_METHOD.
3. Подтвердить непустую структуру CRM и финансов, проверить подписи дополнительных полей.
4. Повторить запрос ЛК с подготовленными в Integra тестовыми данными.
5. Проверить успешный ответ evening-plans после устранения HTTP 500 в Integra.
6. Убедиться, что demo-режим evening-plans отключен в production.
7. Проверить доступность Bootstrap CDN из сети пользователей, touch и мобильное меню.
