// Переключение экранов внутри вкладки З/П (главная, отчёт за неделю, динамический отчёт за месяц)
function showFinSub(sub) {
  document.getElementById("fin-main").classList.add("hidden");
  document.getElementById("fin-weekly").classList.add("hidden");
  document.getElementById("fin-monthly").classList.add("hidden");
  document.getElementById(`fin-${sub}`).classList.remove("hidden");
  if (sub === "monthly") initDynamicMonthly();
}

// Форматирование даты начала недели "YYYY-MM-DD" в короткий вид "16.11"
function formatWeekFrom(rawVal) {
  const str = String(rawVal || "").trim();
  const startPart = str.split("..").at(0).trim();
  const parts = startPart.split("-");
  if (parts.length === 3) {
    return `${Number(parts.at(2))}.${parts.at(1)}`;
  }
  return str;
}

// Построение лаконичной таблицы закрытых недель из листа Сводка (без долгов)
function buildWeeklyTable(items, empMap) {
  if (!items || !items.length) {
    return "<div style='color:#64748b;font-size:14px;'>Пока нет закрытых недель</div>";
  }
  const rowsHtml = items
    .slice()
    .reverse()
    .map(
      (r) => `
    <tr>
      <td><b>${formatWeekFrom(r.weekFrom)}</b></td>
      <td>${empMap[r.empId] || r.empId}</td>
      <td>${r.shifts}</td>
      <td>${r.paid}</td>
      <td>${r.payDate || "—"}</td>
    </tr>
  `
    )
    .join("");

  return `
    <div class="table-wrap">
      <table class="rep-table">
        <thead>
          <tr>
            <th>Неделя от</th>
            <th>Сотрудник</th>
            <th>Смен</th>
            <th>Выпл.</th>
            <th>Дата выпл.</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
}

// Заполнение выпадающего списка доступных месяцев из фактических смен и выплат
function initDynamicMonthly() {
  if (!APP_DATA) return;
  const MONTHS_FULL = Array.of(
    "Январь",
    "Февраль",
    "Март",
    "Апрель",
    "Май",
    "Июнь",
    "Июль",
    "Август",
    "Сентябрь",
    "Октябрь",
    "Ноябрь",
    "Декабрь"
  );
  const ymSet = new Set();

  (APP_DATA.calendar || []).forEach((c) => {
    if (c.status === "Отработано" && c.date) ymSet.add(c.date.slice(0, 7));
  });
  (APP_DATA.payments || []).forEach((p) => {
    if (p.date) ymSet.add(p.date.slice(0, 7));
  });

  const sortedYm = Array.from(ymSet).sort().reverse();
  const sel = document.getElementById("fin-month-select");
  if (!sortedYm.length) {
    sel.innerHTML = `<option value="">Нет данных</option>`;
    document.getElementById("monthly-list").innerHTML =
      "<div style='color:#64748b;font-size:14px;'>Пока нет отработанных смен</div>";
    return;
  }

  sel.innerHTML = sortedYm
    .map((ym) => {
      const p = ym.split("-");
      const label = `${MONTHS_FULL.at(Number(p.at(1)) - 1) || p.at(1)} ${p.at(
        0
      )}`;
      return `<option value="${ym}">${label}</option>`;
    })
    .join("");

  renderDynamicMonthly();
}

// Динамический расчёт отчёта за выбранный месяц по фактическим сменам и выплатам (без хранения долга)
function renderDynamicMonthly() {
  const ym = document.getElementById("fin-month-select").value;
  if (!ym || !APP_DATA) return;

  const rowsHtml = (APP_DATA.employees || [])
    .map((emp) => {
      const shifts = (APP_DATA.calendar || []).filter(
        (c) =>
          String(c.empId).trim() === String(emp.id).trim() &&
          c.status === "Отработано" &&
          c.date.startsWith(ym)
      ).length;

      let paid = 0;
      const dates = [];
      (APP_DATA.payments || []).forEach((p) => {
        if (
          String(p.empId).trim() === String(emp.id).trim() &&
          p.date.startsWith(ym)
        ) {
          paid += Number(p.amount) || 0;
          const dp = p.date.split("-");
          if (dp.length === 3) dates.push(`${Number(dp.at(2))}.${dp.at(1)}`);
        }
      });

      return `
        <tr>
          <td><b>${emp.name}</b></td>
          <td>${shifts}</td>
          <td>${paid}</td>
          <td>${dates.length ? dates.join(", ") : "—"}</td>
        </tr>
      `;
    })
    .join("");

  document.getElementById("monthly-list").innerHTML = `
    <div class="table-wrap">
      <table class="rep-table">
        <thead>
          <tr>
            <th>Сотрудник</th>
            <th>Смен</th>
            <th>Выпл.</th>
            <th>Даты выпл.</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
}
// Отрисовка живых долгов по зарплате, формы выплаты и недельного отчёта
function renderSalary(data) {
  const { perms, employees, calendar, payments, summary } = data;
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

    document.getElementById("summary-list").innerHTML = buildWeeklyTable(
      summary,
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
