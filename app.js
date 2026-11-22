let APP_DATA = null;

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
  if (tabId === "finance") showFinSub("main");
}

function switchFinMode(mode) {
  document
    .getElementById("mode-cash")
    .classList.toggle("hidden", mode !== "cash");
  document
    .getElementById("mode-salary")
    .classList.toggle("hidden", mode !== "salary");
  document
    .getElementById("seg-cash")
    .classList.toggle("active", mode === "cash");
  document
    .getElementById("seg-salary")
    .classList.toggle("active", mode === "salary");
}

function showFinSub(sub) {
  document.getElementById("fin-main").classList.add("hidden");
  document.getElementById("fin-weekly").classList.add("hidden");
  document.getElementById("fin-monthly").classList.add("hidden");
  document.getElementById(`fin-${sub}`).classList.remove("hidden");
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
document.getElementById("cash-date").value = getLocalToday();
document.getElementById("exp-date").value = getLocalToday();

function logout() {
  localStorage.removeItem("app_pass");
  location.reload();
}

async function changePassword() {
  const newPass = prompt("Введите новый пароль (минимум 3 символа):");
  if (!newPass) return;
  document.getElementById("loader").style.display = "block";
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        key: secretKey,
        action: "change_pass",
        newPass: newPass.trim(),
      }),
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
    } else {
      secretKey = newPass.trim();
      localStorage.setItem("app_pass", secretKey);
      alert("Пароль успешно изменён!");
      await loadData();
    }
  } catch (e) {
    alert("Ошибка при смене пароля");
  }
  document.getElementById("loader").style.display = "none";
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
    APP_DATA = data;
    renderApp(data);
  } catch (e) {
    alert("Ошибка соединения с таблицей");
  }
  document.getElementById("loader").style.display = "none";
}

/* ОКНО 1: КАЛЬКУЛЯТОР СБОРА С БОКСОВ */
function openCashModal() {
  document.getElementById("cash-date").value = getLocalToday();
  const tbl = document.getElementById("cash-calc-table");
  let headHtml = `<thead><tr><th>Бокс</th>${DENOMS.map(
    (d) => `<th>${d}</th>`
  ).join("")}<th>Сумма</th></tr></thead><tbody>`;
  CASH_BOXES.forEach((box, rIdx) => {
    headHtml += `<tr><td class="box-col">${box}</td>`;
    DENOMS.forEach((d) => {
      headHtml += `<td><input type="number" min="0" inputmode="numeric" class="calc-input" id="c-${rIdx}-${d}" oninput="recalcCashModal()"></td>`;
    });
    headHtml += `<td class="row-sum" id="rsum-${rIdx}">0</td></tr>`;
  });
  headHtml += `<tr class="tot-money"><td class="box-col" style="background:#dcfce7;">Всього грн</td>${DENOMS.map(
    (d) => `<td id="cmoney-${d}">0</td>`
  ).join("")}<td id="ctotal-money">0</td></tr>`;
  headHtml += `<tr class="tot-bills"><td class="box-col" style="background:#fef9c3;">Сум купюр</td>${DENOMS.map(
    (d) => `<td id="cbills-${d}">0</td>`
  ).join("")}<td id="ctotal-bills">0</td></tr></tbody>`;
  tbl.innerHTML = headHtml;
  document.getElementById("cash-modal").classList.remove("hidden");
}

function closeCashModal() {
  document.getElementById("cash-modal").classList.add("hidden");
}

function recalcCashModal() {
  const colBills = {};
  DENOMS.forEach((d) => (colBills[d] = 0));
  let grandMoney = 0,
    grandBills = 0;

  CASH_BOXES.forEach((_, rIdx) => {
    let rowSum = 0;
    DENOMS.forEach((d) => {
      const cnt = Number(document.getElementById(`c-${rIdx}-${d}`).value) || 0;
      rowSum += cnt * d;
      colBills[d] += cnt;
    });
    document.getElementById(`rsum-${rIdx}`).textContent = rowSum;
    grandMoney += rowSum;
  });

  DENOMS.forEach((d) => {
    const bills = colBills[d];
    grandBills += bills;
    document.getElementById(`cmoney-${d}`).textContent = bills * d;
    document.getElementById(`cbills-${d}`).textContent = bills;
  });
  document.getElementById("ctotal-money").textContent = grandMoney;
  document.getElementById("ctotal-bills").textContent = grandBills;
}

