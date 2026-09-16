-- Campaigns, coupons, players and admin users. Runs on every boot, so everything here
-- must be safe to run again: IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / guarded DO blocks.

CREATE TABLE IF NOT EXISTS admin_users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(120) UNIQUE NOT NULL,
  name VARCHAR(60) NOT NULL,
  role VARCHAR(6) NOT NULL CHECK (role IN ('admin', 'caixa')),
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disabled_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS players (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(14) NOT NULL,
  phone VARCHAR(13) UNIQUE,
  consent_at TIMESTAMPTZ NOT NULL,
  consent_version VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- plays (from 001_ranking) gains campaign-related columns; player_name becomes optional
-- so anonymous plays can be recorded for statistics only.
ALTER TABLE plays ADD COLUMN IF NOT EXISTS player_id BIGINT REFERENCES players(id);
ALTER TABLE plays ADD COLUMN IF NOT EXISTS deliveries INTEGER CHECK (deliveries >= 0);
ALTER TABLE plays ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE plays ALTER COLUMN player_name DROP NOT NULL;

CREATE TABLE IF NOT EXISTS campaigns (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(60) NOT NULL,
  banner_text VARCHAR(90) NOT NULL,
  description TEXT NOT NULL,
  kind VARCHAR(12) NOT NULL CHECK (kind IN ('challenge', 'collective')),
  game VARCHAR(10) CHECK (game IN ('catcher', 'runner', 'ninja')),
  metric VARCHAR(12) NOT NULL CHECK (metric IN ('score', 'deliveries', 'plays')),
  aggregation VARCHAR(4) NOT NULL CHECK (aggregation IN ('best', 'sum')),
  target INTEGER NOT NULL CHECK (target > 0),
  multiplier NUMERIC(3, 1) NOT NULL DEFAULT 1 CHECK (multiplier BETWEEN 1 AND 5),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL CHECK (ends_at > starts_at),
  weekdays SMALLINT[],
  daily_start TIME,
  daily_end TIME,
  prize_title VARCHAR(60) NOT NULL,
  prize_description VARCHAR(200) NOT NULL,
  stock INTEGER CHECK (stock >= 0),
  per_player_limit INTEGER NOT NULL DEFAULT 1 CHECK (per_player_limit >= 1),
  coupon_valid_days INTEGER NOT NULL DEFAULT 7 CHECK (coupon_valid_days BETWEEN 1 AND 90),
  challenger_name VARCHAR(30),
  challenger_score INTEGER,
  status VARCHAR(10) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  collective_reached_at TIMESTAMPTZ,
  created_by BIGINT REFERENCES admin_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaign_entries (
  id BIGSERIAL PRIMARY KEY,
  campaign_id BIGINT NOT NULL REFERENCES campaigns(id),
  player_id BIGINT NOT NULL REFERENCES players(id),
  play_id BIGINT NOT NULL REFERENCES plays(id),
  value INTEGER NOT NULL CHECK (value >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, play_id)
);

CREATE TABLE IF NOT EXISTS coupons (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(14) UNIQUE NOT NULL,
  campaign_id BIGINT NOT NULL REFERENCES campaigns(id),
  player_id BIGINT NOT NULL REFERENCES players(id),
  status VARCHAR(10) NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'redeemed', 'cancelled')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  redeemed_at TIMESTAMPTZ,
  redeemed_by BIGINT REFERENCES admin_users(id)
);

CREATE INDEX IF NOT EXISTS plays_player_id_idx ON plays (player_id);
CREATE INDEX IF NOT EXISTS campaign_entries_campaign_player_idx ON campaign_entries (campaign_id, player_id);
CREATE INDEX IF NOT EXISTS coupons_player_id_idx ON coupons (player_id);
CREATE INDEX IF NOT EXISTS coupons_campaign_id_idx ON coupons (campaign_id);
CREATE INDEX IF NOT EXISTS campaigns_status_ends_at_idx ON campaigns (status, ends_at);
