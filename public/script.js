// Mana symbol helpers
const cardDataCache = {};
const cardTypeCache = {};
const cardCmcCache = {};
let lastDiffResult = null;
let groupingMode = 'none';
let fetchQueue = new Set();
let fetchTimeout = null;

function getManaHtml(manaCost) {
    if (!manaCost) return '';
    return manaCost.replace(/{([^}]+)}/g, (match, symbol) => {
        // Special case for split symbols like {R/G} -> R-G
        let cleanSymbol = symbol.replace('/', '-').toUpperCase();
        // Handle "T" as Tap symbol if it appears in cost (unlikely but safe)
        if (cleanSymbol === 'T') cleanSymbol = 'T';
        // Handle Phyrexian Mana {R/P} -> RP.svg or R-P.svg? Scryfall uses R-P.
        cleanSymbol = cleanSymbol.replace('/', '-'); 
        
        return `<img src="https://svgs.scryfall.io/card-symbols/${cleanSymbol}.svg" class="w-3 h-3 inline-block mx-[1px]" alt="${symbol}">`;
    });
}

function updateManaSymbolsInContainers(containers) {
    containers.forEach(containerId => {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const placeholders = container.querySelectorAll('.mana-placeholder');
        placeholders.forEach(span => {
            const name = span.getAttribute('data-name');
            if (cardDataCache[name] !== undefined) {
                span.innerHTML = getManaHtml(cardDataCache[name]);
                span.classList.remove('mana-placeholder');
                span.classList.add('mana-rendered');
            }
        });
    });
}

async function fetchManaData(cardNames, containers) {
    // Filter need-to-fetch
    const toFetch = cardNames.filter(name => !cardDataCache[name] && cardDataCache[name] !== '');

    if(toFetch.length === 0) {
        // All cached
        updateManaSymbolsInContainers(containers);
        return;
    }

    // Process in batches of 75
    const chunks = [];
    for (let i = 0; i < toFetch.length; i += 75) {
        chunks.push(toFetch.slice(i, i + 75));
    }

    for (const chunk of chunks) {
        try {
            const response = await fetch('https://api.scryfall.com/cards/collection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    identifiers: chunk.map(name => ({ name })) 
                })
            });
            const data = await response.json();
            
            if (data.data) {
                data.data.forEach(card => {
                    // Handle split cards or normal cards
                    let mana = card.mana_cost;
                    let type = card.type_line;
                    let cmc = card.cmc;
                    if (!mana && card.card_faces && card.card_faces.length > 0) {
                        mana = card.card_faces[0].mana_cost;
                    }
                    if (!type && card.card_faces && card.card_faces.length > 0) {
                        type = card.card_faces[0].type_line;
                    }
                    cardDataCache[card.name] = mana || '';
                    cardTypeCache[card.name] = type || '';
                    cardCmcCache[card.name] = cmc !== undefined ? cmc : 0;
                });
            }
            // Mark not founds as empty string to prevent refetch
            if (data.not_found) {
                data.not_found.forEach(item => {
                    cardDataCache[item.name] = '';
                    cardTypeCache[item.name] = '';
                    cardCmcCache[item.name] = 0;
                });
            }
        } catch (e) {
            console.error("Failed to fetch mana costs", e);
        }
    }
    
    updateManaSymbolsInContainers(containers);
    updateTypeStatsDisplay();
}

function queueManaFetch(containerIds) {
    // Collect all unique names from these containers
    const names = new Set();
    containerIds.forEach(id => {
        const container = document.getElementById(id);
        if (container) {
            container.querySelectorAll('.mana-placeholder').forEach(el => {
                names.add(el.getAttribute('data-name'));
            });
        }
    });

    if (names.size === 0) return;

    if (fetchTimeout) clearTimeout(fetchTimeout);
    
    // Add to global queue
    names.forEach(n => fetchQueue.add(n));

    // Debounce execution
    fetchTimeout = setTimeout(() => {
        const batch = Array.from(fetchQueue);
        fetchQueue.clear();
        fetchManaData(batch, containerIds);
    }, 500); // Wait 500ms after last input
}

