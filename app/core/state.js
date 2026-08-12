/* Состояние текущего сеанса.
 *
 * Живёт только в памяти вкладки: ни фамилия, ни номер отделения, ни результаты
 * никуда не сохраняются и не покидают устройство. Закрытие вкладки очищает всё.
 */
(function (VGSCH) {
  'use strict';

  var state = {
    person: '',     // фамилия и инициалы
    unit: '',       // номер отделения
    position: '',   // должность
    mode: null,
    run: null,

    /* Результат последнего завершённого экзамена. Держим его в состоянии
       сеанса, а не внутри экрана: иначе стоит уйти с экрана результата,
       не нажав «Просмотр отчёта», — и итоги пропадали безвозвратно.
       Теперь на вкладку «Экзамен» можно вернуться и распечатать протокол.
       Очищается только запуском нового экзамена и закрытием вкладки. */
    exam: null
  };

  function setPerson(v) { state.person = String(v || '').trim(); }
  function setUnit(v) { state.unit = String(v || '').trim(); }
  function setPosition(v) { state.position = String(v || '').trim(); }

  /** Заполнены ли данные, без которых нельзя начинать. */
  function isIdentified() { return state.person.length >= 3; }

  function startRun(mode, data) {
    state.mode = mode;
    state.run = Object.assign({ mode: mode, startedAt: new Date() }, data || {});
    return state.run;
  }

  function reset() { state.mode = null; state.run = null; }

  /** Запомнить итоги экзамена до конца сеанса. */
  function saveExam(result) { state.exam = result || null; }

  /** Итоги последнего экзамена или null, если экзамен ещё не проходили. */
  function lastExam() { return state.exam; }

  function clearExam() { state.exam = null; }

  VGSCH.state = {
    data: state,
    setPerson: setPerson,
    setUnit: setUnit,
    setPosition: setPosition,
    isIdentified: isIdentified,
    startRun: startRun,
    saveExam: saveExam,
    lastExam: lastExam,
    clearExam: clearExam,
    reset: reset
  };
})(window.VGSCH = window.VGSCH || {});
