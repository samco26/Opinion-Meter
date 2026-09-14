// Local-only visual/integration fixture. Never included in extension builds.
import { build } from "esbuild";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve("..");
const bundles = new Map();
let report = {};
const fixture = {
  key: "test", subject: "Cadbury chocolate", kind: "product", category: "product",
  summary: "TEST FIXTURE: smooth and familiar, with a sweetness that divides tastes.",
  sentiment: { positive: 65, neutral: 20, negative: 15 }, verdict: "positive",
  agreement: "moderate", confidence: { level: "medium", reason: "Synthetic fixture for interface verification." },
  positives: [], negatives: [], updatedAt: new Date().toISOString(),
  opinions: [{ id: "one", sentence: "TEST: the familiar creamy taste is the draw.", sentiment: "positive", evidenceIds: ["hn:1"], support: 8 }],
  sources: [{ source: "hn", availability: "ok", itemsAnalysed: 20, relevant: 20, note: "Synthetic UI fixture." }],
  bySource: [{ source: "hn", sentiment: { positive: 65, neutral: 20, negative: 15 }, threads: [{ id: "hn:1", title: "TEST reference — not a real opinion", kind: "thread", url: "https://news.ycombinator.com", comments: [{ id: "c1", text: "Synthetic excerpt used to test rendering.", sentiment: "positive" }] }] }],
};
const shim = `
window.fixtureRequests = [];
const gauge = {key:"test",name:"Cadbury chocolate",kind:"product",category:"product",split:{positive:65,neutral:20,negative:15},count:20,verdict:"positive",sentence:"Synthetic fixture",confidence:"medium",sources:[],updatedAt:new Date().toISOString()};
window.chrome = {runtime:{sendMessage(message,callback){
 window.fixtureRequests.push(message);
 if(message.type==="config") callback({server:location.origin,config:{enabled:true,ttlMinutes:60,pollMs:100,polls:2,google:{enabled:true,queryBar:true,results:"#search",anchor:"a[href]:has(h3)",ads:"#tads",maxResults:12}}});
 if(message.type==="gauge") callback({query:{key:"test"},results:message.request.results.map(r=>({url:r.url,key:r.url})),subjects:Object.fromEntries([["test",{state:"ready",gauge}],...message.request.results.map(r=>[r.url,{state:"ready",gauge:{...gauge,key:r.url,name:new URL(r.url).hostname,scope:"domain",domain:new URL(r.url).hostname,targetUrl:r.url}}])])});
}}};
`;
bundles.set("/hands.js", (await build({ entryPoints: ["src/content.ts"], bundle: true, write: false, format: "iife", banner: { js: shim } })).outputFiles[0].contents);
const embedEntry = `
import React from ${JSON.stringify(resolve(root,"server/node_modules/react/index.js"))};
import {createRoot} from ${JSON.stringify(resolve(root,"server/node_modules/react-dom/client.js"))};
import {Embed} from ${JSON.stringify(resolve(root,"server/src/components/Embed.tsx"))};
const realFetch=window.fetch.bind(window);
window.fetch=(url,init)=>{ if(String(url).startsWith("/api/card")) {realFetch("/report",{method:"POST",body:JSON.stringify({cardFetch:true})});return Promise.resolve(new Response(JSON.stringify({kind:"card",card:${JSON.stringify(fixture)}})));} return realFetch(url,init); };
createRoot(document.getElementById("root")).render(React.createElement(Embed,{subjectKey:"test"}));
`;
bundles.set("/embed.js", (await build({ stdin: { contents: embedEntry, resolveDir: root, loader: "tsx" }, bundle: true, write: false, format: "iife", jsx: "automatic", alias: { "@": resolve(root,"server/src") }, tsconfig: resolve(root,"server/tsconfig.json"), define: { "process.env.NODE_ENV": '"production"' } })).outputFiles[0].contents);
const page = `<!doctype html><html><head><title>Opinion Meter — synthetic browser checks</title><style>
body{font:16px Arial;background:#202124;color:#e8eaed;margin:40px}header{color:#ffda90;margin-bottom:30px}.grid{display:grid;grid-template-columns:minmax(420px,700px) 240px;gap:24px}a{color:#8ab4f8}h3{font-size:22px;font-weight:400}article{margin:24px 0}.products{display:flex;gap:20px}.product{width:150px;border:1px solid #777;border-radius:20px;padding:20px}.source-card{border:1px solid #777;border-radius:22px;padding:20px}#checks{background:#111;padding:12px}button{cursor:pointer}
</style></head><body><header>LOCAL TEST FIXTURE — ALL SENTIMENT DATA IS SYNTHETIC</header><p id="checks">Checking…</p>
<div id="search" class="grid"><main><section data-mcpr><h2>AI Overview</h2><p>Fixture of a Google results page. Open any sentiment bar to verify the condensed glass drawer.</p></section>
<div id="tads"><a href="https://www.google.com/aclk?adurl=https%3A%2F%2Fpaid.example%2Fcadbury"><h3>Sponsored Cadbury shop</h3></a></div>
<article><a href="https://cadbury.example/products"><h3>Cadbury chocolate</h3></a><p>Main organic result</p></article>
<article><a href="https://cadbury.example/products"><h3>Repeated destination, independent placement</h3></a></article>
<h2>Popular products</h2><div class="products"><div><div class="product" data-product-id="a"><a href="https://shop.example/dairy"><img alt="Dairy Milk"><h3>Dairy Milk</h3></a></div></div><div><div class="product" data-product-id="b"><a href="https://shop.example/dark"><h3>Dark chocolate</h3></a></div></div></div>
<nav><a href="https://noise.example"><h3>Navigation — must not receive a bar</h3></a></nav>
<button id="more">Add result after page load</button>
</main><aside id="rhs"><div class="source-card"><a href="https://coles.example/shop">Coles · Shop Cadbury Products</a></div></aside></div>
<script src="/hands.js"></script><script>
document.getElementById("more").onclick=()=>{const a=document.createElement("a");a.href="https://later.example";a.innerHTML="<h3>Later result</h3>";document.querySelector("main").append(a);};
setTimeout(()=>{
const counts={results:document.querySelectorAll('[data-opinion-meter="result"]').length,query:document.querySelectorAll('[data-opinion-meter="query"]').length,side:document.querySelector("#rhs")?.firstElementChild?.getAttribute("data-opinion-meter")==="query",lazy:document.querySelectorAll("iframe").length===0,batches:window.fixtureRequests.filter(x=>x.type==="gauge").length};
const pass=counts.results===6&&counts.query===1&&counts.side&&counts.lazy;
document.getElementById("checks").textContent=(pass?"PASS":"FAIL")+" initial checks "+JSON.stringify(counts);
fetch("/report",{method:"POST",body:JSON.stringify({initial:counts,pass})});
},1500);
</script></body></html>`;
createServer(async (req,res) => {
  const path = new URL(req.url,"http://localhost").pathname;
  if(path==="/report"){if(req.method==="POST"){let body="";for await(const part of req)body+=part;Object.assign(report,JSON.parse(body));}res.setHeader("Content-Type","application/json");res.end(JSON.stringify(report));return;}
  if(bundles.has(path)){res.setHeader("Content-Type","text/javascript");res.end(bundles.get(path));return;}
  if(path==="/styles.css"){res.setHeader("Content-Type","text/css");res.end(readFileSync(resolve(root,"server/src/app/globals.css")));return;}
  res.setHeader("Content-Type","text/html; charset=utf-8");
  res.end(path==="/embed" ? '<!doctype html><html><head><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script src="/embed.js"></script></body></html>' : page);
}).listen(4318,"127.0.0.1",()=>console.log("Synthetic preview http://127.0.0.1:4318/?q=Cadbury"));
