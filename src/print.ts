import { DeckDiff } from './card';

const PAGE_SIZE = 9;

export function generatePrintPage(diff: DeckDiff): void {
  const allCards: string[] = [];

  for (const item of diff.mainDiff.adds) {
    for (let i = 0; i < item.count; i++) {
      allCards.push(item.name);
    }
  }

  for (const item of diff.sideDiff.adds) {
    for (let i = 0; i < item.count; i++) {
      allCards.push(item.name);
    }
  }

  if (allCards.length === 0) {
    alert('No added cards to print!');
    return;
  }

  const htmlContent = buildPrintHTML(allCards);
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, '_blank');

  if (!printWindow) {
    alert('Please allow popups to print proxies.');
  }
}

function buildPrintHTML(cards: string[]): string {
  const escapedCards = JSON.stringify(cards);

  return `<!DOCTYPE html>
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
    const validCards = ${escapedCards};
    const PAGE_SIZE = ${PAGE_SIZE};

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
  </script>
</body>
</html>`;
}
