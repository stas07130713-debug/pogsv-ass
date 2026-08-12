/* Схема маршрута.
 *
 * Единственный источник истины — массив segments из JSON задачи. Никаких
 * «ручных» чисел в графике нет: каждая подпись берётся из тех же данных,
 * из которых построен текст условия. labelsOf() отдаёт валидатору полный
 * список чисел схемы для сверки с JSON.
 */
(function (VGSCH) {
  'use strict';

  var units = VGSCH.engine.units;

  /** Все числа, которые попадут на схему. Используется проверкой CHECK 11. */
  function labelsOf(task) {
    var out = [];
    (task.inputs.segments || []).forEach(function (s) {
      out.push(s.lengthM);
      if (s.slopeDeg > 0) out.push(s.slopeDeg);
    });
    return out;
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /**
   * SVG-схема маршрута. Наклон участка отображается направлением линии,
   * подписи — длина участка и угол наклона.
   */
  function render(task) {
    var segments = task.inputs.segments || [];
    if (!segments.length) return '';

    var W = 720, H = 260;
    var padX = 56, padY = 90;
    var usable = W - padX * 2;
    var segW = usable / segments.length;

    /* Вертикальное смещение участка пропорционально углу, но ограничено,
     * чтобы схема оставалась читаемой при 30°. */
    function dyOf(seg) {
      if (seg.incline === 'горизонталь' || !seg.slopeDeg) return 0;
      var k = Math.min(seg.slopeDeg, 30) / 30;
      var amount = 46 * k;
      return seg.incline === 'спуск' ? amount : -amount;
    }

    var pts = [{ x: padX, y: padY }];
    for (var i = 0; i < segments.length; i++) {
      var prev = pts[pts.length - 1];
      pts.push({ x: prev.x + segW, y: prev.y + dyOf(segments[i]) });
    }

    /* Приводим весь профиль в видимую область. */
    var minY = Math.min.apply(null, pts.map(function (p) { return p.y; }));
    var maxY = Math.max.apply(null, pts.map(function (p) { return p.y; }));
    var shift = (H / 2) - (minY + maxY) / 2;
    pts = pts.map(function (p) { return { x: p.x, y: p.y + shift }; });

    var parts = [];
    parts.push('<svg class="scheme" viewBox="0 0 ' + W + ' ' + H + '" ' +
               'xmlns="http://www.w3.org/2000/svg" role="img" ' +
               'aria-label="Схема маршрута отделения">');

    parts.push(
      '<defs>' +
        '<marker id="arw" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" ' +
                'orient="auto-start-reverse">' +
          '<path d="M0,0 L10,5 L0,10 z" fill="currentColor"/>' +
        '</marker>' +
      '</defs>');

    /* Линия маршрута */
    parts.push('<polyline class="scheme-route" points="' +
               pts.map(function (p) { return p.x + ',' + p.y; }).join(' ') +
               '" fill="none" marker-end="url(#arw)"/>');

    /* Участки: подписи длины и угла */
    for (var j = 0; j < segments.length; j++) {
      var s = segments[j];
      var a = pts[j], b = pts[j + 1];
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;

      parts.push('<text class="scheme-len" x="' + mx + '" y="' + (my - 14) +
                 '" text-anchor="middle">' + esc(units.fmt(s.lengthM)) + ' м</text>');

      if (s.slopeDeg > 0) {
        parts.push('<text class="scheme-angle" x="' + mx + '" y="' + (my + 24) +
                   '" text-anchor="middle">' +
                   esc((s.incline === 'спуск' ? '↓ ' : '↑ ') + units.fmt(s.slopeDeg)) + '°</text>');
      } else {
        parts.push('<text class="scheme-angle" x="' + mx + '" y="' + (my + 24) +
                   '" text-anchor="middle">горизонт</text>');
      }
    }

    /* Точки маршрута */
    for (var p = 0; p < pts.length; p++) {
      var isFirst = p === 0, isLast = p === pts.length - 1;
      parts.push('<circle class="scheme-node' + (isFirst ? ' is-base' : '') +
                 (isLast ? ' is-target' : '') + '" cx="' + pts[p].x + '" cy="' + pts[p].y + '" r="6"/>');

      var label = isFirst ? 'ПБ' : (isLast ? 'Место работ' : 'т. ' + p);
      parts.push('<text class="scheme-node-label" x="' + pts[p].x + '" y="' + (pts[p].y + 34) +
                 '" text-anchor="middle">' + esc(label) + '</text>');
    }

    parts.push('</svg>');
    return parts.join('');
  }

  VGSCH.engine = VGSCH.engine || {};
  VGSCH.engine.scheme = { render: render, labelsOf: labelsOf };
})(window.VGSCH = window.VGSCH || {});
