// Отрисовка графика смен на текущую неделю внутри #schedule-list
function renderSchedule(data) {
  const { perms, employees, calendar } = data;
  const empMap = {};
  employees.forEach((e) => (empMap[e.id] = e.name));

  const calDiv = document.getElementById("schedule-list");
  if (!calDiv) return;
  calDiv.innerHTML = "";
  const todayStr = getLocalToday();

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const dow = now.getDay() === 0 ? 7 : now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - (dow - 1));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);

  const recentCal = calendar.filter((item) => {
    const parts = item.date.split("-");
    const d = new Date(
      Number(parts.at(0)),
      Number(parts.at(1)) - 1,
      Number(parts.at(2))
    );
    return d >= mon && d <= sun;
  });

  recentCal.forEach((item) => {
    const isToday = item.date === todayStr;
    const isDone = item.status === "Отработано";
    const canEdit = isDone ? perms.edit_done : perms.edit_plan;
    const stClass = isDone
      ? "st-done"
      : item.status === "Отмена"
      ? "st-off"
      : "st-plan";

    const card = document.createElement("div");
    card.className = `shift-card ${isToday ? "today" : ""} ${
      item.status === "Отмена" ? "is-off" : ""
    }`;

    let empHtml = `<div class="badge-view" style="background:#f1f5f9;">${
      empMap[item.empId] || item.empId
    }</div>`;
    let stHtml = `<div class="badge-view ${stClass}">${
      item.status === "Отмена" ? "Вых / Авария" : item.status
    }</div>`;

    if (canEdit) {
      const empOpts = employees
        .map(
          (e) =>
            `<option value="${e.id}" ${e.id === item.empId ? "selected" : ""}>${
              e.name
            }</option>`
        )
        .join("");
      const stOpts = Array.of(
        "План",
        "Отмена",
        ...(perms.edit_done ? ["Отработано"] : [])
      )
        .map(
          (s) =>
            `<option value="${s}" ${s === item.status ? "selected" : ""}>${
              s === "Отмена" ? "Вых / Авария" : s
            }</option>`
        )
        .join("");

      empHtml = `<select class="clean-select" id="emp-${item.row}" onchange="saveShift(${item.row})">${empOpts}</select>`;
      stHtml = `<select class="st-select ${stClass}" id="st-${item.row}" onchange="saveShift(${item.row})">${stOpts}</select>`;
    }

    card.innerHTML = `
      <div class="date-head">
        <span class="date-main">${
          isToday ? '<span class="today-dot"></span>' : ""
        }${formatHumanDate(item.date)}</span>
        <span class="date-dow">${DAYS_SHORT.at(item.dow) || ""}</span>
      </div>
      <div class="controls-box">${empHtml}${stHtml}</div>
    `;
    calDiv.appendChild(card);
  });
}

// Сохранение изменений по смене в Google Таблицу
async function saveShift(row) {
  const empId = document.getElementById(`emp-${row}`).value;
  const status = document.getElementById(`st-${row}`).value;
  document.getElementById("loader").style.display = "block";
  await apiPost({ action: "update_shift", row, empId, status });
  await loadData();
}
// Переключение между текущим графиком выходов и временным печатным отчётом по неделям
function toggleSchedSub(sub) {
  document
    .getElementById("sched-main-view")
    .classList.toggle("hidden", sub !== "main");
  document
    .getElementById("sched-weeks-view")
    .classList.toggle("hidden", sub !== "weeks");
  if (sub === "weeks") initWeeklyScheduleReport();
}

// Заполнение выпадающего списка недель из календаря для быстрого фильтра при печати
function initWeeklyScheduleReport() {
  if (!APP_DATA || !APP_DATA.calendar) return;
  const weeksMap = {};

  APP_DATA.calendar.forEach((item) => {
    if (!item.date) return;
    const parts = item.date.split("-");
    const d = new Date(
      Number(parts.at(0)),
      Number(parts.at(1)) - 1,
      Number(parts.at(2))
    );
    const dow = d.getDay() === 0 ? 7 : d.getDay();
    const mon = new Date(d);
    mon.setDate(d.getDate() - (dow - 1));
    const monIso = `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(mon.getDate()).padStart(2, "0")}`;
    weeksMap[monIso] = true;
  });

  const sortedWeeks = Object.keys(weeksMap).sort().reverse();
  const sel = document.getElementById("sched-week-filter");
  if (!sortedWeeks.length) {
    sel.innerHTML = `<option value="all">Нет данных</option>`;
    document.getElementById("sched-weeks-box").innerHTML =
      "<div style='color:#64748b;font-size:14px;'>Пока нет записей в графике</div>";
    return;
  }

  const opts = [
    `<option value="all">Все недели (${sortedWeeks.length})</option>`,
  ];
  sortedWeeks.forEach((wIso) => {
    const p = wIso.split("-");
    opts.push(
      `<option value="${wIso}">Неделя от ${Number(p.at(2))}.${p.at(1)}</option>`
    );
  });
  sel.innerHTML = opts.join("");
  renderWeeklyScheduleReport();
}

