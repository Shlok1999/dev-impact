// cpu-stress.js
const { Worker } = require("worker_threads");

const numCores = 8; // adjust if needed

for (let i = 0; i < numCores; i++) {
    new Worker(`
    while (true) {
      Math.sqrt(Math.random());
    }
  `, { eval: true });
}