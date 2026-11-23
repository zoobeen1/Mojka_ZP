let APP_DATA = null;

let secretKey = localStorage.getItem("app_pass");
if (!secretKey) {
  secretKey = prompt("Введите ваш ключ доступа:");
  if (secretKey) localStorage.setItem("app_pass", secretKey);
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

function logout() {
  localStorage.removeItem("app_pass");
  location.reload();
}

async function apiPost(payload) {
  const res = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({ key: secretKey, ...payload }),
  });
  return res.json();
}

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

async function loadViews() {
  const parts = Array.of(
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
