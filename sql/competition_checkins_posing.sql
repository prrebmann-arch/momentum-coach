-- ============================================================
-- CHECK-INS COMPÉTITION — lien vers vidéo de posing
-- Date: 2026-08-20
-- Le check-in peut référencer une vidéo posing_videos déjà uploadée via le
-- flow existant (uploadPosingVideo, api/posing.js) plutôt que dupliquer le
-- stockage vidéo. aspect/glucides_g restent en base (non affichés côté UI
-- désormais, mais colonnes conservées — pas de migration destructive).
-- Execute in Supabase SQL Editor
-- ============================================================

ALTER TABLE checkins ADD COLUMN IF NOT EXISTS posing_video_id UUID REFERENCES posing_videos(id) ON DELETE SET NULL;
