// ===== 2단계: 할 일 + 캘린더 =====
// 메모 코드(app.js)와 이름이 겹치지 않도록 전체를 (function () { ... })(); 안에 넣었어요.
(function () {
  // ---------- 설정 ----------
  const TODO_KEY = "todos";     // 할 일을 보관하는 저장소 이름표
  const EVENT_KEY = "events";   // 일정을 보관하는 저장소 이름표
  const PRIORITY = {
    high:   { label: "높음", order: 0 },
    normal: { label: "보통", order: 1 },
    low:    { label: "낮음", order: 2 }
  };
  const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

  // ---------- 도우미 ----------
  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, "0");
  const newId = () => String(Date.now()) + Math.random().toString(36).slice(2, 6);
  // 날짜를 "2026-11-26" 형태 글자로 바꿈 (내 컴퓨터 시간 기준)
  const toYmd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const shortDate = (ymd) => { const p = ymd.split("-"); return `${Number(p[1])}/${Number(p[2])}`; };
  // 알림 시각(밀리초)을 "11/26 15:00" 형태로 바꿈
  const formatRemind = (ms) => {
    const d = new Date(ms);
    return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  function load(key) {
    try {
      const raw = localStorage.getItem(key);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  }
  function save(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      alert("저장에 실패했어요. 브라우저 저장 공간을 확인해 주세요.");
    }
  }

  let todos = load(TODO_KEY);
  let events = load(EVENT_KEY);

  // ---------- 탭 (메모 / 할 일 / 캘린더) ----------
  const views = { memo: $("view-memo"), todo: $("view-todo"), calendar: $("view-calendar") };

  function showView(name) {
    Object.keys(views).forEach((key) => { views[key].hidden = key !== name; });
    document.querySelectorAll(".tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === name);
    });
    $("new-btn").hidden = name !== "memo";   // "+ 새 메모"는 메모 화면에서만 보임
    if (name === "todo") renderTodos();
    if (name === "calendar") renderCalendar();
    try { sessionStorage.setItem("view", name); } catch (e) {}
  }
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => showView(btn.dataset.view));
  });

  // 할 일이나 일정이 바뀌면 두 화면을 모두 다시 그림
  function refresh() {
    renderTodos();
    renderCalendar();
  }

  // ---------- 할 일 ----------
  // 정렬: 안 끝난 것 먼저 → 마감일 빠른 순(마감일 없으면 뒤) → 중요도 → 만든 순
  function compareTodos(a, b) {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.dueDate !== b.dueDate) {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate < b.dueDate ? -1 : 1;
    }
    const pa = (PRIORITY[a.priority] || PRIORITY.normal).order;
    const pb = (PRIORITY[b.priority] || PRIORITY.normal).order;
    return pa - pb || a.createdAt - b.createdAt;
  }

  function makeBadge(text, className) {
    const span = document.createElement("span");
    span.className = "badge " + className;
    span.textContent = text;
    return span;
  }

  function deleteTodo(id) {
    if (!confirm("이 할 일을 삭제할까요? 되돌릴 수 없어요.")) return;
    todos = todos.filter((t) => t.id !== id);
    save(TODO_KEY, todos);
    refresh();
  }

  // 할 일 한 줄을 만듦 (할 일 화면과 캘린더 상세에서 같이 씀)
  function buildTodoItem(todo) {
    const li = document.createElement("li");
    li.className = "todo-item" + (todo.done ? " done" : "");

    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = todo.done;
    check.setAttribute("aria-label", "완료 체크");
    check.addEventListener("change", () => {
      todo.done = check.checked;
      save(TODO_KEY, todos);
      refresh();
    });

    const title = document.createElement("span");
    title.className = "todo-title";
    title.textContent = todo.title;   // textContent: 입력 글을 코드로 해석하지 않음

    li.append(check, title);

    if (todo.dueDate) {
      const overdue = !todo.done && todo.dueDate < toYmd(new Date());
      li.appendChild(makeBadge((overdue ? "지남 " : "마감 ") + shortDate(todo.dueDate), overdue ? "overdue" : ""));
    }
    if (todo.remindAt) li.appendChild(makeBadge("🔔 " + formatRemind(todo.remindAt), ""));
    const prio = PRIORITY[todo.priority] || PRIORITY.normal;
    li.appendChild(makeBadge(prio.label, "prio-" + (PRIORITY[todo.priority] ? todo.priority : "normal")));

    const del = document.createElement("button");
    del.type = "button";
    del.className = "mini-btn danger";
    del.textContent = "삭제";
    del.addEventListener("click", () => deleteTodo(todo.id));
    li.appendChild(del);
    return li;
  }

  function renderTodos() {
    const list = $("todo-list");
    list.innerHTML = "";
    const sorted = [...todos].sort(compareTodos);
    $("todo-empty").hidden = sorted.length > 0;
    sorted.forEach((todo) => list.appendChild(buildTodoItem(todo)));
  }

  // 할 일 하나를 저장함
  function addTodo(data) {
    const todo = {
      id: newId(),
      title: data.title,
      done: false,
      dueDate: data.dueDate || "",                       // 비어 있으면 마감일 없음
      priority: PRIORITY[data.priority] ? data.priority : "normal",
      remindAt: data.remindAt || null,                   // 알림 시각(밀리초), 없으면 null
      reminded: false,                                   // 알림을 이미 울렸는지
      createdAt: Date.now()
    };
    todos.push(todo);
    save(TODO_KEY, todos);
    refresh();
    checkReminders();
    return todo;
  }

  $("todo-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const title = $("todo-title").value.trim();
    if (!title) return;
    const remindValue = $("todo-remind").value;
    const remindAt = remindValue ? new Date(remindValue).getTime() : null;
    addTodo({
      title,
      dueDate: $("todo-due").value,
      priority: $("todo-priority").value,
      remindAt: Number.isNaN(remindAt) ? null : remindAt
    });
    $("todo-title").value = "";
    $("todo-due").value = "";
    $("todo-remind").value = "";
    $("todo-priority").value = "normal";
    $("todo-title").focus();
  });

  // ---------- 캘린더 ----------
  const today = new Date();
  let calYear = today.getFullYear();
  let calMonth = today.getMonth();   // 0 = 1월
  let selected = toYmd(today);       // 선택한 날짜

  const eventsOn = (ymd) => events.filter((e) => e.date === ymd).sort((a, b) => (a.start < b.start ? -1 : 1));
  const todosOn = (ymd) => todos.filter((t) => t.dueDate === ymd).sort(compareTodos);

  function makeChip(kind, text, done) {
    const chip = document.createElement("span");
    chip.className = "chip " + kind + (done ? " done" : "");
    chip.textContent = text;
    return chip;
  }

  function renderCalendar() {
    $("cal-title").textContent = `${calYear}년 ${calMonth + 1}월`;

    const grid = $("cal-grid");
    grid.innerHTML = "";
    WEEKDAYS.forEach((name, i) => {
      const dow = document.createElement("div");
      dow.className = "cal-dow" + (i === 0 ? " sun" : i === 6 ? " sat" : "");
      dow.textContent = name;
      grid.appendChild(dow);
    });

    const firstDow = new Date(calYear, calMonth, 1).getDay();
    const lastDay = new Date(calYear, calMonth + 1, 0).getDate();
    const todayYmd = toYmd(new Date());

    for (let i = 0; i < firstDow; i++) grid.appendChild(document.createElement("div"));  // 앞쪽 빈칸

    for (let day = 1; day <= lastDay; day++) {
      const ymd = `${calYear}-${pad(calMonth + 1)}-${pad(day)}`;
      const dow = (firstDow + day - 1) % 7;
      const dayEvents = eventsOn(ymd);
      const dayTodos = todosOn(ymd);

      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cal-cell" + (dow === 0 ? " sun" : dow === 6 ? " sat" : "") +
        (ymd === todayYmd ? " today" : "") + (ymd === selected ? " selected" : "");
      cell.setAttribute("aria-label", `${calMonth + 1}월 ${day}일, 일정 ${dayEvents.length}개, 마감 할 일 ${dayTodos.length}개`);

      const num = document.createElement("span");
      num.className = "cal-num";
      num.textContent = day;
      cell.appendChild(num);

      const items = [
        ...dayEvents.map((e) => ({ kind: "event", text: `${e.start} ${e.title}`, done: false })),
        ...dayTodos.map((t) => ({ kind: "todo", text: `☑ ${t.title}`, done: t.done }))
      ];
      if (items.length > 0) {
        const chips = document.createElement("div");
        chips.className = "chips";
        items.slice(0, 3).forEach((it) => chips.appendChild(makeChip(it.kind, it.text, it.done)));
        if (items.length > 3) {
          const more = document.createElement("span");
          more.className = "chip-more";
          more.textContent = `+${items.length - 3}개`;
          chips.appendChild(more);
        }
        cell.appendChild(chips);
      }

      cell.addEventListener("click", () => {
        selected = ymd;
        renderCalendar();
      });
      grid.appendChild(cell);
    }
    renderDay();
  }

  function addEmptyLine(list, text) {
    const li = document.createElement("li");
    li.className = "item-empty";
    li.textContent = text;
    list.appendChild(li);
  }

  // 선택한 날짜의 일정·마감 할 일 목록
  function renderDay() {
    const p = selected.split("-").map(Number);
    $("cal-day-title").textContent = `${p[1]}월 ${p[2]}일 (${WEEKDAYS[new Date(p[0], p[1] - 1, p[2]).getDay()]})`;

    const eventList = $("day-events");
    eventList.innerHTML = "";
    const dayEvents = eventsOn(selected);
    if (dayEvents.length === 0) addEmptyLine(eventList, "이 날의 일정이 없어요.");
    dayEvents.forEach((ev) => {
      const li = document.createElement("li");
      li.className = "event-item";

      const time = document.createElement("span");
      time.className = "badge";
      time.textContent = ev.end ? `${ev.start}–${ev.end}` : ev.start;

      const title = document.createElement("span");
      title.className = "event-title-text";
      title.textContent = ev.title;

      const del = document.createElement("button");
      del.type = "button";
      del.className = "mini-btn danger";
      del.textContent = "삭제";
      del.addEventListener("click", () => {
        if (!confirm("이 일정을 삭제할까요? 되돌릴 수 없어요.")) return;
        events = events.filter((e) => e.id !== ev.id);
        save(EVENT_KEY, events);
        refresh();
      });

      li.append(time, title);
      if (ev.remindAt) li.appendChild(makeBadge("🔔 " + formatRemind(ev.remindAt), ""));
      li.appendChild(del);
      eventList.appendChild(li);
    });

    const todoList = $("day-todos");
    todoList.innerHTML = "";
    const dayTodos = todosOn(selected);
    if (dayTodos.length === 0) addEmptyLine(todoList, "이 날 마감인 할 일이 없어요.");
    dayTodos.forEach((todo) => todoList.appendChild(buildTodoItem(todo)));
  }

  // 달 이동: 이동한 달에 오늘이 있으면 오늘, 아니면 1일을 선택
  function moveMonth(delta) {
    const d = new Date(calYear, calMonth + delta, 1);
    calYear = d.getFullYear();
    calMonth = d.getMonth();
    const now = new Date();
    selected = (calYear === now.getFullYear() && calMonth === now.getMonth())
      ? toYmd(now)
      : `${calYear}-${pad(calMonth + 1)}-01`;
    renderCalendar();
  }
  $("cal-prev").addEventListener("click", () => moveMonth(-1));
  $("cal-next").addEventListener("click", () => moveMonth(1));
  $("cal-today").addEventListener("click", () => {
    const now = new Date();
    calYear = now.getFullYear();
    calMonth = now.getMonth();
    selected = toYmd(now);
    renderCalendar();
  });

  $("event-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const title = $("event-title").value.trim();
    const start = $("event-start").value;
    const end = $("event-end").value;
    if (!title || !start) return;
    if (end && end <= start) {
      alert("종료 시각은 시작 시각보다 늦어야 해요.");
      return;
    }
    // 알림: 시작 시각에서 고른 분만큼 앞으로 당긴 시각
    const offset = $("event-remind").value;
    let remindAt = null;
    if (offset !== "") {
      const ymd = selected.split("-").map(Number);
      const hm = start.split(":").map(Number);
      remindAt = new Date(ymd[0], ymd[1] - 1, ymd[2], hm[0], hm[1]).getTime() - Number(offset) * 60000;
    }
    events.push({ id: newId(), title, date: selected, start, end, remindAt, reminded: false, createdAt: Date.now() });
    save(EVENT_KEY, events);
    $("event-title").value = "";
    $("event-start").value = "";
    $("event-end").value = "";
    $("event-remind").value = "";
    $("event-title").focus();
    refresh();
    checkReminders();
  });

  // ---------- 알림 (3단계) ----------
  const SETTINGS_KEY = "settings";
  const CHECK_EVERY_MS = 15000;          // 15초마다 알림 시각이 됐는지 확인
  const LATE_AFTER_MS = 2 * 60 * 1000;   // 2분 넘게 지났으면 "놓친 알림"으로 표시

  let settings = {};
  try { settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") || {}; } catch (err) { settings = {}; }
  if (typeof settings.notify !== "boolean") settings.notify = true;   // 처음에는 켜 둠
  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (err) {}
  }

  // 화면 안 알림(토스트)
  function showToast(title, body) {
    const box = document.createElement("div");
    box.className = "toast";
    box.setAttribute("role", "alert");
    const strong = document.createElement("strong");
    strong.textContent = title;
    const text = document.createElement("span");
    text.textContent = body;
    const close = document.createElement("button");
    close.type = "button";
    close.className = "mini-btn";
    close.textContent = "확인";
    close.addEventListener("click", () => box.remove());
    box.append(strong, text, close);
    $("toasts").appendChild(box);
  }

  // 브라우저 알림 (사용자가 허용한 경우에만)
  function browserNotify(title, body) {
    try {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body: body });
      }
    } catch (err) {}
  }

  function fireReminder(kind, name, remindAt, now) {
    const late = now - remindAt > LATE_AFTER_MS;
    const title = (late ? "놓친 알림 · " : "알림 · ") + kind;
    const body = late ? `${name} (${formatRemind(remindAt)})` : name;
    showToast(title, body);
    browserNotify(title, body);
  }

  // 알림 시각이 지난 항목을 찾아서 알림
  function checkReminders() {
    if (!settings.notify) return;   // 꺼 두면 울리지 않고, 다시 켜면 놓친 알림으로 알려 줌
    const now = Date.now();
    let todoChanged = false;
    let eventChanged = false;

    todos.forEach((t) => {
      if (!t.remindAt || t.reminded || t.remindAt > now) return;
      t.reminded = true;
      todoChanged = true;
      if (!t.done) fireReminder("할 일", t.title, t.remindAt, now);   // 이미 끝낸 할 일은 조용히 넘김
    });
    events.forEach((ev) => {
      if (!ev.remindAt || ev.reminded || ev.remindAt > now) return;
      ev.reminded = true;
      eventChanged = true;
      fireReminder("일정", `${ev.start} ${ev.title}`, ev.remindAt, now);
    });

    if (todoChanged) save(TODO_KEY, todos);
    if (eventChanged) save(EVENT_KEY, events);
  }

  // 알림 켜기/끄기 스위치
  const notifyToggle = $("notify-toggle");
  const notifyNote = $("notify-note");
  function updateNotifyNote() {
    let message = "";
    if (settings.notify && "Notification" in window && Notification.permission === "denied") {
      message = "브라우저 알림이 막혀 있어서 화면 안 알림만 표시돼요.";
    } else if (!settings.notify) {
      message = "알림이 꺼져 있어요. 켜면 그동안 지난 알림을 한꺼번에 알려 줘요.";
    }
    notifyNote.textContent = message;
    notifyNote.hidden = !message;
  }
  notifyToggle.checked = settings.notify;
  notifyToggle.addEventListener("change", () => {
    settings.notify = notifyToggle.checked;
    saveSettings();
    if (settings.notify && "Notification" in window && Notification.permission === "default") {
      try {
        // 브라우저가 "알림을 허용할까요?" 하고 물어봐요. 허용 안 해도 화면 안 알림은 동작함
        Notification.requestPermission().then(updateNotifyNote);
      } catch (err) {}
    }
    updateNotifyNote();
    checkReminders();
  });
  updateNotifyNote();

  setInterval(checkReminders, CHECK_EVERY_MS);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) checkReminders(); });

  // ---------- 시작 ----------
  checkReminders();
  // 같은 탭에서 새로고침하면 보고 있던 화면을 유지함
  let startView = "memo";
  try { startView = sessionStorage.getItem("view") || "memo"; } catch (err) {}
  showView(views[startView] ? startView : "memo");
})();
