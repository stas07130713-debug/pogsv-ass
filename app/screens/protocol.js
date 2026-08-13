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
          '<button class="ok" data-act="pdf">' + ui.I.print + 'Скачать PDF</button>' +
          '<div class="spacer"></div>' +
          '<button data-act="close">' + ui.I.prev + 'К результату</button>' +
        '</div>' +
        '<div class="field-error no-print" id="printNote"></div>' +
        '<div class="footer-note no-print">Файл сохраняется в загрузки — ' +
        'и на компьютере, и на телефоне. Ничего выбирать не нужно.</div>' +
      '</div>' +
      ui.tabbar('exam'));

    var note = v.querySelector('#printNote');

    ui.on(v, '[data-act="pdf"]', function (btn) { savePdf(r, st, btn, note); });
    ui.on(v, '[data-act="close"]', function () { VGSCH.router.go('exam'); });
    ui.wireNav(v);
  }

  /** «из 30:00» — лимит времени своей аттестации. */
  function limitText(r) {
    var limit = r.vgk ? cfg.examVgk.timeLimitMin : cfg.exam.timeLimitMin;
    return limit ? ' из ' + limit + ':00' : '';
  }
  /* --------------------------------------------------------------- PDF ---- */

  function savePdf(r, st, btn, note) {
    btn.disabled = true;
    say(note, 'Готовим файл…', 'dim');
    /* Отрисовка листов заметно нагружает страницу, поэтому отдаём браузеру
       кадр на перерисовку кнопки — иначе «Готовим файл…» не успевает
       появиться и выглядит, будто нажатие не сработало. */
    window.setTimeout(function () {
      try {
        var pages = renderPages(r, st);
        VGSCH.pdf.save(VGSCH.pdf.fromCanvases(pages), pdfName(st, r));
        say(note, 'Файл «' + pdfName(st, r) + '» сохранён в загрузки.', 'ok');
      } catch (e) {
        say(note, 'Не удалось собрать файл: ' + (e && e.message ? e.message : 'ошибка') +
                  '. Протокол можно распечатать со страницы.', 'bad');
      }
      btn.disabled = false;
    }, 60);
  }

  function pdfName(st, r) {
    var d = r.finishedAt || new Date();
    var p = function (n) { return String(n).padStart(2, '0'); };
    var who = String(st.person || 'протокол').replace(/[^0-9A-Za-zА-Яа-яЁё]+/g, '-').replace(/^-|-$/g, '');
    return 'Протокол-' + who + '-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '.pdf';
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
        '<dt>Аттестация:</dt><dd>' +
          (r.vgk ? 'спасателей на ГСР, билет № ' + r.ticketNo : 'взвода') + '</dd>' +
        '<dt>ФИО:</dt><dd>' + ui.esc(st.person) + '</dd>' +
        (st.unit ? '<dt>Номер отделения:</dt><dd>' + ui.esc(st.unit) + '</dd>' : '') +
        (st.position ? '<dt>Должность:</dt><dd>' + ui.esc(st.position) + '</dd>' : '') +
        /* Дата экзамена, а не дата печати: к отчёту можно вернуться позже. */
        '<dt>Дата:</dt><dd>' + ui.dateTime(r.finishedAt || new Date()) + '</dd>' +
        '<dt>Затрачено:</dt><dd>' + ui.clock(r.elapsedSec) + limitText(r) + '</dd>' +
      '</dl>' +

      '<table class="t-score">' +
        '<colgroup><col><col><col><col></colgroup>' +
        '<tr><th>Раздел</th><th class="r">Результат</th>' +
          '<th class="r">Порог</th><th class="r">%</th></tr>' +
        '<tr><td>Вопросы (' + r.qTotal + ')</td>' +
          '<td class="num">' + r.qCorrect + ' / ' + r.qTotal + '</td>' +
          '<td class="num">' + (r.vgk ? r.qTotal - r.allowedMistakes : cfg.exam.passQuestions) + '</td>' +
          '<td class="num">' + Math.round(r.qCorrect / r.qTotal * 100) + ' %</td></tr>' +
        /* У аттестации на ГСР расчётных задач нет — строки в протоколе тоже. */
        (r.vgk
          ? '<tr><td>Ошибок</td>' +
            '<td class="num">' + r.mistakes + '</td>' +
            '<td class="num">не более ' + r.allowedMistakes + '</td>' +
            '<td class="num">—</td></tr>'
          : '<tr><td>Задачи (' + r.tTotal + ')</td>' +
            '<td class="num">' + r.tCorrect + ' / ' + r.tTotal + '</td>' +
            '<td class="num">' + cfg.exam.passTasks + '</td>' +
            '<td class="num">' + Math.round(r.tCorrect / r.tTotal * 100) + ' %</td></tr>') +
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

  /* ------------------------------------------------ отрисовка листов ---- */

  /* Лист A4 при 150 точках на дюйм: достаточно для печати и не раздувает файл.
     Все размеры ниже — в этих же точках холста, поэтому вынесены в константы:
     менять масштаб можно одним числом. */
  var DPI = 150;
  var PAGE_W = Math.round(8.27 * DPI);   // 1240
  var PAGE_H = Math.round(11.69 * DPI);  // 1754
  var MARGIN = Math.round(0.55 * DPI);   // поля листа
  var FONT = '"Segoe UI", Roboto, Arial, sans-serif';

  var INK = '#14181d';        // основной текст
  var INK_SOFT = '#55606c';   // подписи полей и заголовки столбцов
  var RULE = '#c2c8d0';       // линейки таблиц
  var ACCENT = '#b8500f';     // итоговый процент

  /**
   * Готовит страницы протокола.
   * Возвращает массив холстов: сколько листов вышло, столько и страниц в PDF.
   */
  function renderPages(r, st) {
    var pages = [];
    var ctx = newPage(pages);
    var y = MARGIN;

    function need(h) {
      /* Не влезает — начинаем новый лист. */
      if (y + h <= PAGE_H - MARGIN) return;
      ctx = newPage(pages);
      y = MARGIN;
    }

    /* ---- шапка ---- */
    ctx.fillStyle = INK;
    ctx.font = '700 ' + px(13) + 'px ' + FONT;
    ctx.fillText('ПРОТОКОЛ ПРОВЕРКИ ЗНАНИЙ', MARGIN, y + px(13));
    y += px(30);

    /* ---- кто и когда ---- */
    var rows = [
      ['Аттестация:', r.vgk ? 'спасателей на ГСР, билет № ' + r.ticketNo : 'взвода'],
      ['ФИО:', st.person || '—'],
      ['Номер отделения:', st.unit || '—'],
      ['Должность:', st.position || '—'],
      ['Дата:', ui.dateTime(r.finishedAt || new Date())],
      ['Затрачено:', ui.clock(r.elapsedSec) + limitText(r)]
    ];
    var labelW = px(115);
    rows.forEach(function (row) {
      ctx.font = px(10.5) + 'px ' + FONT;
      ctx.fillStyle = INK_SOFT;
      ctx.fillText(row[0], MARGIN, y + px(10.5));
      ctx.font = '600 ' + px(10.5) + 'px ' + FONT;
      ctx.fillStyle = INK;
      ctx.fillText(row[1], MARGIN + labelW, y + px(10.5));
      y += px(17);
    });
    y += px(12);

    /* ---- сводная таблица ---- */
    var W = PAGE_W - MARGIN * 2;
    var colScore = [W - px(255), px(105), px(70), px(80)];
    y = table(ctx, y, MARGIN, colScore,
      ['Раздел', 'Результат', 'Порог', '%'],
      [
        ['Вопросы (' + r.qTotal + ')', r.qCorrect + ' / ' + r.qTotal,
         String(r.vgk ? r.qTotal - r.allowedMistakes : cfg.exam.passQuestions),
         Math.round(r.qCorrect / r.qTotal * 100) + ' %'],
        (r.vgk
          ? ['Ошибок', String(r.mistakes), 'не более ' + r.allowedMistakes, '—']
          : ['Задачи (' + r.tTotal + ')', r.tCorrect + ' / ' + r.tTotal,
             String(cfg.exam.passTasks), Math.round(r.tCorrect / r.tTotal * 100) + ' %']),
        ['Общий результат', r.totalCorrect + ' / ' + r.totalItems, '—', r.percent + ' %']
      ],
      [false, true, true, true], true);

    y += px(14);
    ctx.font = '700 ' + px(11.5) + 'px ' + FONT;
    ctx.fillStyle = r.passed ? '#1d7a44' : '#a8322f';
    ctx.fillText(r.passed ? 'Экзамен сдан.' : 'Экзамен не сдан.', MARGIN, y + px(11.5));
    y += px(26);

    /* ---- ошибки ---- */
    var errors = r.details.filter(function (d) { return !d.correct; });
    if (!errors.length) {
      ctx.font = px(10.5) + 'px ' + FONT;
      ctx.fillStyle = INK;
      ctx.fillText('Все вопросы и задачи отвечены верно.', MARGIN, y + px(10.5));
      y += px(24);
    } else {
      need(px(60));
      ctx.font = '700 ' + px(12) + 'px ' + FONT;
      ctx.fillStyle = INK;
      ctx.fillText('ОШИБКИ', MARGIN, y + px(12));
      y += px(22);

      /* Ширины в тех же «пунктах», что и шрифты: № узкий, ответу хватает
         трети листа, остальное отдаётся тексту вопроса — он длиннее всего. */
      var colErr = [px(22), W - px(22) - px(150), px(150)];
      y = header(ctx, y, MARGIN, colErr, ['№', 'Вопрос', 'Правильный ответ'], [false, false, false]);


      errors.forEach(function (d) {
        var pad = px(7);
        var qLines = wrap(ctx, d.text, colErr[1] - pad * 2, px(10));
        var npaLines = d.npa ? wrap(ctx, d.npa, colErr[1] - pad * 2, px(8.5)) : [];
        var aLines = wrap(ctx, d.right, colErr[2] - pad * 2, px(10));
        var h = Math.max(qLines.length * px(14) + npaLines.length * px(12),
                         aLines.length * px(14)) + px(12);

        /* Строка целиком переносится на следующий лист — разрывать нельзя. */
        if (y + h > PAGE_H - MARGIN) {
          ctx = newPage(pages);
          y = MARGIN;
          y = header(ctx, y, MARGIN, colErr, ['№', 'Вопрос', 'Правильный ответ'], [false, false, false]);

        }

        var x = MARGIN;
        ctx.fillStyle = INK;
        ctx.font = '600 ' + px(10) + 'px ' + FONT;
        ctx.fillText(String(d.n), x + pad, y + px(10) + px(4));

        x += colErr[0];
        ctx.font = px(10) + 'px ' + FONT;
        var yy = y + px(4);
        qLines.forEach(function (line) { yy += px(14); ctx.fillText(line, x + pad, yy); });
        if (npaLines.length) {
          ctx.font = px(8.5) + 'px ' + FONT;
          ctx.fillStyle = '#6b7480';
          npaLines.forEach(function (line) { yy += px(12); ctx.fillText(line, x + pad, yy); });
        }

        x += colErr[1];
        ctx.fillStyle = INK;
        ctx.font = px(10) + 'px ' + FONT;
        var ya = y + px(4);
        aLines.forEach(function (line) { ya += px(14); ctx.fillText(line, x + pad, ya); });

        y += h;
        line(ctx, MARGIN, y, PAGE_W - MARGIN, y, RULE);
      });
      y += px(20);
    }

    /* ---- подписи ---- */
    need(px(70));
    ctx.font = px(9.5) + 'px ' + FONT;
    ctx.fillStyle = '#47505a';
    ctx.fillText('Проверяемый ____________ / ' + (st.person || '') + ' /', MARGIN, y + px(30));
    ctx.fillText('Проверяющий ____________ / ____________ /', MARGIN, y + px(52));

    return pages;
  }

  /* Перевод «пунктов макета» в точки холста: вёрстка задана в тех же числах,
     что и на экране, а холст крупнее ровно во столько раз. */
  function px(pt) { return Math.round(pt * DPI / 72 * 1.0); }

  function newPage(pages) {
    var c = document.createElement('canvas');
    c.width = PAGE_W;
    c.height = PAGE_H;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    ctx.textBaseline = 'alphabetic';
    pages.push(c);
    return ctx;
  }

  function line(ctx, x1, y1, x2, y2, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1 + 0.5);
    ctx.lineTo(x2, y2 + 0.5);
    ctx.stroke();
  }

  /** Перенос текста по ширине колонки. size — уже в точках холста. */
  function wrap(ctx, text, width, size) {
    ctx.font = size + 'px ' + FONT;
    var words = String(text || '').split(/\s+/);
    var lines = [];
    var cur = '';
    words.forEach(function (w) {
      var probe = cur ? cur + ' ' + w : w;
      if (ctx.measureText(probe).width <= width || !cur) cur = probe;
      else { lines.push(cur); cur = w; }
    });
    if (cur) lines.push(cur);
    return lines;
  }

  function header(ctx, y, x0, cols, titles, right) {
    var pad = px(7);
    ctx.font = px(9.5) + 'px ' + FONT;
    ctx.fillStyle = INK_SOFT;
    var x = x0;
    titles.forEach(function (t, i) {
      ctx.textAlign = right[i] ? 'right' : 'left';
      ctx.fillText(t, right[i] ? x + cols[i] - pad : x + pad, y + px(12));
      x += cols[i];
    });
    ctx.textAlign = 'left';
    y += px(18);
    line(ctx, x0, y, x0 + cols.reduce(function (a, b) { return a + b; }, 0), y, RULE);
    return y;
  }

  function table(ctx, y, x0, cols, titles, data, right, lastBold) {
    y = header(ctx, y, x0, cols, titles, right);
    var pad = px(7);
    var total = cols.reduce(function (a, b) { return a + b; }, 0);

    data.forEach(function (row, ri) {
      var last = lastBold && ri === data.length - 1;
      var x = x0;
      row.forEach(function (cell, ci) {
        /* Итоговая строка целиком жирная, числовые колонки — полужирные. */
        ctx.fillStyle = (last && ci === row.length - 1) ? ACCENT : INK;
        ctx.font = (last ? '700 ' : (ci > 0 ? '600 ' : '')) + px(10) + 'px ' + FONT;
        ctx.textAlign = right[ci] ? 'right' : 'left';
        ctx.fillText(cell, right[ci] ? x + cols[ci] - pad : x + pad, y + px(15));
        x += cols[ci];
      });
      ctx.textAlign = 'left';
      y += px(21);
      line(ctx, x0, y, x0 + total, y, RULE);
    });
    return y;
  }

  function say(node, text, kind) {
    if (!node) return;
    node.textContent = text;
    node.style.color = kind === 'bad' ? 'var(--bad)'
                     : kind === 'ok' ? 'var(--ok)' : 'var(--text-dim)';
  }

  VGSCH.router.register('protocol', { render: render });
})(window.VGSCH = window.VGSCH || {});
