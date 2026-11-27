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

// Построение таблицы для закрытых недельных и месячных отчётов с детализацией выплат и остатка долга на дату выплаты
function buildReportTable(items, periodKey, empMap, calendar, payments) {
  if (!items || !items.length) {
    return "<div style='color:#64748b;font-size:14px;'>Пока нет закрытых периодов</div>";
  }

  const rowsHtml = items
    .slice()
    .reverse()
    .map((r) => {
      let paySubRow = "";

      // Для недельного отчёта ("period") выводим под строкой конкретные выплаты и остаток долга сразу после выплаты
      if (
        periodKey === "period" &&
        Array.isArray(payments) &&
        Array.isArray(calendar)
      ) {
        const parts = String(r.period || "")
          .split("..")
          .map((s) => s.trim());
        const startDate = parts.at(0) || "";
        const endDate = parts.at(1) || "";

        const weekPays = payments
          .filter(
            (p) =>
              String(p.empId).trim() === String(r.empId).trim() &&
              p.date >= startDate &&
              p.date <= endDate
          )
          .sort((a, b) => a.date.localeCompare(b.date));

        if (weekPays.length) {
          const payBadges = weekPays
            .map((pay) => {
              const earnedUntilPay = calendar
                .filter(
                  (c) =>
                    String(c.empId).trim() === String(r.empId).trim() &&
                    c.status === "Отработано" &&
                    c.date <= pay.date
                )
                .reduce((sum, c) => sum + (Number(c.rate) || 0), 0);

              const paidUntilPay = payments
                .filter(
                  (p) =>
                    String(p.empId).trim() === String(r.empId).trim() &&
                    p.date <= pay.date
                )
                .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

              const debtAtPay = earnedUntilPay - paidUntilPay;
              const debtColor = debtAtPay <= 0 ? "#15803d" : "#dc2626";
              return `💸 <b>${formatHumanDate(pay.date)}</b>: выплачено <b>${
                pay.amount
              } грн</b> → остаток на момент выплаты: <b style="color:${debtColor};">${debtAtPay} грн</b>`;
            })
            .join("<br>");

          paySubRow = `
            <tr style="background:#f8fafc;">
              <td colspan="6" style="text-align:left;font-size:12px;color:#334155;padding:6px 8px;border-bottom:2px solid #cbd5e1;">
                ${payBadges}
              </td>
            </tr>
          `;
        }
      }

      return `
        <tr>
          <td><b>${formatShortPeriod(r[periodKey], periodKey)}</b></td>
          <td>${empMap[r.empId] || r.empId}</td>
          <td>${r.shifts}</td>
          <td>${r.earned}</td>
          <td>${r.paid}</td>
          <td><b>${r.debt}</b></td>
        </tr>
        ${paySubRow}
      `;
    })
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
            <th>Остаток</th>
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
      empMap,
      calendar,
      payments
    );
    document.getElementById("monthly-list").innerHTML = buildReportTable(
      monthly,
      "month",
      empMap,
      calendar,
      payments
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
