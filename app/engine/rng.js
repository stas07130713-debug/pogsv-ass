/* Детерминированный генератор случайных чисел.
 *
 * Задача полностью восстанавливается по своему seed: одно и то же зерно даёт
 * одну и ту же задачу. Это нужно для воспроизведения задачи в протоколе,
 * в разборе ошибок и при отладке отклонённой генерации.
 */
(function (VGSCH) {
  'use strict';

  /** mulberry32 — быстрый PRNG с 32-битным состоянием. */
  function create(seed) {
    var state = (seed >>> 0) || 1;

    function next() {
      state = (state + 0x6D2B79F5) >>> 0;
      var t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    var api = {
      seed: seed >>> 0,

      /** Вещественное в [0, 1). */
      next: next,

      /** Целое в [min, max] включительно. */
      int: function (min, max) {
        if (max < min) throw new Error('rng.int: max (' + max + ') меньше min (' + min + ')');
        return min + Math.floor(next() * (max - min + 1));
      },

      /**
       * Значение из [min, max] с шагом step. Границы обязаны быть кратны шагу
       * относительно min, иначе значение вне допустимого домена.
       */
      step: function (min, max, step) {
        if (!(step > 0)) throw new Error('rng.step: шаг должен быть положительным, получен ' + step);
        if (max < min) throw new Error('rng.step: max (' + max + ') меньше min (' + min + ')');
        var steps = Math.floor((max - min) / step + 1e-9);
        var k = api.int(0, steps);
        // округление до шага гасит накопленную ошибку двоичной дроби (0,1 + 0,2)
        var decimals = decimalsOf(step);
        return round(min + k * step, decimals);
      },

      /** Случайный элемент массива. */
      pick: function (arr) {
        if (!arr || !arr.length) throw new Error('rng.pick: пустой массив');
        return arr[Math.floor(next() * arr.length)];
      },

      /** Несколько различных элементов массива. */
      pickMany: function (arr, count) {
        if (count > arr.length) {
          throw new Error('rng.pickMany: запрошено ' + count + ' из ' + arr.length);
        }
        return api.shuffle(arr.slice()).slice(0, count);
      },

      /** Перемешивание на месте (Фишер — Йетс). */
      shuffle: function (arr) {
        for (var i = arr.length - 1; i > 0; i--) {
          var j = Math.floor(next() * (i + 1));
          var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        }
        return arr;
      },

      /** Событие с заданной вероятностью. */
      chance: function (p) { return next() < p; }
    };
    return api;
  }

  function decimalsOf(step) {
    var s = String(step);
    var dot = s.indexOf('.');
    return dot === -1 ? 0 : s.length - dot - 1;
  }

  function round(value, decimals) {
    var f = Math.pow(10, decimals || 0);
    return Math.round((value + Number.EPSILON) * f) / f;
  }

  /** Зерно из текущего времени — для новой задачи в интерфейсе. */
  function freshSeed() {
    return (Date.now() ^ (Math.random() * 0xFFFFFFFF)) >>> 0;
  }

  VGSCH.engine = VGSCH.engine || {};
  VGSCH.engine.rng = { create: create, freshSeed: freshSeed, round: round, decimalsOf: decimalsOf };
})(window.VGSCH = window.VGSCH || {});
