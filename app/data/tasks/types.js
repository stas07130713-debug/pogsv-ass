/* Реестр типов задач T01–T30 из файла «Основа генератора задач ВГСЧ».
 *
 * Новый тип НЕ создаётся автоматически. Чтобы добавить тип, нужно описать его
 * здесь и реализовать генератор в engine/generator.js.
 *
 * status:
 *   ENABLED         — реализован, участвует в генерации;
 *   NOT_IMPLEMENTED — тип описан, генератор ещё не написан;
 *   DISABLED        — генерация невозможна: не хватает нормативных данных
 *                     (в blockedBy указано, чего именно).
 *
 * ЗАМЕНЯЕМЫЙ БЛОК ДАННЫХ.
 */
(function (VGSCH) {
  'use strict';

  var GROUP = {
    DASK: 'ДАСК',
    TEMPERATURE: 'Температура',
    SMOKE: 'Задымление',
    COMBINED: 'Комбинированная',
    ROUTE: 'Маршрут',
    CONTROL: 'Контроль',
    SCHEME: 'Схема',
    EXAM: 'Экзамен'
  };

  var TYPES = [
    { id: 'T01', group: GROUP.DASK, title: 'Рабочий и резервный запас',
      difficulty: 'простая', status: 'ENABLED',
      basis: [['ustav251', 'п. 22']] },

    { id: 'T02', group: GROUP.DASK, title: 'Давление начала возвращения',
      difficulty: 'простая', status: 'ENABLED',
      basis: [['ustav251', 'п. 22'], ['ustav251', 'п. 23']] },

    { id: 'T03', group: GROUP.DASK, title: 'Горизонтальная выработка',
      difficulty: 'простая', status: 'ENABLED',
      basis: [['ustav251', 'п. 22']] },

    { id: 'T04', group: GROUP.DASK, title: 'Подъём',
      difficulty: 'средняя', status: 'ENABLED',
      basis: [['ustav251', 'п. 22']] },

    { id: 'T05', group: GROUP.DASK, title: 'Спуск до 10°',
      difficulty: 'средняя', status: 'ENABLED',
      basis: [['ustav251', 'п. 22']] },

    { id: 'T06', group: GROUP.DASK, title: 'Спуск более 10°',
      difficulty: 'средняя', status: 'ENABLED',
      basis: [['ustav251', 'п. 22']] },

    { id: 'T07', group: GROUP.DASK, title: 'Несколько участков',
      difficulty: 'сложная', status: 'ENABLED', scheme: true,
      basis: [['ustav251', 'п. 22']] },

    { id: 'T08', group: GROUP.DASK, title: 'Давление в промежуточной точке маршрута',
      difficulty: 'сложная', status: 'ENABLED', scheme: true,
      basis: [['ustav251', 'п. 22'], ['ustav251', 'п. 23']] },

    { id: 'T09', group: GROUP.DASK, title: 'Механический транспорт',
      difficulty: 'сложная', status: 'ENABLED',
      basis: [['ustav251', 'п. 22']] },

    { id: 'T10', group: GROUP.DASK, title: 'Эвакуация пострадавшего',
      difficulty: 'сложная', status: 'ENABLED',
      basis: [['ustav251', 'п. 22'], ['fnp520', 'прил. 7, табл. N 1']] },

    { id: 'T11', group: GROUP.DASK, title: 'Время защитного действия',
      difficulty: 'средняя', status: 'ENABLED',
      basis: [['fnp520', 'прил. 6, п. 2'], ['fnp520', 'прил. 6, п. 3']] },

    { id: 'T12', group: GROUP.DASK, title: 'Комбинированная задача по ДАСК',
      difficulty: 'сложная', status: 'NOT_IMPLEMENTED',
      basis: [['ustav251', 'п. 22']] },

    { id: 'T13', group: GROUP.TEMPERATURE, title: 'Высокая температура: работа на месте',
      difficulty: 'простая', status: 'ENABLED',
      basis: [['fnp520', 'прил. 6, табл. N 1'], ['fnp520', 'прил. 6, п. 13']] },

    { id: 'T14', group: GROUP.TEMPERATURE, title: 'Высокая температура: движение',
      difficulty: 'средняя', status: 'ENABLED',
      basis: [['fnp520', 'прил. 6, табл. N 1'], ['fnp520', 'прил. 6, п. 12'], ['ustav251', 'п. 38']] },

    { id: 'T15', group: GROUP.TEMPERATURE, title: 'Рост температуры за 5 минут',
      difficulty: 'простая', status: 'ENABLED',
      basis: [['fnp520', 'п. 27'], ['ustav251', 'п. 41']] },

    { id: 'T16', group: GROUP.TEMPERATURE, title: 'Несколько температур по маршруту',
      difficulty: 'средняя', status: 'ENABLED',
      basis: [['fnp520', 'прил. 6, п. 18'], ['ustav251', 'п. 39']] },

    { id: 'T17', group: GROUP.TEMPERATURE, title: 'Низкая температура',
      difficulty: 'средняя', status: 'ENABLED',
      basis: [['fnp520', 'прил. 6, табл. N 2'], ['fnp520', 'прил. 6, п. 19']] },

    { id: 'T18', group: GROUP.TEMPERATURE, title: 'Комбинированная ЗВТ + ДАСК',
      difficulty: 'сложная', status: 'NOT_IMPLEMENTED',
      basis: [['fnp520', 'прил. 6'], ['ustav251', 'п. 22']] },

    { id: 'T19', group: GROUP.SMOKE, title: 'Скорость в задымлённой выработке',
      difficulty: 'простая', status: 'ENABLED',
      basis: [['fnp520', 'прил. 7, табл. N 1'], ['fnp520', 'прил. 7, табл. N 2']] },

    { id: 'T20', group: GROUP.SMOKE, title: 'Время движения до точки',
      difficulty: 'средняя', status: 'ENABLED',
      basis: [['fnp520', 'прил. 7']] },

    { id: 'T21', group: GROUP.SMOKE, title: 'Задымление в сочетании с температурой',
      difficulty: 'сложная', status: 'ENABLED',
      basis: [['fnp520', 'прил. 7'], ['fnp520', 'прил. 6, табл. N 1'], ['fnp520', 'прил. 6, п. 12']] },

    { id: 'T22', group: GROUP.COMBINED, title: 'ДАСК + задымление',
      difficulty: 'сложная', status: 'NOT_IMPLEMENTED',
      basis: [['ustav251', 'п. 22'], ['fnp520', 'прил. 7']] },

    { id: 'T23', group: GROUP.COMBINED, title: 'ДАСК + температура + задымление',
      difficulty: 'сложная', status: 'NOT_IMPLEMENTED',
      basis: [['ustav251', 'п. 22'], ['fnp520', 'прил. 6'], ['fnp520', 'прил. 7']] },

    { id: 'T24', group: GROUP.ROUTE, title: 'Максимальная дальность продвижения',
      difficulty: 'сложная', status: 'ENABLED',
      basis: [['ustav251', 'п. 22']] },

    { id: 'T25', group: GROUP.ROUTE, title: 'Максимальное время движения вперёд',
      difficulty: 'средняя', status: 'ENABLED',
      basis: [['fnp520', 'прил. 6, п. 12'], ['ustav251', 'п. 38']] },

    { id: 'T26', group: GROUP.CONTROL, title: 'Найти ошибку в расчёте',
      difficulty: 'сложная', status: 'NOT_IMPLEMENTED',
      basis: [['ustav251', 'п. 22']] },

    { id: 'T27', group: GROUP.CONTROL, title: 'Можно или нельзя выполнить задание',
      difficulty: 'сложная', status: 'ENABLED',
      basis: [['ustav251', 'п. 22'], ['fnp520', 'прил. 6']] },

    { id: 'T28', group: GROUP.SCHEME, title: 'Схема маршрута с двумя участками',
      difficulty: 'средняя', status: 'NOT_IMPLEMENTED', scheme: true,
      basis: [['ustav251', 'п. 22']] },

    { id: 'T29', group: GROUP.SCHEME, title: 'Схема маршрута с 3–5 участками',
      difficulty: 'сложная', status: 'NOT_IMPLEMENTED', scheme: true,
      basis: [['ustav251', 'п. 22']] },

    { id: 'T30', group: GROUP.EXAM, title: 'Составная экзаменационная задача',
      difficulty: 'сложная', status: 'NOT_IMPLEMENTED',
      basis: [['ustav251', 'п. 22'], ['fnp520', 'прил. 6'], ['fnp520', 'прил. 7']] }
  ];

  function byId(id) {
    for (var i = 0; i < TYPES.length; i++) if (TYPES[i].id === id) return TYPES[i];
    return null;
  }

  /** Типы, доступные генератору прямо сейчас. */
  function enabled(group) {
    return TYPES.filter(function (t) {
      if (t.status !== 'ENABLED') return false;
      return !group || t.group === group;
    });
  }

  /** Группы, в которых есть хотя бы один рабочий тип. */
  function activeGroups() {
    var seen = {}, out = [];
    enabled().forEach(function (t) {
      if (!seen[t.group]) { seen[t.group] = true; out.push(t.group); }
    });
    return out;
  }

  VGSCH.data = VGSCH.data || {};
  VGSCH.data.taskTypes = {
    GROUP: GROUP,
    list: TYPES,
    byId: byId,
    enabled: enabled,
    activeGroups: activeGroups
  };
})(window.VGSCH = window.VGSCH || {});
