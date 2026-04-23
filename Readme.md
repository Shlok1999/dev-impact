# DevImpact

## Overview of the project

While developing a software, we rarely think about the resource footprint of our workflows, i.e, CPU usage, network activity and memory consumption, which ultimately translates into energy usage that leads to carbon emission.  
Existing tools do share raw metrics but don’t address the real world impact of the activities.  

To address this issue, I have built DevImpact, a real time developer observability system that tracks system level metrics and translates to cost and carbon estimates.  

Beyond just tracking, it provides an intelligence layer on top of it, that tells you about the developer activities that includes builds, browsing activity or installation of dependencies and provides actionable insights to optimize performance and reduce environmental impact.

---

## Goals of DevImpact

- Quantify system usage in terms of cost and carbon emissions  
- Provide real-time visibility into system performance  
- Interpret developer activities from system metrics  
- Enable performance and resource optimization  
- Reduce unnecessary compute and environmental impact  
- Efficiently manage high-frequency telemetry data  

---

## Tech Stack Used

### Backend

- Node js: Used to build REST apis for the ingesting and serving metrics data.  
- Systeminformation library in node js: Collects real-time system metrics such as CPU load, memory usage, disk usage, and network activity.  

---

### Database

- MySQL: Used to store the high frequency metrics and summaries  

---

### Intelligence Layer

- Custom-built heuristic inference engine  
- Maps system metrics → Developer activities  
- Generates recommendation  

---

### Frontend

- Electron.js: Used to create a floating widget, always on top of monitor  

---

### Communication

- REST APIs (HTTP)  
  - Agent → Backend (POST metrics)  
  - Frontend → Backend (GET metrics, summary)  

---

## System Architecture

### System Architecture High Level


---

## Architecture Breakdown

### Metric Agent

- Runs locally on developer machine  
- Collects metrics every few seconds: CPU, Memory, Network, Disk usage  
- Sends data to the backend via api  

---

### Backend API

- Built via express js  
- Handles ingestion of metrics, enrichment and queries on frontend  

---

### Data Layer

- Two tier storage:  
  - Stores data every few seconds to be used for real time analytics  
  - Stores summaries hourly that includes averages, total count and prevents databases from growing infinitely  

---

### Intelligence layer

- Activity detection  
- Recommendation engine  
- Confidence scoring  
- Time aware analysis  

---

### Presentation layer

- Real time view  
- Always visible  
- Shows carbon emission, usages of CPU, memory and network and activity + recommendation  
- Dashboard (to be built)  

---

## Key Design Decision

- Used MYSQL for simplicity  
- Implemented manual aggregation and retention  
- Raw data for short retention and summaries for long term storage  

---

## Summary

DevImpact follows a pipeline architecture where system metrics are collected in real-time, processed into meaningful insights, stored efficiently using aggregation strategies, and surfaced through a lightweight UI with actionable recommendations.

## 🚀 Quick Start (CLI)

You can now run DevImpact directly from your terminal.

### Installation

```bash
npm install -g dev-impact
```

### Usage

**Start Monitoring (Backend + Agent):**
```bash
dev-impact start
```

**Start Everything (Backend + Agent + UI Widget):**
```bash
dev-impact start --ui
```

**Launch UI Widget Only:**
```bash
dev-impact ui
```

---

## 🛠 Setup & Development

### Prerequisites
- Node.js (v16+)
- MySQL Server (running on localhost)

### Manual Installation
1. Clone the repository.
2. Run the bulk install command:
   ```bash
   npm run install-all
   ```
3. Ensure MySQL has a database named `infra_observer`.
