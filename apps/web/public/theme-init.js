// Applique le thème choisi (bouton clair/sombre) avant le premier affichage, pour éviter un flash.
// Fichier à part, hors de React (React 19 refuse les balises <script> dans ses composants).
// La clé "battle-theme" doit rester celle de src/components/layout/theme-toggle.tsx.
try {
  var t = localStorage.getItem("battle-theme");
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
} catch (e) {
  /* stockage indisponible : thème sombre par défaut */
}
