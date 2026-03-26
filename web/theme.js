const THEME_KEY = "portal_theme";
const TOGGLE_ID = "themeToggle";
const TOGGLE_VALUE_ID = "themeToggleValue";
const DARK_CLASS = "theme-dark";
const AUTO_THEME = "auto";
const DARK_THEME = "dark";
const LIGHT_THEME = "light";
const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";
const systemThemeQuery = window.matchMedia ? window.matchMedia(SYSTEM_DARK_QUERY) : null;

function normalizeTheme(value) {
  if (value === DARK_THEME || value === LIGHT_THEME || value === AUTO_THEME) {
    return value;
  }
  return AUTO_THEME;
}

function getSystemTheme() {
  return systemThemeQuery && systemThemeQuery.matches ? DARK_THEME : LIGHT_THEME;
}

function getEffectiveTheme(value) {
  const normalized = normalizeTheme(value);
  return normalized === AUTO_THEME ? getSystemTheme() : normalized;
}

function applyTheme(value) {
  const root = document.documentElement;
  const effectiveTheme = getEffectiveTheme(value);
  if (effectiveTheme === DARK_THEME) {
    root.classList.add(DARK_CLASS);
  } else {
    root.classList.remove(DARK_CLASS);
  }
  return effectiveTheme;
}

function updateToggleUi(value) {
  const toggle = document.getElementById(TOGGLE_ID);
  const valueNode = document.getElementById(TOGGLE_VALUE_ID);
  const normalized = normalizeTheme(value);
  const effectiveTheme = getEffectiveTheme(normalized);
  const isDark = effectiveTheme === DARK_THEME;
  if (valueNode) {
    if (normalized === AUTO_THEME) {
      valueNode.textContent = isDark ? "Авто: темное" : "Авто: светлое";
    } else {
      valueNode.textContent = isDark ? "Темное" : "Светлое";
    }
  }
  if (toggle) {
    toggle.setAttribute("aria-pressed", isDark ? "true" : "false");
    toggle.title = normalized === AUTO_THEME
      ? (isDark
        ? "Системное оформление: темное. Нажмите, чтобы закрепить светлое."
        : "Системное оформление: светлое. Нажмите, чтобы закрепить темное.")
      : (isDark
        ? "Переключить на светлое оформление"
        : "Переключить на темное оформление");
  }
}

function getStoredTheme() {
  return normalizeTheme(localStorage.getItem(THEME_KEY));
}

function toggleTheme() {
  const current = getStoredTheme();
  const effectiveTheme = getEffectiveTheme(current);
  const next = effectiveTheme === DARK_THEME ? LIGHT_THEME : DARK_THEME;
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
  updateToggleUi(next);
}

function syncSystemTheme() {
  const current = getStoredTheme();
  if (current !== AUTO_THEME) {
    return;
  }
  applyTheme(AUTO_THEME);
  updateToggleUi(AUTO_THEME);
}

function initTheme() {
  const stored = getStoredTheme();
  applyTheme(stored);
  updateToggleUi(stored);
  const toggle = document.getElementById(TOGGLE_ID);
  if (toggle) {
    toggle.addEventListener("click", toggleTheme);
  }
  if (systemThemeQuery) {
    if (typeof systemThemeQuery.addEventListener === "function") {
      systemThemeQuery.addEventListener("change", syncSystemTheme);
    } else if (typeof systemThemeQuery.addListener === "function") {
      systemThemeQuery.addListener(syncSystemTheme);
    }
  }
}

initTheme();
