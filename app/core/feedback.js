/* Сообщение об ошибке в вопросе или задаче.
 *
 * Работает без сервера и без собственного API. Три пути отправки:
 *   1. Google Форма — если в app/config.js заполнен feedback.form.id.
 *      Режим 'silent' отправляет молча скрытой формой, 'prefill' открывает
 *      форму с уже заполненными полями. Нужен интернет.
 *   2. Почта — приложение открывает почтовую программу с готовым письмом.
 *      Работает офлайн, ничего настраивать не нужно, кроме самой почты.
 *   3. Буфер обмена — текст обращения копируется целиком и отправляется
 *      вручную из любой почты, в том числе с телефона.
 *
 * Пока форма не подключена, «Отправить» — это письмо. Как только в настройках
 * появится id формы, та же кнопка начинает отправлять в форму, а письмо
 * остаётся запасным путём. Правки в коде для этого не нужны.
 */
(function (VGSCH) {
  'use strict';

  var ui = VGSCH.ui;

  /* --------------------------------------------------------- настройки ---- */

  function cfg() { return VGSCH.config.feedback || {}; }
  function email() { return cfg().email || ''; }

  /** Google Форма настроена и готова принимать обращения. */
  function form() {
    var f = cfg().form;
    return f && f.id ? f : null;
  }

  /** Старый простой вариант: готовая ссылка с меткой {{text}}. */
  function formUrl() {
    var u = cfg().formUrl;
    return u && u.indexOf('{{text}}') !== -1 ? u : '';
  }

  /** Куда уйдёт обращение по кнопке «Отправить»: 'form' или 'mail'. */
  function channel() { return form() ? 'form' : 'mail'; }

  /* ------------------------------------------------------------ кнопка ---- */

  /** Кнопка, которую экраны ставят под вопросом или задачей. */
  function button() {
    return '<div class="report-row">' +
      '<button class="report-btn" data-act="report-error" type="button">' +
        '<span class="report-ico">' + ui.I.warn + '</span>' +
        '<span class="report-txt">' +
          '<span class="report-t">Сообщить об ошибке</span>' +
          '<span class="report-s">Неверный ответ, опечатка, устаревший пункт</span>' +
        '</span>' +
      '</button>' +
    '</div>';
  }

  /* -------------------------------------------------------------- окно ---- */

  /**
   * Открыть окно обращения.
   * @param {{mode:string, kind:string, id:string, text:string, extra:string}} ctx
   *        mode  — раздел приложения («Тесты», «Задачи», «Экзамен», «Психология»);
   *        kind  — «Вопрос» или «Задача»;
   *        id    — идентификатор вопроса или задачи;
   *        text  — текст вопроса или условия;
   *        extra — дополнение: варианты ответа, ссылка на НПА, зерно задачи.
   */
  function open(ctx) {
    close();

    var toForm = channel() === 'form';

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
      '<div class="modal modal-report" role="dialog" aria-modal="true" aria-labelledby="reportTitle">' +
        '<div class="modal-head">' +
          '<span class="modal-badge">' + ui.I.warn + '</span>' +
          '<h3 id="reportTitle">Сообщить об ошибке</h3>' +
          '<button class="modal-x" data-act="close" aria-label="Закрыть">' + ui.I.cross + '</button>' +
        '</div>' +

        '<div class="modal-body">' +
          '<div class="modal-ctx">' +
            '<div class="k">' + ui.esc(ctx.mode) + ' · ' + ui.esc(ctx.kind) +
              (ctx.id ? ' · ' + ui.esc(ctx.id) : '') + '</div>' +
            '<div class="t">' + ui.esc(cut(ctx.text, 220)) + '</div>' +
          '</div>' +

          '<label class="modal-label" for="reportText">Опишите ошибку</label>' +
          '<textarea id="reportText" rows="5" ' +
            'placeholder="Что не так: неверный ответ, опечатка, устаревший пункт НПА, ' +
            'некорректная формулировка…"></textarea>' +
          '<div class="field-error" id="reportError"></div>' +

          '<p class="modal-note">' +
            (toForm
              ? 'Обращение уходит в общую таблицу разработчику. Нужен интернет — ' +
                'без него воспользуйтесь кнопкой «Скопировать».'
              : 'Откроется почтовая программа с готовым письмом на ' + ui.esc(email()) + '. ' +
                'Если почта не настроена — нажмите «Скопировать» и отправьте письмо вручную.') +
          '</p>' +
        '</div>' +

        '<div class="modal-foot">' +
          '<button class="btn-quiet" data-act="close">Отмена</button>' +
          '<div class="spacer"></div>' +
          '<button class="btn-ghost" data-act="copy">' + ui.I.copy + 'Скопировать</button>' +
          (!toForm && formUrl() ? '<button class="btn-ghost" data-act="legacy-form">Открыть форму</button>' : '') +
          '<button class="btn-send" data-act="send">' +
            (toForm ? ui.I.send : ui.I.mail) + (toForm ? 'Отправить' : 'Отправить письмом') +
          '</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    document.body.classList.add('is-modal');

    var box = overlay.querySelector('.modal-report');
    var area = overlay.querySelector('#reportText');
    var err = overlay.querySelector('#reportError');
    area.focus();

    function describe() { return String(area.value).trim(); }

    function requireText() {
      if (describe().length < 5) {
        note(err, 'Опишите, что именно не так — хотя бы несколько слов.', 'bad');
        area.focus();
        return false;
      }
      err.textContent = '';
      return true;
    }

    overlay.addEventListener('click', function (e) {
      /* Клик по затемнению закрывает окно, клик внутри — нет. */
      if (e.target === overlay) { close(); return; }

      var b = e.target.closest('[data-act]');
      if (!b) return;
      var act = b.dataset.act;

      if (act === 'close' || act === 'done') { close(); return; }

      if (act === 'copy') {
        if (!requireText()) return;
        copy(report(ctx, describe()), function (ok) {
          note(err, ok
            ? 'Текст скопирован. Вставьте его в письмо на ' + email() + '.'
            : 'Скопировать не удалось — выделите текст обращения вручную.', ok ? 'ok' : 'bad');
        });
        return;
      }

      if (act === 'legacy-form') {
        if (!requireText()) return;
        window.open(formUrl().replace('{{text}}', encodeURIComponent(report(ctx, describe()))), '_blank');
        close();
        return;
      }

      if (act === 'send') {
        if (!requireText()) return;
        if (channel() === 'form') sendToForm(box, err, b, ctx, describe());
        else sendByMail(err, ctx, describe());
      }
    });

    document.addEventListener('keydown', onEsc);
  }

  /* ------------------------------------------------------------ отправка -- */

  function sendByMail(err, ctx, description) {
    var href = 'mailto:' + encodeURIComponent(email()) +
      '?subject=' + encodeURIComponent('Ошибка в приложении ПОГСВ АСС: ' + (ctx.id || ctx.kind)) +
      '&body=' + encodeURIComponent(report(ctx, description));
    window.location.href = href;
    /* Почтовая программа может быть не настроена, поэтому окно не закрываем,
       а подсказываем запасной путь. */
    note(err, 'Открываем почтовую программу. Если она не запустилась — ' +
      'нажмите «Скопировать» и отправьте письмо вручную на ' + email() + '.', 'dim');
  }

  function sendToForm(box, err, btn, ctx, description) {
    var f = form();

    if (navigator.onLine === false) {
      note(err, 'Нет связи. Нажмите «Скопировать» — обращение уйдёт вручную, ' +
        'когда появится интернет.', 'bad');
      return;
    }

    var values = formValues(f, ctx, description);
    if (!values.length) {
      note(err, 'Форма подключена, но идентификаторы полей не заданы. ' +
        'Пока пользуйтесь кнопкой «Скопировать».', 'bad');
      return;
    }

    if (f.mode === 'prefill') {
      window.open(prefillUrl(f, values), '_blank');
      success(box, 'Форма открыта в новой вкладке', 'Поля уже заполнены — осталось нажать «Отправить» в самой форме.');
      return;
    }

    btn.disabled = true;
    btn.classList.add('is-busy');
    note(err, 'Отправляем…', 'dim');

    post(f, values,
      function () {
        success(box, 'Обращение отправлено',
                'Спасибо. Разработчик увидит его вместе с текстом вопроса и вашими данными.');
      },
      function (why) {
        /* Честно говорим, что не дошло: раньше «Отправлено» показывалось
           независимо от результата, и обращения молча терялись. */
        btn.disabled = false;
        btn.classList.remove('is-busy');
        note(err, 'Отправить не удалось (' + why + '). Нажмите «Скопировать» — ' +
                  'обращение уйдёт письмом на ' + email() + '.', 'bad');
      });
  }

  /** Пары «поле формы → значение». Незаданные идентификаторы пропускаются. */
  function formValues(f, ctx, description) {
    var st = VGSCH.state.data;
    var map = f.fields || {};
    var src = {
      person: st.person || '',
      unit: st.unit || '',
      position: st.position || '',
      mode: ctx.mode || '',
      kind: ctx.kind || '',
      id: ctx.id || '',
      text: ctx.text || '',
      description: description,
      report: report(ctx, description)
    };
    var out = [];
    Object.keys(src).forEach(function (key) {
      var entry = map[key];
      if (entry && src[key]) out.push([entry, src[key]]);
    });
    return out;
  }

  function prefillUrl(f, values) {
    var q = values.map(function (p) {
      return encodeURIComponent(p[0]) + '=' + encodeURIComponent(p[1]);
    }).join('&');
    return 'https://docs.google.com/forms/d/e/' + f.id + '/viewform?usp=pp_url&' + q;
  }

  function action(f) {
    return 'https://docs.google.com/forms/d/e/' + f.id + '/formResponse';
  }

  /**
   * Отправка в форму без открытия вкладки — обычной формой в скрытый кадр.
   *
   * Почему именно так, а не через fetch. Отправить-то fetch отправляет, но
   * на чужой домен он уходит в режиме no-cors, и ответ приходит «непрозрачным»:
   * ни кода, ни тела прочитать нельзя, обещание выполняется одинаково и когда
   * Google принял ответ, и когда отказал. Пользователь видел «Отправлено»
   * вслепую. У кадра же есть событие load — оно означает, что ответ реально
   * получен и отрисован.
   *
   * Кадр и форма убираются только после load (или по истечении ожидания):
   * если снести их раньше, браузер обрывает запрос на полпути.
   */
  function post(f, values, done, fail) {
    var name = 'vgsch-form-sink-' + Date.now();

    var frame = document.createElement('iframe');
    /* Имя ставится атрибутом и до, и после вставки в документ: если браузер
       не найдёт кадр с таким именем, форма уйдёт в новое окно, а его на
       телефоне съест блокировщик всплывающих окон — и обращение потеряется. */
    frame.setAttribute('name', name);
    frame.setAttribute('aria-hidden', 'true');
    frame.setAttribute('tabindex', '-1');
    frame.style.cssText = 'position:absolute;left:-9999px;width:0;height:0;border:0';
    document.body.appendChild(frame);
    frame.setAttribute('name', name);

    var el = document.createElement('form');
    el.action = action(f);
    el.method = 'POST';
    el.target = name;
    el.acceptCharset = 'UTF-8';
    el.style.display = 'none';
    values.forEach(function (p) {
      var i = document.createElement('input');
      i.type = 'hidden';
      i.name = p[0];
      i.value = p[1];
      el.appendChild(i);
    });
    document.body.appendChild(el);

    var settled = false;
    function finish(ok, why) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      /* Небольшая задержка перед уборкой: ответ уже получен, но пусть кадр
         спокойно доживёт свой цикл отрисовки. */
      window.setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
        if (frame.parentNode) frame.parentNode.removeChild(frame);
      }, 1500);
      if (ok) done(); else fail(why);
    }

    /* В шахте связь пропадает молча — ждать бесконечно нельзя. */
    var timer = window.setTimeout(function () { finish(false, 'нет ответа за 20 секунд'); }, 20000);
    frame.addEventListener('load', function () { finish(true); });
    frame.addEventListener('error', function () { finish(false, 'сеть недоступна'); });

    try {
      el.submit();
    } catch (e) {
      finish(false, 'браузер не дал отправить форму');
    }
  }

  /** Окно после успешной отправки: одно сообщение и одна кнопка. */
  function success(box, title, text) {
    box.innerHTML =
      '<div class="modal-done">' +
        '<span class="done-ico">' + ui.I.okCircle + '</span>' +
        '<h3>' + ui.esc(title) + '</h3>' +
        '<p>' + ui.esc(text) + '</p>' +
        '<button class="btn-send" data-act="done">Готово</button>' +
      '</div>';
  }

  function note(el, text, kind) {
    el.textContent = text;
    el.style.color = kind === 'ok' ? 'var(--ok)' : kind === 'bad' ? 'var(--bad)' : 'var(--text-dim)';
  }

  function onEsc(e) { if (e.key === 'Escape') close(); }

  function close() {
    var o = document.querySelector('.modal-overlay');
    if (o) o.remove();
    document.body.classList.remove('is-modal');
    document.removeEventListener('keydown', onEsc);
  }

  /* -------------------------------------------------------------- текст --- */

  /**
   * Текст обращения.
   *
   * Формат подобран под ячейку Google Таблицы: там переносы строк сжимаются,
   * и сплошной абзац читать невозможно. Поэтому каждый факт — это отдельная
   * строка вида «МЕТКА: значение», а блоки разделены строкой из тире.
   * Даже если переносы потеряются, метки заглавными остаются точками, по
   * которым глаз цепляется, а текст разбирается на части поиском по «МЕТКА:».
   *
   * Самое важное — описание ошибки — стоит первым: в таблице видно сразу,
   * не разворачивая ячейку.
   */
  function report(ctx, description) {
    var st = VGSCH.state.data;
    var line = '————————————';
    var L = [];

    L.push('ЧТО НЕ ТАК: ' + oneLine(description));
    L.push('ГДЕ: ' + ctx.mode + ' · ' + ctx.kind + (ctx.id ? ' ' + ctx.id : ''));
    L.push('КТО: ' + (st.person || 'не указан') +
           (st.unit ? ' · отделение ' + st.unit : '') +
           (st.position ? ' · ' + st.position : ''));
    L.push('КОГДА: ' + ui.dateTime(new Date()) + ' · версия ' + VGSCH.config.version);
    L.push(line);
    L.push('ТЕКСТ: ' + oneLine(ctx.text));

    /* extra приходит уже размеченным: «Варианты ответа», «Основание»,
       «Зерно генерации». Каждую строку превращаем в такую же метку. */
    if (ctx.extra) {
      String(ctx.extra).split('\n').forEach(function (row) {
        var s = row.trim();
        if (!s) return;
        var m = s.match(/^([^:]{2,40}):\s*(.*)$/);
        if (m && m[2]) L.push(m[1].toUpperCase() + ': ' + m[2]);
        else L.push('  ' + s);
      });
    }
    return L.join('\n');
  }

  /** Схлопывание переносов внутри одного значения, чтобы метки не разъезжались. */
  function oneLine(s) {
    return String(s || '').replace(/\s*\n\s*/g, ' ').trim();
  }

  function cut(s, n) {
    s = String(s || '');
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  /* ---------------------------------------------------------- копирование - */

  /** Копирование с запасным путём для file:// и старых браузеров. */
  function copy(text, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(legacy(text)); });
      return;
    }
    done(legacy(text));
  }

  function legacy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) { return false; }
  }

  /**
   * Подключение кнопки на экране: один вызов вместо повторов в каждом режиме.
   * @param view контейнер экрана
   * @param build функция, возвращающая контекст обращения на момент нажатия
   */
  function wire(view, build) {
    ui.on(view, '[data-act="report-error"]', function () { open(build()); });
  }

  VGSCH.feedback = { button: button, open: open, close: close, wire: wire, report: report, channel: channel };
})(window.VGSCH = window.VGSCH || {});
