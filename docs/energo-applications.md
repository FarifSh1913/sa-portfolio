# Энерго — обращения (интеграционный кейс 2)

Страница: `/section/energo-applications`. Старый URL `/section/energo` сохранён.
Thymeleaf + vanilla JavaScript, общие `app.css` и `energo.css`, отдельные стили нового экрана.
Путь запросов: браузер → `IntegrationController` → `IntegraService` → Integra.
Все URL Integra используют существующий `integra.base-url` / `INTEGRA_BASE_URL`.
Реальные данные не заменяются демонстрационными. Browser fixtures находятся только в тесте.

## Внутренний API

Префикс всех маршрутов: `/api/integration/applications`.

| Метод | Суффикс | Integra |
|---|---|---|
| GET | `/clients` | `/rest/accaunt-details/all2` (только кейс 2) |
| GET | `/personal-account/{clientId}` | `/rest/personal-account-details/{clientId}` |
| GET | `/employees` | `/rest/employee-details/all` |
| GET | `/client/{clientId}` | `/rest/crm-client/task/client/{clientId}` |
| GET | `/employee/{employeeId}` | `/rest/crm-client/task/employee/{employeeId}` |
| GET | `/{applicationId}` | `/rest/crm-client/task/{applicationId}` |
| POST | пусто | `/rest/crm-client/task` |
| PUT | пусто | `/rest/crm-client/task` |
| GET | `/files/{fileId}/download` | `/rest/crm-client/file/{fileId}/download` |

Ответы не кешируются; ошибки Integra обрабатываются существующими безопасными обработчиками контроллера.

## Multipart

POST содержит отдельные текстовые поля `clientId`, `personalAccount`, `subject`, `description` и необязательный
бинарный файл `file`. Без файла передаются только четыре текстовых поля.

```js
const formData = new FormData();
formData.append('clientId', payload.clientId);
formData.append('personalAccount', payload.personalAccount);
formData.append('subject', payload.subject);
formData.append('description', payload.description);
if (file) formData.append('file', file);
fetch('/api/integration/applications', {method: 'POST', body: formData});
```

Браузер сам формирует boundary. Spring принимает текстовые поля через `@RequestParam`,
файл через `@RequestPart("file")`. `IntegraService` передаёт те же текстовые поля и файловый
`Resource` в Integra. JSON-part отсутствует; Base64 не используется.
`personalAccount` берётся из выбранного `Client`, полученного через `/all2`, и сохраняется
в `state.client`. ФИО, ID и счёт сразу отображаются из выбранного клиента.
Экран не вызывает `/personal-account/{clientId}`; backend endpoint сохранён для совместимости.
Без счёта UI показывает «Лицевой счет не указан» и блокирует создание обращения.
Кейс 1 продолжает использовать `integra.crm-path` = `/rest/accaunt-details/all`.

PUT передаёт отдельные текстовые поля `applicationId`, `employeeId`, `status`,
непустые `reason`/`result` и необязательный бинарный `file`:

```js
formData.append('applicationId', payload.applicationId);
formData.append('employeeId', payload.employeeId);
formData.append('status', payload.status);
if (payload.reason?.trim()) formData.append('reason', payload.reason);
if (payload.result?.trim()) formData.append('result', payload.result);
if (file) formData.append('file', file);
```

Для PUT Spring также принимает текст через `@RequestParam` и передаёт в Integra отдельными
полями. JSON Blob/data-part отсутствуют; браузер сам выставляет Content-Type и boundary.

Для `PROCESSED` — `result` вместо `reason`; для `APPROVED` описание не требуется.
Ограничения: тема 150, описание/причина/результат 1000 символов, загрузка 10 МБ, запрос 11 МБ.
Backend не ограничивает расширения; frontend имеет accept png/jpg/jpeg/pdf.

## Скачивание и состояние интерфейса

