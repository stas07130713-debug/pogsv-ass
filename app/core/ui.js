/* Помощники интерфейса: DOM, экранирование, иконки, шапка, нижняя навигация, таймер. */
(function (VGSCH) {
  'use strict';

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  /* Метка версии, снятая с ссылки на таблицу стилей в index.html. Приписывается
     к путям картинок: без неё браузер после обновления файла продолжает
     показывать старый снимок из кеша — на file:// особенно упорно. */
  var VER = (function () {
    var link = document.querySelector('link[rel="stylesheet"]');
    var m = link && String(link.getAttribute('href')).match(/\?v=([\w.\-]+)/);
    return m ? '?v=' + m[1] : '';
  })();

  /** Путь к файлу в assets с меткой версии. */
  function asset(path) { return path + VER; }

  /**
   * Отрисовка экрана.
   *
   * Возвращает НОВЫЙ контейнер: обработчики вешаются на него, а не на #app.
   * Иначе делегированные слушатели накапливались бы на постоянном #app, и клики
   * на новом экране перехватывались бы обработчиками предыдущего.
   */
  function paint(app, html) {
    clear(app);
    var view = document.createElement('div');
    view.innerHTML = html;
    app.appendChild(view);
    return view;
  }

  /** Делегирование клика по селектору внутри контейнера экрана. */
  function on(view, selector, handler) {
    view.addEventListener('click', function (e) {
      var t = e.target.closest(selector);
      if (t && view.contains(t)) handler(t, e);
    });
  }

  function clock(totalSeconds) {
    var s = Math.max(0, Math.round(totalSeconds));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function dateTime(d) {
    d = d || new Date();
    var p = function (n) { return String(n).padStart(2, '0'); };
    return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear() +
           ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function countdown(seconds, onTick, onEnd) {
    var left = seconds, id = null, paused = false;
    onTick(left);
    id = setInterval(function () {
      if (paused) return;
      left--;
      onTick(left);
      if (left <= 0) { stop(); onEnd(); }
    }, 1000);
    function stop() { if (id) { clearInterval(id); id = null; } }
    return {
      stop: stop,
      pause: function () { paused = true; },
      resume: function () { paused = false; },
      isPaused: function () { return paused; },
      left: function () { return left; }
    };
  }

  function stopwatch(onTick) {
    var passed = 0, paused = false;
    var id = setInterval(function () { if (!paused) { passed++; if (onTick) onTick(passed); } }, 1000);
    return {
      stop: function () { clearInterval(id); },
      pause: function () { paused = true; },
      resume: function () { paused = false; },
      isPaused: function () { return paused; },
      passed: function () { return passed; }
    };
  }

  var I = {
    tests: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8 8.5h8M8 12h8M8 15.5h5"/></svg>',
    tasks: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h12L11 12l7 8H6"/></svg>',
    exam:  '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 5h2.5a2.5 2.5 0 0 1 0 5H17M7 5H4.5a2.5 2.5 0 0 0 0 5H7"/></svg>',
    home:  '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1v-9.5z"/></svg>',
    back:  '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>',
    menu:  '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    clock: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3.2 2"/></svg>',
    user:  '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/></svg>',
    chev:  '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
    next:  '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    prev:  '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg>',
    cross: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    okCircle:  '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.2"/><path d="M8 12.4l2.8 2.8L16 9.8"/></svg>',
    badCircle: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="9.2"/><path d="M9 9l6 6M15 9l-6 6"/></svg>',
    cup:   '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17.5V21M7 4h10v5.5a5 5 0 0 1-10 0V4z"/><path d="M17 5.5h2.4a2.4 2.4 0 1 1 0 4.8H17M7 5.5H4.6a2.4 2.4 0 1 0 0 4.8H7"/></svg>',
    print: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 9V3.5h11V9M6.5 18H4.5v-6.5h15V18h-2"/><rect x="8" y="14" width="8" height="6.5" rx="1"/></svg>',
    pause: '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><rect x="7" y="5" width="3.6" height="14" rx="1"/><rect x="13.4" y="5" width="3.6" height="14" rx="1"/></svg>',
    play:  '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M8 5.5v13l10-6.5z"/></svg>',
    /* Значок раздела «Тестирование» в нижней панели — столбчатая диаграмма. */
    stats: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 15v4M9.7 10v9M14.3 6v13M19 12v7"/></svg>',
    /* Режим «Изучение» — раскрытая книга. */
    study: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6.5C10.4 5.2 8.3 4.5 5 4.5v13c3.3 0 5.4.7 7 2 1.6-1.3 3.7-2 7-2v-13c-3.3 0-5.4.7-7 2z"/><path d="M12 6.5v12"/></svg>',
    /* Значки окна «Сообщить об ошибке». */
    warn:  '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4.4 2.7 20.2h18.6L12 4.4z"/><path d="M12 10.2v4.3M12 17.5v.1"/></svg>',
    send:  '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3 10.5 13.5"/><path d="M21 3l-6.8 18-3.7-7.5L3 9.8 21 3z"/></svg>',
    copy:  '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5.5 15H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v.5"/></svg>',
    mail:  '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.6 6.5 8.4 6 8.4-6"/></svg>'
  };

  var ACCENT = {
    tests: 'var(--tests)', tasks: 'var(--tasks)', exam: 'var(--exam)',
    study: 'var(--study)', home: 'var(--exam)'
  };
  var ACCENT_BG = {
    tests: 'var(--tests-bg)', tasks: 'var(--tasks-bg)',
    exam: 'var(--exam-bg)', study: 'var(--study-bg)'
  };

  /** Шапка экрана: кнопка возврата, название режима, таймер, кто проходит. */
  function appbar(o) {
    var person = VGSCH.state.data.person;
    return '<div class="appbar" style="--accent:' + (ACCENT[o.mode] || 'var(--text)') + '">' +
      '<button class="nav-btn" data-nav="' + (o.back || 'start') + '" ' +
        'aria-label="Назад">' + (o.backArrow ? I.back : I.menu) + '</button>' +
      '<span class="mode-ic">' + (I[o.mode] || '') + '</span>' +
      '<h2>' + esc(o.title) + '</h2>' +
      '<div class="spacer"></div>' +
      (o.showTimer ? '<div class="timer" id="timer">' + I.clock + '<span>—</span></div>' : '') +
      (person && !o.showTimer
        ? '<div class="who">' + esc(VGSCH.state.data.position || 'Проверяемый') +
          '<b>' + esc(person) + '</b></div>'
        : '') +
      '</div>';
  }

  /** Нижняя панель навигации — четыре основных раздела.
   *
   *  «Ответы по психологии» сюда намеренно не выносятся: длинная подпись ломала
   *  ряд на две строки. Раздел открывается карточкой на главном экране.
   *  Чтобы вернуть его в панель, добавьте сюда
   *  { key: 'study', label: 'Психология', icon: I.study, c: 'var(--study)' }. */
  function tabbar(active) {
    var items = [
      { key: 'start', label: 'Главная', icon: I.home, c: 'var(--exam)' },
      { key: 'tests', label: 'Тесты', icon: I.tests, c: 'var(--tests)' },
      { key: 'tasks', label: 'Задачи', icon: I.tasks, c: 'var(--tasks)' },
      { key: 'exam', label: 'Экзамен', icon: I.stats, c: 'var(--exam)' }
    ];
    return '<nav class="tabbar" style="grid-template-columns:repeat(' + items.length + ',1fr)">' +
      items.map(function (it) {
      return '<button data-nav="' + it.key + '" style="--c:' + it.c + '"' +
        (active === it.key ? ' class="is-active"' : '') + '>' +
        '<span class="ic">' + it.icon + '</span><span>' + it.label + '</span></button>';
    }).join('') + '</nav>';
  }

  function progress(done, total, label, accent) {
    var pct = total ? Math.round(done / total * 100) : 0;
    return '<div class="progress"' + (accent ? ' style="--accent:' + accent + '"' : '') + '>' +
      '<div class="progress-label"><span>' + esc(label) + '</span>' +
      '<span class="num">' + pct + '%</span></div>' +
      '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%"></div></div></div>';
  }

  function bar(pct, accent) {
    return '<div class="progress-track" style="--accent:' + (accent || 'var(--tests)') + '">' +
      '<div class="progress-fill" style="width:' + Math.round(pct) + '%;background:' +
      (accent || 'var(--tests)') + '"></div></div>';
  }

  function donut(percent, caption, tone) {
    var r = 70, c = 2 * Math.PI * r;
    var p = Math.max(0, Math.min(100, percent));
    var off = c * (1 - p / 100);
    var cls = tone === 'part' ? ' is-part' : (p < 60 ? ' is-bad' : '');
    return '<svg class="donut" viewBox="0 0 176 176">' +
      '<circle class="donut-track" cx="88" cy="88" r="' + r + '" fill="none" stroke-width="14"/>' +
      '<circle class="donut-fill' + cls + '" cx="88" cy="88" r="' + r + '" fill="none" stroke-width="14" ' +
        'stroke-dasharray="' + c + '" stroke-dashoffset="' + off + '" transform="rotate(-90 88 88)"/>' +
      '<text class="donut-text" x="88" y="' + (caption ? 84 : 88) + '" text-anchor="middle" ' +
        'dominant-baseline="central">' + Math.round(p) + '%</text>' +
      (caption ? '<text class="donut-sub" x="88" y="110" text-anchor="middle">' + esc(caption) + '</text>' : '') +
      '</svg>';
  }

  /** Подключает единый обработчик навигации ко всем кнопкам data-nav. */
  function wireNav(root, confirmLeave) {
    on(root, '[data-nav]', function (b) {
      var target = b.dataset.nav;
      if (confirmLeave && !confirmLeave(target)) return;
      VGSCH.router.go(target);
    });
  }

  VGSCH.ui = {
    esc: esc, clear: clear, on: on, paint: paint, asset: asset,
    clock: clock, dateTime: dateTime,
    countdown: countdown, stopwatch: stopwatch,
    I: I, ACCENT: ACCENT, ACCENT_BG: ACCENT_BG,
    appbar: appbar, tabbar: tabbar, progress: progress, bar: bar, donut: donut,
    wireNav: wireNav
  };
})(window.VGSCH = window.VGSCH || {});
