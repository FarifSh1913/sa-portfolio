(() => {
    'use strict';

    const STATES = Object.freeze({
        INITIAL: 'initial',
        RUNNING: 'running',
        CRASH: 'crash',
        CRASHED: 'crashed',
        ASSISTANT: 'assistant'
    });

    const scene = document.getElementById('aiScene');
    if (!scene) return;

    const car = document.getElementById('aiCar');
    const wall = document.getElementById('aiWall');
    const startButton = document.getElementById('aiStart');
    const refreshButton = document.getElementById('aiRefresh');
    const actionBar = document.getElementById('aiSceneActions');
    const exhaust = document.getElementById('aiExhaust');
    const assistant = document.getElementById('aiAssistant');
    const lanaStage = document.getElementById('aiLanaStage');
    const lanaStatus = document.getElementById('aiLanaStatus');
    const messageHistory = document.getElementById('aiMessageHistory');
    const chatForm = document.getElementById('aiChatForm');
    const chatText = document.getElementById('aiChatText');
    const toast = document.getElementById('aiToast');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    let state = STATES.INITIAL;
    let exhaustTimer;
    let crashFallback;
    let swapTimer;
    let assistantTimer;
    let toastTimer;
    let runId = 0;
    let lanaControllerPromise;
    let lanaController;
    let lanaAvatar;

    const STORY_MESSAGES = [
        {sender: 'lana', type: 'text', text: 'Николай Николаевич, это я Лана! Ваш персональный помощник. 👋', time: '14:23', reaction: 'playful', delay: 1200},
        {sender: 'lana', type: 'text', text: 'Я анализирую текущую ситуацию на основе данных из Camunda.', time: '14:23', delay: 3000},
        {sender: 'nikolay', type: 'text', text: 'Что происходит?', time: '14:24', delay: 2800},
        {sender: 'lana', type: 'text', text: 'К сожалению, ваше видео с места происшествия попало в сеть. Оно уже распространяется в социальных сетях.', time: '14:24', reaction: 'sly', delay: 2400},
        {sender: 'lana', type: 'video', src: '/video/ТамараИНиколай.mp4', time: '14:24', reaction: 'laugh', delay: 4800},
        {sender: 'lana', type: 'text', text: 'Нужно срочно починить и отстроить Тамаре Геннадьевне стену и после отправить ей на согласование.\n\nЯ помогу подобрать подходящий вариант.\n\nПодскажите, пожалуйста, ваш бюджет?', time: '14:24', delay: 4500}
    ];

    function setState(nextState) {
        state = nextState;
        scene.dataset.state = nextState;
    }

    function spawnExhaustSmoke() {
        const puff = document.createElement('span');
        puff.className = 'ai-smoke-puff';
        puff.addEventListener('animationend', () => puff.remove(), {once: true});
        exhaust.appendChild(puff);
    }

    function stopExhaustSmoke() {
        window.clearInterval(exhaustTimer);
        exhaustTimer = undefined;
        exhaust.replaceChildren();
    }

    function handleCrash() {
        if (state !== STATES.RUNNING) return;

        window.clearTimeout(crashFallback);
        stopExhaustSmoke();
        setState(STATES.CRASH);
        const currentRun = runId;
        swapTimer = window.setTimeout(() => {
            if (currentRun === runId) swapToDamagedCar();
        }, reducedMotion.matches ? 80 : 360);
    }

    function swapToDamagedCar() {
        if (state !== STATES.CRASH) return;
        setState(STATES.CRASHED);
        const currentRun = runId;
        assistantTimer = window.setTimeout(() => {
            if (currentRun === runId) showLana();
        }, reducedMotion.matches ? 100 : 650);
    }

    function showLana() {
        if (state !== STATES.CRASHED) return;
        setState(STATES.ASSISTANT);
        assistant.hidden = false;
        assistant.classList.add('is-visible');
        const currentRun = runId;
        revealLanaStory(currentRun);
    }

    function ensureLana() {
        if (!lanaControllerPromise) {
            lanaControllerPromise = import('/js/ai-agent-lana.js')
                .then(module => module.createLanaStage(lanaStage, reducedMotion))
                .then(controller => {
                    lanaController = controller;
                    return controller;
                })
                .catch(() => null);
        }
        return lanaControllerPromise;
    }

    function wait(ms) {
        return new Promise(resolve => window.setTimeout(resolve, reducedMotion.matches ? Math.min(ms, 120) : ms));
    }

    function scrollChatToBottom(force = false, wasNearBottom = true) {
        if (!force && !wasNearBottom) return;
        requestAnimationFrame(() => messageHistory.scrollTo({
            top: messageHistory.scrollHeight,
            behavior: reducedMotion.matches ? 'auto' : 'smooth'
        }));
    }

    function createAvatar(sender) {
        const avatar = document.createElement('span');
        avatar.className = `ai-message-avatar${sender === 'nikolay' ? ' is-nikolay' : ''}`;
        avatar.setAttribute('aria-hidden', 'true');
        if (sender === 'lana' && lanaAvatar) {
            const image = document.createElement('img');
            image.src = lanaAvatar;
            image.alt = '';
            avatar.append(image);
        }
        return avatar;
    }

    function addChatMessage(message, forceScroll = false) {
        const wasNearBottom = messageHistory.scrollHeight - messageHistory.scrollTop - messageHistory.clientHeight < 80;
        const row = document.createElement('article');
        row.className = `ai-message-row${message.sender === 'nikolay' ? ' is-nikolay' : ''}`;
        row.dataset.sender = message.sender;
        row.dataset.type = message.type;

        const bubble = document.createElement('div');
        bubble.className = `ai-message-bubble${message.type === 'video' ? ' ai-message-video' : ''}`;
        if (message.type === 'video') {
            const player = document.createElement('video');
            player.controls = true;
            player.preload = 'metadata';
            player.playsInline = true;
            const source = document.createElement('source');
            source.src = message.src;
            source.type = 'video/mp4';
            player.append(source);
            bubble.append(player);
        } else {
            const text = document.createElement('span');
            text.textContent = message.text;
            bubble.append(text);
        }
        const time = document.createElement('time');
        time.className = 'ai-message-time';
        time.textContent = message.time;
        bubble.append(time);

        const avatar = createAvatar(message.sender);
        row.append(avatar, bubble);
        messageHistory.append(row);
        if (message.reaction) lanaController?.react(message.reaction);
        scrollChatToBottom(forceScroll, wasNearBottom);
        return row;
    }

    async function revealLanaStory(currentRun) {
        const controller = await ensureLana();
        if (currentRun !== runId || state !== STATES.ASSISTANT) return;
        if (controller) {
            controller.setActive(true);
            lanaAvatar = controller.getAvatarDataUrl();
            lanaStatus.hidden = true;
        } else {
            lanaStatus.textContent = '3D-модель недоступна. Лана на связи.';
        }
        assistant.scrollIntoView({behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'nearest'});

        for (const message of STORY_MESSAGES) {
            await wait(message.delay);
            if (currentRun !== runId || state !== STATES.ASSISTANT) return;
            addChatMessage(message, true);
        }
    }

    function startDrive() {
        if (state !== STATES.INITIAL) return;

        const currentRun = ++runId;
        startButton.disabled = true;
        actionBar.hidden = true;
        setState(STATES.RUNNING);

        const distance = Math.max(0, wall.getBoundingClientRect().left - car.getBoundingClientRect().right + 2);
        const duration = reducedMotion.matches ? 120 : 3200;
        car.style.setProperty('--drive-duration', `${duration}ms`);
        car.classList.add('is-driving');

        if (!reducedMotion.matches) {
            spawnExhaustSmoke();
            exhaustTimer = window.setInterval(spawnExhaustSmoke, 370);
        }

        // Two frames let the browser paint the starting position before the transition.
        requestAnimationFrame(() => requestAnimationFrame(() => {
            if (currentRun === runId) car.style.transform = `translate3d(${distance}px, 0, 0)`;
        }));
        crashFallback = window.setTimeout(() => {
            if (currentRun === runId) handleCrash();
        }, duration + 250);
    }

    function restartDrive() {
        ++runId;
        window.clearTimeout(crashFallback);
        window.clearTimeout(swapTimer);
        window.clearTimeout(assistantTimer);
        window.clearTimeout(toastTimer);
        stopExhaustSmoke();

        messageHistory.querySelectorAll('video').forEach(player => {
            player.pause();
            player.currentTime = 0;
        });
        lanaController?.setActive(false);
        assistant.hidden = true;
        assistant.classList.remove('is-visible');
        lanaStatus.hidden = false;
        lanaStatus.textContent = 'Лана подключается...';
        messageHistory.replaceChildren();
        chatText.value = '';
        toast.hidden = true;
        startButton.disabled = false;
        actionBar.hidden = false;

        setState(STATES.INITIAL);
        car.classList.remove('is-driving');
        car.style.transition = 'none';
        car.style.transform = 'translate3d(0, 0, 0)';
        void car.offsetWidth;
        car.style.removeProperty('transition');

        const currentRun = runId;
        requestAnimationFrame(() => {
            if (currentRun === runId) startDrive();
        });
    }

    function currentTime() {
        return new Intl.DateTimeFormat('ru-RU', {hour: '2-digit', minute: '2-digit'}).format(new Date());
    }

    function sendChatMessage() {
        const text = chatText.value.trim();
        if (!text || state !== STATES.ASSISTANT) return;
        addChatMessage({sender: 'nikolay', type: 'text', text, time: currentTime()}, true);
        chatText.value = '';
        chatText.style.height = '';
        chatText.focus();
    }

    function initScene() {
        // The damaged body uses the same 3:1 image box as the intact body.
        const damagedCar = new Image();
        damagedCar.src = document.querySelector('.ai-car-damaged').src;

        car.addEventListener('transitionend', event => {
            if (event.target === car && event.propertyName === 'transform' &&
                Math.abs(car.getBoundingClientRect().right - wall.getBoundingClientRect().left) < 6) {
                handleCrash();
            }
        });
        startButton.addEventListener('click', startDrive);
        refreshButton.addEventListener('click', restartDrive);
        chatForm.addEventListener('submit', event => {
            event.preventDefault();
            sendChatMessage();
        });
        chatText.addEventListener('keydown', event => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendChatMessage();
            }
        });
        chatText.addEventListener('input', () => {
            chatText.style.height = 'auto';
            chatText.style.height = `${Math.min(chatText.scrollHeight, 96)}px`;
        });
        window.addEventListener('pagehide', () => lanaController?.dispose());
        ensureLana();
    }

    initScene();
})();
