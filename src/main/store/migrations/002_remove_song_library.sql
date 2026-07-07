-- Removes the shared song library (songs/song_courses) in favor of storing
-- each song slot's file references and metadata directly. Existing slot
-- assignments are preserved by copying the referenced song's stored paths
-- straight across (the physical files under songs/<uuid>/ are left in place).

CREATE TABLE song_slots_new (
  id TEXT PRIMARY KEY,
  rank_id TEXT NOT NULL REFERENCES ranks(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL,
  tja_rel_path TEXT,
  ogg_rel_path TEXT,
  song_title TEXT,
  courses_json TEXT,
  diff INTEGER NOT NULL DEFAULT 0,
  song_genre_label TEXT NOT NULL DEFAULT '',
  hidden INTEGER NOT NULL DEFAULT 0
);

INSERT INTO song_slots_new
  (id, rank_id, sort_order, tja_rel_path, ogg_rel_path, song_title, courses_json, diff, song_genre_label, hidden)
SELECT
  ss.id,
  ss.rank_id,
  ss.sort_order,
  s.tja_stored_path,
  s.ogg_stored_path,
  s.title,
  (
    SELECT json_group_array(
      json_object(
        'course', sc.course,
        'level', sc.level,
        'noteCount', sc.note_count,
        'balloonCounts', CASE WHEN sc.balloon_counts IS NULL THEN NULL ELSE json(sc.balloon_counts) END,
        'scoreInit', sc.score_init,
        'scoreDiff', sc.score_diff
      )
    )
    FROM song_courses sc WHERE sc.song_id = s.id
  ),
  ss.diff,
  ss.song_genre_label,
  ss.hidden
FROM song_slots ss
LEFT JOIN songs s ON s.id = ss.song_id;

DROP TABLE song_slots;
ALTER TABLE song_slots_new RENAME TO song_slots;

DROP TABLE song_courses;
DROP TABLE songs;

CREATE INDEX IF NOT EXISTS idx_song_slots_rank_id ON song_slots(rank_id);