// Генерация временного печатного отчёта по неделям: кто когда работал и итог смен по каждому сотруднику
function renderWeeklyScheduleReport() {
  if (!APP_DATA || !APP_DATA.calendar) return;
  const filterWeek = document.getElementById("sched-week-filter").value;
  const empMap = {};
  (APP_DATA.employees || []).forEach((e) => (empMap[e.id] = e.name));

  const grouped = {};
  APP_DATA.calendar.forEach((item) => {
    if (!item.date) return;
    const parts = item.date.split("-");
    const d = new Date(
      Number(parts.at(0)),
      Number(parts.at(1)) - 1,
      Number(parts.at(2))
    );
    const dow = d.getDay() === 0 ? 7 : d.getDay();
    const mon = new Date(d);
    mon.setDate(d.getDate() - (dow - 1));
    const monIso = `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(mon.getDate()).padStart(2, "0")}`;

    if (filterWeek !== "all" && monIso !== filterWeek) return;
    if (!grouped[monIso]) grouped[monIso] = [];
    grouped[monIso].push(item);
  });

  const weeks = Object.keys(grouped).sort().reverse();
  const box = document.getElementById("sched-weeks-box");
  if (!weeks.length) {
    box.innerHTML =
      "<div style='color:#64748b;font-size:14px;'>Нет смен за выбранный период</div>";
    return;
  }

  let html = "";
  weeks.forEach((wIso) => {
    const wp = wIso.split("-");
    const weekTitle = `Неделя от ${Number(wp.at(2))}.${wp.at(1)}.${wp.at(0)}`;
    const dayItems = grouped[wIso]
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date));

    const empCounts = {};
    const rowsHtml = dayItems
      .map((item) => {
        const dp = item.date.split("-");
        const shortD = `${Number(dp.at(2))}.${dp.at(1)}`;
        const dowName = DAYS_SHORT.at(item.dow) || "";
        const eName = empMap[item.empId] || item.empId;
        const isDone = item.status === "Отработано";
        const isOff = item.status === "Отмена";

        if (isDone) {
          empCounts[eName] = (empCounts[eName] || 0) + 1;
        }

        const stText = isDone
          ? "✅ Отработано"
          : isOff
          ? "❌ Вых / Авария"
          : "⏳ План";
        const stColor = isDone ? "#15803d" : isOff ? "#dc2626" : "#64748b";

        return `
          <tr>
            <td><b>${shortD}</b> (${dowName})</td>
            <td><b>${eName}</b></td>
            <td style="color:${stColor};font-size:12px;">${stText}</td>
          </tr>
        `;
      })
      .join("");

    const summaryBadges = Object.keys(empCounts).length
      ? Object.keys(empCounts)
          .map((name) => `${name}: <b>${empCounts[name]}</b>`)
          .join(" · ")
      : "отработанных смен пока нет";

    html += `
      <div style="margin-bottom:16px;border:1px solid #cbd5e1;border-radius:10px;overflow:hidden;">
        <div style="background:#eff6ff;padding:8px 10px;font-weight:800;font-size:13px;color:#1e3a8a;display:flex;justify-content:space-between;align-items:center;">
          <span>📅 ${weekTitle}</span>
        </div>
        <table class="rep-table" style="margin:0;">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Сотрудник</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div style="background:#f8fafc;padding:8px 10px;font-size:12px;color:#334155;border-top:1px solid #e2e8f0;">
          <b>Итого отработано смен:</b> ${summaryBadges}
        </div>
      </div>
    `;
  });

  box.innerHTML = html;
}
