/* Экран 1. Главный: фамилия и инициалы, номер отделения, должность, выбор режима. */
(function (VGSCH) {
  'use strict';

  var ui = VGSCH.ui;
  var cfg = VGSCH.config;

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
    var studyCount = Q.study().length;

    var v = ui.paint(root,
      '<div class="start">' +
        /* Снимок выработки со спасателем — целиком, отдельной фигуры поверх нет.
           Вуаль притеняет только левую часть, где лежат заголовок и поля. */
        '<div class="start-bg"></div>' +
        '<div class="start-veil"></div>' +
        '<div class="start-inner">' +

          '<div class="start-head">' +
            '<div class="brand"><img src="' + ui.asset('assets/img/logo.png') + '" alt="Норникель"></div>' +

            '<h1>Подготовка<br>горноспасателей' +
              '<span class="unit">' + ui.esc(cfg.unitName) + '</span></h1>' +
            '<p class="lead">Учебно-тренировочное приложение для подготовки к аттестации ' +
              'и проверки знаний горноспасателей.</p>' +

            fieldText('fio', 'Фамилия и инициалы', 'Иванов И. И.', st.person) +
            fieldSelect('unit', 'Номер отделения', cfg.units, st.unit) +
            fieldSelect('position', 'Должность', cfg.positions, st.position) +
            '<div class="field-error" id="formError"></div>' +
          '</div>' +

          '<div class="pick-label">Выберите режим работы:</div>' +
          '<div class="modes">' +
            modeCard('tests', ui.I.tests, 'Тесты', 'Тестовые<br>вопросы', readyQuestions > 0) +
            modeCard('tasks', ui.I.tasks, 'Задачи', 'Расчётные<br>задачи', readyTypes > 0) +
            /* Если экзамен уже сдан в этом сеансе, карточка ведёт к его итогам,
               а не к новому подходу — об этом и подпись. */
            modeCard('exam', ui.I.cup, 'Экзамен',
                     VGSCH.state.lastExam()
                       ? 'Результат<br>сохранён'
                       : cfg.exam.questionCount + ' тестов<br>+ ' + cfg.exam.taskCount + ' задачи',
                     examPossible) +
            (studyCount
              ? modeCard('study', ui.I.study, 'Психология',
                         'Ответы<br>для чтения', true)
              : '') +
          '</div>' +

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

    var fio = v.querySelector('#fio');
    var err = v.querySelector('#formError');
    fio.focus();

    v.querySelector('#unit').addEventListener('change', function (e) {
      VGSCH.state.setUnit(e.target.value);
    });
    v.querySelector('#position').addEventListener('change', function (e) {
      VGSCH.state.setPosition(e.target.value);
    });
    fio.addEventListener('input', function (e) {
      VGSCH.state.setPerson(e.target.value);
      err.textContent = '';
    });

    ui.on(v, '.mode-card', function (btn) {
      if (!VGSCH.state.isIdentified()) {
        err.textContent = 'Укажите фамилию и инициалы — они попадут в протокол.';
        fio.focus();
        return;
      }
      VGSCH.state.setPosition(v.querySelector('#position').value);
      VGSCH.router.go(btn.dataset.mode);
    });
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
