// Переключение между главным экраном свежих заметок и полным архивом
function toggleNotesSub(sub) {
  document
    .getElementById("notes-main-view")
    .classList.toggle("hidden", sub !== "main");
  document
    .getElementById("notes-archive-view")
    .classList.toggle("hidden", sub !== "archive");
  if (sub === "archive") renderNotesArchive();
}

// Вспомогательная функция отрисовки одной карточки заметки
function buildNoteCardHtml(n, canClose) {
  const isDone = n.status === "Решено";
  const isInfo = n.status === "Инфо";
  const clickable = canClose && !isInfo;

  let badgeStyle = "background:#fee2e2;color:#b91c1c;";
  let badgeText = "⚠️ Требует внимания";
  if (isDone) {
    badgeStyle = "background:#dcfce7;color:#15803d;";
    badgeText = "✅ Решено";
  } else if (isInfo) {
    badgeStyle = "background:#dbeafe;color:#1d4ed8;";
    badgeText = "ℹ️ Инфо";
  }

  return `
    <div class="log-row" style="padding:10px 8px;border-radius:10px;${
      clickable ? "cursor:pointer;" : ""
    }${isDone ? "opacity:0.75;background:#f8fafc;" : ""}" ${
    clickable ? `onclick="toggleNoteStatus(${n.row}, ${!isDone})"` : ""
  }>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;gap:6px;">
        <span class="log-meta">${formatHumanDate(n.date)} · <b>${
    n.target
  }</b> (${n.who})</span>
        <span style="font-size:11px;font-weight:800;padding:2px 8px;border-radius:8px;white-space:nowrap;${badgeStyle}">${badgeText}</span>
      </div>
      <div style="font-size:14px;font-weight:600;${
        isDone
          ? "text-decoration:line-through;color:#64748b;"
          : "color:#0f172a;"
      }">${n.text}</div>
      ${
        n.resolution
          ? `<div style="margin-top:6px;padding:6px 8px;background:#dcfce7;color:#14532d;border-radius:8px;font-size:12px;font-weight:600;">🛠️ ${n.resolution}</div>`
          : ""
      }
    </div>
  `;
}

// Отрисовка главного экрана заметок: показываем все нерешённые проблемы + до 5 последних записей
function renderNotes() {
  if (!APP_DATA) return;
  const canAdd = Boolean(APP_DATA.perms.add_notes);
  const canClose = Boolean(APP_DATA.perms.close_notes);

  const addPanel = document.getElementById("note-add-panel");
  if (addPanel) addPanel.classList.toggle("hidden", !canAdd);

  const allNotes = (APP_DATA.notes || []).slice().reverse();
  const activeIssues = allNotes.filter((n) => n.status === "Активно");
  const otherRecent = allNotes
    .filter((n) => n.status !== "Активно")
    .slice(0, 5);
  const combined = activeIssues.concat(otherRecent);

  const countBadge = document.getElementById("notes-active-count");
  if (countBadge) {
    countBadge.textContent = activeIssues.length
      ? `Открытых проблем: ${activeIssues.length}`
      : "Все проблемы решены";
  }

  const box = document.getElementById("notes-recent-list");
  if (!combined.length) {
    box.innerHTML =
      "<div style='color:#64748b;font-size:14px;'>Записей пока нет</div>";
  } else {
    box.innerHTML = combined
      .map((n) => buildNoteCardHtml(n, canClose))
      .join("");
  }

  // Если сейчас открыт экран архива — обновляем и его тоже
  if (
    !document.getElementById("notes-archive-view").classList.contains("hidden")
  ) {
    renderNotesArchive();
  }
}

// Отрисовка полного архива заметок с фильтрацией по типу, объекту (боксу) и дате
function renderNotesArchive() {
  if (!APP_DATA) return;
  const canClose = Boolean(APP_DATA.perms.close_notes);
  const stFilter = document.getElementById("arch-status").value;
  const targetFilter = document.getElementById("arch-target").value;
  const dateFilter = document.getElementById("arch-date").value;

  const filtered = (APP_DATA.notes || [])
    .slice()
    .reverse()
    .filter((n) => {
      if (stFilter === "active" && n.status !== "Активно") return false;
      if (stFilter === "info" && n.status !== "Инфо") return false;
      if (stFilter === "done" && n.status !== "Решено") return false;
      if (targetFilter !== "all" && n.target !== targetFilter) return false;
      if (dateFilter && n.date !== dateFilter) return false;
      return true;
    });

  const box = document.getElementById("notes-archive-list");
  if (!filtered.length) {
    box.innerHTML =
      "<div style='color:#64748b;font-size:14px;'>По выбранным фильтрам записей не найдено</div>";
    return;
  }
  box.innerHTML = filtered.map((n) => buildNoteCardHtml(n, canClose)).join("");
}

// Сброс фильтра по конкретной дате в архиве заметок
function resetNotesArchiveFilters() {
  document.getElementById("arch-date").value = "";
  renderNotesArchive();
}

// Добавление новой заметки (требующей внимания или информационной) в Google Таблицу
async function addNote() {
  const date = document.getElementById("note-date").value;
  const target = document.getElementById("note-target").value;
  const noteType = document.getElementById("note-type").value;
  const text = document.getElementById("note-text").value.trim();

  if (!text) return alert("Введите текст заметки");

  const btn = document.getElementById("btn-add-note");
  if (btn) btn.disabled = true;
  document.getElementById("loader").style.display = "block";

  try {
    await apiPost({ action: "add_note", date, target, noteType, text });
    document.getElementById("note-text").value = "";
    await loadData();
  } finally {
    if (btn) btn.disabled = false;
    document.getElementById("loader").style.display = "none";
  }
}

// Закрытие активной проблемы с обязательным указанием того, что было сделано
async function toggleNoteStatus(row, newDone) {
  if (!APP_DATA?.perms?.close_notes) return;

  let comment = "";
  if (newDone) {
    const input = prompt("Что именно было сделано для устранения проблемы?");
    if (input === null) return;
    comment = input.trim();
    if (!comment) return alert("Пожалуйста, напишите, что именно было сделано");
  } else {
    if (!confirm("Вернуть эту задачу обратно в «Требует внимания»?")) return;
  }

  document.getElementById("loader").style.display = "block";
  await apiPost({ action: "toggle_note", row, done: newDone, comment });
  await loadData();
}
