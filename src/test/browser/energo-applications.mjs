// Browser regression fixtures only. Start app :8096 and Chrome --remote-debugging-port=9233.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const app = process.env.APP_URL || 'http://127.0.0.1:8096';
const tabs = await (await fetch(process.env.CHROME_URL || 'http://127.0.0.1:9233/json')).json();
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open',r,{once:true}));
let seq = 0, taskStatus = 'CREATED', failRegistry = false;
const pending = new Map(), requests = [], errors = [];
const task = () => ({applicationId:'APP-1',applicationNumber:'A-1',subject:'Перерасчет начислений',description:'Полный текст обращения',status:taskStatus,createdAt:'2026-10-07T12:45:00+03:00',clientId:'CL-1',fullName:'Иванов Иван',personalAccount:'123',files:[{filename:'receipt.pdf',file:{guid:'FILE-1'}}],result:taskStatus === 'PROCESSED' ? 'Перерасчет выполнен' : null});
function cmd(method,params={}) { const id = ++seq; return new Promise((resolve,reject) => { pending.set(id,{resolve,reject}); ws.send(JSON.stringify({id,method,params})); }); }
ws.addEventListener('message',async e => {
    const m = JSON.parse(e.data);
    if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text);
    if (m.method !== 'Fetch.requestPaused') return;
    const {requestId,request} = m.params; requests.push(request);
    const path = new URL(request.url).pathname.split('/applications')[1]; let body, code = 200;
    if (path === '/clients') body = [{clientId:'CL-1',fullName:'Иванов Иван',personalAccount:'123456790'},{clientId:'CL-2',fullName:'Сидоров Петр',personalAccount:'123456791'},{clientId:'CL-3',fullName:'Клиент без счета'}];
    else if (path === '/employees') body = [{employeeId:'EMP-1',fullName:'Петров Алексей',position:'Операционист'}];
    else if (path.startsWith('/personal-account/')) body = {clientId:path.split('/').at(-1),personalAccount:path.endsWith('CL-1') ? '123' : '456'};
    else if (path.startsWith('/client/') || path.startsWith('/employee/')) { body = path.endsWith('CL-2') ? [] : [task()]; if (failRegistry) code = 502; }
    else if (path === '/APP-1') body = task();
    else if (request.method === 'PUT') { const data = request.postData || ''; taskStatus = data.includes('PROCESSED') ? 'PROCESSED' : data.includes('REJECTED') ? 'REJECTED' : 'APPROVED'; body = task(); }
    else if (request.method === 'POST') body = task();
    else body = {};
    await cmd('Fetch.fulfillRequest',{requestId,responseCode:code,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});
});
async function ev(expression) { const r = await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true}); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; }
async function wait(expression) { for(let i=0;i<100;i++) { if(await ev(expression)) return; await new Promise(r=>setTimeout(r,100)); } throw Error(expression); }
const click = id => ev(`document.getElementById('${id}').click()`);
async function choose(id,index=0) { await ev(`document.getElementById('${id}Input').focus(); document.getElementById('${id}Input').click()`); await ev(`document.querySelectorAll('#${id}Options [role=option]')[${index}].click()`); }
try {
    await cmd('Runtime.enable'); await cmd('Page.enable'); await cmd('Fetch.enable',{patterns:[{urlPattern:'*/api/integration/applications*'}]});
    await cmd('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
    await cmd('Page.navigate',{url:app+'/section/energo-applications'});
    await wait('document.getElementById("employeePickerInput") && !document.getElementById("employeePickerInput").disabled');
    assert.equal(await ev('document.getElementById("createApplication").disabled'),true);
    await choose('employeePicker');
    assert.equal(requests.filter(r=>r.url.includes('/employee/')).length,0,'Employee selection must not fetch registry');
    await click('confirmEmployee'); await wait('document.querySelectorAll("#employeeRegistry button").length === 1');
    assert.match(await ev('document.getElementById("employeeRegistry").textContent'),/Новое/);
    await choose('clientPicker'); await wait('document.getElementById("clientInfo").textContent.includes("123456790") && document.querySelectorAll("#clientRegistry button").length === 1');
    assert.match(await ev('document.getElementById("clientRegistry").textContent'),/Создано/);
    await click('createApplication');
    await ev(`document.querySelector('#createForm [name=subject]').value='Новая тема'; const t=document.querySelector('#createForm textarea'); t.value='Новый текст'; t.dispatchEvent(new Event('input')); document.getElementById('createForm').requestSubmit()`);
    await wait('!document.getElementById("createDialog").open');
    const post = requests.find(r=>r.method==='POST'); assert.ok(post); assert.match(post.postData,/name="clientId"/); assert.match(post.postData,/name="personalAccount"/); assert.match(post.postData,/123456790/); assert.match(post.postData,/name="subject"/); assert.match(post.postData,/name="description"/); assert.doesNotMatch(post.postData,/name="data"|filename=|application\/json/); assert.match(post.postData,/Новая тема/);
    await ev('document.querySelector("#employeeRegistry button").click()'); await wait('document.querySelectorAll("#detailActions button").length === 3');
    await ev('document.querySelectorAll("#detailActions button")[2].click()');
    assert.equal(await ev('document.querySelector("#actionForm textarea").required'),true);
    await ev('document.querySelector("#actionForm textarea").value="Перерасчет выполнен"; document.getElementById("actionForm").requestSubmit()');
    await wait('!document.getElementById("actionDialog").open && document.getElementById("detailBody").textContent.includes("Обработано")');
    await wait('document.getElementById("clientRegistry").textContent.includes("Обработано") && document.getElementById("employeeRegistry").textContent.includes("Обработано")');
    const put = requests.find(r=>r.method==='PUT'); assert.ok(put);
    for (const name of ['applicationId','employeeId','status','result']) assert.ok(put.postData.includes(`name="${name}"`));
    assert.match(put.postData,/Перерасчет выполнен/);
    assert.doesNotMatch(put.postData,/name="data"|name="reason"|filename=|application\/json/);
    await ev('document.getElementById("detailDialog").close()');
    await choose('clientPicker',1); await wait('document.getElementById("clientState").textContent.includes("пока нет")');
    failRegistry = true; await click('clientRefresh'); await wait('document.getElementById("clientState").textContent.includes("Не удалось")');
    failRegistry = false;
    const postsBefore = requests.filter(r => r.method === 'POST').length;
    await choose('clientPicker',2);
    assert.match(await ev('document.getElementById("clientInfo").textContent'),/Лицевой счет не указан/);
    assert.equal(await ev('document.getElementById("createApplication").disabled'),true);
    await click('createApplication');
    assert.equal(await ev('document.getElementById("createDialog").open'),false);
    assert.equal(requests.filter(r => r.method === 'POST').length,postsBefore);
    assert.equal(await ev('document.querySelectorAll("#clientInfo button").length'),0);
    await choose('clientPicker',0); await wait('document.querySelectorAll("#clientRegistry button").length === 1');
    if (process.env.SCREENSHOT_DIR) { const s = await cmd('Page.captureScreenshot',{format:'png'}); await writeFile(process.env.SCREENSHOT_DIR+'/energo-applications-desktop.png',Buffer.from(s.data,'base64')); }
    await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
    await wait('document.documentElement.scrollWidth <= window.innerWidth');
    if (process.env.SCREENSHOT_DIR) { const s = await cmd('Page.captureScreenshot',{format:'png'}); await writeFile(process.env.SCREENSHOT_DIR+'/energo-applications-mobile.png',Buffer.from(s.data,'base64')); }
    assert.equal(requests.filter(r => r.url.includes('/personal-account/')).length,0,'Client UI must not request account details');
    assert.deepEqual(errors,[]); console.log('PASS: confirmation gating, selection, account, registries, multipart create/process, refreshed status, empty/error, mobile overflow');
} finally { await cmd('Fetch.disable'); ws.close(); }
