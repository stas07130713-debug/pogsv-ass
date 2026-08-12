/* Генератор расчётных задач.
 *
 * Порядок строго по методологии проекта и не сокращается ради скорости:
 *   тип → нормативные правила → сэмплирование из допустимого домена →
 *   проверка совместимости → независимый solver → эталонный ответ →
 *   обратная подстановка → JSON → текст → схема → сверка → VALID.
 *
 * Генератор НИКОГДА не придумывает условие, а затем подгоняет под него решение:
 * числа выбираются из допустимого пространства, ответ считает решатель.
 */
(function (VGSCH) {
  'use strict';

  var types = VGSCH.data.taskTypes;
  var ranges = VGSCH.data.ranges;
  var rngLib = VGSCH.engine.rng;
  var units = VGSCH.engine.units;
  var N = VGSCH.normative;
  var U = N.ustav251;
  var A6 = N.fnp520app6;
  var A7 = N.fnp520app7;

  var daskSolver = VGSCH.engine.solvers.dask;
  var thermalSolver = VGSCH.engine.solvers.thermal;
  var smokeSolver = VGSCH.engine.solvers.smoke;

  /* ------------------------------------------------------------ помощники --- */

  function basisOf(type) {
    return type.basis.map(function (pair) {
      var s = N.SOURCES[pair[0]];
      return { document: s.document, revision: s.revision, point: pair[1] };
    });
  }

  function round1(v) { return Math.round(v * 10) / 10; }

  /** Числовой ответ с указанием единицы и допуска.
   *  exact — неокруглённое значение; по нему валидатор проверяет округление. */
  function numericAnswer(value, unit, decimals) {
    var d = decimals === undefined ? 2 : decimals;
    return {
      type: 'numeric',
      value: rngLib.round(value, d),
      exact: value,
      unit: unit,
      decimals: d
    };
  }

  function booleanAnswer(value) {
    return {
      type: 'boolean',
      value: !!value,
      options: [
        { value: true, label: 'Задание выполнить возможно' },
        { value: false, label: 'Выполнение задания в заданных условиях невозможно' }
      ]
    };
  }

  function step(label, value, point, detail) {
    return { label: label, value: value, point: point || null, detail: detail || null };
  }

  /**
   * Маршрут «туда» с расходами, выбранными внутри допустимой доли рабочего запаса.
   * Числа не подгоняются под красивый ответ: сначала бюджет по нормативу,
   * затем распределение внутри него.
   */
  function buildRoute(rng, opts) {
    var category = opts.category;
    var count = opts.segmentCount;

    var segments = [];
    for (var i = 0; i < count; i++) {
      var slope, incline;
      if (category === 'down_over_10' && i === opts.strictSegmentIndex) {
        slope = rng.pick(ranges.RANGES.slope_deg.byCategory.down_over_10);
        incline = 'спуск';
      } else if (opts.mixed) {
        var kind = rng.pick(['horizontal', 'up', 'down_to_10']);
        slope = rng.pick(ranges.RANGES.slope_deg.byCategory[kind]);
        incline = kind === 'horizontal' ? 'горизонталь' : (kind === 'up' ? 'подъём' : 'спуск');
      } else {
        slope = rng.pick(ranges.RANGES.slope_deg.byCategory[category]);
        incline = category === 'horizontal' ? 'горизонталь'
                : (category === 'up' ? 'подъём' : 'спуск');
      }
      segments.push({
        id: 'Участок ' + (i + 1),
        lengthM: ranges.sample(rng, 'route_length_each_m'),
        slopeDeg: slope,
        incline: incline,
        direction: 'туда',
        consumptionMPa: 0
      });
    }
    return segments;
  }

  /** Распределение суммарного расхода по участкам пропорционально длине, с шагом 0,1 МПа. */
  function distributeConsumption(segments, totalMPa) {
    var totalLength = segments.reduce(function (a, s) { return a + s.lengthM; }, 0);
    var assigned = 0;
    for (var i = 0; i < segments.length; i++) {
      var share = i === segments.length - 1
        ? round1(totalMPa - assigned)
        : round1(totalMPa * segments[i].lengthM / totalLength);
      if (share < 0.1) share = 0.1;
      segments[i].consumptionMPa = share;
      assigned = round1(assigned + share);
    }
    return segments.reduce(function (a, s) { return round1(a + s.consumptionMPa); }, 0);
  }

  /* ------------------------------------------------------------ построители --- */

  var BUILDERS = {};

  /* --- T01. Рабочий и резервный запас --- */
  BUILDERS.T01 = function (rng) {
    var p0 = ranges.sample(rng, 'initial_pressure_MPa');
    var pres = ranges.RANGES.reserve_pressure_MPa.fixed;
    var wr = daskSolver.workingReserve({ initialPressureMPa: p0, reservePressureMPa: pres });

    return {
      inputs: { initialPressureMPa: p0, reservePressureMPa: pres },
      question: 'Давление в баллоне ДА перед включением составляет ' + units.fmt(p0) + ' МПа. ' +
                'Определите рабочий запас дыхательной смеси.',
      answer: numericAnswer(wr, 'МПа', 1),
      steps: [
        step('Резервный запас', units.fmt(pres) + ' МПа', 'Устав ВГСЧ, п. 22',
             U.quotes.reserve),
        step('Рабочий запас', 'Pраб = Pнач − Pрез = ' + units.fmt(p0) + ' − ' + units.fmt(pres) +
             ' = ' + units.fmt(wr) + ' МПа', 'Устав ВГСЧ, п. 22', null)
      ]
    };
  };

  /* --- T02. Давление начала возвращения --- */
  BUILDERS.T02 = function (rng) {
    var p0 = ranges.sample(rng, 'initial_pressure_MPa');
    var pres = ranges.RANGES.reserve_pressure_MPa.fixed;
    var strict = rng.chance(0.5);
    var category = strict ? 'down_over_10' : rng.pick(['horizontal', 'up', 'down_to_10']);
    var slope = rng.pick(ranges.RANGES.slope_deg.byCategory[category]);
    var incline = category === 'horizontal' ? 'горизонталь' : (category === 'up' ? 'подъём' : 'спуск');

    var segments = [{ id: 'Участок 1', lengthM: ranges.sample(rng, 'route_length_each_m'),
                      slopeDeg: slope, incline: incline, direction: 'туда', consumptionMPa: 1 }];
    var alloc = daskSolver.allocation({
      initialPressureMPa: p0, reservePressureMPa: pres, segments: segments
    });
    var pTurn = p0 - alloc.allowedForwardMPa;

    return {
      inputs: { initialPressureMPa: p0, reservePressureMPa: pres, segments: segments, slopeDeg: slope, incline: incline },
      question: 'Отделение направляется по горной выработке (' + describeGeometry(incline, slope) +
                ') с непригодной для дыхания атмосферой. Давление в баллоне ДА — ' + units.fmt(p0) +
                ' МПа. Определите давление, при котором отделение должно прекратить движение вперёд.',
      answer: numericAnswer(pTurn, 'МПа', 2),
      steps: [
        step('Рабочий запас', 'Pраб = ' + units.fmt(p0) + ' − ' + units.fmt(pres) + ' = ' +
             units.fmt(alloc.workingReserveMPa) + ' МПа', 'Устав ВГСЧ, п. 22', U.quotes.reserve),
        step('Категория участка', describeCategory(alloc.category), 'Устав ВГСЧ, п. 22',
             alloc.category === 'down_over_10' ? U.quotes.thirdTwoThirds : U.quotes.halfHalf),
        step('Доля на движение вперёд',
             alloc.share.forwardNum + '/' + alloc.share.forwardDen + ' × ' +
             units.fmt(alloc.workingReserveMPa) + ' = ' + units.fmt(alloc.allowedForwardMPa) + ' МПа',
             'Устав ВГСЧ, п. 22', alloc.rule),
        step('Давление начала возвращения',
             units.fmt(p0) + ' − ' + units.fmt(alloc.allowedForwardMPa) + ' = ' + units.fmt(pTurn) + ' МПа',
             'Устав ВГСЧ, п. 23', U.quotes.returnPressure)
      ]
    };
  };

  /* --- T03–T06. Маршрут одной категории: горизонталь, подъём, спуск ≤10°, спуск >10° --- */
  function routeCategoryBuilder(category) {
    return function (rng) {
      return daskRouteTask(rng, {
        category: category,
        segmentCount: rng.int(1, 2),
        feasible: true
      });
    };
  }
  BUILDERS.T03 = routeCategoryBuilder('horizontal');
  BUILDERS.T04 = routeCategoryBuilder('up');
  BUILDERS.T05 = routeCategoryBuilder('down_to_10');
  BUILDERS.T06 = routeCategoryBuilder('down_over_10');

  /* --- T07. Несколько участков --- */
  BUILDERS.T07 = function (rng) {
    var count = rng.int(3, 5);
    return daskRouteTask(rng, {
      category: rng.chance(0.4) ? 'down_over_10' : 'mixed',
      segmentCount: count,
      feasible: true,
      scheme: true
    });
  };

  /* --- T08. Давление в промежуточной точке --- */
  BUILDERS.T08 = function (rng) {
    var t = daskRouteTask(rng, {
      category: rng.chance(0.4) ? 'down_over_10' : 'mixed',
      segmentCount: rng.int(2, 4),
      feasible: true,
      scheme: true
    });
    var segs = t.inputs.segments;
    var pointIndex = rng.int(1, segs.length);   // 1..N — после какого участка
    var pressure = t.inputs.initialPressureMPa;
    for (var i = 0; i < pointIndex; i++) pressure = round1(pressure - segs[i].consumptionMPa);

    t.inputs.pointIndex = pointIndex;   // нужен валидатору для независимого пересчёта
    t.question = describeRoute(t.inputs) +
      ' Определите давление в баллоне ДА в точке после участка ' + pointIndex + '.';
    t.answer = numericAnswer(pressure, 'МПа', 2);
    t.steps = [
      step('Давление на ПБ', units.fmt(t.inputs.initialPressureMPa) + ' МПа', null, null)
    ].concat(segs.slice(0, pointIndex).map(function (s, i) {
      var p = t.inputs.initialPressureMPa;
      for (var k = 0; k <= i; k++) p = round1(p - segs[k].consumptionMPa);
      return step('После участка ' + (i + 1),
                  '− ' + units.fmt(s.consumptionMPa) + ' МПа → ' + units.fmt(p) + ' МПа', null, null);
    })).concat([
      step('Контроль резерва', 'В точке остаётся ' +
           units.fmt(pressure - t.inputs.reservePressureMPa) + ' МПа рабочего запаса сверх резерва ' +
           units.fmt(t.inputs.reservePressureMPa) + ' МПа', 'Устав ВГСЧ, п. 22', null)
    ]);
    return t;
  };

  /* --- T09. Механический транспорт --- */
  BUILDERS.T09 = function (rng) {
    var t = daskRouteTask(rng, {
      category: rng.pick(['horizontal', 'down_to_10']),
      segmentCount: rng.int(1, 2),
      feasible: true,
      mechTransport: true
    });
    return t;
  };

  /* --- T10. Эвакуация пострадавшего: время транспортировки --- */
  BUILDERS.T10 = function (rng) {
    var height = ranges.sample(rng, 'excavation_height_m');
    var angle = rng.pick(A7.ANGLES.filter(function (a) { return a > 0; }));
    var work = rng.chance(0.5) ? A7.WORK.VICTIM_UP : A7.WORK.VICTIM_DOWN;
    var conditions = { atmosphere: A7.ATM.UNBREATHABLE, work: work, height: height, angle: angle };
    var length = sampleRouteLengthFor(rng, speedFor(conditions));

    var r = smokeSolver.solve({
      atmosphere: A7.ATM.UNBREATHABLE,
      work: work,
      excavationHeightM: height,
      slopeDeg: angle,
      routeLengthM: length
    });

    return {
      inputs: { atmosphere: A7.ATM.UNBREATHABLE, work: work, excavationHeightM: height,
                slopeDeg: angle, routeLengthM: length },
      question: 'Отделение эвакуирует пострадавшего по горной выработке высотой ' +
                units.fmt(height) + ' м с углом наклона ' + units.fmt(angle) + '° ' +
                atmosphereIn(A7.ATM.UNBREATHABLE) + '. Вид работы — ' + work +
                '. Длина участка — ' + units.fmt(length) + ' м. Определите время транспортировки.',
      answer: numericAnswer(r.timeMin, 'мин', 1),
      steps: r.steps.map(function (s) { return step(s.label, s.value, s.point, s.detail); })
    };
  };

  /* --- T11. Рабочее время защитного действия --- */
  BUILDERS.T11 = function (rng) {
    var list = N.apparatus.list;
    if (!list.length) {
      throw new Error('Не заполнен app/data/normative/apparatus.js: ' +
                      'характеристики ДА не подтверждены руководством по эксплуатации.');
    }
    var a = rng.pick(list);
    var w = N.apparatus.workingProtectiveTime(a.id);
    var limit = N.apparatus.MAX_STAY_IN_UNBREATHABLE_MIN;

    return {
      inputs: {
        apparatusId: a.id,
        apparatusModel: a.model,
        medium: a.medium,
        nominalProtectiveTimeMin: a.nominalProtectiveTimeMin
      },
      question: 'Отделение работает в горных выработках с непригодной для дыхания рудничной ' +
                'атмосферой в дыхательных аппаратах ' + a.model + ' (' + a.medium +
                '). Номинальное время защитного действия аппарата — ' +
                units.fmt(a.nominalProtectiveTimeMin) + ' мин. Определите рабочее время ' +
                'защитного действия, принимаемое для расчёта.',
      answer: numericAnswer(w.minutes, 'мин', 0),
      steps: [
        step('Номинальное время защитного действия',
             units.fmt(a.nominalProtectiveTimeMin) + ' мин', a.source, null),
        step('Правило рабочего объёма', w.reason, 'ФНП № 520, ' + w.limitedBy, A6.quotes.p2),
        step('Предельная продолжительность пребывания в ДА',
             'не более ' + limit + ' мин', 'ФНП № 520, прил. 6, п. 3', A6.quotes.p3),
        step('Расчётное рабочее время',
             units.fmt(w.minutes) + ' мин', 'ФНП № 520, ' + w.limitedBy, null)
      ]
    };
  };

  /* --- T13. Высокая температура: работа на месте --- */
  BUILDERS.T13 = function (rng) {
    var t = ranges.sample(rng, 'high_temperature_C');
    var r = thermalSolver.solve({ temperaturesC: [t], activity: 'на месте', rescueWork: false });

    return {
      inputs: { temperaturesC: [t], activity: 'на месте', rescueWork: false },
      question: 'Замеренная температура воздуха в зоне высоких температур с непригодной для дыхания ' +
                'рудничной атмосферой составляет ' + units.fmt(t) + ' °C. Отделение работает на одном ' +
                'месте без средств противотепловой индивидуальной защиты. Определите максимальную ' +
                'продолжительность непрерывного пребывания.',
      answer: numericAnswer(r.allowance.minutes, 'мин', 0),
      steps: [
        step('Определяющая температура', units.fmt(t) + ' °C', 'ФНП № 520, прил. 6, п. 11',
             A6.quotes.p11),
        step('Значение таблицы N 1', units.fmt(r.allowance.minutes) + ' мин',
             'ФНП № 520, прил. 6, табл. N 1', r.allowance.reason)
      ]
    };
  };

  /* --- T14. Высокая температура: движение --- */
  BUILDERS.T14 = function (rng) {
    var t = ranges.sample(rng, 'high_temperature_C');
    var r = thermalSolver.solve({ temperaturesC: [t], activity: 'передвижение', rescueWork: false });

    return {
      inputs: { temperaturesC: [t], activity: 'передвижение', rescueWork: false },
      question: 'Температура воздуха в ЗВТ с непригодной для дыхания рудничной атмосферой — ' +
                units.fmt(t) + ' °C. Отделение передвигается по горным выработкам без средств ' +
                'противотепловой индивидуальной защиты. Определите время, отводимое на передвижение ' +
                'в направлении «туда».',
      answer: numericAnswer(r.split.forwardMin, 'мин', 1),
      steps: [
        step('Допустимое время при передвижении', units.fmt(r.allowance.minutes) + ' мин',
             'ФНП № 520, прил. 6, табл. N 1', r.allowance.reason),
        step('Распределение времени',
             'туда — 1/3 × ' + units.fmt(r.allowance.minutes) + ' = ' + units.fmt(r.split.forwardMin) +
             ' мин; обратно — 2/3 × ' + units.fmt(r.allowance.minutes) + ' = ' +
             units.fmt(r.split.backMin) + ' мин',
             'ФНП № 520, прил. 6, п. 12', A6.quotes.p12),
        step('Обратная проверка',
             units.fmt(r.split.forwardMin) + ' × 3 = ' +
             units.fmt(thermalSolver.backSubstitution(r.split.forwardMin)) + ' мин — совпадает с таблицей',
             null, null)
      ]
    };
  };

  /* --- T15. Рост температуры за 5 минут --- */
  BUILDERS.T15 = function (rng) {
    var t0 = ranges.sample(rng, 'high_temperature_C');
    var delta = ranges.sample(rng, 'temperature_rise_C');
    var t1 = t0 + delta;
    var r = thermalSolver.temperatureRise(t0, t1);

    return {
      inputs: { t0C: t0, t1C: t1, intervalMin: A6.TEMP_RISE_ABORT_WINDOW_MIN },
      question: 'При входе в ЗВТ замерена температура воздуха ' + units.fmt(t0) + ' °C. ' +
                'Через 5 минут повторный замер показал ' + units.fmt(t1) + ' °C. ' +
                'Должно ли отделение прекратить выполнение задания и выйти на ПБ?',
      answer: {
        type: 'boolean',
        value: r.abort,
        options: [
          { value: true, label: 'Да, задание должно быть прекращено' },
          { value: false, label: 'Нет, задание может быть продолжено' }
        ]
      },
      steps: [
        step('Изменение температуры', 'ΔT = ' + units.fmt(t1) + ' − ' + units.fmt(t0) + ' = ' +
             units.fmt(r.deltaC) + ' °C за 5 минут', null, null),
        step('Нормативный порог', A6.TEMP_RISE_ABORT_DELTA_C + ' °C и более за 5 минут',
             'ФНП № 520, п. 27 / Устав ВГСЧ, п. 41', U.quotes.p41),
        step('Вывод', r.reason, null, null)
      ]
    };
  };

  /* --- T16. Несколько температур по маршруту --- */
  BUILDERS.T16 = function (rng) {
    var count = rng.int(3, 4);
    var temps = rng.pickMany(ranges.RANGES.high_temperature_C.allowedValues, count);
    var activity = rng.chance(0.5) ? 'передвижение' : 'на месте';
    var r = thermalSolver.solve({ temperaturesC: temps, activity: activity, rescueWork: false });

    return {
      inputs: { temperaturesC: temps, activity: activity, rescueWork: false },
      question: 'При движении по маршруту в горных выработках с непригодной для дыхания рудничной ' +
                'атмосферой замерены температуры воздуха: ' +
                temps.map(function (v) { return units.fmt(v) + ' °C'; }).join(', ') + '. ' +
                'Отделение работает без средств противотепловой индивидуальной защиты, режим — ' +
                (activity === 'передвижение' ? 'передвижение по горным выработкам' : 'работа на одном месте') +
                '. Определите максимальную продолжительность непрерывного пребывания.',
      answer: numericAnswer(r.allowance.minutes, 'мин', 0),
      steps: [
        step('Определяющая температура', units.fmt(r.governing.valueC) + ' °C',
             'ФНП № 520, прил. 6, п. 11 / Устав ВГСЧ, п. 39', r.governing.reason),
        step('Значение таблицы N 1', units.fmt(r.allowance.minutes) + ' мин',
             'ФНП № 520, прил. 6, табл. N 1', r.allowance.reason)
      ]
    };
  };

  /* --- T17. Низкая температура --- */
  BUILDERS.T17 = function (rng) {
    var t = ranges.sample(rng, 'low_temperature_C');
    var activity = rng.chance(0.5) ? 'передвижение' : 'на месте';
    var r = thermalSolver.solve({ temperaturesC: [t], activity: activity, rescueWork: false });

    var steps = [
      step('Температура воздуха', units.fmt(t) + ' °C', 'ФНП № 520, прил. 6, п. 17', A6.quotes.p17),
      step('Значение таблицы N 2', units.fmt(r.allowance.minutes) + ' мин',
           'ФНП № 520, прил. 6, табл. N 2', r.allowance.reason)
    ];
    if (activity === 'передвижение') {
      steps.push(step('Распределение времени',
        'туда — 1/3 × ' + units.fmt(r.allowance.minutes) + ' = ' + units.fmt(r.split.forwardMin) +
        ' мин; обратно — 2/3 × ' + units.fmt(r.allowance.minutes) + ' = ' + units.fmt(r.split.backMin) + ' мин',
        'ФНП № 520, прил. 6, п. 18', A6.quotes.p18));
    }

    return {
      inputs: { temperaturesC: [t], activity: activity, rescueWork: false },
      question: 'Температура воздуха в горной выработке с непригодной для дыхания рудничной атмосферой ' +
                'составляет ' + units.fmt(t) + ' °C. Режим работы — ' +
                (activity === 'передвижение' ? 'передвижение по горным выработкам' : 'работа на одном месте') +
                '. ' + (activity === 'передвижение'
                  ? 'Определите время, отводимое на передвижение в направлении «туда».'
                  : 'Определите максимальную продолжительность непрерывного пребывания.'),
      answer: numericAnswer(activity === 'передвижение' ? r.split.forwardMin : r.allowance.minutes,
                            'мин', 1),
      steps: steps
    };
  };

  /* --- T19. Скорость в задымлённой выработке --- */
  BUILDERS.T19 = function (rng) {
    var p = sampleSpeedConditions(rng);
    var visibility = ranges.sample(rng, 'visibility_m');
    var r = smokeSolver.solve({
      atmosphere: p.atmosphere, work: p.work,
      excavationHeightM: p.height, slopeDeg: p.angle,
      visibilityM: visibility
    });

    return {
      inputs: { atmosphere: p.atmosphere, work: p.work, excavationHeightM: p.height,
                slopeDeg: p.angle, visibilityM: visibility },
      question: 'Отделение движется по горной выработке высотой ' + units.fmt(p.height) +
                ' м с углом наклона ' + units.fmt(p.angle) + '° ' + atmosphereIn(p.atmosphere) +
                '. Вид работы — ' + p.work + '. Расстояние видимости — ' + units.fmt(visibility) +
                ' м. Определите скорость передвижения отделения.',
      answer: numericAnswer(r.speedMPerMin, 'м/мин', 2),
      steps: r.steps.map(function (s) { return step(s.label, s.value, s.point, s.detail); })
    };
  };

  /* --- T20. Время движения до точки --- */
  BUILDERS.T20 = function (rng) {
    var p = sampleSpeedConditions(rng);
    var visibility = ranges.sample(rng, 'visibility_m');
    var length = sampleRouteLengthFor(rng, speedFor(p, visibility));
    var r = smokeSolver.solve({
      atmosphere: p.atmosphere, work: p.work,
      excavationHeightM: p.height, slopeDeg: p.angle,
      visibilityM: visibility, routeLengthM: length
    });

    return {
      inputs: { atmosphere: p.atmosphere, work: p.work, excavationHeightM: p.height,
                slopeDeg: p.angle, visibilityM: visibility, routeLengthM: length },
      question: 'Отделению необходимо пройти ' + units.fmt(length) + ' м по горной выработке ' +
                'высотой ' + units.fmt(p.height) + ' м с углом наклона ' + units.fmt(p.angle) +
                '° ' + atmosphereIn(p.atmosphere) + '. Вид работы — ' + p.work +
                '. Расстояние видимости — ' + units.fmt(visibility) + ' м. ' +
                'Определите время движения до конечной точки.',
      answer: numericAnswer(r.timeMin, 'мин', 1),
      steps: r.steps.map(function (s) { return step(s.label, s.value, s.point, s.detail); })
    };
  };

  /* --- T21. Задымление в сочетании с температурой --- */
  BUILDERS.T21 = function (rng) {
    var p = sampleSpeedConditions(rng, A7.ATM.UNBREATHABLE);
    var visibility = ranges.sample(rng, 'visibility_m');
    var length = sampleRouteLengthFor(rng, speedFor(p, visibility));
    var temp = ranges.sample(rng, 'high_temperature_C');

    var move = smokeSolver.solve({
      atmosphere: p.atmosphere, work: p.work,
      excavationHeightM: p.height, slopeDeg: p.angle,
      visibilityM: visibility, routeLengthM: length
    });
    var thermal = thermalSolver.solve({
      temperaturesC: [temp], activity: 'передвижение', rescueWork: false
    });

    var feasible = move.timeMin <= thermal.split.forwardMin + 1e-9;

    return {
      inputs: { atmosphere: p.atmosphere, work: p.work, excavationHeightM: p.height,
                slopeDeg: p.angle, visibilityM: visibility, routeLengthM: length,
                temperaturesC: [temp] },
      question: 'Отделению поставлена задача пройти ' + units.fmt(length) + ' м по горной выработке ' +
                'высотой ' + units.fmt(p.height) + ' м с углом наклона ' + units.fmt(p.angle) +
                '° ' + atmosphereIn(p.atmosphere) + '. Вид работы — ' + p.work +
                '. Расстояние видимости — ' + units.fmt(visibility) + ' м, температура воздуха — ' +
                units.fmt(temp) + ' °C. Средства противотепловой индивидуальной защиты не применяются. ' +
                'Возможно ли пройти этот путь в пределах допустимого времени движения вперёд?',
      answer: booleanAnswer(feasible),
      steps: move.steps.map(function (s) { return step(s.label, s.value, s.point, s.detail); }).concat([
        step('Допустимое время в ЗВТ при передвижении', units.fmt(thermal.allowance.minutes) + ' мин',
             'ФНП № 520, прил. 6, табл. N 1', thermal.allowance.reason),
        step('Время на движение вперёд', '1/3 × ' + units.fmt(thermal.allowance.minutes) + ' = ' +
             units.fmt(thermal.split.forwardMin) + ' мин', 'ФНП № 520, прил. 6, п. 12', A6.quotes.p12),
        step('Сопоставление', 'Требуется ' + units.fmt(move.timeMin) + ' мин при допустимых ' +
             units.fmt(thermal.split.forwardMin) + ' мин', null,
             feasible ? 'Ограничение по температурному фактору выполняется.'
                      : 'Ограничение по температурному фактору не выполняется.')
      ])
    };
  };

  /* --- T24. Максимальная дальность продвижения --- */
  BUILDERS.T24 = function (rng) {
    var p0 = ranges.sample(rng, 'initial_pressure_MPa');
    var pres = ranges.RANGES.reserve_pressure_MPa.fixed;
    var k = ranges.sample(rng, 'consumption_per_100m_MPa');
    var strict = rng.chance(0.5);
    var category = strict ? 'down_over_10' : rng.pick(['horizontal', 'up', 'down_to_10']);
    var slope = rng.pick(ranges.RANGES.slope_deg.byCategory[category]);
    var incline = category === 'horizontal' ? 'горизонталь' : (category === 'up' ? 'подъём' : 'спуск');

    var segments = [{ id: 'Участок 1', lengthM: 100, slopeDeg: slope, incline: incline,
                      direction: 'туда', consumptionMPa: k }];
    var r = daskSolver.maxForwardDistance({
      initialPressureMPa: p0, reservePressureMPa: pres, segments: segments,
      consumptionPer100mMPa: k
    });

    return {
      inputs: { initialPressureMPa: p0, reservePressureMPa: pres,
                consumptionPer100mMPa: k, slopeDeg: slope, incline: incline,
                segments: segments },
      question: 'Отделение направляется по горной выработке (' + describeGeometry(incline, slope) +
                ') с непригодной для дыхания атмосферой. Давление в баллоне ДА — ' + units.fmt(p0) +
                ' МПа. По данным замера на каждые 100 м пути отделение расходует ' + units.fmt(k) +
                ' МПа. Определите наибольшее расстояние, на которое отделение может продвинуться вперёд.',
      answer: numericAnswer(r.exactDistanceM, 'м', 0),
      steps: [
        step('Рабочий запас', 'Pраб = ' + units.fmt(p0) + ' − ' + units.fmt(pres) + ' = ' +
             units.fmt(r.allocation.workingReserveMPa) + ' МПа', 'Устав ВГСЧ, п. 22', U.quotes.reserve),
        step('Категория участка', describeCategory(r.allocation.category), 'Устав ВГСЧ, п. 22',
             r.allocation.category === 'down_over_10' ? U.quotes.thirdTwoThirds : U.quotes.halfHalf),
        step('Доля на движение вперёд',
             r.allocation.share.forwardNum + '/' + r.allocation.share.forwardDen + ' × ' +
             units.fmt(r.allocation.workingReserveMPa) + ' = ' +
             units.fmt(r.allocation.allowedForwardMPa) + ' МПа', 'Устав ВГСЧ, п. 22', r.allocation.rule),
        step('Максимальное расстояние',
             units.fmt(r.allocation.allowedForwardMPa) + ' / ' + units.fmt(k) + ' × 100 = ' +
             units.fmt(r.exactDistanceM, 0) + ' м', null, null),
        step('Обратная подстановка',
             units.fmt(r.exactDistanceM, 0) + ' м × ' + units.fmt(k) + ' / 100 = ' +
             units.fmt(r.backSubstitutionMPa) + ' МПа — совпадает с допустимой долей', null, null)
      ]
    };
  };

  /* --- T25. Максимальное время движения вперёд --- */
  BUILDERS.T25 = function (rng) {
    var isHigh = rng.chance(0.6);
    var t = isHigh ? ranges.sample(rng, 'high_temperature_C') : ranges.sample(rng, 'low_temperature_C');
    var r = thermalSolver.solve({ temperaturesC: [t], activity: 'передвижение', rescueWork: false });

    return {
      inputs: { temperaturesC: [t], activity: 'передвижение', rescueWork: false },
      question: 'Отделение передвигается по горным выработкам с непригодной для дыхания рудничной ' +
                'атмосферой при температуре воздуха ' + units.fmt(t) + ' °C без средств ' +
                'противотепловой индивидуальной защиты. Определите максимальное время движения ' +
                'в направлении «туда».',
      answer: numericAnswer(r.split.forwardMin, 'мин', 1),
      steps: [
        step('Допустимое время при передвижении', units.fmt(r.allowance.minutes) + ' мин',
             isHigh ? 'ФНП № 520, прил. 6, табл. N 1' : 'ФНП № 520, прил. 6, табл. N 2',
             r.allowance.reason),
        step('Время движения вперёд', '1/3 × ' + units.fmt(r.allowance.minutes) + ' = ' +
             units.fmt(r.split.forwardMin) + ' мин',
             isHigh ? 'ФНП № 520, прил. 6, п. 12' : 'ФНП № 520, прил. 6, п. 18',
             isHigh ? A6.quotes.p12 : A6.quotes.p18),
        step('Обратная проверка', units.fmt(r.split.forwardMin) + ' × 3 = ' +
             units.fmt(thermalSolver.backSubstitution(r.split.forwardMin)) + ' мин', null, null)
      ]
    };
  };

  /* --- T27. Можно или нельзя выполнить задание --- */
  BUILDERS.T27 = function (rng) {
    var feasible = rng.chance(0.5);
    var t = daskRouteTask(rng, {
      category: rng.chance(0.4) ? 'down_over_10' : 'mixed',
      segmentCount: rng.int(2, 3),
      feasible: feasible,
      scheme: true,
      askFeasibility: true
    });
    return t;
  };

  /* ------------------------------------------------- общий построитель ДАСК --- */

  function sampleSpeedConditions(rng, forcedAtmosphere) {
    var atmosphere = forcedAtmosphere || rng.pick([A7.ATM.BREATHABLE, A7.ATM.UNBREATHABLE]);
    var available = Object.keys(A7.TABLE_1[atmosphere]);
    return {
      atmosphere: atmosphere,
      work: rng.pick(available),
      height: ranges.sample(rng, 'excavation_height_m'),
      angle: ranges.sample(rng, 'table_angle_deg')
    };
  }

  /* Максимальное время, которое имеет смысл разыгрывать в задаче на движение.
   * В непригодной для дыхания атмосфере это нормативный предел (ФНП № 520,
   * прил. 6, п. 3 — не более четырёх часов с применением ДА). */
  var MAX_MOVEMENT_TIME_MIN = 240;
  var MIN_MOVEMENT_TIME_MIN = 4;

  /**
   * Длина маршрута подбирается под фактическую скорость: сначала известна
   * скорость по таблице, затем выбирается длина, дающая осмысленное время.
   * Иначе при 0,8 м/мин получаются задачи вида «пройти 600 м за 750 минут».
   */
  function sampleRouteLengthFor(rng, speedMPerMin) {
    var spec = ranges.RANGES.smoke_route_length_m;
    var step = spec.step;

    var lo = Math.max(spec.min, Math.ceil(speedMPerMin * MIN_MOVEMENT_TIME_MIN / step) * step);
    var hi = Math.min(spec.max, Math.floor(speedMPerMin * MAX_MOVEMENT_TIME_MIN / step) * step);

    if (hi < lo) return lo;                     // очень медленный режим — берём минимум
    return rng.step(lo, hi, step);
  }

  /** Скорость по условиям задачи: табличная, при задымлении — делённая на k₃. */
  function speedFor(p, visibilityM) {
    var v = A7.fullVisibilitySpeed(p.atmosphere, p.work, p.height, p.angle).value;
    if (typeof visibilityM === 'number') v = v / A7.smokeCoefficient(visibilityM).value;
    return v;
  }

  function describeGeometry(incline, slope) {
    if (incline === 'горизонталь') return 'горизонтальная выработка';
    return (incline === 'подъём' ? 'подъём' : 'спуск') + ' с углом наклона ' + units.fmt(slope) + '°';
  }

  /* Правило распределения запаса — это не геометрия участка: ½–½ действует
   * и на горизонтали, и на подъёме, и на спуске до 10° включительно. */
  function describeCategory(category) {
    return U.allocationTitle(category);
  }

  /** Атмосфера в предложном падеже: «в непригодной для дыхания рудничной атмосфере». */
  function atmosphereIn(atmosphere) {
    return atmosphere === A7.ATM.BREATHABLE
      ? 'в пригодной для дыхания рудничной атмосфере'
      : 'в непригодной для дыхания рудничной атмосфере';
  }

  function describeRoute(inputs) {
    var parts = inputs.segments.map(function (s, i) {
      return 'участок ' + (i + 1) + ' — ' + units.fmt(s.lengthM) + ' м, ' +
             describeGeometry(s.incline, s.slopeDeg) + ', расход ' +
             units.fmt(s.consumptionMPa) + ' МПа';
    });
    return 'Отделение выполняет задание в горных выработках с непригодной для дыхания рудничной ' +
           'атмосферой. Давление в баллоне ДА на ПБ — ' + units.fmt(inputs.initialPressureMPa) +
           ' МПа. Маршрут «туда»: ' + parts.join('; ') + '. По замеру на обратный путь израсходовано ' +
           units.fmt(inputs.returnConsumptionMPa) + ' МПа.';
  }

  /**
   * Задача по маршруту ДАСК. Сначала нормативный бюджет, затем числа внутри него —
   * ответ ни при каких условиях не подбирается заранее.
   */
  function daskRouteTask(rng, opts) {
    var p0 = ranges.sample(rng, 'initial_pressure_MPa');
    var pres = ranges.RANGES.reserve_pressure_MPa.fixed;

    var mixed = opts.category === 'mixed';
    var segments = buildRoute(rng, {
      category: mixed ? 'mixed' : opts.category,
      mixed: mixed,
      segmentCount: opts.segmentCount,
      strictSegmentIndex: opts.category === 'down_over_10' ? rng.int(0, opts.segmentCount - 1) : -1
    });

    var alloc = daskSolver.allocation({
      initialPressureMPa: p0, reservePressureMPa: pres, segments: segments
    });

    /* Бюджет на движение вперёд: внутри допустимой доли — для выполнимой задачи,
     * заведомо выше неё — для задачи «выполнить нельзя». */
    var factor = opts.feasible ? rng.step(0.55, 0.9, 0.05) : rng.step(1.05, 1.35, 0.05);
    var forwardTotal = Math.max(0.1 * segments.length, round1(alloc.allowedForwardMPa * factor));
    forwardTotal = distributeConsumption(segments, forwardTotal);

    /* Расход на возвращение — отдельная замеренная величина, а не копия «туда».
     * Для выполнимой задачи он укладывается в оставшийся запас. */
    var backBudget = round1(p0 - pres - forwardTotal);
    var backTotal;
    if (opts.feasible) {
      var lo = Math.max(0.1, round1(forwardTotal * 0.9));
      var hi = Math.max(lo, Math.min(round1(alloc.allowedBackMPa), backBudget));
      backTotal = lo <= hi ? rng.step(lo, hi, 0.1) : lo;
    } else {
      backTotal = Math.max(0.1, round1(forwardTotal * rng.step(1.0, 1.4, 0.1)));
    }

    var inputs = {
      initialPressureMPa: p0,
      reservePressureMPa: pres,
      segments: segments,
      returnConsumptionMPa: backTotal,
      returnSegments: [{ id: 'Обратный путь', lengthM: segments.reduce(function (a, s) { return a + s.lengthM; }, 0),
                         slopeDeg: 0, incline: 'горизонталь', consumptionMPa: backTotal }],
      mechTransport: !!opts.mechTransport
    };

    var solved = daskSolver.solve(inputs);

    var task = {
      inputs: inputs,
      solved: solved,
      steps: buildDaskSteps(inputs, solved),
      scheme: opts.scheme ? { required: true, type: 'route_graph' } : null
    };

    if (opts.askFeasibility) {
      task.question = describeRoute(inputs) +
        ' Определите, возможно ли выполнить задание в заданных условиях.';
      task.answer = booleanAnswer(solved.feasible);
    } else if (opts.mechTransport) {
      task.question = 'Отделение следует к месту работ механическим транспортным средством ' +
        'по горным выработкам с непригодной для дыхания рудничной атмосферой. Давление в баллоне ДА ' +
        'на ПБ — ' + units.fmt(p0) + ' МПа. На путь «туда» израсходовано ' +
        units.fmt(forwardTotal) + ' МПа. Определите давление, при котором отделение должно ' +
        'прекратить движение вперёд.';
      task.answer = numericAnswer(solved.primary.turnBackPressureMPa, 'МПа', 2);
      task.steps.push(step('Обратный путь', 'Запас на обратный путь определяется из расчёта ' +
        'возвращения пешком, а не по скорости транспортного средства.', 'Устав ВГСЧ, п. 22',
        U.quotes.mechTransport));
    } else {
      task.question = describeRoute(inputs) +
        ' Определите, какое давление останется в баллоне ДА после возвращения отделения на ПБ.';
      task.answer = numericAnswer(solved.primary.finalPressureMPa, 'МПа', 2);
    }

    return task;
  }

  function buildDaskSteps(inputs, solved) {
    var alloc = solved.primary.allocation;
    var steps = [
      step('Рабочий запас', 'Pраб = ' + units.fmt(inputs.initialPressureMPa) + ' − ' +
           units.fmt(inputs.reservePressureMPa) + ' = ' + units.fmt(alloc.workingReserveMPa) + ' МПа',
           'Устав ВГСЧ, п. 22', U.quotes.reserve),
      step('Категория маршрута', describeCategory(alloc.category), 'Устав ВГСЧ, п. 22',
           alloc.category === 'down_over_10' ? U.quotes.thirdTwoThirds : U.quotes.halfHalf),
      step('Допустимая доля на движение вперёд',
           alloc.share.forwardNum + '/' + alloc.share.forwardDen + ' × ' +
           units.fmt(alloc.workingReserveMPa) + ' = ' + units.fmt(alloc.allowedForwardMPa) + ' МПа',
           'Устав ВГСЧ, п. 22', alloc.rule)
    ];

    inputs.segments.forEach(function (s, i) {
      var pt = solved.primary.points[i + 1];
      steps.push(step('После участка ' + (i + 1),
        '− ' + units.fmt(s.consumptionMPa) + ' МПа → ' + units.fmt(pt.pressureMPa) + ' МПа', null, null));
    });

    steps.push(step('Расход на движение вперёд',
      units.fmt(solved.primary.spentForwardMPa) + ' МПа при допустимых ' +
      units.fmt(alloc.allowedForwardMPa) + ' МПа', 'Устав ВГСЧ, п. 22', null));
    steps.push(step('Обратный путь',
      '− ' + units.fmt(solved.primary.spentBackMPa) + ' МПа → ' +
      units.fmt(solved.primary.finalPressureMPa) + ' МПа на ПБ', 'Устав ВГСЧ, п. 22',
      'Возвращение считается отдельно, а не как повтор расхода «туда».'));
    steps.push(step('Контроль резерва',
      'На ПБ остаётся ' + units.fmt(solved.primary.finalPressureMPa) + ' МПа при резерве ' +
      units.fmt(inputs.reservePressureMPa) + ' МПа', 'Устав ВГСЧ, п. 22', solved.reason));

    return steps;
  }

  /* --------------------------------------------------------------- сборка --- */

  var counter = 0;

  /**
   * Одна попытка построения задачи выбранного типа.
   * Возвращает JSON без статуса — статус присваивает валидатор.
   */
  function build(typeId, seed) {
    var type = types.byId(typeId);
    if (!type) throw new Error('Неизвестный тип задачи: ' + typeId);
    if (type.status !== 'ENABLED') {
      throw new Error('Тип ' + typeId + ' недоступен для генерации (' + type.status + ')' +
                      (type.blockedBy ? ': ' + type.blockedBy : ''));
    }
    var builder = BUILDERS[typeId];
    if (!builder) throw new Error('Для типа ' + typeId + ' не реализован построитель');

    ranges.validateAll();

    var rng = rngLib.create(seed);
    var raw = builder(rng);

    counter++;
    return {
      task_id: typeId + '-' + String(counter).padStart(4, '0'),
      version: '1.0',
      type_id: typeId,
      category: type.group,
      difficulty: type.difficulty,
      seed: seed,
      normative_basis: basisOf(type),
      inputs: raw.inputs,
      question: raw.question + (raw.questionSuffix || ''),
      solution_steps: raw.steps,
      answer: raw.answer,
      tolerances: { numeric_abs: VGSCH.config.tasks.numericTolerance },
      scheme: raw.scheme || (type.scheme ? { required: true, type: 'route_graph' } : null),
      solved: raw.solved || null,
      validation: { status: 'CALCULATED', checks: [] }
    };
  }

  VGSCH.engine = VGSCH.engine || {};
  VGSCH.engine.generator = {
    build: build,
    BUILDERS: BUILDERS,
    implementedTypes: function () { return Object.keys(BUILDERS); }
  };
})(window.VGSCH = window.VGSCH || {});
