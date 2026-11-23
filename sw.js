const CACHE_NAME = "smeny-kassa-v4";

// Полный список всех файлов приложения, которые сохраняются в кэш телефона
const ASSETS = Array.of(
  "./",
  "./index.html",
  "./style.css",
  "./config.js",
  "./manifest.json",
  "./views/cash.html",
  "./views/salary.html",
  "./views/admin.html",
  "./views/modals.html",
  "./js/api.js",
  "./js/schedule.js",
  "./js/cash.js",
  "./js/salary.js",
  "./views/notes.html",
  "./js/notes.js",
  "./js/main.js"
);

// Установка нового Service Worker и сохранение свежих файлов в кэш
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Активация новой версии и автоматическое удаление старого устаревшего кэша
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
  );
  self.clients.claim();
});

// Перехват сетевых запросов: сначала пробуем загрузить свежий файл из интернета, при обрыве сети берём из кэша
self.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    event.request.url.includes("://google.com")
  ) {
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const resClone = res.clone();
        caches
          .open(CACHE_NAME)
          .then((cache) => cache.put(event.request, resClone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
