const os = require("os");
const si = require("systeminformation");
const axios = require("axios");
require('dotenv').config();

const MACHINE_ID = os.hostname();
const API_PORT = process.env.PORT || 5001;
const API_URL = `http://localhost:${API_PORT}/api/v1/metrics`;


function estimateCost(cpuLoad) {
    const costPerCpuHour = 3; // INR per CPU-hour
    const intervalHours = 5 / 3600;
    return (cpuLoad / 100) * costPerCpuHour * intervalHours;
}

function estimateCarbon(cpuLoad) {
    const peakPowerWatts = 250;
    const carbonIntensity = 0.447; // kg CO2 per kWh
    const intervalHours = 5 / 3600;
    const energyKWh = (cpuLoad / 100) * peakPowerWatts * (intervalHours / 1000);
    return energyKWh * carbonIntensity;
}

async function collectMetrics() {
    const cpu = await si.currentLoad();
    const mem = await si.mem();
    const disk = await si.fsSize();
    const net = await si.networkStats();

    const cpuLoad = cpu.currentLoad;
    const memUsage = (mem.used / mem.total) * 100;

    const payload = {
        machine_id: MACHINE_ID,
        timestamp: Date.now(),
        cpu: cpuLoad,
        memory: memUsage,
        disk: disk[0].use,
        network_in: net[0].rx_sec || 0,
        network_out: net[0].tx_sec || 0,
        cost: estimateCost(cpuLoad),
        carbon: estimateCarbon(cpuLoad)
    };
    return payload;
}

async function sendMetrics() {
    try {
        const data = await collectMetrics();
        await axios.post(API_URL, data);
        console.log("Sent", data);

    } catch (error) {
        console.log(error.message);

    }

}

setInterval(sendMetrics, 5000);
