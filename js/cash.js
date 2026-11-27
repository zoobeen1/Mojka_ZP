// Переключение между экранами раздела Касса (главная, список отправок, детализация отправки, матрица боксов, дата)
function toggleCashSub(sub) {
  document
    .getElementById("cash-main-view")
    .classList.toggle("hidden", sub !== "main");
  document
    .getElementById("cash-dispatches-view")
    .classList.toggle("hidden", sub !== "dispatches");
  document
    .getElementById("cash-dispatch-detail-view")
    .classList.toggle("hidden", sub !== "dispatch-detail");
  document
    .getElementById("cash-matrix-view")
    .classList.toggle("hidden", sub !== "matrix");
  document
    .getElementById("cash-tx-view")
    .classList.toggle("hidden", sub !== "date");

  if (sub === "dispatches") renderDispatchesList();
  if (sub === "matrix") renderMatrixTable();
  if (sub === "date") initDateReport();
}

// Получение актуального норматива операционной кассы из настроек таблицы (по умолчанию 4500)
function getCurrentCashBase() {
  return Number(APP_DATA?.cashBase) || CASH_BASE || 4500;
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
  headHtml += `<tr class="tot-money"><td class="box-col bg-money">Всего грн</td>${DENOMS.map(
    (d) => `<td id="cmoney-${d}">0</td>`
  ).join("")}<td id="ctotal-money">0</td></tr>`;
  headHtml += `<tr class="tot-bills"><td class="box-col bg-bills">Сум купюр</td>${DENOMS.map(
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

// Отправка данных покупюрного сбора с боксов в лист Сборы
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

// Открытие модального окна для записи чека терминала или расхода из кассы
function openExpModal() {
  document.getElementById("exp-date").value = getLocalToday();
  document.getElementById("exp-amount").value = "";
  document.getElementById("exp-note").value = "";
  document.getElementById("exp-modal").classList.remove("hidden");
}

// Закрытие окна расхода / терминала
function closeExpModal() {
  document.getElementById("exp-modal").classList.add("hidden");
}

// Отправка чека терминала (в лист Терминал) или хозрасхода (в лист Расходы)
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

// Проверка попадания операции в выбранный фильтр (К отправке / Сегодня / Неделя / Месяц)
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

// Живой пересчёт расчётной суммы и автоподстановка в поле фактической отправки при изменении галочек
function recalcDispatchPreview() {
  const totalBoxes =
    Number(document.getElementById("disp-boxes-total")?.dataset.val) || 0;
  const cashBase = getCurrentCashBase();
  let selectedComp = 0;

  document.querySelectorAll(".comp-chk:checked").forEach((chk) => {
    selectedComp += Number(chk.dataset.amount) || 0;
  });

  const netToSend = totalBoxes - selectedComp;
  const compEl = document.getElementById("disp-comp-val");
  const netEl = document.getElementById("disp-net-val");
  const factInput = document.getElementById("disp-fact-amount");
  const cashRemainEl = document.getElementById("disp-cash-remain");

  if (compEl) compEl.textContent = `−${selectedComp} грн`;
  if (netEl) netEl.textContent = `${netToSend} грн`;
  if (factInput) factInput.value = netToSend;
  if (cashRemainEl) cashRemainEl.textContent = `${cashBase - selectedComp} грн`;
}
// Отрисовка сводки выручки по боксам и списка чеков/выплат с галочками для гибкой компенсации
function renderCashStats() {
  if (!APP_DATA) return;
  const period = document.getElementById("cash-period").value;
  const cashBase = getCurrentCashBase();
  const baseTitle = document.getElementById("cash-base-title");
  if (baseTitle)
    baseTitle.textContent = `Движение по кассе (база ${cashBase} грн)`;

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const todayStr = getLocalToday();
  const dow = now.getDay() === 0 ? 7 : now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - (dow - 1));
  const monthPrefix = todayStr.slice(0, 7);

  const empMap = {};
  (APP_DATA.employees || []).forEach((e) => (empMap[e.id] = e.name));

  const boxSums = {};
  CASH_BOXES.forEach((b) => (boxSums[b] = 0));
  let totalBoxes = 0;

  (APP_DATA.cash || []).forEach((c) => {
    if (!matchPeriod(c, period, todayStr, mon, monthPrefix)) return;
    if (boxSums[c.box] !== undefined) boxSums[c.box] += c.sum;
    else boxSums[c.box] = (boxSums[c.box] || 0) + c.sum;
    totalBoxes += c.sum;
  });

  const termItems = (APP_DATA.terminal || []).filter((t) =>
    matchPeriod(t, period, todayStr, mon, monthPrefix)
  );
  const expItems = (APP_DATA.expenses || []).filter((e) =>
    matchPeriod(e, period, todayStr, mon, monthPrefix)
  );
  const payItems = (APP_DATA.payments || []).filter((p) =>
    matchPeriod(p, period, todayStr, mon, monthPrefix)
  );

  const termSum = termItems.reduce((acc, i) => acc + i.amount, 0);
  const expSum = expItems.reduce((acc, i) => acc + i.amount, 0);
  const zpSum = payItems.reduce((acc, i) => acc + i.amount, 0);
  const totalComp = termSum + expSum + zpSum;
  const netToSend = totalBoxes - totalComp;

  let boxHtml = Object.keys(boxSums)
    .map(
      (b) => `
    <div class="u-item u-item--compact">
      <span class="u-bold txt-sm">${b}</span>
      <span class="u-bold txt-sm">${boxSums[b]} грн</span>
    </div>
  `
    )
    .join("");

  boxHtml += `
    <div class="u-item u-item--sub">
      <span class="u-bold txt-md">Всего с боксов</span>
      <span class="u-heavy txt-lg" id="disp-boxes-total" data-val="${totalBoxes}">${totalBoxes} грн</span>
    </div>
    <div class="u-item u-item--compact u-red">
      <span class="txt-sm">Компенсация в кассу</span>
      <span class="u-bold txt-md" id="disp-comp-val">−${totalComp} грн</span>
    </div>
    <div class="u-item u-item--total">
      <span class="u-heavy txt-lg">${
        period === "pending" ? "К ОТПРАВКЕ" : "СБОРЫ ЗА ПЕРИОД"
      }</span>
      <span class="u-heavy u-green txt-xl" id="disp-net-val">${netToSend} грн</span>
    </div>
  `;

  if (
    period === "pending" &&
    APP_DATA.perms.add_cash &&
    (totalBoxes > 0 || totalComp > 0)
  ) {
    boxHtml += `
      <div class="u-dashed no-print">
        <div class="u-hint u-mb-sm">Фактически отправлено, грн (можно исправить при расхождении):</div>
        <input type="number" id="disp-fact-amount" class="u-input u-heavy u-mb-sm" value="${netToSend}">
        <input type="text" id="disp-note" class="u-input u-mb-sm" placeholder="Примечание к отправке (необязательно)">
        <button class="u-btn u-btn--blue u-btn--full" onclick="closeCashBatch()">
          ✅ Провести отправку
        </button>
      </div>
    `;
  }

  document.getElementById("cash-boxes-summary").innerHTML = boxHtml;

  const flowCard = document.getElementById("cash-flow-summary").parentElement;
  flowCard.classList.toggle("hidden", period !== "pending");

  let flowHtml = `
    <div class="u-item u-item--compact">
      <span class="txt-sm u-muted">Норматив кассы (база)</span>
      <span class="u-bold">${cashBase} грн</span>
    </div>
    <div class="u-item u-item--compact">
      <span class="txt-sm">Выдача по терминалу (чеки)</span>
      <span class="u-bold u-red">−${termSum} грн</span>
    </div>
    <div class="u-item u-item--compact">
      <span class="txt-sm">Расходы (материалы и др.)</span>
      <span class="u-bold u-red">−${expSum} грн</span>
    </div>
    <div class="u-item u-item--compact">
      <span class="txt-sm">Выплата ЗП сотрудникам</span>
      <span class="u-bold u-red">−${zpSum} грн</span>
    </div>
    <div class="u-item u-item--sub">
      <span class="u-bold txt-sm">Наличных в кассе до компенсации</span>
      <span class="u-heavy txt-md u-blue" id="disp-cash-remain">${
        cashBase - totalComp
      } грн</span>
    </div>
  `;

  if (termItems.length || expItems.length || payItems.length) {
    flowHtml += `<div class="u-dashed">
      <div class="u-bold u-mb-sm">Отметьте галочкой, что компенсируем в кассу сейчас:</div>`;

    termItems.forEach((t) => {
      flowHtml += `<label class="chk-row">
        <input type="checkbox" class="comp-chk" data-kind="term" data-row="${
          t.row
        }" data-amount="${t.amount}" checked onchange="recalcDispatchPreview()">
        <span>${formatHumanDate(t.date)} · Терминал: <b>${t.amount} грн</b> ${
        t.note ? `(${t.note})` : ""
      }</span>
      </label>`;
    });

    expItems.forEach((e) => {
      flowHtml += `<label class="chk-row">
        <input type="checkbox" class="comp-chk" data-kind="exp" data-row="${
          e.row
        }" data-amount="${e.amount}" checked onchange="recalcDispatchPreview()">
        <span>${formatHumanDate(e.date)} · Расход: <b>${e.amount} грн</b> ${
        e.note ? `(${e.note})` : ""
      }</span>
      </label>`;
    });

    payItems.forEach((p) => {
      const eName = empMap[p.empId] || p.empId;
      flowHtml += `<label class="chk-row">
        <input type="checkbox" class="comp-chk" data-kind="pay" data-row="${
          p.row
        }" data-amount="${p.amount}" checked onchange="recalcDispatchPreview()">
        <span>${formatHumanDate(p.date)} · З/П (${eName}): <b>${
        p.amount
      } грн</b></span>
      </label>`;
    });

    flowHtml += `</div>`;
  }

  document.getElementById("cash-flow-summary").innerHTML = flowHtml;
}

// Проведение отправки: фиксирует фактическую сумму в лист Отправки и привязывает отмеченные галочкой расходы
async function closeCashBatch() {
  const totalBoxes =
    Number(document.getElementById("disp-boxes-total")?.dataset.val) || 0;
  const note = (document.getElementById("disp-note")?.value || "").trim();

  const termRows = [];
  const expRows = [];
  const payRows = [];
  let selectedComp = 0;

  document.querySelectorAll(".comp-chk:checked").forEach((chk) => {
    const kind = chk.dataset.kind;
    const rowNum = Number(chk.dataset.row);
    const amt = Number(chk.dataset.amount) || 0;
    selectedComp += amt;
    if (kind === "term") termRows.push(rowNum);
    else if (kind === "exp") expRows.push(rowNum);
    else if (kind === "pay") payRows.push(rowNum);
  });

  const calcNet = totalBoxes - selectedComp;
  const factInput = document.getElementById("disp-fact-amount");
  const netAmount =
    factInput && factInput.value !== "" ? Number(factInput.value) : calcNet;
  const diff = netAmount - calcNet;

  let msg = `Провести отправку?\n\n• Собрано с боксов: ${totalBoxes} грн\n• Компенсация в кассу: ${selectedComp} грн\n• Должно отправиться: ${calcNet} грн\n• ФАКТИЧЕСКИ ОТПРАВЛЕНО: ${netAmount} грн`;
  if (diff !== 0) {
    msg += `\n• Разница: ${diff > 0 ? "+" : ""}${diff} грн`;
  }
  if (!confirm(msg)) return;

  document.getElementById("loader").style.display = "block";
  await apiPost({
    action: "close_cash_batch",
    netAmount,
    note,
    termRows,
    expRows,
    payRows,
  });
  await loadData();
}
// Отрисовка списка всех проведённых отправок из листа Отправки
function renderDispatchesList() {
  if (!APP_DATA) return;
  const list = (APP_DATA.dispatches || []).slice().reverse();
  const box = document.getElementById("dispatches-list-box");

  if (!list.length) {
    box.innerHTML =
      '<div class="u-muted txt-sm">Пока нет проведённых отправок</div>';
    return;
  }

  box.innerHTML = list
    .map(
      (d) => `
    <div class="log-row disp-row" onclick="openDispatchDetail('${d.id}')">
      <div class="u-between">
        <div>
          <div class="u-heavy txt-md u-blue">Отправка №${
            d.id
          } · ${formatHumanDate(d.date)}</div>
          <div class="log-meta">${d.who}${d.note ? ` · ${d.note}` : ""}</div>
        </div>
        <div class="u-heavy txt-lg u-green">${d.amount} грн ›</div>
      </div>
    </div>
  `
    )
    .join("");
}

// Открытие полного расклада выбранной отправки: побоксовка, вычеты, расчётная сумма, факт и разница
function openDispatchDetail(dispId) {
  if (!APP_DATA) return;
  const targetId = String(dispId).trim();
  const disp = (APP_DATA.dispatches || []).find(
    (d) => String(d.id).trim() === targetId
  );
  if (!disp) return;

  document.getElementById("disp-detail-title").textContent = `Отправка №${
    disp.id
  } от ${formatHumanDate(disp.date)}`;

  const empMap = {};
  (APP_DATA.employees || []).forEach((e) => (empMap[e.id] = e.name));

  const boxSums = {};
  CASH_BOXES.forEach((b) => (boxSums[b] = 0));
  let totalBoxes = 0;

  (APP_DATA.cash || []).forEach((c) => {
    if (String(c.status).trim() === targetId) {
      if (boxSums[c.box] !== undefined) boxSums[c.box] += c.sum;
      else boxSums[c.box] = (boxSums[c.box] || 0) + c.sum;
      totalBoxes += c.sum;
    }
  });

  const termItems = (APP_DATA.terminal || []).filter(
    (t) => String(t.status).trim() === targetId
  );
  const expItems = (APP_DATA.expenses || []).filter(
    (e) => String(e.status).trim() === targetId
  );
  const payItems = (APP_DATA.payments || []).filter(
    (p) => String(p.status).trim() === targetId
  );

  const termSum = termItems.reduce((s, i) => s + i.amount, 0);
  const expSum = expItems.reduce((s, i) => s + i.amount, 0);
  const zpSum = payItems.reduce((s, i) => s + i.amount, 0);
  const totalComp = termSum + expSum + zpSum;

  const expectedNet = totalBoxes - totalComp;
  const factNet = Number(disp.amount) || 0;
  const diff = factNet - expectedNet;

  let html = Object.keys(boxSums)
    .map(
      (b) => `
    <div class="u-item u-item--compact">
      <span class="u-bold txt-sm">${b}</span>
      <span class="u-bold txt-sm">${boxSums[b]} грн</span>
    </div>
  `
    )
    .join("");

  html += `
    <div class="u-item u-item--sub">
      <span class="u-bold txt-md">Собрано с боксов</span>
      <span class="u-heavy txt-lg">${totalBoxes} грн</span>
    </div>
    <div class="u-item u-item--compact u-red">
      <span class="txt-sm">Компенсация в кассу (Терм: ${termSum}, Расх: ${expSum}, З/П: ${zpSum})</span>
      <span class="u-bold txt-md">−${totalComp} грн</span>
    </div>
    <div class="u-item u-item--sub">
      <span class="txt-sm u-muted">Должно отправиться (за вычетами)</span>
      <span class="u-bold txt-md">${expectedNet} грн</span>
    </div>
    <div class="u-item u-item--compact">
      <span class="u-heavy txt-lg">ФАКТИЧЕСКИ ОТПРАВЛЕНО</span>
      <span class="u-heavy u-green txt-xl">${factNet} грн</span>
    </div>
    <div class="u-item u-item--total">
      <span class="u-bold txt-sm">Разница (факт − расчёт)</span>
      <span class="u-heavy txt-md ${diff === 0 ? "u-green" : "u-red"}">
        ${diff === 0 ? "0 грн (Сошлось)" : `${diff > 0 ? "+" : ""}${diff} грн`}
      </span>
    </div>
  `;

  if (disp.note) {
    html += `<div class="disp-note"><b>Примечание:</b> ${disp.note}</div>`;
  }

  const details = [];
  termItems.forEach((t) =>
    details.push(
      `${formatHumanDate(t.date)} · Терминал: <b>${t.amount} грн</b> ${
        t.note ? `(${t.note})` : ""
      }`
    )
  );
  expItems.forEach((e) =>
    details.push(
      `${formatHumanDate(e.date)} · Расход: <b>${e.amount} грн</b> ${
        e.note ? `(${e.note})` : ""
      }`
    )
  );
  payItems.forEach((p) =>
    details.push(
      `${formatHumanDate(p.date)} · З/П (${empMap[p.empId] || p.empId}): <b>${
        p.amount
      } грн</b>`
    )
  );

  if (details.length) {
    html += `<div class="u-dashed"><b>Скомпенсировано в кассу:</b><br>• ${details.join(
      "<br>• "
    )}</div>`;
  }

  document.getElementById("disp-detail-box").innerHTML = html;
  toggleCashSub("dispatch-detail");
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

// Отрисовка компактной таблицы сборов (1-5, Пыл, Сумм) с группировкой по месяцам и годам
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
    if (!byDate[d]) byDate[d] = { b1: 0, b2: 0, b3: 0, b4: 0, b5: 0, pil: 0 };
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

  const dates = Object.keys(byDate).sort().reverse();
  const box = document.getElementById("matrix-table-box");
  if (!dates.length) {
    box.innerHTML =
      '<div class="u-muted txt-sm">Пока нет проведённых сборов</div>';
    return;
  }

  const byMonth = {};
  dates.forEach((d) => {
    const ym = d.slice(0, 7);
    if (!byMonth[ym]) byMonth[ym] = [];
    byMonth[ym].push(d);
  });

  const grandTot = { b1: 0, b2: 0, b3: 0, b4: 0, b5: 0, pil: 0, all: 0 };
  let bodyHtml = "";

  Object.keys(byMonth)
    .sort()
    .reverse()
    .forEach((ym) => {
      const p = ym.split("-");
      const mTitle = `${MONTHS_FULL.at(Number(p.at(1)) - 1) || p.at(1)} ${p.at(
        0
      )}`;
      const mTot = { b1: 0, b2: 0, b3: 0, b4: 0, b5: 0, pil: 0, all: 0 };

      bodyHtml += `
      <tr class="matrix-month">
        <td colspan="8">📅 ${mTitle}</td>
      </tr>
    `;

      byMonth[ym].forEach((d) => {
        const r = byDate[d];
        const rowSum = r.b1 + r.b2 + r.b3 + r.b4 + r.b5 + r.pil;
        mTot.b1 += r.b1;
        mTot.b2 += r.b2;
        mTot.b3 += r.b3;
        mTot.b4 += r.b4;
        mTot.b5 += r.b5;
        mTot.pil += r.pil;
        mTot.all += rowSum;

        const dp = d.split("-");
        const shortD = `${Number(dp.at(2))}.${dp.at(1)}`;
        bodyHtml += `
        <tr class="matrix-day" onclick="openDateFromMatrix('${d}')" title="Открыть сводку за ${shortD}">
          <td><b class="matrix-date-link">${shortD}</b></td>
          <td>${r.b1 || "-"}</td>
          <td>${r.b2 || "-"}</td>
          <td>${r.b3 || "-"}</td>
          <td>${r.b4 || "-"}</td>
          <td>${r.b5 || "-"}</td>
          <td>${r.pil || "-"}</td>
          <td><b>${rowSum}</b></td>
        </tr>
      `;
      });

      bodyHtml += `
      <tr class="matrix-subtot">
        <td>Итого</td>
        <td>${mTot.b1}</td>
        <td>${mTot.b2}</td>
        <td>${mTot.b3}</td>
        <td>${mTot.b4}</td>
        <td>${mTot.b5}</td>
        <td>${mTot.pil}</td>
        <td>${mTot.all}</td>
      </tr>
    `;

      grandTot.b1 += mTot.b1;
      grandTot.b2 += mTot.b2;
      grandTot.b3 += mTot.b3;
      grandTot.b4 += mTot.b4;
      grandTot.b5 += mTot.b5;
      grandTot.pil += mTot.pil;
      grandTot.all += mTot.all;
    });

  bodyHtml += `
    <tr class="matrix-grandtot">
      <td>ВСЕГО</td>
      <td>${grandTot.b1}</td>
      <td>${grandTot.b2}</td>
      <td>${grandTot.b3}</td>
      <td>${grandTot.b4}</td>
      <td>${grandTot.b5}</td>
      <td>${grandTot.pil}</td>
      <td>${grandTot.all}</td>
    </tr>
  `;

  box.innerHTML = `
    <div class="table-wrap">
      <table class="rep-table matrix-table">
        <thead>
          <tr>
            <th>Дата</th>
            <th>1</th>
            <th>2</th>
            <th>3</th>
            <th>4</th>
            <th>5</th>
            <th>Пыл</th>
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
  (APP_DATA.terminal || []).forEach((t) => {
    if (!t.pending) datesSet.add(t.date);
  });
  (APP_DATA.expenses || []).forEach((e) => {
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
      '<div class="u-muted txt-sm">Пока нет отправленных сборов</div>';
    return;
  }
  sel.innerHTML = sortedDates
    .map((d) => `<option value="${d}">${formatHumanDate(d)} (${d})</option>`)
    .join("");
  renderDateReport();
}

