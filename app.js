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
}

function getLocalToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatHumanDate(isoDate) {
  const parts = isoDate.split("-");
  return `${Number(parts.at(2))} ${
    MONTHS_RU.at(Number(parts.at(1)) - 1) || ""
  }`;
}

let secretKey = localStorage.getItem("app_pass");
if (!secretKey) {
  secretKey = prompt("Введите ваш пароль доступа:");
  if (secretKey) localStorage.setItem("app_pass", secretKey);
}

document.getElementById("pay-date").value = getLocalToday();

function logout() {
  localStorage.removeItem("app_pass");
  location.reload();
}

async function loadData() {
  if (!secretKey) return;
  document.getElementById("loader").style.display = "block";
  try {
    const res = await fetch(`${API_URL}?key=${encodeURIComponent(secretKey)}`);
    const data = await res.json();
    if (data.error) {
      alert(data.error);
      logout();
      return;
    }
    renderApp(data);
  } catch (e) {
    alert("Ошибка соединения с таблицей");
  }
  document.getElementById("loader").style.display = "none";
}

function renderApp(data) {
  const {
    user,
    perms,
    allPerms,
    employees,
    calendar,
    payments,
    summary,
    logs,
  } = data;
  document.getElementById("user-info").textContent = `${user.name}`;

  const empMap = {};
  employees.forEach((e) => (empMap[e.id] = e.name));

  const calDiv = document.getElementById("tab-schedule");
  calDiv.innerHTML = "";
  const todayStr = getLocalToday();
  const recentCal = calendar.slice(-14);

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
      const stOpts = [
        "План",
        "Отмена",
        ...(perms.edit_done ? ["Отработано"] : []),
      ]
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

  if (!perms.view_fin) {
    document.getElementById("nav-finance").classList.add("hidden");
  } else {
    document.getElementById("nav-finance").classList.remove("hidden");

    const stats = {};
    employees.forEach((e) => (stats[e.id] = { earned: 0, paid: 0 }));
    calendar.forEach((c) => {
      if (c.status === "Отработано" && stats[c.empId])
        stats[c.empId].earned += c.rate;
    });
    payments.forEach((p) => {
      if (stats[p.empId]) stats[p.empId].paid += p.amount;
    });

    const balDiv = document.getElementById("balance-list");
    balDiv.innerHTML = "";
    employees.forEach((e) => {
      const debt = stats[e.id].earned - stats[e.id].paid;
      balDiv.innerHTML += `
        <div class="emp-bal">
          <span class="emp-name">${e.name}</span>
          <span class="debt-val ${debt <= 0 ? "ok" : ""}">${debt}</span>
        </div>
      `;
    });

    const sumDiv = document.getElementById("summary-list");
    sumDiv.innerHTML = summary.length
      ? summary
          .slice()
          .reverse()
          .map(
            (s) => `
      <div class="sum-card">
        <div><b>${s.period}</b> — <b>${empMap[s.empId] || s.empId}</b></div>
        <div>Смен: ${s.shifts} · Начислено: ${s.earned} · Выплачено: ${
              s.paid
            } · Долг: <b>${s.debt}</b></div>
      </div>
    `
          )
          .join("")
      : "<div class='sum-card'>Сводка появится после закрытия первой недели</div>";
  }

  if (perms.add_pay) {
    document.getElementById("payment-card").classList.remove("hidden");
    document.getElementById("pay-emp").innerHTML = employees
      .map((e) => `<option value="${e.id}">${e.name}</option>`)
      .join("");
  } else {
    document.getElementById("payment-card").classList.add("hidden");
  }

  if (user.role === "admin" && allPerms) {
    document.getElementById("nav-logs").classList.remove("hidden");
    document.getElementById("nav-perms").classList.remove("hidden");

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
}

async function savePerms() {
  const keys = Object.keys(PERM_LABELS);
  const newPerms = { manager: {}, viewer: {} };
  keys.forEach((k) => {
    newPerms.manager[k] = document.getElementById(`pm-manager-${k}`).checked;
    newPerms.viewer[k] = document.getElementById(`pm-viewer-${k}`).checked;
  });
  document.getElementById("loader").style.display = "block";
  await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      key: secretKey,
      action: "save_perms",
      perms: newPerms,
    }),
  });
  await loadData();
}

async function saveShift(row) {
  const empId = document.getElementById(`emp-${row}`).value;
  const status = document.getElementById(`st-${row}`).value;
  document.getElementById("loader").style.display = "block";
  await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      key: secretKey,
      action: "update_shift",
      row,
      empId,
      status,
    }),
  });
  await loadData();
}

async function addPayment() {
  const empId = document.getElementById("pay-emp").value;
  const date = document.getElementById("pay-date").value;
  const amount = Number(document.getElementById("pay-amount").value);
  if (!amount || amount <= 0) return alert("Введите сумму выплаты");
  document.getElementById("loader").style.display = "block";
  await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      key: secretKey,
      action: "add_payment",
      empId,
      date,
      amount,
    }),
  });
  document.getElementById("pay-amount").value = "";
  await loadData();
}

loadData();
