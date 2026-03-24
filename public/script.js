"use strict";(()=>{var ne=/^(\d+)\s+(.+?)(?:\s+\(|$)/,re="SIDEBOARD:";function E(t){let e={},n={},a=!1,r=t.split(`
`);for(let o of r){let i=o.trim();if(!i)continue;if(i.toUpperCase().startsWith(re)){a=!0;continue}let s=i.match(ne);if(s){let c=parseInt(s[1],10),l=s[2].trim(),p=a?n:e;p[l]=(p[l]||0)+c}}return{main:e,side:n}}function N(t){return t===void 0?"Unknown":t?t.includes("Land")?"Land":t.includes("Creature")?"Creature":t.includes("Planeswalker")?"Planeswalker":t.includes("Instant")?"Instant":t.includes("Sorcery")?"Sorcery":t.includes("Enchantment")?"Enchantment":t.includes("Artifact")?"Artifact":t.includes("Battle")?"Battle":"Other":"Other"}var $=["Land","Creature","Instant","Sorcery","Enchantment","Artifact","Planeswalker","Battle","Other","Unknown"];var y=class{constructor(e){this.head=null;this.tail=null;this.capacity=e,this.cache=new Map}get(e){let n=this.cache.get(e);if(n)return this.moveToFront(n),n.value}set(e,n){let a=this.cache.get(e);if(a){a.value=n,this.moveToFront(a);return}this.cache.size>=this.capacity&&this.evictLRU();let r={key:e,value:n,prev:null,next:this.head};this.head&&(this.head.prev=r),this.head=r,this.tail||(this.tail=r),this.cache.set(e,r)}has(e){return this.cache.has(e)}delete(e){let n=this.cache.get(e);return n?(this.removeNode(n),this.cache.delete(e),!0):!1}clear(){this.cache.clear(),this.head=null,this.tail=null}get size(){return this.cache.size}moveToFront(e){e!==this.head&&(this.removeNode(e),e.next=this.head,e.prev=null,this.head&&(this.head.prev=e),this.head=e,this.tail||(this.tail=e))}removeNode(e){e.prev?e.prev.next=e.next:this.head=e.next,e.next?e.next.prev=e.prev:this.tail=e.prev}evictLRU(){if(!this.tail)return;let e=this.tail;this.removeNode(e),this.cache.delete(e.key)}};var ie="https://api.scryfall.com",ae=50,P=75,oe=500,S=class{constructor(e=oe){this.lastRequestTime=0;this.pendingQueue=[];this.isProcessing=!1;this.cache=new y(e)}async fetchCards(e){let n=new Map,a=[];for(let o of e){let i=this.cache.get(o);i?n.set(o,i):a.push(o)}if(a.length===0)return n;let r=await this.queueFetchRequest(a);for(let[o,i]of r)n.set(o,i);return n}getCached(e){return this.cache.get(e)}isCached(e){return this.cache.has(e)}getCardType(e){let n=this.cache.get(e);return n?N(n.typeLine):"Unknown"}async queueFetchRequest(e){return new Promise((n,a)=>{this.pendingQueue.push({names:e,resolve:n,reject:a}),this.processQueue()})}async processQueue(){if(!(this.isProcessing||this.pendingQueue.length===0)){for(this.isProcessing=!0;this.pendingQueue.length>0;){let e=this.pendingQueue.shift();try{let n=await this.executeBatchFetch(e.names);e.resolve(n)}catch(n){e.reject(n instanceof Error?n:new Error(String(n)))}}this.isProcessing=!1}}async executeBatchFetch(e){let n=new Map,a=[...new Set(e)],r=[];for(let o=0;o<a.length;o+=P)r.push(a.slice(o,o+P));for(let o of r){await this.enforceRateLimit();try{let i=await fetch(`${ie}/cards/collection`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({identifiers:o.map(c=>({name:c}))})});if(!i.ok)throw new Error(`Scryfall API error: ${i.status}`);let s=await i.json();if(s.data)for(let c of s.data){let l=this.parseCardResponse(c);n.set(c.name,l),this.cache.set(c.name,l)}if(s.not_found)for(let c of s.not_found){let l={name:c.name,manaCost:"",typeLine:"",cmc:0};n.set(c.name,l),this.cache.set(c.name,l)}}catch(i){console.error("Failed to fetch cards from Scryfall:",i);for(let s of o)n.set(s,{name:s,manaCost:"",typeLine:"",cmc:0})}}return n}parseCardResponse(e){let n=e.mana_cost||"",a=e.type_line||"",r=e.cmc||0;return!n&&e.card_faces&&e.card_faces.length>0&&(n=e.card_faces[0].mana_cost||""),!a&&e.card_faces&&e.card_faces.length>0&&(a=e.card_faces[0].type_line||""),{name:e.name,manaCost:n,typeLine:a,cmc:r}}async enforceRateLimit(){let n=Date.now()-this.lastRequestTime,a=ae-n;a>0&&await this.delay(a),this.lastRequestTime=Date.now()}delay(e){return new Promise(n=>setTimeout(n,e))}clearCache(){this.cache.clear()}},u=new S;function H(t,e){let n=[],a=[],r=[];for(let[o,i]of Object.entries(t)){let s=e[o]||0;i>s&&n.push({name:o,count:i-s})}for(let[o,i]of Object.entries(e)){let s=t[o]||0;i>s?a.push({name:o,count:i-s}):i===s&&i>0&&r.push({name:o,count:i})}return{cuts:n,adds:a,unchanged:r}}function G(t,e){return{mainDiff:H(t.main,e.main),sideDiff:H(t.side,e.side)}}function T(t){return[...t].sort((e,n)=>e.name.localeCompare(n.name))}function se(t){let e={};for(let n of t){let a=u.getCardType(n.name);e[a]||(e[a]=[]),e[a].push(n)}return $.filter(n=>e[n]).map(n=>({label:n,items:T(e[n])}))}function ce(t){let e={};for(let a of t){let r=u.getCached(a.name),i=(r?Math.round(r.cmc):0).toString();e[i]||(e[i]=[]),e[i].push(a)}return Object.keys(e).map(Number).sort((a,r)=>a-r).map(a=>({label:a.toString(),items:T(e[a.toString()])}))}function O(t,e){switch(e){case"category":return se(t);case"cmc":return ce(t);default:return[{label:"",items:T(t)}]}}function B(t){let e=new Set;for(let n of[t.mainDiff,t.sideDiff])for(let a of[...n.cuts,...n.adds,...n.unchanged])e.add(a.name);return Array.from(e)}var m={DECK_1:"deck1",DECK_2:"deck2",SAVED_DECKS:"mtg-diff-saved-decks",GROUPING_MODE:"mtg-diff-grouping",SECTION_VISIBILITY:"mtg-diff-section"};function de(){try{let t="__storage_test__";return localStorage.setItem(t,t),localStorage.removeItem(t),!0}catch{return!1}}var Q=de();function C(t){if(!Q)return null;try{return localStorage.getItem(t)}catch{return null}}function x(t,e){if(Q)try{localStorage.setItem(t,e)}catch{console.warn(`Failed to save to localStorage: ${t}`)}}function b(t,e){x(t,e)}function M(t){return C(t)}function D(){let t=C(m.SAVED_DECKS);if(!t)return{};try{return JSON.parse(t)}catch{return{}}}function V(t,e){let n=D();n[t]=e,x(m.SAVED_DECKS,JSON.stringify(n))}function z(){let t=C(m.GROUPING_MODE);return t&&["none","category","cmc"].includes(t)?t:"none"}function U(t){x(m.GROUPING_MODE,t)}function F(t){let e=`${m.SECTION_VISIBILITY}-${t}`;return C(e)!=="hidden"}function j(t,e){let n=`${m.SECTION_VISIBILITY}-${t}`;x(n,e?"visible":"hidden")}var le="https://svgs.scryfall.io/card-symbols",I=new Set,k=null,ue=500;function w(t){let e=document.createElement("div");return e.textContent=t,e.innerHTML}function L(t){return t?t.replace(/{([^}]+)}/g,(e,n)=>{let a=n.replace("/","-").toUpperCase();return a=a.replace("/","-"),`<img src="${le}/${a}.svg" class="w-3 h-3 inline-block mx-[1px]" alt="${n}">`}):""}function q(t,e){let n=e==="add"?"card-add":e==="remove"?"card-remove":"card-unchanged",a=w(t.name),r=u.getCached(t.name),o=r?L(r.manaCost):"",i=r?"mana-rendered":"mana-placeholder";return`<div class="${n} ml-4 flex items-center">
    ${t.count} <span class="card-hover text-violet-400 hover:text-violet-300 mx-1" data-name="${a}">${a}</span>
    <span class="${i} inline-flex items-center" data-name="${a}">${o}</span>
  </div>`}function g(t,e,n){return n==="none"?t.sort((r,o)=>r.name.localeCompare(o.name)).map(r=>q(r,e)).join(""):O(t,n).map(r=>{let o=r.items.map(c=>q(c,e)).join(""),i=r.items.reduce((c,l)=>c+l.count,0);return`<div class="mb-3">
        <div class="text-xs text-zinc-500 uppercase tracking-wider mb-1 ml-2">${n==="cmc"?`CMC ${r.label}`:r.label} <span class="text-zinc-600">(${i})</span></div>
        ${o}
      </div>`}).join("")}function h(t,e){let n=document.getElementById(e);if(!n)return;if(b(e==="preview1"?"deck1":"deck2",t),!t.trim()){n.innerHTML="",n.classList.add("hidden");return}n.classList.remove("hidden");let r=t.split(`
`).map(o=>{let i=o.trim(),s=i.match(/^(\d+)\s+(.+?)(?:\s+\(|$)/);if(s){let c=s[2],l=w(c),p=u.getCached(c),X=p?L(p.manaCost):"",ee=p?"mana-rendered":"mana-placeholder",te=i.substring(s[0].length).trim();return`<div>
          ${s[1]} <span class="card-hover text-violet-400 font-medium" data-name="${l}">${l}</span>
          <span class="${ee} ml-1 inline-flex items-center" data-name="${l}">${X}</span>
          ${te?"...":""}
        </div>`}return i.toUpperCase().startsWith("SIDEBOARD:")?`<div class="font-bold text-zinc-500 mt-2">${w(i)}</div>`:i?`<div>${w(i)}</div>`:""}).join("");n.innerHTML=r,K(["preview1","preview2"])}function _(t,e){let n=document.getElementById("diff-remove"),a=document.getElementById("diff-add"),r=document.getElementById("diff-unchanged");if(n){let i="";t.mainDiff.cuts.length>0&&(i+='<div class="font-bold text-zinc-400 mb-2">Mainboard</div>',i+=g(t.mainDiff.cuts,"remove",e)),t.sideDiff.cuts.length>0&&(i+='<div class="font-bold text-zinc-400 mb-2 mt-4">Sideboard</div>',i+=g(t.sideDiff.cuts,"remove",e)),i||(i='<div class="text-zinc-500 italic">No cards removed</div>'),n.innerHTML=i}if(a){let i="";t.mainDiff.adds.length>0&&(i+='<div class="font-bold text-zinc-400 mb-2">Mainboard</div>',i+=g(t.mainDiff.adds,"add",e)),t.sideDiff.adds.length>0&&(i+='<div class="font-bold text-zinc-400 mb-2 mt-4">Sideboard</div>',i+=g(t.sideDiff.adds,"add",e)),i||(i='<div class="text-zinc-500 italic">No cards added</div>'),a.innerHTML=i}if(r){let i="";t.mainDiff.unchanged.length>0&&(i+='<div class="font-bold text-zinc-400 mb-2">Mainboard</div>',i+=g(t.mainDiff.unchanged,"unchanged",e)),t.sideDiff.unchanged.length>0&&(i+='<div class="font-bold text-zinc-400 mb-2 mt-4">Sideboard</div>',i+=g(t.sideDiff.unchanged,"unchanged",e)),i||(i='<div class="text-zinc-500 italic">No unchanged cards</div>'),r.innerHTML=i}fe(t);let o=B(t);K(["diff-remove","diff-add","diff-unchanged"],o)}function fe(t){let e=document.getElementById("print-btn");if(!e)return;let n=t.mainDiff.adds.length>0||t.sideDiff.adds.length>0;e.classList.toggle("hidden",!n)}function K(t,e){let n=new Set(e||[]);for(let a of t){let r=document.getElementById(a);r&&r.querySelectorAll(".mana-placeholder").forEach(o=>{let i=o.getAttribute("data-name");i&&n.add(i)})}n.size!==0&&(k!==null&&clearTimeout(k),n.forEach(a=>I.add(a)),k=window.setTimeout(()=>{let a=Array.from(I);I.clear(),k=null,pe(a,t)},ue))}async function pe(t,e){await u.fetchCards(t),me(e)}function me(t){for(let e of t){let n=document.getElementById(e);if(!n)continue;n.querySelectorAll(".mana-placeholder").forEach(r=>{let o=r.getAttribute("data-name");if(!o)return;let i=u.getCached(o);i&&(r.innerHTML=L(i.manaCost),r.classList.remove("mana-placeholder"),r.classList.add("mana-rendered"))})}}function A(){let t=localStorage.getItem("mtg-diff-saved-decks"),e=t?JSON.parse(t):{},n=["saved-decks-1","saved-decks-2"];for(let a of n){let r=document.getElementById(a);if(!r)continue;let o=r.value;for(;r.options.length>1;)r.remove(1);let i=Object.keys(e).sort();for(let s of i){let c=document.createElement("option");c.value=s,c.textContent=s,r.appendChild(c)}e[o]?r.value=o:r.value=""}}function Y(t,e){let n=document.getElementById(t);if(!n)return;let a=[];n.querySelectorAll(":scope > div").forEach(o=>{let i=o.textContent?.replace(/\s+/g," ").trim();i&&a.push(i)});let r=a.join(`
`);if(!r||r==="No cards removed"||r==="No cards added"||r==="No unchanged cards"){alert("Nothing to copy.");return}navigator.clipboard.writeText(r).then(()=>{let o=e.innerHTML;e.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>',setTimeout(()=>{e.innerHTML=o},2e3)}).catch(o=>{console.error("Failed to copy: ",o),alert("Failed to copy to clipboard")})}var ge=9;function J(t){let e=[];for(let i of t.mainDiff.adds)for(let s=0;s<i.count;s++)e.push(i.name);for(let i of t.sideDiff.adds)for(let s=0;s<i.count;s++)e.push(i.name);if(e.length===0){alert("No added cards to print!");return}let n=he(e),a=new Blob([n],{type:"text/html"}),r=URL.createObjectURL(a);window.open(r,"_blank")||alert("Please allow popups to print proxies.")}function he(t){return`<!DOCTYPE html>
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
    const PAGE_SIZE = ${ge};

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
</html>`}var f=null,v="none";function d(t){return document.getElementById(t)}function ve(){v=z(),ye(),Ce(),xe(),be(),De(),ke()}function ye(){let t=d("grouping-select");t&&(t.value=v,t.addEventListener("change",()=>{Z(t.value)}))}function Ce(){let t=[{id:"section-remove",checkbox:"show-removes"},{id:"section-unchanged",checkbox:"show-unchanged"},{id:"section-add",checkbox:"show-adds"}];for(let{id:e,checkbox:n}of t){let a=d(e),r=d(n);!F(e)&&a&&r&&(a.classList.add("hidden"),r.checked=!1)}}function xe(){A()}function be(){let t=d("deck1"),e=d("deck2");if(t){let n=M("deck1");n&&(t.value=n,h(n,"preview1"))}if(e){let n=M("deck2");n&&(e.value=n,h(n,"preview2"))}}function De(){let t=d("card-tooltip");if(!t)return;let e=null;document.addEventListener("mouseover",n=>{let a=n.target;if(a.classList.contains("card-hover")){let r=a.getAttribute("data-name");r&&e!==r?(e=r,t.src=`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(r)}&format=image`,t.style.display="block"):r&&(t.style.display="block")}}),document.addEventListener("mousemove",n=>{if(t.style.display==="block"){let o=n.clientX+20,i=n.clientY+20;o+260>window.innerWidth&&(o=n.clientX-260),i+360>window.innerHeight&&(i=n.clientY-360),t.style.left=`${o}px`,t.style.top=`${i}px`}}),document.addEventListener("mouseout",n=>{n.target.classList.contains("card-hover")&&(t.style.display="none",e=null,t.src="")})}function ke(){window.updatePreview=R,window.calculateDiff=W,window.setGroupingMode=Z,window.toggleSectionCheckbox=we,window.copyToClipboard=Ee,window.printAddedCards=Se,window.saveDeck=Te,window.loadDeck=Me,window.clearDeck=Ie}function R(t,e){let n=d(t);n&&(b(t,n.value),h(n.value,e))}function W(){let t=d("deck1"),e=d("deck2"),n=d("results");if(!t||!e||!n)return;R("deck1","preview1"),R("deck2","preview2");let a=E(t.value),r=E(e.value);f=G(a,r),_(f,v),n.classList.remove("hidden")}function Z(t){v=t,U(t),f&&_(f,v)}function we(t,e){let n=d(t);n&&(e.checked?n.classList.remove("hidden"):n.classList.add("hidden"),j(t,e.checked))}function Ee(t,e){Y(t,e)}function Se(){f||W(),f&&J(f)}function Te(t,e){let n=d(t),a=d(e);if(!n||!a)return;let r=a.value.trim();if(!r){alert("Please enter a name for the deck.");return}if(!n.value.trim()){alert("The deck is empty. Cannot save.");return}if(D()[r]&&!confirm(`Overwrite existing deck "${r}"?`))return;V(r,n.value),A(),a.value="";let s=d(`saved-decks-${t==="deck1"?"1":"2"}`);s&&(s.value=r)}function Me(t,e,n){if(!e)return;let r=D()[e];if(r){let o=d(t);o&&(o.value=r,h(r,t==="deck1"?"preview1":"preview2"))}}function Ie(t){if(!confirm("Are you sure you want to clear this deck?"))return;let e=d(t);e&&(e.value="",h("",t==="deck1"?"preview1":"preview2"));let a=d(`saved-decks-${t==="deck1"?"1":"2"}`);a&&(a.value="")}window.addEventListener("load",ve);})();