async function submitCashModal() {
  const date = document.getElementById("cash-date").value;
  const rows = [];
  let hasAny = false;

  CASH_BOXES.forEach((box, rIdx) => {
    const item = { box, sum: 0 };
    DENOMS.forEach((d) => {
      const cnt = Number(document.getElementById(`c-${rIdx}-${d}`).value) || 0;
      item[`b${d}`] = cnt;
      item.sum += cnt * d;
    });
    if (item.sum > 0) hasAny = true;
    rows.push(item);
  });

  if (!hasAny)
    return alert("Введите количество купюр хотя бы для одного бокса");
  document.getElementById("loader").style.display = "block";
  closeCashModal();
  await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({ key: secretKey, action: "add_cash", date, rows }),
  });
  await loadData();
}

/* ОКНО 2: РАСХОДЫ ИЗ КАССЫ (ТЕРМИНАЛ / МАТЕРИАЛЫ) */
function openExpModal() {
  document.getElementById("exp-date").value = getLocalToday();
  document.getElementById("exp-amount").value = "";
  document.getElementById("exp-note").value = "";
  document.getElementById("exp-modal").classList.remove("hidden");
}

function closeExpModal() {
  document.getElementById("exp-modal").classList.add("hidden");
}

async function submitExpModal() {
  const date = document.getElementById("exp-date").value;
  const type = document.getElementById("exp-type").value;
  const amount = Number(document.getElementById("exp-amount").value);
  const note = document.getElementById("exp-note").value.trim();

  if (!amount || amount <= 0) return alert("Введите сумму расхода");
  document.getElementById("loader").style.display = "block";
  closeExpModal();
  await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      key: secretKey,
      action: "add_cash_exp",
      date,
      type,
      amount,
      note,
    }),
  });
  await loadData();
}
function matchPeriod(item, period, todayStr, monDate, monthPrefix) {
  if (period === "pending") return Boolean(item.pending);
  if (period === "all") return true;
  if (period === "today") return item.date === todayStr;
  if (period === "month") return item.date.startsWith(monthPrefix);
  if (period === "week") {
    const p = item.date.split("-");
    const d = new Date(Number(p.at(0)), Number(p.at(1)) - 1, Number(p.at(2)));
    return d >= monDate;
  }
  return true;
}

function renderCashStats() {
  if (!APP_DATA) return;
  const period = document.getElementById("cash-period").value;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const todayStr = getLocalToday();
  const dow = now.getDay() === 0 ? 7 : now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - (dow - 1));
  const monthPrefix = todayStr.slice(0, 7);

  // 1. Выручка с боксов
  const boxSums = {};
  CASH_BOXES.forEach((b) => (boxSums[b] = 0));
  let totalBoxes = 0;

  (APP_DATA.cash || []).forEach((c) => {
    if (!matchPeriod(c, period, todayStr, mon, monthPrefix)) return;
    if (boxSums[c.box] !== undefined) boxSums[c.box] += c.sum;
    else boxSums[c.box] = (boxSums[c.box] || 0) + c.sum;
    totalBoxes += c.sum;
  });

  // 2. Расходы из кассы (Терминал + Материалы + Выплаты ЗП)
  let termSum = 0,
    matSum = 0,
    zpSum = 0;
  const expDetails = [];

  (APP_DATA.cashExp || []).forEach((e) => {
    if (!matchPeriod(e, period, todayStr, mon, monthPrefix)) return;
    if (e.type.includes("Терминал")) termSum += e.amount;
    else matSum += e.amount;
    expDetails.push({
      date: e.date,
      type: e.type,
      amount: e.amount,
      note: e.note,
    });
  });

  (APP_DATA.payments || []).forEach((p) => {
    if (!matchPeriod(p, period, todayStr, mon, monthPrefix)) return;
    zpSum += p.amount;
  });

  const totalComp = termSum + matSum + zpSum;
  const netToSend = totalBoxes - totalComp;
  const currentCashInBox = CASH_BASE - totalComp;

  // Отрисовка сводки выручки и расчета к отправке
  let boxHtml = Object.keys(boxSums)
    .map(
      (b) => `
    <div class="emp-bal" style="padding:6px 0;">
      <span class="emp-name" style="font-size:14px;">${b}</span>
      <span style="font-weight:700;font-size:14px;">${boxSums[b]} грн</span>
    </div>
  `
    )
    .join("");

  boxHtml += `
    <div class="emp-bal" style="border-top:1px solid #cbd5e1;margin-top:4px;padding-top:8px;">
      <span style="font-weight:700;font-size:15px;">Всего с боксов</span>
      <span style="font-weight:800;font-size:16px;">${totalBoxes} грн</span>
    </div>
    <div class="emp-bal" style="padding:6px 0;color:#dc2626;">
      <span style="font-size:14px;">Компенсация в кассу</span>
      <span style="font-weight:700;font-size:15px;">−${totalComp} грн</span>
    </div>
    <div class="emp-bal" style="border-top:2px solid #cbd5e1;padding-top:10px;">
      <span style="font-weight:800;font-size:16px;">К ОТПРАВКЕ</span>
      <span class="debt-val ok" style="font-size:18px;">${netToSend} грн</span>
    </div>
  `;

  if (
    period === "pending" &&
    APP_DATA.perms.add_cash &&
    (totalBoxes > 0 || totalComp > 0)
  ) {
    boxHtml += `
      <button class="btn-primary no-print" style="margin-top:12px;background:#2563eb;" onclick="closeCashBatch(${netToSend}, ${totalComp})">
        ✅ Отправлено (скомпенсировать ${totalComp} грн)
      </button>
    `;
  }

  document.getElementById("cash-boxes-summary").innerHTML = boxHtml;

  // Отрисовка движения по разменной кассе 4500 грн
  let flowHtml = `
    <div class="emp-bal" style="padding:6px 0;">
      <span style="font-size:14px;color:#64748b;">Норматив кассы (база)</span>
      <span style="font-weight:700;">${CASH_BASE} грн</span>
    </div>
    <div class="emp-bal" style="padding:6px 0;">
      <span style="font-size:14px;">Выдача по терминалу (чеки)</span>
      <span style="font-weight:700;color:#dc2626;">−${termSum} грн</span>
    </div>
    <div class="emp-bal" style="padding:6px 0;">
      <span style="font-size:14px;">Закупка материалов</span>
      <span style="font-weight:700;color:#dc2626;">−${matSum} грн</span>
    </div>
    <div class="emp-bal" style="padding:6px 0;">
      <span style="font-size:14px;">Выплата ЗП сотрудникам</span>
      <span style="font-weight:700;color:#dc2626;">−${zpSum} грн</span>
    </div>
    <div class="emp-bal" style="border-top:1px solid #cbd5e1;padding-top:8px;">
      <span style="font-weight:700;font-size:14px;">Наличных в кассе до компенсации</span>
      <span style="font-weight:800;font-size:15px;color:#2563eb;">${currentCashInBox} грн</span>
    </div>
  `;

  if (expDetails.length) {
    flowHtml += `<div style="margin-top:10px;padding-top:8px;border-top:1px dashed #cbd5e1;font-size:12px;color:#475569;"><b>Чеки и примечания:</b>`;
    expDetails
      .slice()
      .reverse()
      .forEach((item) => {
        flowHtml += `<div style="margin-top:4px;">• ${formatHumanDate(
          item.date
        )} — ${item.type}: <b>${item.amount} грн</b> ${
          item.note ? `(${item.note})` : ""
        }</div>`;
      });
    flowHtml += `</div>`;
  }
  document.getElementById("cash-flow-summary").innerHTML = flowHtml;
}

