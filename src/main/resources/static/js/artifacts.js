(() => {
    const cards = Array.from(document.querySelectorAll('[data-artifact-target]'));
    const details = Array.from(document.querySelectorAll('.artifact-detail'));

    if (!cards.length || !details.length || typeof bootstrap === 'undefined') {
        return;
    }

    const cardFor = detail => cards.find(card => card.dataset.artifactTarget === `#${detail.id}`);
    const collapseFor = detail => bootstrap.Collapse.getOrCreateInstance(detail, {toggle: false});
    let pendingDetail = null;

    const setCardActive = (detail, active) => {
        const card = cardFor(detail);
        if (!card) return;
        card.classList.toggle('active', active);
        card.setAttribute('aria-expanded', String(active));
    };

    const openDetail = detail => {
        pendingDetail = null;
        collapseFor(detail).show();
    };

    const toggleDetail = detail => {
        const openOrOpening = details.find(item =>
            item !== detail && (item.classList.contains('show') || item.classList.contains('collapsing'))
        );

        if (detail.classList.contains('show') || detail.classList.contains('collapsing')) {
            pendingDetail = null;
            collapseFor(detail).hide();
            return;
        }

        if (openOrOpening) {
            pendingDetail = detail;
            collapseFor(openOrOpening).hide();
            return;
        }

        openDetail(detail);
    };

    cards.forEach(card => {
        const detail = document.querySelector(card.dataset.artifactTarget);
        if (!detail) return;

        card.addEventListener('click', () => toggleDetail(detail));
        card.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            toggleDetail(detail);
        });
    });

    details.forEach(detail => {
        detail.addEventListener('show.bs.collapse', () => setCardActive(detail, true));
        detail.addEventListener('hide.bs.collapse', () => setCardActive(detail, false));
        detail.addEventListener('hidden.bs.collapse', () => {
            if (pendingDetail) openDetail(pendingDetail);
        });
        detail.addEventListener('shown.bs.collapse', () => {
            detail.scrollIntoView({behavior: 'smooth', block: 'start'});
        });
    });
})();
