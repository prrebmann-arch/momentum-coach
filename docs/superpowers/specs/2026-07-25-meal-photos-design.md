# Photos de repas — athlète photographie ses repas, coach les consulte

**Date** : 2026-07-25 · **Statut** : validé Pierre · **Périmètre** : ATHLETE (NutritionScreen) + COACH (historique nutrition)

## Problème

Le coach veut pouvoir vérifier ce que mangent réellement ses athlètes. Aujourd'hui
l'athlète logge ses repas (aliments suivis/remplacés/skippés) mais aucune preuve
visuelle. On veut que l'athlète puisse photographier un repas, et que le coach voie
ces photos dans la vue chronologique de l'historique nutrition déjà en place.

## Vision validée

- **Toujours possible** : l'athlète peut photographier n'importe quel repas de sa
  journée nutrition, sans que le coach ait à le demander (pas de mécanisme de requête).
- Rattaché **à un repas de la diète du jour** (le repas loggé dans `nutrition_logs`).
- Côté coach : vignettes **sur la vue chronologique existante** (`view === 'history'`),
  sous chaque repas, cliquables pour agrandir.

## Architecture — zéro nouvelle table, zéro migration

Les photos vivent dans la colonne JSONB **`nutrition_logs.meals_log`** déjà existante.
Chaque repas loggé gagne un champ `photos` (tableau de chemins storage) :

```js
{ meal_index, meal_label, foods, extras, validated_all,
  photos: ["<user_id>/meals/<date>_m<idx>_<ts>.jpg", ...] }  // ← nouveau
```

Bucket : **`athlete-photos`** (déjà utilisé par bilans/posing), chemin
`{user_id}/meals/{date}_m{mealIdx}_{timestamp}.jpg`. Photos privées → **signed URL 1h**
côté coach (même pattern que les photos de bilan).

## Côté ATHLETE — `src/screens/NutritionScreen.js` + `src/api/nutrition.js`

- Nouveau helper `uploadMealPhoto(uri, userId, date, mealIdx)` dans `src/api/nutrition.js`,
  calqué sur `uploadQuestionnairePhoto` (`src/api/questionnaires.js`) : compression
  `react-native-compressor` (quality 0.6, maxWidth 1080) → upload `athlete-photos` →
  retourne le path.
- Sur chaque carte de repas (là où s'affiche `meal_label`) : un bouton **📷**.
- Tap → `ImagePicker.launchCameraAsync` (permission caméra déjà déclarée dans
  `app.json`, plugin expo-camera). Fallback galerie via `launchImageLibraryAsync`.
- Après upload : push le path dans `mealsLog[mealIdx].photos`, puis upsert
  `nutrition_logs` via le flux de sauvegarde déjà en place (le même qui persiste
  foods/extras). Pas de nouveau chemin de persistance.
- Sous le repas : rangée de vignettes des photos déjà prises. Appui long → supprimer
  (retire du tableau + `supabase.storage.remove` + re-upsert).

## Côté COACH — `app/(app)/athletes/[id]/nutrition/page.tsx` (vue history)

- Dans le rendu par repas de l'historique (`mealsLog.map`, ~ligne 1360) : si
  `meal.photos?.length`, afficher une rangée de vignettes.
- Chaque vignette : signed URL 1h (`storage.from('athlete-photos').createSignedUrl`),
  comme `BilanAccordion`/`bilans/page.tsx`. Composant local `MealPhotoThumb` avec
  état `url`, effet de signature, `cancelled` guard.
- Clic → lightbox plein écran (overlay simple, réutilise le pattern d'aperçu photo
  déjà présent dans la page nutrition / bilans).
- Athlète sans photo ce jour-là → aucun bloc (pas d'espace vide).

## Permissions natives

`expo-image-picker` + `expo-camera` déjà dans `app.json` plugins ;
`cameraPermission` (NSCameraUsageDescription) déjà déclarée. Donc **fonctionnellement
un `eas update` suffirait** (pas de nouveau natif). Un build production Apple est
quand même prévu par Pierre → aucun risque de rejet permission.

## Hors périmètre (YAGNI)

- Pas de "demande de repas" par le coach (toujours possible tranché).
- Pas de notification au coach.
- Pas d'analyse macro auto depuis la photo.
- Pas de compression vidéo (photos uniquement).

## Vérification

- ATHLETE : sur un repas, bouton 📷 → prise photo → vignette apparaît → re-open l'app
  la vignette persiste (relue depuis `nutrition_logs`). Appui long supprime.
- COACH : historique nutrition, jour avec photo → vignette signée s'affiche, clic =
  plein écran. Jour sans photo → rien. `npx tsc --noEmit` sans nouvelle erreur sur
  les 2 fichiers touchés.
- Pas de régression sur le log d'aliments (même upsert).
