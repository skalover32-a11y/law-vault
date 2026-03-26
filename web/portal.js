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
const linkBox = document.getElementById("linkBox");
const linkQr = document.getElementById("linkQr");
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
let currentSession = null;
const SEND_PATH_RE = /^\/send\/([A-Z0-9]{4}-[A-Z0-9]{4})$/i;

function showLoginStatus(message, isError = false) {
  if (!loginStatus) {
    return;
  }
  loginStatus.textContent = message;
  loginStatus.style.color = isError ? "#a02f2f" : "#134638";
}

function showPortalStatus(message, isError = false) {
  if (!portalStatus) {
    return;
  }
  portalStatus.textContent = message;
  portalStatus.style.color = isError ? "#a02f2f" : "#134638";
}

function showAdminStatus(message, isError = false) {
  if (!adminStatus) {
    return;
  }
  adminStatus.textContent = message;
  adminStatus.style.color = isError ? "#a02f2f" : "#134638";
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

function clearLastLink() {
  localStorage.removeItem(LAST_LINK_KEY);
  hideLastLinkUi();
}

function renderLastLink(url, expiryDate, qrPng, qrSvg) {
  if (linkBox) {
    linkBox.textContent = url;
    linkBox.classList.remove("hidden");
  }
  if (copyLinkBtn) {
    copyLinkBtn.classList.remove("hidden");
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

function getStoredLastLink() {
  const raw = localStorage.getItem(LAST_LINK_KEY);
  if (!raw) {
    return null;
  }

  try {
    const data = JSON.parse(raw);
    if (!data.url || !data.expires_at) {
      clearLastLink();
      return null;
    }

    const expiryDate = new Date(data.expires_at);
    if (Number.isNaN(expiryDate.getTime()) || expiryDate <= new Date()) {
      clearLastLink();
      return null;
    }

    return {
      id: typeof data.id === "string" ? data.id : null,
      url: data.url,
      expiresAt: data.expires_at,
      qrPng: typeof data.qr_png === "string" ? data.qr_png : null,
      qrSvg: typeof data.qr_svg === "string" ? data.qr_svg : null,
      expiryDate
    };
  } catch (err) {
    clearLastLink();
    return null;
  }
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

function syncLastLinkWithItems(items) {
  const stored = getStoredLastLink();
  if (!stored) {
    return;
  }

  const relatedItems = stored.id
    ? items.filter((item) => item.upload_link_id === stored.id)
    : items.filter((item) => item.upload_link_label === getLastLinkLabel(stored.url));

  if (!relatedItems.length) {
    return;
  }

  const hasPendingFiles = relatedItems.some((item) => item.status === "uploaded");
  if (!hasPendingFiles) {
    clearLastLink();
  }
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
  showLoginStatus("Отправка...");
  const username = loginInput.value.trim();
  const password = passwordInput.value;
  const totp = totpInput.value.trim();

  if (!username || !password) {
    showLoginStatus("Заполните логин и пароль.", true);
    return;
  }

  let response;
  try {
    response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, totp })
    });
  } catch (err) {
    showLoginStatus("Ошибка сети. Проверьте подключение.", true);
    return;
  }

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
  const expiryDate = new Date(data.expires_at);
  renderLastLink(data.url, expiryDate, data.qr_png, data.qr_svg);
  saveLastLink(data.url, data.expires_at, data.id, data.qr_png, data.qr_svg);
  showPortalStatus("Ссылка создана.");
}

function saveLastLink(url, expiresAt, id, qrPng, qrSvg) {
  const payload = {
    id: id || null,
    url,
    expires_at: expiresAt,
    qr_png: qrPng || null,
    qr_svg: qrSvg || null
  };
  localStorage.setItem(LAST_LINK_KEY, JSON.stringify(payload));
}

function restoreLastLink() {
  const stored = getStoredLastLink();
  if (!stored) {
    hideLastLinkUi();
    return;
  }
  renderLastLink(stored.url, stored.expiryDate, stored.qrPng, stored.qrSvg);
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

async function copyLink() {
  const text = linkBox.textContent;
  if (!text) {
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
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
