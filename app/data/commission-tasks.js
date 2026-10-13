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
  function speed(atm, work, angle, k3) {
    var n = VGSCH.normative.fnp520app7;
    return n.fullVisibilitySpeed(atm, work, 2, tableAngle(angle)).value / (k3 || 1);
  }

  function solve1(v) {
    var n = VGSCH.normative.fnp520app7, A = n.ATM, W = n.WORK, k = n.K3_INITIAL;
    var L = v.lengths;
    var out = [
      L[0] / speed(A.BREATHABLE, W.RECON_DOWN, 0, k),
      L[1] / speed(A.BREATHABLE, W.RECON_DOWN, 15, k),
      L[2] / speed(A.UNBREATHABLE, W.RECON_DOWN, 0, k),
      L[3] / speed(A.UNBREATHABLE, W.RECON_UP, 70, k),
      L[4] / speed(A.UNBREATHABLE, W.RECON_DOWN, 0, k)
    ];
    var back = [
      L[4] / speed(A.UNBREATHABLE, W.VICTIM_DOWN, 0, k),
      L[3] / speed(A.UNBREATHABLE, W.VICTIM_DOWN, 70, k),
      L[2] / speed(A.UNBREATHABLE, W.VICTIM_DOWN, 0, k),
      L[1] / speed(A.UNBREATHABLE, W.VICTIM_UP, 15, k),
      L[0] / speed(A.UNBREATHABLE, W.VICTIM_DOWN, 0, k)
    ];
    var outTotal = out.reduce(function(a,b){return a+b;},0);
    var backTotal = back.reduce(function(a,b){return a+b;},0);
    var daTravel = out.slice(2).concat(back).reduce(function (a, b) { return a + b; }, 0);
    var workMin = VGSCH.normative.apparatus.workingProtectiveTime('р-30').minutes;
    var aid = Math.max(0, workMin - daTravel);
    return {
      primary: aid, unit: 'мин', label: 'Допустимое время оказания помощи',
      answers: [
        { id:'possible', label:'Возможность выполнения задания', type:'choice', value:aid > 0,
          options:[{value:true,label:'Задание выполнимо'},{value:false,label:'Задание невыполнимо'}] },
        { id:'evacuation', label:'Время эвакуации пострадавшего', type:'numeric', value:backTotal, unit:'мин', decimals:1 },
        { id:'aid', label:'Допустимое время оказания помощи', type:'numeric', value:aid, unit:'мин', decimals:1 },
        { id:'returnClock', label:'Время возвращения на ПБ', type:'time', value:clock(minutes(v.start)+outTotal+aid+backTotal), unit:'' }
      ],
      steps: [
        { label: 'Расчётный коэффициент задымлённости', value: 'k₃ = ' + String(k).replace('.', ','), detail: 'Задымлённость неизвестна, поэтому применяется первоначальное значение.' },
        { label: 'Движение к пострадавшему', value: out.map(function (x, i) { return (i + 1) + '→' + (i + 2) + ': ' + fmt(x) + ' мин'; }).join('; '), detail: 'Всего ' + fmt(outTotal) + ' мин. Скорости выбраны по таблице № 1 приложения № 7.' },
        { label: 'Эвакуация пострадавшего', value: back.map(function (x, i) { return (6 - i) + '→' + (5 - i) + ': ' + fmt(x) + ' мин'; }).join('; '), detail: 'Всего ' + fmt(back.reduce(function(a,b){return a+b;},0)) + ' мин.' },
        { label: 'Время работы в Р-30', value: fmt(workMin) + ' − ' + fmt(daTravel) + ' = ' + fmt(aid) + ' мин', detail: 'Время в пригодной атмосфере до точки 3 в лимит работы в ДА не включается.' },
        { label: 'Вывод и возвращение на ПБ', value: (aid > 0 ? 'Задание выполнимо' : 'Задание невыполнимо') + '; возвращение в ' + clock(minutes(v.start)+outTotal+aid+backTotal), detail: 'К времени выхода прибавлены движение вперёд, оказание помощи и эвакуация.' }
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
    var distances = times.map(function (t, i) { return t * speed(A.UNBREATHABLE, W.RECON_DOWN, v.angles[i], 1); });
    var total = distances.reduce(function(a,b){return a+b;},0);
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
        { label: 'Давление прекращения движения вперёд', value: fmt(v.pressure) + ' − (' + fmt(usable) + ' ÷ 3) = ' + fmt(stopPressure) + ' атм.', detail: 'На маршруте есть спуск более 10°, поэтому рабочий запас распределяется ⅓ туда и ⅔ обратно.' },
        { label: 'Остаток для движения из точки № 5', value: fmt(v.readings[4]) + ' − ' + fmt(stopPressure) + ' = ' + fmt(additional) + ' атм.', detail: canContinue ? 'Продвижение возможно в пределах этого расхода.' : 'Давление возвращения уже пройдено; дальнейшее продвижение запрещено.' },
        { label: 'Время по расходу Р-30', value: times.map(function(x,i){return (i+1)+'→'+(i+2)+': '+fmt(x)+' мин';}).join('; '), detail: 'Баллон 2 дм³, постоянная подача 1,4 дм³/мин: t = ΔP × 2 ÷ 1,4.' },
        { label: 'Пройденное расстояние', value: distances.map(function(x,i){return (i+1)+'→'+(i+2)+': '+fmt(x)+' м';}).join('; '), detail: 'Всего по допустимому маршруту: ' + fmt(total) + ' м.' },
        { label: 'Катушки связи', value: '⌈' + fmt(total) + ' ÷ ' + REEL_LENGTH_M + '⌉ = ' + reels, detail: 'Длина одной катушки — ' + REEL_LENGTH_M + ' м.' }
      ]
    };
  }

  function solve3(v) {
    var n = VGSCH.normative.fnp520app7, A = n.ATM, W = n.WORK;
    var angles = [0,10,0,15,0], elapsed = [];
    for (var i = 0; i < 5; i++) elapsed.push(minutes(v.arrivals[i + 1]) - minutes(v.arrivals[i]));
    var distances = elapsed.map(function(t,i){return t * speed(A.UNBREATHABLE,W.RECON_DOWN,angles[i],1.43);});
    var out = distances.map(function(d,i){return d / speed(A.UNBREATHABLE,W.RECON_DOWN,angles[i],2);});
    var revA = angles.slice().reverse(), revD = distances.slice().reverse();
    var back = revD.map(function(d,i){return d / speed(A.UNBREATHABLE,W.RECON_UP,revA[i],2);});
    var outTotal=out.reduce(function(a,b){return a+b;},0), backTotal=back.reduce(function(a,b){return a+b;},0);
    var pressureForward=(195-50)/3;
    return {
      primary: outTotal + backTotal, unit: 'мин', label: 'Время резервного отделения туда и обратно',
      answers: [
        { id:'pressure', label:'Допустимый расход на движение вперёд', type:'numeric', value:pressureForward, unit:'атм.', decimals:1 },
        { id:'outTime', label:'Время движения резервного отделения до точки № 6', type:'numeric', value:outTotal, unit:'мин', decimals:1 },
        { id:'backTime', label:'Время обратного движения', type:'numeric', value:backTotal, unit:'мин', decimals:1 },
        { id:'totalTime', label:'Общее время туда и обратно', type:'numeric', value:outTotal+backTotal, unit:'мин', decimals:1 }
      ],
      steps: [
        { label: 'Длина участков по движению первого отделения', value: distances.map(function(x,i){return (i+1)+'→'+(i+2)+': '+fmt(x)+' м';}).join('; '), detail: 'При видимости 8 м применяется k₃ = 1,43.' },
        { label: 'Движение резервного отделения к точке № 6', value: out.map(function(x,i){return (i+1)+'→'+(i+2)+': '+fmt(x)+' мин';}).join('; '), detail: 'При видимости 4 м применяется k₃ = 2. Всего ' + fmt(outTotal) + ' мин.' },
        { label: 'Обратный путь', value: back.map(function(x,i){return (6-i)+'→'+(5-i)+': '+fmt(x)+' мин';}).join('; '), detail: 'Для наклонных участков используются скорости движения вверх. Всего ' + fmt(backTotal) + ' мин.' },
        { label: 'Общее время', value: fmt(outTotal) + ' + ' + fmt(backTotal) + ' = ' + fmt(outTotal + backTotal) + ' мин', detail: 'Возвращение рассчитано без транспортировки пострадавшего.' },
        { label: 'Допустимый расход вперёд', value: '(195 − 50) ÷ 3 = ' + fmt(pressureForward) + ' атм.', detail: 'Это допустимый запас по Уставу, а не прогноз фактического падения давления.' }
      ]
    };
  }

  function condition1(v) {
    return 'Отделение в составе 5 человек направлено в разведку для поиска пострадавшего, ' +
      'оказания первой помощи и эвакуации на подземную базу из точки № 6. Площадь поперечного ' +
      'сечения выработки ' + String(v.area).replace('.', ',') + ' м², высота ' + String(v.height).replace('.', ',') +
      ' м, задымлённость неизвестна, температура 4 °C. Непригодная для дыхания атмосфера ' +
      'начинается в точке № 3. Минимальное давление в Р-30 — ' + v.pressure +
      ' атм. Время выхода с ПБ — ' + v.start + '. Определить возможность выполнения задания, ' +
      'время эвакуации, время оказания помощи и время возвращения на ПБ.';
  }
  function condition2(v) {
    return 'Отделение в составе 5 человек направлено в разведку для поиска пострадавших и ' +
      'уточнения обстановки. Площадь поперечного сечения ' + String(v.area).replace('.', ',') +
      ' м², высота ' + String(v.height).replace('.', ',') + ' м, задымлённость отсутствует, температура ' +
      v.temp + ' °C. Минимальное давление в Р-30 — ' + v.pressure + ' атм. Время выхода с ПБ — ' +
      v.start + '. Определить допустимый расход после точки № 5, давление возвращения, пройденное ' +
      'расстояние и количество катушек связи по 800 м.';
  }
  function condition3(v) {
    return 'Отделение в составе 5 человек в 10:00 вышло с ПБ на разведку. Площадь поперечного ' +
      'сечения 30 м², высота 5 м, видимость 8 м, температура 4 °C. Включение в Р-30 происходит ' +
      'в точке № 1. В ' + v.lost + ' в точке № 6 связь с отделением потеряна, навстречу направлено ' +
      'резервное отделение с минимальным давлением 195 атм. Видимость ухудшилась до 4 м. ' +
      'Определить допустимый расход и время движения резервного отделения туда и обратно.';
  }

  function wrap(series, v) {
    var solve = series === 1 ? solve1(v) : series === 2 ? solve2(v) : solve3(v);
    return {
      id: v.id, series: series, title: 'Задача ' + v.id,
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
