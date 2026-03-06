// Mana symbol helpers
const cardDataCache = {};
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
                    if (!mana && card.card_faces && card.card_faces.length > 0) {
                        mana = card.card_faces[0].mana_cost;
                        // optionally join faces: 
                        // mana = card.card_faces.map(f => f.mana_cost).join(' // ');
                    }
                    cardDataCache[card.name] = mana || '';
                });
            }
            // Mark not founds as empty string to prevent refetch
            if (data.not_found) {
                data.not_found.forEach(item => {
                    cardDataCache[item.name] = '';
                });
            }
        } catch (e) {
            console.error("Failed to fetch mana costs", e);
        }
    }
    
    updateManaSymbolsInContainers(containers);
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
                ${match[1]} <span class="card-hover text-blue-600 font-medium" data-name="${safeName}">${name}</span> 
                <span class="${placeholderClass} ml-1 inline-flex items-center" data-name="${safeName}">${manaHtml}</span>
                ${line.substring(match[0].length).trim() ? '...' : ''}
             </div>`;
        }
        
        if (line.toUpperCase().startsWith('SIDEBOARD:')) {
            return `<div class="font-bold text-gray-500 mt-2">${line}</div>`;
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
        ${item.count} <span class="card-hover border-b border-dotted hover:text-blue-600 mx-1" data-name="${safeName}">${item.name}</span>
        <span class="${placeholderClass} inline-flex items-center" data-name="${safeName}">${manaHtml}</span>
    </div>`;
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

    const removeContainer = document.getElementById('diff-remove');
    const addContainer = document.getElementById('diff-add');

    let removeHTML = '';
    if (mainDiff.cuts.length > 0) {
        removeHTML += `<div class="font-bold text-gray-700 mb-2">Mainboard</div>`;
        mainDiff.cuts.sort((a,b) => a.name.localeCompare(b.name)).forEach(i => {
            removeHTML += renderCard(i, 'remove');
        });
    }
    if (sideDiff.cuts.length > 0) {
        removeHTML += `<div class="font-bold text-gray-700 mb-2 mt-4">Sideboard</div>`;
        sideDiff.cuts.sort((a,b) => a.name.localeCompare(b.name)).forEach(i => {
            removeHTML += renderCard(i, 'remove');
        });
    }
    if (!removeHTML) removeHTML = '<div class="text-gray-400 italic">No cards removed</div>';
    removeContainer.innerHTML = removeHTML;


    let addHTML = '';
    if (mainDiff.adds.length > 0) {
        addHTML += `<div class="font-bold text-gray-700 mb-2">Mainboard</div>`;
        mainDiff.adds.sort((a,b) => a.name.localeCompare(b.name)).forEach(i => {
            addHTML += renderCard(i, 'add');
        });
    }
    if (sideDiff.adds.length > 0) {
        addHTML += `<div class="font-bold text-gray-700 mb-2 mt-4">Sideboard</div>`;
        sideDiff.adds.sort((a,b) => a.name.localeCompare(b.name)).forEach(i => {
            addHTML += renderCard(i, 'add');
        });
    }
    if (!addHTML) addHTML = '<div class="text-gray-400 italic">No cards added</div>';
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

    // Use Blob URL instead of document.write
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Print Proxies (${allCards.length} cards)</title>
            <style>
                @page { margin: 1cm; size: auto; }
                body { margin: 0; padding: 20px; font-family: system-ui, sans-serif; background: #f0f0f0; }
                
                .controls { 
                    background: white; 
                    padding: 20px; 
                    border-radius: 8px; 
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
                    margin-bottom: 2rem; 
                    text-align: center;
                    max-width: 600px;
                    margin-left: auto;
                    margin-right: auto; 
                }
                
                .grid { 
                    display: grid; 
                    grid-template-columns: repeat(3, 1fr); 
                    gap: 0; 
                    width: 100%; 
                    max-width: 190mm; /* Close to printable width on A4/Letter */
                    margin: 0 auto; 
                    background: white;
                }
                
                .card-container { 
                    position: relative; 
                    width: 100%; 
                    /* 63mm / 88mm ratio is roughly 0.715. Padding bottom is inverse aspect ratio ~140% */
                    padding-bottom: 139.6%; 
                    overflow: hidden; 
                    background: #eee;
                    border: 0.5px dashed #ddd; /* Light guide for cutting */
                    box-sizing: border-box;
                }
                
                .card-container img { 
                    position: absolute; 
                    top: 0; 
                    left: 0; 
                    width: 100%; 
                    height: 100%; 
                    object-fit: cover; 
                }

                @media print {
                    @page { margin: 0.5cm; }
                    body { background: white; padding: 0; }
                    .controls { display: none; }
                    .grid { max-width: 100%; width: 100%; }
                    .card-container { border: 1px dashed #ccc; } /* Keep dash lines for cutting guides */
                }
            </style>
        </head>
        <body>
            <div class="controls">
                <h2 style="margin-top:0">Print Proxies</h2>
                <p>Generating ${allCards.length} cards. Images calculate layout for A4/Letter paper (3x3 grid).</p>
                <div style="margin-top: 15px;">
                    <button onclick="window.print()" style="background: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 16px;">Print Now</button>
                    <button onclick="window.close()" style="background: #e5e7eb; color: #374151; border: none; padding: 10px 20px; border-radius: 6px; margin-left: 10px; cursor: pointer;">Close</button>
                </div>
            </div>
            
            <div class="grid">
                ${allCards.map(name => {
                    const safeName = encodeURIComponent(name);
                    return `<div class="card-container">
                        <img src="https://api.scryfall.com/cards/named?exact=${safeName}&format=image" 
                             alt="${name}" 
                             loading="eager"
                             onerror="this.parentElement.innerHTML='<div style=\\'position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:10px;font-size:12px\\'>Image not found:<br><strong>${name}</strong></div>'">
                    </div>`;
                }).join('')}
            </div>
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
