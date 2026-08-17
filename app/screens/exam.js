/* Экран 4. Режим «Тестирование» — макеты 04 и 07.
 *
 * Хаб с общим прогрессом, две части (вопросы и задачи), пауза, завершение.
 * Правильные ответы по ходу не показываются — только в разборе после окончания.
 * Пороги, число вопросов и задач, лимит времени заданы в app/config.js.
 */
(function (VGSCH) {
  'use strict';

  var ui = VGSCH.ui;
  var cfg = VGSCH.config;
  var units = VGSCH.engine.units;
  var rngLib = VGSCH.engine.rng;

  var run = null;
  var timer = null;

  /* ------------------------------------------------------------ запуск --- */

  /* Какая аттестация выбрана: 'platoon' — взвода (вопросы + задачи),
     'vgk' — спасателей на ГСР (билет ВГК целиком, без задач). */
  var kind = null;

  function render(root, params) {
    /* Незаконченный подход продолжается с того же места. */
    if (run && !run.finished) { renderHub(root); return; }

    /* Экзамен уже сдан в этом сеансе: показываем итоги, а не начинаем новый.
       Новый запускается только явной кнопкой — иначе достаточно случайно
       нажать «Экзамен» в нижней панели, чтобы потерять результат. */
    var saved = VGSCH.state.lastExam();
    if (saved && !(params && params.fresh)) { renderResult(root, saved, true); return; }

    renderKindPicker(root);
  }

  /* --------------------------------------------------- выбор аттестации -- */

  function renderKindPicker(root) {
    var Q = VGSCH.data.questions;
    var vgk = VGSCH.data.vgk;
    var platoonReady = Q.ready().length >= cfg.exam.questionCount;
    var vgkReady = vgk.tickets.length > 0;

    var v = ui.paint(root,
      ui.appbar({ mode: 'exam', title: 'Экзамен' }) +
      '<div class="panel" style="--accent:var(--exam)">' +
        '<h3 style="margin-bottom:6px">Выберите аттестацию</h3>' +
        '<p class="muted" style="margin:0 0 14px">Данные проверяемого спрашиваются ' +
        'на следующем шаге — они попадут в протокол.</p>' +

        kindCard('platoon', ui.I.tests, 'Аттестация взвода',
                 cfg.exam.questionCount + ' вопросов и ' +
                 ui.count(cfg.exam.taskCount, ['расчётная задача', 'расчётные задачи', 'расчётных задач']) +
                 (cfg.exam.timeLimitMin ? ', ' + cfg.exam.timeLimitMin + ' минут' : '') + '.',
                 'Зачёт: не менее ' + cfg.exam.passQuestions + ' верных ответов и ' +
                 cfg.exam.passTasks + ' решённых задач.',
                 'var(--tests)', platoonReady) +

        kindCard('vgk', ui.I.study, 'Аттестация спасателей на ГСР',
                 '20 вопросов в том же порядке, что в бланке' +
                 (cfg.examVgk.timeLimitMin ? ', ' + cfg.examVgk.timeLimitMin + ' минут' : '') + '.',
                 'Зачёт: допускается не более ' +
                 ui.count(cfg.examVgk.allowedMistakes, ['ошибки', 'ошибок', 'ошибок']) + '.',
                 'var(--study)', vgkReady) +
      '</div>' +
      ui.tabbar('exam'));

    ui.wireNav(v);
    ui.on(v, '[data-kind]', function (b) {
      kind = b.dataset.kind;
      if (!VGSCH.state.isIdentified()) { renderIdentify(root); return; }
      begin(root);
    });
  }

  function kindCard(key, icon, title, line1, line2, color, enabled) {
    return '<button class="kind-card" data-kind="' + key + '" style="--c:' + color + '"' +
      (enabled ? '' : ' disabled') + '>' +
      '<span class="ic">' + icon + '</span>' +
      '<span class="tx">' +
        '<b>' + ui.esc(title) + '</b>' +
        '<span>' + ui.esc(line1) + '</span>' +
        '<span class="pass">' + ui.esc(line2) + '</span>' +
      '</span>' +
      '<span class="go">' + ui.I.next + '</span>' +
      '</button>';
  }

  /** Запуск выбранной аттестации. */
  function begin(root) {
    if (kind === 'vgk') startVgkExam(root); else startExam(root);
  }

  /* ------------------------------------------------------ кто сдаёт ------ */

  function renderIdentify(root) {
    var st = VGSCH.state.data;
    if (!st.unit) VGSCH.state.setUnit(cfg.unitDefault);
    /* На аттестации спасателей на ГСР по умолчанию стоит «Член ВГК»:
       её сдают именно они, и выбирать должность вручную каждый раз незачем.
       Список при этом открыт — должность можно поменять. */
    if (!st.position) {
      VGSCH.state.setPosition(kind === 'vgk' ? cfg.positionVgk : cfg.positionDefault);
    }

    var v = ui.paint(root,
      ui.appbar({ mode: 'exam', title: 'Экзамен', backArrow: true }) +
      '<div class="panel" style="--accent:var(--exam)">' +
        '<h3 style="margin-bottom:6px">Кто сдаёт экзамен</h3>' +
        '<p class="muted" style="margin:0 0 16px">Эти данные попадут в протокол. ' +
        'Для тренировки в «Тестах» и «Задачах» они не нужны.</p>' +

        field('fio', 'Фамилия и инициалы', 'Иванов И. И.', st.person) +
        select('unit', 'Номер отделения', cfg.units, st.unit) +
        select('position', 'Должность', cfg.positions, st.position) +
        '<div class="field-error" id="formError"></div>' +

        '<div class="actions">' +
          '<button data-nav="start">' + ui.I.home + 'Главная</button>' +
          '<div class="spacer"></div>' +
          '<button class="primary" style="--accent:var(--exam)" data-act="begin">' +
            'Начать экзамен' + ui.I.next + '</button>' +
        '</div>' +
        '<div class="footer-note">' + hint() + '</div>' +
      '</div>' +
      ui.tabbar('exam'));

    /* Стрелка возвращает к выбору аттестации, а не в предыдущий режим:
       «кто сдаёт» — это состояние внутри экзамена, а не отдельный экран. */
    VGSCH.router.setBackHandler(function () { renderKindPicker(root); return true; });
    ui.wireNav(v);

    var fio = v.querySelector('#fio');
    var err = v.querySelector('#formError');
    fio.focus();

    fio.addEventListener('input', function (e) {
      VGSCH.state.setPerson(e.target.value);
      err.textContent = '';
    });
    v.querySelector('#unit').addEventListener('change', function (e) { VGSCH.state.setUnit(e.target.value); });
    v.querySelector('#position').addEventListener('change', function (e) { VGSCH.state.setPosition(e.target.value); });

    function go() {
      if (!VGSCH.state.isIdentified()) {
        err.textContent = 'Укажите фамилию и инициалы — они попадут в протокол.';
        fio.focus();
        return;
      }
      begin(root);
    }
    /* Ввод с клавиатуры телефона тоже начинает экзамен. */
    fio.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    ui.on(v, '[data-act="begin"]', go);
  }

  /** Строка под кнопкой: из чего состоит выбранная аттестация. */
  function hint() {
    if (kind === 'vgk') {
      return '20 вопросов' +
        (cfg.examVgk.timeLimitMin ? ', ' + cfg.examVgk.timeLimitMin + ' минут' : '') +
        '. Допускается не более ' +
        ui.count(cfg.examVgk.allowedMistakes, ['ошибки', 'ошибок', 'ошибок']) + '.';
    }
    return cfg.exam.questionCount + ' вопросов и ' +
      ui.count(cfg.exam.taskCount, ['задача', 'задачи', 'задач']) +
      (cfg.exam.timeLimitMin ? ', ' + cfg.exam.timeLimitMin + ' минут' : '') + '.';
  }

  /* Подпись поля лежит отдельным слоем поверх и не перехватывает нажатия,
     а само поле занимает всю площадь рамки — иначе часть рамки не кликается. */
  function field(id, label, placeholder, value) {
    return '<div class="field"><div class="field-box">' +
      '<span class="cap">' + ui.esc(label) + '</span>' +
      '<input type="text" id="' + id + '" autocomplete="off" spellcheck="false" maxlength="60" ' +
        'aria-label="' + ui.esc(label) + '" placeholder="' + ui.esc(placeholder) + '" ' +
        'value="' + ui.esc(value) + '">' +
      '</div></div>';
  }

  /* Пустого пункта с прочерком нет: роль «не указано» играют обычные
     значения «нет» и «Другая должность». */
  function select(id, label, options, value) {
    return '<div class="field"><div class="field-box is-select">' +
      '<span class="cap">' + ui.esc(label) + '</span>' +
      '<select id="' + id + '" aria-label="' + ui.esc(label) + '">' +
        options.map(function (o) {
          return '<option' + (o === value ? ' selected' : '') + '>' + ui.esc(o) + '</option>';
        }).join('') +
      '</select>' +
      '<span class="ic">' + ui.I.chev + '</span>' +
      '</div></div>';
  }

  function startExam(root) {
    VGSCH.state.clearExam();

    var Q = VGSCH.data.questions;
    var rng = rngLib.create(rngLib.freshSeed());

    var questions = rng.shuffle(Q.ready().slice())
      .slice(0, cfg.exam.questionCount)
      .map(function (q) {
        var order = rng.shuffle(q.options.map(function (_, i) { return i; }));
        return {
          kind: 'question', q: q,
          options: order.map(function (i) { return q.options[i]; }),
          correct: order.indexOf(q.correct)
        };
      });

    var tasks;
    try {
      tasks = VGSCH.engine.pipeline.produceSet(cfg.exam.taskCount)
        .map(function (t) { return { kind: 'task', task: t }; });
    } catch (e) {
      ui.wireNav(ui.paint(root, ui.appbar({ mode: 'exam', title: 'Экзамен' }) +
        '<div class="panel"><div class="notice">Не удалось подготовить задачи: ' +
        ui.esc(e.message) + '</div><div class="actions">' +
        '<button data-nav="start">' + ui.I.home + 'Главная</button></div></div>' + ui.tabbar('exam')));
      return;
    }

    run = {
      questions: questions, tasks: tasks,
      qAnswers: new Array(questions.length),
      tAnswers: new Array(tasks.length),
      elapsedSec: 0, finished: false, result: null
    };

    startTimer(root);
    renderHub(root);
  }

  /* --------------------------------------- аттестация спасателей на ГСР -- */

  /**
   * Билет ВГК целиком. Вопросы и их порядок берутся из бланка как есть —
   * перемешиваются только варианты ответа внутри вопроса, чтобы нельзя было
   * выучить «правильный всегда второй». Расчётных задач в этой аттестации нет.
   */
  function startVgkExam(root) {
    VGSCH.state.clearExam();

    var vgk = VGSCH.data.vgk;
    var rng = rngLib.create(rngLib.freshSeed());
    var ticket = vgk.tickets[Math.floor(rng.next() * vgk.tickets.length)];

    var questions = ticket.questions
      /* Вопрос без подтверждённого ответа в оценку не идёт. */
      .filter(function (q) { return q.correct !== null; })
      .map(function (q) {
        var order = rng.shuffle(q.o.map(function (_, i) { return i; }));
        return {
          kind: 'question',
          q: { id: q.id, question: q.q, section: q.topic, npa: null },
          options: order.map(function (i) { return q.o[i]; }),
          correct: order.indexOf(q.correct)
        };
      });

    run = {
      vgk: true, ticketNo: ticket.no,
      questions: questions, tasks: [],
      qAnswers: new Array(questions.length),
      tAnswers: [],
      elapsedSec: 0, finished: false, result: null
    };

    startTimer(root);
    renderHub(root);
  }

  /** Настройки текущей аттестации: у ГСР свой лимит времени. */
  function rules() {
    return (run && run.vgk) ? cfg.examVgk : cfg.exam;
  }

  function startTimer(root) {
    stopTimer();
    var limit = rules().timeLimitMin;
    if (limit > 0) {
      timer = ui.countdown(limit * 60, function (left) {
        run.elapsedSec = limit * 60 - left;
        paintTimer(left, left <= 60);
      }, function () { finish(root, true); });
    } else {
      timer = ui.stopwatch(function (passed) { run.elapsedSec = passed; paintTimer(passed, false); });
    }
  }

  function stopTimer() { if (timer) { timer.stop(); timer = null; } }

  function paintTimer(seconds, low) {
    var t = document.getElementById('timer');
    if (!t) return;
    t.querySelector('span').textContent = ui.clock(seconds);
    t.classList.toggle('is-low', !!low);
  }

  function timerSeconds() {
    var limit = rules().timeLimitMin;
    return limit > 0 ? limit * 60 - run.elapsedSec : run.elapsedSec;
  }

  function answeredCount(arr) {
    return arr.filter(function (a) { return a !== undefined; }).length;
  }

  /* --------------------------------------------------------------- хаб --- */

  function renderHub(root) {
    var qDone = answeredCount(run.qAnswers);
    var tDone = answeredCount(run.tAnswers);
    var total = run.questions.length + run.tasks.length;
    var done = qDone + tDone;
    var paused = timer && timer.isPaused();

    var v = ui.paint(root,
      ui.appbar({ mode: 'exam', title: 'Экзамен', showTimer: true }) +

      '<div class="panel" style="--accent:var(--exam)">' +
        '<div class="exam-overview">' +
          '<div>' +
            '<div class="ttl">' + (run.vgk ? 'Билет № ' + run.ticketNo : 'Общий прогресс') + '</div>' +
            '<div class="cnt">Выполнено: ' + done + ' из ' + total + '</div>' +
            ui.bar(total ? done / total * 100 : 0, 'var(--exam)') +
          '</div>' +
          ui.donut(total ? done / total * 100 : 0, null, 'part') +
        '</div>' +
      '</div>' +

      partCard('tests', ui.I.tests, 'Вопросы',
               ui.count(run.questions.length, ['вопрос', 'вопроса', 'вопросов']),
               qDone, run.questions.length) +
      /* В аттестации на ГСР расчётных задач нет — карточка не нужна. */
      (run.tasks.length
        ? partCard('tasks', ui.I.tasks, 'Задачи',
                   ui.count(run.tasks.length, ['задача', 'задачи', 'задач']),
                   tDone, run.tasks.length)
        : '') +

      '<div class="actions">' +
        '<button data-act="pause">' + (paused ? ui.I.play + 'Продолжить' : ui.I.pause + 'Пауза') + '</button>' +
        '<div class="spacer"></div>' +
        '<button class="primary" style="--accent:var(--exam)" data-act="finish">' +
          'Завершить экзамен</button>' +
      '</div>' +
      (done < total
        ? '<div class="footer-note">Можно завершить в любой момент. Неотвеченные вопросы ' +
          'засчитываются как неверные.</div>'
        : '') +
      ui.tabbar('exam'));

    paintTimer(timerSeconds(), rules().timeLimitMin > 0 && timerSeconds() <= 60);

    ui.on(v, '[data-part="tests"]', function () { renderQuestion(root, firstUnanswered(run.qAnswers)); });
    ui.on(v, '[data-part="tasks"]', function () { renderTask(root, firstUnanswered(run.tAnswers)); });
    ui.on(v, '[data-act="pause"]', function () {
      if (!timer) return;
      if (timer.isPaused()) timer.resume(); else timer.pause();
      renderHub(root);
    });
    ui.on(v, '[data-act="finish"]', function () { finish(root, false); });
    ui.on(v, '[data-nav]', function (b) {
      if (confirm('Выйти из экзамена? Результаты текущего подхода будут потеряны.')) {
        stopTimer(); run = null; VGSCH.router.go(b.dataset.nav);
      }
    });
  }

  function firstUnanswered(arr) {
    for (var i = 0; i < arr.length; i++) if (arr[i] === undefined) return i;
    return 0;
  }

  function partCard(mode, icon, title, sub, done, total) {
    var pct = total ? Math.round(done / total * 100) : 0;
    return '<div class="panel part-card" style="--c:' + ui.ACCENT[mode] +
      ';--c-bg:' + ui.ACCENT_BG[mode] + '">' +
      '<div class="pic">' + icon + '</div>' +
      '<div class="info">' +
        '<h4>' + ui.esc(title) + ' <span style="color:var(--text-mute);font-weight:400">(' +
          ui.esc(sub) + ')</span></h4>' +
        '<div class="sub">Выполнено: ' + done + ' из ' + total + '</div>' +
        '<div class="bar">' + ui.bar(pct, ui.ACCENT[mode]) +
          '<span class="pct">' + pct + '%</span></div>' +
      '</div>' +
      '<button class="primary" style="--accent:' + ui.ACCENT[mode] + '" data-part="' + mode + '">' +
        'Перейти</button>' +
      '</div>';
  }

  /* ------------------------------------------------------------ вопросы -- */

  function renderQuestion(root, index) {
    var item = run.questions[index];
    var given = run.qAnswers[index];
    var last = index === run.questions.length - 1;

    var v = ui.paint(root,
      ui.appbar({ mode: 'exam', title: 'Экзамен', showTimer: true, backArrow: true }) +
      ui.progress(index + 1, run.questions.length,
                  'Вопрос ' + (index + 1) + ' из ' + run.questions.length, 'var(--tests)') +
      '<div class="panel" style="--accent:var(--tests)">' +
        '<div class="qbox"><div class="question" style="margin:0">' +
          ui.esc(item.q.question) + '</div></div>' +
        '<div class="options">' +
          item.options.map(function (text, i) {
            return '<button class="option' + (given === i ? ' is-picked' : '') + '" data-i="' + i + '">' +
              '<span class="marker"></span><span class="let">' + 'АБВГ'[i] + '.</span>' +
              '<span>' + ui.esc(text) + '</span></button>';
          }).join('') +
        '</div>' +
        /* Кнопки раньше обращения об ошибке: главное действие не должно
           уезжать вниз за второстепенной кнопкой. */
        '<div class="actions">' +
          '<button data-act="prev"' + (index === 0 ? ' disabled' : '') + '>' + ui.I.prev + 'Назад</button>' +
          '<div class="spacer"></div>' +
          '<button class="primary" data-act="next">' +
            (last ? 'К общему прогрессу' : 'Далее') + ui.I.next + '</button>' +
        '</div>' +
        VGSCH.feedback.button() +
      '</div>' +
      ui.tabbar('exam'));

    paintTimer(timerSeconds(), rules().timeLimitMin > 0 && timerSeconds() <= 60);

    VGSCH.feedback.wire(v, function () {
      return {
        mode: 'Экзамен', kind: 'Вопрос', id: item.q.id,
        text: item.q.question,
        /* Каждая строка — «метка: значение»: так обращение читается
           в одной ячейке таблицы, куда его кладёт Google Форма. */
        extra: 'Варианты: ' +
          item.options.map(function (o, i) { return 'АБВГ'[i] + '. ' + o; }).join(' / ') +
          (item.q.npa ? '\nОснование: ' + item.q.npa : '')
      };
    });
    ui.on(v, '.option', function (b) {
      v.querySelectorAll('.option').forEach(function (x) { x.classList.remove('is-picked'); });
      b.classList.add('is-picked');
      run.qAnswers[index] = parseInt(b.dataset.i, 10);
    });
    ui.on(v, '[data-act="prev"]', function () { renderQuestion(root, index - 1); });
    ui.on(v, '[data-act="next"]', function () {
      if (last) renderHub(root); else renderQuestion(root, index + 1);
    });
    /* Стрелка и системная кнопка «назад» ведут к общему прогрессу.
       Через роутер, а не своим слушателем: так обе кнопки ходят одинаково. */
    VGSCH.router.setBackHandler(function () { renderHub(root); return true; });
    /* Само нажатие на стрелку: wireNav здесь не вызывается — он повесил бы
       и обработчик на [data-nav], а у нижней панели свой, с подтверждением. */
    ui.on(v, '.appbar [data-back]', function () { VGSCH.router.back(); });
    ui.on(v, '.tabbar [data-nav]', function (b) {
      if (confirm('Выйти из экзамена? Результаты текущего подхода будут потеряны.')) {
        stopTimer(); run = null; VGSCH.router.go(b.dataset.nav);
      }
    });
  }

  /* ------------------------------------------------------------- задачи -- */

  function renderTask(root, index) {
    var t = run.tasks[index].task;
    var given = run.tAnswers[index];
    var last = index === run.tasks.length - 1;

    var v = ui.paint(root,
      ui.appbar({ mode: 'exam', title: 'Экзамен', showTimer: true, backArrow: true }) +
      ui.progress(index + 1, run.tasks.length,
                  'Задача ' + (index + 1) + ' из ' + run.tasks.length, 'var(--tasks)') +
      '<div class="panel" style="--accent:var(--tasks)">' +
        '<div class="qbox">' +
          '<div class="muted" style="margin-bottom:8px">' + ui.esc(t.category) + '</div>' +
          '<div class="question" style="margin:0">' + ui.esc(t.question) + '</div>' +
        '</div>' +
        (t.scheme && t.scheme.required
          ? '<div class="scheme-wrap">' + VGSCH.engine.scheme.render(t) + '</div>' : '') +
        (t.answer.type === 'numeric'
          ? '<div class="field"><div class="muted" style="margin-bottom:8px">Введите ответ (' +
              ui.esc(t.answer.unit) + '), с точностью ' +
              ui.precision(t.answer.decimals) + ':</div><div class="answer-row">' +
              '<input type="text" id="numAnswer" inputmode="decimal" autocomplete="off" ' +
              'placeholder="Числовое значение" value="' +
              (given === undefined ? '' : ui.esc(String(given).replace('.', ','))) + '">' +
              '<span class="unit">' + ui.esc(t.answer.unit) + '</span></div></div>'
          : '<div class="options" style="margin-top:16px">' +
              t.answer.options.map(function (o, i) {
                var picked = given !== undefined && given === o.value;
                return '<button class="option' + (picked ? ' is-picked' : '') + '" data-v="' +
                  (o.value ? '1' : '0') + '"><span class="marker"></span>' +
                  '<span class="let">' + 'АБ'[i] + '.</span><span>' + ui.esc(o.label) + '</span></button>';
              }).join('') + '</div>') +
        '<div class="actions">' +
          '<button data-act="prev"' + (index === 0 ? ' disabled' : '') + '>' + ui.I.prev + 'Назад</button>' +
          '<div class="spacer"></div>' +
          '<button class="primary" data-act="next">' +
            (last ? 'К общему прогрессу' : 'Далее') + ui.I.next + '</button>' +
        '</div>' +
        VGSCH.feedback.button() +
      '</div>' +
      ui.tabbar('exam'));

    paintTimer(timerSeconds(), rules().timeLimitMin > 0 && timerSeconds() <= 60);

    VGSCH.feedback.wire(v, function () {
      return {
        mode: 'Экзамен', kind: 'Задача', id: t.task_id + ' (тип ' + t.type_id + ')',
        text: t.question,
        extra: 'Основание: ' +
          t.normative_basis.map(function (b) { return b.document + ', ' + b.point; }).join('; ') +
          '\nЗерно генерации: ' + t.seed + ' (воспроизводит задачу с теми же числами)'
      };
    });

    var inp = v.querySelector('#numAnswer');
    if (inp) {
      inp.addEventListener('input', function () {
        var raw = String(inp.value).trim().replace(',', '.');
        var num = parseFloat(raw);
        run.tAnswers[index] = (raw !== '' && isFinite(num)) ? num : undefined;
      });
      /* Кнопка ввода на клавиатуре телефона переходит дальше. Без этого
         приходилось сворачивать клавиатуру, чтобы добраться до «Далее». */
      inp.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        inp.blur();
        if (last) renderHub(root); else renderTask(root, index + 1);
      });
    }
    ui.on(v, '.option', function (b) {
      v.querySelectorAll('.option').forEach(function (x) { x.classList.remove('is-picked'); });
      b.classList.add('is-picked');
      run.tAnswers[index] = b.dataset.v === '1';
    });
    ui.on(v, '[data-act="prev"]', function () { renderTask(root, index - 1); });
    ui.on(v, '[data-act="next"]', function () {
      if (last) renderHub(root); else renderTask(root, index + 1);
    });
    /* Стрелка и системная кнопка «назад» ведут к общему прогрессу.
       Через роутер, а не своим слушателем: так обе кнопки ходят одинаково. */
    VGSCH.router.setBackHandler(function () { renderHub(root); return true; });
    /* Само нажатие на стрелку: wireNav здесь не вызывается — он повесил бы
       и обработчик на [data-nav], а у нижней панели свой, с подтверждением. */
    ui.on(v, '.appbar [data-back]', function () { VGSCH.router.back(); });
    ui.on(v, '.tabbar [data-nav]', function (b) {
      if (confirm('Выйти из экзамена? Результаты текущего подхода будут потеряны.')) {
        stopTimer(); run = null; VGSCH.router.go(b.dataset.nav);
      }
    });
  }

  /* -------------------------------------------------------------- итоги -- */

  function grade() {
    var details = [];
    var qCorrect = 0, tCorrect = 0;

    run.questions.forEach(function (item, i) {
      var given = run.qAnswers[i];
      var isCorrect = given === item.correct;
      if (isCorrect) qCorrect++;
      details.push({
        kind: 'question', n: i + 1, correct: isCorrect,
        section: item.q.section,
        text: item.q.question,
        given: given === undefined ? null : item.options[given],
        right: item.options[item.correct],
        npa: item.q.npa
      });
    });

    run.tasks.forEach(function (item, i) {
      var t = item.task, a = t.answer, given = run.tAnswers[i], isCorrect;
      if (given === undefined) isCorrect = false;
      else if (a.type === 'numeric') {
        isCorrect = Math.abs(given - a.value) <= t.tolerances.numeric_abs + 0.5 * Math.pow(10, -a.decimals);
      } else isCorrect = given === a.value;
      if (isCorrect) tCorrect++;

      var rightText = a.type === 'numeric'
        ? units.fmt(a.value, a.decimals) + ' ' + a.unit
        : a.options.filter(function (o) { return o.value === a.value; })[0].label;
      var givenText = given === undefined ? null
        : (a.type === 'numeric' ? units.fmt(given, a.decimals) + ' ' + a.unit
           : a.options.filter(function (o) { return o.value === given; })[0].label);

      details.push({
        kind: 'task', n: run.questions.length + i + 1, correct: isCorrect,
        text: t.question, given: givenText, right: rightText,
        npa: t.normative_basis.map(function (b) { return b.document + ', ' + b.point; }).join('; '),
        steps: t.solution_steps
      });
    });

    var totalCorrect = qCorrect + tCorrect;
    var totalItems = run.questions.length + run.tasks.length;

    /* Зачёт считается по правилам выбранной аттестации: у взвода — пороги
       по вопросам и задачам, у ГСР — число допустимых ошибок. */
    var mistakes = run.questions.length - qCorrect;
    var passed = run.vgk
      ? mistakes <= cfg.examVgk.allowedMistakes
      : (qCorrect >= cfg.exam.passQuestions && tCorrect >= cfg.exam.passTasks);

    return {
      vgk: !!run.vgk,
      ticketNo: run.ticketNo || null,
      mistakes: mistakes,
      allowedMistakes: run.vgk ? cfg.examVgk.allowedMistakes : null,
      qCorrect: qCorrect, qTotal: run.questions.length,
      tCorrect: tCorrect, tTotal: run.tasks.length,
      totalCorrect: totalCorrect, totalItems: totalItems,
      percent: Math.round(totalCorrect / totalItems * 100),
      passed: passed,
      details: details, elapsedSec: run.elapsedSec,
      weakSections: weakSections(details, run.vgk)
    };
  }

  /**
   * Разделы, в которых были ошибки, — от худшего к лучшему.
   * Считаются только вопросы: у расчётных задач разделов банка нет.
   * У аттестации на ГСР свои темы — они лежат в банке билетов.
   */
  function weakSections(details, isVgk) {
    var SECTIONS = isVgk ? VGSCH.data.vgk.TOPICS : VGSCH.data.questions.SECTIONS;
    var by = {};
    details.forEach(function (d) {
      if (d.kind !== 'question' || !d.section) return;
      if (!by[d.section]) by[d.section] = { key: d.section, title: SECTIONS[d.section], total: 0, wrong: 0 };
      by[d.section].total++;
      if (!d.correct) by[d.section].wrong++;
    });
    return Object.keys(by)
      .map(function (k) { return by[k]; })
      .filter(function (s) { return s.wrong > 0; })
      .sort(function (a, b) { return (b.wrong / b.total) - (a.wrong / a.total) || b.wrong - a.wrong; });
  }

  function finish(root, byTimeout) {
    if (run.finished) return;
    if (!byTimeout && answeredCount(run.qAnswers) + answeredCount(run.tAnswers) <
        run.questions.length + run.tasks.length) {
      if (!confirm('Ответы даны не на все вопросы. Завершить экзамен?')) return;
    }
    run.finished = true;
    stopTimer();
    run.result = grade();
    run.result.byTimeout = byTimeout;
    run.result.finishedAt = new Date();
    VGSCH.state.saveExam(run.result);
    renderResult(root, run.result, false);
  }

  /**
   * Экран итогов.
   * @param archived true — итоги открыты повторно, после ухода с экрана.
   *        Подход уже закрыт, поэтому добавляется кнопка «Новый экзамен».
   */
  function renderResult(root, r, archived) {
    var v = ui.paint(root,
      ui.appbar({ mode: 'exam', title: 'Результат' }) +
      (r.byTimeout && !archived
        ? '<div class="notice">Время вышло — экзамен завершён автоматически.</div>' : '') +
      (archived
        ? '<div class="notice">Итоги экзамена от ' + ui.dateTime(r.finishedAt) +
          '. Сохраняются, пока открыта вкладка: отчёт можно распечатать в любой момент.</div>'
        : '') +
      '<div class="panel" style="--accent:var(--exam)">' +
        '<div class="exam-title">' +
          (r.vgk ? 'Аттестация на ГСР — билет № ' + r.ticketNo : 'Экзамен завершён') + '</div>' +
        '<div class="summary-grid">' +
          ui.donut(r.percent, null) +
          '<div class="score-rows">' +
            '<div class="score-row"><span>Вопросы (' + r.qTotal + ')</span>' +
              '<span class="v" style="color:var(--tests)">' + r.qCorrect +
              '<small> / ' + r.qTotal + '</small></span></div>' +
            (r.vgk
              ? '<div class="score-row"><span>Ошибок</span>' +
                '<span class="v" style="color:' + (r.mistakes ? 'var(--bad)' : 'var(--ok)') + '">' +
                r.mistakes + '<small> / ' + r.allowedMistakes + ' допустимо</small></span></div>'
              : '<div class="score-row"><span>Задачи (' + r.tTotal + ')</span>' +
                '<span class="v" style="color:var(--tasks)">' + r.tCorrect +
                '<small> / ' + r.tTotal + '</small></span></div>') +
            '<div class="score-row total"><span>Общий балл</span>' +
              '<span class="v">' + r.percent + '<small> / 100</small></span></div>' +
          '</div>' +
        '</div>' +

        '<div class="banner ' + (r.passed ? 'ok' : 'bad') + '">' +
          '<span class="bic">' + (r.passed ? ui.I.cup : ui.I.badCircle) + '</span>' +
          '<div><b>' + (r.passed ? 'Аттестация пройдена' : 'Аттестация не пройдена') + '</b>' +
            '<span>' + verdictText(r) + '</span></div>' +
        '</div>' +

        weakBlock(r) +

        '<div class="actions">' +
          '<button data-act="home">' + ui.I.home + 'Главное меню</button>' +
          '<button data-act="review">Разбор ошибок</button>' +
          '<button data-act="again">Новый экзамен</button>' +
          '<div class="spacer"></div>' +
          '<button class="primary" style="--accent:var(--exam)" data-act="report">' +
            'Просмотр отчёта</button>' +
        '</div>' +
        '<div class="footer-note">Итоги остаются доступными во вкладке «Экзамен» ' +
          'до закрытия вкладки браузера или до начала нового экзамена.</div>' +
      '</div>' +
      ui.tabbar('exam'));

    /* Ниже везде run = null: подход закрыт. Сами итоги живут в состоянии
       сеанса, поэтому уход с экрана их больше не стирает. */
    ui.on(v, '[data-act="home"]', function () { run = null; VGSCH.router.go('start'); });
    ui.on(v, '[data-act="review"]', function () { renderReview(root, r); });
    ui.on(v, '[data-act="report"]', function () {
      VGSCH.router.go('protocol', { result: r });
    });
    ui.on(v, '[data-act="again"]', function () {
      if (!confirm('Начать новый экзамен? Итоги предыдущего будут удалены.')) return;
      run = null;
      VGSCH.state.clearExam();
      renderKindPicker(root);
    });
    /* Прогон по слабым темам. Вопросы взвода лежат в «Вопросах», вопросы
       билетов ВГК — в «Тестах ГСР», поэтому и экран разный. */
    ui.on(v, '[data-act="drill"]', function () {
      var keys = r.weakSections.map(function (s) { return s.key; });
      run = null;
      if (r.vgk) VGSCH.router.go('vgk', { topic: keys[0] });
      else VGSCH.router.go('tests', { sections: keys, reason: 'слабые темы по итогам экзамена' });
    });
    ui.on(v, '[data-drill-one]', function (b) {
      run = null;
      if (r.vgk) VGSCH.router.go('vgk', { topic: b.dataset.drillOne });
      else VGSCH.router.go('tests', { sections: [b.dataset.drillOne] });
    });
    ui.on(v, '.tabbar [data-nav]', function (b) { run = null; VGSCH.router.go(b.dataset.nav); });
  }

  /** Пояснение под вердиктом — по правилам своей аттестации. */
  function verdictText(r) {
    if (r.vgk) {
      return r.passed
        ? 'Ошибок ' + r.mistakes + ' при допустимых ' + r.allowedMistakes +
          '. Затрачено ' + ui.clock(r.elapsedSec) + '.'
        : 'Ошибок ' + r.mistakes + ', допускается не более ' + r.allowedMistakes + '.';
    }
    return r.passed
      ? 'Результат удовлетворяет обоим порогам. Затрачено ' + ui.clock(r.elapsedSec) + '.'
      : 'Требуется не менее ' + cfg.exam.passQuestions + ' верных ответов из ' + r.qTotal +
        ' и не менее ' + cfg.exam.passTasks + ' решённых задач из ' + r.tTotal + '.';
  }

  /** Блок «Слабые темы» с кнопкой повторного прогона. */
  function weakBlock(r) {
    if (!r.weakSections || !r.weakSections.length) return '';

    return '<div class="weak">' +
      '<h4>Слабые темы</h4>' +
      '<p class="muted" style="margin:0 0 12px">Разделы, где были ошибки. Можно сразу ' +
        'прогнать себя по вопросам из них.</p>' +
      '<div class="weak-list">' +
        r.weakSections.map(function (s) {
          var pct = Math.round(s.wrong / s.total * 100);
          return '<button class="weak-item" data-drill-one="' + ui.esc(s.key) + '">' +
            '<span class="wt">' + ui.esc(s.title) + '</span>' +
            '<span class="wn">' + s.wrong + ' из ' + s.total + ' неверно</span>' +
            '<span class="wbar">' + ui.bar(pct, 'var(--bad)') + '</span>' +
            '<span class="wgo">' + ui.I.next + '</span>' +
          '</button>';
        }).join('') +
      '</div>' +
      (r.weakSections.length > 1
        ? '<div class="actions" style="margin-top:14px">' +
          '<button class="primary" style="--accent:var(--tests)" data-act="drill">' +
            'Повторить все слабые темы</button></div>'
        : '') +
      '</div>';
  }

  function renderReview(root, r) {
    var v = ui.paint(root,
      ui.appbar({ mode: 'exam', title: 'Разбор ошибок', backArrow: true }) +
      '<div class="panel" style="--accent:var(--exam)">' +
        '<p class="muted" style="margin:0 0 14px">Верных ответов: ' + r.totalCorrect +
        ' из ' + r.totalItems + '.</p>' +
        r.details.map(function (d) {
          return '<div class="review-item ' + (d.correct ? 'ok' : 'bad') + '">' +
            (d.kind === 'task' ? '<div class="tag">Расчётная задача</div>' : '') +
            '<div class="q">' + d.n + '. ' + ui.esc(d.text) + '</div>' +
            '<div class="line ' + (d.correct ? 'ok' : 'bad') + '"><span class="k">Ваш ответ:</span>' +
              '<span class="a">' + (d.given === null ? 'не дан' : ui.esc(d.given)) + '</span></div>' +
            (d.correct ? '' : '<div class="line ok"><span class="k">Правильный ответ:</span>' +
              '<span class="a">' + ui.esc(d.right) + '</span></div>') +
            (d.npa ? '<div class="line"><span class="k">Основание:</span><span>' +
                     ui.esc(d.npa) + '</span></div>' : '') +
          '</div>';
        }).join('') +
        '<div class="actions">' +
          '<button data-act="back">' + ui.I.prev + 'К результату</button>' +
          '<div class="spacer"></div>' +
          '<button class="primary" style="--accent:var(--exam)" data-act="report">Просмотр отчёта</button>' +
        '</div>' +
      '</div>' +
      ui.tabbar('exam'));

    ui.on(v, '[data-act="back"]', function () { renderResult(root, r, !run); });
    VGSCH.router.setBackHandler(function () { renderResult(root, r, !run); return true; });
    ui.on(v, '.appbar [data-back]', function () { VGSCH.router.back(); });
    ui.on(v, '[data-act="report"]', function () { VGSCH.router.go('protocol', { result: r }); });
    ui.on(v, '.tabbar [data-nav]', function (b) { run = null; VGSCH.router.go(b.dataset.nav); });
  }

  VGSCH.router.register('exam', {
    render: render,
    destroy: function () { stopTimer(); }
  });
})(window.VGSCH = window.VGSCH || {});
