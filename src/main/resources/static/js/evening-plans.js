(() => {
    'use strict';
    const page = document.getElementById('eveningPage');
    const form = document.getElementById('eveningForm');
    const fields = document.getElementById('eveningFields');
    const results = document.getElementById('eveningResults');
    const errorBox = document.getElementById('formError');
    const status = document.getElementById('eveningStatus');
    const number = new Intl.NumberFormat('ru-RU');
    const plural = new Intl.PluralRules('ru-RU');
    const finite = value => typeof value === 'number' && Number.isFinite(value);
    const money = value => `${number.format(value)} ₽`;
    const activity = {walk: ['🌿', 'Прогулка'], museum: ['🏛', 'Музей'], exhibition: ['🎨', 'Выставка'], cafe: ['☕', 'Кафе'], restaurant: ['🍽', 'Ресторан'], cinema: ['🎬', 'Кино'], concert: ['♫', 'Концерт'], theatre: ['🎭', 'Театр'], event: ['✦', 'Событие'], free: ['🎁', 'Бесплатно'], unusual: ['✦', 'Необычно']};
    const emptyMessage = 'По этим параметрам ничего не найдено. Попробуйте изменить бюджет, время или предпочтения.';
    const now = new Date();
    form.elements.date.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    function element(tag, text, className) {
        const node = document.createElement(tag);
        if (text != null) node.textContent = text;
        if (className) node.className = className;
        return node;
    }
    function addText(parent, tag, value, className) {
        if (typeof value === 'string' && value.trim()) parent.append(element(tag, value, className));
    }
    function duration(minutes) {
        const hours = Math.floor(minutes / 60);
        const rest = minutes % 60;
        const words = {one: 'час', few: 'часа', many: 'часов', other: 'часа'};
        return [hours ? `${hours} ${words[plural.select(hours)]}` : '', rest || !hours ? `${rest} мин` : ''].filter(Boolean).join(' ');
    }
    function setState(state, message = '') {
        page.dataset.state = state;
        const loading = state === 'LOADING';
        fields.disabled = loading;
        form.setAttribute('aria-busy', String(loading));
        document.getElementById('eveningSpinner').hidden = !loading;
        document.getElementById('eveningButtonText').textContent = loading ? 'Ищем идеи…' : 'Найти идеи для вечера ↗';
        document.getElementById('eveningLoading').hidden = !loading;
        document.getElementById('eveningWelcome').hidden = state !== 'FORM';
        status.textContent = loading ? 'Ищем идеи для вашего вечера…' : state === 'RESULT' ? 'Варианты вечера готовы.' : '';
        errorBox.textContent = message;
        errorBox.hidden = !message;
    }
    function render(data) {
        results.replaceChildren();
        const context = [data.city, data.date, [data.timeFrom, data.timeTo].filter(v => typeof v === 'string').join('–')]
            .filter(v => typeof v === 'string' && v.trim()).join(' · ');

        const weather = data.weather;
        if (weather && (finite(weather.temperature) || typeof weather.rain === 'boolean' || finite(weather.windSpeed) || typeof weather.description === 'string' && weather.description.trim())) {
            const card = element('section', null, `evening-weather${weather.rain === true ? ' is-rain' : weather.rain === false ? ' is-dry' : ''}`);
            const icon = element('span', weather.rain === true ? '🌧' : weather.rain === false ? '🌤' : '🌡', 'evening-weather-icon');
            icon.setAttribute('aria-hidden', 'true');
            const details = element('div');
            card.append(icon, details);
            details.append(element('h2', 'Погода на вечер'));
            const meta = element('div', null, 'evening-meta');
            if (finite(weather.temperature)) meta.append(element('span', `${number.format(weather.temperature)}°C`, 'evening-temperature'));
            if (typeof weather.rain === 'boolean') meta.append(element('span', weather.rain ? 'Дождь' : 'Без дождя'));
            if (finite(weather.windSpeed)) meta.append(element('span', `Ветер: ${number.format(weather.windSpeed)} м/с`));
            details.append(meta);
            addText(details, 'p', weather.description);
            results.append(card);
        }
        const heading = element('div', null, 'evening-results-heading');
        heading.append(element('span', 'ВЕЧЕР, КОТОРЫЙ ВЫ ВЫБИРАЕТЕ', 'evening-kicker'), element('h2', 'Идеи для вашего вечера'));
        addText(heading, 'p', context, 'evening-meta');
        results.append(heading);
        if (!data.plans.length) {
            const empty = element('div', null, 'evening-empty');
            const icon = element('span', '✦');
            icon.setAttribute('aria-hidden', 'true');
            empty.append(icon, element('h3', 'Попробуем немного иначе?'), element('p', emptyMessage));
            const edit = element('button', 'Изменить пожелания', 'evening-edit');
            edit.type = 'button';
            edit.addEventListener('click', () => form.elements.city.focus());
            empty.append(edit);
            results.append(empty);
        }
        const grid = element('div', null, 'evening-plans-grid');
        results.append(grid);
        let index = 0;
        for (const plan of data.plans) {
            const card = element('article', null, 'evening-plan');
            card.append(element('span', `ВАРИАНТ ${String(++index).padStart(2, '0')}`, 'evening-plan-index'));
            card.append(element('h3', plan.title));
            addText(card, 'p', plan.description);
            const meta = element('div', null, 'evening-meta');
            const budget = finite(plan.estimatedBudget) ? plan.estimatedBudget : plan.budget;
            if (finite(budget)) meta.append(element('span', `≈ ${money(budget)}`));
            if (finite(plan.durationMinutes) && plan.durationMinutes >= 0) meta.append(element('span', duration(plan.durationMinutes)));
            card.append(meta);
            if (Array.isArray(plan.items) && plan.items.length) {
                const tags = element('div', null, 'evening-plan-tags');
                for (const type of new Set(plan.items.map(item => item.type))) {
                    if (Object.hasOwn(activity, type)) tags.append(element('span', activity[type].join(' ')));
                }
                card.append(tags);
                const timeline = element('ol', null, 'evening-timeline');
                for (const item of plan.items) {
                    const row = element('li');
                    addText(row, 'time', [item.startTime, item.endTime].filter(v => typeof v === 'string' && v.trim()).join('–'));
                    addText(row, 'h4', item.title);
                    if (finite(item.price)) row.append(element('div', money(item.price)));
                    if (typeof item.source === 'string' && item.source.trim()) row.append(element('small', `Источник: ${item.source}`));
                    timeline.append(row);
                }
                card.append(timeline);
            }
            grid.append(card);
        }
        results.hidden = false;
    }

    form.addEventListener('input', () => {
        if (page.dataset.state === 'ERROR') setState('FORM');
    });

    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (page.dataset.state === 'LOADING') return;
        results.hidden = true;
        const values = new FormData(form);
        const payload = {
            city: (values.get('city') || '').trim(), date: values.get('date'),
            timeFrom: values.get('timeFrom'), timeTo: values.get('timeTo'),
            budget: Number(values.get('budget')), company: values.get('company'),
            preferences: values.getAll('preferences')
        };
        let message = '';
        if (!payload.city) message = 'Укажите город.';
        else if (!payload.date) message = 'Укажите дату.';
        else if (!payload.timeFrom || !payload.timeTo || payload.timeFrom >= payload.timeTo) message = 'Укажите корректный диапазон времени: начало раньше окончания.';
        else if (!values.get('budget') || !finite(payload.budget) || payload.budget < 0) message = 'Укажите бюджет не меньше 0 ₽.';
        else if (!payload.company) message = 'Выберите компанию.';
        else if (!payload.preferences.length) message = 'Выберите хотя бы одно предпочтение.';
        else if (!form.checkValidity()) message = 'Пожалуйста, заполните обязательные поля.';
        if (message) { setState('ERROR', message); return; }
        setState('LOADING');
        try {
            const data = await window.eveningPlansApi.findPlans(payload);
            render(data);
            setState('RESULT');
            if (!data.plans.length) status.textContent = 'Пока без совпадений. Попробуйте изменить пожелания.';
        } catch (error) {
            setState('ERROR', error.message || 'Не удалось получить варианты вечера.');
        }
    });
})();
