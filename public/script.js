"use strict";(()=>{var ie=/^(\d+)\s+(.+?)(?:\s+\(|$)/,re="SIDEBOARD:";function E(t){let e={},n={},i=!1,r=t.split(`
`);for(let o of r){let a=o.trim();if(!a)continue;if(a.toUpperCase().startsWith(re)){i=!0;continue}let s=a.match(ie);if(s){let c=parseInt(s[1],10),l=s[2].trim(),m=i?n:e;m[l]=(m[l]||0)+c}}return{main:e,side:n}}function P(t){return t===void 0?"Unknown":t?t.includes("Land")?"Land":t.includes("Creature")?"Creature":t.includes("Planeswalker")?"Planeswalker":t.includes("Instant")?"Instant":t.includes("Sorcery")?"Sorcery":t.includes("Enchantment")?"Enchantment":t.includes("Artifact")?"Artifact":t.includes("Battle")?"Battle":"Other":"Other"}var $=["Land","Creature","Instant","Sorcery","Enchantment","Artifact","Planeswalker","Battle","Other","Unknown"];var p=class t{constructor(e,n){this.head=null;this.tail=null;this.capacity=e,this.cache=new Map,this.onSet=n}get(e){let n=this.cache.get(e);if(n)return this.moveToFront(n),n.value}set(e,n){let i=this.cache.get(e);if(i){i.value=n,this.moveToFront(i),this.onSet?.();return}this.cache.size>=this.capacity&&this.evictLRU();let r={key:e,value:n,prev:null,next:this.head};this.head&&(this.head.prev=r),this.head=r,this.tail||(this.tail=r),this.cache.set(e,r),this.onSet?.()}has(e){return this.cache.has(e)}delete(e){let n=this.cache.get(e);return n?(this.removeNode(n),this.cache.delete(e),this.onSet?.(),!0):!1}clear(){this.cache.clear(),this.head=null,this.tail=null,this.onSet?.()}get size(){return this.cache.size}serialize(){let e=[],n=this.head;for(;n;)e.push({key:n.key,value:n.value}),n=n.next;return{items:e,capacity:this.capacity}}static deserialize(e,n){let i=new t(e.capacity,n);for(let r=e.items.length-1;r>=0;r--){let o=e.items[r];i.set(o.key,o.value)}return i}keys(){let e=[],n=this.head;for(;n;)e.push(n.key),n=n.next;return e}moveToFront(e){e!==this.head&&(this.removeNode(e),e.next=this.head,e.prev=null,this.head&&(this.head.prev=e),this.head=e,this.tail||(this.tail=e))}removeNode(e){e.prev?e.prev.next=e.next:this.head=e.next,e.next?e.next.prev=e.prev:this.tail=e.prev}evictLRU(){if(!this.tail)return;let e=this.tail;this.removeNode(e),this.cache.delete(e.key)}};var ae="https://api.scryfall.com",oe=50,G=75,se=500,C="mtg-diff-card-cache",ce=1e3,T=class{constructor(e=se){this.lastRequestTime=0;this.pendingQueue=[];this.isProcessing=!1;this.saveTimer=null;this.capacity=e,this.cache=this.loadCache()}async fetchCards(e){let n=new Map,i=[];for(let o of e){let a=this.cache.get(o);a?n.set(o,a):i.push(o)}if(i.length===0)return n;let r=await this.queueFetchRequest(i);for(let[o,a]of r)n.set(o,a);return n}getCached(e){return this.cache.get(e)}isCached(e){return this.cache.has(e)}getCardType(e){let n=this.cache.get(e);return n?P(n.typeLine):"Unknown"}clearCache(){this.cache.clear(),this.removePersistedCache()}queueFetchRequest(e){return new Promise((n,i)=>{this.pendingQueue.push({names:e,resolve:n,reject:i}),this.processQueue()})}async processQueue(){if(!(this.isProcessing||this.pendingQueue.length===0)){for(this.isProcessing=!0;this.pendingQueue.length>0;){let e=this.pendingQueue.shift();try{let n=await this.executeBatchFetch(e.names);e.resolve(n)}catch(n){e.reject(n instanceof Error?n:new Error(String(n)))}}this.isProcessing=!1}}async executeBatchFetch(e){let n=new Map,i=[...new Set(e)],r=[];for(let o=0;o<i.length;o+=G)r.push(i.slice(o,o+G));for(let o of r){await this.enforceRateLimit();try{let a=await fetch(`${ae}/cards/collection`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({identifiers:o.map(c=>({name:c}))})});if(!a.ok)throw new Error(`Scryfall API error: ${a.status}`);let s=await a.json();if(s.data)for(let c of s.data){let l=this.parseCardResponse(c);n.set(c.name,l),this.cache.set(c.name,l)}if(s.not_found)for(let c of s.not_found){let l={name:c.name,manaCost:"",typeLine:"",cmc:0};n.set(c.name,l),this.cache.set(c.name,l)}}catch(a){console.error("Failed to fetch cards from Scryfall:",a);for(let s of o)n.set(s,{name:s,manaCost:"",typeLine:"",cmc:0})}}return n}parseCardResponse(e){let n=e.mana_cost||"",i=e.type_line||"",r=e.cmc||0;return!n&&e.card_faces&&e.card_faces.length>0&&(n=e.card_faces[0].mana_cost||""),!i&&e.card_faces&&e.card_faces.length>0&&(i=e.card_faces[0].type_line||""),{name:e.name,manaCost:n,typeLine:i,cmc:r}}async enforceRateLimit(){let n=Date.now()-this.lastRequestTime,i=oe-n;i>0&&await this.delay(i),this.lastRequestTime=Date.now()}delay(e){return new Promise(n=>setTimeout(n,e))}loadCache(){try{let e=localStorage.getItem(C);if(!e)return new p(this.capacity,()=>this.scheduleSave());let n=JSON.parse(e);return!n.items||!Array.isArray(n.items)?new p(this.capacity,()=>this.scheduleSave()):p.deserialize({...n,capacity:this.capacity},()=>this.scheduleSave())}catch(e){return console.warn("Failed to load card cache from localStorage:",e),new p(this.capacity,()=>this.scheduleSave())}}scheduleSave(){this.saveTimer!==null&&clearTimeout(this.saveTimer),this.saveTimer=window.setTimeout(()=>{this.saveTimer=null,this.persistCache()},ce)}persistCache(){try{let e=this.cache.serialize(),n=JSON.stringify(e);try{localStorage.setItem(C,n)}catch(i){if(i instanceof DOMException&&i.name==="QuotaExceededError")this.evictAndRetry();else throw i}}catch(e){console.warn("Failed to persist card cache to localStorage:",e)}}evictAndRetry(){let e=Math.floor(this.capacity/2);for(;this.cache.size>e;)this.cache.delete(this.cache.keys().pop());try{let n=this.cache.serialize();localStorage.setItem(C,JSON.stringify(n))}catch{this.removePersistedCache()}}removePersistedCache(){try{localStorage.removeItem(C)}catch{}}},u=new T;function H(t,e){let n=[],i=[],r=[];for(let[o,a]of Object.entries(t)){let s=e[o]||0;a>s&&n.push({name:o,count:a-s})}for(let[o,a]of Object.entries(e)){let s=t[o]||0;a>s?i.push({name:o,count:a-s}):a===s&&a>0&&r.push({name:o,count:a})}return{cuts:n,adds:i,unchanged:r}}function O(t,e){return{mainDiff:H(t.main,e.main),sideDiff:H(t.side,e.side)}}function M(t){return[...t].sort((e,n)=>e.name.localeCompare(n.name))}function de(t){let e={};for(let n of t){let i=u.getCardType(n.name);e[i]||(e[i]=[]),e[i].push(n)}return $.filter(n=>e[n]).map(n=>({label:n,items:M(e[n])}))}function le(t){let e={};for(let i of t){let r=u.getCached(i.name),a=(r?Math.round(r.cmc):0).toString();e[a]||(e[a]=[]),e[a].push(i)}return Object.keys(e).map(Number).sort((i,r)=>i-r).map(i=>({label:i.toString(),items:M(e[i.toString()])}))}function B(t,e){switch(e){case"category":return de(t);case"cmc":return le(t);default:return[{label:"",items:M(t)}]}}function z(t){let e=new Set;for(let n of[t.mainDiff,t.sideDiff])for(let i of[...n.cuts,...n.adds,...n.unchanged])e.add(i.name);return Array.from(e)}var h={DECK_1:"deck1",DECK_2:"deck2",SAVED_DECKS:"mtg-diff-saved-decks",GROUPING_MODE:"mtg-diff-grouping",SECTION_VISIBILITY:"mtg-diff-section"};function ue(){try{let t="__storage_test__";return localStorage.setItem(t,t),localStorage.removeItem(t),!0}catch{return!1}}var V=ue();function x(t){if(!V)return null;try{return localStorage.getItem(t)}catch{return null}}function b(t,e){if(V)try{localStorage.setItem(t,e)}catch{console.warn(`Failed to save to localStorage: ${t}`)}}function D(t,e){b(t,e)}function I(t){return x(t)}function k(){let t=x(h.SAVED_DECKS);if(!t)return{};try{return JSON.parse(t)}catch{return{}}}function Q(t,e){let n=k();n[t]=e,b(h.SAVED_DECKS,JSON.stringify(n))}function U(){let t=x(h.GROUPING_MODE);return t&&["none","category","cmc"].includes(t)?t:"none"}function F(t){b(h.GROUPING_MODE,t)}function j(t){let e=`${h.SECTION_VISIBILITY}-${t}`;return x(e)!=="hidden"}function q(t,e){let n=`${h.SECTION_VISIBILITY}-${t}`;b(n,e?"visible":"hidden")}var pe="https://svgs.scryfall.io/card-symbols",L=new Set,w=null,fe=500;function S(t){let e=document.createElement("div");return e.textContent=t,e.innerHTML}function A(t){return t?t.replace(/{([^}]+)}/g,(e,n)=>{let i=n.replace("/","-").toUpperCase();return i=i.replace("/","-"),`<img src="${pe}/${i}.svg" class="w-3 h-3 inline-block mx-[1px]" alt="${n}">`}):""}function J(t,e){let n=e==="add"?"card-add":e==="remove"?"card-remove":"card-unchanged",i=S(t.name),r=u.getCached(t.name),o=r?A(r.manaCost):"",a=r?"mana-rendered":"mana-placeholder";return`<div class="${n} ml-4 flex items-center">
    ${t.count} <span class="card-hover text-violet-400 hover:text-violet-300 mx-1" data-name="${i}">${i}</span>
    <span class="${a} inline-flex items-center" data-name="${i}">${o}</span>
  </div>`}function g(t,e,n){return n==="none"?t.sort((r,o)=>r.name.localeCompare(o.name)).map(r=>J(r,e)).join(""):B(t,n).map(r=>{let o=r.items.map(c=>J(c,e)).join(""),a=r.items.reduce((c,l)=>c+l.count,0);return`<div class="mb-3">
        <div class="text-xs text-zinc-500 uppercase tracking-wider mb-1 ml-2">${n==="cmc"?`CMC ${r.label}`:r.label} <span class="text-zinc-600">(${a})</span></div>
        ${o}
      </div>`}).join("")}function v(t,e){let n=document.getElementById(e);if(!n)return;if(D(e==="preview1"?"deck1":"deck2",t),!t.trim()){n.innerHTML="",n.classList.add("hidden");return}n.classList.remove("hidden");let r=t.split(`
`).map(o=>{let a=o.trim(),s=a.match(/^(\d+)\s+(.+?)(?:\s+\(|$)/);if(s){let c=s[2],l=S(c),m=u.getCached(c),ee=m?A(m.manaCost):"",te=m?"mana-rendered":"mana-placeholder",ne=a.substring(s[0].length).trim();return`<div>
          ${s[1]} <span class="card-hover text-violet-400 font-medium" data-name="${l}">${l}</span>
          <span class="${te} ml-1 inline-flex items-center" data-name="${l}">${ee}</span>
          ${ne?"...":""}
        </div>`}return a.toUpperCase().startsWith("SIDEBOARD:")?`<div class="font-bold text-zinc-500 mt-2">${S(a)}</div>`:a?`<div>${S(a)}</div>`:""}).join("");n.innerHTML=r,K(["preview1","preview2"])}function _(t,e){let n=document.getElementById("diff-remove"),i=document.getElementById("diff-add"),r=document.getElementById("diff-unchanged");if(n){let a="";t.mainDiff.cuts.length>0&&(a+='<div class="font-bold text-zinc-400 mb-2">Mainboard</div>',a+=g(t.mainDiff.cuts,"remove",e)),t.sideDiff.cuts.length>0&&(a+='<div class="font-bold text-zinc-400 mb-2 mt-4">Sideboard</div>',a+=g(t.sideDiff.cuts,"remove",e)),a||(a='<div class="text-zinc-500 italic">No cards removed</div>'),n.innerHTML=a}if(i){let a="";t.mainDiff.adds.length>0&&(a+='<div class="font-bold text-zinc-400 mb-2">Mainboard</div>',a+=g(t.mainDiff.adds,"add",e)),t.sideDiff.adds.length>0&&(a+='<div class="font-bold text-zinc-400 mb-2 mt-4">Sideboard</div>',a+=g(t.sideDiff.adds,"add",e)),a||(a='<div class="text-zinc-500 italic">No cards added</div>'),i.innerHTML=a}if(r){let a="";t.mainDiff.unchanged.length>0&&(a+='<div class="font-bold text-zinc-400 mb-2">Mainboard</div>',a+=g(t.mainDiff.unchanged,"unchanged",e)),t.sideDiff.unchanged.length>0&&(a+='<div class="font-bold text-zinc-400 mb-2 mt-4">Sideboard</div>',a+=g(t.sideDiff.unchanged,"unchanged",e)),a||(a='<div class="text-zinc-500 italic">No unchanged cards</div>'),r.innerHTML=a}me(t);let o=z(t);K(["diff-remove","diff-add","diff-unchanged"],o)}function me(t){let e=document.getElementById("print-btn");if(!e)return;let n=t.mainDiff.adds.length>0||t.sideDiff.adds.length>0;e.classList.toggle("hidden",!n)}function K(t,e){let n=new Set(e||[]);for(let i of t){let r=document.getElementById(i);r&&r.querySelectorAll(".mana-placeholder").forEach(o=>{let a=o.getAttribute("data-name");a&&n.add(a)})}n.size!==0&&(w!==null&&clearTimeout(w),n.forEach(i=>L.add(i)),w=window.setTimeout(()=>{let i=Array.from(L);L.clear(),w=null,he(i,t)},fe))}async function he(t,e){await u.fetchCards(t),ge(e)}function ge(t){for(let e of t){let n=document.getElementById(e);if(!n)continue;n.querySelectorAll(".mana-placeholder").forEach(r=>{let o=r.getAttribute("data-name");if(!o)return;let a=u.getCached(o);a&&(r.innerHTML=A(a.manaCost),r.classList.remove("mana-placeholder"),r.classList.add("mana-rendered"))})}}function R(){let t=localStorage.getItem("mtg-diff-saved-decks"),e=t?JSON.parse(t):{},n=["saved-decks-1","saved-decks-2"];for(let i of n){let r=document.getElementById(i);if(!r)continue;let o=r.value;for(;r.options.length>1;)r.remove(1);let a=Object.keys(e).sort();for(let s of a){let c=document.createElement("option");c.value=s,c.textContent=s,r.appendChild(c)}e[o]?r.value=o:r.value=""}}function Y(t,e){let n=document.getElementById(t);if(!n)return;let i=[];n.querySelectorAll(":scope > div").forEach(o=>{let a=o.textContent?.replace(/\s+/g," ").trim();a&&i.push(a)});let r=i.join(`
`);if(!r||r==="No cards removed"||r==="No cards added"||r==="No unchanged cards"){alert("Nothing to copy.");return}navigator.clipboard.writeText(r).then(()=>{let o=e.innerHTML;e.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>',setTimeout(()=>{e.innerHTML=o},2e3)}).catch(o=>{console.error("Failed to copy: ",o),alert("Failed to copy to clipboard")})}var ve=9;function W(t){let e=[];for(let a of t.mainDiff.adds)for(let s=0;s<a.count;s++)e.push(a.name);for(let a of t.sideDiff.adds)for(let s=0;s<a.count;s++)e.push(a.name);if(e.length===0){alert("No added cards to print!");return}let n=ye(e),i=new Blob([n],{type:"text/html"}),r=URL.createObjectURL(i);window.open(r,"_blank")||alert("Please allow popups to print proxies.")}function ye(t){return`<!DOCTYPE html>
<html>
<head>
  <title>mtg-diff \xB7 print proxies</title>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');
    @page { margin: 0; size: auto; }
    *, *::before, *::after { box-sizing: border-box; }

    body {
      margin: 0;
      font-family: 'JetBrains Mono', monospace;
      background: #09090b;
      color: #f4f4f5;
      min-height: 100vh;
    }

    .chrome {
      background: #18181b;
      border-bottom: 1px solid #27272a;
      padding: 8px 16px;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: #52525b;
      letter-spacing: 0.05em;
    }
    .chrome-dot {
      width: 11px; height: 11px;
      border-radius: 50%;
      background: #3f3f46;
      display: inline-block;
      flex-shrink: 0;
    }

    .controls {
      background: #18181b;
      border: 1px solid #3f3f46;
      border-radius: 4px;
      padding: 24px;
      margin: 24px auto;
      text-align: center;
      max-width: 560px;
    }
    .controls-label {
      font-size: 11px;
      color: #a78bfa;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .controls p {
      color: #52525b;
      font-size: 12px;
      margin: 0 0 16px;
    }
    .btn-primary {
      background: transparent;
      color: #a78bfa;
      border: 1px solid #7c3aed;
      padding: 8px 20px;
      border-radius: 4px;
      font-weight: 700;
      cursor: pointer;
      font-size: 13px;
      font-family: 'JetBrains Mono', monospace;
      letter-spacing: 0.08em;
      transition: background 0.15s;
    }
    .btn-primary:hover { background: #2e1065; }
    .btn-secondary {
      background: transparent;
      color: #52525b;
      border: 1px solid #3f3f46;
      padding: 8px 20px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      font-family: 'JetBrains Mono', monospace;
      margin-left: 8px;
      transition: background 0.15s;
    }
    .btn-secondary:hover { background: #27272a; }

    .pages-wrapper { padding: 24px; }

    .page {
      width: 100%;
      max-width: 190mm;
      margin: 0 auto;
      background: white;
      page-break-after: always;
      break-after: page;
      padding-top: 10mm;
    }
    .page:last-child { page-break-after: auto; break-after: auto; }

    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0;
      width: 100%;
    }

    .card-container {
      position: relative;
      width: 100%;
      padding-bottom: 139.6%;
      overflow: hidden;
      background: #eee;
      border: 0.5px dashed #ddd;
      break-inside: avoid;
    }
    .card-container img {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      object-fit: cover;
    }

    .remove-btn {
      position: absolute;
      top: 5px; right: 5px;
      background: #7c3aed;
      color: white;
      border: 2px solid white;
      border-radius: 50%;
      width: 26px; height: 26px;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.6);
      font-family: 'JetBrains Mono', monospace;
    }
    .remove-btn:hover { background: #6d28d9; transform: scale(1.1); }

    @media print {
      @page { margin: 0; }
      body { background: white; padding: 0; margin: 0; color: black; }
      .chrome { display: none; }
      .controls { display: none; }
      .pages-wrapper { padding: 0; }
      .remove-btn { display: none !important; }
      .page { box-shadow: none; margin: 0 auto; min-height: 100vh; }
      .card-container { border: 1px dashed #ccc; }
    }
  </style>
</head>
<body>
  <div class="chrome">
    <span class="chrome-dot"></span>
    <span class="chrome-dot"></span>
    <span class="chrome-dot"></span>
    <span style="margin-left:10px;">mtg-diff \xB7 print proxies</span>
  </div>

  <div class="controls">
    <div class="controls-label">// print proxies</div>
    <p>click \u2715 on cards to remove \xB7 then hit print</p>
    <div>
      <button class="btn-primary" onclick="setTimeout(() => window.print(), 100)">&gt;_ print now</button>
      <button class="btn-secondary" onclick="window.close()">close</button>
    </div>
  </div>

  <div class="pages-wrapper" id="pages-container"></div>

  <script>
    const validCards = ${JSON.stringify(t)};
    const PAGE_SIZE = ${ve};

    function renderPages() {
      const container = document.getElementById('pages-container');
      container.innerHTML = '';

      const chunks = [];
      for (let i = 0; i < validCards.length; i += PAGE_SIZE) {
        chunks.push(validCards.slice(i, i + PAGE_SIZE));
      }

      chunks.forEach((chunk, pageIndex) => {
        const pageDiv = document.createElement('div');
        pageDiv.className = 'page';

        const gridDiv = document.createElement('div');
        gridDiv.className = 'grid';

        chunk.forEach((name, idxInChunk) => {
          const realIndex = (pageIndex * PAGE_SIZE) + idxInChunk;
          const safeName = encodeURIComponent(name);

          const cardDiv = document.createElement('div');
          cardDiv.className = 'card-container';
          cardDiv.innerHTML = \`
            <img src="https://api.scryfall.com/cards/named?exact=\${safeName}&format=image"
                 alt="\${name}"
                 loading="eager"
                 onerror="this.parentElement.innerHTML='<div style=\\'position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:10px;font-size:12px\\'>Image not found:<br><strong>\${name}</strong></div>'">
            <button class="remove-btn" onclick="removeCard(\${realIndex})" title="Remove card">X</button>
          \`;
          gridDiv.appendChild(cardDiv);
        });

        pageDiv.appendChild(gridDiv);
        container.appendChild(pageDiv);
      });
    }

    function removeCard(index) {
      validCards.splice(index, 1);
      renderPages();
    }

    renderPages();
  <\/script>
</body>
</html>`}var f=null,y="none";function d(t){return document.getElementById(t)}function Ce(){y=U(),xe(),be(),De(),ke(),we(),Se()}function xe(){let t=d("grouping-select");t&&(t.value=y,t.addEventListener("change",()=>{X(t.value)}))}function be(){let t=[{id:"section-remove",checkbox:"show-removes"},{id:"section-unchanged",checkbox:"show-unchanged"},{id:"section-add",checkbox:"show-adds"}];for(let{id:e,checkbox:n}of t){let i=d(e),r=d(n);!j(e)&&i&&r&&(i.classList.add("hidden"),r.checked=!1)}}function De(){R()}function ke(){let t=d("deck1"),e=d("deck2");if(t){let n=I("deck1");n&&(t.value=n,v(n,"preview1"))}if(e){let n=I("deck2");n&&(e.value=n,v(n,"preview2"))}}function we(){let t=d("card-tooltip");if(!t)return;let e=null;document.addEventListener("mouseover",n=>{let i=n.target;if(i.classList.contains("card-hover")){let r=i.getAttribute("data-name");r&&e!==r?(e=r,t.src=`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(r)}&format=image`,t.style.display="block"):r&&(t.style.display="block")}}),document.addEventListener("mousemove",n=>{if(t.style.display==="block"){let o=n.clientX+20,a=n.clientY+20;o+260>window.innerWidth&&(o=n.clientX-260),a+360>window.innerHeight&&(a=n.clientY-360),t.style.left=`${o}px`,t.style.top=`${a}px`}}),document.addEventListener("mouseout",n=>{n.target.classList.contains("card-hover")&&(t.style.display="none",e=null,t.src="")})}function Se(){window.updatePreview=N,window.calculateDiff=Z,window.setGroupingMode=X,window.toggleSectionCheckbox=Ee,window.copyToClipboard=Te,window.printAddedCards=Me,window.saveDeck=Ie,window.loadDeck=Le,window.clearDeck=Ae}function N(t,e){let n=d(t);n&&(D(t,n.value),v(n.value,e))}function Z(){let t=d("deck1"),e=d("deck2"),n=d("results");if(!t||!e||!n)return;N("deck1","preview1"),N("deck2","preview2");let i=E(t.value),r=E(e.value);f=O(i,r),_(f,y),n.classList.remove("hidden")}function X(t){y=t,F(t),f&&_(f,y)}function Ee(t,e){let n=d(t);n&&(e.checked?n.classList.remove("hidden"):n.classList.add("hidden"),q(t,e.checked))}function Te(t,e){Y(t,e)}function Me(){f||Z(),f&&W(f)}function Ie(t,e){let n=d(t),i=d(e);if(!n||!i)return;let r=i.value.trim();if(!r){alert("Please enter a name for the deck.");return}if(!n.value.trim()){alert("The deck is empty. Cannot save.");return}if(k()[r]&&!confirm(`Overwrite existing deck "${r}"?`))return;Q(r,n.value),R(),i.value="";let s=d(`saved-decks-${t==="deck1"?"1":"2"}`);s&&(s.value=r)}function Le(t,e,n){if(!e)return;let r=k()[e];if(r){let o=d(t);o&&(o.value=r,v(r,t==="deck1"?"preview1":"preview2"))}}function Ae(t){if(!confirm("Are you sure you want to clear this deck?"))return;let e=d(t);e&&(e.value="",v("",t==="deck1"?"preview1":"preview2"));let i=d(`saved-decks-${t==="deck1"?"1":"2"}`);i&&(i.value="")}window.addEventListener("load",Ce);})();
