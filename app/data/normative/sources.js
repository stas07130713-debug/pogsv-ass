/* Реестр нормативных источников.
 *
 * Каждая величина в приложении обязана ссылаться на запись отсюда.
 * При выходе новой редакции документа: изменить revision и checkedOn,
 * после чего все задачи, ссылающиеся на этот источник, переводятся в REVIEW
 * (см. engine/validator.js -> reviewTasksBySource).
 *
 * ЗАМЕНЯЕМЫЙ БЛОК ДАННЫХ. Логику приложения не трогает.
 */
(function (VGSCH) {
  'use strict';

  var SOURCES = {
    ustav251: {
      id: 'ustav251',
      kind: 'normative',
      document: 'Приказ МЧС России от 09.06.2017 № 251',
      title: 'Устав военизированной горноспасательной части по организации и ведению горноспасательных работ',
      revision: 'ред. от 18.04.2023 № 379',
      checkedOn: '2026-08-11',
      shortName: 'Устав ВГСЧ, п.'
    },
    fnp520: {
      id: 'fnp520',
      kind: 'normative',
      document: 'Приказ Ростехнадзора от 11.12.2020 № 520',
      title: 'ФНП «Инструкция по локализации и ликвидации последствий аварий на опасных производственных объектах, на которых ведутся горные работы»',
      revision: 'с изм. от 08.12.2023 и от 20.02.2026',
      checkedOn: '2026-08-11',
      shortName: 'ФНП № 520,'
    },
    spravochnik2023: {
      id: 'spravochnik2023',
      kind: 'methodical',
      document: 'Справочник командира отделения ВГСЧ',
      title: 'Справочник командира отделения ВГСЧ',
      revision: '2023',
      checkedOn: '2026-08-11',
      shortName: 'Справочник ВГСЧ,',
      note: 'Учебно-методический источник. Не подменяет действующую норму. ' +
            'Величины отсюда помечаются constraint_type: "methodical" и показываются ' +
            'пользователю как учебные, а не как нормативное требование.'
    },
    educational: {
      id: 'educational',
      kind: 'educational',
      document: 'Учебная архитектура приложения',
      title: 'Диапазоны, установленные для генерации учебных задач',
      revision: 'v1',
      checkedOn: '2026-08-11',
      shortName: 'учебный диапазон',
      note: 'Норматив не устанавливает этих границ. НИКОГДА не выдавать пользователю ' +
            'как нормативное требование (правило 8.1, уровень 3).'
    }
  };

  /** Человекочитаемая ссылка: «ФНП № 520, прил. 6, п. 13» */
  function cite(sourceId, point) {
    var s = SOURCES[sourceId];
    if (!s) throw new Error('Неизвестный источник: ' + sourceId);
    return point ? s.shortName + ' ' + point : s.document;
  }

  /** Полная ссылка для протокола и разбора ошибок. */
  function citeFull(sourceId, point) {
    var s = SOURCES[sourceId];
    if (!s) throw new Error('Неизвестный источник: ' + sourceId);
    return s.document + (s.revision ? ' (' + s.revision + ')' : '') + (point ? ', ' + point : '');
  }

  VGSCH.normative = VGSCH.normative || {};
  VGSCH.normative.SOURCES = SOURCES;
  VGSCH.normative.cite = cite;
  VGSCH.normative.citeFull = citeFull;
})(window.VGSCH = window.VGSCH || {});
