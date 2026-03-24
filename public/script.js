"use strict";(()=>{var pe=/^(\d+)\s+(.+?)(?:\s+\(|$)/,fe="SIDEBOARD:";function A(t){let e={},n={},r=!1,i=t.split(`
`);for(let a of i){let o=a.trim();if(!o)continue;if(o.toUpperCase().startsWith(fe)){r=!0;continue}let s=o.match(pe);if(s){let c=parseInt(s[1],10),d=s[2].trim(),u=r?n:e;u[d]=(u[d]||0)+c}}return{main:e,side:n}}function U(t){return t===void 0?"Unknown":t?t.includes("Land")?"Land":t.includes("Creature")?"Creature":t.includes("Planeswalker")?"Planeswalker":t.includes("Instant")?"Instant":t.includes("Sorcery")?"Sorcery":t.includes("Enchantment")?"Enchantment":t.includes("Artifact")?"Artifact":t.includes("Battle")?"Battle":"Other":"Other"}var F=["Land","Creature","Instant","Sorcery","Enchantment","Artifact","Planeswalker","Battle","Other","Unknown"];var g=class t{constructor(e,n){this.head=null;this.tail=null;this.capacity=e,this.cache=new Map,this.onSet=n}get(e){let n=this.cache.get(e);if(n)return this.moveToFront(n),n.value}set(e,n){let r=this.cache.get(e);if(r){r.value=n,this.moveToFront(r),this.onSet?.();return}this.cache.size>=this.capacity&&this.evictLRU();let i={key:e,value:n,prev:null,next:this.head};this.head&&(this.head.prev=i),this.head=i,this.tail||(this.tail=i),this.cache.set(e,i),this.onSet?.()}has(e){return this.cache.has(e)}delete(e){let n=this.cache.get(e);return n?(this.removeNode(n),this.cache.delete(e),this.onSet?.(),!0):!1}clear(){this.cache.clear(),this.head=null,this.tail=null,this.onSet?.()}get size(){return this.cache.size}serialize(){let e=[],n=this.head;for(;n;)e.push({key:n.key,value:n.value}),n=n.next;return{items:e,capacity:this.capacity}}static deserialize(e,n){let r=new t(e.capacity,n);for(let i=e.items.length-1;i>=0;i--){let a=e.items[i];r.set(a.key,a.value)}return r}keys(){let e=[],n=this.head;for(;n;)e.push(n.key),n=n.next;return e}moveToFront(e){e!==this.head&&(this.removeNode(e),e.next=this.head,e.prev=null,this.head&&(this.head.prev=e),this.head=e,this.tail||(this.tail=e))}removeNode(e){e.prev?e.prev.next=e.next:this.head=e.next,e.next?e.next.prev=e.prev:this.tail=e.prev}evictLRU(){if(!this.tail)return;let e=this.tail;this.removeNode(e),this.cache.delete(e.key)}};var me="https://api.scryfall.com",he=50,j=75,ge=500,E="mtg-diff-card-cache",N=2,ve=1e3,O=class{constructor(e=ge){this.lastRequestTime=0;this.pendingQueue=[];this.isProcessing=!1;this.saveTimer=null;this.capacity=e,this.cache=this.loadCache()}async fetchCards(e){let n=new Map,r=[];for(let a of e){let o=this.cache.get(a);o?n.set(a,o):r.push(a)}if(r.length===0)return n;let i=await this.queueFetchRequest(r);for(let[a,o]of i)n.set(a,o);return n}getCached(e){return this.cache.get(e)}isCached(e){return this.cache.has(e)}getCardType(e){let n=this.cache.get(e);return n?U(n.typeLine):"Unknown"}clearCache(){this.cache.clear(),this.removePersistedCache()}queueFetchRequest(e){return new Promise((n,r)=>{this.pendingQueue.push({names:e,resolve:n,reject:r}),this.processQueue()})}async processQueue(){if(!(this.isProcessing||this.pendingQueue.length===0)){for(this.isProcessing=!0;this.pendingQueue.length>0;){let e=this.pendingQueue.shift();try{let n=await this.executeBatchFetch(e.names);e.resolve(n)}catch(n){e.reject(n instanceof Error?n:new Error(String(n)))}}this.isProcessing=!1}}async executeBatchFetch(e){let n=new Map,r=[...new Set(e)],i=[];for(let a=0;a<r.length;a+=j)i.push(r.slice(a,a+j));for(let a of i){await this.enforceRateLimit();try{let o=await fetch(`${me}/cards/collection`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({identifiers:a.map(c=>({name:c}))})});if(!o.ok)throw new Error(`Scryfall API error: ${o.status}`);let s=await o.json();if(s.data)for(let c of s.data){let d=this.parseCardResponse(c);n.set(c.name,d),this.cache.set(c.name,d)}if(s.not_found)for(let c of s.not_found){let d={name:c.name,manaCost:"",typeLine:"",cmc:0,price:null};n.set(c.name,d),this.cache.set(c.name,d)}}catch(o){console.error("Failed to fetch cards from Scryfall:",o);for(let s of a)n.set(s,{name:s,manaCost:"",typeLine:"",cmc:0,price:null})}}return n}parseCardResponse(e){let n=e.mana_cost||"",r=e.type_line||"",i=e.cmc||0,a=this.parsePrice(e.prices);return!n&&e.card_faces&&e.card_faces.length>0&&(n=e.card_faces[0].mana_cost||""),!r&&e.card_faces&&e.card_faces.length>0&&(r=e.card_faces[0].type_line||""),{name:e.name,manaCost:n,typeLine:r,cmc:i,price:a}}parsePrice(e){if(e?.usd){let n=parseFloat(e.usd);return isNaN(n)?null:n}if(e?.usd_foil){let n=parseFloat(e.usd_foil);return isNaN(n)?null:n}return null}async enforceRateLimit(){let n=Date.now()-this.lastRequestTime,r=he-n;r>0&&await this.delay(r),this.lastRequestTime=Date.now()}delay(e){return new Promise(n=>setTimeout(n,e))}loadCache(){try{let e=localStorage.getItem(E);if(!e)return new g(this.capacity,()=>this.scheduleSave());let n=JSON.parse(e);return!n.items||!Array.isArray(n.items)||n.version!==N?new g(this.capacity,()=>this.scheduleSave()):g.deserialize({...n,capacity:this.capacity},()=>this.scheduleSave())}catch(e){return console.warn("Failed to load card cache from localStorage:",e),new g(this.capacity,()=>this.scheduleSave())}}scheduleSave(){this.saveTimer!==null&&clearTimeout(this.saveTimer),this.saveTimer=window.setTimeout(()=>{this.saveTimer=null,this.persistCache()},ve)}persistCache(){try{let n={...this.cache.serialize(),version:N},r=JSON.stringify(n);try{localStorage.setItem(E,r)}catch(i){if(i instanceof DOMException&&i.name==="QuotaExceededError")this.evictAndRetry();else throw i}}catch(e){console.warn("Failed to persist card cache to localStorage:",e)}}evictAndRetry(){let e=Math.floor(this.capacity/2);for(;this.cache.size>e;)this.cache.delete(this.cache.keys().pop());try{let r={...this.cache.serialize(),version:N};localStorage.setItem(E,JSON.stringify(r))}catch{this.removePersistedCache()}}removePersistedCache(){try{localStorage.removeItem(E)}catch{}}},p=new O;function q(t,e){let n=[],r=[],i=[];for(let[a,o]of Object.entries(t)){let s=e[a]||0;o>s&&n.push({name:a,count:o-s})}for(let[a,o]of Object.entries(e)){let s=t[a]||0;o>s?r.push({name:a,count:o-s}):o===s&&o>0&&i.push({name:a,count:o})}return{cuts:n,adds:r,unchanged:i}}function J(t,e){return{mainDiff:q(t.main,e.main),sideDiff:q(t.side,e.side)}}function $(t,e,n){let r=[...t];switch(e){case"name":r.sort((i,a)=>i.name.localeCompare(a.name)),n==="desc"&&r.reverse();break;case"cmc":r.sort((i,a)=>{let o=p.getCached(i.name)?.cmc??999,s=p.getCached(a.name)?.cmc??999;return o-s}),n==="desc"&&r.reverse();break;case"price":r.sort((i,a)=>{let o=p.getCached(i.name)?.price??-1,s=p.getCached(a.name)?.price??-1;return o===-1&&s===-1?i.name.localeCompare(a.name):o===-1?1:s===-1?-1:s-o}),n==="asc"&&r.reverse();break}return r}function ye(t,e,n){let r={};for(let i of t){let a=p.getCardType(i.name);r[a]||(r[a]=[]),r[a].push(i)}return F.filter(i=>r[i]).map(i=>({label:i,items:$(r[i],e,n)}))}function Ce(t,e,n){let r={};for(let a of t){let o=p.getCached(a.name),c=(o?Math.round(o.cmc):0).toString();r[c]||(r[c]=[]),r[c].push(a)}return Object.keys(r).map(Number).sort((a,o)=>a-o).map(a=>({label:a.toString(),items:$(r[a.toString()],e,n)}))}function K(t,e,n,r){switch(e){case"category":return ye(t,n,r);case"cmc":return Ce(t,n,r);default:return[{label:"",items:$(t,n,r)}]}}function Y(t){let e=new Set;for(let n of[t.mainDiff,t.sideDiff])for(let r of[...n.cuts,...n.adds,...n.unchanged])e.add(r.name);return Array.from(e)}var m={DECK_1:"deck1",DECK_2:"deck2",SAVED_DECKS:"mtg-diff-saved-decks",GROUPING_MODE:"mtg-diff-grouping",SORT_MODE:"mtg-diff-sort-mode",SORT_DIRECTION:"mtg-diff-sort-direction",SECTION_VISIBILITY:"mtg-diff-section"};function xe(){try{let t="__storage_test__";return localStorage.setItem(t,t),localStorage.removeItem(t),!0}catch{return!1}}var W=xe();function C(t){if(!W)return null;try{return localStorage.getItem(t)}catch{return null}}function x(t,e){if(W)try{localStorage.setItem(t,e)}catch{console.warn(`Failed to save to localStorage: ${t}`)}}function T(t,e){x(t,e)}function H(t){return C(t)}function M(){let t=C(m.SAVED_DECKS);if(!t)return{};try{return JSON.parse(t)}catch{return{}}}function Z(t,e){let n=M();n[t]=e,x(m.SAVED_DECKS,JSON.stringify(n))}function X(){let t=C(m.GROUPING_MODE);return t&&["none","category","cmc"].includes(t)?t:"none"}function ee(t){x(m.GROUPING_MODE,t)}function te(t){let e=`${m.SECTION_VISIBILITY}-${t}`;return C(e)!=="hidden"}function ne(t,e){let n=`${m.SECTION_VISIBILITY}-${t}`;x(n,e?"visible":"hidden")}function re(){let t=C(m.SORT_MODE);return t&&["name","cmc","price"].includes(t)?t:"name"}function ie(t){x(m.SORT_MODE,t)}function ae(){let t=C(m.SORT_DIRECTION);return t&&["asc","desc"].includes(t)?t:"asc"}function oe(t){x(m.SORT_DIRECTION,t)}var De="https://svgs.scryfall.io/card-symbols",P=new Set,I=null,be=500;function L(t){let e=document.createElement("div");return e.textContent=t,e.innerHTML}function z(t){return t?t.replace(/{([^}]+)}/g,(e,n)=>{let r=n.replace("/","-").toUpperCase();return r=r.replace("/","-"),`<img src="${De}/${r}.svg" class="w-3 h-3 inline-block mx-[1px]" alt="${n}">`}):""}function R(t){return t.reduce((e,n)=>{let r=p.getCached(n.name)?.price??0;return e+r*n.count},0)}function k(t){return`$${t.toFixed(2)}`}function Se(t,e){let n=e==="add"?"card-add":e==="remove"?"card-remove":"card-unchanged",r=L(t.name),i=p.getCached(t.name),a=i?z(i.manaCost):"",o=i?"mana-rendered":"mana-placeholder",s=i?.price!==null&&i?.price!==void 0?`<span class="text-zinc-500 ml-2">${k(i.price)}</span>`:"";return`<div class="${n} ml-4 flex items-center">
    ${t.count} <span class="card-hover text-violet-400 hover:text-violet-300 mx-1" data-name="${r}">${r}</span>
    <span class="${o} inline-flex items-center" data-name="${r}">${a}</span>
    ${s}
  </div>`}function D(t,e,n,r,i){return K(t,n,r,i).map(o=>{let s=o.items.map(S=>Se(S,e)).join(""),c=o.items.reduce((S,_)=>S+_.count,0),d=R(o.items),u=d>0?`<span class="text-zinc-600 ml-2">${k(d)}</span>`:"";return n==="none"?s:`<div class="mb-3">
        <div class="text-xs text-zinc-500 uppercase tracking-wider mb-1 ml-2">${n==="cmc"?`CMC ${o.label}`:o.label} <span class="text-zinc-600">(${c})</span>${u}</div>
        ${s}
      </div>`}).join("")}function b(t,e){let n=document.getElementById(e);if(!n)return;if(T(e==="preview1"?"deck1":"deck2",t),!t.trim()){n.innerHTML="",n.classList.add("hidden");return}n.classList.remove("hidden");let i=t.split(`
`).map(a=>{let o=a.trim(),s=o.match(/^(\d+)\s+(.+?)(?:\s+\(|$)/);if(s){let c=s[2],d=L(c),u=p.getCached(c),Q=u?z(u.manaCost):"",S=u?"mana-rendered":"mana-placeholder",_=o.substring(s[0].length).trim();return`<div>
          ${s[1]} <span class="card-hover text-violet-400 font-medium" data-name="${d}">${d}</span>
          <span class="${S} ml-1 inline-flex items-center" data-name="${d}">${Q}</span>
          ${_?"...":""}
        </div>`}return o.toUpperCase().startsWith("SIDEBOARD:")?`<div class="font-bold text-zinc-500 mt-2">${L(o)}</div>`:o?`<div>${L(o)}</div>`:""}).join("");n.innerHTML=i,se(["preview1","preview2"])}function w(t,e,n,r){let i=document.getElementById("diff-remove"),a=document.getElementById("diff-add"),o=document.getElementById("diff-unchanged");if(i){let c="";t.mainDiff.cuts.length>0&&(c+='<div class="font-bold text-zinc-400 mb-2">Mainboard</div>',c+=D(t.mainDiff.cuts,"remove",e,n,r)),t.sideDiff.cuts.length>0&&(c+='<div class="font-bold text-zinc-400 mb-2 mt-4">Sideboard</div>',c+=D(t.sideDiff.cuts,"remove",e,n,r)),c||(c='<div class="text-zinc-500 italic">No cards removed</div>');let d=R([...t.mainDiff.cuts,...t.sideDiff.cuts]),u=d>0?`<div class="text-xs text-zinc-500 mt-4 pt-2 border-t border-zinc-700">Total: ${k(d)}</div>`:"";i.innerHTML=c+u}if(a){let c="";t.mainDiff.adds.length>0&&(c+='<div class="font-bold text-zinc-400 mb-2">Mainboard</div>',c+=D(t.mainDiff.adds,"add",e,n,r)),t.sideDiff.adds.length>0&&(c+='<div class="font-bold text-zinc-400 mb-2 mt-4">Sideboard</div>',c+=D(t.sideDiff.adds,"add",e,n,r)),c||(c='<div class="text-zinc-500 italic">No cards added</div>');let d=R([...t.mainDiff.adds,...t.sideDiff.adds]),u=d>0?`<div class="text-xs text-zinc-500 mt-4 pt-2 border-t border-zinc-700">Total: ${k(d)}</div>`:"";a.innerHTML=c+u}if(o){let c="";t.mainDiff.unchanged.length>0&&(c+='<div class="font-bold text-zinc-400 mb-2">Mainboard</div>',c+=D(t.mainDiff.unchanged,"unchanged",e,n,r)),t.sideDiff.unchanged.length>0&&(c+='<div class="font-bold text-zinc-400 mb-2 mt-4">Sideboard</div>',c+=D(t.sideDiff.unchanged,"unchanged",e,n,r)),c||(c='<div class="text-zinc-500 italic">No unchanged cards</div>');let d=R([...t.mainDiff.unchanged,...t.sideDiff.unchanged]),u=d>0?`<div class="text-xs text-zinc-500 mt-4 pt-2 border-t border-zinc-700">Total: ${k(d)}</div>`:"";o.innerHTML=c+u}ke(t);let s=Y(t);se(["diff-remove","diff-add","diff-unchanged"],s)}function ke(t){let e=document.getElementById("print-btn");if(!e)return;let n=t.mainDiff.adds.length>0||t.sideDiff.adds.length>0;e.classList.toggle("hidden",!n)}function se(t,e){let n=new Set(e||[]);for(let r of t){let i=document.getElementById(r);i&&i.querySelectorAll(".mana-placeholder").forEach(a=>{let o=a.getAttribute("data-name");o&&n.add(o)})}n.size!==0&&(I!==null&&clearTimeout(I),n.forEach(r=>P.add(r)),I=window.setTimeout(()=>{let r=Array.from(P);P.clear(),I=null,we(r,t)},be))}async function we(t,e){await p.fetchCards(t),Ee(e)}function Ee(t){for(let e of t){let n=document.getElementById(e);if(!n)continue;n.querySelectorAll(".mana-placeholder").forEach(i=>{let a=i.getAttribute("data-name");if(!a)return;let o=p.getCached(a);o&&(i.innerHTML=z(o.manaCost),i.classList.remove("mana-placeholder"),i.classList.add("mana-rendered"))})}}function G(){let t=localStorage.getItem("mtg-diff-saved-decks"),e=t?JSON.parse(t):{},n=["saved-decks-1","saved-decks-2"];for(let r of n){let i=document.getElementById(r);if(!i)continue;let a=i.value;for(;i.options.length>1;)i.remove(1);let o=Object.keys(e).sort();for(let s of o){let c=document.createElement("option");c.value=s,c.textContent=s,i.appendChild(c)}e[a]?i.value=a:i.value=""}}function ce(t,e){let n=document.getElementById(t);if(!n)return;let r=[];n.querySelectorAll(":scope > div").forEach(a=>{let o=a.textContent?.replace(/\s+/g," ").trim();o&&r.push(o)});let i=r.join(`
`);if(!i||i==="No cards removed"||i==="No cards added"||i==="No unchanged cards"){alert("Nothing to copy.");return}navigator.clipboard.writeText(i).then(()=>{let a=e.innerHTML;e.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>',setTimeout(()=>{e.innerHTML=a},2e3)}).catch(a=>{console.error("Failed to copy: ",a),alert("Failed to copy to clipboard")})}function B(t){let e=document.getElementById("sort-direction-btn");e&&(e.textContent=t==="asc"?"\u2193":"\u2191")}var Te=9;function de(t){let e=[];for(let o of t.mainDiff.adds)for(let s=0;s<o.count;s++)e.push(o.name);for(let o of t.sideDiff.adds)for(let s=0;s<o.count;s++)e.push(o.name);if(e.length===0){alert("No added cards to print!");return}let n=Me(e),r=new Blob([n],{type:"text/html"}),i=URL.createObjectURL(r);window.open(i,"_blank")||alert("Please allow popups to print proxies.")}function Me(t){return`<!DOCTYPE html>
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
    const PAGE_SIZE = ${Te};

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
</html>`}var f=null,v="none",y="name",h="asc";function l(t){return document.getElementById(t)}function Ie(){v=X(),y=re(),h=ae(),Le(),Re(),_e(),Ae(),Ne(),Oe(),$e()}function Le(){let t=l("grouping-select");t&&(t.value=v,t.addEventListener("change",()=>{ue(t.value)}))}function Re(){let t=l("sort-select");t&&(t.value=y),B(h)}function _e(){let t=[{id:"section-remove",checkbox:"show-removes"},{id:"section-unchanged",checkbox:"show-unchanged"},{id:"section-add",checkbox:"show-adds"}];for(let{id:e,checkbox:n}of t){let r=l(e),i=l(n);!te(e)&&r&&i&&(r.classList.add("hidden"),i.checked=!1)}}function Ae(){G()}function Ne(){let t=l("deck1"),e=l("deck2");if(t){let n=H("deck1");n&&(t.value=n,b(n,"preview1"))}if(e){let n=H("deck2");n&&(e.value=n,b(n,"preview2"))}}function Oe(){let t=l("card-tooltip");if(!t)return;let e=null;document.addEventListener("mouseover",n=>{let r=n.target;if(r.classList.contains("card-hover")){let i=r.getAttribute("data-name");i&&e!==i?(e=i,t.src=`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(i)}&format=image`,t.style.display="block"):i&&(t.style.display="block")}}),document.addEventListener("mousemove",n=>{if(t.style.display==="block"){let a=n.clientX+20,o=n.clientY+20;a+260>window.innerWidth&&(a=n.clientX-260),o+360>window.innerHeight&&(o=n.clientY-360),t.style.left=`${a}px`,t.style.top=`${o}px`}}),document.addEventListener("mouseout",n=>{n.target.classList.contains("card-hover")&&(t.style.display="none",e=null,t.src="")})}function $e(){window.updatePreview=V,window.calculateDiff=le,window.setGroupingMode=ue,window.setSortMode=He,window.toggleSortDirection=Pe,window.toggleSectionCheckbox=ze,window.copyToClipboard=Ge,window.printAddedCards=Be,window.saveDeck=Ve,window.loadDeck=Qe,window.clearDeck=Ue}function V(t,e){let n=l(t);n&&(T(t,n.value),b(n.value,e))}function le(){let t=l("deck1"),e=l("deck2"),n=l("results");if(!t||!e||!n)return;V("deck1","preview1"),V("deck2","preview2");let r=A(t.value),i=A(e.value);f=J(r,i),w(f,v,y,h),n.classList.remove("hidden")}function ue(t){v=t,ee(t),f&&w(f,v,y,h)}function He(t){y=t,ie(t),f&&w(f,v,y,h)}function Pe(){h=h==="asc"?"desc":"asc",oe(h),B(h),f&&w(f,v,y,h)}function ze(t,e){let n=l(t);n&&(e.checked?n.classList.remove("hidden"):n.classList.add("hidden"),ne(t,e.checked))}function Ge(t,e){ce(t,e)}function Be(){f||le(),f&&de(f)}function Ve(t,e){let n=l(t),r=l(e);if(!n||!r)return;let i=r.value.trim();if(!i){alert("Please enter a name for the deck.");return}if(!n.value.trim()){alert("The deck is empty. Cannot save.");return}if(M()[i]&&!confirm(`Overwrite existing deck "${i}"?`))return;Z(i,n.value),G(),r.value="";let s=l(`saved-decks-${t==="deck1"?"1":"2"}`);s&&(s.value=i)}function Qe(t,e,n){if(!e)return;let i=M()[e];if(i){let a=l(t);a&&(a.value=i,b(i,t==="deck1"?"preview1":"preview2"))}}function Ue(t){if(!confirm("Are you sure you want to clear this deck?"))return;let e=l(t);e&&(e.value="",b("",t==="deck1"?"preview1":"preview2"));let r=l(`saved-decks-${t==="deck1"?"1":"2"}`);r&&(r.value="")}window.addEventListener("load",Ie);})();
