/* Экран 3. Режим «Задачи» — макеты 03 и 06.
 *
 * Значения генерируются заново при каждом запуске. Показывается только задача
 * со статусом VALID. Решение разбирается по шагам, как на макете 06.
 */
(function (VGSCH) {
  'use strict';

  var ui = VGSCH.ui;
  var units = VGSCH.engine.units;
  var pipeline = VGSCH.engine.pipeline;
  var types = VGSCH.data.taskTypes;

  var current = null;
  var group = null;
  var solved = 0;

  /* Формы для склонения: 1 тип, 2 типа, 5 типов. */
  var TYPE_FORMS = ['тип', 'типа', 'типов'];

  function render(root) {
    current = null; group = null; solved = 0;
    renderPicker(root);
  }

  /* --------------------------------------------------------- выбор группы */

  function renderPicker(root) {
    var groups = types.activeGroups().filter(function (g) {
      return types.enabled(g).some(function (t) { return VGSCH.engine.generator.BUILDERS[t.id]; });
    });

    var v = ui.paint(root,
      ui.appbar({ mode: 'tasks', title: 'Задачи' }) +
      '<div class="panel" style="--accent:var(--tasks)">' +
        '<h3 style="margin-bottom:6px">Выберите группу задач</h3>' +
        '<p class="muted" style="margin:0 0 14px">Значения генерируются заново при каждом ' +
        'запуске и проверяются независимым расчётом.</p>' +
        '<div class="pick-list">' +
          '<button class="pick-item" data-group=""><span class="t">Все группы</span>' +
            '<span class="n">' + ui.count(implementedCount(), TYPE_FORMS) + '</span></button>' +
          groups.map(function (g) {
            var n = types.enabled(g).filter(function (t) {
              return VGSCH.engine.generator.BUILDERS[t.id];
            }).length;
            return '<button class="pick-item" data-group="' + ui.esc(g) + '">' +
              '<span class="t">' + ui.esc(g) + '</span>' +
              '<span class="n">' + ui.count(n, TYPE_FORMS) + '</span></button>';
          }).join('') +
        '</div>' +
      '</div>' +
      ui.tabbar('tasks'));

    ui.wireNav(v);
    ui.on(v, '.pick-item', function (b) {
      group = b.dataset.group || null;
      solved = 0;
      nextTask(root);
    });
  }

  function implementedCount() {
    return types.enabled().filter(function (t) { return VGSCH.engine.generator.BUILDERS[t.id]; }).length;
  }

  /**
   * Контекст задачи для сообщения об ошибке. Помимо условия передаём seed:
   * по нему задача воспроизводится с теми же числами.
   */
  function taskContext(t, mode) {
    var ans = t.answer.type === 'numeric'
      ? units.fmt(t.answer.value, t.answer.decimals) + ' ' + t.answer.unit
      : t.answer.options.filter(function (o) { return o.value === t.answer.value; })[0].label;

    return {
      mode: mode, kind: 'Задача', id: t.task_id + ' (тип ' + t.type_id + ')',
      text: t.question,
      /* Каждая строка — «метка: значение»: так обращение читается
         в одной ячейке таблицы, куда его кладёт Google Форма. */
      extra: 'Ответ по расчёту: ' + ans + '\n' +
        'Основание: ' + t.normative_basis.map(function (b) { return b.document + ', ' + b.point; }).join('; ') + '\n' +
        'Зерно генерации: ' + t.seed + ' (воспроизводит задачу с теми же числами)\n' +
        'Ход решения: ' +
        t.solution_steps.map(function (s, i) {
          return (i + 1) + ') ' + s.label + ' = ' + s.value;
        }).join(' · ')
    };
  }

  /* ------------------------------------------------------------ задача --- */

  function nextTask(root) {
    var res;
    try {
      res = pipeline.produce(group);
    } catch (e) {
      var errView = ui.paint(root,
        ui.appbar({ mode: 'tasks', title: 'Задачи', backArrow: true }) +
        '<div class="panel"><div class="notice">Не удалось сгенерировать задачу: ' +
        ui.esc(e.message) + '</div>' +
        '<div class="actions"><button data-nav="start">' + ui.I.home + 'Главная</button></div></div>' +
        ui.tabbar('tasks'));
      ui.wireNav(errView);
      return;
    }
    current = { task: res.task, answered: false, correct: null, given: null };
    renderTask(root);
  }

  function renderTask(root) {
    var t = current.task;
    var type = types.byId(t.type_id);

    var v = ui.paint(root,
      ui.appbar({ mode: 'tasks', title: 'Задачи', backArrow: true }) +
      ui.progress(solved, solved + 1, 'Задача ' + (solved + 1) + ' · ' + type.title, 'var(--tasks)') +
      '<div class="panel" style="--accent:var(--tasks)">' +
        '<div class="qbox">' +
          '<div class="muted" style="margin-bottom:8px">' + ui.esc(t.category) +
            ' · сложность: ' + ui.esc(t.difficulty) + '</div>' +
          '<div class="question" style="margin:0">' + ui.esc(t.question) + '</div>' +
        '</div>' +
        (t.scheme && t.scheme.required
          ? '<div class="scheme-wrap">' + VGSCH.engine.scheme.render(t) + '</div>' : '') +
        renderInputs(t) +
        '<div id="answerArea">' + renderAnswerInput(t) + '</div>' +
        /* Кнопки идут раньше обращения об ошибке: главное действие не должно
           уезжать вниз за второстепенной кнопкой. */
        '<div class="actions">' +
          '<button data-act="picker">' + ui.I.prev + 'Назад</button>' +
          '<div class="spacer"></div>' +
          '<button id="check" class="primary" style="--accent:var(--tests)">Проверить</button>' +
        '</div>' +
        VGSCH.feedback.button() +
      '</div>' +
      ui.tabbar('tasks'));

    /* Из условия задачи стрелка возвращает к выбору группы. */
    VGSCH.router.setBackHandler(function () { renderPicker(root); return true; });
    ui.wireNav(v);
    VGSCH.feedback.wire(v, function () { return taskContext(t, 'Задачи'); });
    ui.on(v, '[data-act="picker"]', function () { renderPicker(root); });
    v.querySelector('#check').onclick = function () { check(root, v); };

    var inp = v.querySelector('#numAnswer');
    if (inp) {
      inp.focus();
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') check(root, v); });
    } else {
      ui.on(v, '.option', function (b) {
        v.querySelectorAll('.option').forEach(function (x) { x.classList.remove('is-picked'); });
        b.classList.add('is-picked');
      });
    }
  }

  /** Блок исходных данных — как в бумажной задаче (макет 03). */
  function renderInputs(t) {
    var rows = [];
    var i = t.inputs;

    if (i.initialPressureMPa !== undefined) {
      rows.push('Давление в баллоне ДА: ' + units.fmt(i.initialPressureMPa) + ' МПа');
      rows.push('Резервный запас: ' + units.fmt(i.reservePressureMPa) + ' МПа');
    }
    if (i.consumptionPer100mMPa !== undefined) {
      rows.push('Расход на 100 м пути: ' + units.fmt(i.consumptionPer100mMPa) + ' МПа');
    }
    if (i.segments && i.segments.length > 1) {
      i.segments.forEach(function (s, k) {
        rows.push('Участок ' + (k + 1) + ': ' + units.fmt(s.lengthM) + ' м, ' +
          (s.incline === 'горизонталь' ? 'горизонтальная выработка'
            : s.incline + ' ' + units.fmt(s.slopeDeg) + '°') +
          ', расход ' + units.fmt(s.consumptionMPa) + ' МПа');
      });
    }
    if (i.returnConsumptionMPa !== undefined) {
      rows.push('Расход на обратный путь: ' + units.fmt(i.returnConsumptionMPa) + ' МПа');
    }
    if (i.temperaturesC) {
      rows.push('Температура воздуха: ' +
        i.temperaturesC.map(function (v) { return units.fmt(v) + ' °C'; }).join(', '));
    }
    if (i.t0C !== undefined) {
      rows.push('Температура при входе: ' + units.fmt(i.t0C) + ' °C');
      rows.push('Температура через 5 минут: ' + units.fmt(i.t1C) + ' °C');
    }
    if (i.excavationHeightM !== undefined) {
      rows.push('Высота выработки: ' + units.fmt(i.excavationHeightM) + ' м');
      rows.push('Угол наклона: ' + units.fmt(i.slopeDeg) + '°');
      rows.push('Вид работы: ' + i.work);
      rows.push('Атмосфера: ' + i.atmosphere + ' для дыхания');
    }
    if (i.visibilityM !== undefined) rows.push('Расстояние видимости: ' + units.fmt(i.visibilityM) + ' м');
    if (i.routeLengthM !== undefined) rows.push('Длина маршрута: ' + units.fmt(i.routeLengthM) + ' м');

    if (!rows.length) return '';
    return '<div class="task-inputs"><h4>Исходные данные</h4><ul>' +
      rows.map(function (r) { return '<li>' + ui.esc(r) + '</li>'; }).join('') + '</ul></div>';
  }

  function renderAnswerInput(t) {
    if (t.answer.type === 'numeric') {
      return '<div class="field"><div class="muted" style="margin-bottom:8px">Введите ответ' +
        ' (' + ui.esc(t.answer.unit) + '), с точностью ' +
        ui.precision(t.answer.decimals) + ':</div>' +
        '<div class="answer-row">' +
          '<input type="text" id="numAnswer" inputmode="decimal" autocomplete="off" ' +
                 'placeholder="Числовое значение">' +
          '<span class="unit">' + ui.esc(t.answer.unit) + '</span>' +
        '</div><div class="field-error" id="ansError"></div></div>';
    }
    return '<div class="muted" style="margin:16px 0 8px">Выберите ответ:</div>' +
      '<div class="options">' +
        t.answer.options.map(function (o, i) {
          return '<button class="option" data-v="' + (o.value ? '1' : '0') + '" data-i="' + i + '">' +
            '<span class="marker"></span><span class="let">' + 'АБ'[i] + '.</span>' +
            '<span>' + ui.esc(o.label) + '</span></button>';
        }).join('') + '</div>';
  }

  /* ----------------------------------------------------------- проверка -- */

  function check(root, view) {
    if (current.answered) return;
    var t = current.task;
    var correct;

    if (t.answer.type === 'numeric') {
      var raw = String(view.querySelector('#numAnswer').value).trim().replace(',', '.');
      var num = parseFloat(raw);
      if (raw === '' || !isFinite(num)) {
        view.querySelector('#ansError').textContent = 'Введите числовое значение.';
        return;
      }
      view.querySelector('#ansError').textContent = '';
      var tol = t.tolerances.numeric_abs + 0.5 * Math.pow(10, -t.answer.decimals);
      correct = Math.abs(num - t.answer.value) <= tol;
      current.given = units.fmt(num, t.answer.decimals) + ' ' + t.answer.unit;
    } else {
      var picked = view.querySelector('.option.is-picked');
      if (!picked) {
        view.querySelector('#answerArea').insertAdjacentHTML('beforeend',
          '<div class="field-error">Выберите вариант ответа.</div>');
        return;
      }
      correct = (picked.dataset.v === '1') === t.answer.value;
      current.given = picked.textContent.trim();
    }

    current.answered = true;
    current.correct = correct;
    solved++;
    renderSolution(root, 0);
  }

  /* ---------------------------------------------- пошаговое решение (06) - */

  /**
   * @param keepScroll true при переходе между шагами одного решения:
   *        шапка и разбор ответа на месте, меняется только тело шага —
   *        поднимать страницу наверх не нужно, это только сбивает чтение.
   *        При первом открытии решения (после «Проверить») прокрутка
   *        сбрасывается, потому что экран меняется целиком.
   */
  function renderSolution(root, stepIndex, keepScroll) {
    var t = current.task;
    var steps = t.solution_steps;
    var s = steps[stepIndex];
    var answerText = t.answer.type === 'numeric'
      ? units.fmt(t.answer.value, t.answer.decimals) + ' ' + t.answer.unit
      : t.answer.options.filter(function (o) { return o.value === t.answer.value; })[0].label;

    var v = ui.paint(root, (
      ui.appbar({ mode: 'tasks', title: 'Решение задачи', backArrow: true }) +
      ui.progress(stepIndex + 1, steps.length,
                  'Шаг ' + (stepIndex + 1) + ' из ' + steps.length, 'var(--tasks)') +
      '<div class="panel" style="--accent:var(--tasks)">' +
        '<div class="verdict ' + (current.correct ? 'ok' : 'bad') + '">' +
          '<img class="verdict-photo" src="' +
            ui.asset('assets/img/rescuer-' + (current.correct ? 'ok' : 'wrong') + '.jpg') + '" alt="">' +
          '<div><b>' + (current.correct ? 'Верно!' : 'Неверно') + '</b>' +
            '<span class="txt">Ваш ответ: ' + ui.esc(current.given) + '<br>' +
            'Правильный ответ: <b style="display:inline">' + ui.esc(answerText) + '</b></span></div>' +
        '</div>' +

        '<div class="solve">' +
          '<div class="solve-nav">' +
            steps.map(function (st, i) {
              return '<button data-step="' + i + '"' + (i === stepIndex ? ' class="is-active"' : '') + '>' +
                '<span class="n">' + (i + 1) + '</span><span>' + ui.esc(st.label) + '</span></button>';
            }).join('') +
          '</div>' +
          '<div class="solve-body">' +
            '<h4>' + (stepIndex + 1) + '. ' + ui.esc(s.label) + '</h4>' +
            '<div class="val">' + ui.esc(s.value) + '</div>' +
            (s.detail ? '<div class="dt">' + ui.esc(s.detail) + '</div>' : '') +
            (s.point ? '<div class="pt">Основание: ' + ui.esc(s.point) + '</div>' : '') +
          '</div>' +
        '</div>' +

        '<div class="muted" style="margin-top:14px">Нормативное основание задачи: ' +
          t.normative_basis.map(function (b) { return ui.esc(b.document + ', ' + b.point); }).join('; ') +
        '</div>' +

        '<div class="actions">' +
          '<button data-act="prevStep"' + (stepIndex === 0 ? ' disabled' : '') + '>' +
            ui.I.prev + 'Назад</button>' +
          '<div class="spacer"></div>' +
          (stepIndex < steps.length - 1
            ? '<button class="primary" style="--accent:var(--tests)" data-act="nextStep">Далее' + ui.I.next + '</button>'
            : '<button class="primary" style="--accent:var(--tests)" data-act="nextTask">Следующая задача' + ui.I.next + '</button>') +
        '</div>' +

        VGSCH.feedback.button() +
      '</div>' +
      ui.tabbar('tasks')), { keepScroll: !!keepScroll });

    /* Из разбора решения — тоже к выбору группы: задача уже решена. */
    VGSCH.router.setBackHandler(function () { renderPicker(root); return true; });
    ui.wireNav(v);
    VGSCH.feedback.wire(v, function () { return taskContext(t, 'Задачи — решение'); });
    ui.on(v, '[data-step]', function (b) { renderSolution(root, parseInt(b.dataset.step, 10), true); });
    ui.on(v, '[data-act="prevStep"]', function () { renderSolution(root, stepIndex - 1, true); });
    ui.on(v, '[data-act="nextStep"]', function () { renderSolution(root, stepIndex + 1, true); });
    ui.on(v, '[data-act="nextTask"]', function () { nextTask(root); });
  }

  VGSCH.router.register('tasks', { render: render, destroy: function () { current = null; } });
})(window.VGSCH = window.VGSCH || {});
