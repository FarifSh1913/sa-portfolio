// Standalone Chrome DevTools regression check; no npm dependencies.
// Run a local app and headless Chrome with remote debugging before this script.
import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
const app = process.env.APP_URL || 'http://127.0.0.1:8098';
const devtools = process.env.CHROME_URL || 'http://127.0.0.1:9235';
const css = process.env.BOOTSTRAP_CSS ? await readFile(process.env.BOOTSTRAP_CSS) : null;
const tabs = await (await fetch(`${devtools}/json`)).json();
const ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open',resolve,{once:true}));
let nextId = 0;
const pending = new Map(), exceptions = [], outgoing = [];
let mode = 'success';
const crm = [{clientId:'CL-100245',personalAccount:'123456789',fullName:'Иванов Иван Иванович',address:'г. Москва, ул. Академика Семенова, д. 10, кв. 25',accountStatus:'ACTIVE'}];
const finance = [{clientId:'CL-100245',personalAccount:'123456789',fullName:'Иванов Иван Иванович',period:'2026-09',currentCharges:4150.2,debtAmount:3250.4,overpaymentAmount:0,paymentStatus:'DEBT',lastPaymentAmount:4000,lastPaymentDate:'2026-09-18'}];
function command(method,params={}) {
    const id = ++nextId;
    return new Promise((resolve,reject) => { pending.set(id,{resolve,reject}); ws.send(JSON.stringify({id,method,params})); });
}
const delay = ms => new Promise(resolve => setTimeout(resolve,ms));
ws.addEventListener('message',async event => {
    const message = JSON.parse(event.data);
    if (message.id) {
        const promise = pending.get(message.id); pending.delete(message.id);
        if (message.error) promise.reject(message.error); else promise.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text);
    else if (message.method === 'Fetch.requestPaused') {
        const {requestId,request} = message.params;
        if (request.url.includes('cdn.jsdelivr.net') && css) {
            await command('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/css'}],body:css.toString('base64')}); return;
        }
        outgoing.push(request);
        let body = request.url.endsWith('/crm') ? crm : finance;
        let code = 200;
        if (mode === 'null') body = null;
        if (mode === 'object') body = {};
        if (mode === 'array') body = [];
        if (mode === 'invalid') body = [null];
        if (mode === 'finance-error' && request.url.endsWith('/finance') || mode === 'crm-error' && request.url.endsWith('/crm')) { code = 502; body = {message:'HTTP 500 stackTrace private error'}; }
        if (mode === 'slow') await delay(request.url.endsWith('/finance') ? 1200 : 500);
        if (request.url.endsWith('/evening-plans')) body = {plans:[],weather:{temperature:16,rain:false}};
        await command('Fetch.fulfillRequest',{requestId,responseCode:code,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});
    }
});
async function evaluate(expression) {
    const result = await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if (result.exceptionDetails) throw Error(result.exceptionDetails.text);
    return result.result.value;
}
async function wait(expression,attempts=100) {
    for (let i=0;i<attempts;i++) { if (await evaluate(expression)) return; await delay(100); }
    throw Error(`Timed out: ${expression}`);
}
async function resize(width,height) { await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false}); await delay(350); }
async function navigate(path='/section/energo') {
    await command('Page.navigate',{url:app+path}); await wait('document.readyState === "complete"'); await delay(300);
}
async function settled() { await wait('[...document.querySelectorAll(".energo-source")].every(x=>x.getAttribute("aria-busy")==="false")',450); }
async function screenshot(name) {
    if (!process.env.SCREENSHOT_DIR) return;
    await delay(400);
    const result = await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    await writeFile(`${process.env.SCREENSHOT_DIR}/${name}.png`,Buffer.from(result.data,'base64'));
}
const patterns = css ? [{urlPattern:'*cdn.jsdelivr.net*'}] : [];
try {
    await command('Runtime.enable'); await command('Page.enable');
    if (patterns.length) await command('Fetch.enable',{patterns});
    await resize(1440,1000); await navigate(); await settled();
    assert.equal(await evaluate('document.querySelectorAll("#crm .energo-record").length'),3);
    assert.equal(await evaluate('document.querySelectorAll("#finance .energo-record").length'),3);
    assert.equal(await evaluate('/Сетевая компания|ГИС ЖКХ|Запись 1/.test(document.body.innerText)'),false);
    assert.match(await evaluate('document.querySelector("#finance .energo-records").innerText'),/Переплата/);
    await evaluate('document.querySelector(".energo-sources").scrollIntoView({behavior:"instant"})'); await screenshot('energo-registries-desktop');
    await evaluate('document.querySelector("#crm .energo-record").click()');
    await wait('document.querySelector("dialog").open');
    assert.match(await evaluate('document.querySelector("dialog").innerText'),/Академика Семенова/);
    assert.equal(await evaluate('document.activeElement.className'),'energo-dialog-x');
    for (let i=0;i<4;i++) {
        await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
        await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
        assert.equal(await evaluate('document.querySelector("dialog").contains(document.activeElement)'),true);
    }
    await screenshot('energo-crm-modal');
    await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});
    await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});
    await wait('!document.querySelector("dialog").open');
    assert.equal(await evaluate('document.activeElement.className'),'energo-record');
    await evaluate('document.querySelectorAll("#finance .energo-record")[1].click()');
    assert.match(await evaluate('document.querySelector("dialog").innerText'),/Петров Петр Сергеевич/);
    assert.match(await evaluate('document.querySelector("dialog").innerText'),/3\s320,50/);
    assert.match(await evaluate('document.querySelector("dialog").innerText'),/24 сентября 2026/);
    await screenshot('energo-finance-modal');
    await evaluate('document.querySelector(".energo-dialog-x").click()');
    await evaluate('document.querySelector("#crm .energo-record").click()');
    await command('Input.dispatchMouseEvent',{type:'mousePressed',x:5,y:5,button:'left',clickCount:1});
    await command('Input.dispatchMouseEvent',{type:'mouseReleased',x:5,y:5,button:'left',clickCount:1});
    await wait('!document.querySelector("dialog").open');
    for (const width of [800,390,320]) {
        await resize(width,844);
        assert.equal(await evaluate('document.documentElement.scrollWidth > innerWidth'),false);
        await evaluate('document.querySelector("#finance .energo-record").click()');
        assert.equal(await evaluate('document.querySelector("dialog").scrollWidth > document.querySelector("dialog").clientWidth'),false);
        if (width === 390) await screenshot('energo-finance-modal-mobile');
        await evaluate('document.querySelector("#energoDialogClose").click()');
    }
    await resize(390,844); await evaluate('document.querySelector("#crm").scrollIntoView({behavior:"instant"})'); await screenshot('energo-registries-mobile');
    await resize(1440,1000);
    await evaluate('document.querySelector("#accountForm").requestSubmit()');
    await wait('document.querySelectorAll("#accountResult .energo-card").length===2',450);
    assert.match(await evaluate('document.querySelector("#accountResult").innerText'),/Иванов Иван Иванович/);
    await evaluate('document.querySelector("#accountForm").elements.clientId.value="CL-100246"; document.querySelector("#accountForm").elements.personalAccount.value="123456790"; document.querySelector("#accountForm").requestSubmit()');
    await wait('!document.querySelector("#accountRetry").hidden',450);
    assert.equal(await evaluate('document.querySelector("#accountResult").children.length'),0);
    assert.match(await evaluate('document.querySelector("#accountState").innerText'),/подтвердить данные/);
    console.log('PASS real Integra: 3+3 records, CRM/finance modals, real summary, mismatched summary blocked.');
    await command('Fetch.enable',{patterns:[...patterns,{urlPattern:'*/api/integration/*'}]});
    mode = 'slow'; await navigate();
    assert.equal(await evaluate('document.querySelector("#finance .energo-skeleton").hidden'),false);
    await wait('document.querySelector("#crm").dataset.state === "success"');
    assert.equal(await evaluate('document.querySelector("#finance").dataset.state'),'loading');
    await settled();
    for (const failure of ['finance-error','crm-error']) {
        mode = failure; await navigate(); await settled();
        const failed = failure.split('-')[0], other = failed === 'finance' ? 'crm' : 'finance';
        assert.equal(await evaluate(`document.querySelector('#${failed}').dataset.state`),'error');
        assert.equal(await evaluate(`document.querySelector('#${other}').dataset.state`),'success');
        assert.equal(await evaluate('/HTTP|stackTrace|private error/.test(document.querySelector(".energo-sources").innerText)'),false);
        mode = 'success'; await evaluate(`document.querySelector('#${failed} .energo-retry').click()`); await settled();
        assert.equal(await evaluate(`document.querySelector('#${failed}').dataset.state`),'success');
    }
    for (const empty of ['null','object','array']) {
        mode = empty; await navigate(); await settled();
        assert.equal(await evaluate('document.querySelector("#crm .energo-state").innerText'),'Записи не найдены');
        assert.equal(await evaluate('document.querySelector("#finance .energo-state").innerText'),'Записи не найдены');
    }
    mode = 'invalid'; await navigate(); await settled();
    assert.equal(await evaluate('document.querySelector("#crm").dataset.state'),'error');
    mode = 'success'; await navigate('/section/evening-plans');
    await evaluate('document.querySelector("#eveningForm").requestSubmit()');
    await wait('!document.querySelector("#eveningResults").hidden');
    assert.match(await evaluate('document.querySelector("#eveningResults").innerText'),/Попробуем немного иначе/);
    for (const request of outgoing.filter(x=>/\/(crm|finance)$/.test(x.url))) { assert.equal(request.method,'GET'); assert.equal(request.postData,undefined); }
    assert.deepEqual(exceptions,[]);
    console.log('PASS states: skeleton, independence both directions, retry, null/{}/[], malformed response, safe errors; responsive/modal focus/Esc/backdrop/X/footer; evening-plans; no JS exceptions.');
} finally { ws.close(); }
