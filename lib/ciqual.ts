// ---------------------------------------------------------------------------
// Base Ciqual (ANSES) — aliments bruts français, valeurs POUR 100g.
// Source : https://ciqual.anses.fr/ — copie locale (aucune API).
// Porté depuis ATHLETE/src/api/ciqual.js. Valeurs par 100g (cohérent avec
// aliments_db et Open Food Facts côté coach).
// ---------------------------------------------------------------------------

export interface CiqualItem {
  nom: string
  calories: number
  proteines: number
  glucides: number
  lipides: number
  source: 'ciqual'
}

const CIQUAL_DB = [
  // ── Viandes ──
  { nom: 'Agneau, épaule, cuit', calories: 236, proteines: 26, glucides: 0, lipides: 15 },
  { nom: 'Agneau, gigot, rôti', calories: 206, proteines: 28, glucides: 0, lipides: 10.5 },
  { nom: 'Agneau, côtelette, grillée', calories: 253, proteines: 25, glucides: 0, lipides: 17 },
  { nom: 'Bœuf, steak haché 5%, cuit', calories: 146, proteines: 26, glucides: 0, lipides: 5 },
  { nom: 'Bœuf, steak haché 15%, cuit', calories: 218, proteines: 25, glucides: 0, lipides: 13.5 },
  { nom: 'Bœuf, faux-filet, grillé', calories: 186, proteines: 27, glucides: 0, lipides: 8.7 },
  { nom: 'Bœuf, rumsteck, grillé', calories: 163, proteines: 28, glucides: 0, lipides: 5.6 },
  { nom: 'Bœuf, bavette, grillée', calories: 168, proteines: 27.5, glucides: 0, lipides: 6.5 },
  { nom: 'Bœuf, entrecôte, grillée', calories: 244, proteines: 24, glucides: 0, lipides: 16.5 },
  { nom: 'Poulet, blanc, cuit', calories: 121, proteines: 26.2, glucides: 0, lipides: 1.8 },
  { nom: 'Poulet, cuisse, cuit', calories: 177, proteines: 24, glucides: 0, lipides: 9.2 },
  { nom: 'Poulet, rôti', calories: 164, proteines: 25, glucides: 0, lipides: 7.1 },
  { nom: 'Dinde, escalope, cuite', calories: 115, proteines: 26, glucides: 0, lipides: 1.3 },
  { nom: 'Dinde, cuisse, cuite', calories: 165, proteines: 24, glucides: 0, lipides: 7.8 },
  { nom: 'Porc, filet, rôti', calories: 159, proteines: 28.5, glucides: 0, lipides: 5 },
  { nom: 'Porc, côte, grillée', calories: 226, proteines: 25, glucides: 0, lipides: 14 },
  { nom: 'Porc, jambon cuit', calories: 115, proteines: 21, glucides: 0.5, lipides: 3 },
  { nom: 'Canard, magret, grillé', calories: 187, proteines: 27, glucides: 0, lipides: 9 },
  { nom: 'Veau, escalope, cuite', calories: 149, proteines: 31, glucides: 0, lipides: 2.6 },
  { nom: 'Lapin, rôti', calories: 167, proteines: 29, glucides: 0, lipides: 5.5 },

  // ── Poissons & fruits de mer ──
  { nom: 'Saumon, cuit', calories: 206, proteines: 22, glucides: 0, lipides: 13 },
  { nom: 'Saumon, fumé', calories: 177, proteines: 23, glucides: 0, lipides: 9.5 },
  { nom: 'Thon, cuit', calories: 130, proteines: 29, glucides: 0, lipides: 1.3 },
  { nom: 'Thon, en conserve, nature', calories: 116, proteines: 26, glucides: 0, lipides: 1 },
  { nom: 'Cabillaud, cuit', calories: 85, proteines: 19, glucides: 0, lipides: 0.8 },
  { nom: 'Crevettes, cuites', calories: 99, proteines: 21, glucides: 0.2, lipides: 1.4 },
  { nom: 'Sardine, grillée', calories: 208, proteines: 25, glucides: 0, lipides: 12 },
  { nom: 'Maquereau, cuit', calories: 239, proteines: 24, glucides: 0, lipides: 16 },
  { nom: 'Truite, cuite', calories: 135, proteines: 23, glucides: 0, lipides: 4.9 },
  { nom: 'Dorade, cuite', calories: 100, proteines: 21, glucides: 0, lipides: 1.8 },
  { nom: 'Colin, cuit', calories: 90, proteines: 20, glucides: 0, lipides: 1 },
  { nom: 'Moules, cuites', calories: 86, proteines: 12, glucides: 3.7, lipides: 2.2 },

  // ── Œufs ──
  { nom: 'Œuf, entier, cuit', calories: 145, proteines: 12.5, glucides: 0.7, lipides: 10.5 },
  { nom: 'Œuf, blanc, cuit', calories: 47, proteines: 10.8, glucides: 0.7, lipides: 0.2 },
  { nom: 'Œuf, jaune, cuit', calories: 353, proteines: 16, glucides: 0.6, lipides: 31 },

  // ── Féculents & céréales ──
  { nom: 'Riz blanc, cuit', calories: 127, proteines: 2.6, glucides: 28, lipides: 0.3 },
  { nom: 'Riz complet, cuit', calories: 141, proteines: 3, glucides: 30, lipides: 1.1 },
  { nom: 'Riz basmati, cuit', calories: 130, proteines: 3, glucides: 28.5, lipides: 0.4 },
  { nom: 'Pâtes, cuites', calories: 131, proteines: 4.9, glucides: 26, lipides: 0.7 },
  { nom: 'Pâtes complètes, cuites', calories: 144, proteines: 5.6, glucides: 27, lipides: 1.2 },
  { nom: 'Pomme de terre, cuite à l\'eau', calories: 80, proteines: 1.9, glucides: 17, lipides: 0.1 },
  { nom: 'Pomme de terre, frite', calories: 274, proteines: 3.4, glucides: 33, lipides: 14 },
  { nom: 'Pomme de terre, purée', calories: 92, proteines: 2.5, glucides: 14, lipides: 3 },
  { nom: 'Patate douce, cuite', calories: 90, proteines: 1.6, glucides: 20, lipides: 0.1 },
  { nom: 'Pain blanc', calories: 265, proteines: 8.5, glucides: 51, lipides: 2 },
  { nom: 'Pain complet', calories: 247, proteines: 9, glucides: 44, lipides: 3.2 },
  { nom: 'Pain de mie', calories: 280, proteines: 8, glucides: 50, lipides: 4.5 },
  { nom: 'Flocons d\'avoine, crus', calories: 367, proteines: 11.5, glucides: 60, lipides: 7 },
  { nom: 'Quinoa, cuit', calories: 120, proteines: 4.1, glucides: 21.3, lipides: 1.9 },
  { nom: 'Semoule, cuite', calories: 112, proteines: 3.6, glucides: 23, lipides: 0.3 },
  { nom: 'Boulgour, cuit', calories: 83, proteines: 3, glucides: 18.6, lipides: 0.2 },
  { nom: 'Maïs, cuit', calories: 96, proteines: 3.2, glucides: 19, lipides: 1.2 },

  // ── Légumineuses ──
  { nom: 'Lentilles, cuites', calories: 112, proteines: 8.6, glucides: 16.5, lipides: 0.5 },
  { nom: 'Lentilles corail, cuites', calories: 105, proteines: 7.5, glucides: 16, lipides: 0.4 },
  { nom: 'Pois chiches, cuits', calories: 148, proteines: 8.3, glucides: 21, lipides: 2.6 },
  { nom: 'Haricots rouges, cuits', calories: 127, proteines: 8.7, glucides: 19, lipides: 0.5 },
  { nom: 'Haricots blancs, cuits', calories: 118, proteines: 8, glucides: 18, lipides: 0.5 },
  { nom: 'Pois cassés, cuits', calories: 118, proteines: 8.3, glucides: 19, lipides: 0.4 },
  { nom: 'Edamame, cuit', calories: 122, proteines: 11, glucides: 9.9, lipides: 5 },
  { nom: 'Tofu, nature', calories: 120, proteines: 12, glucides: 1.5, lipides: 7 },

  // ── Légumes ──
  { nom: 'Brocoli, cuit', calories: 28, proteines: 3, glucides: 2.3, lipides: 0.5 },
  { nom: 'Courgette, cuite', calories: 19, proteines: 1.3, glucides: 2.3, lipides: 0.3 },
  { nom: 'Tomate, crue', calories: 20, proteines: 0.8, glucides: 3.5, lipides: 0.3 },
  { nom: 'Carotte, cuite', calories: 26, proteines: 0.8, glucides: 5, lipides: 0.2 },
  { nom: 'Carotte, crue', calories: 36, proteines: 0.7, glucides: 7.6, lipides: 0.2 },
  { nom: 'Épinards, cuits', calories: 25, proteines: 2.7, glucides: 1.3, lipides: 0.5 },
  { nom: 'Salade verte (laitue)', calories: 13, proteines: 1.2, glucides: 1.4, lipides: 0.2 },
  { nom: 'Haricots verts, cuits', calories: 28, proteines: 1.8, glucides: 4, lipides: 0.2 },
  { nom: 'Poivron, cru', calories: 27, proteines: 0.9, glucides: 4.6, lipides: 0.3 },
  { nom: 'Concombre, cru', calories: 12, proteines: 0.6, glucides: 1.8, lipides: 0.1 },
  { nom: 'Aubergine, cuite', calories: 24, proteines: 0.8, glucides: 3.5, lipides: 0.4 },
  { nom: 'Champignon, cuit', calories: 22, proteines: 2.2, glucides: 1.5, lipides: 0.5 },
  { nom: 'Oignon, cru', calories: 38, proteines: 1, glucides: 8, lipides: 0.1 },
  { nom: 'Chou-fleur, cuit', calories: 20, proteines: 2, glucides: 2.1, lipides: 0.3 },
  { nom: 'Asperge, cuite', calories: 24, proteines: 2.6, glucides: 2, lipides: 0.4 },
  { nom: 'Petits pois, cuits', calories: 68, proteines: 5, glucides: 10, lipides: 0.4 },
  { nom: 'Betterave, cuite', calories: 43, proteines: 1.7, glucides: 8, lipides: 0.1 },
  { nom: 'Artichaut, cuit', calories: 40, proteines: 2.9, glucides: 5.1, lipides: 0.3 },
  { nom: 'Fenouil, cru', calories: 15, proteines: 1.2, glucides: 1.5, lipides: 0.2 },
  { nom: 'Céleri, cru', calories: 15, proteines: 0.7, glucides: 2.2, lipides: 0.2 },
  { nom: 'Radis, cru', calories: 13, proteines: 0.7, glucides: 1.9, lipides: 0.1 },
  { nom: 'Navet, cuit', calories: 15, proteines: 0.7, glucides: 2.5, lipides: 0.1 },
  { nom: 'Chou, cuit', calories: 22, proteines: 1.3, glucides: 3.3, lipides: 0.2 },

  // ── Fruits ──
  { nom: 'Pomme, crue', calories: 53, proteines: 0.3, glucides: 12, lipides: 0.2 },
  { nom: 'Banane, crue', calories: 90, proteines: 1, glucides: 20, lipides: 0.3 },
  { nom: 'Orange, crue', calories: 46, proteines: 0.9, glucides: 9.4, lipides: 0.2 },
  { nom: 'Fraise, crue', calories: 29, proteines: 0.7, glucides: 5.5, lipides: 0.3 },
  { nom: 'Raisin, cru', calories: 72, proteines: 0.6, glucides: 16, lipides: 0.4 },
  { nom: 'Poire, crue', calories: 50, proteines: 0.4, glucides: 11, lipides: 0.1 },
  { nom: 'Pêche, crue', calories: 40, proteines: 0.9, glucides: 8, lipides: 0.2 },
  { nom: 'Abricot, cru', calories: 44, proteines: 0.8, glucides: 9.3, lipides: 0.1 },
  { nom: 'Mangue, crue', calories: 63, proteines: 0.6, glucides: 14, lipides: 0.2 },
  { nom: 'Ananas, cru', calories: 52, proteines: 0.4, glucides: 12, lipides: 0.1 },
  { nom: 'Kiwi, cru', calories: 58, proteines: 1, glucides: 11.5, lipides: 0.6 },
  { nom: 'Melon, cru', calories: 32, proteines: 0.8, glucides: 6.5, lipides: 0.1 },
  { nom: 'Pastèque, crue', calories: 34, proteines: 0.6, glucides: 7.5, lipides: 0.2 },
  { nom: 'Cerise, crue', calories: 62, proteines: 0.8, glucides: 14, lipides: 0.3 },
  { nom: 'Myrtille, crue', calories: 50, proteines: 0.6, glucides: 10.5, lipides: 0.3 },
  { nom: 'Framboise, crue', calories: 38, proteines: 1, glucides: 6.5, lipides: 0.3 },
  { nom: 'Citron, cru', calories: 29, proteines: 0.7, glucides: 3.2, lipides: 0.3 },

  // ── Produits laitiers ──
  { nom: 'Lait demi-écrémé', calories: 47, proteines: 3.3, glucides: 4.8, lipides: 1.6 },
  { nom: 'Lait entier', calories: 63, proteines: 3.2, glucides: 4.6, lipides: 3.6 },
  { nom: 'Lait écrémé', calories: 33, proteines: 3.4, glucides: 4.8, lipides: 0.1 },
  { nom: 'Fromage blanc 0%', calories: 44, proteines: 7.5, glucides: 3.8, lipides: 0.1 },
  { nom: 'Fromage blanc 3%', calories: 57, proteines: 7, glucides: 3.5, lipides: 3 },
  { nom: 'Yaourt nature', calories: 55, proteines: 4.3, glucides: 5.5, lipides: 1.5 },
  { nom: 'Yaourt grec', calories: 97, proteines: 9, glucides: 3.6, lipides: 5 },
  { nom: 'Skyr', calories: 63, proteines: 11, glucides: 4, lipides: 0.2 },
  { nom: 'Fromage emmental', calories: 370, proteines: 27, glucides: 0.5, lipides: 29 },
  { nom: 'Fromage comté', calories: 400, proteines: 27, glucides: 0.5, lipides: 32 },
  { nom: 'Fromage mozzarella', calories: 253, proteines: 19, glucides: 1, lipides: 19.5 },
  { nom: 'Crème fraîche 30%', calories: 292, proteines: 2.4, glucides: 3, lipides: 30 },
  { nom: 'Beurre', calories: 745, proteines: 0.7, glucides: 0.5, lipides: 82.5 },
  { nom: 'Beurre de cacahuète', calories: 623, proteines: 25, glucides: 12, lipides: 51 },

  // ── Matières grasses & oléagineux ──
  { nom: 'Huile d\'olive', calories: 899, proteines: 0, glucides: 0, lipides: 99.9 },
  { nom: 'Huile de colza', calories: 899, proteines: 0, glucides: 0, lipides: 99.9 },
  { nom: 'Huile de coco', calories: 899, proteines: 0, glucides: 0, lipides: 99.9 },
  { nom: 'Amandes', calories: 578, proteines: 22, glucides: 8, lipides: 50 },
  { nom: 'Noix', calories: 654, proteines: 15, glucides: 7, lipides: 63 },
  { nom: 'Noix de cajou', calories: 574, proteines: 18, glucides: 27, lipides: 44 },
  { nom: 'Noisettes', calories: 628, proteines: 14, glucides: 6.5, lipides: 60 },
  { nom: 'Avocat, cru', calories: 169, proteines: 1.8, glucides: 1.8, lipides: 16 },
  { nom: 'Graines de chia', calories: 486, proteines: 17, glucides: 8, lipides: 31 },
  { nom: 'Graines de tournesol', calories: 570, proteines: 21, glucides: 11, lipides: 49 },
  { nom: 'Graines de lin', calories: 534, proteines: 18, glucides: 1.6, lipides: 42 },
  { nom: 'Graines de courge', calories: 559, proteines: 30, glucides: 5, lipides: 46 },
  { nom: 'Olives noires', calories: 162, proteines: 1.2, glucides: 3.5, lipides: 15 },

  // ── Sucres & divers ──
  { nom: 'Miel', calories: 327, proteines: 0.4, glucides: 81, lipides: 0 },
  { nom: 'Chocolat noir 70%', calories: 544, proteines: 8, glucides: 36, lipides: 41 },
  { nom: 'Chocolat au lait', calories: 545, proteines: 7, glucides: 56, lipides: 32 },
  { nom: 'Confiture', calories: 260, proteines: 0.4, glucides: 63, lipides: 0.1 },
  { nom: 'Sucre blanc', calories: 400, proteines: 0, glucides: 100, lipides: 0 },
  { nom: 'Sirop d\'érable', calories: 260, proteines: 0, glucides: 67, lipides: 0 },
  { nom: 'Compote de pomme, sans sucre ajouté', calories: 52, proteines: 0.3, glucides: 12, lipides: 0.1 },

  // ── Autres courants ──
  { nom: 'Houmous', calories: 241, proteines: 7.4, glucides: 14, lipides: 17 },
  { nom: 'Sauce tomate', calories: 39, proteines: 1.5, glucides: 6.5, lipides: 0.8 },
  { nom: 'Crème de marron', calories: 260, proteines: 1.3, glucides: 60, lipides: 1.5 },
  { nom: 'Galette de riz', calories: 387, proteines: 7, glucides: 85, lipides: 2.5 },
  { nom: 'Fruits secs (mélange)', calories: 359, proteines: 3, glucides: 75, lipides: 1.5 },
  { nom: 'Dattes, séchées', calories: 287, proteines: 2.5, glucides: 64, lipides: 0.4 },
  { nom: 'Raisins secs', calories: 303, proteines: 3, glucides: 68, lipides: 0.5 },
  { nom: 'Banane séchée', calories: 346, proteines: 3.9, glucides: 75, lipides: 1.8 },
];

// Pré-calcul du nom normalisé (sans accents) pour le matching
const CIQUAL_ITEMS: (CiqualItem & { _search: string })[] = CIQUAL_DB.map((item) => ({
  nom: item.nom,
  calories: item.calories,
  proteines: item.proteines,
  glucides: item.glucides,
  lipides: item.lipides,
  source: 'ciqual' as const,
  _search: item.nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
}))

/**
 * Recherche dans la base Ciqual locale par nom (insensible aux accents,
 * tous les mots de la requête doivent matcher). Valeurs pour 100g.
 */
export function searchCiqual(query: string): CiqualItem[] {
  if (!query || query.length < 2) return []
  const normalized = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const words = normalized.split(/\s+/).filter(Boolean)
  return CIQUAL_ITEMS
    .filter((item) => words.every((w) => item._search.includes(w)))
    .map(({ _search, ...rest }) => rest)
}