function updatePreview(inputId, previewId) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    const text = input.value;
    
    // Save to localStorage
    localStorage.setItem(inputId, text);
    
    if (!text.trim()) {
        preview.innerHTML = '';
        preview.classList.add('hidden');
        return;
    }
    
    preview.classList.remove('hidden');

    const lines = text.split('\n');
    const formattedHTML = lines.map(line => {
        line = line.trim();
        const match = line.match(/^(\d+)\s+(.+?)(?:\s+\(|$)/);
        if (match) {
             const name = match[2];
             const safeName = name.replace(/"/g, '&quot;');
             
             // Check cache for immediate render
             let manaHtml = '';
             let placeholderClass = 'mana-placeholder';
             
             if (cardDataCache[name]) {
                 manaHtml = getManaHtml(cardDataCache[name]);
                 placeholderClass = 'mana-rendered';
             }

             return `<div>
                ${match[1]} <span class="card-hover text-violet-400 font-medium" data-name="${safeName}">${name}</span> 
                <span class="${placeholderClass} ml-1 inline-flex items-center" data-name="${safeName}">${manaHtml}</span>
                ${line.substring(match[0].length).trim() ? '...' : ''}
             </div>`;
        }
        
        if (line.toUpperCase().startsWith('SIDEBOARD:')) {
            return `<div class="font-bold text-zinc-500 mt-2">${line}</div>`;
        }
        
        // For other lines, just print them if they have content
        if (line) return `<div>${line}</div>`;
        return '';
    }).join('');
    
    preview.innerHTML = formattedHTML;

    // Trigger fetch for any placeholders
    queueManaFetch(['preview1', 'preview2']);
}

function parseDeck(text) {
    const main = {};
    const side = {};
    let isSideboard = false;

    const lines = text.split('\n');
    for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        if (line.toUpperCase().startsWith('SIDEBOARD:')) {
            isSideboard = true;
            continue;
        }

        // Parse: Quantity Name (Set) ...
        const match = line.match(/^(\d+)\s+(.+?)(?:\s+\(|$)/);
        if (match) {
            const qty = parseInt(match[1], 10);
            const name = match[2].trim();
            const target = isSideboard ? side : main;
            target[name] = (target[name] || 0) + qty;
        }
    }
    return { main, side };
}

function getDiff(source, target) {
    const cuts = [];
    const adds = [];

    // Check source against target (for cuts)
    for (const [card, qty] of Object.entries(source)) {
        const targetQty = target[card] || 0;
        if (qty > targetQty) {
            cuts.push({ name: card, count: qty - targetQty });
        }
    }

    // Check target against source (for adds)
    for (const [card, qty] of Object.entries(target)) {
        const sourceQty = source[card] || 0;
        if (qty > sourceQty) {
            adds.push({ name: card, count: qty - sourceQty });
        }
    }

    return { cuts, adds };
}

function renderCard(item, type) {
    const className = type === 'add' ? 'card-add' : 'card-remove';
    const safeName = item.name.replace(/"/g, '&quot;');
    
    // Check cache for immediate render
    let manaHtml = '';
    let placeholderClass = 'mana-placeholder';
    
    if (cardDataCache[item.name]) {
        manaHtml = getManaHtml(cardDataCache[item.name]);
        placeholderClass = 'mana-rendered';
    }

    return `<div class="${className} ml-4 flex items-center">
        ${item.count} <span class="card-hover text-violet-400 hover:text-violet-300 mx-1" data-name="${safeName}">${item.name}</span>
        <span class="${placeholderClass} inline-flex items-center" data-name="${safeName}">${manaHtml}</span>
    </div>`;
}

function getType(typeLine) {
    if (typeLine === undefined) return 'Unknown'; 
    if (!typeLine) return 'Other';
    if (typeLine.includes('Land')) return 'Land';
    if (typeLine.includes('Creature')) return 'Creature';
    if (typeLine.includes('Planeswalker')) return 'Planeswalker';
    if (typeLine.includes('Instant')) return 'Instant';
    if (typeLine.includes('Sorcery')) return 'Sorcery';
    if (typeLine.includes('Enchantment')) return 'Enchantment'; 
    if (typeLine.includes('Artifact')) return 'Artifact'; 
    if (typeLine.includes('Battle')) return 'Battle';
    return 'Other';
}

function groupByCategory(items) {
    const groups = {};
    const order = ['Land', 'Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Battle', 'Other', 'Unknown'];
    
    items.forEach(item => {
        const type = getType(cardTypeCache[item.name]);
        if (!groups[type]) groups[type] = [];
        groups[type].push(item);
    });
    
    return order.filter(t => groups[t]).map(t => ({ label: t, items: groups[t] }));
}

function groupByCmc(items) {
    const groups = {};
    
    items.forEach(item => {
        const cmc = cardCmcCache[item.name] !== undefined ? Math.round(cardCmcCache[item.name]) : 0;
        const key = cmc.toString();
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
    });
    
    const sortedKeys = Object.keys(groups).map(Number).sort((a, b) => a - b);
    return sortedKeys.map(k => ({ label: k === 0 ? '0' : k.toString(), items: groups[k.toString()] }));
}

function renderGroupedCards(items, type) {
    if (groupingMode === 'none') {
        return items.sort((a, b) => a.name.localeCompare(b.name)).map(i => renderCard(i, type)).join('');
    }
    
    const groups = groupingMode === 'category' ? groupByCategory(items) : groupByCmc(items);
    
    return groups.map(group => {
        const sortedItems = group.items.sort((a, b) => a.name.localeCompare(b.name));
        const cardsHtml = sortedItems.map(i => renderCard(i, type)).join('');
        const label = groupingMode === 'cmc' ? `CMC ${group.label}` : group.label;
        return `<div class="mb-3">
            <div class="text-xs text-zinc-500 uppercase tracking-wider mb-1 ml-2">${label}</div>
            ${cardsHtml}
        </div>`;
    }).join('');
}

function calculateDiff() {
    const deck1Text = document.getElementById('deck1').value;
    const deck2Text = document.getElementById('deck2').value;

    // Ensure previews are up to date
    updatePreview('deck1', 'preview1');
    updatePreview('deck2', 'preview2');

    const d1 = parseDeck(deck1Text);
    const d2 = parseDeck(deck2Text);

    const mainDiff = getDiff(d1.main, d2.main);
    const sideDiff = getDiff(d1.side, d2.side);

    // Save for stats
    lastDiffResult = { mainDiff, sideDiff };
    updateTypeStatsDisplay();

    const removeContainer = document.getElementById('diff-remove');
    const addContainer = document.getElementById('diff-add');

    let removeHTML = '';
    if (mainDiff.cuts.length > 0) {
        removeHTML += `<div class="font-bold text-zinc-400 mb-2">Mainboard</div>`;
        removeHTML += renderGroupedCards(mainDiff.cuts, 'remove');
    }
    if (sideDiff.cuts.length > 0) {
        removeHTML += `<div class="font-bold text-zinc-400 mb-2 mt-4">Sideboard</div>`;
        removeHTML += renderGroupedCards(sideDiff.cuts, 'remove');
    }
    if (!removeHTML) removeHTML = '<div class="text-zinc-500 italic">No cards removed</div>';
    removeContainer.innerHTML = removeHTML;


    let addHTML = '';
    if (mainDiff.adds.length > 0) {
        addHTML += `<div class="font-bold text-zinc-400 mb-2">Mainboard</div>`;
        addHTML += renderGroupedCards(mainDiff.adds, 'add');
    }
    if (sideDiff.adds.length > 0) {
        addHTML += `<div class="font-bold text-zinc-400 mb-2 mt-4">Sideboard</div>`;
        addHTML += renderGroupedCards(sideDiff.adds, 'add');
    }
    if (!addHTML) addHTML = '<div class="text-zinc-500 italic">No cards added</div>';
    addContainer.innerHTML = addHTML;

    // Show/hide print button
    const printBtn = document.getElementById('print-btn');
    if (mainDiff.adds.length > 0 || sideDiff.adds.length > 0) {
        if(printBtn) printBtn.classList.remove('hidden');
    } else {
        if(printBtn) printBtn.classList.add('hidden');
    }

    // Update stats
    document.getElementById('stat-main-cuts').textContent = mainDiff.cuts.reduce((a,b) => a + b.count, 0);
    document.getElementById('stat-main-adds').textContent = mainDiff.adds.reduce((a,b) => a + b.count, 0);
    document.getElementById('stat-side-cuts').textContent = sideDiff.cuts.reduce((a,b) => a + b.count, 0);
    document.getElementById('stat-side-adds').textContent = sideDiff.adds.reduce((a,b) => a + b.count, 0);

    document.getElementById('results').classList.remove('hidden');
    document.getElementById('stats').classList.remove('hidden');

    // Fetch and render mana for results
    // We can't rely only on the debounced preview fetch because results might contain removed cards not in current inputs?
    // Actually results are subsets of inputs so fetchQueue logic handles it if we call it.
    queueManaFetch(['diff-remove', 'diff-add']);
}

function updateTypeStatsDisplay() {
    if (!lastDiffResult) return;
    
    const { mainDiff } = lastDiffResult;
    
    const stats = {};
    const initStat = (t) => { if (!stats[t]) stats[t] = { add: 0, cut: 0 }; };

    mainDiff.cuts.forEach(item => {
        const t = getType(cardTypeCache[item.name]);
        initStat(t);
        stats[t].cut += item.count;
    });
    
    mainDiff.adds.forEach(item => {
        const t = getType(cardTypeCache[item.name]);
        initStat(t);
        stats[t].add += item.count;
    });
    
    const container = document.getElementById('type-stats-grid');
    const wrapper = document.getElementById('type-stats-container');
    if (!container || !wrapper) return;
    
    let html = '';
    const sortedTypes = Object.keys(stats).sort(); // Alphabetical is fine, or custom order
    
    // Custom sort order
    const order = ['Land', 'Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Battle', 'Other', 'Unknown'];
    sortedTypes.sort((a,b) => order.indexOf(a) - order.indexOf(b));

    for (const type of sortedTypes) {
        if (type === 'Unknown') continue; 
        
        const data = stats[type];
        if (data.add === 0 && data.cut === 0) continue;
        
        const change = data.add - data.cut;
        let colorClass = 'text-zinc-500';
        let sign = '';
        if (change > 0) { colorClass = 'text-green-400 font-bold'; sign = '+'; }
        if (change < 0) { colorClass = 'text-red-400 font-bold'; }
        
        html += `
            <div class="flex flex-col">
                <span class="text-xs text-zinc-400 uppercase tracking-wider">${type}</span>
                <span class="${colorClass} text-lg">${sign}${change} <span class="text-xs font-normal text-zinc-500 align-middle ml-1">(+${data.add} / -${data.cut})</span></span>
            </div>
        `;
    }
    
    container.innerHTML = html;
    if (html) {
         wrapper.classList.remove('hidden');
    } else {
         wrapper.classList.add('hidden');
    }
}

// --- Deck Storage Logic ---

function getSavedDecks() {
    const saved = localStorage.getItem('mtg-diff-saved-decks');
    return saved ? JSON.parse(saved) : {};
}

function updateDeckDropdowns() {
    const savedDecks = getSavedDecks();
    const selects = ['saved-decks-1', 'saved-decks-2'];
    
    selects.forEach(id => {
        const select = document.getElementById(id);
        if(!select) return;
        
        const currentValue = select.value;
        
        // Clear current options except first
        while (select.options.length > 1) {
            select.remove(1);
        }
        
        // Sort decks by name
        const deckNames = Object.keys(savedDecks).sort();
        
        deckNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            select.appendChild(option);
        });

        // Restore selection if it still exists
        if (savedDecks[currentValue]) {
            select.value = currentValue;
        } else {
             select.value = "";
        }
    });
}

