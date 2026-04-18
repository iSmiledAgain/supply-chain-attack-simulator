let compromisedNodes = new Set();
let globalData = null;
let svg, root, treeLayout;
let selectedTarget = null;
let running = false;
let cbMode = false;

// ---- Colour palettes ----
const PALETTE = {
    normal: {
        safe:       { fill: '#2ea043', stroke: 'none',    glow: 'drop-shadow(0 0 6px #2ea043)' },
        atRisk:     { fill: '#e3b341', stroke: 'none',    glow: 'drop-shadow(0 0 6px #e3b341)' },
        compromised:{ fill: '#da3633', stroke: 'none',    glow: 'drop-shadow(0 0 10px #da3633)' },
        flash:      '#ffffff',
        linkSafe:   '#30363d',
        linkRisk:   '#e3b341',
        linkComp:   '#da3633',
    },
    cb: {
        // Blue / Yellow-orange / High-contrast X shape handled in drawing
        safe:       { fill: '#2176ae', stroke: '#2176ae', glow: 'drop-shadow(0 0 6px #2176ae)' },
        atRisk:     { fill: '#f4a261', stroke: '#f4a261', glow: 'drop-shadow(0 0 6px #f4a261)' },
        compromised:{ fill: '#1a1a2e', stroke: '#e2e2e2', glow: 'drop-shadow(0 0 8px #e2e2e2)' },
        flash:      '#ffe066',
        linkSafe:   '#30363d',
        linkRisk:   '#f4a261',
        linkComp:   '#e2e2e2',
    }
};

function pal() { return cbMode ? PALETTE.cb : PALETTE.normal; }

// ---- Sidebar population ----
function populatePackageList(data) {
    const list = document.getElementById('package-list');
    list.innerHTML = '';
    const nodes = d3.hierarchy(data, d => d.dependencies).descendants();
    nodes.filter(d => d.depth > 0).forEach(d => {
        const item = document.createElement('div');
        item.className = 'package-item';
        item.innerText = d.data.name;
        item.onclick = () => {
            document.querySelectorAll('.package-item').forEach(el => el.classList.remove('selected'));
            item.classList.add('selected');
            selectedTarget = d.data.name;
            document.getElementById('inject-btn').disabled = false;
            setStatus(`Target locked: ${selectedTarget}`, 'warn');
        };
        list.appendChild(item);
    });
}

// ---- Load data ----
fetch('data/dependencies.json')
    .then(res => { if (!res.ok) throw new Error('Not found'); return res.json(); })
    .then(data => {
        globalData = data;
        populatePackageList(globalData);
        drawGraph(globalData);
        setStatus('Ready. Select a target.', 'ok');
    })
    .catch(() => setStatus('Error loading dependencies.json', 'error'));

// ---- Status helper ----
function setStatus(msg, type) {
    const el = document.getElementById('status-text');
    el.innerText = msg;
    el.className = 'status-' + type;
}

// ---- Find all impacted node names (leaves → root order) ----
function getImpactedNames(node, targetName) {
    const impacted = new Set();
    function walk(n) {
        const anyChildImpacted = (n.dependencies || []).some(c => { walk(c); return impacted.has(c.name); });
        if (n.name === targetName || anyChildImpacted) impacted.add(n.name);
    }
    walk(node);
    return impacted;
}

// ---- Flash the target node, then propagate ----
function injectAttack() {
    if (!selectedTarget || running) return;
    running = true;
    compromisedNodes.clear();
    document.getElementById('inject-btn').disabled = true;
    setStatus(`Injecting into ${selectedTarget}...`, 'error');

    // Find the D3 node for the target
    const targetD3 = root.descendants().find(d => d.data.name === selectedTarget);
    if (!targetD3) { running = false; return; }

    // Flash: briefly turn the target node a bright colour, then propagate
    const flashColor = pal().flash;
    const nodeCircle = svg.selectAll('.node')
        .filter(d => d.data.name === selectedTarget)
        .select(cbMode ? '.cb-shape' : 'circle');

    // 3 quick flashes over ~1.5s, then start spread
    let flashCount = 0;
    const FLASH_INTERVAL = 250; // ms per flash half-cycle
    const flashTimer = setInterval(() => {
        flashCount++;
        const isOn = flashCount % 2 === 1;

        svg.selectAll('.node')
            .filter(d => d.data.name === selectedTarget)
            .select('circle')
            .attr('fill', isOn ? flashColor : '#30363d')
            .style('filter', isOn ? `drop-shadow(0 0 14px ${flashColor})` : 'none');

        // Also flash the cb shape if present
        svg.selectAll('.node')
            .filter(d => d.data.name === selectedTarget)
            .select('.cb-shape')
            .attr('fill', isOn ? flashColor : '#30363d');

        if (flashCount >= 6) {
            clearInterval(flashTimer);
            startPropagation(selectedTarget);
        }
    }, FLASH_INTERVAL);
}

