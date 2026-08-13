/* Экран 1. Главный: фамилия и инициалы, номер отделения, должность, выбор режима. */
(function (VGSCH) {
  'use strict';

  var ui = VGSCH.ui;
  var cfg = VGSCH.config;

  /* ------------------------------------------- установка на телефон ------ */

  /* Браузер сам решает, когда предложить установку, и на Android делает это
     не всегда: пункт «Установить приложение» прячется в меню «⋮», а всплывашка
     появляется далеко не при первом заходе. Поэтому перехватываем событие
     и показываем свою кнопку — нажатие вызывает то же системное окно. */
  var installEvent = null;
  var repaint = null;   // перерисовать главный экран, когда событие придёт

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    installEvent = e;
    if (repaint) repaint();
  });

  window.addEventListener('appinstalled', function () {
    installEvent = null;
    if (repaint) repaint();
  });

  /** Приложение уже открыто как установленное — кнопка не нужна. */
  function installed() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
           navigator.standalone === true;
  }

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }

  /* Предложение показывается один раз за сеанс: отказался — больше не лезем. */
  var offerHidden = false;

  /** Полоса-предложение вверху главного экрана. */
  function installOffer() {
    if (installed() || offerHidden || !installEvent) return '';
    return '<div class="install-offer">' +
      '<span class="ic">' + ui.I.install + '</span>' +
      '<span class="tx"><b>Поставить значок на рабочий стол?</b>' +
        '<span>Открывается как обычное приложение и работает без связи</span></span>' +
      '<span class="go">' +
        '<button class="primary" data-act="install" type="button">Поставить</button>' +
        '<button data-act="install-later" type="button">Позже</button>' +
      '</span></div>';
  }

  /** Кнопка внизу — на случай, если предложение закрыли. */
  function installButton() {
    if (installed()) return '';
    return '<button class="install-btn" data-act="install" type="button">' +
      '<span class="ic">' + ui.I.install + '</span>' +
      '<span class="tx"><b>Значок на рабочий стол</b>' +
      '<span>Запуск как у обычного приложения, работа без связи</span></span></button>';
  }

  /**
   * Установка. На Android и в настольных Chrome, Edge, Яндекс.Браузере
   * выполняется сама: браузер показывает своё окно подтверждения, больше
   * ничего нажимать не нужно.
   *
   * На iPhone установить программно нельзя — Apple не даёт для этого никакой
   * возможности, значок ставится только вручную через меню «Поделиться».
   * Поэтому там (и только там) остаётся короткая подсказка.
   */
  function doInstall(view) {
    if (installEvent) {
      installEvent.prompt();
      installEvent.userChoice.then(function () {
        installEvent = null;
        if (repaint) repaint();
      });
      return;
    }
    hint(view, isIOS()
      ? 'На iPhone значок ставится вручную: кнопка «Поделиться» внизу экрана → ' +
        '«На экран „Домой“» → «Добавить». Другого пути Apple не даёт.'
      : 'Браузер пока не даёт установить приложение. Обычно достаточно ' +
        'открыть его ещё раз через минуту. Если не поможет — в меню браузера ' +
        'есть пункт «Установить приложение».');
  }

  function hint(view, text) {
    var box = view.querySelector('#installHint');
    if (!box) return;
    box.innerHTML = '<div class="notice install-hint">' + ui.esc(text) + '</div>';
  }

  function render(root) {
    var Q = VGSCH.data.questions;
    var T = VGSCH.data.taskTypes;
    var st = VGSCH.state.data;

    /* Списки открываются на нейтральном значении, и то же значение сразу
       лежит в состоянии: что человек видит в поле, то и попадёт в протокол. */
    if (!st.unit) VGSCH.state.setUnit(cfg.unitDefault);
    if (!st.position) VGSCH.state.setPosition(cfg.positionDefault);

    var readyQuestions = Q.ready().length;
    var readyTypes = T.enabled().filter(function (t) {
      return VGSCH.engine.generator.BUILDERS[t.id];
    }).length;
    var examPossible = readyQuestions >= cfg.exam.questionCount && readyTypes > 0;
    var vgkCount = VGSCH.data.vgk.ready().length;

    var v = ui.paint(root,
      '<div class="start">' +
        /* Снимок выработки со спасателем — целиком, отдельной фигуры поверх нет.
           Вуаль притеняет только левую часть, где лежат заголовок и поля. */
        '<div class="start-bg"></div>' +
        '<div class="start-veil"></div>' +
        '<div class="start-inner">' +

          installOffer() +

          '<div class="start-head">' +
            '<div class="brand"><img src="' + ui.asset('assets/img/logo.png') + '" alt="Норникель"></div>' +

            '<h1>Подготовка<br>горноспасателей' +
              '<span class="unit">' + ui.esc(cfg.unitName) + '</span></h1>' +
            '<p class="lead">Учебно-тренировочное приложение для подготовки к аттестации ' +
              'и проверки знаний горноспасателей.</p>' +

            /* Фамилия, отделение и должность спрашиваются в «Экзамене»:
               они нужны только для протокола. Для тренировки в «Тестах»
               и «Задачах» набирать их каждый раз заново незачем. */
            (st.person
              ? '<p class="lead who-line">Вы вошли как <b>' + ui.esc(st.person) + '</b>' +
                (st.unit ? ', отделение ' + ui.esc(st.unit) : '') + '.</p>'
              : '') +
          '</div>' +

          '<div class="pick-label">Выберите режим работы:</div>' +
          '<div class="modes">' +
            modeCard('tests', ui.I.tests, 'Вопросы', 'для аттестации<br>взвода', readyQuestions > 0) +
            modeCard('tasks', ui.I.tasks, 'Задачи', 'Расчётные<br>задачи', readyTypes > 0) +
            /* Если экзамен уже сдан в этом сеансе, карточка ведёт к его итогам,
               а не к новому подходу — об этом и подпись. */
            modeCard('exam', ui.I.cup, 'Экзамен',
                     VGSCH.state.lastExam()
                       ? 'Результат<br>сохранён'
                       : 'Аттестация взвода<br>и спасателей ГСР',
                     examPossible) +
            /* Психология переехала в список разделов внутри «Вопросов»:
               на главной её место заняли тесты по билетам ВГК. */
            modeCard('vgk', ui.I.study, 'Тесты',
                     'для аттестации<br>спасателей на ГСР', vgkCount > 0) +
          '</div>' +

          installButton() +
          '<div id="installHint"></div>' +

          '<div class="start-foot">' +
            '<span>Версия ' + ui.esc(cfg.version) + '</span>' +
            '<span>Работает без интернета</span>' +
          '</div>' +
        '</div>' +
      '</div>' +

      (Q.draftCount()
        ? '<div class="notice">В банке ' + Q.draftCount() + ' из ' + Q.total() + ' вопросов пока ' +
          'без вариантов ответа — они не показываются. Готовы к работе ' + readyQuestions + '.</div>'
        : ''));
    /* Нижняя панель на главном экране не нужна: карточки режимов ведут туда же. */

    /* Проверки на заполненность здесь больше нет: в тесты и задачи пускаем
       сразу. Фамилию спросит экран «Экзамен» — там она и нужна. */
    ui.on(v, '.mode-card', function (btn) {
      VGSCH.router.go(btn.dataset.mode);
    });

    ui.on(v, '[data-act="install"]', function () { doInstall(v); });
    ui.on(v, '[data-act="install-later"]', function () { offerHidden = true; render(root); });

    /* Событие от браузера приходит с задержкой и уже после отрисовки —
       тогда экран перерисовывается, чтобы кнопка появилась. */
    repaint = function () {
      if (VGSCH.router.currentName() === 'start') render(root);
    };
  }

  /* Подпись поля — отдельный слой поверх, не перехватывающий клики,
     а само поле занимает всю площадь рамки. Иначе часть рамки не кликается,
     и выпадающий список открывается не с первого раза. */
  function fieldText(id, label, placeholder, value) {
    return '<div class="field"><div class="field-box">' +
      '<span class="cap">' + ui.esc(label) + '</span>' +
      '<input type="text" id="' + id + '" autocomplete="off" spellcheck="false" maxlength="60" ' +
        'aria-label="' + ui.esc(label) + '" ' +
        'placeholder="' + ui.esc(placeholder) + '" value="' + ui.esc(value) + '">' +
      '</div></div>';
  }

  /* Пустого пункта с прочерком в списке нет: роль «не указано» играют
     обычные значения «нет» и «Другая должность». Пока человек ничего
     не выбрал, показывается именно такое значение — то же, что уйдёт
     в протокол. Расхождения между показанным и записанным не возникает. */
  function fieldSelect(id, label, options, value) {
    var current = value || '';
    return '<div class="field"><div class="field-box is-select">' +
      '<span class="cap">' + ui.esc(label) + '</span>' +
      '<select id="' + id + '" aria-label="' + ui.esc(label) + '">' +
        options.map(function (o) {
          return '<option' + (o === current ? ' selected' : '') + '>' + ui.esc(o) + '</option>';
        }).join('') +
      '</select>' +
      '<span class="ic">' + ui.I.chev + '</span>' +
      '</div></div>';
  }

  function modeCard(mode, icon, title, desc, enabled) {
    return '<button class="mode-card" data-mode="' + mode + '" ' +
      'style="--c:' + ui.ACCENT[mode] + ';--c-bg:' + ui.ACCENT_BG[mode] + '"' +
      (enabled ? '' : ' disabled') + '>' +
      '<span class="ic">' + icon + '</span>' +
      '<span class="nm">' + ui.esc(title) + '</span>' +
      '<span class="ds">' + desc + '</span>' +
      '</button>';
  }

  VGSCH.router.register('start', { render: render });
})(window.VGSCH = window.VGSCH || {});