function saveDeck(deckId, nameInputId) {
    const deckContent = document.getElementById(deckId).value;
    const nameInput = document.getElementById(nameInputId);
    const deckName = nameInput.value.trim();
    
    if (!deckName) {
        alert("Please enter a name for the deck.");
        return;
    }
    
    if (!deckContent.trim()) {
        alert("The deck is empty. Cannot save.");
        return;
    }

    const savedDecks = getSavedDecks();
    
    // Check for overwrite
    if (savedDecks[deckName] && !confirm(`Overwrite existing deck "${deckName}"?`)) {
        return;
    }

    savedDecks[deckName] = deckContent;
    localStorage.setItem('mtg-diff-saved-decks', JSON.stringify(savedDecks));
    
    updateDeckDropdowns();
    nameInput.value = ''; // Clear input after save
    
    // Auto-select the newly saved deck in the dropdown for this column
    const colIndex = deckId === 'deck1' ? '1' : '2';
    const dropDown = document.getElementById(`saved-decks-${colIndex}`);
    if(dropDown) dropDown.value = deckName;
}

function loadDeck(deckId, deckName, selectId) {
    if (!deckName) return; 
    
    const savedDecks = getSavedDecks();
    const content = savedDecks[deckName];
    
    if (content) {
        document.getElementById(deckId).value = content;
        
        // Trigger updatePreview
        const previewId = deckId === 'deck1' ? 'preview1' : 'preview2';
        updatePreview(deckId, previewId);
    }
}

