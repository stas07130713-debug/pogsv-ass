/* Экран 1. Главный: фамилия и инициалы, номер отделения, должность, выбор режима. */
(function (VGSCH) {
  'use strict';

  var ui = VGSCH.ui;
  var cfg = VGSCH.config;

  /* ------------------------------------------- установка на телефон ------ */

  /* Событие установки перехватывается в index.html — самым первым скриптом,
     до загрузки всех остальных. Браузер выдаёт его один раз и очень рано;
     подписка отсюда срабатывала уже после того, как событие улетело, и кнопка
     всегда отвечала «браузер не даёт установить». Здесь только забираем
     готовый результат. */
  var install = window.VGSCH.install || (window.VGSCH.install = { event: null });
  var repaint = null;   // перерисовать главный экран, когда событие придёт

  install.onEvent = function () { if (repaint) repaint(); };

  /** Приложение уже открыто как установленное — кнопка не нужна. */
  function installed() {
    return install.installed === true ||
           (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
           navigator.standalone === true;
  }

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }

  /* Предложение показывается один раз за сеанс: отказался — больше не лезем. */
  var offerHidden = false;

  /** Полоса-предложение вверху главного экрана. */
  function installOffer() {
    if (installed() || offerHidden || !install.event) return '';
    return '<div class="install-offer">' +
      '<span class="ic">' + ui.I.install + '</span>' +
      '<span class="tx"><b>Поставить значок на рабочий стол?</b>' +
        '<span>Открывается как обычное приложение и работает без связи</span></span>' +
      '<span class="go">' +
        '<button class="primary" data-act="install" type="button">Поставить</button>' +
        '<button data-act="install-later" type="button">Позже</button>' +
      '</span></div>';
  }

  /** Ряд внизу: установка значка и QR-код для передачи ссылки товарищам. */
  function bottomRow() {
    return '<div class="start-actions">' +
      (installed() ? '' :
        '<button class="mini-btn" data-act="install" type="button">' +
          '<span class="ic">' + ui.I.install + '</span>' +
          '<span class="tx">Значок на рабочий стол</span></button>') +
      '<button class="mini-btn" data-act="qr" type="button">' +
        '<span class="ic">' + ui.I.qr + '</span>' +
        '<span class="tx">Поделиться приложением</span></button>' +
    '</div>';
  }

  /** Окно с QR-кодом: навёл камеру — приложение открылось. */
  function showQr() {
    var link = location.origin + location.pathname;
    var o = document.createElement('div');
    o.className = 'modal-overlay';
    o.innerHTML =
      '<div class="modal modal-qr" role="dialog" aria-modal="true">' +
        '<div class="modal-head">' +
          '<h3>Поделиться приложением</h3>' +
          '<button class="modal-x" data-act="close" aria-label="Закрыть">' + ui.I.cross + '</button>' +
        '</div>' +
        '<div class="modal-body qr-body">' +
          '<img class="qr-img" src="' + ui.asset('assets/img/qr.png') + '" alt="QR-код приложения">' +
          '<p class="muted">Наведите камеру телефона — приложение откроется сразу. ' +
            'Код можно показать с экрана или переслать снимком.</p>' +
          '<div class="qr-link">' + ui.esc(link) + '</div>' +
        '</div>' +
        '<div class="modal-foot">' +
          '<button class="btn-quiet" data-act="close">Закрыть</button>' +
          '<div class="spacer"></div>' +
          '<button class="btn-ghost" data-act="copy-link">' + ui.I.copy + 'Скопировать ссылку</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(o);
    document.body.classList.add('is-modal');

    o.addEventListener('click', function (e) {
      if (e.target === o) { closeQr(); return; }
      var b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'close') { closeQr(); return; }
      if (b.dataset.act === 'copy-link') {
        var done = function (ok) {
          b.textContent = ok ? 'Ссылка скопирована' : 'Скопируйте ссылку вручную';
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(link).then(function () { done(true); }, function () { done(false); });
        } else { done(false); }
      }
    });
  }

  function closeQr() {
    var o = document.querySelector('.modal-overlay');
    if (o) o.remove();
    document.body.classList.remove('is-modal');
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
    if (install.event) {
      install.event.prompt();
      install.event.userChoice.then(function (res) {
        /* Отказ не сбрасываем: браузер разрешает предложить ещё раз в этом же
           сеансе, и кнопка должна остаться рабочей. */
        if (!res || res.outcome === 'accepted') install.event = null;
        if (repaint) repaint();
      });
      return;
    }

    if (isIOS()) {
      hint(view, 'На iPhone значок ставится вручную: кнопка «Поделиться» внизу экрана → ' +
                 '«На экран „Домой“» → «Добавить». Другого пути Apple не даёт.');
      return;
    }

    /* Предложения не было. Вместо общей отговорки проверяем условия,
       которые браузер предъявляет к установке, и называем то, что не сошлось.
       Так следующий разговор начинается с факта, а не с догадок. */
    diagnose().then(function (d) { hint(view, notReadyText(d)); });
  }

  /** Проверка условий установки: манифест, значки, служебный поток, адрес. */
  function diagnose() {
    var d = {
      https: location.protocol === 'https:' || location.hostname === 'localhost',
      worker: false, manifest: false, icons: false, standalone: installed(), related: false
    };
    var steps = [];

    steps.push(fetch('manifest.webmanifest?v=' + VGSCH.config.version)
      .then(function (r) { return r.json(); })
      .then(function (m) {
        d.manifest = !!(m && m.name && m.start_url && m.display);
        d.icons = !!(m && m.icons && m.icons.some(function (i) {
          return /png|webp|svg/.test(i.type || '') && parseInt(i.sizes, 10) >= 192;
        }));
      }).catch(function () {}));

    if (navigator.serviceWorker) {
      steps.push(navigator.serviceWorker.getRegistration()
        .then(function (reg) { d.worker = !!(reg && reg.active); })
        .catch(function () {}));
    }
    if (navigator.getInstalledRelatedApps) {
      steps.push(navigator.getInstalledRelatedApps()
        .then(function (a) { d.related = !!(a && a.length); })
        .catch(function () {}));
    }
    return Promise.all(steps).then(function () { return d; });
  }

  function notReadyText(d) {
    if (d.standalone || d.related) {
      return 'Приложение уже установлено — значок есть на рабочем столе. ' +
             'Если не находите, поищите «ПОГСВ АСС» в списке приложений телефона.';
    }
    var bad = [];
    if (!d.https) bad.push('страница открыта не по защищённой ссылке (https)');
    if (!d.manifest) bad.push('не читается описание приложения');
    if (!d.icons) bad.push('нет значка нужного формата');
    if (!d.worker) bad.push('не запустился служебный поток — обновите страницу');
    if (bad.length) return 'Установка недоступна: ' + bad.join('; ') + '.';

    return 'Все условия выполнены, но браузер ещё не предложил установку — ' +
           'он делает это не сразу. Поставьте вручную: меню «⋮» → ' +
           '«Установить приложение» (в Яндекс.Браузере — «Добавить на главный экран»). ' +
           'Либо откройте приложение ещё раз через минуту.';
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
               они нужны только для протокола. Для тренировки в «Вопросах»
               и «Задачах» набирать их каждый раз заново незачем. */
          '</div>' +

          '<div class="pick-label">Выберите режим работы:</div>' +
          '<div class="modes">' +
            modeCard('tests', ui.I.tests, 'Вопросы', 'для аттестации<br>взвода', readyQuestions > 0) +
            modeCard('tasks', ui.I.tasks, 'Задачи', 'Расчётные<br>задачи', readyTypes > 0) +
            /* Психология переехала в список разделов внутри «Вопросов»:
               на главной её место заняли тесты по билетам ВГК. */
            modeCard('vgk', ui.I.study, 'Тесты',
                     'для аттестации<br>спасателей на ГСР', vgkCount > 0) +
            /* Экзамен идёт последним: сначала тренировка, потом проверка.
               Если он уже сдан в этом сеансе, карточка ведёт к его итогам,
               а не к новому подходу — об этом и подпись. */
            modeCard('exam', ui.I.cup, 'Экзамен',
                     VGSCH.state.lastExam()
                       ? 'Результат<br>сохранён'
                       : 'Аттестация взвода<br>и спасателей ГСР',
                     examPossible) +
          '</div>' +

          bottomRow() +
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
    ui.on(v, '[data-act="qr"]', function () { showQr(); });
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
