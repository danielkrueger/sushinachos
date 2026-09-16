DROP INDEX IF EXISTS campaigns_status_ends_at_idx;
DROP INDEX IF EXISTS coupons_campaign_id_idx;
DROP INDEX IF EXISTS coupons_player_id_idx;
DROP INDEX IF EXISTS campaign_entries_campaign_player_idx;
DROP INDEX IF EXISTS plays_player_id_idx;

DROP TABLE IF EXISTS coupons;
DROP TABLE IF EXISTS campaign_entries;
DROP TABLE IF EXISTS campaigns;

ALTER TABLE plays ALTER COLUMN player_name SET NOT NULL;
ALTER TABLE plays DROP COLUMN IF EXISTS hidden;
ALTER TABLE plays DROP COLUMN IF EXISTS deliveries;
ALTER TABLE plays DROP COLUMN IF EXISTS player_id;

DROP TABLE IF EXISTS players;
DROP TABLE IF EXISTS admin_users;
