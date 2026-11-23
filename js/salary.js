// Переключение экранов внутри вкладки З/П (главная, отчёт за неделю, отчёт за месяц)
function showFinSub(sub) {
  document.getElementById("fin-main").classList.add("hidden");
  document.getElementById("fin-weekly").classList.add("hidden");
  document.getElementById("fin-monthly").classList.add("hidden");
  document.getElementById(`fin-${sub}`).classList.remove("hidden");
}

// Сокращение строки периода вида "2026-11-16 .. 2026-11-22" до "16.11"
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

// Построение HTML-таблицы для закрытых недельных и месячных отчётов по зарплате
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

// Отрисовка текущих долгов по зарплате, списка сотрудников для выплаты и архивных таблиц
function renderSalary(data) {
  const { perms, employees, calendar, payments, summary, monthly } = data;
  const empMap = {};
  employees.forEach((e) => (empMap[e.id] = e.name));

  if (perms.view_fin) {
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
}

// Запись выплаты зарплаты с блокировкой кнопки от двойного нажатия и проверкой на дубль
async function addPayment() {
  const empSelect = document.getElementById("pay-emp");
  const empId = empSelect.value;
  const empName = empSelect.options[empSelect.selectedIndex]?.text || empId;
  const date = document.getElementById("pay-date").value;
  const amount = Number(document.getElementById("pay-amount").value);

  if (!amount || amount <= 0) return alert("Введите сумму выплаты");

  const hasDuplicate = (APP_DATA?.payments || []).some(
    (p) =>
      String(p.empId).trim() === String(empId).trim() &&
      String(p.date).trim() === String(date).trim() &&
      Number(p.amount) === amount
  );

  if (hasDuplicate) {
    const ok = confirm(
      `Внимание! Сотруднику ${empName} за ${formatHumanDate(
        date
      )} уже записана выплата ${amount} грн.\n\nВы уверены, что нужно выдать ещё одну точно такую же сумму?`
    );
    if (!ok) return;
  }

  const btn = document.querySelector("#payment-card .btn-primary");
  if (btn) btn.disabled = true;
  document.getElementById("loader").style.display = "block";

  try {
    await apiPost({ action: "add_payment", empId, date, amount });
    document.getElementById("pay-amount").value = "";
    await loadData();
  } finally {
    if (btn) btn.disabled = false;
    document.getElementById("loader").style.display = "none";
  }
}
