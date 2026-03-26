const loginCard = document.getElementById("loginCard");
const portalCard = document.getElementById("portalCard");
const loginStatus = document.getElementById("loginStatus");
const portalStatus = document.getElementById("portalStatus");
const fileRows = document.getElementById("fileRows");
const loginBtn = document.getElementById("loginBtn");
const refreshBtn = document.getElementById("refreshBtn");
const logoutBtn = document.getElementById("logoutBtn");
const createLinkBtn = document.getElementById("createLinkBtn");
const copyLinkBtn = document.getElementById("copyLinkBtn");
const deleteLinkBtn = document.getElementById("deleteLinkBtn");
const linkBox = document.getElementById("linkBox");
const linkQr = document.getElementById("linkQr");
const linkList = document.getElementById("linkList");
const totpStartBtn = document.getElementById("totpStartBtn");
const totpBox = document.getElementById("totpBox");
const totpQr = document.getElementById("totpQr");
const totpConfirm = document.getElementById("totpConfirm");
const totpCodeInput = document.getElementById("totpCodeInput");
const totpConfirmBtn = document.getElementById("totpConfirmBtn");
const totpState = document.getElementById("totpState");
const totpDescription = document.getElementById("totpDescription");
const linkMeta = document.getElementById("linkMeta");
const linkExpiry = document.getElementById("linkExpiry");
const linkCountdown = document.getElementById("linkCountdown");
const adminPanel = document.getElementById("adminPanel");
const adminRefreshBtn = document.getElementById("adminRefreshBtn");
const adminCreateLogin = document.getElementById("adminCreateLogin");
const adminCreatePassword = document.getElementById("adminCreatePassword");
const adminCreateBtn = document.getElementById("adminCreateBtn");
const adminUserRows = document.getElementById("adminUserRows");
const adminStatus = document.getElementById("adminStatus");

let countdownTimer = null;

if (loginStatus) {
  loginStatus.textContent = "Готово для входа.";
}

const loginInput = document.getElementById("login");
const passwordInput = document.getElementById("password");
const totpInput = document.getElementById("totp");

const ACCESS_KEY = "portal_access_token";
const LAST_LINK_KEY = "portal_last_link";
const LINKS_KEY = "portal_links";
const CURRENT_LINK_KEY = "portal_current_link";
let currentSession = null;
const SEND_PATH_RE = /^\/send\/([A-Z0-9]{4}-[A-Z0-9]{4})$/i;
let loginInFlight = false;

function showLoginStatus(message, isError = false) {
  if (!loginStatus) {
    return;
  }
  loginStatus.textContent = message;
  loginStatus.classList.remove("is-error", "is-success");
  if (message) {
    loginStatus.classList.add(isError ? "is-error" : "is-success");
  }
}

function showPortalStatus(message, isError = false) {
  if (!portalStatus) {
    return;
  }
  portalStatus.textContent = message;
  portalStatus.classList.remove("is-error", "is-success");
  if (message) {
    portalStatus.classList.add(isError ? "is-error" : "is-success");
  }
}

function showAdminStatus(message, isError = false) {
  if (!adminStatus) {
    return;
  }
  adminStatus.textContent = message;
  adminStatus.classList.remove("is-error", "is-success");
  if (message) {
    adminStatus.classList.add(isError ? "is-error" : "is-success");
  }
}

function setLoginBusy(isBusy) {
  loginInFlight = isBusy;
  if (loginBtn) {
    loginBtn.disabled = isBusy;
  }
}

function normalizeTotpCode(value) {
  return (value || "").replace(/\D/g, "").slice(0, 6);
}

function maybeAutoLoginFromTotp() {
  if (!totpInput) {
    return;
  }

  const normalized = normalizeTotpCode(totpInput.value);
  if (totpInput.value !== normalized) {
    totpInput.value = normalized;
  }

  if (loginInFlight) {
    return;
  }

  if (loginCard && loginCard.classList.contains("hidden")) {
    return;
  }

  if (normalized.length === 6 && loginInput && loginInput.value.trim() && passwordInput && passwordInput.value) {
    login();
  }
}

