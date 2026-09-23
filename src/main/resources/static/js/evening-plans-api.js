(() => {
    'use strict';
    const baseUrl = (document.querySelector('meta[name="evening-plans-base-url"]')?.content || '').trim().replace(/\/+$/, '');
    const mockUrl = document.querySelector('meta[name="evening-plans-mock-url"]')?.content;

    window.eveningPlansApi = {
        async findPlans(payload) {
            if (!mockUrl && !baseUrl) {
                throw new Error('Сейчас не получилось загрузить идеи для вечера. Попробуйте еще раз чуть позже.');
            }
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 45000);
            try {
                const response = await fetch(mockUrl || `${baseUrl}/api/evening-plans`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
                    body: JSON.stringify(payload),
                    signal: controller.signal,
                    credentials: 'omit'
                });
                if (!response.ok) {
                    throw new Error(response.status >= 500
                        ? 'Не удалось подобрать варианты вечера. Попробуйте еще раз чуть позже.'
                        : 'Не удалось получить варианты вечера. Проверьте параметры и попробуйте снова.');
                }
                let data;
                try { data = await response.json(); }
                catch (_) { throw new Error('Сейчас не получилось загрузить идеи для вечера. Попробуйте еще раз.'); }
                if (!data || !Array.isArray(data.plans) || data.plans.some(plan =>
                    !plan || typeof plan.title !== 'string' || !plan.title.trim() ||
                    (plan.items != null && (!Array.isArray(plan.items) || plan.items.some(item => !item || typeof item !== 'object'))))) {
                    throw new Error('Сейчас не получилось загрузить идеи для вечера. Попробуйте еще раз.');
                }
                return data;
            } catch (error) {
                if (error.name === 'AbortError' || error.name === 'NetworkError' || error instanceof TypeError) {
                    throw new Error('Сейчас не получилось загрузить идеи для вечера. Попробуйте еще раз чуть позже.');
                }
                throw error;
            } finally {
                clearTimeout(timeout);
            }
        }
    };
})();
