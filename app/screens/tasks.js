/* Экран 3. Режим «Задачи» — макеты 03 и 06.
 *
 * Значения генерируются заново при каждом запуске. Показывается только задача
 * со статусом VALID. Решение разбирается по шагам, как на макете 06.
 */
(function (VGSCH) {
  'use strict';

  var ui = VGSCH.ui;
  var units = VGSCH.engine.units;
  var pipeline = VGSCH.engine.pipeline;
  var types = VGSCH.data.taskTypes;
  var commission = VGSCH.data.commissionTasks;

  var current = null;
  var group = null;
  var solved = 0;
  var commissionAttempt = null;

  /* Формы для склонения: 1 тип, 2 типа, 5 типов. */
  var TYPE_FORMS = ['тип', 'типа', 'типов'];

  function render(root) {
    current = null; group = null; solved = 0;
    renderPicker(root);
  }

  /* --------------------------------------------------------- выбор группы */

  function renderPicker(root) {
    var groups = types.activeGroups().filter(function (g) {
      return types.enabled(g).some(function (t) { return VGSCH.engine.generator.BUILDERS[t.id]; });
    });

    var v = ui.paint(root,
      ui.appbar({ mode: 'tasks', title: 'Задачи' }) +
      '<div class="panel" style="--accent:var(--tasks)">' +
        '<h3 style="margin-bottom:6px">Выберите группу задач</h3>' +
        '<p class="muted" style="margin:0 0 14px">Значения генерируются заново при каждом ' +
        'запуске и проверяются независимым расчётом.</p>' +
        '<div class="pick-list">' +
          '<button class="pick-item" data-group=""><span class="t">Все группы</span>' +
            '<span class="n">' + ui.count(implementedCount(), TYPE_FORMS) + '</span></button>' +
          groups.map(function (g) {
            var n = types.enabled(g).filter(function (t) {
              return VGSCH.engine.generator.BUILDERS[t.id];
            }).length;
            return '<button class="pick-item" data-group="' + ui.esc(g) + '">' +
              '<span class="t">' + ui.esc(g) + '</span>' +
              '<span class="n">' + ui.count(n, TYPE_FORMS) + '</span></button>';
          }).join('') +
          '<button class="pick-item commission-pick" data-commission="1">' +
            '<span class="t">' + ui.esc(commission.groupTitle) + '</span>' +
            '<span class="n">15 задач</span></button>' +
        '</div>' +
      '</div>' +
      ui.tabbar('tasks'));

    ui.wireNav(v);
    ui.on(v, '.pick-item', function (b) {
      if (b.dataset.commission) { renderCommissionPicker(root); return; }
      group = b.dataset.group || null;
      solved = 0;
      nextTask(root);
    });
  }

  /* ------------------ фиксированные комбинированные задачи комиссии МЧС */

  function renderCommissionPicker(root) {
    var list = commission.all();
    var series = [
      { n: 1, title: 'Серия 1 · Поиск и эвакуация пострадавшего' },
      { n: 2, title: 'Серия 2 · Давление, расстояние и катушки связи' },
      { n: 3, title: 'Серия 3 · Выход резервного отделения' }
    ];
    var v = ui.paint(root,
      ui.appbar({ mode: 'tasks', title: 'Комбинированные задачи', backArrow: true }) +
      '<div class="panel" style="--accent:var(--tasks)">' +
        '<h3 style="margin-bottom:6px">Вопросы от комиссии МЧС</h3>' +
        '<p class="muted" style="margin:0 0 16px">Фиксированные варианты сохраняют исходные ' +
          'числа и схемы. Расчёты выполняются для Р-30; длина катушки связи — 800 м.</p>' +
        series.map(function (s) {
          return '<section class="commission-series"><h4>' + ui.esc(s.title) + '</h4>' +
            '<div class="commission-variants">' + list.filter(function(t){return t.series===s.n;})
              .map(function(t){return '<button data-commission-id="'+t.id+'">Задача '+t.id+'</button>';}).join('') +
            '</div></section>';
        }).join('') +
      '</div>' + ui.tabbar('tasks'));
    VGSCH.router.setBackHandler(function(){renderPicker(root);return true;});
    ui.wireNav(v);
    ui.on(v, '[data-commission-id]', function(b){renderCommissionTask(root,b.dataset.commissionId);});
  }

  function commissionScheme(t) {
    var xs=[45,175,305,435,565,695], ys=[95,95,155,155,215,215];
    var labels=[];
    for(var i=0;i<5;i++){
      var cx=(xs[i]+xs[i+1])/2;
      var top=Math.min(ys[i],ys[i+1])-19;
      var bottom=Math.max(ys[i],ys[i+1])+30;
      var primary=t.angles[i]+'°'+(t.lengths?' · '+t.lengths[i]+' м':'');
      var secondary=t.readings ? t.readings[i]+' → '+(i<4?t.readings[i+1]:'?')+' атм.'
        : t.arrivals ? t.arrivals[i]+' → '+t.arrivals[i+1] : '';
      labels.push('<text class="seg-label" x="'+cx+'" y="'+top+'" text-anchor="middle">'+primary+'</text>');
      if(secondary) labels.push('<text class="seg-sub" x="'+cx+'" y="'+bottom+'" text-anchor="middle">'+secondary+'</text>');
    }
    return '<div class="commission-scheme"><svg viewBox="0 0 740 260" role="img" aria-label="Схема маршрута">' +
      '<polyline points="'+xs.map(function(x,i){return x+','+ys[i];}).join(' ')+'"/>' + labels.join('') +
      xs.map(function(x,i){return '<circle cx="'+x+'" cy="'+ys[i]+'" r="14"/><text class="point" x="'+x+'" y="'+(ys[i]+5)+'" text-anchor="middle">'+(i+1)+'</text>';}).join('') +
      '</svg></div>';
  }

  function commissionContext(t) {
    return { mode:'Задачи — комиссия МЧС', kind:'Задача', id:t.id,
      text:t.condition, extra:'Р-30; катушка связи 800 м; углы: '+t.angles.join('°, ')+'°.\n'+
        'Расчётные ответы: '+t.solution.answers.map(function(a){return a.label+': '+
          (a.type==='choice'?(a.value?'задание выполнимо':'задание невыполнимо'):
           a.type==='time'?a.value:units.fmt(a.value,a.decimals)+' '+a.unit);}).join('; ') };
  }

  function renderCommissionAnswers(solution) {
    return '<div class="commission-answer-fields"><h4>Ответы</h4>'+solution.answers.map(function(a,i){
      if(a.type==='choice') return '<label class="commission-field"><span>'+(i+1)+'. '+ui.esc(a.label)+'</span><select data-canswer="'+ui.esc(a.id)+'">'+
        '<option value="">Выберите вариант</option>'+a.options.map(function(o){return '<option value="'+(o.value?'1':'0')+'">'+ui.esc(o.label)+'</option>';}).join('')+'</select><small class="field-error"></small></label>';
      return '<label class="commission-field"><span>'+(i+1)+'. '+ui.esc(a.label)+(a.unit?' ('+ui.esc(a.unit)+')':'')+'</span><div class="answer-row">'+
        '<input type="'+(a.type==='time'?'time':'text')+'" '+(a.type==='numeric'?'inputmode="decimal" ':'')+'data-canswer="'+ui.esc(a.id)+'" autocomplete="off" placeholder="'+(a.type==='time'?'ЧЧ:ММ':'Числовое значение')+'">'+
        (a.unit?'<span class="unit">'+ui.esc(a.unit)+'</span>':'')+'</div><small class="field-error"></small></label>';
    }).join('')+'</div>';
  }

  function renderCommissionTask(root,id) {
    var t=commission.byId(id), s=t.solution;
    commissionAttempt = null;
    var v=ui.paint(root,
      ui.appbar({mode:'tasks',title:t.title,backArrow:true})+
      '<div class="panel" style="--accent:var(--tasks)">' +
        '<div class="qbox"><div class="muted" style="margin-bottom:8px">'+ui.esc(commission.groupTitle)+'</div>'+
          '<div class="question" style="margin:0">'+ui.esc(t.condition)+'</div></div>'+
        commissionScheme(t)+
        '<div class="task-inputs"><h4>Принятая методика</h4><ul>'+
          '<li>Дыхательный аппарат — Р-30.</li><li>Одна катушка связи — 800 м.</li>'+
          '<li>Промежуточный угол относится к ближайшему большему столбцу таблицы № 1.</li></ul></div>'+
        renderCommissionAnswers(s)+
        '<div class="actions"><button data-act="commissionBack">'+ui.I.prev+'К вариантам</button>'+
          '<div class="spacer"></div><button class="primary" style="--accent:var(--tests)" data-act="checkCommission">Проверить</button></div>'+
        VGSCH.feedback.button()+'</div>'+ui.tabbar('tasks'));
    VGSCH.router.setBackHandler(function(){renderCommissionPicker(root);return true;});
    ui.wireNav(v);
    VGSCH.feedback.wire(v,function(){return commissionContext(t);});
    ui.on(v,'[data-act="commissionBack"]',function(){renderCommissionPicker(root);});
    function checkCommission() {
      var items=[],valid=true;
      s.answers.forEach(function(a){
        var el=v.querySelector('[data-canswer="'+a.id+'"]'), raw=String(el.value||'').trim(), given,correct=false;
        var err=el.closest('.commission-field').querySelector('.field-error'); err.textContent='';
        if(raw===''){err.textContent='Заполните поле.';valid=false;items.push({answer:a,given:'',correct:false});return;}
        if(a.type==='choice'){given=raw==='1';correct=given===a.value;}
        else if(a.type==='time'){given=raw;correct=given===a.value;}
        else {given=parseFloat(raw.replace(',','.'));if(!isFinite(given)){err.textContent='Введите число.';valid=false;}else{var tol=a.decimals===0?0.5:0.15;correct=Math.abs(given-a.value)<=tol;}}
        items.push({answer:a,given:given,correct:correct});
      });
      if(!valid)return;
      commissionAttempt={items:items,correct:items.every(function(x){return x.correct;})};
      renderCommissionSolution(root,id,0);
    }
    ui.on(v,'[data-act="checkCommission"]',checkCommission);
    v.querySelectorAll('[data-canswer]').forEach(function(el){el.addEventListener('keydown',function(e){if(e.key==='Enter')checkCommission();});});
    /* Не ставим фокус автоматически: мобильный браузер прокручивал страницу
       к первому полю и скрывал условие задачи и верх схемы. */
  }

  function renderCommissionSolution(root,id,step) {
    var t=commission.byId(id), sol=t.solution, s=sol.steps[step];
    var attempt=commissionAttempt||{items:[],correct:false};
    var answerReview=attempt.items.map(function(x){var a=x.answer;var given=a.type==='choice'?(x.given?'Задание выполнимо':'Задание невыполнимо'):(a.type==='time'?x.given:units.fmt(x.given,a.decimals)+' '+a.unit);var right=a.type==='choice'?(a.value?'Задание выполнимо':'Задание невыполнимо'):(a.type==='time'?a.value:units.fmt(a.value,a.decimals)+' '+a.unit);return '<li class="'+(x.correct?'ok':'bad')+'"><b>'+ui.esc(a.label)+'</b><span>Ваш ответ: '+ui.esc(given)+' · правильно: '+ui.esc(right)+'</span></li>';}).join('');
    var v=ui.paint(root,
      ui.appbar({mode:'tasks',title:'Решение · '+t.title,backArrow:true})+
      ui.progress(step+1,sol.steps.length,'Шаг '+(step+1)+' из '+sol.steps.length,'var(--tasks)')+
      '<div class="panel" style="--accent:var(--tasks)">'+
        '<div class="verdict '+(attempt.correct?'ok':'bad')+'"><img class="verdict-photo" src="'+
          ui.asset('assets/img/rescuer-'+(attempt.correct?'ok':'wrong')+'.jpg')+'" alt=""><div><b>'+
          (attempt.correct?'Все ответы верны!':'Есть ошибки')+'</b><span class="txt">Ниже показана проверка каждого пункта и полный ход решения.</span></div></div>'+
        '<ul class="commission-review">'+answerReview+'</ul><div class="solve">'+
        '<div class="solve-nav">'+sol.steps.map(function(x,i){return '<button data-cstep="'+i+'"'+(i===step?' class="is-active"':'')+'><span class="n">'+(i+1)+'</span><span>'+ui.esc(x.label)+'</span></button>';}).join('')+'</div>'+
        '<div class="solve-body"><h4>'+(step+1)+'. '+ui.esc(s.label)+'</h4><div class="val">'+ui.esc(s.value)+'</div>'+
          '<div class="dt">'+ui.esc(s.detail||'')+'</div></div></div>'+
        '<div class="commission-answer">Итоговая проверка: <b>'+attempt.items.filter(function(x){return x.correct;}).length+' из '+sol.answers.length+' ответов верны</b></div>'+
        '<div class="muted" style="margin-top:14px">Основание: Устав ВГСЧ, пп. 22–23; приказ Ростехнадзора № 520, приложения № 6 и № 7; руководство по эксплуатации Р-30.</div>'+
        '<div class="actions"><button data-act="cprev"'+(step===0?' disabled':'')+'>'+ui.I.prev+'Назад</button><div class="spacer"></div>'+
          (step<sol.steps.length-1?'<button class="primary" style="--accent:var(--tests)" data-act="cnext">Далее'+ui.I.next+'</button>':'<button class="primary" style="--accent:var(--tests)" data-act="commissionList">К списку задач</button>')+'</div>'+
        VGSCH.feedback.button()+'</div>'+ui.tabbar('tasks'),{keepScroll:step>0});
    VGSCH.router.setBackHandler(function(){renderCommissionTask(root,id);return true;});
    ui.wireNav(v); VGSCH.feedback.wire(v,function(){return commissionContext(t);});
    ui.on(v,'[data-cstep]',function(b){renderCommissionSolution(root,id,parseInt(b.dataset.cstep,10));});
    ui.on(v,'[data-act="cprev"]',function(){renderCommissionSolution(root,id,step-1);});
    ui.on(v,'[data-act="cnext"]',function(){renderCommissionSolution(root,id,step+1);});
    ui.on(v,'[data-act="commissionList"]',function(){renderCommissionPicker(root);});
  }

  function implementedCount() {
    return types.enabled().filter(function (t) { return VGSCH.engine.generator.BUILDERS[t.id]; }).length;
  }

  /**
   * Контекст задачи для сообщения об ошибке. Помимо условия передаём seed:
   * по нему задача воспроизводится с теми же числами.
   */
  function taskContext(t, mode) {
    var ans = t.answer.type === 'numeric'
      ? units.fmt(t.answer.value, t.answer.decimals) + ' ' + t.answer.unit
      : t.answer.options.filter(function (o) { return o.value === t.answer.value; })[0].label;

    return {
      mode: mode, kind: 'Задача', id: t.task_id + ' (тип ' + t.type_id + ')',
      text: t.question,
      /* Каждая строка — «метка: значение»: так обращение читается
         в одной ячейке таблицы, куда его кладёт Google Форма. */
      extra: 'Ответ по расчёту: ' + ans + '\n' +
        'Основание: ' + t.normative_basis.map(function (b) { return b.document + ', ' + b.point; }).join('; ') + '\n' +
        'Зерно генерации: ' + t.seed + ' (воспроизводит задачу с теми же числами)\n' +
        'Ход решения: ' +
        t.solution_steps.map(function (s, i) {
          return (i + 1) + ') ' + s.label + ' = ' + s.value;
        }).join(' · ')
    };
  }

  /* ------------------------------------------------------------ задача --- */

  function nextTask(root) {
    var res;
    try {
      res = pipeline.produce(group);
    } catch (e) {
      var errView = ui.paint(root,
        ui.appbar({ mode: 'tasks', title: 'Задачи', backArrow: true }) +
        '<div class="panel"><div class="notice">Не удалось сгенерировать задачу: ' +
        ui.esc(e.message) + '</div>' +
        '<div class="actions"><button data-nav="start">' + ui.I.home + 'Главная</button></div></div>' +
        ui.tabbar('tasks'));
      ui.wireNav(errView);
      return;
    }
    current = { task: res.task, answered: false, correct: null, given: null };
    renderTask(root);
  }

  function renderTask(root) {
    var t = current.task;
    var type = types.byId(t.type_id);

    var v = ui.paint(root,
      ui.appbar({ mode: 'tasks', title: 'Задачи', backArrow: true }) +
      ui.progress(solved, solved + 1, 'Задача ' + (solved + 1) + ' · ' + type.title, 'var(--tasks)') +
      '<div class="panel" style="--accent:var(--tasks)">' +
        '<div class="qbox">' +
          '<div class="muted" style="margin-bottom:8px">' + ui.esc(t.category) +
            ' · сложность: ' + ui.esc(t.difficulty) + '</div>' +
          '<div class="question" style="margin:0">' + ui.esc(t.question) + '</div>' +
        '</div>' +
        (t.scheme && t.scheme.required
          ? '<div class="scheme-wrap">' + VGSCH.engine.scheme.render(t) + '</div>' : '') +
        renderInputs(t) +
        '<div id="answerArea">' + renderAnswerInput(t) + '</div>' +
        /* Кнопки идут раньше обращения об ошибке: главное действие не должно
           уезжать вниз за второстепенной кнопкой. */
        '<div class="actions">' +
          '<button data-act="picker">' + ui.I.prev + 'Назад</button>' +
          '<div class="spacer"></div>' +
          '<button id="check" class="primary" style="--accent:var(--tests)">Проверить</button>' +
        '</div>' +
        VGSCH.feedback.button() +
      '</div>' +
      ui.tabbar('tasks'));

    /* Из условия задачи стрелка возвращает к выбору группы. */
    VGSCH.router.setBackHandler(function () { renderPicker(root); return true; });
    ui.wireNav(v);
    VGSCH.feedback.wire(v, function () { return taskContext(t, 'Задачи'); });
    ui.on(v, '[data-act="picker"]', function () { renderPicker(root); });
    v.querySelector('#check').onclick = function () { check(root, v); };

    var inp = v.querySelector('#numAnswer');
    if (inp) {
      /* Поле получает фокус только по нажатию пользователя. Автофокус на
         телефоне переносил экран от условия сразу к середине задачи. */
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') check(root, v); });
    } else {
      ui.on(v, '.option', function (b) {
        v.querySelectorAll('.option').forEach(function (x) { x.classList.remove('is-picked'); });
        b.classList.add('is-picked');
      });
    }
  }

  /** Блок исходных данных — как в бумажной задаче (макет 03). */
  function renderInputs(t) {
    var rows = [];
    var i = t.inputs;

    if (i.initialPressureMPa !== undefined) {
      rows.push('Давление в баллоне ДА: ' + units.fmt(i.initialPressureMPa) + ' МПа');
      rows.push('Резервный запас: ' + units.fmt(i.reservePressureMPa) + ' МПа');
    }
    if (i.consumptionPer100mMPa !== undefined) {
      rows.push('Расход на 100 м пути: ' + units.fmt(i.consumptionPer100mMPa) + ' МПа');
    }
    if (i.segments && i.segments.length > 1) {
      i.segments.forEach(function (s, k) {
        rows.push('Участок ' + (k + 1) + ': ' + units.fmt(s.lengthM) + ' м, ' +
          (s.incline === 'горизонталь' ? 'горизонтальная выработка'
            : s.incline + ' ' + units.fmt(s.slopeDeg) + '°') +
          ', расход ' + units.fmt(s.consumptionMPa) + ' МПа');
      });
    }
    if (i.returnConsumptionMPa !== undefined) {
      rows.push('Расход на обратный путь: ' + units.fmt(i.returnConsumptionMPa) + ' МПа');
    }
    if (i.temperaturesC) {
      rows.push('Температура воздуха: ' +
        i.temperaturesC.map(function (v) { return units.fmt(v) + ' °C'; }).join(', '));
    }
    if (i.t0C !== undefined) {
      rows.push('Температура при входе: ' + units.fmt(i.t0C) + ' °C');
      rows.push('Температура через 5 минут: ' + units.fmt(i.t1C) + ' °C');
    }
    if (i.excavationHeightM !== undefined) {
      rows.push('Высота выработки: ' + units.fmt(i.excavationHeightM) + ' м');
      rows.push('Угол наклона: ' + units.fmt(i.slopeDeg) + '°');
      rows.push('Вид работы: ' + i.work);
      rows.push('Атмосфера: ' + i.atmosphere + ' для дыхания');
    }
    if (i.visibilityM !== undefined) rows.push('Расстояние видимости: ' + units.fmt(i.visibilityM) + ' м');
    if (i.routeLengthM !== undefined) rows.push('Длина маршрута: ' + units.fmt(i.routeLengthM) + ' м');

    if (!rows.length) return '';
    return '<div class="task-inputs"><h4>Исходные данные</h4><ul>' +
      rows.map(function (r) { return '<li>' + ui.esc(r) + '</li>'; }).join('') + '</ul></div>';
  }

  function renderAnswerInput(t) {
    if (t.answer.type === 'numeric') {
      return '<div class="field"><div class="muted" style="margin-bottom:8px">Введите ответ' +
        ' (' + ui.esc(t.answer.unit) + '), с точностью ' +
        ui.precision(t.answer.decimals) + ':</div>' +
        '<div class="answer-row">' +
          '<input type="text" id="numAnswer" inputmode="decimal" autocomplete="off" ' +
                 'placeholder="Числовое значение">' +
          '<span class="unit">' + ui.esc(t.answer.unit) + '</span>' +
        '</div><div class="field-error" id="ansError"></div></div>';
    }
    return '<div class="muted" style="margin:16px 0 8px">Выберите ответ:</div>' +
      '<div class="options">' +
        t.answer.options.map(function (o, i) {
          return '<button class="option" data-v="' + (o.value ? '1' : '0') + '" data-i="' + i + '">' +
            '<span class="marker"></span><span class="let">' + 'АБ'[i] + '.</span>' +
            '<span>' + ui.esc(o.label) + '</span></button>';
        }).join('') + '</div>';
  }

  /* ----------------------------------------------------------- проверка -- */

  function check(root, view) {
    if (current.answered) return;
    var t = current.task;
    var correct;

    if (t.answer.type === 'numeric') {
      var raw = String(view.querySelector('#numAnswer').value).trim().replace(',', '.');
      var num = parseFloat(raw);
      if (raw === '' || !isFinite(num)) {
        view.querySelector('#ansError').textContent = 'Введите числовое значение.';
        return;
      }
      view.querySelector('#ansError').textContent = '';
      var tol = t.tolerances.numeric_abs + 0.5 * Math.pow(10, -t.answer.decimals);
      correct = Math.abs(num - t.answer.value) <= tol;
      current.given = units.fmt(num, t.answer.decimals) + ' ' + t.answer.unit;
    } else {
      var picked = view.querySelector('.option.is-picked');
      if (!picked) {
        view.querySelector('#answerArea').insertAdjacentHTML('beforeend',
          '<div class="field-error">Выберите вариант ответа.</div>');
        return;
      }
      correct = (picked.dataset.v === '1') === t.answer.value;
      current.given = picked.textContent.trim();
    }

    current.answered = true;
    current.correct = correct;
    solved++;
    renderSolution(root, 0);
  }

  /* ---------------------------------------------- пошаговое решение (06) - */

  /**
   * @param keepScroll true при переходе между шагами одного решения:
   *        шапка и разбор ответа на месте, меняется только тело шага —
   *        поднимать страницу наверх не нужно, это только сбивает чтение.
   *        При первом открытии решения (после «Проверить») прокрутка
   *        сбрасывается, потому что экран меняется целиком.
   */
  function renderSolution(root, stepIndex, keepScroll) {
    var t = current.task;
    var steps = t.solution_steps;
    var s = steps[stepIndex];
    var answerText = t.answer.type === 'numeric'
      ? units.fmt(t.answer.value, t.answer.decimals) + ' ' + t.answer.unit
      : t.answer.options.filter(function (o) { return o.value === t.answer.value; })[0].label;

    var v = ui.paint(root, (
      ui.appbar({ mode: 'tasks', title: 'Решение задачи', backArrow: true }) +
      ui.progress(stepIndex + 1, steps.length,
                  'Шаг ' + (stepIndex + 1) + ' из ' + steps.length, 'var(--tasks)') +
      '<div class="panel" style="--accent:var(--tasks)">' +
        '<div class="verdict ' + (current.correct ? 'ok' : 'bad') + '">' +
          '<img class="verdict-photo" src="' +
            ui.asset('assets/img/rescuer-' + (current.correct ? 'ok' : 'wrong') + '.jpg') + '" alt="">' +
          '<div><b>' + (current.correct ? 'Верно!' : 'Неверно') + '</b>' +
            '<span class="txt">Ваш ответ: ' + ui.esc(current.given) + '<br>' +
            'Правильный ответ: <b style="display:inline">' + ui.esc(answerText) + '</b></span></div>' +
        '</div>' +

        '<div class="solve">' +
          '<div class="solve-nav">' +
            steps.map(function (st, i) {
              return '<button data-step="' + i + '"' + (i === stepIndex ? ' class="is-active"' : '') + '>' +
                '<span class="n">' + (i + 1) + '</span><span>' + ui.esc(st.label) + '</span></button>';
            }).join('') +
          '</div>' +
          '<div class="solve-body">' +
            '<h4>' + (stepIndex + 1) + '. ' + ui.esc(s.label) + '</h4>' +
            '<div class="val">' + ui.esc(s.value) + '</div>' +
            (s.detail ? '<div class="dt">' + ui.esc(s.detail) + '</div>' : '') +
            (s.point ? '<div class="pt">Основание: ' + ui.esc(s.point) + '</div>' : '') +
          '</div>' +
        '</div>' +

        '<div class="muted" style="margin-top:14px">Нормативное основание задачи: ' +
          t.normative_basis.map(function (b) { return ui.esc(b.document + ', ' + b.point); }).join('; ') +
        '</div>' +

        '<div class="actions">' +
          '<button data-act="prevStep"' + (stepIndex === 0 ? ' disabled' : '') + '>' +
            ui.I.prev + 'Назад</button>' +
          '<div class="spacer"></div>' +
          (stepIndex < steps.length - 1
            ? '<button class="primary" style="--accent:var(--tests)" data-act="nextStep">Далее' + ui.I.next + '</button>'
            : '<button class="primary" style="--accent:var(--tests)" data-act="nextTask">Следующая задача' + ui.I.next + '</button>') +
        '</div>' +

        VGSCH.feedback.button() +
      '</div>' +
      ui.tabbar('tasks')), { keepScroll: !!keepScroll });

    /* Из разбора решения — тоже к выбору группы: задача уже решена. */
    VGSCH.router.setBackHandler(function () { renderPicker(root); return true; });
    ui.wireNav(v);
    VGSCH.feedback.wire(v, function () { return taskContext(t, 'Задачи — решение'); });
    ui.on(v, '[data-step]', function (b) { renderSolution(root, parseInt(b.dataset.step, 10), true); });
    ui.on(v, '[data-act="prevStep"]', function () { renderSolution(root, stepIndex - 1, true); });
    ui.on(v, '[data-act="nextStep"]', function () { renderSolution(root, stepIndex + 1, true); });
    ui.on(v, '[data-act="nextTask"]', function () { nextTask(root); });
  }

  VGSCH.router.register('tasks', { render: render, destroy: function () { current = null; } });
})(window.VGSCH = window.VGSCH || {});
