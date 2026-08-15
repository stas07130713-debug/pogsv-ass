/* Экран «Тесты для аттестации спасателей на ГСР».
 *
 * Свободная тренировка по вопросам билетов ВГК: выбирается тема или билет,
 * дальше всё как в обычных тестах — вариант, сразу верно/неверно, разбор.
 * Экзамен по этим же билетам живёт в разделе «Экзамен».
 */
(function (VGSCH) {
  'use strict';

  var ui = VGSCH.ui;
  var cfg = VGSCH.config;
  var rngLib = VGSCH.engine.rng;

  var run = null;

  /**
   * @param params.topic ключ темы — открыть прогон сразу по ней
   *        (используется кнопкой «слабые темы» после экзамена).
   */
  function render(root, params) {
    run = null;
    if (params && params.topic) { start(root, { topic: params.topic }); return; }
    renderPicker(root);
  }

  /* --------------------------------------------------------- выбор ------- */

  function renderPicker(root) {
    var vgk = VGSCH.data.vgk;
    var topics = vgk.topics();
    var total = vgk.ready().length;

    var v = ui.paint(root,
      ui.appbar({ mode: 'vgk', title: 'Тесты ГСР' }) +
      '<div class="panel" style="--accent:var(--study)">' +
        '<h3 style="margin-bottom:12px">Вопросы для аттестации спасателей на ГСР</h3>' +
        '<div class="pick-list">' +
          '<button class="pick-item" data-topic=""><span class="t">Все темы</span>' +
            '<span class="n">' + ui.count(total, ['вопрос', 'вопроса', 'вопросов']) + '</span></button>' +
          topics.map(function (t) {
            return '<button class="pick-item" data-topic="' + ui.esc(t.key) + '">' +
              '<span class="t">' + ui.esc(t.title) + '</span>' +
              '<span class="n">' + ui.count(t.count, ['вопрос', 'вопроса', 'вопросов']) + '</span></button>';
          }).join('') +
        '</div>' +

        '<h3 style="margin:18px 0 12px">Или отдельный билет</h3>' +
        '<div class="ticket-grid">' +
          vgk.tickets.map(function (t) {
            return '<button class="ticket-btn" data-ticket="' + t.no + '">' +
              '<span class="nn">' + t.no + '</span>' +
              '<span class="tt">билет</span></button>';
          }).join('') +
        '</div>' +
      '</div>' +
      ui.tabbar('vgk'));

    ui.wireNav(v);
    ui.on(v, '[data-topic]', function (b) { start(root, { topic: b.dataset.topic || null }); });
    ui.on(v, '[data-ticket]', function (b) { start(root, { ticket: parseInt(b.dataset.ticket, 10) }); });
  }

  /* -------------------------------------------------------- прогон ------- */

  function start(root, opts) {
    var vgk = VGSCH.data.vgk;
    var rng = rngLib.create(rngLib.freshSeed());
    var items;

    if (opts.ticket) {
      /* Билет идёт как есть: порядок вопросов — часть бланка. */
      var t = vgk.ticket(opts.ticket);
      items = t.questions.filter(function (q) { return q.correct !== null; })
                         .map(function (q) { return prepare(q, rng); });
    } else {
      var pool = rng.shuffle(vgk.ready(opts.topic).slice());
      var n = cfg.tests.defaultCount > 0 ? Math.min(cfg.tests.defaultCount, pool.length) : pool.length;
      items = pool.slice(0, n).map(function (q) { return prepare(q, rng); });
    }

    run = {
      items: items, index: 0, answers: [],
      title: opts.ticket ? ('Билет № ' + opts.ticket)
                         : (opts.topic ? vgk.TOPICS[opts.topic] : 'Все темы')
    };
    renderQuestion(root);
  }

  /** Варианты перемешиваются, индекс верного пересчитывается. */
  function prepare(q, rng) {
    var order = rng.shuffle(q.o.map(function (_, i) { return i; }));
    return {
      q: q,
      options: order.map(function (i) { return q.o[i]; }),
      correct: order.indexOf(q.correct)
    };
  }

  function renderQuestion(root) {
    var item = run.items[run.index];
    var given = run.answers[run.index];
    var last = run.index === run.items.length - 1;

    var v = ui.paint(root,
      ui.appbar({ mode: 'vgk', title: 'Тесты ГСР', backArrow: true }) +
      ui.progress(run.index + 1, run.items.length,
                  run.title + ' · вопрос ' + (run.index + 1) + ' из ' + run.items.length,
                  'var(--study)') +
      '<div class="panel" style="--accent:var(--study)">' +
        '<div class="qbox"><div class="question" style="margin:0">' +
          ui.esc(item.q.q) + '</div></div>' +
        '<div class="options">' +
          item.options.map(function (text, i) {
            return '<button class="option" data-i="' + i + '">' +
              '<span class="marker"></span>' +
              '<span class="let">' + 'АБВ'[i] + '.</span>' +
              '<span>' + ui.esc(text) + '</span></button>';
          }).join('') +
        '</div>' +
        '<div id="verdict"></div>' +
        '<div class="actions">' +
          '<button data-act="prev"' + (run.index === 0 ? ' disabled' : '') + '>' +
            ui.I.prev + 'Назад</button>' +
          '<div class="spacer"></div>' +
          '<button class="primary" style="--accent:var(--study)" id="next" disabled>' +
            (last ? 'Завершить' : 'Далее') + ui.I.next + '</button>' +
        '</div>' +
        VGSCH.feedback.button() +
      '</div>' +
      ui.tabbar('vgk'));

    VGSCH.router.setBackHandler(function () { renderPicker(root); return true; });
    ui.wireNav(v);
    VGSCH.feedback.wire(v, function () {
      return {
        mode: 'Тесты ГСР', kind: 'Вопрос', id: item.q.id,
        text: item.q.q,
        extra: 'Варианты: ' +
          item.options.map(function (o, i) { return 'АБВ'[i] + '. ' + o; }).join(' / ') + '\n' +
          'Верный ответ: ' + 'АБВ'[item.correct] + '. ' + item.options[item.correct]
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

    view.querySelector('#verdict').innerHTML =
      '<div class="verdict ' + (correct ? 'ok' : 'bad') + '">' +
        '<img class="verdict-photo" src="' +
          ui.asset('assets/img/rescuer-' + (correct ? 'ok' : 'wrong') + '.jpg') + '" alt="">' +
        '<div><b>' + (correct ? 'Верно!' : 'Неверно') + '</b>' +
          '<span class="txt">' +
            (correct ? 'Ответ соответствует требованиям НПА.'
                     : 'Правильный ответ: ' + ui.esc(item.options[item.correct])) +
          '</span></div>' +
      '</div>';
    view.querySelector('#next').disabled = false;
  }

  /* ---------------------------------------------------------- итог ------- */

  function finish(root) {
    var right = run.items.filter(function (item, i) { return run.answers[i] === item.correct; }).length;
    var total = run.items.length;
    var pct = Math.round(right / total * 100);

    var v = ui.paint(root,
      ui.appbar({ mode: 'vgk', title: 'Тесты ГСР — итог', backArrow: true }) +
      '<div class="panel" style="--accent:var(--study)">' +
        '<div class="summary-grid">' +
          ui.donut(pct, null) +
          '<div class="score-rows">' +
            '<div class="score-row"><span>Вопросов</span><span class="v">' + total + '</span></div>' +
            '<div class="score-row"><span>Верно</span>' +
              '<span class="v" style="color:var(--ok)">' + right + '</span></div>' +
            '<div class="score-row total"><span>Ошибок</span>' +
              '<span class="v" style="color:' + (total - right ? 'var(--bad)' : 'var(--ok)') + '">' +
              (total - right) + '</span></div>' +
          '</div>' +
        '</div>' +
        review() +
        '<div class="actions">' +
          '<button data-act="again">Ещё раз</button>' +
          '<div class="spacer"></div>' +
          '<button class="primary" style="--accent:var(--study)" data-act="picker">К выбору темы</button>' +
        '</div>' +
      '</div>' +
      ui.tabbar('vgk'));

    VGSCH.router.setBackHandler(function () { renderPicker(root); return true; });
    ui.wireNav(v);
    ui.on(v, '[data-act="again"]', function () { run.index = 0; run.answers = []; renderQuestion(root); });
    ui.on(v, '[data-act="picker"]', function () { renderPicker(root); });
  }

  function review() {
    var wrong = run.items.filter(function (item, i) { return run.answers[i] !== item.correct; });
    if (!wrong.length) return '<p class="muted">Все ответы верны.</p>';

    return '<h4 style="margin:16px 0 8px">Ошибки</h4>' +
      run.items.map(function (item, i) {
        if (run.answers[i] === item.correct) return '';
        var given = run.answers[i];
        return '<div class="review-item bad">' +
          '<div class="q">' + ui.esc(item.q.q) + '</div>' +
          '<div class="line bad"><span class="k">Ваш ответ:</span><span class="a">' +
            (given === undefined ? 'не дан' : ui.esc(item.options[given])) + '</span></div>' +
          '<div class="line ok"><span class="k">Правильный ответ:</span><span class="a">' +
            ui.esc(item.options[item.correct]) + '</span></div>' +
        '</div>';
      }).join('');
  }

  VGSCH.router.register('vgk', { render: render, destroy: function () { run = null; } });
})(window.VGSCH = window.VGSCH || {});
