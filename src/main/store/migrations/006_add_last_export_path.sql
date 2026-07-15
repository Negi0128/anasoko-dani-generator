-- Remembers the exact folder a set was last exported to, so re-exporting the
-- same set overwrites it in place instead of piling up numbered duplicates.
ALTER TABLE dani_sets ADD COLUMN last_export_path TEXT;
