/* Фиксированные комбинированные задачи, переданные комиссией МЧС.
 *
 * В отличие от обычных типов T01-T30 числа здесь не генерируются: каждый
 * вариант воспроизводит бумажное задание. Расчётная методика проекта:
 *   - дыхательный аппарат Р-30;
 *   - одна катушка связи — 800 м;
 *   - промежуточный угол относится к ближайшему большему столбцу табл. N 1
 *     приложения N 7: (0;10] -> 10, (10;15] -> 15 и т. д.;
 *   - при неизвестной видимости k3 = 1,43.
 */
(function (VGSCH) {
  'use strict';

  var APPARATUS = 'Р-30';
  var REEL_LENGTH_M = 800;
  var ANGLES = [0, 10, 15, 20, 30, 40, 70];

  function tableAngle(angle) {
    if (angle === 0) return 0;
    for (var i = 1; i < ANGLES.length; i++) if (angle <= ANGLES[i]) return ANGLES[i];
    throw new Error('Угол ' + angle + '° выходит за пределы таблицы N 1.');
  }

  var SET1 = [
    { id: '1-1', area: 30, height: 5, pressure: 195, start: '11:22', lengths: [110,230,340,50,450] },
    { id: '1-2', area: 13.5, height: 3, pressure: 195, start: '11:00', lengths: [510,96,336,70,290] },
    { id: '1-3', area: 16, height: 3.5, pressure: 195, start: '10:00', lengths: [80,230,120,80,504] },
    { id: '1-4', area: 20, height: 4, pressure: 200, start: '09:00', lengths: [140,210,500,40,450] },
    { id: '1-5', area: 25, height: 4.5, pressure: 200, start: '09:30', lengths: [100,50,700,10,100] }
  ];

  var SET2 = [
    { id: '2-1', area: 25, height: 5, temp: 10, pressure: 200, start: '09:42', angles: [7,10,6,15,4], readings: [200,195,175,160,150] },
    { id: '2-2', area: 20, height: 4, temp: 8,  pressure: 200, start: '09:42', angles: [5,8,5,12,3], readings: [200,190,170,160,140] },
    { id: '2-3', area: 20, height: 4.5,temp: 9,  pressure: 195, start: '11:21', angles: [3,9,5,12,4], readings: [195,180,165,150,135] },
    { id: '2-4', area: 20, height: 4, temp: 8,  pressure: 200, start: '08:21', angles: [4,14,8,12,2],readings: [200,190,185,175,160] },
    { id: '2-5', area: 20, height: 4, temp: 8,  pressure: 200, start: '09:02', angles: [3,8,4,12,6], readings: [200,190,170,160,140] }
  ];

  var SET3 = [
    { id: '3-1', lost: '10:48', arrivals: ['10:00','10:09','10:16','10:26','10:38','10:48'] },
    { id: '3-2', lost: '10:50', arrivals: ['10:00','10:20','10:28','10:34','10:46','10:50'] },
    { id: '3-3', lost: '10:48', arrivals: ['10:00','10:07','10:14','10:26','10:38','10:48'] },
    { id: '3-4', lost: '10:48', arrivals: ['10:00','10:10','10:15','10:22','10:34','10:48'] },
    { id: '3-5', lost: '10:48', arrivals: ['10:00','10:07','10:12','10:26','10:38','10:48'] }
  ];

  function minutes(hhmm) {
    var p = hhmm.split(':'); return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
  }
  function clock(total) {
    total = Math.round(total) % (24 * 60);
    var h = Math.floor(total / 60), m = total % 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }
  function round(v, n) { var k = Math.pow(10, n || 0); return Math.round(v * k) / k; }
  function fmt(v, n) { return round(v, n === undefined ? 1 : n).toFixed(n === undefined ? 1 : n).replace('.', ','); }
  function sum(values) { return values.reduce(function (a, b) { return a + b; }, 0); }
  function speedInfo(atm, work, angle, k3) {
    var n = VGSCH.normative.fnp520app7;
    var acceptedAngle = tableAngle(angle);
    var full = n.fullVisibilitySpeed(atm, work, 2, acceptedAngle).value;
    return {
      angle: angle, acceptedAngle: acceptedAngle, full: full, k3: k3 || 1,
      value: full / (k3 || 1), atmosphere: atm, work: work
    };
  }
  function speed(atm, work, angle, k3) {
    return speedInfo(atm, work, angle, k3).value;
  }
  function speedFormula(info) {
    return 'V = Vп.в ÷ k₃ = ' + fmt(info.full) + ' ÷ ' + fmt(info.k3, 2) +
      ' = ' + fmt(info.value) + ' м/мин';
  }
  function angleFormula(actual, accepted) {
    return actual === accepted
      ? 'угол ' + actual + '° — столбец ' + accepted + '° таблицы № 1'
      : 'угол ' + actual + '° — принят ближайший больший столбец ' + accepted + '° таблицы № 1';
  }
  function timeSegment(from, to, length, info, time) {
    return 'Участок ' + from + '→' + to + ': L = ' + fmt(length) + ' м; ' +
      angleFormula(info.angle, info.acceptedAngle) + '; Vп.в = ' + fmt(info.full) +
      ' м/мин; k₃ = ' + fmt(info.k3, 2) + '; ' + speedFormula(info) +
      '; t = L ÷ V = ' + fmt(length) + ' ÷ ' + fmt(info.value) + ' = ' + fmt(time) + ' мин.';
  }
  function distanceSegment(from, to, deltaPressure, minutesValue, info, distance) {
    return 'Участок ' + from + '→' + to + ': ΔP = ' + fmt(deltaPressure) +
      ' атм.; t = ΔP × 2 ÷ 1,4 = ' + fmt(deltaPressure) + ' × 2 ÷ 1,4 = ' +
      fmt(minutesValue) + ' мин; ' + angleFormula(info.angle, info.acceptedAngle) +
      '; Vп.в = ' + fmt(info.full) + ' м/мин; k₃ = ' + fmt(info.k3, 2) +
      '; V = ' + fmt(info.value) + ' м/мин; L = t × V = ' + fmt(minutesValue) +
      ' × ' + fmt(info.value) + ' = ' + fmt(distance) + ' м.';
  }

  function solve1(v) {
    var n = VGSCH.normative.fnp520app7, A = n.ATM, W = n.WORK, k = n.K3_INITIAL;
    var L = v.lengths;
    var outInfo = [
      speedInfo(A.BREATHABLE, W.RECON_DOWN, 0, k),
      speedInfo(A.BREATHABLE, W.RECON_DOWN, 15, k),
      speedInfo(A.UNBREATHABLE, W.RECON_DOWN, 0, k),
      speedInfo(A.UNBREATHABLE, W.RECON_UP, 70, k),
      speedInfo(A.UNBREATHABLE, W.RECON_DOWN, 0, k)
    ];
    var out = outInfo.map(function (info, i) { return L[i] / info.value; });
    var backInfo = [
      speedInfo(A.UNBREATHABLE, W.VICTIM_DOWN, 0, k),
      speedInfo(A.UNBREATHABLE, W.VICTIM_DOWN, 70, k),
      speedInfo(A.UNBREATHABLE, W.VICTIM_DOWN, 0, k),
      speedInfo(A.UNBREATHABLE, W.VICTIM_UP, 15, k),
      speedInfo(A.UNBREATHABLE, W.VICTIM_DOWN, 0, k)
    ];
    var backLengths = [L[4], L[3], L[2], L[1], L[0]];
    var back = backInfo.map(function (info, i) { return backLengths[i] / info.value; });
    var outTotal = sum(out), backTotal = sum(back);
    var daOut = sum(out.slice(2));
    var daTravel = daOut + backTotal;
    var work = VGSCH.normative.apparatus.workingProtectiveTime('р-30');
    var workMin = work.minutes;
    var aid = Math.max(0, workMin - daTravel);
    var aidStart = minutes(v.start) + outTotal;
    var evacuationStart = aidStart + aid;
    var cumulative = 0;
    var backPoints = [5,4,3,2,1];
    var backClockLines = back.map(function (x, i) {
      cumulative += x;
      return 'Точка № ' + backPoints[i] + ': через ' + fmt(cumulative) +
        ' мин после начала эвакуации, ориентировочно в ' + clock(evacuationStart + cumulative) + '.';
    });
    return {
      primary: aid, unit: 'мин', label: 'Допустимое время оказания помощи',
      answers: [
        { id:'possible', label:'Возможность выполнения задания', type:'choice', value:aid > 0,
          options:[{value:true,label:'Задание выполнимо'},{value:false,label:'Задание невыполнимо'}] },
        { id:'evacuation', label:'Время движения при эвакуации пострадавшего', type:'numeric', value:backTotal, unit:'мин', decimals:1 },
        { id:'aid', label:'Время на оказание помощи пострадавшему в точке № 6', type:'numeric', value:aid, unit:'мин', decimals:1 },
        { id:'returnClock', label:'Время возвращения на ПБ', type:'time', value:clock(minutes(v.start)+outTotal+aid+backTotal), unit:'' }
      ],
      steps: [
        {
          label: 'Выбор исходных табличных данных',
          value: 'Таблица № 1 приложения № 7, строка высоты 2,0 м; k₃ = ' + fmt(k, 2),
          detail: 'Высота во всех вариантах больше 2 м, поэтому используется предельная строка таблицы 2,0 м. Задымлённость неизвестна — для первоначального расчёта принимается k₃ = 1,43.',
          lines: [
            'Участки 1→2 и 2→3 до границы непригодной атмосферы рассчитываются по строкам для пригодной атмосферы; участки 3→6 — по строкам для непригодной атмосферы.',
            'Для промежуточного угла используется ближайший больший столбец таблицы: 0°→0°, 15°→15°, 70°→70°.',
            'Расчётная скорость в задымлённой выработке: V = Vп.в ÷ k₃.'
          ],
          point: 'Приказ Ростехнадзора № 520, прил. 7, табл. № 1 и № 2.'
        },
        {
          label: 'Движение отделения к пострадавшему',
          value: 'Общее время движения 1→6: ' + fmt(outTotal) + ' мин',
          detail: 'Для каждого участка отдельно выбирается скорость разведки с учётом атмосферы и направления движения.',
          lines: out.map(function (x, i) { return timeSegment(i+1, i+2, L[i], outInfo[i], x); })
            .concat(['Сумма: t₁→₆ = ' + out.map(function(x){return fmt(x);}).join(' + ') + ' = ' + fmt(outTotal) + ' мин.']),
          point: 'Приказ Ростехнадзора № 520, прил. 7, табл. № 1; формула Vз = Vп.в ÷ k₃.'
        },
        {
          label: 'Эвакуация пострадавшего из точки № 6 на ПБ',
          value: 'Общее время эвакуации: ' + fmt(backTotal) + ' мин',
          detail: 'По условию к возвращению загазованность распространяется до точки № 1, поэтому весь обратный путь рассчитывается как транспортировка пострадавшего в непригодной атмосфере.',
          lines: back.map(function (x, i) { return timeSegment(6-i, 5-i, backLengths[i], backInfo[i], x); })
            .concat(['Сумма: tэвак = ' + back.map(function(x){return fmt(x);}).join(' + ') + ' = ' + fmt(backTotal) + ' мин.'])
            .concat(backClockLines),
          point: 'Приказ Ростехнадзора № 520, прил. 7, табл. № 1.'
        },
        {
          label: 'Рабочее время Р-30 и время оказания помощи',
          value: fmt(workMin) + ' − ' + fmt(daOut) + ' − ' + fmt(backTotal) + ' = ' + fmt(aid) + ' мин',
          detail: work.reason,
          lines: [
            'Номинальное время защитного действия Р-30 — 240 мин по руководству по эксплуатации.',
            'Рабочий объём для ДА на сжатом кислороде принимается 75 %. Принятое в задаче рабочее время: 240 × 0,75 = ' + fmt(workMin) + ' мин.',
            'Движение вперёд в непригодной атмосфере начинается с точки № 3: t₃→₆ = ' + out.slice(2).map(function(x){return fmt(x);}).join(' + ') + ' = ' + fmt(daOut) + ' мин.',
            'На обратном пути непригодной считается вся выработка до точки № 1: tэвак = ' + fmt(backTotal) + ' мин.',
            'Допустимое время помощи: tпом = ' + fmt(workMin) + ' − ' + fmt(daOut) + ' − ' + fmt(backTotal) + ' = ' + fmt(aid) + ' мин.'
          ],
          point: 'Приказ Ростехнадзора № 520, прил. 6, пп. 2–3; РЭ Р-30.'
        },
        {
          label: 'Проверка выполнимости и время возвращения',
          value: (aid > 0 ? 'Задание выполнимо' : 'Задание невыполнимо') + '; возвращение на ПБ в ' + clock(minutes(v.start)+outTotal+aid+backTotal),
          detail: 'Задание выполнимо, если после движения к пострадавшему и резервирования времени эвакуации остаётся положительное время на помощь.',
          lines: [
            'Прибытие к пострадавшему: ' + v.start + ' + ' + fmt(outTotal) + ' мин ≈ ' + clock(aidStart) + '.',
            'Начало эвакуации после оказания помощи: ' + clock(aidStart) + ' + ' + fmt(aid) + ' мин ≈ ' + clock(evacuationStart) + '.',
            'Возвращение на ПБ: ' + v.start + ' + ' + fmt(outTotal) + ' + ' + fmt(aid) + ' + ' + fmt(backTotal) + ' мин ≈ ' + clock(minutes(v.start)+outTotal+aid+backTotal) + '.'
          ]
        }
      ]
    };
  }

  function solve2(v) {
    var n = VGSCH.normative.fnp520app7, A = n.ATM, W = n.WORK;
    var usable = v.pressure - 50;
    var forwardBudget = usable / 3; // на маршруте каждого варианта есть спуск более 10°
    var stopPressure = v.pressure - forwardBudget;
    var additional = v.readings[4] - stopPressure;
    var permitted = Math.max(0, additional);
    var drops = [];
    for (var i = 0; i < 4; i++) drops.push(v.readings[i] - v.readings[i + 1]);
    drops.push(permitted);
    var times = drops.map(function (p) { return p * 2 / 1.4; });
    var infos = v.angles.map(function (angle) { return speedInfo(A.UNBREATHABLE, W.RECON_DOWN, angle, 1); });
    var distances = times.map(function (t, i) { return t * infos[i].value; });
    var total = sum(distances);
    var reels = Math.ceil(total / REEL_LENGTH_M);
    var canContinue = additional >= 0;
    return {
      primary: permitted, unit: 'атм.', label: 'Допустимый дополнительный расход из точки № 5',
      answers: [
        { id:'additional', label:'Допустимый расход на движение вперёд из точки № 5', type:'numeric', value:permitted, unit:'атм.', decimals:1 },
        { id:'stopPressure', label:'Минимальное давление возвращения на ПБ', type:'numeric', value:stopPressure, unit:'атм.', decimals:1 },
        { id:'distance', label:'Расчётное пройденное расстояние', type:'numeric', value:total, unit:'м', decimals:1 },
        { id:'reels', label:'Количество катушек связи', type:'numeric', value:reels, unit:'шт.', decimals:0 }
      ],
      steps: [
        {
          label: 'Рабочий запас кислорода и давление возвращения',
          value: fmt(v.pressure) + ' − ((' + fmt(v.pressure) + ' − 50) ÷ 3) = ' + fmt(stopPressure) + ' атм.',
          detail: 'В баллоне резервируется 50 атм. На маршруте есть спуск более 10°, поэтому оставшийся запас распределяется: одна треть вперёд и две трети обратно.',
          lines: [
            'Минимальное начальное давление отделения: P₀ = ' + fmt(v.pressure) + ' атм.',
            'Неприкосновенный резерв по п. 22 Устава: Pрез = 50 атм.',
            'Рабочий запас: Pраб = P₀ − Pрез = ' + fmt(v.pressure) + ' − 50 = ' + fmt(usable) + ' атм.',
            'Допустимый расход вперёд: Pвперёд = Pраб ÷ 3 = ' + fmt(usable) + ' ÷ 3 = ' + fmt(forwardBudget) + ' атм.',
            'Давление прекращения движения вперёд: Pвозв = P₀ − Pвперёд = ' + fmt(v.pressure) + ' − ' + fmt(forwardBudget) + ' = ' + fmt(stopPressure) + ' атм.'
          ],
          point: 'Устав ВГСЧ, пп. 22–23.'
        },
        {
          label: 'Допустимый расход после точки № 5',
          value: fmt(v.readings[4]) + ' − ' + fmt(stopPressure) + ' = ' + fmt(additional) + ' атм.',
          detail: canContinue ? 'Фактическое давление в точке № 5 выше давления возвращения, поэтому движение можно продолжить до расходования рассчитанного остатка.' : 'Давление возвращения уже достигнуто; дальнейшее продвижение запрещено.',
          lines: [
            'Показание манометра в точке № 5: P₅ = ' + fmt(v.readings[4]) + ' атм.',
            'Допустимый дополнительный расход: ΔP₅→₆ = P₅ − Pвозв = ' + fmt(v.readings[4]) + ' − ' + fmt(stopPressure) + ' = ' + fmt(additional) + ' атм.',
            'Для расчёта участка 5→6 принимается неотрицательное значение: ' + fmt(permitted) + ' атм.'
          ],
          point: 'Устав ВГСЧ, п. 23.'
        },
        {
          label: 'Перевод расхода кислорода во время движения',
          value: 't = ΔP × 2 ÷ 1,4',
          detail: 'Приняты характеристики Р-30: вместимость кислородного баллона 2 дм³ и постоянная подача кислорода 1,4 дм³/мин.',
          lines: drops.map(function (p, i) {
            if (i === 4 && !canContinue) {
              return 'Участок 5→6: P₅ = ' + fmt(v.readings[4]) + ' атм. уже ниже давления возвращения ' +
                fmt(stopPressure) + ' атм.; дальнейшее движение не допускается, поэтому для расчёта принимаются ΔP = 0 атм. и t = 0 мин.';
            }
            var endPressure = i < 4 ? v.readings[i+1] : stopPressure;
            return 'Участок ' + (i+1) + '→' + (i+2) + ': ΔP = ' + fmt(i < 4 ? v.readings[i] : v.readings[4]) + ' − ' + fmt(endPressure) + ' = ' + fmt(p) + ' атм.; t = ' + fmt(p) + ' × 2 ÷ 1,4 = ' + fmt(times[i]) + ' мин.';
          }),
          point: 'Руководство по эксплуатации Р-30: баллон 2 дм³, постоянная подача 1,4 ± 0,1 дм³/мин.'
        },
        {
          label: 'Расстояние по каждому участку маршрута',
          value: 'Общее расстояние 1→6: ' + fmt(total) + ' м',
          detail: 'Задымлённость отсутствует, поэтому k₃ = 1. Фактический угол каждого участка относится к ближайшему большему столбцу таблицы № 1.',
          lines: distances.map(function (x, i) { return distanceSegment(i+1, i+2, drops[i], times[i], infos[i], x); })
            .concat(['Сумма: Lобщ = ' + distances.map(function(x){return fmt(x);}).join(' + ') + ' = ' + fmt(total) + ' м.']),
          point: 'Приказ Ростехнадзора № 520, прил. 7, табл. № 1 и № 2.'
        },
        {
          label: 'Количество катушек связи и итоговые ответы',
          value: '⌈' + fmt(total) + ' ÷ ' + REEL_LENGTH_M + '⌉ = ' + reels + ' ' + (reels === 1 ? 'катушка' : 'катушки'),
          detail: 'Дробное количество округляется вверх, потому что связь должна перекрывать весь маршрут.',
          lines: [
            'Длина одной принятой катушки связи: ' + REEL_LENGTH_M + ' м.',
            'Расчёт: N = ⌈Lобщ ÷ 800⌉ = ⌈' + fmt(total) + ' ÷ 800⌉ = ' + reels + '.',
            'Итог: расход из точки № 5 — ' + fmt(permitted) + ' атм.; давление возвращения — ' + fmt(stopPressure) + ' атм.; расстояние — ' + fmt(total) + ' м; катушек — ' + reels + '.'
          ]
        }
      ]
    };
  }

  function solve3(v) {
    var n = VGSCH.normative.fnp520app7, A = n.ATM, W = n.WORK;
    var angles = [0,10,0,15,0], elapsed = [];
    for (var i = 0; i < 5; i++) elapsed.push(minutes(v.arrivals[i + 1]) - minutes(v.arrivals[i]));
    var firstInfo = angles.map(function(angle){return speedInfo(A.UNBREATHABLE,W.RECON_DOWN,angle,1.43);});
    var distances = elapsed.map(function(t,i){return t * firstInfo[i].value;});
    var reserveOutInfo = angles.map(function(angle){return speedInfo(A.UNBREATHABLE,W.RECON_DOWN,angle,2);});
    var out = distances.map(function(d,i){return d / reserveOutInfo[i].value;});
    var revA = angles.slice().reverse(), revD = distances.slice().reverse();
    var reserveBackInfo = revA.map(function(angle){return speedInfo(A.UNBREATHABLE,W.RECON_UP,angle,2);});
    var back = revD.map(function(d,i){return d / reserveBackInfo[i].value;});
    var outTotal=sum(out), backTotal=sum(back);
    var pressureForward=(195-50)/3;
    var outCumulative=0, backCumulative=0;
    return {
      primary: outTotal + backTotal, unit: 'мин', label: 'Время резервного отделения туда и обратно',
      answers: [
        { id:'pressure', label:'Допустимый расход на движение вперёд', type:'numeric', value:pressureForward, unit:'атм.', decimals:1 },
        { id:'outTime', label:'Время движения резервного отделения до точки № 6', type:'numeric', value:outTotal, unit:'мин', decimals:1 },
        { id:'backTime', label:'Время обратного движения', type:'numeric', value:backTotal, unit:'мин', decimals:1 },
        { id:'totalTime', label:'Общее время туда и обратно', type:'numeric', value:outTotal+backTotal, unit:'мин', decimals:1 }
      ],
      steps: [
        {
          label: 'Восстановление длины маршрута первого отделения',
          value: 'L = t × (Vп.в ÷ 1,43)',
          detail: 'По схеме известны времена прибытия первого отделения в точки. При видимости 8 м по таблице № 2 принимается k₃ = 1,43; по этим данным восстанавливается длина каждого участка.',
          lines: distances.map(function (d, i) {
            return 'Участок ' + (i+1) + '→' + (i+2) + ': Δt = ' + v.arrivals[i+1] + ' − ' + v.arrivals[i] + ' = ' + elapsed[i] + ' мин; ' +
              angleFormula(angles[i], firstInfo[i].acceptedAngle) + '; Vп.в = ' + fmt(firstInfo[i].full) + ' м/мин; V = ' + fmt(firstInfo[i].full) + ' ÷ 1,43 = ' + fmt(firstInfo[i].value) + ' м/мин; L = ' + elapsed[i] + ' × ' + fmt(firstInfo[i].value) + ' = ' + fmt(d) + ' м.';
          }).concat(['Общая расчётная длина маршрута: ' + distances.map(function(x){return fmt(x);}).join(' + ') + ' = ' + fmt(sum(distances)) + ' м.']),
          point: 'Приказ Ростехнадзора № 520, прил. 7, табл. № 1 и № 2.'
        },
        {
          label: 'Допустимый расход кислорода резервного отделения',
          value: '(195 − 50) ÷ 3 = ' + fmt(pressureForward) + ' атм.',
          detail: 'Маршрут содержит спуск 15°, то есть более 10°. Поэтому рабочий запас распределяется: одна треть вперёд и две трети на возвращение.',
          lines: [
            'Минимальное давление резервного отделения: P₀ = 195 атм.',
            'Неприкосновенный резерв: Pрез = 50 атм.',
            'Рабочий запас: Pраб = 195 − 50 = 145 атм.',
            'Расход вперёд: Pвперёд = 145 ÷ 3 = ' + fmt(pressureForward) + ' атм.',
            'Давление прекращения движения вперёд: 195 − ' + fmt(pressureForward) + ' = ' + fmt(195-pressureForward) + ' атм.'
          ],
          point: 'Устав ВГСЧ, пп. 22–23.'
        },
        {
          label: 'Движение резервного отделения к точке № 6',
          value: 'Общее время движения туда: ' + fmt(outTotal) + ' мин',
          detail: 'Видимость ухудшилась до 4 м, поэтому по таблице № 2 k₃ = 2. Для каждого участка снова рассчитывается скорость и время.',
          lines: out.map(function (x, i) {
            outCumulative += x;
            return 'Участок ' + (i+1) + '→' + (i+2) + ': L = ' + fmt(distances[i]) + ' м; ' + angleFormula(angles[i], reserveOutInfo[i].acceptedAngle) + '; Vп.в = ' + fmt(reserveOutInfo[i].full) + ' м/мин; V = ' + fmt(reserveOutInfo[i].full) + ' ÷ 2 = ' + fmt(reserveOutInfo[i].value) + ' м/мин; t = ' + fmt(distances[i]) + ' ÷ ' + fmt(reserveOutInfo[i].value) + ' = ' + fmt(x) + ' мин; накопленное время до точки № ' + (i+2) + ' = ' + fmt(outCumulative) + ' мин.';
          }).concat(['Сумма: tтуда = ' + out.map(function(x){return fmt(x);}).join(' + ') + ' = ' + fmt(outTotal) + ' мин.']),
          point: 'Приказ Ростехнадзора № 520, прил. 7, табл. № 1 и № 2.'
        },
        {
          label: 'Обратное движение резервного отделения',
          value: 'Общее время обратного движения: ' + fmt(backTotal) + ' мин',
          detail: 'На обратном пути направление на наклонных участках меняется: для подъёма используются строки «движение вверх при разведке». Видимость остаётся 4 м, k₃ = 2.',
          lines: back.map(function (x, i) {
            backCumulative += x;
            return 'Участок ' + (6-i) + '→' + (5-i) + ': L = ' + fmt(revD[i]) + ' м; ' + angleFormula(revA[i], reserveBackInfo[i].acceptedAngle) + '; Vп.в = ' + fmt(reserveBackInfo[i].full) + ' м/мин; V = ' + fmt(reserveBackInfo[i].full) + ' ÷ 2 = ' + fmt(reserveBackInfo[i].value) + ' м/мин; t = ' + fmt(revD[i]) + ' ÷ ' + fmt(reserveBackInfo[i].value) + ' = ' + fmt(x) + ' мин; накопленное время от точки № 6 до точки № ' + (5-i) + ' = ' + fmt(backCumulative) + ' мин.';
          }).concat(['Сумма: tобратно = ' + back.map(function(x){return fmt(x);}).join(' + ') + ' = ' + fmt(backTotal) + ' мин.']),
          point: 'Приказ Ростехнадзора № 520, прил. 7, табл. № 1 и № 2.'
        },
        {
          label: 'Общее время и итоговые ответы',
          value: fmt(outTotal) + ' + ' + fmt(backTotal) + ' = ' + fmt(outTotal + backTotal) + ' мин',
          detail: 'Расчёт выполнен для движения резервного отделения без транспортировки пострадавшего.',
          lines: [
            'Время до точки № 6: ' + fmt(outTotal) + ' мин.',
            'Время от точки № 6 обратно на ПБ: ' + fmt(backTotal) + ' мин.',
            'Полное время: tобщ = tтуда + tобратно = ' + fmt(outTotal) + ' + ' + fmt(backTotal) + ' = ' + fmt(outTotal+backTotal) + ' мин.',
            'Допустимый расход кислорода вперёд: ' + fmt(pressureForward) + ' атм.'
          ]
        }
      ]
    };
  }

  function condition1(v) {
    var evacuationQuestion = v.id === '1-1'
      ? '— время на движение при эвакуации пострадавшего (если к моменту возвращения загазованность распространится до точки № 1)'
      : '— время в каждой точке при эвакуации пострадавшего, если к моменту возвращения загазованность распространится до точки № 1.';
    return 'Отделение в составе 5 человек направлено в разведку, с целью поиска пострадавшего, ' +
      'оказания первой помощи и эвакуацию на подземную базу из точки № 6. Площадь поперечного ' +
      'сечения выработки ' + String(v.area).replace('.', ',') + ' м², высота выработки ' +
      String(v.height).replace('.', ',') + ' м, задымленность неизвестна, температура 4 °C. ' +
      'По данным дистанционного замера газовой обстановки, непригодная для дыхания атмосфера ' +
      'начинается в точке № 3. Минимальное давление в респираторе отделения ' + v.pressure +
      ' атм. Время выхода с ПБ ' + v.start + '.\n\nОпределить:\n' +
      '— возможность выполнения задания\n' + evacuationQuestion + '\n' +
      '— время, на оказание помощи пострадавшему в точке № 6\n' +
      '— время, в которое отделение вернется на ПБ.';
  }
  function condition2(v) {
    return 'Отделение в составе 5 человек, направлено в разведку, с целью поиска пострадавших, ' +
      'уточнения обстановки на аварийном участке. Площадь поперечного сечения выработки ' +
      String(v.area).replace('.', ',') + ' м², высота выработки ' +
      String(v.height).replace('.', ',') + ' м. Задымленность отсутствует. Температура ' +
      v.temp + ' °C. Минимальное давление в респираторе отделения ' + v.pressure +
      ' атм. Время выхода с подземной базы (ПБ) в точке № 1 — ' + v.start + '.\n\nОпределить:\n' +
      '— расход кислорода на движение вперед из точки № 5\n' +
      '— минимальное давление кислорода, при котором отделение должно возвращаться на ПБ\n' +
      '— пройденное расстояние (от точки № 1 до точки № 6), количество катушек связи, ' +
      'которое необходимо взять отделению для разведки.';
  }
  function condition3(v) {
    return 'Отделение в составе 5 человек в 10:00 вышло с подземной базы на разведку горной ' +
      'выработки, с целью уточнения ситуации на аварийном участке. Площадь поперечного сечения ' +
      'выработки 30 м², высота выработки 5 м. Видимость 8 метров. Температура 4 °C. Включение ' +
      'в респираторы происходит в точке № 1.\n\nВ ' + v.lost + ' в точке № 6 связь с отделение ' +
      'была потеряна, им на встречу с подземной базы выдвинулось резервное отделение. Минимальное ' +
      'давление в респираторе резервного отделения 195 атм.\n\nОпределить:\n' +
      '— расход кислорода для резервного отделения, с учетом, что видимость ухудшилась до 4 метров.\n' +
      '— время на дорогу резервного отделения туда и обратно (в каждой точке маршрута).';
  }

  function wrap(series, v) {
    var solve = series === 1 ? solve1(v) : series === 2 ? solve2(v) : solve3(v);
    return {
      id: v.id, series: series, title: 'Задача № ' + v.id,
      condition: series === 1 ? condition1(v) : series === 2 ? condition2(v) : condition3(v),
      angles: series === 1 ? [0,15,0,70,0] : series === 2 ? v.angles : [0,10,0,15,0],
      lengths: series === 1 ? v.lengths : null,
      readings: series === 2 ? v.readings : null,
      arrivals: series === 3 ? v.arrivals : null,
      solution: solve
    };
  }

  function all() {
    return SET1.map(function(v){return wrap(1,v);})
      .concat(SET2.map(function(v){return wrap(2,v);}))
      .concat(SET3.map(function(v){return wrap(3,v);}));
  }

  VGSCH.data = VGSCH.data || {};
  VGSCH.data.commissionTasks = {
    groupTitle: 'Комбинированные задачи (вопросы от комиссии МЧС)',
    apparatus: APPARATUS,
    reelLengthM: REEL_LENGTH_M,
    tableAngle: tableAngle,
    all: all,
    byId: function(id){var a=all();for(var i=0;i<a.length;i++)if(a[i].id===id)return a[i];return null;}
  };
})(window.VGSCH = window.VGSCH || {});
