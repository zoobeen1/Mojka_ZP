// Переключение между главным экраном кассы, матрицей боксов и отчётом за дату
function toggleCashSub(sub) {
  document
    .getElementById("cash-main-view")
    .classList.toggle("hidden", sub !== "main");
  document
    .getElementById("cash-matrix-view")
    .classList.toggle("hidden", sub !== "matrix");
  document
    .getElementById("cash-tx-view")
    .classList.toggle("hidden", sub !== "date");
  if (sub === "matrix") renderMatrixTable();
  if (sub === "date") initDateReport();
}

// Открытие модального окна с таблицей покупюрного сбора по боксам
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
  headHtml += `<tr class="tot-money"><td class="box-col" style="background:#dcfce7;">Всего грн</td>${DENOMS.map(
    (d) => `<td id="cmoney-${d}">0</td>`
  ).join("")}<td id="ctotal-money">0</td></tr>`;
  headHtml += `<tr class="tot-bills"><td class="box-col" style="background:#fef9c3;">Сум купюр</td>${DENOMS.map(
    (d) => `<td id="cbills-${d}">0</td>`
  ).join("")}<td id="ctotal-bills">0</td></tr></tbody>`;
  tbl.innerHTML = headHtml;
  document.getElementById("cash-modal").classList.remove("hidden");
}

// Закрытие окна сбора выручки с боксов
function closeCashModal() {
  document.getElementById("cash-modal").classList.add("hidden");
}

// Автоматический пересчёт сумм по строкам и столбцам в таблице сбора купюр
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

// Отправка данных покупюрного сбора с боксов в Google Таблицу
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
  await apiPost({ action: "add_cash", date, rows });
  await loadData();
}

// Открытие модального окна для записи расхода из кассы (терминал / материалы)
function openExpModal() {
  document.getElementById("exp-date").value = getLocalToday();
  document.getElementById("exp-amount").value = "";
  document.getElementById("exp-note").value = "";
  document.getElementById("exp-modal").classList.remove("hidden");
}

// Закрытие окна расхода из кассы
function closeExpModal() {
  document.getElementById("exp-modal").classList.add("hidden");
}

// Отправка расхода из кассы (терминал или материалы) в Google Таблицу
async function submitExpModal() {
  const date = document.getElementById("exp-date").value;
  const type = document.getElementById("exp-type").value;
  const amount = Number(document.getElementById("exp-amount").value);
  const note = document.getElementById("exp-note").value.trim();

  if (!amount || amount <= 0) return alert("Введите сумму расхода");
  document.getElementById("loader").style.display = "block";
  closeExpModal();
  await apiPost({ action: "add_cash_exp", date, type, amount, note });
  await loadData();
}

