-- Bucket public pour les miniatures de formations
INSERT INTO storage.buckets (id, name, public)
VALUES ('formations', 'formations', true)
ON CONFLICT (id) DO NOTHING;

-- Lecture publique (pour afficher les miniatures dans l'app)
CREATE POLICY IF NOT EXISTS "formations_public_read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'formations');

-- Upload réservé aux coachs authentifiés
CREATE POLICY IF NOT EXISTS "formations_coach_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'formations');

CREATE POLICY IF NOT EXISTS "formations_coach_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'formations');

-- Colonne miniature sur la table formations
ALTER TABLE formations
  ADD COLUMN IF NOT EXISTS thumbnail_url text;
