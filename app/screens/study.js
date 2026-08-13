/* Режим «Ответы по психологии».
 *
 * Материал для чтения: тема и развёрнутый эталонный ответ из первоисточника.
 * Вариантов ответа, проверки и оценки здесь нет — сюда вынесены темы, которые
 * не сводятся к выбору из четырёх вариантов без потери смысла.
 */
(function (VGSCH) {
  'use strict';

  var ui = VGSCH.ui;

  var run = null;   // { section, items, index }

  function render(root) {
    var Q = VGSCH.data.questions;
    var sections = Q.studySections();

    /* Если раздел всего один, показываем его сразу — лишний выбор ни к чему. */
    if (sections.length === 1) { open(root, sections[0].key); return; }
    renderPicker(root, sections);
  }

  function renderPicker(root, sections) {
    var Q = VGSCH.data.questions;

    var v = ui.paint(root,
      ui.appbar({ mode: 'study', title: 'Ответы по психологии' }) +
      '<div class="panel" style="--accent:var(--study)">' +
        '<h3 style="margin-bottom:6px">Выберите раздел</h3>' +
        '<p class="muted" style="margin:0 0 14px">Материалы для чтения: тема и ответ ' +
        'по первоисточнику. Проверка знаний в этом режиме не проводится.</p>' +
        '<div class="pick-list">' +
          sections.map(function (s) {
            return '<button class="pick-item" data-section="' + ui.esc(s.key) + '">' +
              '<span class="t">' + ui.esc(s.title) + '</span>' +
              '<span class="n">' + s.count + ' тем</span></button>';
          }).join('') +
        '</div>' +
      '</div>' +
      ui.tabbar('study'));

    ui.wireNav(v);
    ui.on(v, '.pick-item', function (b) { open(root, b.dataset.section); });
  }

  function open(root, section) {
    var Q = VGSCH.data.questions;
    run = { section: section, items: Q.study(section), index: 0 };
    renderTopic(root);
  }

  /**
   * Эталонный текст в первоисточнике идёт сплошным куском. Здесь он разбивается
   * на читаемые абзацы: сначала по нумерации пунктов, иначе — по предложениям,
   * группами примерно по 280 знаков.
   */
  var PARAGRAPH_TARGET = 280;   // к какой длине стремимся
  var PARAGRAPH_MAX = 460;      // выше этой длины абзац дробится дальше

  function paragraphs(text) {
    var t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t) return [];

    /* Нумерованный перечень: «1) …; 2) …» или «1. … 2. …» — пункт на абзац. */
    var parts = t.split(/\s+(?=\d{1,2}[).]\s)/);
    if (parts.length < 3) parts = [t];

    /* Пункты перечня сами бывают длинными: внутри них текст идёт через точку
       с запятой. Всё, что длиннее предела, дробим по предложениям. */
    var out = [];
    parts.forEach(function (p) {
      p = p.trim();
      if (!p) return;
      if (p.length <= PARAGRAPH_MAX) { out.push(p); return; }
      group(p).forEach(function (g) { out.push(g); });
    });
    return out.length ? out : [t];
  }

  /** Группировка предложений в абзацы примерно по PARAGRAPH_TARGET знаков. */
  function group(t) {
    var out = [], buf = '';
    sentences(t).forEach(function (s) {
      buf = buf ? buf + ' ' + s : s;
      if (buf.length >= PARAGRAPH_TARGET) { out.push(buf); buf = ''; }
    });
    if (buf) {
      /* Короткий хвост присоединяем к последнему абзацу, а не оставляем огрызком. */
      if (out.length && buf.length < 80) out[out.length - 1] += ' ' + buf;
      else out.push(buf);
    }
    return out;
  }

  /* Точка с запятой считается границей наравне с точкой: в исходных текстах
     перечисления оформлены именно ею. Обрывки вроде «т. д.» поглощаются
     группировкой, поэтому отдельной обработки сокращений не требуется. */
  function sentences(t) {
    var res = [], re = /[^.!?;]+[.!?;]+(?:\s|$)/g, m, last = 0;
    while ((m = re.exec(t)) !== null) { res.push(m[0].trim()); last = re.lastIndex; }
    if (last < t.length) res.push(t.slice(last).trim());
    return res.filter(Boolean);
  }

  function renderTopic(root) {
    var Q = VGSCH.data.questions;
    var item = run.items[run.index];
    var last = run.index === run.items.length - 1;
    var sectionTitle = Q.SECTIONS[run.section];
    var multiSection = Q.studySections().length > 1;

    var v = ui.paint(root,
      ui.appbar({ mode: 'study', title: 'Ответы по психологии', backArrow: multiSection }) +
      ui.progress(run.index + 1, run.items.length,
                  'Тема ' + (run.index + 1) + ' из ' + run.items.length, 'var(--study)') +
      '<div class="panel study-layout" style="--accent:var(--study)">' +

        /* Меню тем слева, ответ справа. На узком экране колонки складываются:
           меню превращается в горизонтальную ленту над текстом. */
        '<nav class="study-nav" aria-label="Темы">' +
          '<div class="study-nav-title">' + ui.esc(sectionTitle) + '</div>' +
          run.items.map(function (it, i) {
            return '<button data-topic="' + i + '"' + (i === run.index ? ' class="is-active"' : '') + '>' +
              '<span class="n">' + (i + 1) + '</span>' +
              '<span class="tt">' + ui.esc(it.question) + '</span></button>';
          }).join('') +
        '</nav>' +

        '<div class="study-main">' +
          '<h3 class="study-topic">' + ui.esc(item.question) + '</h3>' +

          '<div class="study-body">' +
            paragraphs(item.reference).map(function (p) {
              return '<p>' + ui.esc(p) + '</p>';
            }).join('') +
          '</div>' +

          (item.npa ? '<div class="muted" style="margin-top:12px">Основание: ' +
                      ui.esc(item.npa) + '</div>' : '') +

          VGSCH.feedback.button() +

          '<div class="actions">' +
            '<button data-act="prev"' + (run.index === 0 ? ' disabled' : '') + '>' +
              ui.I.prev + 'Назад</button>' +
            '<div class="spacer"></div>' +
            (last
              ? '<button data-nav="start">' + ui.I.home + 'На главную</button>'
              : '<button class="primary" style="--accent:var(--study)" data-act="next">' +
                'Далее' + ui.I.next + '</button>') +
          '</div>' +
        '</div>' +
      '</div>' +
      ui.tabbar('study'));

    ui.wireNav(v);
    VGSCH.feedback.wire(v, function () {
      return {
        mode: 'Психология', kind: 'Тема', id: item.id,
        text: item.question,
        extra: 'Текст ответа: ' + item.reference
      };
    });
    ui.on(v, '[data-topic]', function (b) {
      run.index = parseInt(b.dataset.topic, 10);
      renderTopic(root);
    });
    ui.on(v, '[data-act="prev"]', function () { run.index--; renderTopic(root); });
    ui.on(v, '[data-act="next"]', function () { run.index++; renderTopic(root); });
    /* Через роутер, а не своим слушателем: wireNav уже слушает эту же кнопку,
       и два обработчика на одно нажатие уводили экран на два шага сразу. */
    VGSCH.router.setBackHandler(function () {
      if (!multiSection) return false;      // разделов нет — пусть роутер вернёт назад сам
      renderPicker(root, Q.studySections());
      return true;
    });
  }

  VGSCH.router.register('study', { render: render, destroy: function () { run = null; } });
})(window.VGSCH = window.VGSCH || {});
