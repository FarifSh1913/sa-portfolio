(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    const api = $('applicationsPage').dataset.api;
    const state = {client:null, employee:null, confirmed:null, clientVersion:0, employeeVersion:0, detailVersion:0, detail:null, action:null};
    const names = {CREATED:'Создано', APPROVED:'Согласовано', REJECTED:'Отклонено', PROCESSED:'Обработано'};
    const colors = {CREATED:'is-partial', APPROVED:'is-paid', REJECTED:'is-debt', PROCESSED:'is-paid'};
    const node = (tag, text, cls) => { const n = document.createElement(tag); if (text != null) n.textContent = text; if (cls) n.className = cls; return n; };
    const value = v => typeof v === 'string' || typeof v === 'number' ? String(v) : '—';
    const date = v => v && !Number.isNaN(Date.parse(v)) ? new Date(v).toLocaleString('ru-RU') : value(v);
    function badge(status, crm = false) { return node('span', crm && status === 'CREATED' ? 'Новое' : names[status] || value(status), `energo-badge ${colors[status] || ''}`); }
    async function request(path, options = {}, blob = false) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 45000);
        try {
            const response = await fetch(api + path, {...options, signal:controller.signal, cache:'no-store'});
            if (!response.ok) throw new Error(response.status === 413 ? 'Файл слишком большой. Максимальный размер — 10 МБ.' : 'Сервис недоступен. Повторите попытку.');
            if (blob) return await response.blob();
            const text = await response.text();
            return text.trim() ? JSON.parse(text) : null;
        } finally { clearTimeout(timer); }
    }
    let notificationTimer;
    function notify(text, error = false) { const n = $('notification'); n.textContent = text; n.classList.toggle('is-error', error); n.hidden = false; clearTimeout(notificationTimer); notificationTimer = setTimeout(() => n.hidden = true, 6500); }
    function status(id, text, kind = '') { const n = $(id); n.textContent = text; n.className = `energo-state ${kind}`; }
    function fields(container, entries) {
        const dl = node('dl', null, 'energo-details');
        for (const [label, val] of entries) { const div = node('div', null, 'energo-field'); div.append(node('dt',label),node('dd',value(val))); dl.append(div); }
        container.append(dl);
    }
    // Accessible combobox: loaded once, filtered locally; duplicate names remain distinguishable by ID.
    function picker(id, title, key, onSelect) {
        const root = $(id), label = node('label',title), input = node('input'), list = node('ul',null,'applications-options'), message = node('div',null,'energo-state');
        input.id = `${id}Input`; label.htmlFor = input.id; input.placeholder = 'Введите ФИО или выберите из списка'; input.autocomplete = 'off'; input.disabled = true;
        input.setAttribute('role','combobox'); input.setAttribute('aria-autocomplete','list'); input.setAttribute('aria-expanded','false'); input.setAttribute('aria-controls',`${id}Options`);
        list.id = `${id}Options`; list.setAttribute('role','listbox'); list.hidden = true; root.append(label,input,list,message);
        let items = [], filtered = [], active = -1, selected = null;
        const close = () => { list.hidden = true; input.setAttribute('aria-expanded','false'); input.removeAttribute('aria-activedescendant'); };
        function render(all = false) {
            const query = all ? '' : input.value.toLocaleLowerCase('ru');
            filtered = items.filter(i => `${i.fullName} ${i[key]}`.toLocaleLowerCase('ru').includes(query)); active = -1; list.replaceChildren();
            filtered.forEach((item,index) => { const li = node('li',`${item.fullName} · ${item[key]}`); li.id = `${id}Option${index}`; li.setAttribute('role','option'); li.setAttribute('aria-selected','false'); li.addEventListener('mousedown',e => e.preventDefault()); li.addEventListener('click',() => choose(index)); list.append(li); });
            if (!filtered.length) { const li = node('li','Ничего не найдено'); li.setAttribute('role','presentation'); list.append(li); }
            list.hidden = false; input.setAttribute('aria-expanded','true');
        }
        function choose(index) { selected = filtered[index]; if (!selected) return; input.value = `${selected.fullName} · ${selected[key]}`; close(); onSelect(selected); }
        input.addEventListener('focus',() => render(!!selected));
        input.addEventListener('click',() => { if (list.hidden) render(!!selected); });
        input.addEventListener('input',() => { selected = null; onSelect(null); render(); });
        input.addEventListener('blur',close);
        input.addEventListener('keydown',e => {
            if (e.key === 'Escape') { close(); return; }
            if (e.key === 'Enter' && !list.hidden) { e.preventDefault(); if (active >= 0) choose(active); return; }
            if (!['ArrowDown','ArrowUp'].includes(e.key)) return;
            e.preventDefault(); if (list.hidden) render(!!selected); if (!filtered.length) return;
            active = (active + (e.key === 'ArrowDown' ? 1 : -1) + filtered.length) % filtered.length;
            [...list.children].forEach((li,i) => li.setAttribute('aria-selected',String(i === active)));
            input.setAttribute('aria-activedescendant',list.children[active].id); list.children[active].scrollIntoView({block:'nearest'});
        });
        return async path => {
            message.textContent = 'Загрузка…';
            try { const data = await request(path); if (!Array.isArray(data) || data.some(i => !i?.[key] || !i.fullName)) throw new Error(); items = data; input.disabled = !items.length; message.textContent = items.length ? '' : 'Список пуст'; }
            catch (_) { message.replaceChildren(node('span','Не удалось загрузить список. ')); const retry = node('button','Повторить','energo-retry'); retry.type = 'button'; retry.onclick = () => loaders[id](path); message.append(retry); }
        };
    }
    const loaders = {};
    loaders.clientPicker = picker('clientPicker','Клиент','clientId',client => {
        state.client = client; ++state.clientVersion; $('clientInfo').replaceChildren(); $('clientRegistry').replaceChildren();
        $('createApplication').disabled = !client?.personalAccount?.trim(); $('clientRefresh').disabled = !client;
        if (!client) { $('clientInfo').textContent = 'Выберите клиента'; status('clientState','Выберите клиента'); return; }
        fields($('clientInfo'),[['ФИО',client.fullName],['Client ID',client.clientId],['Лицевой счет',client.personalAccount?.trim() ? client.personalAccount : 'Лицевой счет не указан']]);
        loadRegistry('client');
    });
    loaders.employeePicker = picker('employeePicker','Сотрудник CRM','employeeId',employee => {
        state.employee = employee; state.confirmed = null; ++state.employeeVersion; $('employeeRegistry').replaceChildren(); $('employeeInfo').replaceChildren();
        $('confirmEmployee').disabled = !employee; $('employeeRefresh').disabled = true;
        if (employee) fields($('employeeInfo'),[['ФИО',employee.fullName],['Employee ID',employee.employeeId],['Должность',employee.position]]);
        else $('employeeInfo').textContent = 'Выберите сотрудника';
        status('employeeState','Выберите сотрудника и нажмите «Подтвердить»');
    });
    async function loadRegistry(kind) {
        const crm = kind === 'employee', person = crm ? state.confirmed : state.client;
        if (!person) return;
        const id = person[crm ? 'employeeId' : 'clientId'], key = `${kind}Version`, version = ++state[key];
        $(kind + 'Registry').replaceChildren(); status(kind + 'State','Загружаем заявления…','is-loading');
        try {
            const rows = await request(`/${kind}/${encodeURIComponent(id)}`);
            if (version !== state[key]) return;
            if (!Array.isArray(rows) || rows.some(row => !row?.applicationId)) throw new Error();
            status(kind + 'State', rows.length ? `Заявлений: ${rows.length}` : 'Заявлений пока нет');
            for (const row of rows) {
                const li = node('li'), button = node('button',null,'energo-record'), main = node('span',null,'energo-record-identity'), meta = node('span',null,'energo-record-value'); button.type = 'button';
                main.append(node('span',value(row.applicationNumber),'energo-record-title'),node('span',value(row.subject),'energo-record-caption'));
                if (crm) main.append(node('span',`${value(row.client?.fullName || row.fullName)} · Client ID: ${value(row.client?.clientId || row.clientId)}`,'energo-record-subtitle'));
                meta.append(node('span',date(row.createdAt),'energo-record-subtitle'),badge(row.status,crm)); button.append(main,meta); button.onclick = () => openDetail(row.applicationId, crm ? id : null); li.append(button); $(kind + 'Registry').append(li);
            }
        } catch (_) { if (version === state[key]) status(kind + 'State','Не удалось загрузить заявления. Нажмите «Обновить».','is-error'); }
    }
    $('confirmEmployee').onclick = () => { state.confirmed = state.employee; $('employeeRefresh').disabled = !state.confirmed; loadRegistry('employee'); };
    $('clientRefresh').onclick = () => loadRegistry('client'); $('employeeRefresh').onclick = () => loadRegistry('employee');
    document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { if (b.closest('dialog').dataset.busy !== 'true') b.closest('dialog').close(); });
    document.querySelectorAll('dialog').forEach(d => { d.addEventListener('cancel',e => { if (d.dataset.busy === 'true') e.preventDefault(); }); d.addEventListener('close',() => { if (d.id === 'detailDialog') { ++state.detailVersion; state.detail = null; } }); });
    function attachments(container, files, title) {
        if (!files?.length) return;
        container.append(node('h3',title));
        for (const attachment of files.filter(Boolean)) {
            const id = attachment.fileId || attachment.file?.guid, filename = attachment.filename || attachment.file?.fileName || 'Вложение';
            const line = node('div',null,'applications-attachment'), button = node('button','Скачать','energo-retry'); button.disabled = !id; line.append(node('span',filename),button); container.append(line);
            button.onclick = async () => { button.disabled = true; try { const blob = await request(`/files/${encodeURIComponent(id)}/download`,{},true); const url = URL.createObjectURL(blob); const a = node('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url),1000); } catch (_) { const error = node('p','Не удалось скачать файл. Повторите попытку.','energo-state is-error'); error.setAttribute('role','status'); line.append(error); } finally { button.disabled = false; } };
        }
    }
    function textBlock(box, title, text) { if (!text) return; const section = node('section',null,'energo-detail-group'); section.append(node('h3',title),node('p',text,'applications-text')); box.append(section); }
    async function openDetail(id, employeeId, successMessage) {
        const version = ++state.detailVersion; state.detail = null; const dialog = $('detailDialog'), box = $('detailBody'); box.replaceChildren(node('p','Загрузка заявления…')); $('detailActions').replaceChildren(); if (!dialog.open) dialog.showModal();
        try {
            const data = await request(`/${encodeURIComponent(id)}`); if (version !== state.detailVersion || !dialog.open) return;
            if (!data || data.applicationId !== id) throw new Error();
            state.detail = {id, employeeId, data}; box.replaceChildren(); if (successMessage) { const message = node('p',successMessage,'applications-success'); message.setAttribute('role','status'); box.append(message); } $('detailTitle').textContent = data.applicationNumber || 'Заявление'; box.append(badge(data.status,!!employeeId));
            fields(box,[['Номер заявления',data.applicationNumber],['Дата создания',date(data.createdAt)],['ФИО клиента',data.client?.fullName || data.fullName],['Client ID',data.client?.clientId || data.clientId],['Лицевой счет',data.personalAccount || data.financialData?.personalAccount]]);
            textBlock(box,'Тема',data.subject); textBlock(box,'Текст обращения',data.description); attachments(box,[...(data.files || []),data.file].filter(Boolean),'Вложения клиента');
            textBlock(box,'Причина отклонения',data.reason); textBlock(box,'Результат обработки',data.result); attachments(box,[...(data.employeeFiles || []),data.employeeFile].filter(Boolean),'Файлы сотрудника');
            if (employeeId && data.financialData) { const f = data.financialData; const section = node('section',null,'energo-detail-group'); section.append(node('h3','Финансовая информация')); fields(section,[['Период',f.period],['Начисления',f.currentCharges],['Задолженность',f.debtAmount],['Переплата',f.overpaymentAmount],['Статус оплаты',f.paymentStatus],['Последний платеж',f.lastPaymentAmount],['Дата платежа',f.lastPaymentDate]]); box.append(section); }
            for (const entry of data.history || []) { const section = node('section',null,'energo-detail-group'); section.append(node('h3',`${date(entry.createdAt)} · ${names[entry.status] || value(entry.status)}`)); textBlock(section,'Причина',entry.reason); textBlock(section,'Результат',entry.result); attachments(section,entry.files,'Файлы'); box.append(section); }
            if (employeeId) for (const status of ['APPROVED','REJECTED','PROCESSED']) { const b = node('button',names[status],status === 'APPROVED' ? 'energo-primary' : 'energo-retry'); b.onclick = () => openAction(status); $('detailActions').append(b); }
        } catch (_) { if (version !== state.detailVersion) return; box.replaceChildren(node('p','Не удалось загрузить заявление.','energo-state is-error')); const retry = node('button','Повторить','energo-retry'); retry.onclick = () => openDetail(id,employeeId); box.append(retry); }
    }
    function resetForm(form) { form.reset(); form.querySelector('[data-error]').textContent = ''; form.querySelector('[data-counter]').textContent = '0 / 1000'; }
    document.querySelectorAll('.applications-form textarea').forEach(t => t.oninput = () => { t.closest('label').querySelector('[data-counter]').textContent = `${t.value.length} / 1000`; });
    let createClient;
    $('createApplication').onclick = () => { if (!state.client?.personalAccount?.trim()) return; createClient = {clientId:state.client.clientId, personalAccount:state.client.personalAccount}; resetForm($('createForm')); $('createDialog').showModal(); };
    function openAction(status) {
        if (!state.detail?.employeeId) return;
        state.action = {...state.detail,status}; resetForm($('actionForm')); $('actionTitle').textContent = names[status]; $('actionPrompt').textContent = `Заявление ${state.detail.data.applicationNumber || state.detail.id}. Подтвердите действие «${names[status]}».`;
        $('actionTextLabel').hidden = status === 'APPROVED'; $('actionTextTitle').textContent = status === 'REJECTED' ? 'Причина отклонения' : 'Результат обработки / что именно сделано'; $('actionForm').elements.note.required = status !== 'APPROVED'; $('actionDialog').showModal();
    }
    function createMultipart(payload, file) {
        const formData = new FormData();
        formData.append('clientId', payload.clientId);
        formData.append('personalAccount', payload.personalAccount);
        formData.append('subject', payload.subject);
        formData.append('description', payload.description);
        if (file) formData.append('file', file);
        return formData;
    }
    function updateMultipart(payload, file) {
        const formData = new FormData();
        formData.append('applicationId', payload.applicationId);
        formData.append('employeeId', payload.employeeId);
        formData.append('status', payload.status);
        if (payload.reason?.trim()) formData.append('reason', payload.reason);
        if (payload.result?.trim()) formData.append('result', payload.result);
        if (file) formData.append('file', file);
        return formData;
    }
    async function submit(form, dialog, data, method, success) {
        const file = form.elements.file.files[0], error = form.querySelector('[data-error]'); error.textContent = '';
        if (file?.size > 10 * 1024 * 1024) { error.textContent = 'Файл слишком большой. Максимальный размер — 10 МБ.'; return; }
        if (dialog.dataset.busy === 'true') return;
        dialog.dataset.busy = 'true'; form.querySelector('fieldset').disabled = true; dialog.querySelector('[data-close]').disabled = true;
        try { await request('',{method,body:method === 'POST' ? createMultipart(data,file) : updateMultipart(data,file)}); dialog.close(); success(); }
        catch (_) { error.textContent = method === 'POST' ? 'Не удалось создать обращение. Проверьте реестр перед повторной отправкой.' : 'Не удалось изменить статус заявления. Обновите карточку перед повторной отправкой.'; }
        finally { dialog.dataset.busy = 'false'; form.querySelector('fieldset').disabled = false; dialog.querySelector('[data-close]').disabled = false; }
    }
    $('createForm').onsubmit = e => {
        e.preventDefault(); const form = e.currentTarget, subject = form.elements.subject.value.trim(), description = form.elements.description.value.trim();
        if (!createClient?.personalAccount?.trim()) { form.querySelector('[data-error]').textContent = 'У выбранного клиента отсутствует лицевой счет.'; return; }
        if (!createClient || !subject || !description || description.length > 1000 || subject.length > 150) { form.querySelector('[data-error]').textContent = 'Укажите клиента, тему и текст обращения.'; return; }
        const data = {...createClient,subject,description}; submit(form,$('createDialog'),data,'POST',() => { notify('Обращение успешно создано'); if (state.client?.clientId === data.clientId) loadRegistry('client'); if (state.confirmed) loadRegistry('employee'); });
    };
    $('actionForm').onsubmit = e => {
        e.preventDefault(); const form = e.currentTarget, action = state.action, note = form.elements.note.value.trim(); if (!action) return;
        if (action.status !== 'APPROVED' && (!note || note.length > 1000)) { form.querySelector('[data-error]').textContent = 'Заполните описание действия (до 1000 символов).'; return; }
        const data = {applicationId:action.id, employeeId:action.employeeId, status:action.status}; if (action.status === 'REJECTED') data.reason = note; if (action.status === 'PROCESSED') data.result = note;
        submit(form,$('actionDialog'),data,'PUT',() => { notify('Статус заявления обновлён'); if (state.confirmed) loadRegistry('employee'); if (state.client) loadRegistry('client'); if ($('detailDialog').open) openDetail(action.id,action.employeeId,'Статус заявления обновлён'); });
    };
    loaders.clientPicker('/clients'); loaders.employeePicker('/employees');
})();
