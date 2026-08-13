/* Экран 2. Режим «Тесты» — макеты 02 и 05.
 *
 * Тренировка: после ответа сразу видно верно или неверно и на каком пункте НПА
 * это основано. Таймера нет.
 */
(function (VGSCH) {
  'use strict';

  var ui = VGSCH.ui;
  var cfg = VGSCH.config;
  var rngLib = VGSCH.engine.rng;

  var run = null;

  /**
   * @param params.sections массив ключей разделов — прогон только по ним
   *        (используется кнопкой «Повторить слабые темы» после экзамена);
   * @param params.reason   пояснение, откуда пришёл прогон.
   */
  function render(root, params) {
    run = null;
    if (params && params.sections && params.sections.length) {
      startRun(root, params.sections, params.reason);
      return;
    }
    renderPicker(root);
  }

  /* --------------------------------------------------------- выбор раздела */

  function renderPicker(root) {
    var Q = VGSCH.data.questions;
    var sections = Q.readySections();

    var v = ui.paint(root,
      ui.appbar({ mode: 'tests', title: 'Вопросы' }) +
      '<div class="panel" style="--accent:var(--tests)">' +
        '<h3 style="margin-bottom:6px">Выберите раздел</h3>' +
        '<p class="muted" style="margin:0 0 14px">Вопросы задаются в случайном порядке, ' +
        'варианты ответов перемешиваются.</p>' +
        '<div class="pick-list">' +
          pickItem('', 'Все разделы', Q.ready().length) +
          sections.map(function (s) { return pickItem(s.key, s.title, s.count); }).join('') +
          /* Психология идёт последней и ведёт не в прогон, а в чтение:
             там развёрнутые темы, которые не сводятся к выбору варианта. */
          (Q.study().length
            ? '<button class="pick-item" data-study="1">' +
              '<span class="t">Психология — материалы для чтения</span>' +
              '<span class="n">' + ui.count(Q.study().length, ['тема', 'темы', 'тем']) + '</span></button>'
            : '') +
        '</div>' +
      '</div>' +
      ui.tabbar('tests'));

    ui.wireNav(v);
    ui.on(v, '[data-study]', function () { VGSCH.router.go('study'); });
    ui.on(v, '.pick-item[data-section]', function (b) { startRun(root, b.dataset.section || null); });
  }

  function pickItem(key, title, count) {
    return '<button class="pick-item" data-section="' + ui.esc(key) + '">' +
      '<span class="t">' + ui.esc(title) + '</span>' +
      '<span class="n">' + ui.count(count, ['вопрос', 'вопроса', 'вопросов']) + '</span></button>';
  }

  /* ------------------------------------------------------------ подход --- */

  /** section: ключ раздела, массив ключей или null (все разделы). */
  function startRun(root, section, reason) {
    var Q = VGSCH.data.questions;
    var rng = rngLib.create(rngLib.freshSeed());

    var source = Array.isArray(section)
      ? Q.ready().filter(function (q) { return section.indexOf(q.section) !== -1; })
      : Q.ready(section);

    var pool = rng.shuffle(source.slice());
    var count = cfg.tests.defaultCount > 0 ? Math.min(cfg.tests.defaultCount, pool.length) : pool.length;

    run = {
      section: section,
      reason: reason || null,
      items: pool.slice(0, count).map(function (q) { return prepare(q, rng); }),
      index: 0,
      answers: []
    };
    renderQuestion(root);
  }

  /** Варианты перемешиваются, индекс верного пересчитывается. */
  function prepare(q, rng) {
    var order = rng.shuffle(q.options.map(function (_, i) { return i; }));
    return {
      q: q, order: order,
      options: order.map(function (i) { return q.options[i]; }),
      correct: order.indexOf(q.correct)
    };
  }

  function renderQuestion(root) {
    var item = run.items[run.index];
    var given = run.answers[run.index];
    var last = run.index === run.items.length - 1;

    var v = ui.paint(root,
      ui.appbar({ mode: 'tests', title: 'Вопросы', backArrow: true }) +
      ui.progress(run.index + 1, run.items.length,
                  'Вопрос ' + (run.index + 1) + ' из ' + run.items.length, 'var(--tests)') +
      (run.reason
        ? '<div class="notice">Прогон по разделам: ' + ui.esc(run.reason) + '.</div>'
        : '') +
      '<div class="panel" style="--accent:var(--tests)">' +
        '<div class="qbox"><div class="question" style="margin:0">' +
          ui.esc(item.q.question) + '</div></div>' +
        '<div class="options">' +
          item.options.map(function (text, i) {
            return '<button class="option" data-i="' + i + '">' +
              '<span class="marker"></span>' +
              '<span class="let">' + 'АБВГ'[i] + '.</span>' +
              '<span>' + ui.esc(text) + '</span></button>';
          }).join('') +
        '</div>' +
        '<div id="verdict"></div>' +
        /* «Далее» идёт сразу за разбором ответа, а обращение об ошибке —
           уже под ним: иначе главная кнопка уезжала вниз и до неё
           приходилось прокручивать экран. */
        '<div class="actions">' +
          '<button data-act="prev"' + (run.index === 0 ? ' disabled' : '') + '>' +
            ui.I.prev + 'Назад</button>' +
          '<div class="spacer"></div>' +
          '<button class="primary" id="next" disabled>' +
            (last ? 'Завершить' : 'Далее') + ui.I.next + '</button>' +
        '</div>' +
        VGSCH.feedback.button() +
      '</div>' +
      ui.tabbar('tests'));

    /* Из вопроса стрелка возвращает к выбору раздела, а не в другой режим. */
    VGSCH.router.setBackHandler(function () { renderPicker(root); return true; });
    ui.wireNav(v);
    VGSCH.feedback.wire(v, function () {
      return {
        mode: 'Тесты', kind: 'Вопрос', id: item.q.id,
        text: item.q.question,
        /* Каждая строка — «метка: значение»: так обращение читается
           в одной ячейке таблицы, куда его кладёт Google Форма. */
        extra: 'Варианты: ' +
          item.options.map(function (o, i) { return 'АБВГ'[i] + '. ' + o; }).join(' / ') + '\n' +
          'Верный ответ: ' + 'АБВГ'[item.correct] + '. ' + item.options[item.correct] +
          (item.q.npa ? '\nОснование: ' + item.q.npa : '')
      };
    });
    ui.on(v, '.option', function (b) { pick(v, parseInt(b.dataset.i, 10)); });
    ui.on(v, '[data-act="prev"]', function () { run.index--; renderQuestion(root); });
    v.querySelector('#next').onclick = function () {
      if (last) finish(root); else { run.index++; renderQuestion(root); }
    };

    if (given !== undefined) reveal(v, given);
  }

  function pick(view, i) {
    if (run.answers[run.index] !== undefined) return;
    run.answers[run.index] = i;
    reveal(view, i);
  }

  function reveal(view, picked) {
    var item = run.items[run.index];
    var correct = picked === item.correct;

    view.querySelectorAll('.option').forEach(function (b, i) {
      b.disabled = true;
      if (i === item.correct) {
        b.classList.add('is-correct');
        b.insertAdjacentHTML('beforeend', '<span class="tick">' + ui.I.check + '</span>');
      } else if (i === picked) {
        b.classList.add('is-wrong');
        b.insertAdjacentHTML('beforeend', '<span class="tick">' + ui.I.cross + '</span>');
      }
    });

    if (cfg.tests.instantFeedback) {
      view.querySelector('#verdict').innerHTML =
        '<div class="verdict ' + (correct ? 'ok' : 'bad') + '">' +
          '<img class="verdict-photo" src="' +
            ui.asset('assets/img/rescuer-' + (correct ? 'ok' : 'wrong') + '.png') + '" alt="">' +
          '<div><b>' + (correct ? 'Верно!' : 'Неверно') + '</b>' +
            '<span class="txt">' +
              (correct ? 'Ответ соответствует требованию нормативного документа.'
                       : 'Правильный ответ: ' + ui.esc(item.options[item.correct])) +
              /* Ссылку показываем, только если она есть в первоисточнике. */
              (item.q.npa ? '<span class="src">Основание: ' + ui.esc(item.q.npa) + '</span>' : '') +
            '</span></div>' +
        '</div>';
    }
    view.querySelector('#next').disabled = false;
  }

  /* -------------------------------------------------------------- итог --- */

  function finish(root) {
    var correct = run.items.filter(function (it, i) { return run.answers[i] === it.correct; }).length;
    var total = run.items.length;
    var pct = Math.round(correct / total * 100);

    var v = ui.paint(root,
      ui.appbar({ mode: 'tests', title: 'Вопросы — итог', backArrow: true }) +
      '<div class="panel" style="--accent:var(--tests)">' +
        '<div class="summary-grid">' +
          ui.donut(pct, 'верных ответов') +
          '<div class="score-rows">' +
            '<div class="score-row"><span>Правильных ответов</span>' +
              '<span class="v">' + correct + '<small> / ' + total + '</small></span></div>' +
            '<div class="score-row"><span>Ошибок</span><span class="v">' + (total - correct) + '</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="actions">' +
          '<button data-nav="start">' + ui.I.home + 'Главная</button>' +
          '<button data-act="again">Ещё раз</button>' +
          '<div class="spacer"></div>' +
          (total - correct ? '<button class="primary" data-act="review">Разбор ошибок</button>' : '') +
        '</div>' +
      '</div>' +
      ui.tabbar('tests'));

    /* С итога стрелка возвращает к выбору раздела: подход уже закончен. */
    VGSCH.router.setBackHandler(function () { renderPicker(root); return true; });
    ui.wireNav(v);
    ui.on(v, '[data-act="again"]', function () { startRun(root, run.section); });
    ui.on(v, '[data-act="review"]', function () { renderReview(root); });
  }

  function renderReview(root) {
    var wrong = run.items
      .map(function (it, i) { return { it: it, i: i }; })
      .filter(function (x) { return run.answers[x.i] !== x.it.correct; });

    var v = ui.paint(root,
      ui.appbar({ mode: 'tests', title: 'Разбор ответа', backArrow: true }) +
      '<div class="panel" style="--accent:var(--tests)">' +
        wrong.map(function (x) {
          var picked = run.answers[x.i];
          return '<div class="review-item bad">' +
            '<div class="q">' + (x.i + 1) + '. ' + ui.esc(x.it.q.question) + '</div>' +
            '<div class="line bad"><span class="k">Ваш ответ:</span><span class="a">' +
              (picked === undefined ? 'не дан' : ui.esc(x.it.options[picked])) + '</span></div>' +
            '<div class="line ok"><span class="k">Правильный ответ:</span><span class="a">' +
              ui.esc(x.it.options[x.it.correct]) + '</span></div>' +
            (x.it.q.npa
              ? '<div class="line"><span class="k">Основание:</span><span>' +
                ui.esc(x.it.q.npa) + '</span></div>'
              : '') +
          '</div>';
        }).join('') +
        '<div class="actions">' +
          '<button data-nav="start">' + ui.I.home + 'Главная</button>' +
          '<div class="spacer"></div>' +
          '<button class="primary" data-act="again">Пройти ещё раз</button>' +
        '</div>' +
      '</div>' +
      ui.tabbar('tests'));

    /* Из разбора — обратно к итогу, а не в другой режим. */
    VGSCH.router.setBackHandler(function () { finish(root); return true; });
    ui.wireNav(v);
    ui.on(v, '[data-act="again"]', function () { startRun(root, run.section); });
  }

  VGSCH.router.register('tests', { render: render, destroy: function () { run = null; } });
})(window.VGSCH = window.VGSCH || {});
