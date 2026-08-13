/* Переключение экранов.
 *
 * Четыре основных экрана — start, tests, tasks, exam. Остальное (разбор
 * ответа, пошаговое решение, итог, протокол) — состояния внутри них.
 *
 * Роутер ведёт историю переходов, поэтому стрелка «назад» возвращает туда,
 * откуда пришли, а не на главную. Раньше кнопка была жёстко привязана
 * к стартовому экрану: после экзамена, зайдя в разбор слабой темы, человек
 * нажимал «назад» и оказывался на главной, теряя итоги из виду.
 */
(function (VGSCH) {
  'use strict';

  var screens = {};
  var root = null;
  var current = null;

  /* Стек посещённых экранов: {name, params}. Текущий экран в стек не входит —
     он лежит в current/currentName, а в стеке только то, куда можно вернуться. */
  var history = [];
  var currentName = null;
  var currentParams = null;

  var MAX_HISTORY = 40;   // защита от бесконечного роста за долгий сеанс

  function register(name, screen) { screens[name] = screen; }

  /**
   * Открыть экран.
   * @param opts.replace  не запоминать текущий экран в истории. Нужно там,
   *        где экран сменяется «вбок» и возвращаться к прежнему бессмысленно.
   */
  function go(name, params, opts) {
    var screen = screens[name];
    if (!screen) throw new Error('Экран «' + name + '» не зарегистрирован');

    var replace = opts && opts.replace;
    if (currentName && !replace) {
      /* Повторный переход на тот же экран историю не копит. */
      if (history.length === 0 || history[history.length - 1].name !== currentName) {
        history.push({ name: currentName, params: currentParams });
        if (history.length > MAX_HISTORY) history.shift();
        pushHistoryEntry();
      }
    }
    show(name, params);
  }

  /**
   * Вернуться на предыдущий экран.
   * @return false, если возвращаться некуда — вызывающий сам решает,
   *         уйти ли на главную.
   */
  /* Экран может перехватить «назад» на себя: внутри режима бывают свои
     состояния — выбор раздела, вопрос, разбор, решение по шагам, — и с них
     возвращаться нужно к предыдущему состоянию, а не в другой режим.
     Обработчик живёт до следующей отрисовки: show() его сбрасывает,
     и каждый экран ставит свой заново. */
  var backHandler = null;

  function setBackHandler(fn) { backHandler = fn || null; }

  function back() {
    if (backHandler && backHandler() === true) return true;
    if (!history.length) return false;
    /* Отдаём шаг браузеру: он сам вызовет popstate, а тот снимет экран
       с нашей истории. Так экранная стрелка и системная кнопка «назад»
       ходят по одному и тому же списку и не расходятся. */
    if (window.history && window.history.pushState) {
      window.history.back();
    } else {
      var prev = history.pop();
      show(prev.name, prev.params);
    }
    return true;
  }

  /** Есть ли куда возвращаться — по этому признаку рисуется стрелка. */
  function canBack() { return history.length > 0; }

  /* Экраны отмечаются в истории браузера, чтобы системная кнопка «назад»
     на телефоне листала экраны приложения, а не закрывала его целиком.
     Раньше нажатие «назад» на протоколе выбрасывало из приложения, и весь
     сеанс — фамилия, итоги экзамена — терялся.
     Адрес при этом не меняется: приложение живёт по одному адресу, а на
     GitHub Pages лежит в подпапке, и выдуманные пути отдавали бы 404. */
  var ignorePop = false;

  function pushHistoryEntry() {
    if (!window.history || !window.history.pushState) return;
    try {
      window.history.pushState({ vgsch: true, depth: history.length }, '', location.href);
    } catch (e) { /* приватный режим или file:// — навигация просто останется внутренней */ }
  }

  function onPopState() {
    if (ignorePop) { ignorePop = false; return; }

    /* Системная кнопка «назад» подчиняется тем же правилам, что и стрелка
       в шапке. Если экран разобрался сам, отметку в истории браузера
       возвращаем на место — иначе следующее нажатие уведёт на два шага. */
    if (backHandler && backHandler() === true) { pushHistoryEntry(); return; }

    /* Шаг назад в браузере = шаг назад по нашей истории. Если возвращаться
       некуда, отдаём управление браузеру: следующее нажатие закроет вкладку. */
    var prev = history.pop();
    if (prev) show(prev.name, prev.params);
  }

  function show(name, params) {
    if (current && current.destroy) current.destroy();
    backHandler = null;
    VGSCH.ui.clear(root);

    /* Экран запоминается на контейнере и на body: по нему стили выбирают
       фоновый снимок и убирают нижний отступ там, где панели навигации нет. */
    root.dataset.screen = name;
    document.body.dataset.screen = name;

    current = screens[name];
    currentName = name;
    currentParams = params || {};
    current.render(root, currentParams);
    window.scrollTo(0, 0);
  }

  function start(rootEl) {
    root = rootEl;
    history = [];
    window.addEventListener('popstate', onPopState);
    go('start');
  }

  VGSCH.router = {
    register: register,
    go: go,
    back: back,
    canBack: canBack,
    setBackHandler: setBackHandler,
    start: start,
    /** Имя открытого экрана — экранам нужно понимать, откуда их позвали. */
    currentName: function () { return currentName; }
  };
})(window.VGSCH = window.VGSCH || {});