function clearDeck(deckId) {
    if (confirm("Are you sure you want to clear this deck?")) {
        document.getElementById(deckId).value = '';
        const previewId = deckId === 'deck1' ? 'preview1' : 'preview2';
        updatePreview(deckId, previewId);
        
        // Reset dropdown
        const colIndex = deckId === 'deck1' ? '1' : '2';
        const dd = document.getElementById(`saved-decks-${colIndex}`);
        if(dd) dd.value = "";
    }
}

// --- Print Logic ---

function printAddedCards() {
    const deck1Text = document.getElementById('deck1').value;
    const deck2Text = document.getElementById('deck2').value;

    const d1 = parseDeck(deck1Text);
    const d2 = parseDeck(deck2Text);

    // Re-calculate basic diff to get added cards
    const mainDiff = getDiff(d1.main, d2.main);
    const sideDiff = getDiff(d1.side, d2.side);
    
    let allCards = [];
    
    // Add Mainboard Adds
    mainDiff.adds.forEach(item => {
        for(let i=0; i < item.count; i++) allCards.push(item.name);
    });
    
    // Add Sideboard Adds
    sideDiff.adds.forEach(item => {
        for(let i=0; i < item.count; i++) allCards.push(item.name);
    });

    if (allCards.length === 0) {
        alert("No added cards to print!");
        return;
    }

    // Chunk cards into groups of 9 (3x3 grid)
    const chunkSize = 9;
    const chunks = [];
    for (let i = 0; i < allCards.length; i += chunkSize) {
        chunks.push(allCards.slice(i, i + chunkSize));
    }

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>mtg-diff · print proxies</title>
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
                <span style="margin-left:10px;">mtg-diff · print proxies</span>
            </div>

            <div class="controls">
                <div class="controls-label">// print proxies</div>
                <p>click ✕ on cards to remove · then hit print</p>
                <div>
                    <button class="btn-primary" onclick="setTimeout(() => window.print(), 100)">&gt;_ print now</button>
                    <button class="btn-secondary" onclick="window.close()">close</button>
                </div>
            </div>

            <div class="pages-wrapper" id="pages-container"></div>

            <script>
                const validCards = ${JSON.stringify(allCards)};
                const PAGE_SIZE = 9;

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
                           // Calculate absolute index in validCards array
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
                    renderPages(); // Re-render to reflow grid
                }

                // Initial render
                renderPages();
            </script>
        </body>
        </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');
    if (!printWindow) {
        alert("Please allow popups to print proxies.");
    }
}