async function closeCashBatch(netAmount, compAmount) {
  if (
    !confirm(
      `Подтвердить, что в кассу возвращено ${compAmount} грн (до базы 4500 грн), а чистые ${netAmount} грн отправлены?`
    )
  )
    return;
  document.getElementById("loader").style.display = "block";
  await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      key: secretKey,
      action: "close_cash_batch",
      netAmount,
    }),
  });
  await loadData();
}
function formatShortPeriod(rawVal, periodKey) {
  const str = String(rawVal || "").trim();
  if (periodKey === "period") {
    const startPart = str.split("..").at(0).trim();
    const parts = startPart.split("-");
    if (parts.length === 3) {
      return `${Number(parts.at(2))}.${parts.at(1)}`;
    }
  }
  return str;
}

function buildReportTable(items, periodKey, empMap) {
  if (!items || !items.length) {
    return "<div style='color:#64748b;font-size:14px;'>Пока нет закрытых периодов</div>";
  }
  const rowsHtml = items
    .slice()
    .reverse()
    .map(
      (r) => `
    <tr>
      <td><b>${formatShortPeriod(r[periodKey], periodKey)}</b></td>
      <td>${empMap[r.empId] || r.empId}</td>
      <td>${r.shifts}</td>
      <td>${r.earned}</td>
      <td>${r.paid}</td>
      <td><b>${r.debt}</b></td>
    </tr>
  `
    )
    .join("");

  return `
    <div class="table-wrap">
      <table class="rep-table">
        <thead>
          <tr>
            <th>Период</th>
            <th>Сотрудник</th>
            <th>Смен</th>
            <th>Начисл.</th>
            <th>Выпл.</th>
            <th>Долг</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
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
    monthly,
    logs,
  } = data;
  document.getElementById("user-info").textContent = `${user.name}`;

  const empMap = {};
  employees.forEach((e) => (empMap[e.id] = e.name));

  const calDiv = document.getElementById("tab-schedule");
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

  if (showSal) {
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

    document.getElementById("summary-list").innerHTML = buildReportTable(
      summary,
      "period",
      empMap
    );
    document.getElementById("monthly-list").innerHTML = buildReportTable(
      monthly,
      "month",
      empMap
    );
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
