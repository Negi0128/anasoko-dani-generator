CREATE TABLE IF NOT EXISTS songs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  content_hash TEXT NOT NULL UNIQUE,
  tja_stored_path TEXT NOT NULL,
  ogg_stored_path TEXT NOT NULL,
  tja_encoding TEXT NOT NULL,
  bpm REAL,
  wave_filename_in_tja TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS song_courses (
  song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  course TEXT NOT NULL,
  level INTEGER,
  note_count INTEGER NOT NULL,
  balloon_counts TEXT,
  score_init INTEGER,
  score_diff INTEGER,
  PRIMARY KEY (song_id, course)
);

CREATE TABLE IF NOT EXISTS dani_sets (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  set_index INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ranks (
  id TEXT PRIMARY KEY,
  set_id TEXT NOT NULL REFERENCES dani_sets(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL,
  rank_index INTEGER NOT NULL,
  rank_name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  gauge_red REAL NOT NULL,
  gauge_gold REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS stat_kinds (
  id TEXT PRIMARY KEY,
  rank_id TEXT NOT NULL REFERENCES ranks(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL,
  label TEXT NOT NULL,
  continuous INTEGER NOT NULL,
  cumulative_red REAL,
  cumulative_gold REAL
);

CREATE TABLE IF NOT EXISTS stat_kind_per_song_borders (
  stat_kind_id TEXT NOT NULL REFERENCES stat_kinds(id) ON DELETE CASCADE,
  song_slot_index INTEGER NOT NULL,
  red REAL NOT NULL,
  gold REAL NOT NULL,
  PRIMARY KEY (stat_kind_id, song_slot_index)
);

CREATE TABLE IF NOT EXISTS song_slots (
  id TEXT PRIMARY KEY,
  rank_id TEXT NOT NULL REFERENCES ranks(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL,
  song_id TEXT REFERENCES songs(id) ON DELETE SET NULL,
  diff INTEGER NOT NULL DEFAULT 0,
  song_genre_label TEXT NOT NULL DEFAULT '',
  hidden INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_song_slots_song_id ON song_slots(song_id);
CREATE INDEX IF NOT EXISTS idx_ranks_set_id ON ranks(set_id);
CREATE INDEX IF NOT EXISTS idx_stat_kinds_rank_id ON stat_kinds(rank_id);
CREATE INDEX IF NOT EXISTS idx_song_slots_rank_id ON song_slots(rank_id);
