(() => {
    'use strict';
    const form = document.getElementById('accountForm');
    const fields = document.getElementById('accountFields');
    const submit = document.getElementById('accountSubmit');
    const accountState = document.getElementById('accountState');
    const accountRetry = document.getElementById('accountRetry');
    const result = document.getElementById('accountResult');
    const labels = {clientId:'Client ID', fullName:'ФИО', address:'Адрес', region:'Регион', city:'Город', street:'Улица', house:'Дом', apartment:'Квартира', personalAccount:'Лицевой счет', number:'Номер', period:'Расчетный период', currentCharges:'Текущие начисления', debtAmount:'Задолженность', overpaymentAmount:'Переплата', paymentStatus:'Статус оплаты', accountStatus:'Статус', lastPaymentAmount:'Последний платеж', lastPaymentDate:'Дата последнего платежа', lastPayment:'Последний платеж', amount:'Сумма', date:'Дата', client:'Клиент', requestId:'ID запроса'};
    const statuses = {PAID:['Оплачено','is-paid'], DEBT:['Есть задолженность','is-debt'], PARTIALLY_PAID:['Оплачено частично','is-partial']};
    const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    const scalar = value => ['string','number','boolean'].includes(typeof value);
    const display = value => scalar(value) ? String(value) : '—';
    const finite = value => typeof value === 'number' && Number.isFinite(value);
    const money = value => finite(value) ? new Intl.NumberFormat('ru-RU', {style:'currency',currency:'RUB',minimumFractionDigits:value === 0 ? 0 : 2,maximumFractionDigits:2}).format(value) : '—';
    function node(tag, text, className) {
        const element = document.createElement(tag);
        if (text != null) element.textContent = text;
        if (className) element.className = className;
        return element;
    }
    function date(value, period = false) {
        if (typeof value !== 'string' || !(period ? /^\d{4}-\d{2}$/ : /^\d{4}-\d{2}-\d{2}$/).test(value)) return display(value);
        const parsed = new Date(`${value}${period ? '-01' : ''}T00:00:00Z`);
        const formatted = Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('ru-RU', period ? {month:'long',year:'numeric',timeZone:'UTC'} : {day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(parsed);
        return period ? formatted.charAt(0).toUpperCase() + formatted.slice(1) : formatted;
    }
    function badge(value) {
        const status = typeof value === 'string' && Object.hasOwn(statuses, value) ? statuses[value] : [display(value),''];
        return node('span', status[0], `energo-badge ${status[1]}`);
    }
    function field(list, key, value, label) {
        let className = key === 'address' ? 'energo-field is-address' : 'energo-field';
        if (['currentCharges','debtAmount'].includes(key)) className += ' is-key';
        if (key === 'debtAmount' && finite(value) && value > 0) className += ' is-debt';
        if (key === 'overpaymentAmount' && finite(value) && value > 0) className += ' is-positive';
        const item = node('div', null, className);
        item.append(node('dt', label || (Object.hasOwn(labels,key) ? labels[key] : key)));
        const details = node('dd');
        if (key === 'paymentStatus') details.append(badge(value));
        else if (key === 'accountStatus') details.append(accountBadge(value));
        else if (['currentCharges','debtAmount','overpaymentAmount','amount','lastPaymentAmount'].includes(key)) details.textContent = money(value);
        else if (key === 'period' || key === 'date' || key === 'lastPaymentDate') details.textContent = date(value, key === 'period');
        else details.textContent = value == null ? '—' : display(value);
        item.append(details); list.append(item);
    }
    function card(title) {
        const box = node('article', null, 'energo-card');
        box.append(node('h3', title));
        const list = node('dl', null, 'energo-details');
        box.append(list);
        return {box,list};
    }
    function address(value) {
        if (!object(value)) return display(value);
        const parts = [...new Set([value.region,value.city].filter(v => typeof v === 'string' && v.trim()))];
        if (scalar(value.street)) parts.push(String(value.street));
        if (scalar(value.house)) parts.push(`д. ${value.house}`);
        if (scalar(value.apartment)) parts.push(`кв. ${value.apartment}`);
        return parts.join(', ') || '—';
    }
    function summary(data) {
        if (!object(data) || !object(data.client) || !object(data.personalAccount)) throw new Error('Источник вернул сводку в неподдерживаемом формате.');
        if (!Object.keys(data.client).length && !Object.keys(data.personalAccount).length) return false;
        const client = card('Клиент');
        for (const key of ['fullName','clientId']) field(client.list,key,data.client[key]);
        field(client.list,'address',address(data.client.address));
        const account = card('Лицевой счет');
        for (const key of ['number','period','currentCharges','debtAmount','overpaymentAmount','paymentStatus']) field(account.list,key,data.personalAccount[key]);
        field(account.list,'amount',data.personalAccount.lastPayment?.amount,'Последний платеж');
        field(account.list,'date',data.personalAccount.lastPayment?.date,'Дата последнего платежа');
        result.append(client.box,account.box);
        return true;
    }
    async function request(url, body) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(),45000);
        try {
            const response = await fetch(url, {method:body ? 'POST' : 'GET', headers:body ? {'Content-Type':'application/json','Accept':'application/json'} : {'Accept':'application/json'}, body:body ? JSON.stringify(body) : undefined, signal:controller.signal, cache:'no-store'});
            if (!response.ok) {
                let errorBody;
                try { errorBody = await response.json(); } catch (_) { /* Only a known safe code is interpreted. */ }
                if (errorBody?.code === 'ACCOUNT_MISMATCH') throw new Error('Не удалось подтвердить данные выбранного лицевого счета. Попробуйте позже.');
                throw new Error('Сервис временно недоступен. Попробуйте еще раз.');
            }
            const text = await response.text();
            if (!text.trim()) return null;
            try { return JSON.parse(text); } catch (_) { throw new Error('Источник вернул ответ в неподдерживаемом формате.'); }
        } catch (error) {
            if (error.name === 'AbortError') throw new Error('Время ожидания истекло. Попробуйте еще раз.');
            if (error instanceof TypeError) throw new Error('Проверьте подключение и повторите запрос.');
            throw error;
        } finally { clearTimeout(timeout); }
    }
    function state(element, text, kind = '') {
        element.textContent = text;
        element.className = `energo-state ${kind ? `is-${kind}` : ''}`;
    }
    let accountBusy = false;
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (accountBusy || !form.reportValidity()) return;
        const clientId = form.elements.clientId.value.trim();
        const personalAccount = form.elements.personalAccount.value.trim();
        if (!clientId || !personalAccount) { state(accountState,'Заполните Client ID и лицевой счет.','error'); return; }
        accountBusy = true;
        fields.disabled = true;
        form.setAttribute('aria-busy','true');
        accountRetry.hidden = true;
        result.replaceChildren();
        submit.textContent = 'Формируем сводку...';
        state(accountState,'Формируем сводку...','loading');
        try {
            const data = await request(form.dataset.url, {requestId:crypto.randomUUID(),clientId,personalAccount});
            const empty = data == null || (object(data) && !Object.keys(data).length);
            state(accountState, empty || !summary(data) ? 'По этому лицевому счету данных пока нет.' : 'Сводка сформирована');
        } catch (error) {
            state(accountState,`Не удалось получить сводку. ${error.message}`,'error');
            accountRetry.hidden = false;
        } finally {
            accountBusy = false;
            fields.disabled = false;
            form.setAttribute('aria-busy','false');
            submit.textContent = 'Запросить сводку';
        }
    });
    accountRetry.addEventListener('click',() => form.requestSubmit());

    /** @typedef {{clientId:string, fullName:string, address:object}} CrmAccount */
    /** @typedef {{clientId:string, personalAccount:string, fullName:string, period:string, currentCharges:number, debtAmount:number, overpaymentAmount:number, paymentStatus:string, lastPaymentAmount:number, lastPaymentDate:string}} FinanceResult */
    const accountStatuses = {ACTIVE:'Активен', INACTIVE:'Неактивен', CLOSED:'Закрыт', BLOCKED:'Заблокирован'};
    function accountBadge(value) {
        return node('span', Object.hasOwn(accountStatuses, value) ? accountStatuses[value] : display(value), 'energo-badge energo-account-badge');
    }
    function recordsFrom(data, type) {
        if (data == null || (object(data) && !Object.keys(data).length)) return [];
        if (!Array.isArray(data)) throw new Error('Не удалось прочитать данные. Попробуйте позже.');
        const texts = type === 'crm' ? ['clientId','fullName'] : ['clientId','personalAccount','fullName','period','paymentStatus','lastPaymentDate'];
        const numbers = type === 'finance' ? ['currentCharges','debtAmount','overpaymentAmount','lastPaymentAmount'] : [];
        if (data.some(record => !object(record) || !Object.keys(record).length ||
            (type === 'crm' && record.address != null && !object(record.address)) ||
            texts.some(key => record[key] != null && typeof record[key] !== 'string') ||
            numbers.some(key => record[key] != null && !finite(record[key])))) {
            throw new Error('Не удалось прочитать данные. Попробуйте позже.');
        }
        return data;
    }
    const dialog = document.getElementById('energoDialog');
    const dialogBody = document.getElementById('energoDialogBody');
    let dialogOpener;
    function detailGroup(title, entries, metrics = false) {
        const group = node('section', null, `energo-detail-group${metrics ? ' energo-metrics' : ''}`);
        group.append(node('h3',title));
        const list = node('dl', null, 'energo-details');
        for (const [key, value, label] of entries) field(list,key,value,label);
        group.append(list); dialogBody.append(group);
    }
    function openDetails(type, record, opener) {
        dialogOpener = opener;
        document.getElementById('energoDialogTitle').textContent = type === 'crm' ? 'Карточка клиента' : 'Финансовая информация';
        document.getElementById('energoDialogSource').textContent = type === 'crm' ? 'CRM · РЕКВИЗИТЫ КЛИЕНТА' : 'ЖКХ · ФИНАНСОВЫЕ ПОКАЗАТЕЛИ';
        dialogBody.replaceChildren();
        if (type === 'crm') detailGroup('Клиент', crmDetails(record));
        else {
            detailGroup('Клиент и лицевой счет', [['fullName',record.fullName,'Клиент'],['clientId',record.clientId],['personalAccount',record.personalAccount],['period',record.period]]);
            detailGroup('Начисления и баланс', [['currentCharges',record.currentCharges],['debtAmount',record.debtAmount],['overpaymentAmount',record.overpaymentAmount]], true);
            detailGroup('Оплата', [['paymentStatus',record.paymentStatus],['lastPaymentAmount',record.lastPaymentAmount],['lastPaymentDate',record.lastPaymentDate]]);
        }
        dialog.showModal();
        dialog.querySelector('.energo-dialog-x').focus();
        dialog.scrollTop = 0;
        document.documentElement.classList.add('energo-modal-open');
    }
    dialog.querySelector('.energo-dialog-x').addEventListener('click',() => dialog.close());
    document.getElementById('energoDialogClose').addEventListener('click',() => dialog.close());
    dialog.addEventListener('close',() => {
        document.documentElement.classList.remove('energo-modal-open');
        const opener = dialogOpener;
        if (opener?.isConnected) setTimeout(() => opener.focus({preventScroll:true}),0);
    });
    // Native dialog handles Escape and makes the background inert. Keep Tab within
    // the card as well, including browsers that otherwise focus browser chrome.
    dialog.addEventListener('keydown',event => {
        if (event.key !== 'Tab') return;
        const controls = [...dialog.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
            .filter(element => element.getClientRects().length);
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
            event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) {
            event.preventDefault(); first?.focus();
        }
    });
    function outside(event) {
        const box = dialog.getBoundingClientRect();
        return event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
    }
    let backdropDown = false;
    dialog.addEventListener('pointerdown',event => { backdropDown = event.target === dialog && outside(event); });
    dialog.addEventListener('click',event => {
        if (backdropDown && event.target === dialog && outside(event)) dialog.close();
        backdropDown = false;
    });
    function crmDetails(record) {
        return [['fullName',record.fullName,'ФИО'],['clientId',record.clientId,'Client ID'],['address',address(record.address),'Адрес']]
            .filter(([, value]) => typeof value === 'string' && value.trim() && !['-', '—'].includes(value.trim()));
    }
    function registryRow(type, record) {
        const item = node('li');
        const row = node('button',null,'energo-record');
        row.type = 'button';
        row.setAttribute('aria-haspopup','dialog');
        if (type === 'crm') {
            row.classList.add('energo-record-crm');
            const details = crmDetails(record);
            row.setAttribute('aria-label', `Карточка клиента: ${details.map(([, value]) => value).join(', ')}`);
            const identity = node('span',null,'energo-record-identity');
            for (const [key, value] of details) {
                identity.append(node('span',value,key === 'fullName' ? 'energo-record-title' : key === 'clientId' ? 'energo-record-subtitle' : 'energo-record-caption'));
            }
            const arrow = node('span','›','energo-record-arrow');
            arrow.setAttribute('aria-hidden','true');
            row.append(identity,arrow);
            row.addEventListener('click',() => openDetails(type,record,row));
            item.append(row); return item;
        }
        row.setAttribute('aria-label', `${type === 'crm' ? 'Карточка клиента' : 'Финансовая информация'}: ${display(record.fullName)}, лицевой счет ${display(record.personalAccount)}`);
        const identity = node('span',null,'energo-record-identity');
        const primary = type === 'crm' ? record.fullName : record.personalAccount;
        const secondary = type === 'crm' ? record.clientId : record.fullName;
        identity.append(node('span',display(primary),'energo-record-title'),node('span',display(secondary),'energo-record-subtitle'));
        const value = node('span',null,'energo-record-value');
        value.append(node('span',type === 'crm' ? 'Лицевой счет' : 'Начислено','energo-record-label'),
            node('span',type === 'crm' ? display(record.personalAccount) : money(record.currentCharges),'energo-record-number'));
        const meta = node('span',null,'energo-record-meta');
        // The full address remains available in the detail card.
        const shortAddress = typeof record.address === 'string' ? record.address.replace(/^г\.\s*[^,]+,\s*/, '') : display(record.address);
        meta.append(node('span',type === 'crm' ? shortAddress : date(record.period,true),'energo-record-caption'));
        const badges = node('span',null,'energo-record-badges');
        badges.append(type === 'crm' ? accountBadge(record.accountStatus) : badge(record.paymentStatus));
        if (type === 'finance' && finite(record.overpaymentAmount) && record.overpaymentAmount > 0) badges.append(node('span','Переплата','energo-badge is-paid'));
        const arrow = node('span','›','energo-record-arrow'); arrow.setAttribute('aria-hidden','true');
        row.append(identity,value,meta,badges,arrow);
        row.addEventListener('click',() => openDetails(type,record,row));
        item.append(row); return item;
    }
    const countWords = {one:'запись',few:'записи',many:'записей',other:'записи'};
    const plural = new Intl.PluralRules('ru-RU');
    function source(id, loading, failure) {
        const root = document.getElementById(id);
        const status = root.querySelector('.energo-state');
        const retry = root.querySelector('.energo-retry');
        const records = root.querySelector('.energo-records');
        const skeleton = root.querySelector('.energo-skeleton');
        const count = root.querySelector('.energo-count');
        const hint = root.querySelector('.energo-registry-hint');
        let busy = false;
        async function load() {
            if (busy) return;
            busy = true; retry.hidden = true; records.replaceChildren();
            count.hidden = hint.hidden = true; skeleton.hidden = false;
            root.dataset.state = 'loading';
            root.setAttribute('aria-busy','true'); state(status,loading,'loading');
            try {
                const data = recordsFrom(await request(root.dataset.url),id);
                count.textContent = `${data.length} ${countWords[plural.select(data.length)]}`;
                count.hidden = false;
                if (!data.length) {
                    state(status,'Записи не найдены','empty');
                    root.dataset.state = 'empty';
                } else {
                    const fragment = document.createDocumentFragment();
                    for (const record of data) fragment.append(registryRow(id,record));
                    records.append(fragment);
                    state(status,`Загружено: ${count.textContent}`,'success');
                    hint.hidden = false; root.dataset.state = 'success';
                }
            } catch (_) {
                state(status,failure,'error');
                status.append(node('span','Сервис временно недоступен. Попробуйте еще раз.','energo-state-description'));
                retry.hidden = false; root.dataset.state = 'error';
            } finally { busy = false; skeleton.hidden = true; root.setAttribute('aria-busy','false'); }
        }
        retry.addEventListener('click',load);
        load();
    }
    source('crm','Получаем данные CRM...','Не удалось загрузить данные CRM');
    source('finance','Получаем финансовые данные...','Не удалось загрузить данные ЖКХ');
})();
