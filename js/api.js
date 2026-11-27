let APP_DATA = null;

let secretKey = localStorage.getItem("app_pass");
if (!secretKey) {
  secretKey = prompt("Введите ваш ключ доступа:");
  if (secretKey) localStorage.setItem("app_pass", secretKey);
}

// Получение текущей даты в формате YYYY-MM-DD
function getLocalToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

// Форматирование даты YYYY-MM-DD в человекочитаемый вид ("27 Ноября")
function formatHumanDate(isoDate) {
  const parts = isoDate.split("-");
  return `${Number(parts.at(2))} ${
    MONTHS_RU.at(Number(parts.at(1)) - 1) || ""
  }`;
}

// Выход из аккаунта и очистка сохранённого ключа
function logout() {
  localStorage.removeItem("app_pass");
  location.reload();
}

// Отправка POST-запроса на сервер Google Apps Script
async function apiPost(payload) {
  const res = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({ key: secretKey, ...payload }),
  });
  return res.json();
}

// Смена пароля текущего пользователя
async function changePassword() {
  const newPass = prompt("Введите новый пароль (минимум 3 символа):");
  if (!newPass) return;
  document.getElementById("loader").style.display = "block";
  try {
    const data = await apiPost({
      action: "change_pass",
      newPass: newPass.trim(),
    });
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

// Параллельная загрузка всех HTML-шаблонов из папки views/
async function loadViews() {
  const parts = Array.of(
    ["slot-schedule", "views/schedule.html"],
    ["slot-cash", "views/cash.html"],
    ["slot-salary", "views/salary.html"],
    ["slot-admin", "views/admin.html"],
    ["slot-notes", "views/notes.html"],
    ["slot-modals", "views/modals.html"]
  );
  await Promise.all(
    parts.map(async ([slotId, url]) => {
      const res = await fetch(url);
      document.getElementById(slotId).innerHTML = await res.text();
    })
  );
}

// Загрузка актуальных данных из Google Таблицы и запуск отрисовки интерфейса
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
    alert("Ошибка: " + e.message);
  }
  document.getElementById("loader").style.display = "none";
}
