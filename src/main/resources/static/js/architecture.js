(() => {
    const map = document.getElementById('systemMap');
    const packet = document.getElementById('dataPacket');
    const flowState = document.getElementById('flowState');
    const steps = Array.from(document.querySelectorAll('#journeyTimeline li'));
    if (!map || !packet) return;

    const components = {
        internet:{category:'ENTRY · LIVE',title:'Internet',role:'Публичная точка входа lordfarif.ru.',items:['DNS','Public access']},
        caddy:{category:'EDGE · LIVE',title:'Caddy',role:'Завершает HTTPS и проксирует запросы в web-контейнер.',items:['HTTPS','Reverse proxy','Docker']},
        web:{category:'WEB · LIVE',title:'Portfolio Web',role:'Точка входа в портфолио и интерактивный live-lab.',items:['Spring Boot 3','Thymeleaf','Bootstrap','Java 21']},
        static:{category:'UI · LIVE',title:'Portfolio modules',role:'Работающие пользовательские разделы проекта.',items:['Артефакты','Архитектура','Антистресс']},
        document:{category:'API · PLANNED',title:'Document Service',role:'Принимает команды, валидирует документы и управляет их состоянием.',items:['REST','OpenAPI','document.created']},
        database:{category:'DATABASE · PLANNED',title:'PostgreSQL',role:'Изолированные схемы или базы данных для сервисов.',items:['Documents','Audit','Service ownership']},
        kafka:{category:'BROKER · PLANNED',title:'Apache Kafka',role:'Асинхронное взаимодействие между сервисами.',items:['document.created','document.status.changed','document.approved','document.rejected']},
        workflow:{category:'WORKFLOW · PLANNED',title:'Workflow Service',role:'Адаптер между доменными событиями и процессным движком.',items:['Consumer','Correlation','Retries']},
        camunda:{category:'ENGINE · PLANNED',title:'Camunda',role:'Оркестрация процесса согласования документа.',items:['Document Approval','BPMN','Timers']},
        audit:{category:'CONSUMER · PLANNED',title:'Audit Service',role:'Сохраняет неизменяемую историю действий и статусов.',items:['Event log','Traceability','Compliance']},
        ai:{category:'AI · IN PROGRESS',title:'AI Agent',role:'Помощник для анализа требований и проектных артефактов.',items:['LLM','Review','Recommendations']}
    };
    const edgesByComponent = {
        internet:['edge-internet-caddy'],caddy:['edge-internet-caddy','edge-caddy-web'],web:['edge-caddy-web','edge-web-static','edge-web-document'],static:['edge-web-static'],document:['edge-web-document','edge-document-db','edge-document-kafka'],database:['edge-document-db','edge-audit-db'],kafka:['edge-document-kafka','edge-kafka-workflow','edge-camunda-kafka','edge-kafka-audit','edge-kafka-ai'],workflow:['edge-kafka-workflow','edge-workflow-camunda'],camunda:['edge-workflow-camunda','edge-camunda-kafka'],audit:['edge-kafka-audit','edge-audit-db'],ai:['edge-kafka-ai']
    };
    const flow = [
        ['edge-internet-caddy',0,'REQUEST · HTTPS'],['edge-caddy-web',0,'ROUTE · CADDY'],['edge-web-document',1,'POST · REST API'],['edge-document-db',2,'WRITE · POSTGRESQL'],['edge-document-kafka',3,'EVENT · document.created'],['edge-kafka-workflow',4,'CONSUME · WORKFLOW'],['edge-workflow-camunda',5,'PROCESS · CAMUNDA'],['edge-camunda-kafka',6,'EVENT · status.changed'],['edge-kafka-audit',7,'CONSUME · AUDIT']
    ];
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let flowGeneration = 0;

    const showDetail = key => {
        const data=components[key]; if(!data)return;
        document.getElementById('detailCategory').textContent=data.category;
        document.getElementById('detailTitle').textContent=data.title;
        document.getElementById('detailRole').textContent=data.role;
        const items=document.getElementById('detailItems'); items.replaceChildren(...data.items.map(text=>{const span=document.createElement('span');span.textContent=text;return span;}));
        document.querySelectorAll('.service-node').forEach(node=>node.classList.toggle('is-selected',node.dataset.component===key));
    };
    const related = (key,on) => (edgesByComponent[key]||[]).forEach(id=>document.getElementById(id)?.classList.toggle('is-related',on));
    document.querySelectorAll('.service-node').forEach(node=>{
        node.addEventListener('mouseenter',()=>related(node.dataset.component,true));
        node.addEventListener('mouseleave',()=>related(node.dataset.component,false));
        node.addEventListener('focus',()=>related(node.dataset.component,true));
        node.addEventListener('blur',()=>related(node.dataset.component,false));
        node.addEventListener('click',()=>showDetail(node.dataset.component));
    });

    const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
    async function animateEdge(id,step,label,generation){
        const path=document.getElementById(id); if(!path)return;
        path.classList.add('is-active'); steps.forEach((item,index)=>item.classList.toggle('is-active',index===step)); flowState.lastChild.textContent=label;
        packet.classList.add('is-moving');
        const length=path.getTotalLength(); const started=performance.now(); const duration=2400;
        await new Promise(resolve=>{const frame=now=>{const progress=Math.min((now-started)/duration,1);const point=path.getPointAtLength(length*progress);packet.setAttribute('cx',point.x);packet.setAttribute('cy',point.y);if(progress<1&&generation===flowGeneration)requestAnimationFrame(frame);else resolve();};requestAnimationFrame(frame);});
        path.classList.remove('is-active'); await delay(280);
    }
    async function runFlow(){
        const generation=++flowGeneration;
        if(reducedMotion){packet.classList.remove('is-moving');steps[0]?.classList.add('is-active');return;}
        while(generation===flowGeneration){for(const [id,step,label] of flow){if(generation!==flowGeneration)return;await animateEdge(id,step,label,generation);}packet.classList.remove('is-moving');await delay(2200);}
    }
    document.addEventListener('visibilitychange',()=>{if(document.hidden){flowGeneration++;packet.classList.remove('is-moving');}else{runFlow();}});
    showDetail('web'); runFlow();
})();
