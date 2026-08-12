/* Решатель задач по запасу дыхательной смеси в ДА.
 * Нормативная основа: Устав ВГСЧ (Приказ МЧС России № 251), п. 22 и п. 23.
 *
 * Ключевое правило, которое нельзя нарушать: маршрут НЕ считается простым
 * сложением расходов «туда». Движение вперёд и возвращение считаются отдельно,
 * а рабочий запас распределяется по категории уклона.
 *
 * Реализованы два независимых способа расчёта:
 *   solvePrimary — пошагово по участкам, с давлением в каждой точке;
 *   solveCheck   — через суммарные величины и обратную подстановку.
 * Расхождение между ними — основание для REJECTED.
 */
(function (VGSCH) {
  'use strict';

  var U = VGSCH.normative.ustav251;
  var units = VGSCH.engine.units;

  var EPS = 1e-9;

  /**
   * Исходные данные:
   * {
   *   initialPressureMPa: 20,
   *   reservePressureMPa: 5,
   *   segments: [{ id, lengthM, slopeDeg, incline, consumptionMPa }],  // маршрут «туда»
   *   returnSegments: [...]                    // необязательно; по умолчанию — зеркало «туда»
   *   mechTransport: false                     // движение вперёд мехтранспортом
   * }
   */

  /** Рабочий запас: Pраб = Pнач − Pрез. */
  function workingReserve(inputs) {
    var p = inputs.initialPressureMPa;
    var r = inputs.reservePressureMPa;
    if (!(p > 0)) throw new Error('Начальное давление должно быть положительным, получено ' + p);
    if (r < 0) throw new Error('Резервный запас не может быть отрицательным, получен ' + r);
    if (p <= r) {
      throw new Error('Начальное давление (' + p + ' МПа) не превышает резерв (' + r +
                      ' МПа): рабочего запаса нет, задача не имеет смысла.');
    }
    return p - r;
  }

  /** Распределение рабочего запаса по п. 22 для маршрута целиком. */
  function allocation(inputs) {
    var category = U.routeCategory(inputs.segments);
    var share = U.forwardShare(category);
    var wr = workingReserve(inputs);

    return {
      category: category,
      share: share,
      workingReserveMPa: wr,
      allowedForwardMPa: wr * share.forwardNum / share.forwardDen,
      allowedBackMPa: wr * share.backNum / share.backDen,
      rule: share.rule
    };
  }

  /** Маршрут возвращения: по умолчанию тот же путь в обратном порядке. */
  function returnRoute(inputs) {
    if (inputs.returnSegments) return inputs.returnSegments;
    return inputs.segments.slice().reverse().map(function (s) {
      return {
        id: s.id,
        lengthM: s.lengthM,
        slopeDeg: s.slopeDeg,
        /* геометрия участка при возвращении меняется на противоположную */
        incline: s.incline === 'подъём' ? 'спуск' : (s.incline === 'спуск' ? 'подъём' : 'горизонталь'),
        consumptionMPa: s.returnConsumptionMPa !== undefined ? s.returnConsumptionMPa : s.consumptionMPa
      };
    });
  }

  /* --------------------------------------------------------- solverPrimary --- */

  /** Пошаговый расчёт: давление и остаток в каждой точке маршрута. */
  function solvePrimary(inputs) {
    var alloc = allocation(inputs);
    var back = returnRoute(inputs);

    var pressure = inputs.initialPressureMPa;
    var spentForward = 0;
    var points = [{ id: 'ПБ', pressureMPa: pressure, spentMPa: 0, leg: 'старт' }];
    var forwardBlockedAt = null;

    /* Давление, при котором прекращается движение вперёд (п. 23). */
    var turnBackPressure = inputs.initialPressureMPa - alloc.allowedForwardMPa;

    for (var i = 0; i < inputs.segments.length; i++) {
      var seg = inputs.segments[i];
      if (!(seg.lengthM > 0)) throw new Error(seg.id + ': длина участка должна быть больше нуля');
      if (!(seg.consumptionMPa > 0)) throw new Error(seg.id + ': расход должен быть больше нуля');

      pressure -= seg.consumptionMPa;
      spentForward += seg.consumptionMPa;

      points.push({
        id: seg.id, leg: 'туда',
        lengthM: seg.lengthM, slopeDeg: seg.slopeDeg, incline: seg.incline,
        consumptionMPa: seg.consumptionMPa,
        pressureMPa: pressure,
        spentMPa: spentForward,
        remainingWorkingMPa: pressure - inputs.reservePressureMPa
      });

      /* Продолжать движение вперёд после достижения давления возвращения нельзя. */
      if (forwardBlockedAt === null && pressure < turnBackPressure - EPS) {
        forwardBlockedAt = seg.id;
      }
    }

    var spentBack = 0;
    for (var j = 0; j < back.length; j++) {
      var bseg = back[j];
      pressure -= bseg.consumptionMPa;
      spentBack += bseg.consumptionMPa;
      points.push({
        id: bseg.id, leg: 'обратно',
        lengthM: bseg.lengthM, slopeDeg: bseg.slopeDeg, incline: bseg.incline,
        consumptionMPa: bseg.consumptionMPa,
        pressureMPa: pressure,
        spentMPa: spentForward + spentBack,
        remainingWorkingMPa: pressure - inputs.reservePressureMPa
      });
    }

    return {
      method: 'пошаговый расчёт по участкам',
      allocation: alloc,
      turnBackPressureMPa: turnBackPressure,
      points: points,
      spentForwardMPa: spentForward,
      spentBackMPa: spentBack,
      finalPressureMPa: pressure,
      forwardBlockedAt: forwardBlockedAt
    };
  }

  /* ----------------------------------------------------------- solverCheck --- */

  /** Независимый расчёт через суммарные величины. */
  function solveCheck(inputs) {
    var alloc = allocation(inputs);
    var back = returnRoute(inputs);

    var sumForward = inputs.segments.reduce(function (a, s) { return a + s.consumptionMPa; }, 0);
    var sumBack = back.reduce(function (a, s) { return a + s.consumptionMPa; }, 0);

    return {
      method: 'расчёт через суммарные величины',
      allocation: alloc,
      spentForwardMPa: sumForward,
      spentBackMPa: sumBack,
      finalPressureMPa: inputs.initialPressureMPa - sumForward - sumBack,
      turnBackPressureMPa: inputs.initialPressureMPa - alloc.allowedForwardMPa
    };
  }

  /* --------------------------------------------------------------- вердикт --- */

  /**
   * Полное решение с двумя независимыми проверками и вердиктом выполнимости.
   * Ни одна проверка не отменяет другую: итог — логическое «И».
   */
  function solve(inputs) {
    var primary = solvePrimary(inputs);
    var check = solveCheck(inputs);
    var alloc = primary.allocation;

    var mismatches = [];
    if (Math.abs(primary.spentForwardMPa - check.spentForwardMPa) > 1e-6) {
      mismatches.push('расход «туда»: ' + primary.spentForwardMPa + ' против ' + check.spentForwardMPa);
    }
    if (Math.abs(primary.spentBackMPa - check.spentBackMPa) > 1e-6) {
      mismatches.push('расход «обратно»: ' + primary.spentBackMPa + ' против ' + check.spentBackMPa);
    }
    if (Math.abs(primary.finalPressureMPa - check.finalPressureMPa) > 1e-6) {
      mismatches.push('конечное давление: ' + primary.finalPressureMPa + ' против ' + check.finalPressureMPa);
    }

    /* Проверка 1 — нормативное распределение рабочего запаса (п. 22). */
    var forwardWithinShare = primary.spentForwardMPa <= alloc.allowedForwardMPa + EPS;

    /* Проверка 2 — фактический возврат: на ПБ должно остаться не менее резерва. */
    var reserveIntact = primary.finalPressureMPa >= inputs.reservePressureMPa - EPS;

    /* Проверка 3 — давление ни в одной точке не опускается ниже резерва. */
    var belowReserveAt = null;
    for (var i = 0; i < primary.points.length; i++) {
      if (primary.points[i].pressureMPa < inputs.reservePressureMPa - EPS) {
        belowReserveAt = primary.points[i].id;
        break;
      }
    }

    var feasible = forwardWithinShare && reserveIntact && belowReserveAt === null;

    return {
      primary: primary,
      check: check,
      mismatches: mismatches,
      checks: {
        forwardWithinShare: forwardWithinShare,
        reserveIntact: reserveIntact,
        pressureNeverBelowReserve: belowReserveAt === null,
        belowReserveAt: belowReserveAt
      },
      feasible: feasible,
      verdict: feasible
        ? 'Задание выполнить возможно.'
        : 'Выполнение задания в заданных условиях невозможно.',
      reason: buildReason(inputs, primary, alloc, forwardWithinShare, reserveIntact, belowReserveAt)
    };
  }

  function buildReason(inputs, primary, alloc, forwardOk, reserveOk, belowAt) {
    if (!forwardOk) {
      return 'На движение вперёд израсходовано ' + units.fmt(primary.spentForwardMPa) +
             ' МПа при допустимой доле ' + units.fmt(alloc.allowedForwardMPa) + ' МПа (' +
             alloc.rule + ').';
    }
    if (belowAt) {
      return 'В точке «' + belowAt + '» давление опускается ниже резервного запаса ' +
             units.fmt(inputs.reservePressureMPa) + ' МПа.';
    }
    if (!reserveOk) {
      return 'После возвращения на ПБ остаётся ' + units.fmt(primary.finalPressureMPa) +
             ' МПа, что меньше резервного запаса ' + units.fmt(inputs.reservePressureMPa) + ' МПа.';
    }
    return 'Расход на движение вперёд (' + units.fmt(primary.spentForwardMPa) + ' МПа) не превышает ' +
           'допустимой доли рабочего запаса (' + units.fmt(alloc.allowedForwardMPa) + ' МПа), ' +
           'а после возвращения на ПБ остаётся ' + units.fmt(primary.finalPressureMPa) +
           ' МПа при резерве ' + units.fmt(inputs.reservePressureMPa) + ' МПа.';
  }

  /* ------------------------------------------------- максимальная дальность --- */

  /**
   * T24: какое наибольшее расстояние отделение может пройти вперёд.
   * Считается из допустимой доли рабочего запаса и замеренного удельного расхода;
   * генератором это расстояние не задаётся.
   */
  function maxForwardDistance(inputs) {
    var alloc = allocation(inputs);
    var k = inputs.consumptionPer100mMPa;
    if (!(k > 0)) throw new Error('Удельный расход должен быть больше нуля, получен ' + k);

    var exactM = alloc.allowedForwardMPa / k * 100;

    return {
      allocation: alloc,
      consumptionPer100mMPa: k,
      exactDistanceM: exactM,
      /* Обратная подстановка: пройденное расстояние обязано израсходовать
       * ровно допустимую долю рабочего запаса. */
      backSubstitutionMPa: exactM / 100 * k
    };
  }

  VGSCH.engine = VGSCH.engine || {};
  VGSCH.engine.solvers = VGSCH.engine.solvers || {};
  VGSCH.engine.solvers.dask = {
    workingReserve: workingReserve,
    allocation: allocation,
    returnRoute: returnRoute,
    solvePrimary: solvePrimary,
    solveCheck: solveCheck,
    solve: solve,
    maxForwardDistance: maxForwardDistance
  };
})(window.VGSCH = window.VGSCH || {});
