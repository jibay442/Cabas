import type { Theme } from "../../shared/types.ts";

const KEY = "cabas-theme";
const media = () => window.matchMedia("(prefers-color-scheme: dark)");

let current: Theme = "SYSTEM";

function render() {
  const dark = current === "DARK" || (current === "SYSTEM" && media().matches);
  document.documentElement.classList.toggle("dark", dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#12151b" : "#f9fafb");
}

export function applyTheme(theme: Theme) {
  current = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // stockage indisponible (navigation privée) : sans conséquence
  }
  render();
}

export function storedTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    if (t === "LIGHT" || t === "DARK" || t === "SYSTEM") return t;
  } catch {
    // ignore
  }
  return "SYSTEM";
}

/** Couleur principale du foyer (boutons, liens, éléments actifs) */
export function applyAccent(color: string) {
  document.documentElement.style.setProperty("--brand", color);
}

media().addEventListener("change", render);
current = storedTheme();