// Tooltip logic
const tooltip = document.getElementById('card-tooltip');
let currentCardName = null;

document.addEventListener('mouseover', (e) => {
    if (e.target.classList.contains('card-hover')) {
        const cardName = e.target.getAttribute('data-name');
        if (currentCardName !== cardName) {
            currentCardName = cardName;
            tooltip.src = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}&format=image`;
            tooltip.style.display = 'block';
        } else {
            tooltip.style.display = 'block';
        }
    }
});

document.addEventListener('mousemove', (e) => {
    if (tooltip.style.display === 'block') {
        const xOffset = 20;
        const yOffset = 20;
        let left = e.clientX + xOffset;
        let top = e.clientY + yOffset;

        if (left + 260 > window.innerWidth) { // 240 width + 20 offset
            left = e.clientX - 260; 
        }
        if (top + 360 > window.innerHeight) { // 340 height (approx) + 20 offset
            top = e.clientY - 360; 
        }

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    }
});

document.addEventListener('mouseout', (e) => {
     if (e.target.classList.contains('card-hover')) {
        tooltip.style.display = 'none';
        currentCardName = null;
        tooltip.src = '';
    }
});

// Initialize from localStorage
window.addEventListener('load', () => {
    const savedGrouping = localStorage.getItem('mtg-diff-grouping');
    if (savedGrouping && ['none', 'category', 'cmc'].includes(savedGrouping)) {
        groupingMode = savedGrouping;
        const select = document.getElementById('grouping-select');
        if (select) select.value = savedGrouping;
    }
    
    const d1 = localStorage.getItem('deck1');
    if (d1) {
        document.getElementById('deck1').value = d1;
        updatePreview('deck1', 'preview1');
    }
    
    const d2 = localStorage.getItem('deck2');
    if (d2) {
        document.getElementById('deck2').value = d2;
        updatePreview('deck2', 'preview2');
    }
});

function setGroupingMode(mode) {
    groupingMode = mode;
    localStorage.setItem('mtg-diff-grouping', mode);
    if (lastDiffResult) {
        calculateDiff();
    }
}

function copyToClipboard(elementId, btnElement) {
    const container = document.getElementById(elementId);
    if (!container) return;

    // Extract text manually to single-space lines and avoid layout-based gaps
    const lines = [];
    Array.from(container.children).forEach(child => {
        // Collapse internal whitespace (newlines in HTML) to single spaces
        const line = child.textContent.replace(/\s+/g, ' ').trim();
        if (line) lines.push(line);
    });

    const text = lines.join('\n');

    if (!text || text === 'No cards removed' || text === 'No cards added') {
        alert('Nothing to copy.');
        return;
    }

    navigator.clipboard.writeText(text).then(() => {
        // Visual feedback
        const originalContent = btnElement.innerHTML;
        btnElement.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>`;
        setTimeout(() => {
            btnElement.innerHTML = originalContent;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
        alert('Failed to copy to clipboard');
    });
}

