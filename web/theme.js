const THEME_KEY = "portal_theme";
const TOGGLE_ID = "themeToggle";
const TOGGLE_VALUE_ID = "themeToggleValue";
const DARK_CLASS = "theme-dark";

function applyTheme(value) {
  const root = document.documentElement;
  if (value === "dark") {
    root.classList.add(DARK_CLASS);
  } else {
    root.classList.remove(DARK_CLASS);
  }
}

function updateToggleUi(value) {
  const toggle = document.getElementById(TOGGLE_ID);
  const valueNode = document.getElementById(TOGGLE_VALUE_ID);
  const isDark = value === "dark";
  if (valueNode) {
    valueNode.textContent = isDark ? "Темное" : "Светлое";
  }
  if (toggle) {
    toggle.setAttribute("aria-pressed", isDark ? "true" : "false");
    toggle.title = isDark ? "Переключить на светлое оформление" : "Переключить на темное оформление";
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
  updateToggleUi(next);
}

function initTheme() {
  const stored = getStoredTheme() || "light";
  applyTheme(stored);
  updateToggleUi(stored);
  const toggle = document.getElementById(TOGGLE_ID);
  if (toggle) {
    toggle.addEventListener("click", toggleTheme);
  }
}

initTheme();
