const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const uploadBtn = document.getElementById("uploadBtn");
const statusEl = document.getElementById("status");
const progressWrap = document.getElementById("progressWrap");
const progressBar = document.getElementById("progressBar");
const tokenBanner = document.getElementById("tokenBanner");
const fileList = document.getElementById("fileList");
const fileCount = document.getElementById("fileCount");

let selectedFiles = [];
let uploadToken = null;

function showStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#a02f2f" : "#134638";
}

function setProgress(percent) {
  progressBar.style.width = `${percent}%`;
}

function parseCodeFromPath() {
  const match = window.location.pathname.match(/^\/send\/([A-Za-z0-9]{4}-[A-Za-z0-9]{4})/);
  return match ? match[1].toUpperCase() : null;
}

function updateTokenBanner() {
  uploadToken = parseCodeFromPath();
  if (!uploadToken) {
    const isSend = window.location.pathname.startsWith("/send");
    tokenBanner.textContent = isSend
      ? "Ссылка неполная. Проверьте адрес."
      : "Получите ссылку для передачи у отправителя.";
    tokenBanner.classList.remove("hidden");
    uploadBtn.disabled = true;
    return;
  }
  tokenBanner.textContent = "Ссылка готова для передачи.";
  tokenBanner.classList.remove("hidden");
}

function addSelectedFiles(files) {
  files.forEach((file) => {
    selectedFiles.push(file);
  });
  renderFileList();
}

function removeSelectedFile(index) {
  selectedFiles.splice(index, 1);
  renderFileList();
}

function renderFileList() {
  if (!fileList) {
    return;
  }
  fileList.innerHTML = "";
  if (!selectedFiles.length) {
    fileCount.textContent = "Файлы не выбраны";
    showStatus("");
    uploadBtn.disabled = true;
    return;
  }
  fileCount.textContent = `Выбрано файлов: ${selectedFiles.length}`;
  uploadBtn.disabled = !uploadToken;
  selectedFiles.forEach((file, index) => {
    const row = document.createElement("div");
    row.className = "file-item";
    row.innerHTML = `
      <div class="file-item-name">${file.name}</div>
      <button class="btn btn-secondary" data-index="${index}">Удалить</button>
    `;
    const btn = row.querySelector("button");
    btn.addEventListener("click", () => removeSelectedFile(index));
    fileList.appendChild(row);
  });
}

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("dragover");
  const files = Array.from(event.dataTransfer.files || []);
  if (files.length) {
    addSelectedFiles(files);
  }
});

fileInput.addEventListener("change", (event) => {
  const files = Array.from(event.target.files || []);
  if (files.length) {
    addSelectedFiles(files);
  }
  event.target.value = "";
});

uploadBtn.addEventListener("click", () => {
  if (!selectedFiles.length || !uploadToken) {
    return;
  }

  const formData = new FormData();
  selectedFiles.forEach((file) => {
    formData.append("files", file);
  });

  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/api/upload");
  xhr.setRequestHeader("X-Upload-Token", uploadToken);

  xhr.upload.onprogress = (event) => {
    if (event.lengthComputable) {
      const percent = Math.round((event.loaded / event.total) * 100);
      setProgress(percent);
    }
  };

  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      const message = selectedFiles.length > 1
        ? "Передача завершена. Файлы отправлены."
        : "Передача завершена. Можно закрыть страницу.";
      showStatus(message);
      setProgress(100);
      uploadBtn.disabled = true;
      selectedFiles = [];
      renderFileList();
    } else {
      showStatus(`Ошибка передачи: ${xhr.responseText || xhr.status}`, true);
      setProgress(0);
    }
  };

  xhr.onerror = () => {
    showStatus("Ошибка сети. Попробуйте ещё раз.", true);
    setProgress(0);
  };

  showStatus("Передача запущена...");
  xhr.send(formData);
});

updateTokenBanner();
progressWrap.classList.remove("hidden");
renderFileList();
