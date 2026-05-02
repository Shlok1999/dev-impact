const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
require('dotenv').config();
const { detectActivity, getRecommendation } = require("./services/intelligence");

const app = express();
app.use(cors());
app.use(express.json());

// Database connection
const db = new Database('infra_observer.db');
db.pragma('journal_mode = WAL');

function initDB() {
    try {
        db.exec(`CREATE TABLE IF NOT EXISTS metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            machine_id TEXT,
            timestamp BIGINT,
            cpu FLOAT,
            memory FLOAT,
            disk FLOAT,
            network_in FLOAT,
            network_out FLOAT,
            cost FLOAT,
            carbon FLOAT,
            activity TEXT,
            recommendation TEXT
        )`);

        // Ensure columns exist if table was already created
        try { db.exec(`ALTER TABLE metrics ADD COLUMN cost FLOAT`); } catch (e) { }
        try { db.exec(`ALTER TABLE metrics ADD COLUMN carbon FLOAT`); } catch (e) { }
        try { db.exec(`ALTER TABLE metrics ADD COLUMN activity TEXT`); } catch (e) { }
        try { db.exec(`ALTER TABLE metrics ADD COLUMN recommendation TEXT`); } catch (e) { }

        db.exec(`CREATE TABLE IF NOT EXISTS metrics_summary (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            machine_id TEXT,
            timestamp BIGINT,
            avg_cpu FLOAT,
            avg_memory FLOAT,
            avg_disk FLOAT,
            total_cost FLOAT,
            total_carbon FLOAT,
            data_points_count INT
        )`);
    } catch (err) {
        console.error("Database initialization failed:", err.message);
    }
}

function summarizeAndPrune() {
    const cutoff = Date.now() - (60 * 60 * 1000); // 1 hour ago
    
    try {
        const transaction = db.transaction(() => {
            const rows = db.prepare(`
                SELECT 
                    machine_id, 
                    MIN(timestamp) as timestamp,
                    AVG(cpu) as avg_cpu,
                    AVG(memory) as avg_memory,
                    AVG(disk) as avg_disk,
                    SUM(cost) as total_cost,
                    SUM(carbon) as total_carbon,
                    COUNT(*) as data_points_count
                FROM metrics
                WHERE timestamp < ?
                GROUP BY machine_id
            `).all(cutoff);

            if (rows.length > 0) {
                const insertStmt = db.prepare(`
                    INSERT INTO metrics_summary 
                    (machine_id, timestamp, avg_cpu, avg_memory, avg_disk, total_cost, total_carbon, data_points_count)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `);
                
                for (const row of rows) {
                    insertStmt.run(row.machine_id, row.timestamp, row.avg_cpu, row.avg_memory, row.avg_disk, row.total_cost, row.total_carbon, row.data_points_count);
                }
                
                db.prepare(`DELETE FROM metrics WHERE timestamp < ?`).run(cutoff);
                console.log(`Successfully summarized and pruned data for ${rows.length} machines`);
            }
        });
        
        transaction();
    } catch (err) {
        console.error("Database roll-up failed:", err.message);
    }
}

// Run roll-up every 1 hour
setInterval(summarizeAndPrune, 60 * 60 * 1000);
// Also run once on startup after a short delay
setTimeout(summarizeAndPrune, 5000);

// Manual trigger for summary generation and pruning
app.post("/api/v1/summary/generate", async (req, res) => {
    try {
        summarizeAndPrune();
        res.json({ success: true, message: "Summary generated and old metrics pruned" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route to save metrics
app.post("/api/v1/metrics", async (req, res) => {
    const { machine_id, timestamp, cpu, memory, disk, network_in, network_out, cost, carbon } = req.body;

    const activity = detectActivity({ cpu, memory, network_in });
    const recommendation = getRecommendation({ cpu, memory, network_in });

    const sql = `
    INSERT INTO metrics (machine_id, timestamp, cpu, memory, disk, network_in, network_out, cost, carbon, activity, recommendation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
    try {
        db.prepare(sql).run(machine_id, timestamp, cpu, memory, disk, network_in, network_out, cost, carbon, activity, recommendation);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route to get latest metrics for a machine
app.get("/api/v1/metrics", async (req, res) => {
    const { machine_id } = req.query;
    try {
        let sql = `SELECT * FROM metrics `;
        let params = [];
        if (machine_id) {
            sql += `WHERE machine_id = ? `;
            params.push(machine_id);
        }
        sql += `ORDER BY timestamp DESC LIMIT 30`;
        const rows = db.prepare(sql).all(...params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/v1/summary", async (req, res) => {
    try {
        // Get totals from both tables
        const m_row = db.prepare(`
            SELECT AVG(cpu) as avg_cpu, SUM(cost) as total_cost, SUM(carbon) as total_carbon FROM metrics 
        `).get();
        const s_row = db.prepare(`
            SELECT SUM(total_cost) as total_cost, SUM(total_carbon) as total_carbon FROM metrics_summary
        `).get();

        const total_cost = (m_row.total_cost || 0) + (s_row.total_cost || 0);
        const total_carbon = (m_row.total_carbon || 0) + (s_row.total_carbon || 0);

        res.json({
            avg_cpu: m_row.avg_cpu || 0,
            total_cost: total_cost,
            total_carbon: total_carbon
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route to get all machines
app.get("/machines", async (req, res) => {
    const sql = "SELECT DISTINCT machine_id FROM metrics";
    try {
        const rows = db.prepare(sql).all();
        res.json(rows.map(r => r.machine_id));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

function startServer(port = 5001) {
    initDB();
    app.listen(port, () => {
        console.log(`🟢 Backend running on port ${port}`);
    });
}

module.exports = { startServer };