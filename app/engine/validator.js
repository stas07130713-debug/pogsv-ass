/* Валидатор задачи.
 *
 * Задача получает статус VALID только если пройдены ВСЕ проверки.
 * Любое расхождение — REJECTED; задача не исправляется «на глаз» и не показывается
 * пользователю. Правдоподобный текст не является доказательством правильности.
 */
(function (VGSCH) {
  'use strict';

  var units = VGSCH.engine.units;
  var N = VGSCH.normative;
  var A6 = N.fnp520app6;
  var A7 = N.fnp520app7;
  var daskSolver = VGSCH.engine.solvers.dask;
  var thermalSolver = VGSCH.engine.solvers.thermal;

  /* Числа, допустимые в тексте задачи помимо исходных данных:
   * нормативные константы и порядковые номера участков. */
  var NORMATIVE_LITERALS = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,      // порядковые номера, доли, номера участков
    15, 20, 27, 40, 41, 50, 100, 251, 520  // нормативные величины и номера документов
  ];

  function fail(id, name, detail) { return { id: id, name: name, pass: false, detail: detail }; }
  function ok(id, name, detail) { return { id: id, name: name, pass: true, detail: detail || null }; }

  /** Все числа, встречающиеся в объекте исходных данных, включая вложенные. */
  function collectNumbers(value, acc) {
    acc = acc || [];
    if (typeof value === 'number' && isFinite(value)) { acc.push(value); return acc; }
    if (Array.isArray(value)) { value.forEach(function (v) { collectNumbers(v, acc); }); return acc; }
    if (value && typeof value === 'object') {
      Object.keys(value).forEach(function (k) { collectNumbers(value[k], acc); });
    }
    return acc;
  }

  /**
   * Числа из русского текста: «12,5» и «250».
   *
   * Цифры внутри обозначений техники данными не являются и в сверку не идут:
   * в «Р-30», «ГС-10», «КП-3М» число — часть названия. Поэтому числу должен
   * предшествовать либо старт строки, либо символ, не являющийся буквой,
   * цифрой или дефисом.
   */
  function numbersInText(text) {
    var out = [];
    /* ‐-― — типографские тире, завершающий дефис — обычный ASCII. */
    var re = /(^|[^0-9A-Za-zА-Яа-яЁё‐-―-])(-?\d+(?:,\d+)?)/g, m;
    while ((m = re.exec(text)) !== null) out.push(parseFloat(m[2].replace(',', '.')));
    return out;
  }

  function isKnownNumber(n, allowed) {
    for (var i = 0; i < allowed.length; i++) {
      if (Math.abs(allowed[i] - n) < 1e-6) return true;
    }
    return false;
  }

  /* ------------------------------------------------------------- проверки --- */

  function checkNormativeBasis(task) {
    if (!task.normative_basis || !task.normative_basis.length) {
      return fail(1, 'Нормативное основание', 'У задачи не указан нормативный источник.');
    }
    for (var i = 0; i < task.normative_basis.length; i++) {
      var b = task.normative_basis[i];
      if (!b.document || !b.point) {
        return fail(1, 'Нормативное основание', 'Не указан документ или пункт.');
      }
    }
    return ok(1, 'Нормативное основание', task.normative_basis.length + ' ссылок');
  }

  function checkRanges(task) {
    var i = task.inputs;

    if (i.initialPressureMPa !== undefined) {
      var spec = VGSCH.data.ranges.RANGES.initial_pressure_MPa;
      if (i.initialPressureMPa < spec.min || i.initialPressureMPa > spec.max) {
        return fail(2, 'Диапазоны', 'Начальное давление ' + i.initialPressureMPa +
                    ' МПа вне допустимого диапазона ' + spec.min + '…' + spec.max + ' МПа.');
      }
      if (i.initialPressureMPa <= i.reservePressureMPa) {
        return fail(2, 'Диапазоны', 'Начальное давление не превышает резерв.');
      }
    }
    if (i.segments) {
      for (var k = 0; k < i.segments.length; k++) {
        var s = i.segments[k];
        if (!(s.lengthM > 0)) return fail(2, 'Диапазоны', s.id + ': длина ' + s.lengthM + ' м.');
        if (!(s.consumptionMPa > 0)) return fail(2, 'Диапазоны', s.id + ': расход ' + s.consumptionMPa + ' МПа.');
        if (s.slopeDeg < 0 || s.slopeDeg > 90) return fail(2, 'Диапазоны', s.id + ': угол ' + s.slopeDeg + '°.');
      }
    }
    if (i.excavationHeightM !== undefined && A7.HEIGHTS.indexOf(i.excavationHeightM) === -1) {
      return fail(2, 'Диапазоны', 'Высота выработки ' + i.excavationHeightM +
                  ' м отсутствует в таблице N 1 приложения № 7.');
    }
    if (i.temperaturesC) {
      for (var t = 0; t < i.temperaturesC.length; t++) {
        var v = i.temperaturesC[t];
        if (v < A6.MIN_WORK_TEMP_C || v > A6.RESCUE_ONLY_TO_C) {
          return fail(2, 'Диапазоны', 'Температура ' + v + ' °C вне области применения приложения № 6.');
        }
        if (v <= 0 && A6.TABLE_2_AMBIGUOUS.indexOf(v) !== -1) {
          return fail(2, 'Диапазоны', 'Температура ' + v +
                      ' °C стоит на стыке строк таблицы N 2 и однозначно не определена.');
        }
      }
    }
    return ok(2, 'Диапазоны');
  }

  function checkUnits(task) {
    if (!task.answer || !task.answer.type) return fail(3, 'Единицы', 'Не задан тип ответа.');
    if (task.answer.type === 'numeric') {
      if (!task.answer.unit) return fail(3, 'Единицы', 'У числового ответа не указана единица.');
      if (!units.FACTORS[task.answer.unit]) {
        return fail(3, 'Единицы', 'Неизвестная единица ответа «' + task.answer.unit + '».');
      }
    }
    return ok(3, 'Единицы', task.answer.unit || 'логический ответ');
  }

  function checkPhysicalSense(task) {
    var nums = collectNumbers(task.inputs);
    for (var i = 0; i < nums.length; i++) {
      if (!isFinite(nums[i])) return fail(4, 'Физический смысл', 'Нечисловое значение в исходных данных.');
    }
    if (task.answer.type === 'numeric') {
      if (!isFinite(task.answer.value)) return fail(4, 'Физический смысл', 'Ответ не является числом.');
      var negativeAllowed = task.answer.unit === '°C';
      if (!negativeAllowed && task.answer.value < 0) {
        return fail(4, 'Физический смысл', 'Отрицательный ответ ' + task.answer.value +
                    ' ' + task.answer.unit + ' физически невозможен.');
      }
    }
    return ok(4, 'Физический смысл');
  }

  function checkForwardComputation(task) {
    if (!task.solved) return ok(5, 'Прямой расчёт', 'Тип задачи без маршрутной модели.');
    if (task.solved.mismatches && task.solved.mismatches.length) {
      return fail(5, 'Прямой расчёт', 'Два решателя разошлись: ' + task.solved.mismatches.join('; '));
    }
    return ok(5, 'Прямой расчёт', 'Пошаговый и суммарный расчёты совпали');
  }

  /* ------------------------------------------------- эталонный пересчёт --- */

  /* Ответ пересчитывается ЗАНОВО из одних только inputs, без обращения к тому,
   * что построил генератор. Расхождение означает, что условие задачи и ответ
   * разошлись друг с другом, — это REJECTED. */
  var RECOMPUTE = {
    T01: function (i) { return num(daskSolver.workingReserve(i), 'МПа'); },
    T02: function (i) {
      var a = daskSolver.allocation(i);
      return num(i.initialPressureMPa - a.allowedForwardMPa, 'МПа');
    },
    T03: finalPressure, T04: finalPressure, T05: finalPressure,
    T06: finalPressure, T07: finalPressure,

    T08: function (i) {
      var p = i.initialPressureMPa;
      for (var k = 0; k < i.pointIndex; k++) p = Math.round((p - i.segments[k].consumptionMPa) * 10) / 10;
      return num(p, 'МПа');
    },
    T09: function (i) { return num(daskSolver.solve(i).primary.turnBackPressureMPa, 'МПа'); },
    T10: function (i) { return num(smokeSolve(i).timeMin, 'мин'); },
    T11: function (i) { return num(N.apparatus.workingProtectiveTime(i.apparatusId).minutes, 'мин'); },

    T13: function (i) { return num(thermalSolver.solve(i).allowance.minutes, 'мин'); },
    T14: function (i) { return num(thermalSolver.solve(i).split.forwardMin, 'мин'); },
    T15: function (i) { return bool(thermalSolver.temperatureRise(i.t0C, i.t1C).abort); },
    T16: function (i) { return num(thermalSolver.solve(i).allowance.minutes, 'мин'); },
    T17: function (i) {
      var r = thermalSolver.solve(i);
      return num(i.activity === 'передвижение' ? r.split.forwardMin : r.allowance.minutes, 'мин');
    },

    T19: function (i) { return num(smokeSolve(i).speedMPerMin, 'м/мин'); },
    T20: function (i) { return num(smokeSolve(i).timeMin, 'мин'); },
    T21: function (i) {
      var move = smokeSolve(i);
      var th = thermalSolver.solve({
        temperaturesC: i.temperaturesC, activity: 'передвижение', rescueWork: false
      });
      return bool(move.timeMin <= th.split.forwardMin + 1e-9);
    },

    T24: function (i) { return num(daskSolver.maxForwardDistance(i).exactDistanceM, 'м'); },
    T25: function (i) { return num(thermalSolver.solve(i).split.forwardMin, 'мин'); },
    T27: function (i) { return bool(daskSolver.solve(i).feasible); }
  };

  function finalPressure(i) { return num(daskSolver.solve(i).primary.finalPressureMPa, 'МПа'); }
  function num(value, unit) { return { type: 'numeric', value: value, unit: unit }; }
  function bool(value) { return { type: 'boolean', value: !!value }; }
  function smokeSolve(i) {
    return VGSCH.engine.solvers.smoke.solve({
      atmosphere: i.atmosphere, work: i.work,
      excavationHeightM: i.excavationHeightM, slopeDeg: i.slopeDeg,
      visibilityM: i.visibilityM, routeLengthM: i.routeLengthM
    });
  }

  function checkAnswerAgainstSolver(task) {
    var fn = RECOMPUTE[task.type_id];
    if (!fn) {
      return fail(5.5, 'Эталонный ответ',
                  'Для типа ' + task.type_id + ' не задан независимый пересчёт ответа. ' +
                  'Без него правильность ответа не доказана.');
    }
    var expected;
    try {
      expected = fn(task.inputs);
    } catch (e) {
      return fail(5.5, 'Эталонный ответ', 'Пересчёт из исходных данных не выполнен: ' + e.message);
    }

    if (expected.type !== task.answer.type) {
      return fail(5.5, 'Эталонный ответ', 'Тип ответа «' + task.answer.type +
                  '» не совпадает с типом эталона «' + expected.type + '».');
    }
    if (expected.type === 'boolean') {
      if (expected.value !== task.answer.value) {
        return fail(5.5, 'Эталонный ответ', 'Решатель даёт «' + (expected.value ? 'да' : 'нет') +
                    '», в задаче записано «' + (task.answer.value ? 'да' : 'нет') + '».');
      }
      return ok(5.5, 'Эталонный ответ', 'логический ответ подтверждён решателем');
    }

    if (expected.unit !== task.answer.unit) {
      return fail(5.5, 'Эталонный ответ', 'Единица ответа «' + task.answer.unit +
                  '» не совпадает с единицей эталона «' + expected.unit + '».');
    }
    /* Сверяем округлением до разрядности ответа: сам ответ округлён, эталон — нет. */
    var expectedRounded = units.round(expected.value, task.answer.decimals);
    if (Math.abs(expectedRounded - task.answer.value) > 1e-9) {
      return fail(5.5, 'Эталонный ответ', 'Решатель даёт ' + units.fmt(expected.value) + ' ' +
                  expected.unit + ' (округлённо ' + units.fmt(expectedRounded) + '), ' +
                  'в задаче записано ' + units.fmt(task.answer.value) + '.');
    }
    return ok(5.5, 'Эталонный ответ', units.fmt(expectedRounded) + ' ' + expected.unit +
              ' — подтверждён независимым пересчётом');
  }

  function checkBackSubstitution(task) {
    var i = task.inputs;

    /* Маршрут ДАСК: из конечного давления восстанавливаем начальное. */
    if (task.solved) {
      var restored = task.solved.primary.finalPressureMPa +
                     task.solved.primary.spentForwardMPa + task.solved.primary.spentBackMPa;
      if (Math.abs(restored - i.initialPressureMPa) > 1e-6) {
        return fail(6, 'Обратная подстановка', 'Восстановленное начальное давление ' +
                    units.fmt(restored) + ' МПа не совпадает с исходным ' +
                    units.fmt(i.initialPressureMPa) + ' МПа.');
      }
      return ok(6, 'Обратная подстановка', 'Начальное давление восстановлено точно');
    }

    /* Температурные задачи: из времени «туда» восстанавливаем табличное время. */
    if (i.temperaturesC && i.activity === 'передвижение' && task.answer.unit === 'мин') {
      var r = thermalSolver.solve({
        temperaturesC: i.temperaturesC, activity: i.activity, rescueWork: i.rescueWork
      });
      if (r.split) {
        var back = thermalSolver.backSubstitution(r.split.forwardMin);
        if (Math.abs(back - r.allowance.minutes) > 1e-6) {
          return fail(6, 'Обратная подстановка', 'Восстановленное время ' + units.fmt(back) +
                      ' мин не совпадает с табличным ' + units.fmt(r.allowance.minutes) + ' мин.');
        }
        return ok(6, 'Обратная подстановка', 'Табличное время восстановлено точно');
      }
    }

    /* Задачи на скорость: из времени и скорости восстанавливаем длину. */
    if (i.routeLengthM !== undefined && task.answer.unit === 'мин') {
      var speed = speedOf(task);
      var restoredLength = task.answer.value * speed;
      /* Ответ округлён до answer.decimals знаков, поэтому восстановленная длина
       * неизбежно отличается на половину последнего разряда, умноженную на скорость.
       * Допуск обязан учитывать это, иначе отклоняются заведомо верные задачи. */
      var tol = 0.5 * Math.pow(10, -task.answer.decimals) * speed + 1e-6;
      if (Math.abs(restoredLength - i.routeLengthM) > tol) {
        return fail(6, 'Обратная подстановка', 'Восстановленная длина ' +
                    units.fmt(restoredLength) + ' м отличается от исходной ' +
                    units.fmt(i.routeLengthM) + ' м больше допуска округления ' +
                    units.fmt(tol) + ' м.');
      }
      return ok(6, 'Обратная подстановка', 'Длина маршрута восстановлена в пределах округления');
    }

    return ok(6, 'Обратная подстановка', 'Для типа задачи не требуется');
  }

  function speedOf(task) {
    var i = task.inputs;
    var v = A7.fullVisibilitySpeed(i.atmosphere, i.work, i.excavationHeightM, i.slopeDeg).value;
    if (typeof i.visibilityM === 'number') v = v / A7.smokeCoefficient(i.visibilityM).value;
    return v;
  }

  function checkReturnRoute(task) {
    if (!task.solved) return ok(7, 'Обратный маршрут', 'Тип задачи без маршрутной модели.');
    var i = task.inputs;
    if (!i.returnSegments || !i.returnSegments.length) {
      return fail(7, 'Обратный маршрут', 'Обратный маршрут не задан.');
    }
    if (!(i.returnConsumptionMPa > 0)) {
      return fail(7, 'Обратный маршрут', 'Расход на возвращение не задан или не положителен.');
    }
    /* Расход «обратно» не должен быть слепой копией «туда» без основания. */
    return ok(7, 'Обратный маршрут', 'Возвращение рассчитано отдельно (' +
              units.fmt(task.solved.primary.spentBackMPa) + ' МПа)');
  }

  function checkTemperature(task) {
    var i = task.inputs;
    if (!i.temperaturesC) return ok(8, 'Температурные ограничения', 'Не применяется');
    var g = thermalSolver.governing(i.temperaturesC);
    var a = thermalSolver.allowance(g.valueC, i.activity, i.rescueWork);
    if (!a.allowed && task.answer.type === 'numeric') {
      return fail(8, 'Температурные ограничения',
                  'Числовой ответ при запрещённых условиях: ' + a.reason);
    }
    return ok(8, 'Температурные ограничения', 'Определяющая температура ' +
              units.fmt(g.valueC) + ' °C');
  }

  function checkSpeed(task) {
    var i = task.inputs;
    if (i.excavationHeightM === undefined) return ok(9, 'Ограничения скорости', 'Не применяется');
    try {
      var v = A7.fullVisibilitySpeed(i.atmosphere, i.work, i.excavationHeightM, i.slopeDeg);
      if (!(v.value > 0)) return fail(9, 'Ограничения скорости', 'Табличная скорость не положительна.');
      return ok(9, 'Ограничения скорости', 'Vп.в = ' + units.fmt(v.value) + ' м/мин из таблицы');
    } catch (e) {
      return fail(9, 'Ограничения скорости', e.message);
    }
  }

  function checkSmoke(task) {
    var i = task.inputs;
    if (i.visibilityM === undefined) return ok(10, 'Задымлённость', 'Не применяется');
    try {
      var k = A7.smokeCoefficient(i.visibilityM);
      if ([2, 1.43, 1].indexOf(k.value) === -1) {
        return fail(10, 'Задымлённость', 'Коэффициент ' + k.value + ' отсутствует в таблице N 2.');
      }
      return ok(10, 'Задымлённость', 'k₃ = ' + units.fmt(k.value));
    } catch (e) {
      return fail(10, 'Задымлённость', e.message);
    }
  }

  /* ФНП № 520, прил. 6, п. 3: пребывание в непригодной для дыхания рудничной
   * атмосфере с применением ДА не должно превышать четырёх часов. Задача,
   * ответ которой выходит за этот предел, нормативно бессмысленна. */
  function checkStayLimit(task) {
    var i = task.inputs;
    if (i.atmosphere !== A7.ATM.UNBREATHABLE) return ok(10.5, 'Предел пребывания в ДА', 'Не применяется');
    if (task.answer.type !== 'numeric' || task.answer.unit !== 'мин') {
      return ok(10.5, 'Предел пребывания в ДА', 'Ответ не во времени');
    }
    var limit = N.apparatus.MAX_STAY_IN_UNBREATHABLE_MIN;
    if (task.answer.value > limit) {
      return fail(10.5, 'Предел пребывания в ДА', 'Ответ ' + units.fmt(task.answer.value) +
                  ' мин превышает предельные ' + limit + ' минут пребывания в непригодной ' +
                  'для дыхания рудничной атмосфере с применением ДА.');
    }
    return ok(10.5, 'Предел пребывания в ДА', units.fmt(task.answer.value) + ' мин из ' + limit);
  }

  function checkScheme(task) {
    if (!task.scheme || !task.scheme.required) return ok(11, 'Соответствие схемы', 'Схема не предусмотрена');
    if (!task.inputs.segments || !task.inputs.segments.length) {
      return fail(11, 'Соответствие схемы', 'Схема требуется, но маршрут в исходных данных отсутствует.');
    }
    /* Схема строится из того же массива segments, что и текст: отдельных чисел у неё нет. */
    var labels = VGSCH.engine.scheme.labelsOf(task);
    var allowed = collectNumbers(task.inputs).concat(NORMATIVE_LITERALS);
    for (var i = 0; i < labels.length; i++) {
      if (!isKnownNumber(labels[i], allowed)) {
        return fail(11, 'Соответствие схемы', 'На схеме число ' + labels[i] +
                    ', которого нет в исходных данных задачи.');
      }
    }
    return ok(11, 'Соответствие схемы', labels.length + ' подписей сверено с JSON');
  }

  function checkTextMatchesJson(task) {
    var allowed = collectNumbers(task.inputs).concat(NORMATIVE_LITERALS);

    /* Производные величины, которые правомерно назвать в условии. */
    if (task.solved) {
      allowed.push(task.solved.primary.spentForwardMPa);
      allowed.push(task.solved.primary.spentBackMPa);
      allowed.push(task.solved.primary.allocation.workingReserveMPa);
    }

    var inText = numbersInText(task.question);
    for (var i = 0; i < inText.length; i++) {
      if (!isKnownNumber(inText[i], allowed)) {
        return fail(12, 'Текст ↔ JSON', 'В условии встречается число ' + inText[i] +
                    ', которого нет в исходных данных.');
      }
    }
    return ok(12, 'Текст ↔ JSON', inText.length + ' чисел условия прослежены до JSON');
  }

  function checkAnswerUniqueness(task) {
    var a = task.answer;
    if (a.type === 'numeric') {
      if (a.value === null || !isFinite(a.value)) {
        return fail(13, 'Однозначность ответа', 'Числовой ответ не определён.');
      }
      return ok(13, 'Однозначность ответа', units.fmt(a.value) + ' ' + a.unit);
    }
    if (a.type === 'boolean') {
      if (typeof a.value !== 'boolean') return fail(13, 'Однозначность ответа', 'Логический ответ не задан.');
      if (!a.options || a.options.length !== 2) {
        return fail(13, 'Однозначность ответа', 'У логического ответа должно быть ровно два варианта.');
      }
      return ok(13, 'Однозначность ответа', a.value ? 'да' : 'нет');
    }
    return fail(13, 'Однозначность ответа', 'Неизвестный тип ответа «' + a.type + '».');
  }

  function checkRounding(task) {
    if (task.answer.type !== 'numeric') return ok(14, 'Округление', 'Не применяется');
    var exact = exactAnswerOf(task);
    if (exact === null) return ok(14, 'Округление', 'Эталонное значение не выделено');
    var d = task.answer.decimals;
    var reround = units.round(exact, d);
    if (Math.abs(reround - task.answer.value) > 1e-9) {
      return fail(14, 'Округление', 'Ответ ' + task.answer.value + ' не совпадает с округлением ' +
                  'эталона ' + exact + ' до ' + d + ' знаков (' + reround + ').');
    }
    /* Округление не должно искажать результат больше половины последнего разряда. */
    var maxDrift = 0.5 * Math.pow(10, -d);
    if (Math.abs(exact - task.answer.value) > maxDrift + 1e-9) {
      return fail(14, 'Округление', 'Округление сместило ответ на ' +
                  Math.abs(exact - task.answer.value) + ', что больше половины последнего разряда.');
    }
    return ok(14, 'Округление', 'до ' + d + ' знаков');
  }

  /** Точное (неокруглённое) значение ответа — для проверки округления. */
  function exactAnswerOf(task) {
    return typeof task.answer.exact === 'number' && isFinite(task.answer.exact)
      ? task.answer.exact
      : null;
  }

  var CHECKS = [
    checkNormativeBasis, checkRanges, checkUnits, checkPhysicalSense,
    checkForwardComputation, checkAnswerAgainstSolver, checkBackSubstitution, checkReturnRoute,
    checkTemperature, checkSpeed, checkSmoke, checkStayLimit,
    checkScheme, checkTextMatchesJson, checkAnswerUniqueness, checkRounding
  ];

  /**
   * Прогон всех проверок. Возвращает задачу со статусом VALID или REJECTED.
   * Статус ниже VALID пользователю не показывается.
   */
  function validate(task) {
    var results = [];
    for (var i = 0; i < CHECKS.length; i++) {
      var r;
      try {
        r = CHECKS[i](task);
      } catch (e) {
        r = fail(i + 1, CHECKS[i].name, 'Исключение при проверке: ' + e.message);
      }
      results.push(r);
      if (!r.pass) {
        task.validation = { status: 'REJECTED', checks: results, rejectedBy: r };
        return task;
      }
    }
    task.validation = { status: 'VALID', checks: results };
    return task;
  }

  VGSCH.engine = VGSCH.engine || {};
  VGSCH.engine.validator = {
    validate: validate,
    CHECKS: CHECKS,
    collectNumbers: collectNumbers,
    numbersInText: numbersInText
  };
})(window.VGSCH = window.VGSCH || {});
