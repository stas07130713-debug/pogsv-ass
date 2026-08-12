/* Величины с единицами измерения.
 *
 * Внутреннее хранение строго: давление — МПа, длина — м, время — мин,
 * температура — °C, угол — градусы, скорость — м/мин.
 * Любое преобразование выполняется явно через convert(); молчаливое смешение
 * МПа / кгс·см⁻² / м / км / с / мин / ч исключено.
 */
(function (VGSCH) {
  'use strict';

  var CANONICAL = {
    pressure: 'МПа',
    length: 'м',
    time: 'мин',
    temperature: '°C',
    angle: '°',
    speed: 'м/мин'
  };

  /* Коэффициенты приведения к канонической единице. */
  var FACTORS = {
    'МПа': { dim: 'pressure', k: 1 },
    'кгс/см²': { dim: 'pressure', k: 0.1 },   // 1 МПа = 10 кгс/см² (Устав приводит 5 МПа = 50 кг/см²)
    'атм': { dim: 'pressure', k: 0.101325 },
    'м': { dim: 'length', k: 1 },
    'км': { dim: 'length', k: 1000 },
    'см': { dim: 'length', k: 0.01 },
    'мин': { dim: 'time', k: 1 },
    'с': { dim: 'time', k: 1 / 60 },
    'ч': { dim: 'time', k: 60 },
    '°C': { dim: 'temperature', k: 1 },
    '°': { dim: 'angle', k: 1 },
    'м/мин': { dim: 'speed', k: 1 },
    'м/с': { dim: 'speed', k: 60 }
  };

  /** Величина: значение + единица. Единица обязательна всегда. */
  function q(value, unit) {
    if (typeof value !== 'number' || !isFinite(value)) {
      throw new Error('units.q: значение должно быть конечным числом, получено: ' + value);
    }
    if (!FACTORS[unit]) throw new Error('units.q: неизвестная единица «' + unit + '»');
    return { value: value, unit: unit, dim: FACTORS[unit].dim };
  }

  /** Явное преобразование в другую единицу той же размерности. */
  function convert(quantity, toUnit) {
    var from = FACTORS[quantity.unit], to = FACTORS[toUnit];
    if (!from) throw new Error('units.convert: неизвестная исходная единица «' + quantity.unit + '»');
    if (!to) throw new Error('units.convert: неизвестная целевая единица «' + toUnit + '»');
    if (from.dim !== to.dim) {
      throw new Error('units.convert: несовместимые размерности — ' + quantity.unit +
                      ' (' + from.dim + ') и ' + toUnit + ' (' + to.dim + ')');
    }
    if (from.dim === 'temperature' && quantity.unit !== toUnit) {
      throw new Error('units.convert: преобразование температурных шкал не предусмотрено');
    }
    return q(quantity.value * from.k / to.k, toUnit);
  }

  /** Приведение к канонической единице своей размерности. */
  function canonical(quantity) {
    return convert(quantity, CANONICAL[quantity.dim]);
  }

  /** Сложение однородных величин; результат — в единице первого слагаемого. */
  function add(a, b) {
    return q(a.value + convert(b, a.unit).value, a.unit);
  }

  function sub(a, b) {
    return q(a.value - convert(b, a.unit).value, a.unit);
  }

  /** Округление до заданного числа знаков (только для вывода и финального ответа). */
  function round(value, decimals) {
    var f = Math.pow(10, decimals === undefined ? 2 : decimals);
    return Math.round((value + Number.EPSILON) * f) / f;
  }

  /** Сравнение с допуском — для сверки ответа пользователя и обратной подстановки. */
  function close(a, b, tol) { return Math.abs(a - b) <= (tol === undefined ? 1e-9 : tol); }

  /** Русская запись числа: разделитель — запятая, хвостовые нули убраны. */
  function fmt(value, decimals) {
    var v = round(value, decimals);
    var s = String(v);
    if (s.indexOf('.') !== -1) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s.replace('.', ',');
  }

  /** «12,5 МПа» */
  function fmtQ(quantity, decimals) {
    return fmt(quantity.value, decimals) + ' ' + quantity.unit;
  }

  VGSCH.engine = VGSCH.engine || {};
  VGSCH.engine.units = {
    CANONICAL: CANONICAL,
    FACTORS: FACTORS,
    q: q,
    convert: convert,
    canonical: canonical,
    add: add,
    sub: sub,
    round: round,
    close: close,
    fmt: fmt,
    fmtQ: fmtQ
  };
})(window.VGSCH = window.VGSCH || {});
