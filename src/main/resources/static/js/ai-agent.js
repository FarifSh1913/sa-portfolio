(() => {
    'use strict';

    const STATES = Object.freeze({
        INTRO: 'intro', CHAT: 'chat', IMAGE_READY: 'image-ready', WAITING_APPROVAL: 'waiting-approval',
        USER_TASK_APPROVE: 'user-task-approve', COMPLETED: 'completed'
    });
    const $ = id => document.getElementById(id);
    const scene = $('aiScene');
    if (!scene) return;

    const car = $('aiCar'), wall = $('aiWall'), startButton = $('aiStart'), refreshButton = $('aiRefresh');
    const actionBar = $('aiSceneActions'), exhaust = $('aiExhaust'), assistant = $('aiAssistant');
    const lanaStage = $('aiLanaStage'), lanaStatus = $('aiLanaStatus'), history = $('aiMessageHistory');
    const chatForm = $('aiChatForm'), chatText = $('aiChatText'), skipIntroButton = $('aiSkipIntro');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const STORY_MESSAGES = [
        {sender: 'lana', type: 'text', text: 'Николай Николаевич, это я Лана! Ваш персональный помощник. 👋', time: '14:23', reaction: 'playful', delay: 1200},
        {sender: 'lana', type: 'text', text: 'Я анализирую текущую ситуацию на основе данных из Camunda.', time: '14:23', delay: 3000},
        {sender: 'nikolay', type: 'text', text: 'Что происходит?', time: '14:24', delay: 2800},
        {sender: 'lana', type: 'text', text: 'К сожалению, ваше видео с места происшествия попало в сеть. Оно уже распространяется в социальных сетях.', time: '14:24', reaction: 'sly', delay: 2400},
        {sender: 'lana', type: 'video', src: '/video/ТамараИНиколай.mp4', time: '14:24', reaction: 'laugh', delay: 4800},
        {sender: 'lana', type: 'text', text: 'Нужно срочно починить и отстроить Тамаре Геннадьевне стену и после отправить ей на согласование.\n\nЯ помогу подобрать подходящий вариант.\n\nПодскажите, пожалуйста, ваш бюджет?', time: '14:24', delay: 4500}
    ];
    const DEFAULT_COVER = 'Тамара Геннадьевна, Николай Николаевич подготовил вариант восстановления забора после произошедшего.\n\nПросим ознакомиться с предложенным вариантом и принять решение: согласовать выполнение работ или отказать в согласовании.';

    let state = STATES.INTRO, sessionId = null, processInstanceKey = null, taskId = null, requestInFlight = false;
    let lanaControllerPromise, lanaController, lanaAvatar, exhaustTimer, crashFallback, swapTimer, assistantTimer, runId = 0, pollController, introMessagesShown = 0;

    function setState(next) { state = next; scene.dataset.scenarioState = next; }
    function setChatEnabled(enabled) { chatText.disabled = !enabled || requestInFlight; chatForm.querySelector('button').disabled = !enabled || requestInFlight; }
    function wait(ms) { return new Promise(resolve => window.setTimeout(resolve, reducedMotion.matches ? Math.min(ms, 120) : ms)); }
    function nowTime() { return new Intl.DateTimeFormat('ru-RU', {hour: '2-digit', minute: '2-digit'}).format(new Date()); }
    function scrollChat(force = false, nearBottom = true) { if (!force && !nearBottom) return; requestAnimationFrame(() => history.scrollTo({top: history.scrollHeight, behavior: reducedMotion.matches ? 'auto' : 'smooth'})); }
    function createAvatar(sender) {
        const avatar = document.createElement('span'); avatar.className = `ai-message-avatar${sender === 'nikolay' ? ' is-nikolay' : ''}`; avatar.setAttribute('aria-hidden', 'true');
        if (sender === 'lana' && lanaAvatar) { const image = document.createElement('img'); image.src = lanaAvatar; image.alt = ''; avatar.append(image); }
        return avatar;
    }
    function addChatMessage(message, forceScroll = false) {
        const nearBottom = history.scrollHeight - history.scrollTop - history.clientHeight < 80;
        const row = document.createElement('article'); row.className = `ai-message-row${message.sender === 'nikolay' ? ' is-nikolay' : ''}`;
        const bubble = document.createElement('div'); bubble.className = `ai-message-bubble${message.type === 'video' ? ' ai-message-video' : ''}`;
        if (message.type === 'video') { const player = document.createElement('video'); player.controls = true; player.preload = 'metadata'; player.playsInline = true; const source = document.createElement('source'); source.src = message.src; source.type = 'video/mp4'; player.append(source); bubble.append(player); }
        else { const text = document.createElement('span'); text.textContent = message.text; bubble.append(text); }
        if (message.time) { const time = document.createElement('time'); time.className = 'ai-message-time'; time.textContent = message.time; bubble.append(time); }
        row.append(createAvatar(message.sender), bubble); history.append(row); if (message.reaction) lanaController?.react(message.reaction); scrollChat(forceScroll, nearBottom); return row;
    }
    function addImageMessage(image) {
        const apiUrl = document.querySelector('meta[name="ai-agent-api-url"]')?.content || window.location.origin;
        const url = new URL(image.url, apiUrl).href, row = document.createElement('article'); row.className = 'ai-message-row';
        const bubble = document.createElement('div'); bubble.className = 'ai-message-bubble ai-image-bubble'; const imageNode = document.createElement('img'); imageNode.src = url; imageNode.alt = 'Вариант восстановления забора'; imageNode.loading = 'lazy';
        imageNode.addEventListener('error', () => imageNode.replaceWith(document.createTextNode('Изображение не удалось загрузить.')));
        const link = document.createElement('a'); link.className = 'ai-download-image'; link.href = url; link.download = image.id || 'variant.png'; link.textContent = 'Скачать изображение'; bubble.append(imageNode, link); row.append(createAvatar('lana'), bubble); history.append(row); scrollChat(true);
    }
    function setRequestState(active) { requestInFlight = active; setChatEnabled(state === STATES.CHAT || state === STATES.IMAGE_READY); }
    function extractProcessKey(response) { return response?.processInstanceKey || response?.processInstanceId || response?.processId || response?.processInstance?.key || response?.processInstance?.id || response?.process?.instanceKey || response?.process?.id || null; }
    function addError(text) { addChatMessage({sender: 'lana', type: 'text', text: `Не получилось выполнить запрос. ${text}\n\nПроверьте подключение и попробуйте еще раз.`}, true); }

    async function sendChatMessage() {
        const text = chatText.value.trim(); if (!text || requestInFlight || ![STATES.CHAT, STATES.IMAGE_READY].includes(state)) return;
        addChatMessage({sender: 'nikolay', type: 'text', text, time: nowTime()}, true); chatText.value = ''; chatText.style.height = ''; setRequestState(true);
        try {
            const response = await window.aiAgentApi.chat(text, sessionId); sessionId = response.sessionId || sessionId;
            if (response.response) addChatMessage({sender: 'lana', type: 'text', text: response.response, time: nowTime()}, true);
            if (Array.isArray(response.images) && response.images.length) { setState(STATES.IMAGE_READY); response.images.forEach(addImageMessage); }
            if (extractProcessKey(response) && response.approvalStarted !== false) startApproval(response);
        } catch (error) { addError(error.message || 'Сервис Ланы временно недоступен.'); }
        finally { if (state === STATES.CHAT || state === STATES.IMAGE_READY) { setRequestState(false); chatText.focus(); } }
    }
    function startApproval(response) {
        processInstanceKey = extractProcessKey(response); setState(STATES.WAITING_APPROVAL); setChatEnabled(false); history.replaceChildren(); chatForm.hidden = true; renderWaiting('Процесс согласования запущен.\nОжидаем решения Тамары Геннадьевны.');
        pollController?.abort(); pollController = new AbortController();
        window.aiAgentProcess.waitForApprovalTask(processInstanceKey, status => {
            if (status.pollingError) updateWaiting('Не удается проверить статус процесса. Повторяем попытку…');
            if (status.currentTask?.taskDefinitionId === window.aiAgentProcess.APPROVAL_TASK) { taskId = status.currentTask.taskId; setState(STATES.USER_TASK_APPROVE); renderApprovalForm(); }
            else if (['COMPLETED', 'FAILED', 'CANCELED'].includes(status.status)) updateWaiting('Процесс завершен без доступного задания согласования.');
        }, pollController.signal).catch(error => updateWaiting(`Не удалось проверить статус процесса: ${error.message}`));
    }
    function renderWaiting(text) { assistant.classList.add('ai-state-screen'); assistant.querySelector('.ai-lana-character').hidden = true; assistant.querySelector('.ai-chat-header').hidden = true; history.className = 'ai-state-content'; history.innerHTML = `<div class="ai-status-card"><span class="ai-loader" aria-hidden="true"></span><h3>Вариант отправлен Тамаре Геннадьевне</h3><p>${text.replace(/\n/g, '<br>')}</p></div>`; }
    function updateWaiting(text) { const p = assistant.querySelector('.ai-status-card p'); if (p) p.textContent = text; }
    function renderApprovalForm() {
        assistant.classList.add('ai-state-screen'); assistant.querySelector('.ai-lana-character').hidden = true; assistant.querySelector('.ai-chat-header').hidden = true; history.className = 'ai-state-content'; history.replaceChildren();
        const form = document.createElement('form'); form.className = 'ai-approval-form'; form.innerHTML = `<div class="ai-form-heading"><span class="ai-assistant-kicker">USER TASK · APPROVAL</span><h3>Согласование восстановления забора</h3></div><label>Получатель<input name="recipient" value="Тамара Геннадьевна" readonly></label><label>Инициатор<input name="applicantName" value="Николай Николаевич" readonly></label><label>Тема<input name="subject" value="Согласование восстановления забора" readonly></label><label>Сопроводительный текст<textarea name="coverLetter" rows="7"></textarea></label><label>Комментарий <span class="ai-optional">необязательно</span><textarea name="comment" rows="3"></textarea></label><div class="ai-approval-actions"><button type="button" class="btn btn-outline-secondary" data-approved="false">Отказать</button><button type="button" class="btn btn-dark" data-approved="true">Согласовать</button></div><p class="ai-inline-error" role="alert" hidden></p></form>`;
        form.elements.coverLetter.value = DEFAULT_COVER; form.querySelectorAll('button[data-approved]').forEach(button => button.addEventListener('click', () => completeTask(form, button.dataset.approved === 'true'))); history.append(form);
    }
    async function completeTask(form, approved) {
        if (!taskId || requestInFlight) return; const payload = Object.fromEntries(new FormData(form).entries()); payload.approved = approved; const buttons = [...form.querySelectorAll('button')]; buttons.forEach(button => button.disabled = true); requestInFlight = true; const errorNode = form.querySelector('.ai-inline-error'); errorNode.hidden = true;
        try { await window.aiAgentApi.completeTask(taskId, payload); setState(STATES.COMPLETED); renderCompleted(approved, payload.comment); }
        catch (error) { requestInFlight = false; buttons.forEach(button => button.disabled = false); errorNode.textContent = `Не удалось отправить решение: ${error.message}`; errorNode.hidden = false; }
    }
    function escapeHtml(value) { const node = document.createElement('span'); node.textContent = value; return node.innerHTML; }
    function renderCompleted(approved, comment) { pollController?.abort(); const content = assistant.querySelector('.ai-state-content'); content.replaceChildren(); const card = document.createElement('div'); card.className = 'ai-status-card'; card.innerHTML = `<h3>${approved ? 'Согласовано' : 'Отказано в согласовании'}</h3><p>${approved ? 'Тамара Геннадьевна согласовала восстановление забора.' : (comment ? `Комментарий Тамары Геннадьевны: ${escapeHtml(comment)}` : 'Тамара Геннадьевна отказала в согласовании.')}</p><button type="button" class="btn btn-dark" id="aiRestartScenario">Начать сценарий заново</button>`; content.append(card); $('aiRestartScenario').addEventListener('click', restartScenario); }

    function finishIntro() { if (state !== STATES.INTRO) return; skipIntroButton.hidden = true; setState(STATES.CHAT); setChatEnabled(true); chatText.focus(); }
    function skipIntro() { if (state !== STATES.INTRO) return; for (let index = introMessagesShown; index < STORY_MESSAGES.length; index += 1) { addChatMessage(STORY_MESSAGES[index], true); introMessagesShown = index + 1; } finishIntro(); }
    function ensureLana() { if (!lanaControllerPromise) lanaControllerPromise = import('/js/ai-agent-lana.js').then(module => module.createLanaStage(lanaStage, reducedMotion)).then(controller => { lanaController = controller; return controller; }).catch(() => null); return lanaControllerPromise; }
    async function revealIntro(currentRun) {
        const controller = await ensureLana(); if (currentRun !== runId) return; if (controller) { controller.setActive(true); lanaAvatar = controller.getAvatarDataUrl(); lanaStatus.hidden = true; } else lanaStatus.textContent = '3D-модель недоступна. Лана на связи.';
        assistant.scrollIntoView({behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'nearest'}); setState(STATES.INTRO); setChatEnabled(false); introMessagesShown = 0; skipIntroButton.hidden = false;
        for (const message of STORY_MESSAGES) { await wait(message.delay); if (currentRun !== runId || state !== STATES.INTRO) return; addChatMessage(message, true); introMessagesShown += 1; }
        finishIntro();
    }
    function spawnSmoke() { const puff = document.createElement('span'); puff.className = 'ai-smoke-puff'; puff.addEventListener('animationend', () => puff.remove(), {once: true}); exhaust.append(puff); }
    function stopSmoke() { clearInterval(exhaustTimer); exhaustTimer = undefined; exhaust.replaceChildren(); }
    function handleCrash() { clearTimeout(crashFallback); stopSmoke(); scene.dataset.state = 'crash'; const current = runId; swapTimer = setTimeout(() => { if (current === runId) { scene.dataset.state = 'crashed'; assistantTimer = setTimeout(showLana, reducedMotion.matches ? 80 : 650); } }, reducedMotion.matches ? 80 : 360); }
    function showLana() { assistant.hidden = false; assistant.classList.add('is-visible'); scene.dataset.state = 'assistant'; revealIntro(runId); }
    function startDrive() { if (scene.dataset.state !== 'initial') return; const current = ++runId; startButton.disabled = true; actionBar.hidden = true; scene.dataset.state = 'running'; const distance = Math.max(0, wall.getBoundingClientRect().left - car.getBoundingClientRect().right + 2), duration = reducedMotion.matches ? 120 : 3200; car.style.setProperty('--drive-duration', `${duration}ms`); car.classList.add('is-driving'); if (!reducedMotion.matches) { spawnSmoke(); exhaustTimer = setInterval(spawnSmoke, 370); } requestAnimationFrame(() => requestAnimationFrame(() => { if (current === runId) car.style.transform = `translate3d(${distance}px, 0, 0)`; })); crashFallback = setTimeout(() => { if (current === runId) handleCrash(); }, duration + 250); }
    function restartScenario() { ++runId; pollController?.abort(); sessionId = processInstanceKey = taskId = null; requestInFlight = false; introMessagesShown = 0; clearTimeout(crashFallback); clearTimeout(swapTimer); clearTimeout(assistantTimer); stopSmoke(); history.querySelectorAll('video').forEach(video => video.pause()); history.replaceChildren(); chatForm.hidden = false; assistant.querySelector('.ai-lana-character').hidden = false; assistant.querySelector('.ai-chat-header').hidden = false; assistant.classList.remove('ai-state-screen'); history.className = 'ai-message-history'; chatText.value = ''; skipIntroButton.hidden = true; setChatEnabled(false); assistant.hidden = true; assistant.classList.remove('is-visible'); startButton.disabled = false; actionBar.hidden = false; scene.dataset.state = 'initial'; setState(STATES.INTRO); car.classList.remove('is-driving'); car.style.transition = 'none'; car.style.transform = 'translate3d(0, 0, 0)'; void car.offsetWidth; car.style.removeProperty('transition'); }
    function init() { car.addEventListener('transitionend', event => { if (event.target === car && event.propertyName === 'transform' && Math.abs(car.getBoundingClientRect().right - wall.getBoundingClientRect().left) < 6) handleCrash(); }); startButton.addEventListener('click', startDrive); refreshButton.addEventListener('click', restartScenario); skipIntroButton.addEventListener('click', skipIntro); chatForm.addEventListener('submit', event => { event.preventDefault(); sendChatMessage(); }); chatText.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendChatMessage(); } }); chatText.addEventListener('input', () => { chatText.style.height = 'auto'; chatText.style.height = `${Math.min(chatText.scrollHeight, 96)}px`; }); window.addEventListener('pagehide', () => { pollController?.abort(); lanaController?.dispose(); }); ensureLana(); }
    init();
})();
