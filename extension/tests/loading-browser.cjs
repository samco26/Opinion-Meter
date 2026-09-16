/* Browser regression check. Synthetic readings only. Run after building; uses an existing Playwright installation. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs');const assert=require('assert/strict');
(async()=>{
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const result=i=>`<div class="g"><a href="https://example${i}.com/"><div><div><span>Example ${i}</span></div><div><cite>https://example${i}.com</cite></div></div><h3>Example result ${i}</h3></a></div>`;
await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:`<style>body{background:#202124;color:white;font:14px Arial;margin:80px}#search{width:650px}.g{margin:25px 0}a{color:inherit;text-decoration:none}cite{font-size:12px}#rhs{position:absolute;left:850px;top:100px}</style><div id="searchform">SYNTHETIC UI TEST — no real opinions</div><div id="search"><div id="rso">${Array.from({length:25},(_,i)=>result(i)).join('')}</div></div><div id="rhs"><div data-attrid="title">YouTube</div></div>`}));
await page.goto('https://www.google.com/search?q=youtube');
await page.evaluate(()=>{
 const config={enabled:true,ttlMinutes:60,pollMs:8000,polls:4,google:{enabled:true,queryBar:true,results:'#rso, #search',maxResults:12}};
 window.requests=[];window.chrome={runtime:{sendMessage:(m,cb)=>{if(m.type==='config')cb({server:'https://synthetic.example',config});else if(m.type==='gauge')window.requests.push({m,cb});}},storage:{local:{get:(key,cb)=>cb({})}}};
});
await page.addScriptTag({content:fs.readFileSync(require('path').join(__dirname,'../dist/chrome/content.js'),'utf8')});
await page.waitForTimeout(700);
assert.equal(await page.locator('[data-opinion-meter="result"]').count(),25);
assert.equal(await page.locator('.seg.wait').count(),26);
assert.equal(await page.locator('[data-opinion-meter="query"]').evaluate(el=>el.parentElement.id),'search');
await page.locator('#rso').evaluate((el,html)=>el.insertAdjacentHTML('beforeend',html),result(26));
await page.waitForTimeout(700);assert.equal(await page.locator('[data-opinion-meter="result"]').count(),26);
assert.equal(await page.evaluate(()=>requests.length),1);
await page.evaluate(()=>{const {m,cb}=requests.shift();const gauge={key:'test',name:'YouTube',count:66,split:{positive:36,neutral:1,negative:63},verdict:'negative',sentence:'SYNTHETIC SUMMARY — A long explanation that should wrap naturally and never crowd the platform controls or the opinion count. '.repeat(3),confidence:'medium',sources:[]};cb({query:{key:'test'},results:m.request.results.map(r=>({...r,key:'test'})),subjects:{test:{state:'ready',gauge}}});});
await page.waitForTimeout(700);
await page.locator('[data-opinion-meter="result"]').first().locator('.head').hover();await page.waitForTimeout(500);
const card=page.locator('[data-opinion-meter="result"]').first();
assert(await card.locator('.meta').isVisible());
const fits=await card.evaluate(el=>{const r=el.shadowRoot;return ['.summary','.actions','.meta'].every(s=>{const e=r.querySelector(s);return e.scrollWidth<=e.clientWidth+1;});});assert(fits);
if (process.env.UI_SCREENSHOT) await page.screenshot({path:process.env.UI_SCREENSHOT});
assert.deepEqual(errors,[]);console.log('PASS: 25 initial loading bars, streamed result before response, top query with knowledge panel, expanded layout, no browser errors.');await page.reload();
await page.evaluate(()=>{window.chrome={runtime:{sendMessage:(m,cb)=>cb({server:'https://synthetic.example',config:{enabled:false,google:{enabled:true}}})},storage:{local:{get:(key,cb)=>cb({})}}};});
await page.addScriptTag({content:fs.readFileSync(require('path').join(__dirname,'../dist/chrome/content.js'),'utf8')});
await page.waitForTimeout(400);
assert.equal(await page.locator('[data-opinion-meter]').count(),0,'kill switch draws nothing');
console.log('PASS: kill switch draws nothing.');
await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