function hideLastLinkUi() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
  if (linkBox) {
    linkBox.textContent = "";
    linkBox.classList.add("hidden");
  }
  if (copyLinkBtn) {
    copyLinkBtn.classList.add("hidden");
  }
  if (deleteLinkBtn) {
    deleteLinkBtn.classList.add("hidden");
    deleteLinkBtn.disabled = false;
    deleteLinkBtn.textContent = "Удалить";
  }
  if (linkQr) {
    linkQr.innerHTML = "";
    linkQr.classList.add("hidden");
  }
  if (linkMeta) {
    linkMeta.classList.add("hidden");
  }
  if (linkExpiry) {
    linkExpiry.textContent = "";
  }
  if (linkCountdown) {
    linkCountdown.textContent = "";
  }
}

function renderLastLink(url, expiryDate, qrPng, qrSvg, isUsed = false) {
  if (linkBox) {
    linkBox.textContent = url;
    linkBox.classList.remove("hidden");
  }
  if (copyLinkBtn) {
    copyLinkBtn.classList.remove("hidden");
  }
  if (deleteLinkBtn) {
    deleteLinkBtn.classList.remove("hidden");
    deleteLinkBtn.disabled = isUsed;
    deleteLinkBtn.textContent = isUsed ? "Уже использована" : "Удалить";
  }
  renderLinkQr(qrPng, qrSvg);
  if (linkMeta) {
    linkMeta.classList.remove("hidden");
  }
  if (linkExpiry) {
    linkExpiry.textContent = expiryDate.toLocaleString();
  }
  startCountdown(expiryDate);
}

function renderLinkQr(qrPng, qrSvg) {
  if (!linkQr) {
    return;
  }

  if (qrPng) {
    linkQr.innerHTML = `<img src="data:image/png;base64,${qrPng}" alt="QR для ссылки передачи">`;
    linkQr.classList.remove("hidden");
    return;
  }

  if (qrSvg) {
    linkQr.innerHTML = qrSvg;
    linkQr.classList.remove("hidden");
    return;
  }

  linkQr.innerHTML = "";
  linkQr.classList.add("hidden");
}

function getLinkIdentity(link) {
  return link && (link.id || link.url);
}

function clearStoredLinksStorage() {
  localStorage.removeItem(LAST_LINK_KEY);
  localStorage.removeItem(LINKS_KEY);
  localStorage.removeItem(CURRENT_LINK_KEY);
  hideLastLinkUi();
  if (linkList) {
    linkList.innerHTML = "";
    linkList.classList.add("hidden");
  }
}

function normalizeStoredLink(data) {
  if (!data || !data.url) {
    return null;
  }

  const expiresAt = data.expires_at || data.expiresAt;
  if (!expiresAt) {
    return null;
  }

  const expiryDate = new Date(expiresAt);
  if (Number.isNaN(expiryDate.getTime()) || expiryDate <= new Date()) {
    return null;
  }

  return {
    id: typeof data.id === "string" ? data.id : null,
    url: data.url,
    expiresAt,
    qrPng: typeof data.qr_png === "string" ? data.qr_png : (typeof data.qrPng === "string" ? data.qrPng : null),
    qrSvg: typeof data.qr_svg === "string" ? data.qr_svg : (typeof data.qrSvg === "string" ? data.qrSvg : null),
    expiryDate
  };
}

function getCurrentLinkIdentity() {
  return localStorage.getItem(CURRENT_LINK_KEY);
}

function setCurrentLinkIdentity(identity) {
  if (!identity) {
    localStorage.removeItem(CURRENT_LINK_KEY);
    return;
  }
  localStorage.setItem(CURRENT_LINK_KEY, identity);
}

function saveStoredLinks(links) {
  if (!links.length) {
    clearStoredLinksStorage();
    return;
  }

  const payload = links.map((link) => ({
    id: link.id || null,
    url: link.url,
    expires_at: link.expiresAt,
    qr_png: link.qrPng || null,
    qr_svg: link.qrSvg || null
  }));

  localStorage.setItem(LINKS_KEY, JSON.stringify(payload));
  localStorage.removeItem(LAST_LINK_KEY);

  const currentIdentity = getCurrentLinkIdentity();
  const hasCurrent = payload.some((link) => getLinkIdentity(link) === currentIdentity);
  if (!hasCurrent) {
    setCurrentLinkIdentity(getLinkIdentity(payload[0]));
  }
}

