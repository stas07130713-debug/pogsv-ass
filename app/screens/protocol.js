/* Отчёт о результатах — макет 08.
 *
 * Печать идёт не с этой страницы, а из отдельного окна с одним лишь бланком.
 * Причина: на телефоне печать текущей страницы часто не срабатывает вовсе —
 * в установленном на рабочий стол приложении окна печати нет, а @media print
 * там ни на что не влияет. Отдельный документ печатается и на компьютере,
 * и на телефоне одинаково, а если открыть окно не дали — тот же бланк
 * сохраняется файлом.
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

    var v = ui.paint(root,
      ui.appbar({ mode: 'exam', title: 'Отчёт о результатах', back: 'exam', backArrow: true }) +
      '<div class="panel" style="--accent:var(--exam)">' +
        '<div class="report-grid">' +
          '<div class="protocol" id="protocol">' + protocolMarkup(r, st) + '</div>' +
          '<img class="report-photo" src="' + ui.asset('assets/img/report-rescuer.png') + '" alt="">' +
        '</div>' +

        '<div class="actions no-print">' +
          '<button class="ok" data-act="print">' + ui.I.print + 'Скачать PDF</button>' +
          '<button data-act="save">' + ui.I.copy + 'Сохранить файлом</button>' +
          '<div class="spacer"></div>' +
          '<button data-act="close">' + ui.I.prev + 'К результату</button>' +
        '</div>' +
        '<div class="field-error no-print" id="printNote"></div>' +
        '<div class="footer-note no-print">Бланк откроется отдельной страницей. ' +
        'На компьютере в окне печати выберите принтер «Сохранить как PDF»; ' +
        'на телефоне — «Поделиться» и затем «Печать» или «Сохранить в PDF».</div>' +
      '</div>' +
      ui.tabbar('exam'));

    var note = v.querySelector('#printNote');

    ui.on(v, '[data-act="print"]', function () { openPrintable(r, st, note); });
    ui.on(v, '[data-act="save"]', function () {
      download(printableHtml(r, st), fileName(st, r));
      say(note, 'Файл сохранён в загрузки. Откройте его и распечатайте ' +
                'или сохраните в PDF средствами телефона.', 'dim');
    });
    ui.on(v, '[data-act="close"]', function () { VGSCH.router.go('exam'); });
    ui.wireNav(v);
  }

  /* ------------------------------------------------------------- бланк ---- */

  /**
   * Разметка бланка. Одна и та же и на экране, и в печатном документе:
   * иначе распечатка со временем расходится с тем, что человек видел.
   */
  function protocolMarkup(r, st) {
    var errors = r.details.filter(function (d) { return !d.correct; });

    return '<h3>ПРОТОКОЛ ПРОВЕРКИ ЗНАНИЙ</h3>' +
      '<dl>' +
        '<dt>ФИО:</dt><dd>' + ui.esc(st.person) + '</dd>' +
        (st.unit ? '<dt>Номер отделения:</dt><dd>' + ui.esc(st.unit) + '</dd>' : '') +
        (st.position ? '<dt>Должность:</dt><dd>' + ui.esc(st.position) + '</dd>' : '') +
        /* Дата экзамена, а не дата печати: к отчёту можно вернуться позже. */
        '<dt>Дата:</dt><dd>' + ui.dateTime(r.finishedAt || new Date()) + '</dd>' +
        '<dt>Затрачено:</dt><dd>' + ui.clock(r.elapsedSec) +
          (cfg.exam.timeLimitMin ? ' из ' + cfg.exam.timeLimitMin + ':00' : '') + '</dd>' +
      '</dl>' +

      '<table class="t-score">' +
        '<colgroup><col><col><col><col></colgroup>' +
        '<tr><th>Раздел</th><th class="r">Результат</th>' +
          '<th class="r">Порог</th><th class="r">%</th></tr>' +
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

      '<p class="verdict-line">' + (r.passed ? 'Экзамен сдан.' : 'Экзамен не сдан.') + '</p>' +

      (errors.length
        /* Основание идёт строкой под вопросом, а не отдельным столбцом:
           четвёртая колонка на телефоне сжимала вопрос до нечитаемой лапши. */
        ? '<h3 class="h-errors">ОШИБКИ</h3><table class="t-errors">' +
          '<colgroup><col class="c-n"><col class="c-q"><col class="c-a"></colgroup>' +
          '<tr><th>№</th><th>Вопрос</th><th>Правильный ответ</th></tr>' +
          errors.map(function (d) {
            return '<tr><td class="num">' + d.n + '</td>' +
              '<td>' + ui.esc(d.text) +
                (d.npa ? '<span class="src">' + ui.esc(d.npa) + '</span>' : '') + '</td>' +
              '<td>' + ui.esc(d.right) + '</td></tr>';
          }).join('') + '</table>'
        : '<p>Все вопросы и задачи отвечены верно.</p>') +

      '<div class="sign">' +
        '<span>Проверяемый ____________ / ' + ui.esc(st.person) + ' /</span>' +
        '<span>Проверяющий ____________ / ____________ /</span>' +
      '</div>';
  }

  /* ------------------------------------------------------------ печать ---- */

  /** Самостоятельный документ: свои стили внутри, ничего не подгружает. */
  function printableHtml(r, st) {
    return '<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>Протокол проверки знаний — ' + ui.esc(st.person || '') + '</title>' +
      '<style>' + PRINT_CSS + '</style></head><body>' +
      '<div class="protocol">' + protocolMarkup(r, st) + '</div>' +
      '</body></html>';
  }

  function openPrintable(r, st, note) {
    var html = printableHtml(r, st);
    var w = null;
    try { w = window.open('', '_blank'); } catch (e) { w = null; }

    if (!w || !w.document) {
      /* Окно не открылось: блокировщик всплывающих окон либо режим
         установленного приложения. Отдаём тот же бланк файлом. */
      download(html, fileName(st, r));
      say(note, 'Открыть отдельное окно не удалось — бланк сохранён файлом ' +
                'в загрузки. Откройте его и распечатайте оттуда.', 'dim');
      return;
    }

    w.document.open();
    w.document.write(html);
    w.document.close();

    var go = function () {
      try { w.focus(); w.print(); } catch (e) { /* печать вызовет сам пользователь */ }
    };
    /* Печать только после вёрстки: иначе на части телефонов уходит пустая страница. */
    if (w.document.readyState === 'complete') window.setTimeout(go, 350);
    else w.addEventListener('load', function () { window.setTimeout(go, 350); });

    say(note, 'Бланк открыт отдельной страницей. Если окно печати не появилось, ' +
              'вызовите печать сами: на телефоне — «Поделиться» → «Печать».', 'dim');
  }

  function download(html, name) {
    var blob = new Blob(['﻿', html], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function fileName(st, r) {
    var d = r.finishedAt || new Date();
    var p = function (n) { return String(n).padStart(2, '0'); };
    var who = String(st.person || 'протокол').replace(/[^0-9A-Za-zА-Яа-яЁё]+/g, '-').replace(/^-|-$/g, '');
    return 'Протокол-' + who + '-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '.html';
  }

  function say(node, text, kind) {
    if (!node) return;
    node.textContent = text;
    node.style.color = kind === 'bad' ? 'var(--bad)' : 'var(--text-dim)';
  }

  /* Стили печатного документа. Держатся здесь, а не в общем файле: документ
     обязан быть самодостаточным — он открывается из blob и ничего не грузит. */
  var PRINT_CSS = [
    '@page { size: A4 portrait; margin: 14mm 12mm; }',
    'body { margin: 0; background: #fff; color: #14181d;',
    '  font: 11pt/1.4 "Segoe UI", Arial, sans-serif; }',
    '.protocol { max-width: 190mm; margin: 0 auto; padding: 10px 12px; }',
    'h3 { font-size: 12.5pt; margin: 0 0 10px; letter-spacing: .4px; }',
    'h3.h-errors { margin-top: 16px; }',
    'dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 12px;',
    '  margin: 0 0 12px; font-size: 10.5pt; }',
    'dt { color: #55606c; }',
    'dd { margin: 0; font-weight: 600; }',
    'table { width: 100%; border-collapse: collapse; table-layout: fixed;',
    '  margin-bottom: 6px; }',
    'th, td { border-bottom: 1px solid #c9cdd3; padding: 5px 4px; text-align: left;',
    '  font-size: 10pt; vertical-align: top; overflow-wrap: anywhere; }',
    'th { color: #55606c; font-weight: 500; }',
    'th.r { text-align: right; }',
    'td.num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }',
    'tr.total td, tr.total th { border-top: 2px solid #98a1ac; border-bottom: none;',
    '  font-weight: 700; }',
    '.accent { color: #b8500f; }',
    '.verdict-line { margin: 10px 0 0; font-weight: 700; }',
    '.t-errors .c-n { width: 7%; }',
    '.t-errors .c-q { width: 60%; }',
    '.t-errors .c-a { width: 33%; }',
    '.t-errors tr { break-inside: avoid; page-break-inside: avoid; }',
    '.src { display: block; margin-top: 3px; font-size: 8.5pt; color: #6b7480; }',
    '.sign { margin-top: 22px; display: flex; justify-content: space-between;',
    '  gap: 18px; font-size: 9.5pt; color: #47505a; }',
    '@media screen and (max-width: 620px) {',
    '  body { font-size: 15px; }',
    '  .protocol { padding: 14px 12px; }',
    '  th, td { font-size: 12.5px; padding: 5px 3px; }',
    '  .sign { flex-direction: column; gap: 12px; }',
    '}'
  ].join('\n');

  VGSCH.router.register('protocol', { render: render });
})(window.VGSCH = window.VGSCH || {});
