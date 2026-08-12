/* Отчёт о результатах — макет 08.
 *
 * Печатается средствами браузера; в окне печати выбирается «Сохранить как PDF».
 * Шапка, кнопки и фотография в печать не попадают (см. @media print).
 */
(function (VGSCH) {
  'use strict';

  var ui = VGSCH.ui;
  var cfg = VGSCH.config;

  function render(root, params) {
    /* Обычно итоги приходят параметром. Запасной путь — результат последнего
       экзамена из состояния сеанса: он же используется, когда пользователь
       вернулся к отчёту позже, а не сразу после завершения. */
    var r = (params && params.result) || VGSCH.state.lastExam();

    if (!r) {
      ui.wireNav(ui.paint(root,
        ui.appbar({ mode: 'exam', title: 'Отчёт о результатах', back: 'exam', backArrow: true }) +
        '<div class="panel"><div class="notice">В этом сеансе экзамен ещё не проходили — ' +
        'отчёт составлять не из чего.</div><div class="actions">' +
        '<button class="primary" style="--accent:var(--exam)" data-nav="exam">' +
        'К экзамену</button></div></div>' + ui.tabbar('exam')));
      return;
    }

    var st = VGSCH.state.data;
    var errors = r.details.filter(function (d) { return !d.correct; });

    var v = ui.paint(root,
      ui.appbar({ mode: 'exam', title: 'Отчёт о результатах', back: 'exam', backArrow: true }) +
      '<div class="panel" style="--accent:var(--exam)">' +
        '<div class="report-grid">' +
          '<div class="protocol" id="protocol">' +
            '<h3>ПРОТОКОЛ ПРОВЕРКИ ЗНАНИЙ</h3>' +
            '<dl>' +
              '<dt>ФИО:</dt><dd>' + ui.esc(st.person) + '</dd>' +
              (st.unit ? '<dt>Номер отделения:</dt><dd>' + ui.esc(st.unit) + '</dd>' : '') +
              (st.position ? '<dt>Должность:</dt><dd>' + ui.esc(st.position) + '</dd>' : '') +
              /* Дата экзамена, а не дата печати: к отчёту можно вернуться позже. */
              '<dt>Дата:</dt><dd>' + ui.dateTime(r.finishedAt || new Date()) + '</dd>' +
              '<dt>Затрачено:</dt><dd>' + ui.clock(r.elapsedSec) +
                (cfg.exam.timeLimitMin ? ' из ' + cfg.exam.timeLimitMin + ':00' : '') + '</dd>' +
            '</dl>' +

            '<table>' +
              '<tr><th>Раздел</th><th style="text-align:right">Результат</th>' +
                '<th style="text-align:right">Порог</th><th style="text-align:right">%</th></tr>' +
              '<tr><td>Тесты (' + r.qTotal + ' вопросов)</td>' +
                '<td class="num">' + r.qCorrect + ' / ' + r.qTotal + '</td>' +
                '<td class="num">' + cfg.exam.passQuestions + '</td>' +
                '<td class="num">' + Math.round(r.qCorrect / r.qTotal * 100) + ' %</td></tr>' +
              '<tr><td>Задачи (' + r.tTotal + ' задачи)</td>' +
                '<td class="num">' + r.tCorrect + ' / ' + r.tTotal + '</td>' +
                '<td class="num">' + cfg.exam.passTasks + '</td>' +
                '<td class="num">' + Math.round(r.tCorrect / r.tTotal * 100) + ' %</td></tr>' +
              '<tr class="total"><th>Общий результат</th>' +
                '<td class="num">' + r.totalCorrect + ' / ' + r.totalItems + '</td>' +
                '<td class="num">—</td>' +
                '<td class="num accent">' + r.percent + ' %</td></tr>' +
            '</table>' +

            '<p style="margin-top:14px;font-weight:700">' +
              (r.passed ? 'Экзамен сдан.' : 'Экзамен не сдан.') + '</p>' +

            (errors.length
              ? '<h3 style="margin-top:20px">ОШИБКИ</h3><table>' +
                '<tr><th style="width:8%">№</th><th>Вопрос</th><th style="width:28%">Правильный ответ</th>' +
                '<th style="width:24%">Основание</th></tr>' +
                errors.map(function (d) {
                  return '<tr><td class="num">' + d.n + '</td><td>' + ui.esc(d.text) + '</td>' +
                    '<td>' + ui.esc(d.right) + '</td><td>' + ui.esc(d.npa || '—') + '</td></tr>';
                }).join('') + '</table>'
              : '<p>Все вопросы и задачи отвечены верно.</p>') +

            '<div class="sign">' +
              '<span>Проверяемый ____________ / ' + ui.esc(st.person) + ' /</span>' +
              '<span>Проверяющий ____________ / ____________ /</span>' +
            '</div>' +
          '</div>' +

          '<img class="report-photo" src="' + ui.asset('assets/img/report-rescuer.png') + '" alt="">' +
        '</div>' +

        '<div class="actions no-print">' +
          '<button class="ok" data-act="print">' + ui.I.print + 'Скачать PDF</button>' +
          '<div class="spacer"></div>' +
          '<button data-act="close">' + ui.I.prev + 'К результату</button>' +
        '</div>' +
        '<div class="footer-note no-print">В окне печати выберите принтер «Сохранить как PDF», ' +
        'чтобы получить файл вместо распечатки.</div>' +
      '</div>' +
      ui.tabbar('exam'));

    ui.on(v, '[data-act="print"]', function () { window.print(); });
    ui.on(v, '[data-act="close"]', function () { VGSCH.router.go('exam'); });
    ui.wireNav(v);
  }

  VGSCH.router.register('protocol', { render: render });
})(window.VGSCH = window.VGSCH || {});
