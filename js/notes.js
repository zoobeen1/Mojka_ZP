// Отрисовка списка поломок и заметок с учётом раздельных прав на добавление и закрытие
function renderNotes() {
  if (!APP_DATA) return;
  const canAdd = Boolean(APP_DATA.perms.add_notes);
  const canClose = Boolean(APP_DATA.perms.close_notes);

  const panels = document.querySelectorAll("#tab-notes .panel");
  if (panels.length >= 2) {
    panels.item(0).classList.toggle("hidden", !canAdd);
  }

  const filter = document.getElementById("notes-filter").value;
  const list = (APP_DATA.notes || [])
    .slice()
    .reverse()
    .filter((n) => {
      if (filter === "active") return !n.done;
      if (filter === "done") return n.done;
      return true;
    });

  const box = document.getElementById("notes-list");
  if (!list.length) {
    box.innerHTML =
      "<div style='color:#64748b;font-size:14px;'>Записей в этой категории нет</div>";
    return;
  }

  box.innerHTML = list
    .map(
      (n) => `
    <div class="log-row" style="padding:10px 6px;border-radius:10px;${
      canClose ? "cursor:pointer;" : ""
    }${n.done ? "opacity:0.6;background:#f8fafc;" : ""}" ${
        canClose ? `onclick="toggleNoteStatus(${n.row}, ${!n.done})"` : ""
      }>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <span class="log-meta">${formatHumanDate(n.date)} · <b>${
        n.target
      }</b> (${n.who})</span>
        <span style="font-size:11px;font-weight:800;padding:2px 8px;border-radius:8px;${
          n.done
            ? "background:#dcfce7;color:#15803d;"
            : "background:#fee2e2;color:#b91c1c;"
        }">
          ${n.done ? "✅ Решено" : "⚠️ Активно"}
        </span>
      </div>
      <div style="font-size:14px;font-weight:600;${
        n.done
          ? "text-decoration:line-through;color:#64748b;"
          : "color:#0f172a;"
      }">${n.text}</div>
    </div>
  `
    )
    .join("");
}

// Добавление новой заметки или поломки в Google Таблицу
async function addNote() {
  const date = document.getElementById("note-date").value;
  const target = document.getElementById("note-target").value;
  const text = document.getElementById("note-text").value.trim();

  if (!text) return alert("Опишите поломку или событие");

  const btn = document.getElementById("btn-add-note");
  if (btn) btn.disabled = true;
  document.getElementById("loader").style.display = "block";

  try {
    await apiPost({ action: "add_note", date, target, text });
    document.getElementById("note-text").value = "";
    await loadData();
  } finally {
    if (btn) btn.disabled = false;
    document.getElementById("loader").style.display = "none";
  }
}

// Переключение статуса заметки (Активно <-> Решено) для ролей с правом close_notes
async function toggleNoteStatus(row, newDone) {
  if (!APP_DATA?.perms?.close_notes) return;
  const label = newDone
    ? "Отметить эту проблему как РЕШЁННУЮ?"
    : "Вернуть эту заметку в АКТИВНЫЕ?";
  if (!confirm(label)) return;
  document.getElementById("loader").style.display = "block";
  await apiPost({ action: "toggle_note", row, done: newDone });
  await loadData();
}
