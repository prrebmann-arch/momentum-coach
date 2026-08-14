-- Support des PDF dans les formations (en plus des vidéos existantes)
-- content_type distingue 'video' (comportement existant, video_url = lien
-- externe YouTube/Vimeo/Loom) de 'pdf' (fichier stocké dans le bucket privé
-- formation-pdfs, chemin dans file_path).

ALTER TABLE formation_videos
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'video'
    CHECK (content_type IN ('video', 'pdf')),
  ADD COLUMN IF NOT EXISTS file_path text;

-- Bucket privé pour les fichiers PDF de formation (contrairement à
-- `formations`, qui est public et réservé aux miniatures).
INSERT INTO storage.buckets (id, name, public)
VALUES ('formation-pdfs', 'formation-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- Chemin convention : {formationId}/{videoId}.pdf
-- Upload/update/delete réservés au coach propriétaire de la formation.
DROP POLICY IF EXISTS "formation_pdfs_coach_all" ON storage.objects;
CREATE POLICY "formation_pdfs_coach_all" ON storage.objects FOR ALL
  USING (
    bucket_id = 'formation-pdfs'
    AND EXISTS (
      SELECT 1 FROM formations f
      WHERE f.id::text = (storage.foldername(name))[1]
        AND f.coach_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'formation-pdfs'
    AND EXISTS (
      SELECT 1 FROM formations f
      WHERE f.id::text = (storage.foldername(name))[1]
        AND f.coach_id = auth.uid()
    )
  );

-- Pas de policy SELECT publique/authenticated ici : la lecture athlète passe
-- exclusivement par /api/formations/pdf-signed-url (service role, vérifie
-- que l'athlète appartient bien au coach propriétaire de la formation),
-- même pattern que coach-bloodtest.
