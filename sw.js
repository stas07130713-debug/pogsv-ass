/* Служебный поток: приложение открывается без связи.
 *
 * После первого открытия по ссылке все файлы лежат в хранилище браузера,
 * и дальше приложение запускается под землёй, в самолёте и где угодно ещё.
 *
 * Версия не дублируется вручную: она приходит меткой ?v= в адресе самого
 * этого файла из index.html. Поднимаете версию там — браузер видит новый
 * адрес, ставит новый служебный поток, старое хранилище удаляется.
 *
 * Работает только по https (и на localhost). При открытии файла прямо с диска
 * браузер служебные потоки не разрешает — там приложение и так офлайн.
 */
'use strict';

var VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
var CACHE = 'pogsv-' + VERSION;

/* Файлы, которые нужны на экранах, куда пользователь может и не зайти
   в первый раз: фоны режимов и снимки в рамке ответа. Остальное попадает
   в хранилище само, когда страница его запрашивает. */
var PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/styles.css',
  './assets/img/bg-start.jpg',
  './assets/img/bg-start-mobile.jpg',
  './assets/img/bg-tests.jpg',
  './assets/img/bg-tasks.jpg',
  './assets/img/bg-exam.jpg',
  './assets/img/logo.png',
  './assets/img/rescuer-ok.png',
  './assets/img/rescuer-wrong.png',
  './assets/img/report-rescuer.png',
  './assets/img/icon-192.png',
  './assets/img/icon-512.jpg',
  './assets/img/icon-maskable.jpg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      /* Одна недоступная мелочь не должна срывать установку целиком,
         поэтому кладём файлы по одному и молча пропускаем неудачи. */
      .then(function (cache) {
        return Promise.all(PRECACHE.map(function (url) {
          return cache.add(new Request(url, { cache: 'reload' })).catch(function () {});
        }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (names) {
        return Promise.all(names.map(function (n) {
          return (n !== CACHE && n.indexOf('pogsv-') === 0) ? caches.delete(n) : null;
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // Google Форма идёт мимо

  /* Открытие страницы: сначала сеть, чтобы обновление доходило сразу;
     нет связи — отдаём сохранённую копию. */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
          return res;
        })
        .catch(function () {
          return caches.match('./index.html', { ignoreSearch: true });
        })
    );
    return;
  }

  /* Остальное — сначала хранилище: файлы неизменны в пределах версии.
     ignoreSearch нужен из-за метки ?v=: в хранилище лежит чистый путь. */
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
