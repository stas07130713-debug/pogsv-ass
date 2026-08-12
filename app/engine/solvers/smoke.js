/* Решатель задач по скорости передвижения и задымлённости.
 * Нормативная основа: ФНП № 520, приложение № 7 (табл. N 1 — Vп.в, табл. N 2 — k₃).
 *
 * Порядок расчёта нарушать нельзя:
 *   исходные условия → нормативная категория → Vп.в из таблицы →
 *   k₃ из таблицы → V₃ = Vп.в / k₃ → t = L / V₃.
 * Случайная «средняя скорость» вместо табличной недопустима.
 */
(function (VGSCH) {
  'use strict';

  var A7 = VGSCH.normative.fnp520app7;
  var units = VGSCH.engine.units;

  /**
   * inputs: {
   *   atmosphere, work, excavationHeightM, slopeDeg,
   *   visibilityM,            // необязательно: без него движение при полной видимости
   *   routeLengthM            // необязательно: нужно для расчёта времени
   * }
   */
  function solve(inputs) {
    var vFull = A7.fullVisibilitySpeed(
      inputs.atmosphere, inputs.work, inputs.excavationHeightM, inputs.slopeDeg
    );

    var result = {
      fullVisibilitySpeed: vFull,
      smoke: null,
      speedMPerMin: vFull.value,
      timeMin: null,
      steps: []
    };

    result.steps.push({
      label: 'Скорость при полной видимости',
      value: units.fmt(vFull.value) + ' м/мин',
      point: vFull.point,
      detail: vFull.reason
    });

    if (typeof inputs.visibilityM === 'number') {
      var k3 = A7.smokeCoefficient(inputs.visibilityM);
      var v3 = A7.smokeSpeed(vFull.value, k3.value);
      result.smoke = { k3: k3, speedMPerMin: v3 };
      result.speedMPerMin = v3;

      result.steps.push({
        label: 'Коэффициент задымлённости k₃',
        value: units.fmt(k3.value),
        point: k3.point,
        detail: k3.reason
      });
      result.steps.push({
        label: 'Скорость в задымлённой выработке V₃ = Vп.в / k₃',
        value: units.fmt(vFull.value) + ' / ' + units.fmt(k3.value) + ' = ' + units.fmt(v3) + ' м/мин',
        point: 'прил. 7',
        detail: 'Скорость получена делением табличного значения на коэффициент задымлённости.'
      });
    }

    if (typeof inputs.routeLengthM === 'number') {
      if (!(inputs.routeLengthM > 0)) {
        throw new Error('Длина маршрута должна быть больше нуля, получено ' + inputs.routeLengthM);
      }
      result.timeMin = inputs.routeLengthM / result.speedMPerMin;
      result.steps.push({
        label: 'Время движения t = L / V',
        value: units.fmt(inputs.routeLengthM) + ' / ' + units.fmt(result.speedMPerMin) +
               ' = ' + units.fmt(result.timeMin) + ' мин',
        point: 'прил. 7',
        detail: 'Единицы согласованы: длина в метрах, скорость в метрах в минуту, время в минутах.'
      });
    }

    return result;
  }

  /**
   * Обратная подстановка: из времени и скорости восстанавливаем длину,
   * из V₃ и k₃ — исходную табличную скорость.
   */
  function backSubstitution(result, inputs) {
    var out = {};
    if (result.timeMin !== null) {
      out.lengthM = result.timeMin * result.speedMPerMin;
    }
    if (result.smoke) {
      out.fullVisibilitySpeed = result.smoke.speedMPerMin * result.smoke.k3.value;
    }
    return out;
  }

  /**
   * Время «туда» и «обратно» при разных условиях движения.
   * t_обратно НЕ приравнивается к t_туда: возвращение считается отдельно.
   */
  function roundTrip(forwardInputs, backInputs) {
    var f = solve(forwardInputs);
    var b = solve(backInputs);
    return {
      forward: f,
      back: b,
      totalTimeMin: (f.timeMin || 0) + (b.timeMin || 0)
    };
  }

  VGSCH.engine = VGSCH.engine || {};
  VGSCH.engine.solvers = VGSCH.engine.solvers || {};
  VGSCH.engine.solvers.smoke = {
    solve: solve,
    backSubstitution: backSubstitution,
    roundTrip: roundTrip
  };
})(window.VGSCH = window.VGSCH || {});