// Проверка, попадает ли операция в выбранный фильтр (Ожидает, Сегодня, Неделя, Месяц)
function matchPeriod(item, period, todayStr, monDate, monthPrefix) {
  if (period === "pending") return Boolean(item.pending);
  if (item.pending) return false;
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

// Отрисовка сводки выручки по боксам, компенсации в кассу 4500 грн и суммы к отправке
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

  const boxSums = {};
  CASH_BOXES.forEach((b) => (boxSums[b] = 0));
  let totalBoxes = 0;

  (APP_DATA.cash || []).forEach((c) => {
    if (!matchPeriod(c, period, todayStr, mon, monthPrefix)) return;
    if (boxSums[c.box] !== undefined) boxSums[c.box] += c.sum;
    else boxSums[c.box] = (boxSums[c.box] || 0) + c.sum;
    totalBoxes += c.sum;
  });

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
      <span style="font-weight:800;font-size:16px;">${
        period === "pending" ? "К ОТПРАВКЕ" : "ОТПРАВЛЕНО ЧИСТЫМИ"
      }</span>
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

  const flowCard = document.getElementById("cash-flow-summary").parentElement;
  flowCard.classList.toggle("hidden", period !== "pending");

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
// Закрытие текущего сбора: компенсация операционной кассы до 4500 грн и пометка операций как "Отправлено"
async function closeCashBatch(netAmount, compAmount) {
  if (
    !confirm(
      `Подтвердить, что в кассу возвращено ${compAmount} грн (до базы 4500 грн), а чистые ${netAmount} грн отправлены?`
    )
  )
    return;
  document.getElementById("loader").style.display = "block";
  await apiPost({ action: "close_cash_batch", netAmount });
  await loadData();
}

// Переход из сводной таблицы сборов в детальный отчёт за выбранный день по клику на строку
function openDateFromMatrix(isoDate) {
  toggleCashSub("date");
  const sel = document.getElementById("tx-date-select");
  if (sel) {
    sel.value = isoDate;
    renderDateReport();
  }
}

// Отрисовка компактной шахматной таблицы сборов (1-5, Пыл, Терм, Сумм) с группировкой по месяцам и годам
function renderMatrixTable() {
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
  const byDate = {};

  const ensureDate = (d) => {
    if (!byDate[d])
      byDate[d] = { b1: 0, b2: 0, b3: 0, b4: 0, b5: 0, pil: 0, term: 0 };
  };

  (APP_DATA.cash || []).forEach((c) => {
    if (c.pending) return;
    ensureDate(c.date);
    if (c.box === "Бокс 1") byDate[c.date].b1 += c.sum;
    else if (c.box === "Бокс 2") byDate[c.date].b2 += c.sum;
    else if (c.box === "Бокс 3") byDate[c.date].b3 += c.sum;
    else if (c.box === "Бокс 4") byDate[c.date].b4 += c.sum;
    else if (c.box === "Бокс 5") byDate[c.date].b5 += c.sum;
    else if (c.box === "Пилосос") byDate[c.date].pil += c.sum;
  });

  (APP_DATA.cashExp || []).forEach((e) => {
    if (e.pending) return;
    if (e.type.includes("Терминал")) {
      ensureDate(e.date);
      byDate[e.date].term += e.amount;
    }
  });

  const dates = Object.keys(byDate).sort().reverse();
  const box = document.getElementById("matrix-table-box");
  if (!dates.length) {
    box.innerHTML =
      "<div style='color:#64748b;font-size:14px;'>Пока нет проведённых сборов</div>";
    return;
  }

  const byMonth = {};
  dates.forEach((d) => {
    const ym = d.slice(0, 7);
    if (!byMonth[ym]) byMonth[ym] = [];
    byMonth[ym].push(d);
  });

  const grandTot = {
    b1: 0,
    b2: 0,
    b3: 0,
    b4: 0,
    b5: 0,
    pil: 0,
    term: 0,
    all: 0,
  };
  let bodyHtml = "";

  Object.keys(byMonth)
    .sort()
    .reverse()
    .forEach((ym) => {
      const p = ym.split("-");
      const mTitle = `${MONTHS_FULL.at(Number(p.at(1)) - 1) || p.at(1)} ${p.at(
        0
      )}`;
      const mTot = {
        b1: 0,
        b2: 0,
        b3: 0,
        b4: 0,
        b5: 0,
        pil: 0,
        term: 0,
        all: 0,
      };

      bodyHtml += `
      <tr style="background:#eff6ff;color:#1e3a8a;font-weight:800;">
        <td colspan="9" style="text-align:left;padding:8px 6px;font-size:13px;">📅 ${mTitle}</td>
      </tr>
    `;

      byMonth[ym].forEach((d) => {
        const r = byDate[d];
        const rowSum = r.b1 + r.b2 + r.b3 + r.b4 + r.b5 + r.pil + r.term;
        mTot.b1 += r.b1;
        mTot.b2 += r.b2;
        mTot.b3 += r.b3;
        mTot.b4 += r.b4;
        mTot.b5 += r.b5;
        mTot.pil += r.pil;
        mTot.term += r.term;
        mTot.all += rowSum;

        const dp = d.split("-");
        const shortD = `${Number(dp.at(2))}.${dp.at(1)}`;
        bodyHtml += `
        <tr style="cursor:pointer;" onclick="openDateFromMatrix('${d}')" title="Открыть сводку за ${shortD}">
          <td style="text-align:left;"><b style="color:#2563eb;text-decoration:underline;">${shortD}</b></td>
          <td>${r.b1 || "-"}</td>
          <td>${r.b2 || "-"}</td>
          <td>${r.b3 || "-"}</td>
          <td>${r.b4 || "-"}</td>
          <td>${r.b5 || "-"}</td>
          <td>${r.pil || "-"}</td>
          <td>${r.term || "-"}</td>
          <td><b>${rowSum}</b></td>
        </tr>
      `;
      });

      bodyHtml += `
      <tr style="background:#f1f5f9;font-weight:800;color:#0f172a;">
        <td style="text-align:left;">Итого</td>
        <td>${mTot.b1}</td>
        <td>${mTot.b2}</td>
        <td>${mTot.b3}</td>
        <td>${mTot.b4}</td>
        <td>${mTot.b5}</td>
        <td>${mTot.pil}</td>
        <td>${mTot.term}</td>
        <td>${mTot.all}</td>
      </tr>
    `;

      grandTot.b1 += mTot.b1;
      grandTot.b2 += mTot.b2;
      grandTot.b3 += mTot.b3;
      grandTot.b4 += mTot.b4;
      grandTot.b5 += mTot.b5;
      grandTot.pil += mTot.pil;
      grandTot.term += mTot.term;
      grandTot.all += mTot.all;
    });

  bodyHtml += `
    <tr style="background:#dcfce7;font-weight:800;color:#14532d;border-top:2px solid #94a3b8;">
      <td style="text-align:left;">ВСЕГО</td>
      <td>${grandTot.b1}</td>
      <td>${grandTot.b2}</td>
      <td>${grandTot.b3}</td>
      <td>${grandTot.b4}</td>
      <td>${grandTot.b5}</td>
      <td>${grandTot.pil}</td>
      <td>${grandTot.term}</td>
      <td>${grandTot.all}</td>
    </tr>
  `;

  box.innerHTML = `
    <div class="table-wrap">
      <table class="rep-table" style="font-size:12px;text-align:center;">
        <thead>
          <tr>
            <th style="text-align:left;">Дата</th>
            <th>1</th>
            <th>2</th>
            <th>3</th>
            <th>4</th>
            <th>5</th>
            <th>Пыл</th>
            <th>Терм</th>
            <th>Сумм</th>
          </tr>
        </thead>
        <tbody>${bodyHtml}</tbody>
      </table>
    </div>
  `;
}

// Заполнение выпадающего списка закрытых дат для детального отчёта
function initDateReport() {
  if (!APP_DATA) return;
  const datesSet = new Set();
  (APP_DATA.cash || []).forEach((c) => {
    if (!c.pending) datesSet.add(c.date);
  });
  (APP_DATA.cashExp || []).forEach((e) => {
    if (!e.pending) datesSet.add(e.date);
  });
  (APP_DATA.payments || []).forEach((p) => {
    if (!p.pending) datesSet.add(p.date);
  });

  const sortedDates = Array.from(datesSet).sort().reverse();
  const sel = document.getElementById("tx-date-select");
  if (!sortedDates.length) {
    sel.innerHTML = `<option value="">Нет закрытых дат</option>`;
    document.getElementById("date-report-box").innerHTML =
      "<div style='color:#64748b;font-size:14px;'>Пока нет отправленных сборов</div>";
    return;
  }
  sel.innerHTML = sortedDates
    .map((d) => `<option value="${d}">${formatHumanDate(d)} (${d})</option>`)
    .join("");
  renderDateReport();
}

// Отрисовка сводного отчёта по боксам и всем расходам (включая З/П) за выбранную дату
function renderDateReport() {
  const targetDate = document.getElementById("tx-date-select").value;
  if (!targetDate || !APP_DATA) return;

  const empMap = {};
  (APP_DATA.employees || []).forEach((e) => (empMap[e.id] = e.name));

  const boxSums = {};
  CASH_BOXES.forEach((b) => (boxSums[b] = 0));
  let totalBoxes = 0;

  (APP_DATA.cash || []).forEach((c) => {
    if (!c.pending && c.date === targetDate) {
      if (boxSums[c.box] !== undefined) boxSums[c.box] += c.sum;
      else boxSums[c.box] = (boxSums[c.box] || 0) + c.sum;
      totalBoxes += c.sum;
    }
  });

  let termSum = 0,
    matSum = 0,
    zpSum = 0;
  const expList = [];

  (APP_DATA.cashExp || []).forEach((e) => {
    if (!e.pending && e.date === targetDate) {
      if (e.type.includes("Терминал")) termSum += e.amount;
      else matSum += e.amount;
      expList.push(
        `${e.type}: <b>${e.amount} грн</b> ${e.note ? `(${e.note})` : ""}`
      );
    }
  });

  (APP_DATA.payments || []).forEach((p) => {
    if (!p.pending && p.date === targetDate) {
      zpSum += p.amount;
      const eName = empMap[p.empId] || p.empId;
      expList.push(`Выплата З/П (${eName}): <b>${p.amount} грн</b>`);
    }
  });

  const totalComp = termSum + matSum + zpSum;
  const netSent = totalBoxes - totalComp;

  let html = Object.keys(boxSums)
    .map(
      (b) => `
    <div class="emp-bal" style="padding:6px 0;">
      <span class="emp-name" style="font-size:14px;">${b}</span>
      <span style="font-weight:700;font-size:14px;">${boxSums[b]} грн</span>
    </div>
  `
    )
    .join("");

  html += `
    <div class="emp-bal" style="border-top:1px solid #cbd5e1;margin-top:4px;padding-top:8px;">
      <span style="font-weight:700;font-size:15px;">Всего с боксов</span>
      <span style="font-weight:800;font-size:16px;">${totalBoxes} грн</span>
    </div>
    <div class="emp-bal" style="padding:6px 0;color:#dc2626;">
      <span style="font-size:14px;">Компенсация в кассу (Терм: ${termSum}, Расх: ${matSum}, З/П: ${zpSum})</span>
      <span style="font-weight:700;font-size:15px;">−${totalComp} грн</span>
    </div>
    <div class="emp-bal" style="border-top:2px solid #cbd5e1;padding-top:10px;">
      <span style="font-weight:800;font-size:16px;">ОТПРАВЛЕНО ЧИСТЫМИ</span>
      <span class="debt-val ok" style="font-size:18px;">${netSent} грн</span>
    </div>
  `;

  if (expList.length) {
    html += `<div style="margin-top:10px;padding-top:8px;border-top:1px dashed #cbd5e1;font-size:12px;color:#475569;"><b>Расходы:</b><br>• ${expList.join(
      "<br>• "
    )}</div>`;
  }

  document.getElementById("date-report-box").innerHTML = html;
}