function startPropagation(targetName) {
    const impacted = getImpactedNames(globalData, targetName);
    const ordered = root.descendants()
        .filter(d => impacted.has(d.data.name))
        .sort((a, b) => b.depth - a.depth); // deepest (leaves) first

    let i = 0;
    const iv = setInterval(() => {
        if (i >= ordered.length) {
            clearInterval(iv);
            running = false;
            document.getElementById('inject-btn').disabled = false;
            setStatus('CRITICAL: System compromised.', 'error');
            return;
        }
        compromisedNodes.add(ordered[i].data.name);
        updateGraph();
        i++;
    }, 1100); // slower — one node every 1.1 s
}

function doReset() {
    if (running) return;
    compromisedNodes.clear();
    document.querySelectorAll('.package-item').forEach(el => el.classList.remove('selected'));
    selectedTarget = null;
    document.getElementById('inject-btn').disabled = true;
    updateGraph();
    setStatus('Ready. Select a target.', 'ok');
}

function toggleCB() {
    cbMode = document.getElementById('cb-toggle').checked;
    updateLegend();
    updateGraph();
}

// ---- Draw (once) ----
function drawGraph(data) {
    const container = document.getElementById('graph');
    const width = container.clientWidth || 900;
    const height = container.clientHeight || 580;

    svg = d3.select('#graph').append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', 'translate(100,0)');

    treeLayout = d3.tree().size([height - 40, width - 300]);
    root = d3.hierarchy(data, d => d.dependencies);
    updateGraph(true);
    updateLegend();
}