`energo-applications.js`, функция `attachments`: `fileId || file.guid` → прокси → Blob →
`URL.createObjectURL` → временная ссылка с `download` → освобождение URL.
`IntegrationController.downloadApplicationFile` возвращает байты как attachment с no-store/nosniff;
`IntegraService.downloadApplicationFile` выполняет запрос к Integra. URL из metadata не используется.

Оба searchable select фильтруют один раз загруженные списки локально и поддерживают клавиатуру.
Сотрудник по умолчанию не выбран. Смена сотрудника очищает подтверждение и реестр;
GET заявлений выполняется только по кнопке «Подтвердить». Запоздавшие ответы реестров
и карточек игнорируются. Клиент и сотрудник фиксируются на момент открытия формы.
Во время отправки повторная отправка и закрытие формы отключены.
После PUT обновляются оба активных реестра и открытая карточка.
Есть состояния загрузки, пустых списков, ошибок, повторной загрузки и уведомление об успехе.
Колокольчик статичен; email, WebSocket и распределение заявлений не реализуются.

## Точки сверки реального контракта Integra

Контракт создан по требованиям; реальные POST/PUT к preprod при проверке не отправлялись.
После получения согласованного контракта проверить:

- POST и PUT используют отдельные текстовые multipart-поля и необязательный файл `file`.
- Списки ожидаются JSON-массивами, детали — объектом; wrapper `data/items/content` не предполагается.
- `ApplicationModels.Application`: `client` либо плоские `clientId/fullName`, строковый `personalAccount`,
  `files/file`, `employeeFiles/employeeFile`, `reason`, `result`, `financialData`, массив `history`.
  Для входящего текста поддержаны также aliases `text/message`.
- `PersonalAccount` соответствует плоскому объекту из задания. Вложенный счёт потребует адаптера.
- Attachment ожидает `fileId` или `file.guid`; имя берётся из `filename`/`fileName` либо `file.fileName`.
- POST/PUT допускают пустой ответ либо объект заявления. Обёртка/иной ответ потребуют адаптации.
- Неизвестные поля DTO игнорируются. Структуру истории, финансов и вложений нужно сверить особенно:
  непромапленные дополнительные данные сами по себе в UI не появляются.

Изменения контракта локализованы в `ApplicationModels`, методах `IntegraService` и явном рендеринге
деталей в `energo-applications.js`; компоненты не используют `Map<String,Object>`.

## Файлы этой доработки

Изменены относительно состояния рабочего дерева перед задачей:

- `src/main/java/ru/portfolio/sa/controller/PortfolioController.java`
- `src/main/java/ru/portfolio/sa/controller/IntegrationController.java`
- `src/main/java/ru/portfolio/sa/integration/IntegraService.java`
- `src/main/resources/application.yml`
- `src/main/resources/templates/energo.html`
- `src/test/java/ru/portfolio/sa/PortfolioRoutesTest.java`

Созданы:

- `src/main/java/ru/portfolio/sa/dto/ApplicationModels.java`
- `src/main/resources/templates/energo-applications.html`
- `src/main/resources/static/css/energo-applications.css`
- `src/main/resources/static/js/energo-applications.js`
- `src/test/java/ru/portfolio/sa/ApplicationsIntegrationTest.java`
- `src/test/browser/energo-applications.mjs`
- `docs/energo-applications.md`

## Проверки

`mvn clean package`: 39 тестов, 0 ошибок/падений. В sandbox Mockito не может подключить
Java-агент; полный прогон выполнен с разрешённым запуском вне sandbox.
`node --check src/main/resources/static/js/energo-applications.js`.
Браузерный тест `src/test/browser/energo-applications.mjs` использует Chrome DevTools и
перехват только API обращений: подтверждение сотрудника, выбор клиента, счёт, реестры,
multipart POST/PUT, обновление статусов, пустой/ошибочный ответ, отсутствие overflow на 390px.
Для запуска: приложение на 8096, Chrome DevTools на 9233, затем
`node src/test/browser/energo-applications.mjs`. Это проверка UI с fixtures, не end-to-end к Integra.
