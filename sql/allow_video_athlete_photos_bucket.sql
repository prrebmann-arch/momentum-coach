-- ============================================================
-- Bug import vidéo dans le bilan : "Mime type video/mp4 is not supported"
-- Le bucket athlete-photos (qui stocke aussi les vidéos de bilan) n'autorisait
-- que image/jpeg|png|webp et limitait la taille à 5 Mo.
--
-- On GARDE les 3 types image existants inchangés et on AJOUTE seulement la
-- vidéo (mp4 + quicktime pour les .mov iOS). Taille max relevée à 50 Mo car
-- une vidéo dépasse toujours 5 Mo.
-- ============================================================

UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/png', 'image/webp',   -- inchangé (photos existantes)
    'video/mp4', 'video/quicktime'             -- ajout : vidéo bilan
  ],
  file_size_limit = 52428800  -- 50 Mo
WHERE id = 'athlete-photos';

-- Vérification : doit retourner la ligne avec les 2 types vidéo en plus
SELECT id, allowed_mime_types, file_size_limit
FROM storage.buckets
WHERE id = 'athlete-photos';