function getStoredLinks() {
  const raw = localStorage.getItem(LINKS_KEY);
  let parsed = [];
  let migrated = false;

  if (raw) {
    try {
      const items = JSON.parse(raw);
      if (!Array.isArray(items)) {
        clearStoredLinksStorage();
        return [];
      }
      parsed = items;
    } catch (err) {
      clearStoredLinksStorage();
      return [];
    }
  } else {
    const legacyRaw = localStorage.getItem(LAST_LINK_KEY);
    if (legacyRaw) {
      try {
        const legacyItem = JSON.parse(legacyRaw);
        parsed = [legacyItem];
        migrated = true;
      } catch (err) {
        clearStoredLinksStorage();
        return [];
      }
    }
  }

  const normalized = parsed.map(normalizeStoredLink).filter(Boolean);
  const changed = migrated || normalized.length !== parsed.length;
  if (changed) {
    saveStoredLinks(normalized);
  }

  if (!normalized.length) {
    return [];
  }

  const currentIdentity = getCurrentLinkIdentity();
  const hasCurrent = normalized.some((link) => getLinkIdentity(link) === currentIdentity);
  if (!hasCurrent) {
    setCurrentLinkIdentity(getLinkIdentity(normalized[0]));
  }

  return normalized;
}

function getLastLinkLabel(url) {
  try {
    const parsed = new URL(url, window.location.origin);
    const match = parsed.pathname.match(SEND_PATH_RE);
    if (!match) {
      return null;
    }
    return `${match[1].toUpperCase().slice(0, 4)}-****`;
  } catch (err) {
    return null;
  }
}

function getLastLinkCode(url) {
  try {
    const parsed = new URL(url, window.location.origin);
    const match = parsed.pathname.match(SEND_PATH_RE);
    return match ? match[1].toUpperCase() : null;
  } catch (err) {
    return null;
  }
}

function getStoredLastLink(links = null) {
  const storedLinks = links || getStoredLinks();
  if (!storedLinks.length) {
    return null;
  }

  const currentIdentity = getCurrentLinkIdentity();
  const selected = storedLinks.find((link) => getLinkIdentity(link) === currentIdentity) || storedLinks[0];
  if (getLinkIdentity(selected) !== currentIdentity) {
    setCurrentLinkIdentity(getLinkIdentity(selected));
  }
  return selected;
}

function getStoredLinkDisplay(url) {
  const code = getLastLinkCode(url);
  try {
    const parsed = new URL(url, window.location.origin);
    return {
      code: code || parsed.pathname.replace(/^\/+/, "") || parsed.host,
      subtitle: `${parsed.host}${parsed.pathname}`
    };
  } catch (err) {
    return {
      code: code || url,
      subtitle: url
    };
  }
}

function renderStoredLinks(links, usedLinkIds = new Set()) {
  if (!linkList) {
    return;
  }

  if (!links.length) {
    linkList.innerHTML = "";
    linkList.classList.add("hidden");
    return;
  }

  const current = getStoredLastLink(links);
  const currentIdentity = getLinkIdentity(current);
  linkList.innerHTML = "";

  links.forEach((link) => {
    const identity = getLinkIdentity(link);
    const isUsed = usedLinkIds.has(identity);
    const isSelected = identity === currentIdentity;
    const display = getStoredLinkDisplay(link.url);
    const card = document.createElement("div");
    card.className = `saved-link${isSelected ? " is-selected" : ""}`;
    card.innerHTML = `
      <div class="saved-link-main">
        <div class="saved-link-code" title="${link.url}">${display.code}</div>
        <div class="saved-link-host" title="${link.url}">${display.subtitle}</div>
        <div class="saved-link-meta">
          Действует до: ${link.expiryDate.toLocaleString()} ·
          <span class="saved-link-state">${isUsed ? "Использована" : "Готова"}</span>
        </div>
      </div>
      <div class="saved-link-actions">
        <button class="btn btn-secondary" type="button" data-action="select" ${isSelected ? "disabled" : ""}>${isSelected ? "Показана" : "Показать"}</button>
        <button class="btn btn-secondary" type="button" data-action="copy">Копировать</button>
        <button class="btn btn-secondary" type="button" data-action="delete" ${isUsed ? "disabled" : ""}>${isUsed ? "Уже использована" : "Удалить"}</button>
      </div>
    `;

    const selectBtn = card.querySelector('[data-action="select"]');
    const copyBtn = card.querySelector('[data-action="copy"]');
    const deleteBtn = card.querySelector('[data-action="delete"]');

    if (selectBtn) {
      selectBtn.addEventListener("click", () => {
        setCurrentLinkIdentity(identity);
        restoreLastLink(usedLinkIds);
      });
    }
    if (copyBtn) {
      copyBtn.addEventListener("click", () => copyLink(link.url));
    }
    if (deleteBtn) {
      deleteBtn.addEventListener("click", () => deleteLink(link));
    }

    linkList.appendChild(card);
  });

  linkList.classList.remove("hidden");
}

