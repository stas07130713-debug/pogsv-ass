/* Сборка PDF из готовых страниц-изображений.
 *
 * Зачем так. Настоящий PDF с текстом требует встроенного шрифта: в базовые
 * шрифты формата кириллица не входит, а тащить в приложение шрифтовой файл
 * и стороннюю библиотеку — это плюс полмегабайта и чужой код, который потом
 * некому сопровождать. Поэтому страница рисуется на холсте средствами
 * браузера — кириллицу он рисует сам, — холст сжимается в JPEG и кладётся
 * в PDF картинкой. Такой файл открывается везде и печатается как обычный.
 *
 * Плата за это — текст в PDF не выделяется мышью. Для протокола, который
 * распечатывают и подписывают, это несущественно.
 *
 * Внешних зависимостей нет: формат PDF собирается здесь побайтно.
 */
(function (VGSCH) {
  'use strict';

  /* Размер листа A4 в типографских точках — единица измерения PDF. */
  var A4_W = 595.28;
  var A4_H = 841.89;

  /** Строку в байты. В PDF служебная часть — только латиница и цифры. */
  function bytesOf(str) {
    var out = new Uint8Array(str.length);
    for (var i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xFF;
    return out;
  }

  /** base64 из toDataURL в байты. */
  function base64ToBytes(b64) {
    var raw = atob(b64);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  /**
   * PDF из списка холстов: один холст — одна страница.
   * @param canvases массив HTMLCanvasElement
   * @param quality  качество JPEG, 0…1
   * @return Blob с типом application/pdf
   */
  function fromCanvases(canvases, quality) {
    var q = quality === undefined ? 0.82 : quality;

    var chunks = [];          // куски будущего файла
    var length = 0;           // сколько байт уже набрано
    var offsets = [];         // смещение начала каждого объекта

    function push(data) {
      var b = (typeof data === 'string') ? bytesOf(data) : data;
      chunks.push(b);
      length += b.length;
    }

    /* Нумерация объектов: 1 — каталог, 2 — дерево страниц,
       далее по три объекта на страницу (страница, картинка, содержимое). */
    var pageCount = canvases.length;
    var firstPageObj = 3;
    var kids = [];
    for (var p = 0; p < pageCount; p++) kids.push((firstPageObj + p * 3) + ' 0 R');

    function beginObject(num) {
      offsets[num] = length;
      push(num + ' 0 obj\n');
    }

    push('%PDF-1.4\n');
    /* Признак двоичного содержимого — иначе часть программ портит файл
       при пересылке, считая его текстовым. */
    push(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]));

    beginObject(1);
    push('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

    beginObject(2);
    push('<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + pageCount + ' >>\nendobj\n');

    canvases.forEach(function (canvas, i) {
      var pageObj = firstPageObj + i * 3;
      var imgObj = pageObj + 1;
      var contentObj = pageObj + 2;

      var jpeg = base64ToBytes(canvas.toDataURL('image/jpeg', q).split(',')[1]);

      beginObject(pageObj);
      push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + A4_W.toFixed(2) + ' ' + A4_H.toFixed(2) + ']' +
           ' /Resources << /XObject << /Im0 ' + imgObj + ' 0 R >> >>' +
           ' /Contents ' + contentObj + ' 0 R >>\nendobj\n');

      beginObject(imgObj);
      push('<< /Type /XObject /Subtype /Image /Width ' + canvas.width +
           ' /Height ' + canvas.height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8' +
           ' /Filter /DCTDecode /Length ' + jpeg.length + ' >>\nstream\n');
      push(jpeg);
      push('\nendstream\nendobj\n');

      /* Картинка растягивается на весь лист: поля уже нарисованы на холсте. */
      var content = 'q\n' + A4_W.toFixed(2) + ' 0 0 ' + A4_H.toFixed(2) + ' 0 0 cm\n/Im0 Do\nQ\n';
      beginObject(contentObj);
      push('<< /Length ' + content.length + ' >>\nstream\n' + content + 'endstream\nendobj\n');
    });

    /* Таблица смещений: по ней читалка находит объекты, поэтому числа
       обязаны совпадать с реальными позициями до последнего байта. */
    var total = 2 + pageCount * 3;
    var xrefAt = length;
    var xref = 'xref\n0 ' + (total + 1) + '\n0000000000 65535 f \n';
    for (var n = 1; n <= total; n++) {
      xref += String(offsets[n]).padStart(10, '0') + ' 00000 n \n';
    }
    push(xref);
    push('trailer\n<< /Size ' + (total + 1) + ' /Root 1 0 R >>\nstartxref\n' + xrefAt + '\n%%EOF\n');

    return new Blob(chunks, { type: 'application/pdf' });
  }

  /** Сохранить файл в загрузки. */
  function save(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
  }

  VGSCH.pdf = { fromCanvases: fromCanvases, save: save, A4_W: A4_W, A4_H: A4_H };
})(window.VGSCH = window.VGSCH || {});