// ---- Update graph colours / shapes ----
function updateGraph(initial = false) {
    treeLayout(root);
    const nodes = root.descendants();
    const links = root.links();
    const p = pal();

    nodes.forEach(d => {
        d.data.compromised = compromisedNodes.has(d.data.name);
        d.data.atRisk = !d.data.compromised &&
            (d.data.dependencies || []).some(c => compromisedNodes.has(c.name));
    });

    const linkGen = d3.linkHorizontal().x(d => d.y).y(d => d.x);

    // Links
    if (initial) {
        svg.selectAll('.link').data(links).enter()
            .append('path').attr('class', 'link').attr('d', linkGen);
    }
    svg.selectAll('.link').data(links)
        .transition().duration(600)
        .attr('d', linkGen)
        .attr('stroke', d =>
            d.target.data.compromised ? p.linkComp :
            d.target.data.atRisk      ? p.linkRisk : p.linkSafe)
        .attr('stroke-width', d => d.target.data.compromised ? 3 : 1.5)
        .attr('stroke-dasharray', d =>
            cbMode && d.target.data.compromised ? '6 3' :
            cbMode && d.target.data.atRisk      ? '4 4' : 'none');

    // Nodes
    const node = svg.selectAll('.node').data(nodes, d => d.data.name);

    const enter = node.enter().append('g')
        .attr('class', 'node')
        .attr('transform', d => `translate(${d.y},${d.x})`);

    // Always add a circle (used in normal mode)
    enter.append('circle').attr('r', 8).attr('fill', '#30363d');
    // CB shape overlay (diamond for atRisk, square for compromised — handled via fill+stroke trick)
    enter.append('polygon').attr('class', 'cb-shape').style('display', 'none');
    enter.append('text').attr('dy', '.35em').attr('x', 16).text(d => d.data.name);

    const all = enter.merge(node);
    all.transition().duration(600).attr('transform', d => `translate(${d.y},${d.x})`);

    // Normal mode: circles only
    if (!cbMode) {
        all.select('circle').style('display', null)
            .transition().duration(600)
            .attr('r', d => d.data.compromised ? 13 : 8)
            .attr('fill', d =>
                d.data.compromised ? p.compromised.fill :
                d.data.atRisk      ? p.atRisk.fill : p.safe.fill)
            .style('filter', d =>
                d.data.compromised ? p.compromised.glow :
                d.data.atRisk      ? p.atRisk.glow : p.safe.glow);
        all.select('.cb-shape').style('display', 'none');
        all.select('text').attr('x', 16);
    } else {
        // CB mode: circle for safe, diamond for atRisk, square+X for compromised
        all.select('circle').style('display', null)
            .transition().duration(600)
            .attr('r', d => (d.data.compromised || d.data.atRisk) ? 0 : 8)
            .attr('fill', p.safe.fill)
            .style('filter', d => (!d.data.compromised && !d.data.atRisk) ? p.safe.glow : 'none');

        // Draw the cb shape using a <polygon> repurposed per state
        all.each(function(d) {
            const g = d3.select(this);
            // Remove any old X lines
            g.selectAll('.cb-x').remove();

            if (d.data.atRisk) {
                // Diamond
                const s = 10;
                g.select('.cb-shape').style('display', null)
                    .attr('points', `0,${-s} ${s},0 0,${s} ${-s},0`)
                    .attr('fill', p.atRisk.fill)
                    .attr('stroke', 'none')
                    .style('filter', p.atRisk.glow);
            } else if (d.data.compromised) {
                // Dark square
                const s = 10;
                g.select('.cb-shape').style('display', null)
                    .attr('points', `${-s},${-s} ${s},${-s} ${s},${s} ${-s},${s}`)
                    .attr('fill', p.compromised.fill)
                    .attr('stroke', p.compromised.stroke)
                    .attr('stroke-width', 1.5)
                    .style('filter', p.compromised.glow);
                // Draw X
                g.append('line').attr('class','cb-x')
                    .attr('x1',-6).attr('y1',-6).attr('x2',6).attr('y2',6)
                    .attr('stroke','#e2e2e2').attr('stroke-width',2).attr('stroke-linecap','round');
                g.append('line').attr('class','cb-x')
                    .attr('x1',6).attr('y1',-6).attr('x2',-6).attr('y2',6)
                    .attr('stroke','#e2e2e2').attr('stroke-width',2).attr('stroke-linecap','round');
            } else {
                g.select('.cb-shape').style('display', 'none');
            }
        });
        all.select('text').attr('x', 16);
    }
}

// ---- Legend ----
function updateLegend() {
    const el = document.getElementById('legend-items');
    if (!cbMode) {
        el.innerHTML = `
          <div class="legend-item"><span class="legend-dot" style="background:#2ea043"></span>Safe</div>
          <div class="legend-item"><span class="legend-dot" style="background:#e3b341"></span>At Risk</div>
          <div class="legend-item"><span class="legend-dot" style="background:#da3633"></span>Compromised</div>`;
    } else {
        el.innerHTML = `
          <div class="legend-item">
            <svg width="14" height="14" style="flex-shrink:0;overflow:visible">
              <circle cx="7" cy="7" r="6" fill="#2176ae"/>
            </svg>Safe (circle)
          </div>
          <div class="legend-item">
            <svg width="14" height="14" style="flex-shrink:0;overflow:visible">
              <polygon points="7,1 13,7 7,13 1,7" fill="#f4a261"/>
            </svg>At risk (diamond)
          </div>
          <div class="legend-item">
            <svg width="14" height="14" style="flex-shrink:0;overflow:visible">
              <rect x="1" y="1" width="12" height="12" rx="1" fill="#1a1a2e" stroke="#e2e2e2" stroke-width="1.2"/>
              <line x1="3" y1="3" x2="11" y2="11" stroke="#e2e2e2" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="11" y1="3" x2="3" y2="11" stroke="#e2e2e2" stroke-width="1.5" stroke-linecap="round"/>
            </svg>Compromised (×)
          </div>
          <div class="legend-item" style="margin-top:4px;color:#7d8590;font-size:10px">Edges: dashed = infected path</div>`;
    }
}