function removeStoredLink(target) {
  const links = getStoredLinks();
  const targetIdentity = typeof target === "string" ? target : getLinkIdentity(target);
  const filtered = links.filter((link) => getLinkIdentity(link) !== targetIdentity);
  saveStoredLinks(filtered);
}

function clearLastLink() {
  const current = getStoredLastLink();
  if (!current) {
    clearStoredLinksStorage();
    return;
  }
  removeStoredLink(current);
  restoreLastLink();
}

function syncLastLinkWithItems(items) {
  const links = getStoredLinks();
  if (!links.length) {
    renderStoredLinks([]);
    hideLastLinkUi();
    return;
  }

  const usedLinkIds = new Set();
  const keptLinks = [];

  links.forEach((link) => {
    const relatedItems = link.id
      ? items.filter((item) => item.upload_link_id === link.id)
      : items.filter((item) => item.upload_link_label === getLastLinkLabel(link.url));

    if (!relatedItems.length) {
      keptLinks.push(link);
      return;
    }

    usedLinkIds.add(getLinkIdentity(link));
    const hasPendingFiles = relatedItems.some((item) => item.status === "uploaded");
    if (hasPendingFiles) {
      keptLinks.push(link);
    }
  });

  saveStoredLinks(keptLinks);
  if (!keptLinks.length) {
    hideLastLinkUi();
    renderStoredLinks([]);
    return;
  }

  const current = getStoredLastLink(keptLinks);
  const currentUsed = usedLinkIds.has(getLinkIdentity(current));
  renderLastLink(current.url, current.expiryDate, current.qrPng, current.qrSvg, currentUsed);
  renderStoredLinks(keptLinks, usedLinkIds);
}

function hideTotpSetup() {
  if (totpBox) {
    totpBox.classList.add("hidden");
    totpBox.textContent = "";
  }
  if (totpQr) {
    totpQr.classList.add("hidden");
    totpQr.innerHTML = "";
  }
  if (totpConfirm) {
    totpConfirm.classList.add("hidden");
  }
  if (totpCodeInput) {
    totpCodeInput.value = "";
  }
}

function setTotpUi(enabled) {
  if (enabled) {
    hideTotpSetup();
    if (totpStartBtn) {
      totpStartBtn.disabled = true;
      totpStartBtn.textContent = "TOTP включен";
    }
    if (totpState) {
      totpState.textContent = "TOTP включен";
    }
    if (totpDescription) {
      totpDescription.textContent = "Код через приложение-аутентификатор уже включен.";
    }
    return;
  }

  if (totpStartBtn) {
    totpStartBtn.disabled = false;
    totpStartBtn.textContent = "Включить TOTP через приложение-аутентификатор";
  }
  if (totpState) {
    totpState.textContent = "TOTP не включен";
  }
  if (totpDescription) {
    totpDescription.textContent = "Включите код через приложение-аутентификатор.";
  }
}

function formatBytes(bytes) {
  const units = ["Б", "КБ", "МБ", "ГБ"];
  let value = bytes;
  let unit = units[0];
  for (let i = 1; i < units.length && value >= 1024; i += 1) {
    value /= 1024;
    unit = units[i];
  }
  return `${value.toFixed(1)} ${unit}`;
}

async function login() {
  if (loginInFlight) {
    return;
  }

  showLoginStatus("Отправка...");
  const username = loginInput.value.trim();
  const password = passwordInput.value;
  const totp = normalizeTotpCode(totpInput ? totpInput.value : "");

  if (!username || !password) {
    showLoginStatus("Заполните логин и пароль.", true);
    return;
  }

  setLoginBusy(true);
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, totp })
    });

    if (!response.ok) {
      showLoginStatus("Неверные данные или код.", true);
      return;
    }

    const data = await response.json();
    localStorage.setItem(ACCESS_KEY, data.access_token);
    showLoginStatus("Вход выполнен.");
    showPortal();
    await loadSessionState();
    await loadAdminUsers();
    await loadFiles();
  } catch (err) {
    showLoginStatus("Ошибка сети. Проверьте подключение.", true);
  } finally {
    setLoginBusy(false);
  }
}

function showPortal() {
  if (loginCard) {
    loginCard.classList.add("hidden");
  }
  if (portalCard) {
    portalCard.classList.remove("hidden");
  }
}

