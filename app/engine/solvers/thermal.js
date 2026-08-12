/* Решатель задач по температурному фактору.
 * Нормативная основа: ФНП № 520, приложение № 6 (табл. N 1 и N 2, пп. 11–13, 17–19),
 * основной текст п. 27, а также Устав ВГСЧ пп. 38, 39, 41.
 */
(function (VGSCH) {
  'use strict';

  var A6 = VGSCH.normative.fnp520app6;
  var U = VGSCH.normative.ustav251;
  var units = VGSCH.engine.units;

  var EPS = 1e-9;

  /**
   * Допустимое время пребывания.
   * @param {number} tC          определяющая температура, °C
   * @param {string} activity    'на месте' | 'передвижение'
   * @param {boolean} rescueWork работы связаны со спасением людей
   */
  function allowance(tC, activity, rescueWork) {
    var r = tC > 0 ? A6.highTempAllowance(tC, activity) : A6.lowTempAllowance(tC, activity);

    /* П. 13: выше 40 °C работы, не связанные со спасением людей, запрещены. */
    if (r.rescueOnly && !rescueWork) {
      return {
        minutes: null, allowed: false, point: 'прил. 6, п. 13',
        reason: 'При температуре ' + tC + ' °C работы, не связанные со спасением людей, запрещены. ' +
                'Пребывание до десяти минут допускается только при спасении людей.'
      };
    }
    return r;
  }

  /**
   * Распределение допустимого времени при передвижении: 1/3 «туда», 2/3 «обратно»
   * (прил. 6 п. 12 и п. 18; Устав п. 38).
   */
  function splitMovementTime(totalMin) {
    if (!(totalMin > 0)) throw new Error('Допустимое время должно быть положительным, получено ' + totalMin);
    return {
      totalMin: totalMin,
      forwardMin: totalMin * A6.FORWARD_NUM / A6.FORWARD_DEN,
      backMin: totalMin * A6.BACK_NUM / A6.BACK_DEN,
      rule: 'одна треть на передвижение в направлении «туда» и две трети — в направлении «обратно»'
    };
  }

  /**
   * Определяющая температура маршрута.
   * ЗВТ — по максимальной замеренной (прил. 6 п. 11, Устав п. 39);
   * низкие температуры — по выработке с минимальной температурой (прил. 6 п. 18).
   */
  function governing(temps) {
    var maxT = A6.governingTemperature(temps, 'высокая');
    var minT = A6.governingTemperature(temps, 'низкая');
    var mode = A6.isZVT(maxT) ? 'высокая' : 'низкая';
    return {
      mode: mode,
      valueC: mode === 'высокая' ? maxT : minT,
      maxC: maxT,
      minC: minT,
      point: mode === 'высокая' ? 'прил. 6, п. 11 / Устав, п. 39' : 'прил. 6, п. 18',
      reason: mode === 'высокая'
        ? 'Время пребывания в ЗВТ определяется по максимальной замеренной температуре воздуха — ' +
          maxT + ' °C.'
        : 'При движении по выработкам с различной температурой расчёт ведётся по выработке ' +
          'с минимальной температурой — ' + minT + ' °C.'
    };
  }

  /**
   * Полное решение температурной задачи.
   * inputs: { temperaturesC: [..], activity, rescueWork, actualTimeMin? }
   */
  function solve(inputs) {
    var g = governing(inputs.temperaturesC);
    var a = allowance(g.valueC, inputs.activity, inputs.rescueWork);

    var result = {
      governing: g,
      allowance: a,
      split: null,
      feasible: a.allowed,
      verdict: '',
      reason: a.reason
    };

    if (!a.allowed || a.minutes === null) {
      result.feasible = false;
      result.verdict = 'Выполнение задания в заданных условиях невозможно.';
      return result;
    }

    if (inputs.activity === 'передвижение') {
      result.split = splitMovementTime(a.minutes);
    }

    /* Если задано фактическое время, сверяем его с допустимым. */
    if (typeof inputs.actualTimeMin === 'number') {
      var limit = inputs.activity === 'передвижение' ? result.split.forwardMin : a.minutes;
      var label = inputs.activity === 'передвижение' ? 'время движения вперёд' : 'время пребывания';
      result.feasible = inputs.actualTimeMin <= limit + EPS;
      result.reason = result.feasible
        ? 'Фактическое ' + label + ' ' + units.fmt(inputs.actualTimeMin) + ' мин не превышает ' +
          'допустимого ' + units.fmt(limit) + ' мин.'
        : 'Фактическое ' + label + ' ' + units.fmt(inputs.actualTimeMin) + ' мин превышает ' +
          'допустимое ' + units.fmt(limit) + ' мин.';
    }

    result.verdict = result.feasible
      ? 'Задание выполнить возможно.'
      : 'Выполнение задания в заданных условиях невозможно.';
    return result;
  }

  /** T15: прекращение задания по росту температуры (п. 27 ФНП, Устав п. 41). */
  function temperatureRise(t0, t1) {
    return A6.mustAbortOnTempRise(t0, t1);
  }

  /**
   * Независимая проверка: из полученного времени «туда» восстанавливаем
   * полное допустимое время и сверяем со значением таблицы.
   */
  function backSubstitution(forwardMin) {
    return forwardMin * A6.FORWARD_DEN / A6.FORWARD_NUM;
  }

  VGSCH.engine = VGSCH.engine || {};
  VGSCH.engine.solvers = VGSCH.engine.solvers || {};
  VGSCH.engine.solvers.thermal = {
    allowance: allowance,
    splitMovementTime: splitMovementTime,
    governing: governing,
    solve: solve,
    temperatureRise: temperatureRise,
    backSubstitution: backSubstitution,
    REMEASURE_INTERVAL_MIN: U.ZVT_REMEASURE_INTERVAL_MIN
  };
})(window.VGSCH = window.VGSCH || {});
