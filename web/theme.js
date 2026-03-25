const THEME_KEY = "portal_theme";
const TOGGLE_ID = "themeToggle";
const DARK_CLASS = "theme-dark";

function applyTheme(value) {
  const root = document.documentElement;
  if (value === "dark") {
    root.classList.add(DARK_CLASS);
  } else {
    root.classList.remove(DARK_CLASS);
  }
}

function getStoredTheme() {
  return localStorage.getItem(THEME_KEY);
}

function toggleTheme() {
  const current = document.documentElement.classList.contains(DARK_CLASS) ? "dark" : "light";
  const next = current === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
}

function initTheme() {
  const stored = getStoredTheme();
  if (stored) {
    applyTheme(stored);
  }
  const toggle = document.getElementById(TOGGLE_ID);
  if (toggle) {
    toggle.addEventListener("click", toggleTheme);
  }
}

initTheme();
