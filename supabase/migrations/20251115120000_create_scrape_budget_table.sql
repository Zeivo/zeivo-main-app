CREATE TABLE scrape_budget (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    daily_limit INT NOT NULL DEFAULT 100,
    requests_used INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
