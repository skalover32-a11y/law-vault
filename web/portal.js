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

let countdownTimer = null;

if (loginStatus) {
  loginStatus.textContent = "Готово для входа.";
}

const loginInput = document.getElementById("login");
const passwordInput = document.getElementById("password");
const totpInput = document.getElementById("totp");

const ACCESS_KEY = "portal_access_token";
const LAST_LINK_KEY = "portal_last_link";

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

function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

function clearSession(message) {
  localStorage.removeItem(ACCESS_KEY);
  resetLoginForm();
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
  if (linkBox) {
    linkBox.textContent = data.url;
    linkBox.classList.remove("hidden");
  }
  if (copyLinkBtn) {
    copyLinkBtn.classList.remove("hidden");
  }
  if (linkMeta) {
    linkMeta.classList.remove("hidden");
  }
  const expiryDate = new Date(data.expires_at);
  if (linkExpiry) {
    linkExpiry.textContent = expiryDate.toLocaleString();
  }
  startCountdown(expiryDate);
  saveLastLink(data.url, data.expires_at);
  showPortalStatus("Ссылка создана.");
}

function saveLastLink(url, expiresAt) {
  const payload = {
    url,
    expires_at: expiresAt
  };
  localStorage.setItem(LAST_LINK_KEY, JSON.stringify(payload));
}

function restoreLastLink() {
  const raw = localStorage.getItem(LAST_LINK_KEY);
  if (!raw) {
    return;
  }
  try {
    const data = JSON.parse(raw);
    if (!data.url || !data.expires_at) {
      return;
    }
    const expiryDate = new Date(data.expires_at);
    if (Number.isNaN(expiryDate.getTime())) {
      return;
    }
    if (expiryDate <= new Date()) {
      localStorage.removeItem(LAST_LINK_KEY);
      return;
    }
    if (linkBox) {
      linkBox.textContent = data.url;
      linkBox.classList.remove("hidden");
    }
    if (copyLinkBtn) {
      copyLinkBtn.classList.remove("hidden");
    }
    if (linkMeta) {
      linkMeta.classList.remove("hidden");
    }
    if (linkExpiry) {
      linkExpiry.textContent = expiryDate.toLocaleString();
    }
    startCountdown(expiryDate);
  } catch (err) {
    localStorage.removeItem(LAST_LINK_KEY);
  }
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
      showPortalStatus("Код уже включен.", true);
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
  const token = getAccessToken();
  if (!token) {
    return;
  }
  const response = await fetch("/api/portal/totp/status", {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) {
    return;
  }
  const data = await response.json();
  setTotpUi(Boolean(data.enabled));
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
  setTotpUi(true);
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
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => clearSession("Вы вышли из кабинета."));
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
  loadFiles();
  restoreLastLink();
  loadTotpStatus();
}
