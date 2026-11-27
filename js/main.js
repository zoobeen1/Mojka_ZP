// Переключение основных вкладок в нижней навигации (График, Финансы, Заметки, Журнал, Права)
function switchTab(tabId, title, btn) {
  document
    .querySelectorAll(".tab-view")
    .forEach((el) => el.classList.add("hidden"));
  document
    .querySelectorAll(".nav-item")
    .forEach((el) => el.classList.remove("active"));
  document.getElementById(`tab-${tabId}`).classList.remove("hidden");
  btn.classList.add("active");
  document.getElementById("page-title").textContent = title;
  if (tabId === "schedule" && typeof toggleSchedSub === "function") {
    toggleSchedSub("main");
  }
  if (tabId === "finance") {
    showFinSub("main");
    toggleCashSub("main");
  }
}

// Переключение между разделами "Касса и боксы" и "З/П" внутри вкладки Финансы
function switchFinMode(mode) {
  document
    .getElementById("mode-cash")
    .classList.toggle("hidden", mode !== "cash");
  document
    .getElementById("mode-fin")
    .classList.toggle("hidden", mode !== "salary");
  document
    .getElementById("seg-cash")
    .classList.toggle("active", mode === "cash");
  document
    .getElementById("seg-salary")
    .classList.toggle("active", mode === "salary");
  if (mode === "cash") toggleCashSub("main");
}

// Отрисовка панели администратора: таблица прав ролей (Manager/Viewer) и журнал действий
function renderAdmin(data) {
  const { user, allPerms, logs } = data;
  if (user.role !== "admin" || !allPerms) return;

  document.getElementById("nav-logs").classList.remove("hidden");
  document.getElementById("nav-perms").classList.remove("hidden");

  const baseInput = document.getElementById("set-cash-base");
  if (baseInput) baseInput.value = data.cashBase || CASH_BASE;

  let tableHtml = `<table style="width:100%;font-size:13px;border-collapse:collapse;">
    <tr style="border-bottom:1px solid #e2e8f0;color:#64748b;">
      <th style="text-align:left;padding:6px 0;">Действие</th>
      <th style="text-align:center;">Manager</th>
      <th style="text-align:center;">Viewer</th>
    </tr>`;
  Object.keys(PERM_LABELS).forEach((k) => {
    tableHtml += `<tr style="border-bottom:1px solid #f1f5f9;">
      <td style="padding:8px 0;">${PERM_LABELS[k]}</td>
      <td style="text-align:center;"><input type="checkbox" id="pm-manager-${k}" ${
      allPerms.manager[k] ? "checked" : ""
    } style="width:18px;height:18px;"></td>
      <td style="text-align:center;"><input type="checkbox" id="pm-viewer-${k}" ${
      allPerms.viewer[k] ? "checked" : ""
    } style="width:18px;height:18px;"></td>
    </tr>`;
  });
  tableHtml += `</table>`;
  document.getElementById("perms-box").innerHTML = tableHtml;

  document.getElementById("logs-list").innerHTML = logs
    .slice()
    .reverse()
    .map(
      (l) => `
    <div class="log-row">
      <div class="log-meta">${l.time} · ${l.who} (${l.source})</div>
      <div>${l.action}</div>
    </div>
  `
    )
    .join("");
}

// Сохранение изменённых настроек прав доступа в Google Таблицу
async function savePerms() {
  const keys = Object.keys(PERM_LABELS);
  const newPerms = { manager: {}, viewer: {} };
  keys.forEach((k) => {
    newPerms.manager[k] = document.getElementById(`pm-manager-${k}`).checked;
    newPerms.viewer[k] = document.getElementById(`pm-viewer-${k}`).checked;
  });
  document.getElementById("loader").style.display = "block";
  await apiPost({ action: "save_perms", perms: newPerms });
  await loadData();
}

// Сохранение нового норматива операционной кассы в лист Настройки
async function saveSettings() {
  const newBase = Number(document.getElementById("set-cash-base").value);
  if (!newBase || newBase < 0)
    return alert("Введите корректную сумму норматива");
  document.getElementById("loader").style.display = "block";
  await apiPost({ action: "save_settings", cashBase: newBase });
  await loadData();
}
// Открытие модального окна настройки недельного шаблона смен (Пн–Вс)
function openTemplateModal() {
  if (!APP_DATA) return;
  const DAYS_NAMES = Array.of("", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс");
  const tplList = APP_DATA.template || [];
  const emps = APP_DATA.employees || [];
  const box = document.getElementById("tpl-rows-box");

  box.innerHTML = Array.of(1, 2, 3, 4, 5, 6, 7)
    .map((dayNum) => {
      const cur = tplList.find((t) => Number(t.day) === dayNum) || {
        empId: emps.at(0)?.id || "",
        rate: 750,
      };
      const empOpts = emps
        .map(
          (e) =>
            `<option value="${e.id}" ${
              String(e.id) === String(cur.empId) ? "selected" : ""
            }>${e.name}</option>`
        )
        .join("");

      return `
        <div class="tpl-row">
          <div class="tpl-day">${DAYS_NAMES.at(dayNum)}</div>
          <select id="tpl-emp-${dayNum}" class="field tpl-emp">${empOpts}</select>
          <input type="number" id="tpl-rate-${dayNum}" class="field tpl-rate" value="${
        cur.rate
      }" placeholder="Ставка">
        </div>
      `;
    })
    .join("");

  document.getElementById("tpl-modal").classList.remove("hidden");
}

// Закрытие модального окна шаблона смен
function closeTemplateModal() {
  document.getElementById("tpl-modal").classList.add("hidden");
}

// Сохранение обновлённого шаблона смен (Пн–Вс) в Google Таблицу
async function saveTemplate() {
  const rows = [];
  for (let d = 1; d <= 7; d++) {
    const empId = document.getElementById(`tpl-emp-${d}`).value;
    const rate = Number(document.getElementById(`tpl-rate-${d}`).value) || 0;
    rows.push({ day: d, empId, rate });
  }

  closeTemplateModal();
  document.getElementById("loader").style.display = "block";
  await apiPost({ action: "save_template", rows });
  await loadData();
}

// Главная функция отрисовки всего интерфейса после получения данных с сервера
function renderApp(data) {
  const { user, perms } = data;
  document.getElementById("user-info").textContent = `${user.name}`;

  renderSchedule(data);

  const showCash = Boolean(perms.view_cash);
  const showSal = Boolean(perms.view_fin);

  if (!showCash && !showSal) {
    document.getElementById("nav-finance").classList.add("hidden");
  } else {
    document.getElementById("nav-finance").classList.remove("hidden");
    document
      .getElementById("fin-switcher")
      .classList.toggle("hidden", !(showCash && showSal));
    if (showCash) {
      switchFinMode("cash");
      document
        .getElementById("cash-add-box")
        .classList.toggle("hidden", !perms.add_cash);
      renderCashStats();
    } else {
      switchFinMode("salary");
    }
  }

  renderSalary(data);
  renderAdmin(data);
  renderNotes();
}

// Инициализация приложения: сначала загружаем HTML-шаблоны из views/, затем ставим даты и грузим данные
async function initApp() {
  await loadViews();
  const today = getLocalToday();
  document.getElementById("pay-date").value = today;
  document.getElementById("cash-date").value = today;
  document.getElementById("exp-date").value = today;
  document.getElementById("note-date").value = today;
  await loadData();
}

initApp();
