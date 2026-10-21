"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

const KEY = "battle-theme";

/**
 * Bouton clair / sombre. Le thème vit dans l'attribut data-theme de <html> (posé avant l'affichage
 * par le petit script de THEME_INIT, pour éviter un flash) ; le choix est gardé dans le navigateur
 * (localStorage, facultatif : sans lui le thème sombre reste le défaut).
 */
export const THEME_INIT = `try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

/** Thème courant, lu dans <html> (null au rendu serveur : le bouton n'affiche alors aucune icône). */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
const read = () => (document.documentElement.dataset.theme === "light" ? "light" : "dark");

export function ThemeToggle({ labelLight, labelDark }: { labelLight: string; labelDark: string }) {
  const theme = useSyncExternalStore(subscribe, read, () => null);

  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* stockage indisponible : le choix vaut pour cette visite seulement */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "light" ? labelDark : labelLight}
      title={theme === "light" ? labelDark : labelLight}
      className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:text-foreground"
    >
      {theme === "light" ? (
        <Moon className="size-4" />
      ) : theme === "dark" ? (
        <Sun className="size-4" />
      ) : null}
    </button>
  );
}
