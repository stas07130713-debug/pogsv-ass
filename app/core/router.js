/* Переключение экранов.
 *
 * Четыре основных экрана — start, tests, tasks, exam. Остальное (разбор
 * ответа, пошаговое решение, итог, протокол) — состояния внутри них.
 */
(function (VGSCH) {
  'use strict';

  var screens = {};
  var root = null;
  var current = null;

  function register(name, screen) { screens[name] = screen; }

  function go(name, params) {
    var screen = screens[name];
    if (!screen) throw new Error('Экран «' + name + '» не зарегистрирован');

    if (current && current.destroy) current.destroy();
    VGSCH.ui.clear(root);

    /* Экран запоминается на контейнере и на body: по нему стили выбирают
       фоновый снимок и убирают нижний отступ там, где панели навигации нет. */
    root.dataset.screen = name;
    document.body.dataset.screen = name;

    current = screen;
    screen.render(root, params || {});
    window.scrollTo(0, 0);
  }

  function start(rootEl) {
    root = rootEl;
    go('start');
  }

  VGSCH.router = { register: register, go: go, start: start };
})(window.VGSCH = window.VGSCH || {});
