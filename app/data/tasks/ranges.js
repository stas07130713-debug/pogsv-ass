/* Допустимые диапазоны числовых параметров — по файлу «Матрица ограничений
 * генератора задач ВГСЧ».
 *
 * Главное правило: генератор НИКОГДА не берёт «любое случайное положительное
 * число». Значение выбирается только из allowed_domain конкретного типа задачи.
 *
 * constraintType:
 *   normative   — величина прямо установлена действующим НПА;
 *   technical   — физический или технический предел;
 *   educational — УЧЕБНЫЙ диапазон: норматив его не устанавливает.
 *                 Пользователю такое ограничение никогда не подаётся
 *                 как нормативное требование;
 *   derived     — вычисляется, отдельно не генерируется.
 *
 * ЗАМЕНЯЕМЫЙ БЛОК ДАННЫХ.
 */
(function (VGSCH) {
  'use strict';

  var A6 = VGSCH.normative.fnp520app6;
  var A7 = VGSCH.normative.fnp520app7;
  var U = VGSCH.normative.ustav251;

  /* Начальное давление в баллоне ДА.
   * Устав п. 22 оперирует полным баллоном (резерв 5 МПа + рабочий запас 15 МПа = 20 МПа).
   * Учебный диапазон ниже 20 МПа моделирует не полностью заряженный аппарат;
   * это учебное, а не нормативное ограничение. */
  var initialPressure = {
    parameter: 'initial_pressure_MPa',
    unit: 'МПа',
    constraintType: 'educational',
    source: { sourceId: 'educational', point: null },
    min: 16, max: 20, step: 0.5,
    forbidden: ['P <= резерв', 'рабочий запас <= 0'],
    note: 'Полный баллон по Уставу п. 22 — 20 МПа. Меньшие значения моделируют ' +
          'неполный заряд и используются только как учебное условие.'
  };

  var RANGES = {

    /* ---------------- ДАСК ---------------- */

    initial_pressure_MPa: initialPressure,

    reserve_pressure_MPa: {
      parameter: 'reserve_pressure_MPa',
      unit: 'МПа',
      constraintType: 'normative',
      source: { sourceId: 'ustav251', point: 'п. 22' },
      fixed: U.RESERVE_PRESSURE_MPA,
      note: 'Резерв установлен нормативом и генератором не варьируется.'
    },

    working_reserve_MPa: {
      parameter: 'working_reserve_MPa',
      unit: 'МПа',
      constraintType: 'derived',
      source: { sourceId: 'ustav251', point: 'п. 22' },
      formula: 'Pраб = Pнач − Pрез',
      note: 'Вычисляется, отдельно не генерируется. Проверка: Pраб > 0.'
    },

    /* Расход дыхательной смеси на участок.
     * НИ Устав № 251, НИ ФНП № 520, НИ Справочник командира отделения ВГСЧ 2023
     * не устанавливают удельного расхода (МПа на метр или на минуту): проверено
     * по полному тексту всех трёх документов. Поэтому расход в задаче —
     * ИСХОДНОЕ ДАННОЕ (показание манометра), а не расчётная нормативная величина. */
    segment_consumption_MPa: {
      parameter: 'segment_consumption_MPa',
      unit: 'МПа',
      constraintType: 'educational',
      source: { sourceId: 'educational', point: null },
      min: 0.5, max: 6, step: 0.1,
      forbidden: ['расход <= 0', 'расход > доступного запаса участка'],
      note: 'Задаётся условием задачи как замеренная величина. Норм удельного расхода ' +
            'в действующей нормативной базе проекта нет, поэтому вычислять его нельзя.'
    },

    /* Удельный расход на 100 м — тоже замеренная, а не нормативная величина.
     * Нужен там, где по давлению требуется определить расстояние (T24). */
    consumption_per_100m_MPa: {
      parameter: 'consumption_per_100m_MPa',
      unit: 'МПа',
      constraintType: 'educational',
      source: { sourceId: 'educational', point: null },
      min: 0.4, max: 2, step: 0.1,
      forbidden: ['удельный расход <= 0'],
      note: 'Показание, полученное замером на маршруте. Нормативного удельного расхода ' +
            'в базе проекта нет, поэтому величина всегда даётся условием задачи.'
    },

    route_length_each_m: {
      parameter: 'route_length_each_m',
      unit: 'м',
      constraintType: 'educational',
      source: { sourceId: 'educational', point: null },
      min: 50, max: 500, step: 10,
      forbidden: ['L <= 0', 'разрыв графа маршрута']
    },

    segment_count: {
      parameter: 'segment_count',
      unit: 'шт.',
      constraintType: 'educational',
      source: { sourceId: 'educational', point: null },
      min: 1, max: 5, step: 1,
      byDifficulty: { 'простая': [1, 2], 'средняя': [2, 3], 'сложная': [3, 5] }
    },

    /* Угол наклона. Категориальный параметр: важна не столько величина,
     * сколько попадание в категорию Устава п. 22. Значение 10° — граница,
     * относится к «до 10° включительно». */
    slope_deg: {
      parameter: 'slope_deg',
      unit: '°',
      constraintType: 'technical',
      source: { sourceId: 'educational', point: null },
      min: 0, max: 30, step: 1,
      boundaries: [0, 10],
      /* Значения для каждой категории. Граница 10 включена только в «до 10°»,
       * 11 — минимальное значение категории «более 10°». */
      byCategory: {
        'horizontal': [0],
        'up': [5, 8, 10, 12, 15, 18, 20, 25, 30],
        'down_to_10': [3, 5, 6, 8, 9, 10],
        'down_over_10': [11, 12, 14, 15, 18, 20, 25, 30]
      }
    },

    /* ---------------- Температура ---------------- */

    high_temperature_C: {
      parameter: 'temperature_C',
      unit: '°C',
      constraintType: 'normative',
      source: { sourceId: 'fnp520', point: 'прил. 6, табл. N 1' },
      allowedValues: A6.TABLE_1.map(function (r) { return r[0]; }),
      note: 'Только значения строк таблицы N 1. Интерполяция не предусмотрена.'
    },

    rescue_only_temperature_C: {
      parameter: 'temperature_C',
      unit: '°C',
      constraintType: 'normative',
      source: { sourceId: 'fnp520', point: 'прил. 6, п. 13' },
      min: A6.RESCUE_ONLY_FROM_C, max: A6.RESCUE_ONLY_TO_C, step: 1,
      note: 'Диапазон, в котором работы допускаются только при спасении людей ' +
            'и не более 10 минут.'
    },

    low_temperature_C: {
      parameter: 'temperature_C',
      unit: '°C',
      constraintType: 'normative',
      source: { sourceId: 'fnp520', point: 'прил. 6, табл. N 2' },
      min: A6.MIN_WORK_TEMP_C, max: 0, step: 1,
      /* Стыки строк таблицы: значение принадлежит сразу двум диапазонам,
       * нормативного правила разрешения нет — в задачах не используем. */
      forbiddenValues: A6.TABLE_2_AMBIGUOUS,
      boundaries: [0, A6.MIN_WORK_TEMP_C]
    },

    temperature_rise_C: {
      parameter: 'temperature_rise_C',
      unit: '°C',
      constraintType: 'educational',
      source: { sourceId: 'educational', point: null },
      min: 1, max: 6, step: 1,
      boundaries: [A6.TEMP_RISE_ABORT_DELTA_C],
      note: 'Порог прекращения задания (3 °C за 5 минут) — нормативный; ' +
            'сам набор разыгрываемых приращений — учебный.'
    },

    /* ---------------- Задымление и скорость ---------------- */

    visibility_m: {
      parameter: 'visibility_m',
      unit: 'м',
      constraintType: 'normative',
      source: { sourceId: 'fnp520', point: 'прил. 7, табл. N 2' },
      /* Значения подобраны так, чтобы попадать в каждую строку таблицы,
       * включая её границы 5 и 10 м, которые однозначно относятся к «5–10». */
      allowedValues: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 30],
      boundaries: [5, 10]
    },

    excavation_height_m: {
      parameter: 'excavation_height_m',
      unit: 'м',
      constraintType: 'normative',
      source: { sourceId: 'fnp520', point: 'прил. 7, табл. N 1' },
      allowedValues: A7.HEIGHTS,
      note: 'Только высоты строк таблицы N 1; интерполяция запрещена.'
    },

    table_angle_deg: {
      parameter: 'slope_deg',
      unit: '°',
      constraintType: 'normative',
      source: { sourceId: 'fnp520', point: 'прил. 7, табл. N 1' },
      allowedValues: A7.ANGLES,
      note: 'Только углы столбцов таблицы N 1; интерполяция запрещена.'
    },

    smoke_route_length_m: {
      parameter: 'route_length_m',
      unit: 'м',
      constraintType: 'educational',
      source: { sourceId: 'educational', point: null },
      min: 20, max: 900, step: 10,
      note: 'Конкретная длина выбирается под табличную скорость так, чтобы время движения ' +
            'оставалось осмысленным и не превышало четырёх часов пребывания в ДА ' +
            '(ФНП № 520, прил. 6, п. 3).'
    }
  };

  /** Проверка описания диапазона перед генерацией (правило 28 промта). */
  function validateSpec(key) {
    var s = RANGES[key];
    if (!s) throw new Error('validateSpec: нет описания параметра «' + key + '»');
    if (!s.unit) throw new Error(key + ': не указана единица измерения');
    if (!s.constraintType) throw new Error(key + ': не указан constraintType');
    if (!s.source) throw new Error(key + ': не указан источник ограничения');

    var hasFixed = s.fixed !== undefined;
    var hasList = Array.isArray(s.allowedValues) && s.allowedValues.length > 0;
    var hasRange = typeof s.min === 'number' && typeof s.max === 'number';
    var isDerived = s.constraintType === 'derived';

    if (!hasFixed && !hasList && !hasRange && !isDerived) {
      throw new Error(key + ': не задано ни fixed, ни allowedValues, ни пары min/max');
    }
    if (hasRange) {
      if (s.min > s.max) throw new Error(key + ': min (' + s.min + ') больше max (' + s.max + ')');
      if (s.step !== undefined && !(s.step > 0)) throw new Error(key + ': шаг должен быть больше нуля');
    }
    return true;
  }

  /** Прогон всех описаний. Вызывается перед каждой генерацией. */
  function validateAll() {
    var errors = [];
    Object.keys(RANGES).forEach(function (k) {
      try { validateSpec(k); } catch (e) { errors.push(e.message); }
    });
    if (errors.length) throw new Error('GENERATION_REJECTED: ' + errors.join('; '));
    return true;
  }

  /** Значение из допустимого домена параметра. */
  function sample(rng, key, opts) {
    validateSpec(key);
    var s = RANGES[key];
    opts = opts || {};

    if (s.fixed !== undefined) return s.fixed;

    var pool = opts.pool || s.allowedValues;
    if (pool) {
      if (s.forbiddenValues) {
        pool = pool.filter(function (v) { return s.forbiddenValues.indexOf(v) === -1; });
      }
      if (!pool.length) throw new Error(key + ': допустимый домен пуст после исключений');
      return rng.pick(pool);
    }

    var min = opts.min !== undefined ? opts.min : s.min;
    var max = opts.max !== undefined ? opts.max : s.max;
    for (var attempt = 0; attempt < 50; attempt++) {
      var v = rng.step(min, max, s.step || 1);
      if (s.forbiddenValues && s.forbiddenValues.indexOf(v) !== -1) continue;
      return v;
    }
    throw new Error(key + ': не удалось выбрать значение вне списка запрещённых');
  }

  VGSCH.data = VGSCH.data || {};
  VGSCH.data.ranges = {
    RANGES: RANGES,
    sample: sample,
    validateSpec: validateSpec,
    validateAll: validateAll
  };
})(window.VGSCH = window.VGSCH || {});