// Отрисовка сводного отчёта по боксам и всем расходам (включая терминал и З/П) за выбранную дату
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

  (APP_DATA.terminal || []).forEach((t) => {
    if (!t.pending && t.date === targetDate) {
      termSum += t.amount;
      expList.push(
        `Терминал: <b>${t.amount} грн</b> ${t.note ? `(${t.note})` : ""}`
      );
    }
  });

  (APP_DATA.expenses || []).forEach((e) => {
    if (!e.pending && e.date === targetDate) {
      matSum += e.amount;
      expList.push(
        `Расход: <b>${e.amount} грн</b> ${e.note ? `(${e.note})` : ""}`
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
    <div class="u-item u-item--compact">
      <span class="u-bold txt-sm">${b}</span>
      <span class="u-bold txt-sm">${boxSums[b]} грн</span>
    </div>
  `
    )
    .join("");

  html += `
    <div class="u-item u-item--sub">
      <span class="u-bold txt-md">Всего с боксов</span>
      <span class="u-heavy txt-lg">${totalBoxes} грн</span>
    </div>
    <div class="u-item u-item--compact u-red">
      <span class="txt-md">Компенсация в кассу</span>
      <span class="u-bold txt-lg">−${totalComp} грн</span>
    </div>
    <div class="u-item u-item--total">
      <span class="u-heavy txt-lg">ОТПРАВЛЕНО ЧИСТЫМИ</span>
      <span class="u-heavy u-green txt-xl">${netSent} грн</span>
    </div>
  `;

  if (expList.length) {
    html += `<div class="u-dashed"><b>Расходы:</b><br>• ${expList.join(
      "<br>• "
    )}</div>`;
  }

  document.getElementById("date-report-box").innerHTML = html;
}
