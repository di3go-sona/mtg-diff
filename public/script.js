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
             
             // Simply reconstruct the line with the linked name
             return `<div>${match[1]} <span class="card-hover text-blue-600 font-medium" data-name="${safeName}">${name}</span> ${line.substring(match[0].length).trim() ? '...' : ''}</div>`;
        }
        
        if (line.toUpperCase().startsWith('SIDEBOARD:')) {
            return `<div class="font-bold text-gray-500 mt-2">${line}</div>`;
        }
        
        // For other lines, just print them if they have content
        if (line) return `<div>${line}</div>`;
        return '';
    }).join('');
    
    preview.innerHTML = formattedHTML;
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
    return `<div class="${className} ml-4">
        ${item.count} <span class="card-hover border-b border-dotted hover:text-blue-600" data-name="${safeName}">${item.name}</span>
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

    // Update stats
    document.getElementById('stat-main-cuts').textContent = mainDiff.cuts.reduce((a,b) => a + b.count, 0);
    document.getElementById('stat-main-adds').textContent = mainDiff.adds.reduce((a,b) => a + b.count, 0);
    document.getElementById('stat-side-cuts').textContent = sideDiff.cuts.reduce((a,b) => a + b.count, 0);
    document.getElementById('stat-side-adds').textContent = sideDiff.adds.reduce((a,b) => a + b.count, 0);

    document.getElementById('results').classList.remove('hidden');
    document.getElementById('stats').classList.remove('hidden');
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