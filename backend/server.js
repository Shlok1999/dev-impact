const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const { detectActivity, getRecommendation } = require("./services/intelligence");

const app = express();
app.use(cors());
app.use(express.json());

// Database pool
const pool = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "",
    database: "infra_observer",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function initDB() {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS metrics (
            id SERIAL PRIMARY KEY,
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
        try { await pool.query(`ALTER TABLE metrics ADD COLUMN cost FLOAT`); } catch (e) { }
        try { await pool.query(`ALTER TABLE metrics ADD COLUMN carbon FLOAT`); } catch (e) { }
        try { await pool.query(`ALTER TABLE metrics ADD COLUMN activity TEXT`); } catch (e) { }
        try { await pool.query(`ALTER TABLE metrics ADD COLUMN recommendation TEXT`); } catch (e) { }

        await pool.query(`CREATE TABLE IF NOT EXISTS metrics_summary (
            id SERIAL PRIMARY KEY,
            machine_id TEXT,
            timestamp BIGINT,
            avg_cpu FLOAT,
            avg_memory FLOAT,
            avg_disk FLOAT,
            total_cost FLOAT,
            total_carbon FLOAT,
            data_points_count INT
        )`);

        console.log("Connected to MySQL Database and Tables ensured");
    } catch (err) {
        console.error("Database initialization failed:", err.message);
    }
}
initDB();

async function summarizeAndPrune() {
    const cutoff = Date.now() - (5 * 60 * 1000); // 5 minutes ago
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [rows] = await connection.execute(`
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
        `, [cutoff]);

        if (rows.length > 0) {
            for (const row of rows) {
                await connection.execute(`
                    INSERT INTO metrics_summary 
                    (machine_id, timestamp, avg_cpu, avg_memory, avg_disk, total_cost, total_carbon, data_points_count)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [row.machine_id, row.timestamp, row.avg_cpu, row.avg_memory, row.avg_disk, row.total_cost, row.total_carbon, row.data_points_count]);
            }
            await connection.execute(`DELETE FROM metrics WHERE timestamp < ?`, [cutoff]);
            console.log(`Successfully summarized and pruned data for ${rows.length} machines`);
        }

        await connection.commit();
    } catch (err) {
        await connection.rollback();
        console.error("Database roll-up failed:", err.message);
    } finally {
        connection.release();
    }
}

// Run roll-up every 5 minutes
setInterval(summarizeAndPrune, 5 * 60 * 1000);
// Also run once on startup after a short delay
setTimeout(summarizeAndPrune, 5000);

// Manual trigger for summary generation and pruning
app.post("/api/v1/summary/generate", async (req, res) => {
    try {
        await summarizeAndPrune();
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
        await pool.execute(sql, [machine_id, timestamp, cpu, memory, disk, network_in, network_out, cost, carbon, activity, recommendation]);
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
        const [rows] = await pool.execute(sql, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/v1/summary", async (req, res) => {
    try {
        // Get totals from both tables
        const [m_rows] = await pool.execute(`
            SELECT AVG(cpu) as avg_cpu, SUM(cost) as total_cost, SUM(carbon) as total_carbon FROM metrics 
        `);
        const [s_rows] = await pool.execute(`
            SELECT SUM(total_cost) as total_cost, SUM(total_carbon) as total_carbon FROM metrics_summary
        `);

        const total_cost = (m_rows[0].total_cost || 0) + (s_rows[0].total_cost || 0);
        const total_carbon = (m_rows[0].total_carbon || 0) + (s_rows[0].total_carbon || 0);

        res.json({
            avg_cpu: m_rows[0].avg_cpu || 0,
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
        const [rows] = await pool.query(sql);
        res.json(rows.map(r => r.machine_id));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(5001, () => console.log("Server started on port 5001"));