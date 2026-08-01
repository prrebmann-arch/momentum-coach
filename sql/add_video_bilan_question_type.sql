-- ============================================================
-- Bug #1 : autoriser le type de question "video" dans les bilans
-- La contrainte CHECK sur bilan_questions.type ne listait pas 'video',
-- ce qui faisait échouer l'ajout d'une question vidéo depuis l'éditeur.
-- ============================================================

ALTER TABLE bilan_questions
  DROP CONSTRAINT IF EXISTS bilan_questions_type_check;

ALTER TABLE bilan_questions
  ADD CONSTRAINT bilan_questions_type_check CHECK (type IN (
    'slider_1_10', 'number', 'text_short', 'text_long',
    'boolean', 'time', 'single_choice', 'multiple_choice', 'photo', 'video'
  ));
