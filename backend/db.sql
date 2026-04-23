CREATE TABLE metrics (
  id SERIAL PRIMARY KEY,
  machine_id TEXT,
  timestamp BIGINT,
  cpu FLOAT,
  memory FLOAT,
  disk FLOAT,
  network_in FLOAT,
  network_out FLOAT
);