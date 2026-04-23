const { ipcRenderer } = require('electron');
const os = require('os');
const machine_id = os.hostname();

let isExpanded = false;
let currentView = 'circle';
let currentGraphType = 'cpu';
const historySize = 30;
let cpuHistory = Array(historySize).fill(0);
let memHistory = Array(historySize).fill(0);
let sessionActive = false;
let sessionStartTime = null;
let sessionCarbon = 0;

document.getElementById('machine-name').innerText = machine_id.toUpperCase();

const GAUGE_RADIUS = 40;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;

function setView(view) {
    currentView = view;
    document.getElementById('view-circle').classList.toggle('hidden', view !== 'circle');
    document.getElementById('view-graph').classList.toggle('hidden', view !== 'graph');
    document.getElementById('btn-circle').classList.toggle('active', view === 'circle');
    document.getElementById('btn-graph').classList.toggle('active', view === 'graph');
}

function toggleExpand() {
    isExpanded = !isExpanded;
    const mini = document.getElementById('mini-widget');
    const full = document.getElementById('full-widget');

    if (isExpanded) {
        mini.classList.add('hidden');
        full.classList.remove('hidden');
        ipcRenderer.send('resize-window', { expanded: true });
    } else {
        mini.classList.remove('hidden');
        full.classList.add('hidden');
        ipcRenderer.send('resize-window', { expanded: false });
    }
}

function setGraphType(type) {
    currentGraphType = type;
    document.getElementById('sub-cpu').classList.toggle('active', type === 'cpu');
    document.getElementById('sub-mem').classList.toggle('active', type === 'mem');
    updateGraph();
}

function updateGauge(id, value) {
    const gauge = document.getElementById(id + '-gauge');
    const text = document.getElementById(id + '-text');

    const offset = GAUGE_CIRCUMFERENCE - (value / 100) * GAUGE_CIRCUMFERENCE;
    gauge.style.strokeDasharray = `${GAUGE_CIRCUMFERENCE} ${GAUGE_CIRCUMFERENCE}`;
    gauge.style.strokeDashoffset = offset;

    // Color logic (Elite: <50 Green, 50-80 Yellow, >80 Red)
    let color = 'var(--color-green)';
    if (value > 80) color = 'var(--color-red)';
    else if (value > 50) color = 'var(--color-yellow)';

    gauge.style.stroke = color;
    text.innerText = Math.round(value) + '%';
    text.style.color = color;
}

function updateGraph() {
    const cpuPath = document.getElementById('cpu-path');
    const memPath = document.getElementById('mem-path');
    const cpuArea = document.getElementById('cpu-area');
    const memArea = document.getElementById('mem-area');

    function getLineD(history) {
        return history.map((val, i) => {
            const x = (i / (historySize - 1)) * 100;
            const y = 100 - val;
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(' ');
    }

    function getAreaD(history) {
        if (!history || history.length === 0) return "";
        const lineD = getLineD(history);
        return `${lineD} L 100 100 L 0 100 Z`;
    }

    if (currentGraphType === 'cpu') {
        cpuPath.setAttribute('d', getLineD(cpuHistory));
        cpuArea.setAttribute('d', getAreaD(cpuHistory));
        memPath.setAttribute('d', '');
        memArea.setAttribute('d', '');
    } else {
        memPath.setAttribute('d', getLineD(memHistory));
        memArea.setAttribute('d', getAreaD(memHistory));
        cpuPath.setAttribute('d', '');
        cpuArea.setAttribute('d', '');
    }
}

async function fetchMetrics() {
    try {
        const res = await fetch(`http://localhost:5001/api/v1/metrics?machine_id=${machine_id}`);
        const data = await res.json();
        const latest = data[0];

        if (!latest) return;

        const cpu = latest.cpu || 0;
        const mem = latest.memory || 0;

        updateGauge('cpu', cpu);
        updateGauge('mem', mem);

        // Update Mini Labels
        document.getElementById('mini-cpu').innerText = `${Math.round(cpu)}% CPU`;

        // Update history
        cpuHistory.push(cpu);
        cpuHistory.shift();
        memHistory.push(mem);
        memHistory.shift();

        updateGraph();

        document.getElementById("net-in").innerText = Math.round(latest.network_in / 1024) + " KB/s ↓";
        document.getElementById("net-out").innerText = Math.round(latest.network_out / 1024) + " KB/s ↑";

        // Update cost and carbon
        document.getElementById("cost-val").innerText = `Cost: ₹${(latest.cost || 0).toFixed(4)}`;
        const carbonGrams = (latest.carbon || 0) * 1000;
        document.getElementById("carbon-val").innerText = `CO2: ${carbonGrams.toFixed(2)}g`;

        updateInsights(latest);

    } catch (err) {
        console.error("Fetch failed", err);
    }
}

async function fetchSummary() {
    try {
        const res = await fetch("http://localhost:5001/api/v1/summary");
        const data = await res.json();

        const totalCarbonGrams = (data.total_carbon || 0) * 1000;
        document.getElementById("total-carbon").innerText = `Total Carbon today: ${totalCarbonGrams.toFixed(1)}g CO₂`;
        document.getElementById("mini-carbon").innerText = `${totalCarbonGrams.toFixed(1)}g`;
    } catch (err) {
        console.error("Summary fetch failed", err);
    }
}

function updateInsights(latest) {
    const activity = latest.activity || "🟢 Normal development activity";
    const recommendation = latest.recommendation || "System running efficiently";

    document.getElementById("activity").innerText = activity;
    document.getElementById("recommendation").innerText = "💡 " + recommendation;

    const isIdle = activity.includes("System idle");
    const sessionEl = document.getElementById("session-container");

    if (!isIdle) {
        if (!sessionActive) {
            sessionActive = true;
            sessionStartTime = Date.now();
            sessionCarbon = 0;
        }
        sessionCarbon += (latest.carbon || 0) * 1000;

        const durationMin = Math.floor((Date.now() - sessionStartTime) / 60000);
        document.getElementById("session-time").innerText = `Session: ${durationMin}m`;
        document.getElementById("session-impact").innerText = `Impact: ${sessionCarbon.toFixed(2)}g`;
        sessionEl.classList.remove("hidden");
    } else {
        sessionActive = false;
        sessionEl.classList.add("hidden");
    }
}

// Removed local estimation as it's now handled by the agent

// Initial setup
document.querySelectorAll('.gauge-progress').forEach(g => {
    g.style.strokeDasharray = `${GAUGE_CIRCUMFERENCE} ${GAUGE_CIRCUMFERENCE}`;
    g.style.strokeDashoffset = GAUGE_CIRCUMFERENCE;
});

setInterval(fetchMetrics, 2000);
setInterval(fetchSummary, 5000);
fetchMetrics();
fetchSummary();