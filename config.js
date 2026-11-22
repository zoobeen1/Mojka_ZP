const API_URL =
  "https://script.google.com/macros/s/AKfycbwoiLFR1V6EYyF06lTTGbwyWSwMDQE4dqaR9eALQA9nJ_0UufdP2-53RcEhPAk5Cs79/exec";
const DAYS_SHORT = [
  "",
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Субота",
  "Воскресение",
];
const MONTHS_RU = [
  "января",
  "февраля",
  "мартя",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];
const CASH_BOXES = [
  "Бокс 1",
  "Бокс 2",
  "Бокс 3",
  "Бокс 4",
  "Бокс 5",
  "Пилосос",
];

const DENOMS = Array.of(10, 20, 50, 100, 200, 500, 1000);
const CASH_BASE = 4500;

const PERM_LABELS = {
  edit_plan: "Менять план смен",
  edit_done: "Править закрытые смены",
  view_fin: "Видеть ЗП и долги",
  add_pay: "Вносить выплаты ЗП",
  view_cash: "Видеть кассу и боксы",
  add_cash: "Вносить сбор и расходы",
};