function resetLoginForm() {
  if (loginInput) {
    loginInput.value = "";
  }
  if (passwordInput) {
    passwordInput.value = "";
  }
  if (totpInput) {
    totpInput.value = "";
  }
}

function resetAdminUi() {
  if (adminPanel) {
    adminPanel.classList.add("hidden");
  }
  if (adminUserRows) {
    adminUserRows.innerHTML = "";
  }
  if (adminCreateLogin) {
    adminCreateLogin.value = "";
  }
  if (adminCreatePassword) {
    adminCreatePassword.value = "";
  }
  showAdminStatus("");
}

async function loadSessionState() {
  const token = getAccessToken();
  if (!token) {
    currentSession = null;
    return null;
  }

  const response = await fetch("/api/portal/me", {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (response.status === 401) {
    currentSession = null;
    clearSession("Сессия истекла. Выполните вход.");
    return null;
  }

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  currentSession = data;
  setTotpUi(Boolean(data.totp_enabled));

  if (data.is_admin) {
    if (adminPanel) {
      adminPanel.classList.remove("hidden");
    }
  } else {
    resetAdminUi();
  }

  return data;
}

function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

function clearSession(message) {
  localStorage.removeItem(ACCESS_KEY);
  resetLoginForm();
  resetAdminUi();
  if (portalCard) {
    portalCard.classList.add("hidden");
  }
  if (loginCard) {
    loginCard.classList.remove("hidden");
  }
  if (message) {
    showLoginStatus(message, true);
  }
}

async function loadFiles() {
  showPortalStatus("Загрузка списка...");
  const token = getAccessToken();
  if (!token) {
    clearSession("Сессия не найдена. Выполните вход.");
    return;
  }

  const response = await fetch("/api/portal/files", {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearSession("Сессия истекла. Выполните вход.");
      return;
    }
    showPortalStatus("Не удалось получить список.", true);
    return;
  }

  const data = await response.json();
  syncLastLinkWithItems(data.items);
  if (fileRows) {
    fileRows.innerHTML = "";
  }

  if (fileRows) {
    fileRows.innerHTML = "";
  }

  if (!data.items.length) {
    showPortalStatus("Список пуст.");
    return;
  }

  if (fileRows) {
    const groups = new Map();
    data.items.forEach((item) => {
      const label = item.upload_link_label || "Без ссылки";
      if (!groups.has(label)) {
        groups.set(label, []);
      }
      groups.get(label).push(item);
    });

    const orderedGroups = Array.from(groups.entries());
    orderedGroups.forEach(([label, items]) => {
      const header = document.createElement("tr");
      header.className = "group-row";
      header.innerHTML = `<td colspan="5">Ссылка: ${label}</td>`;
      fileRows.appendChild(header);

      items.forEach((item) => {
        const deleteAt = item.delete_at ? new Date(item.delete_at) : null;
        const deleteLabel = deleteAt ? deleteAt.toLocaleString() : "—";
        const actionLabel = item.status === "uploaded" ? "Скачать" : "Получен";
        const actionDisabled = item.status !== "uploaded" ? "disabled" : "";
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${item.orig_name}</td>
          <td>${formatBytes(item.size_bytes)}</td>
          <td>${new Date(item.created_at).toLocaleString()}</td>
          <td>
            <div>${deleteLabel}</div>
            <div class="delete-countdown" data-delete-at="${item.delete_at || ""}"></div>
          </td>
          <td><button class="btn btn-secondary" data-id="${item.id}" ${actionDisabled}>${actionLabel}</button></td>
        `;
        const button = row.querySelector("button");
        if (item.status === "uploaded") {
          button.addEventListener("click", () => downloadFile(item.id));
        }
        fileRows.appendChild(row);
      });
    });
  }

  updateDeleteCountdowns();
  if (!deleteCountdownTimer) {
    deleteCountdownTimer = setInterval(updateDeleteCountdowns, 1000);
  }

  showPortalStatus("Список обновлён.");
}

function buildAdminRow(user) {
  const row = document.createElement("tr");
  const totpLabel = user.totp_enabled ? "Включен" : "Выключен";
  const disableLabel = user.totp_enabled ? "Отключить TOTP" : "TOTP выключен";
  const disableDisabled = user.totp_enabled ? "" : "disabled";
  row.innerHTML = `
    <td>${user.username}</td>
    <td>${new Date(user.created_at).toLocaleString()}</td>
    <td>${totpLabel}</td>
    <td><input class="admin-password-input" type="password" autocomplete="new-password" placeholder="Новый пароль" /></td>
    <td>
      <div class="admin-actions">
        <button class="btn set-password-btn" type="button">Сменить пароль</button>
        <button class="btn btn-secondary disable-totp-btn" type="button" ${disableDisabled}>${disableLabel}</button>
      </div>
    </td>
  `;

  const passwordInput = row.querySelector(".admin-password-input");
  const setPasswordBtn = row.querySelector(".set-password-btn");
  const disableTotpBtn = row.querySelector(".disable-totp-btn");

  setPasswordBtn.addEventListener("click", () => setAdminPassword(user.id, passwordInput));
  disableTotpBtn.addEventListener("click", () => disableAdminTotp(user.id));

  return row;
}

async function loadAdminUsers() {
  const token = getAccessToken();
  if (!token) {
    return;
  }

  if (!currentSession || !currentSession.is_admin) {
    resetAdminUi();
    return;
  }

  const response = await fetch("/api/portal/admin/users", {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (response.status === 403) {
    if (adminPanel) {
      adminPanel.classList.remove("hidden");
    }
    showAdminStatus("Раздел управления недоступен для этой учетной записи.", true);
    return;
  }

  if (response.status === 401) {
    clearSession("Сессия истекла. Выполните вход.");
    return;
  }

  if (!response.ok) {
    if (adminPanel) {
      adminPanel.classList.remove("hidden");
    }
    showAdminStatus("Не удалось получить учетные записи.", true);
    return;
  }

  const data = await response.json();
  if (adminPanel) {
    adminPanel.classList.remove("hidden");
  }
  if (adminUserRows) {
    adminUserRows.innerHTML = "";
    data.items.forEach((user) => {
      adminUserRows.appendChild(buildAdminRow(user));
    });
  }
  showAdminStatus("Учетные записи обновлены.");
}

async function createAdminUser() {
  const token = getAccessToken();
  const username = adminCreateLogin ? adminCreateLogin.value.trim() : "";
  const password = adminCreatePassword ? adminCreatePassword.value : "";

  if (!token) {
    clearSession("Сессия не найдена. Выполните вход.");
    return;
  }

  if (!username || !password) {
    showAdminStatus("Заполните логин и пароль для новой учетной записи.", true);
    return;
  }

  const response = await fetch("/api/portal/admin/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ username, password })
  });

  if (response.status === 401) {
    clearSession("Сессия истекла. Выполните вход.");
    return;
  }

  if (response.status === 403) {
    resetAdminUi();
    return;
  }

  if (response.status === 409) {
    showAdminStatus("Такой логин уже существует.", true);
    return;
  }

  if (!response.ok) {
    showAdminStatus("Не удалось создать учетную запись.", true);
    return;
  }

  if (adminCreateLogin) {
    adminCreateLogin.value = "";
  }
  if (adminCreatePassword) {
    adminCreatePassword.value = "";
  }
  showAdminStatus("Учетная запись создана.");
  await loadAdminUsers();
}

async function setAdminPassword(userId, input) {
  const token = getAccessToken();
  const password = input ? input.value : "";
  if (!token) {
    clearSession("Сессия не найдена. Выполните вход.");
    return;
  }
  if (!password) {
    showAdminStatus("Введите новый пароль.", true);
    return;
  }

  const response = await fetch(`/api/portal/admin/users/${userId}/password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ password })
  });

  if (response.status === 401) {
    clearSession("Сессия истекла. Выполните вход.");
    return;
  }

  if (response.status === 403) {
    resetAdminUi();
    return;
  }

  if (!response.ok) {
    showAdminStatus("Не удалось обновить пароль.", true);
    return;
  }

  input.value = "";
  showAdminStatus("Пароль обновлен.");
}

async function disableAdminTotp(userId) {
  const token = getAccessToken();
  if (!token) {
    clearSession("Сессия не найдена. Выполните вход.");
    return;
  }

  const response = await fetch(`/api/portal/admin/users/${userId}/disable-totp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (response.status === 401) {
    clearSession("Сессия истекла. Выполните вход.");
    return;
  }

  if (response.status === 403) {
    resetAdminUi();
    return;
  }

  if (!response.ok) {
    showAdminStatus("Не удалось отключить TOTP.", true);
    return;
  }

  showAdminStatus("TOTP отключен.");
  await loadAdminUsers();
}

async function createLink() {
  showPortalStatus("");
  const token = getAccessToken();
  if (!token) {
    clearSession("Сессия не найдена. Выполните вход.");
    return;
  }

  const response = await fetch("/api/portal/links", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({})
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearSession("Сессия истекла. Выполните вход.");
      return;
    }
    showPortalStatus("Не удалось создать ссылку.", true);
    return;
  }

  const data = await response.json();
  saveLastLink(data.url, data.expires_at, data.id, data.qr_png, data.qr_svg);
  restoreLastLink();
  showPortalStatus("Ссылка создана.");
}

async function deleteLink(linkOverride = null) {
  const token = getAccessToken();
  const stored = linkOverride || getStoredLastLink();

  if (!token) {
    clearSession("Сессия не найдена. Выполните вход.");
    return;
  }

  if (!stored) {
    clearLastLink();
    showPortalStatus("Ссылка уже недоступна.");
    return;
  }

  if (!window.confirm("Удалить текущую ссылку для передачи?")) {
    return;
  }

  const payload = {};
  if (stored.id) {
    payload.id = stored.id;
  } else {
    const code = getLastLinkCode(stored.url);
    if (code) {
      payload.code = code;
    }
  }

  if (!payload.id && !payload.code) {
    removeStoredLink(stored);
    restoreLastLink();
    showPortalStatus("Не удалось определить ссылку для удаления.", true);
    return;
  }

  const response = await fetch("/api/portal/links/revoke", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  if (response.status === 401) {
    clearSession("Сессия истекла. Выполните вход.");
    return;
  }

  if (response.status === 404) {
    removeStoredLink(stored);
    restoreLastLink();
    showPortalStatus("Ссылка уже удалена.");
    return;
  }

  if (response.status === 409) {
    if (deleteLinkBtn) {
      deleteLinkBtn.disabled = true;
      deleteLinkBtn.textContent = "Уже использована";
    }
    showPortalStatus("Ссылка уже использована и не может быть удалена вручную.", true);
    return;
  }

  if (!response.ok) {
    showPortalStatus("Не удалось удалить ссылку.", true);
    return;
  }

  removeStoredLink(stored);
  restoreLastLink();
  showPortalStatus("Ссылка удалена.");
}

function saveLastLink(url, expiresAt, id, qrPng, qrSvg) {
  const nextLink = normalizeStoredLink({
    id: id || null,
    url,
    expires_at: expiresAt,
    qr_png: qrPng || null,
    qr_svg: qrSvg || null
  });
  if (!nextLink) {
    return;
  }

  const links = getStoredLinks().filter((link) => getLinkIdentity(link) !== getLinkIdentity(nextLink));
  links.unshift(nextLink);
  saveStoredLinks(links);
  setCurrentLinkIdentity(getLinkIdentity(nextLink));
}

function restoreLastLink(usedLinkIds = new Set()) {
  const links = getStoredLinks();
  if (!links.length) {
    hideLastLinkUi();
    renderStoredLinks([]);
    return;
  }
  const current = getStoredLastLink(links);
  const currentUsed = usedLinkIds.has(getLinkIdentity(current));
  renderLastLink(current.url, current.expiryDate, current.qrPng, current.qrSvg, currentUsed);
  renderStoredLinks(links, usedLinkIds);
}

async function startTotp() {
  showPortalStatus("");
  const token = getAccessToken();
  if (!token) {
    clearSession("Сессия не найдена. Выполните вход.");
    return;
  }

  const response = await fetch("/api/portal/totp/start", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearSession("Сессия истекла. Выполните вход.");
      return;
    }
    if (response.status === 400) {
      await loadSessionState();
      showPortalStatus("Код уже включен.");
    } else {
      showPortalStatus("Не удалось начать настройку.", true);
    }
    return;
  }

  const data = await response.json();
  if (totpBox) {
    totpBox.textContent = `Секрет для приложения: ${data.secret}`;
    totpBox.classList.remove("hidden");
  }
  if (totpQr && data.qr_png) {
    totpQr.innerHTML = `<img src="data:image/png;base64,${data.qr_png}" alt="QR">`;
    totpQr.classList.remove("hidden");
  } else if (totpQr && data.qr_svg) {
    totpQr.innerHTML = data.qr_svg;
    totpQr.classList.remove("hidden");
  }
  if (totpConfirm) {
    totpConfirm.classList.remove("hidden");
  }
  showPortalStatus("Введите код из приложения для подтверждения.");
}

async function loadTotpStatus() {
  await loadSessionState();
}

async function confirmTotp() {
  showPortalStatus("");
  const token = getAccessToken();
  const code = totpCodeInput ? totpCodeInput.value.trim() : "";
  if (!token || !code) {
    showPortalStatus("Введите код.", true);
    return;
  }

  const response = await fetch("/api/portal/totp/confirm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ code })
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearSession("Сессия истекла. Выполните вход.");
      return;
    }
    showPortalStatus("Код не принят.", true);
    return;
  }

  showPortalStatus("Код включен.");
  await loadSessionState();
}

function startCountdown(expiryDate) {
  if (countdownTimer) {
    clearInterval(countdownTimer);
  }

  const update = () => {
    const now = new Date();
    const diffMs = expiryDate - now;
    if (diffMs <= 0) {
      linkCountdown.textContent = "истекло";
      clearInterval(countdownTimer);
      countdownTimer = null;
      return;
    }
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    linkCountdown.textContent = `${hours}ч ${minutes}м ${seconds}с`;
  };

  update();
  countdownTimer = setInterval(update, 1000);
}

let deleteCountdownTimer = null;

function updateDeleteCountdowns() {
  const nodes = document.querySelectorAll(".delete-countdown");
  nodes.forEach((node) => {
    const raw = node.getAttribute("data-delete-at");
    if (!raw) {
      node.textContent = "—";
      return;
    }
    const deleteAt = new Date(raw);
    const now = new Date();
    const diffMs = deleteAt - now;
    if (diffMs <= 0) {
      node.textContent = "удаляется";
      return;
    }
    const totalSeconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    node.textContent = `${minutes}м ${seconds}с`;
  });
}

async function copyLink(text = null) {
  const value = text || (linkBox ? linkBox.textContent : "");
  const textToCopy = value ? value.trim() : "";
  if (!textToCopy) {
    return;
  }
  try {
    await navigator.clipboard.writeText(textToCopy);
    showPortalStatus("Ссылка скопирована.");
  } catch (err) {
    showPortalStatus("Не удалось скопировать.", true);
  }
}

function getFilenameFromHeader(headerValue, fallback) {
  if (!headerValue) return fallback;
  const match = headerValue.match(/filename\*?=([^;]+)/i);
  if (!match) return fallback;
  let value = match[1].trim();
  if (value.startsWith("UTF-8''")) {
    value = decodeURIComponent(value.substring(7));
  }
  return value.replace(/['\"]/g, "") || fallback;
}

async function downloadFile(id) {
  showPortalStatus("");
  const token = getAccessToken();
  const response = await fetch(`/api/portal/files/${id}/download`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (response.status === 410) {
    showPortalStatus("Файл уже получен или недоступен.", true);
    await loadFiles();
    return;
  }

  if (!response.ok) {
    showPortalStatus("Не удалось получить файл.", true);
    return;
  }

  const blob = await response.blob();
  const header = response.headers.get("Content-Disposition") || "";
  const filename = getFilenameFromHeader(header, `file-${id}`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  showPortalStatus("Файл получен. Он будет удалён автоматически через 10 минут.");
  await loadFiles();
}

if (loginBtn) {
  loginBtn.addEventListener("click", login);
}
window.portalLogin = login;
if (loginInput) {
  loginInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") login();
  });
}
if (passwordInput) {
  passwordInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") login();
  });
}
if (totpInput) {
  totpInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") login();
  });
  totpInput.addEventListener("input", maybeAutoLoginFromTotp);
}
if (refreshBtn) {
  refreshBtn.addEventListener("click", loadFiles);
}
if (adminRefreshBtn) {
  adminRefreshBtn.addEventListener("click", loadAdminUsers);
}
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => clearSession("Вы вышли из кабинета."));
}
if (adminCreateBtn) {
  adminCreateBtn.addEventListener("click", createAdminUser);
}
if (createLinkBtn) {
  createLinkBtn.addEventListener("click", createLink);
}
if (copyLinkBtn) {
  copyLinkBtn.addEventListener("click", copyLink);
}
if (deleteLinkBtn) {
  deleteLinkBtn.addEventListener("click", deleteLink);
}
if (totpStartBtn) {
  totpStartBtn.addEventListener("click", startTotp);
}
if (totpConfirmBtn) {
  totpConfirmBtn.addEventListener("click", confirmTotp);
}

if (getAccessToken()) {
  showPortal();
  restoreLastLink();
  loadSessionState().then(() => loadAdminUsers());
  loadFiles();
}
