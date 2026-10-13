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

/* Обязательный минимум — только то, без чего не открыть первый экран.
 *
 * Раньше сюда входили все фоны и снимки, почти два мегабайта, и установка
 * потока тянула их одновременно с самой страницей: первое открытие заметно
 * подвисало. Всё остальное — фоны других режимов, снимки в рамке ответа,
 * значки — попадает в хранилище само, когда страница их запросит.
 * Офлайн от этого не страдает: к моменту, когда человек уйдёт под землю,
 * он уже пройдёт по экранам и файлы осядут. */
var PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/styles.css',
  './assets/img/bg-start.jpg',
  './assets/img/bg-start-mobile.jpg',
  './assets/img/logo.png',
  './assets/img/favicon.png'
];

/* Остальное подтягивается фоном, без спешки — уже после того, как страница
   отрисовалась. Пользователь этого не ждёт. */
var LAZY = [
  './assets/img/bg-tests.jpg',
  './assets/img/bg-tasks.jpg',
  './assets/img/bg-exam.jpg',
  './assets/img/rescuer-ok.jpg',
  './assets/img/rescuer-wrong.jpg',
  './assets/img/report-rescuer.jpg',
  './assets/img/qr.png',
  './assets/img/icon-192.png',
  './assets/img/icon-512.png',
  './assets/img/icon-maskable.png'
];

/* Путь с меткой версии — ровно в том виде, в каком его запросит страница.
   Страница подставляет ?v= ко всем ссылкам, и в хранилище должно лежать
   то же самое: иначе запрос новой версии не найдёт заготовленный файл. */
function versioned(url) {
  if (url === './' || url === './index.html') return url;   // страница идёт без метки
  return url + (url.indexOf('?') === -1 ? '?v=' + VERSION : '');
}

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      /* Одна недоступная мелочь не должна срывать установку целиком,
         поэтому кладём файлы по одному и молча пропускаем неудачи. */
      .then(function (cache) {
        return Promise.all(PRECACHE.map(function (url) {
          return cache.add(new Request(versioned(url), { cache: 'reload' })).catch(function () {});
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
      /* Дозагрузка остального — уже после активации и НЕ внутри waitUntil:
         поток к этому моменту работает, страница отрисована, и скачивание
         никого не задерживает. */
      .then(function () {
        caches.open(CACHE).then(function (cache) {
          LAZY.reduce(function (chain, url) {
            return chain.then(function () {
              return cache.match(versioned(url)).then(function (hit) {
                if (hit) return null;
                return cache.add(new Request(versioned(url))).catch(function () {});
              });
            });
          }, Promise.resolve());
        });
      })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // Google Форма идёт мимо

  /* Открытие страницы: сначала сеть, чтобы обновление доходило сразу;
     нет связи — отдаём сохранённую копию.
     cache: 'reload' обязателен. Обычный fetch спрашивает сеть не всегда:
     сайт отдаёт страницу с max-age=600, и браузер вправе десять минут
     возвращать свою копию, не выходя наружу. Тогда обновление не доходит
     ни до потока, ни до человека. С 'reload' запрос идёт в сеть всегда,
     а копия в браузере заодно обновляется. */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(new Request(req.url, { cache: 'reload', credentials: 'same-origin' }))
        .then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
          return res;
        })
        .catch(function () {
          return caches.match('./index.html');
        })
    );
    return;
  }

  /* Остальное — сначала хранилище, но совпадение ТОЧНОЕ, вместе с меткой ?v=.
   *
   * Здесь была ошибка, из-за которой обновления не доходили. Стояло
   * ignoreSearch: true — поиск без учёта строки запроса. Метка версии при
   * этом переставала что-либо значить: на запрос ui.js?v=1.9.2 хранилище
   * отдавало сохранённый ui.js?v=1.8.1. Страница приходила новая, а скрипты
   * оставались старыми, и приложение вело себя по-прежнему.
   *
   * С точным совпадением новая версия — это всегда промах хранилища,
   * файл берётся из сети и кладётся уже под новым адресом. */
  /* Проверочные запросы сторожа версии (cache: 'no-store') идут мимо
     хранилища в обе стороны: у них одноразовый адрес с меткой времени,
     и складывать их — значит копить мусор по копии на каждый запуск. */
  if (req.cache === 'no-store') return;

  e.respondWith(
    caches.match(req).then(function (hit) {
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
