/* Конвейер выдачи задачи.
 *
 * Наружу отдаётся только задача со статусом VALID. Отклонённые попытки
 * не исправляются и не показываются — генератор просто берёт следующее зерно.
 */
(function (VGSCH) {
  'use strict';

  var types = VGSCH.data.taskTypes;
  var generator = VGSCH.engine.generator;
  var validator = VGSCH.engine.validator;
  var rngLib = VGSCH.engine.rng;

  /**
   * Одна задача заданного типа.
   * @returns {{task:object, attempts:number, rejected:Array}}
   */
  function produceType(typeId, seed) {
    var maxAttempts = VGSCH.config.tasks.maxGenerationAttempts;
    var rejected = [];
    var s = seed === undefined ? rngLib.freshSeed() : seed >>> 0;

    for (var attempt = 1; attempt <= maxAttempts; attempt++) {
      var task;
      try {
        task = generator.build(typeId, s);
      } catch (e) {
        rejected.push({ seed: s, reason: 'Построение: ' + e.message });
        s = (s + 0x9E3779B9) >>> 0;
        continue;
      }

      validator.validate(task);
      if (task.validation.status === 'VALID') {
        return { task: task, attempts: attempt, rejected: rejected };
      }
      rejected.push({
        seed: s,
        reason: task.validation.rejectedBy.name + ': ' + task.validation.rejectedBy.detail
      });
      s = (s + 0x9E3779B9) >>> 0;
    }

    throw new Error('Не удалось получить задачу типа ' + typeId + ' за ' + maxAttempts +
                    ' попыток. Последние причины: ' +
                    rejected.slice(-3).map(function (r) { return r.reason; }).join(' | '));
  }

  /** Задача случайного рабочего типа, при необходимости — из конкретной группы. */
  function produce(group, seed) {
    var pool = types.enabled(group).filter(function (t) {
      return generator.BUILDERS[t.id];
    });
    if (!pool.length) {
      throw new Error('Нет доступных типов задач' + (group ? ' в группе «' + group + '»' : '') + '.');
    }
    var rng = rngLib.create(seed === undefined ? rngLib.freshSeed() : seed);
    var type = rng.pick(pool);
    return produceType(type.id, rngLib.freshSeed());
  }

  /** Набор задач для режима «Тестирование»: разные типы, без повторов группы подряд. */
  function produceSet(count) {
    var pool = types.enabled().filter(function (t) { return generator.BUILDERS[t.id]; });
    var rng = rngLib.create(rngLib.freshSeed());
    var chosen = [];
    var lastGroup = null;

    for (var i = 0; i < count; i++) {
      var candidates = pool.filter(function (t) { return t.group !== lastGroup; });
      if (!candidates.length) candidates = pool;
      var type = rng.pick(candidates);
      lastGroup = type.group;
      chosen.push(produceType(type.id, rngLib.freshSeed()).task);
    }
    return chosen;
  }

  VGSCH.engine = VGSCH.engine || {};
  VGSCH.engine.pipeline = {
    produce: produce,
    produceType: produceType,
    produceSet: produceSet
  };
})(window.VGSCH = window.VGSCH || {});
