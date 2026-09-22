(() => {
    'use strict';

    const meta = document.querySelector('meta[name="ai-agent-api-url"]');
    const baseUrl = (meta?.content || '').replace(/\/$/, '');

    async function request(path, options = {}) {
        const response = await fetch(`${baseUrl}${path}`, {
            ...options,
            headers: {'Content-Type': 'application/json', ...(options.headers || {})}
        });
        let body = null;
        try { body = await response.json(); } catch (_) { /* empty error body */ }
        if (!response.ok) {
            const error = new Error(body?.message || `Запрос завершился с ошибкой (${response.status})`);
            error.status = response.status;
            throw error;
        }
        return body || {};
    }

    // The process endpoints are backend/document-service contracts;
    // this adapter never calls Camunda directly.
    window.aiAgentApi = {
        chat(message, sessionId) {
            const payload = {message};
            if (sessionId) payload.sessionId = sessionId;
            return request('/api/v1/agent/chat', {method: 'POST', body: JSON.stringify(payload)});
        },
        getProcessStatus(processInstanceKey) {
            return request(`/api/v1/processes/${encodeURIComponent(processInstanceKey)}/status`);
        },
        completeTask(taskId, payload) {
            return request(`/api/v1/tasks/${encodeURIComponent(taskId)}/complete`, {
                method: 'POST', body: JSON.stringify(payload)
            });
        }
    };
})();
