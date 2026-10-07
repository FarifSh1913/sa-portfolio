(() => {
    'use strict';
    const sidebar = document.querySelector('.sidebar');
    const button = sidebar.querySelector('.sidebar-toggle');
    const content = sidebar.querySelector('.sidebar-content');
    const desktop = matchMedia('(min-width: 721px)');
    let collapsed = false;
    try { collapsed = localStorage.getItem('portfolio.sidebar.collapsed') === 'true'; } catch (_) { /* storage is optional */ }
    function render() {
        const active = desktop.matches && collapsed;
        document.documentElement.classList.toggle('sidebar-collapsed', active);
        content.inert = active;
        button.setAttribute('aria-expanded', String(!active));
        button.title = button.ariaLabel = active ? 'Раскрыть меню' : 'Свернуть меню';
    }
    button.addEventListener('click', () => {
        collapsed = !collapsed;
        try { localStorage.setItem('portfolio.sidebar.collapsed', String(collapsed)); } catch (_) { /* storage is optional */ }
        render();
    });
    desktop.addEventListener('change', render);
    render();
})();
