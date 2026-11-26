// ===== 4단계: AI 메모 요약 + 5단계: 요약에서 할 일 만들기 =====
// 서버(/api/summarize)에 메모를 보내 요약을 받아 오고, 결과를 화면에 보여 줘요.
// 원본 메모는 바꾸지 않고, 요약은 "summaries" 저장소에 따로 보관합니다.
(function () {
  const SUMMARY_KEY = "summaries";
  const MAX_CHARS = 4000;   // 서버(api/summarize.js)의 MAX_INPUT_CHARS와 같게 맞춰 두세요
  const ERROR_MESSAGE = "잠시 후 다시 시도해 주세요.";

  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, "0");
  const toYmd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const shortDate = (ymd) => { const p = ymd.split("-"); return `${Number(p[1])}/${Number(p[2])}`; };

  // 화면 요소를 만드는 도우미 (textContent만 써서 AI가 준 글이 코드로 실행되지 않게 함)
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // ---------- 저장된 요약 ----------
  function loadSummaries() {
    try {
      const data = JSON.parse(localStorage.getItem(SUMMARY_KEY) || "[]");
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  }
  let summaries = loadSummaries();
  function saveSummaries() {
    try {
      localStorage.setItem(SUMMARY_KEY, JSON.stringify(summaries));
      return true;
    } catch (e) {
      setStatus("요약을 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.");
      return false;
    }
  }

  // ---------- 상태 ----------
  let draft = null;     // 아직 저장하지 않은 요약 결과: { memoId, data }
  let busy = false;     // 요약 요청 중인지
  let statusTimer = null;

  const statusEl = $("ai-status");
  const resultEl = $("ai-result");
  const summarizeBtn = $("summarize-btn");

  function setStatus(message, keep) {
    statusEl.textContent = message;
    clearTimeout(statusTimer);
    if (message && !keep) statusTimer = setTimeout(() => { statusEl.textContent = ""; }, 4000);
  }

  function isValidResult(d) {
    return d && typeof d.summary === "string" && Array.isArray(d.points) && Array.isArray(d.todos) && Array.isArray(d.dates);
  }

  // ---------- 요약 요청 ----------
  async function summarize() {
    if (busy) return;
    const title = $("title-input").value.trim();
    const body = $("body-input").value;
    if (!title && !body.trim()) {
      setStatus("요약할 내용을 먼저 적어 주세요.");
      return;
    }
    if (title.length + body.length > MAX_CHARS) {
      setStatus(`메모가 너무 길어요. ${MAX_CHARS}자 이하로 줄여 주세요.`);
      return;
    }
    if (!currentId) saveCurrent();      // 새 메모라면 먼저 저장해서 요약을 연결함 (app.js의 함수)
    const memoId = currentId;
    if (!memoId) return;

    busy = true;
    summarizeBtn.disabled = true;
    setStatus("요약 중...", true);
    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title, body: body, today: toYmd(new Date()) })
      });
      if (!response.ok) {
        const err = new Error("http " + response.status);
        err.status = response.status;
        throw err;
      }
      const data = await response.json();
      if (!isValidResult(data)) throw new Error("bad shape");
      draft = { memoId: memoId, data: data };
      setStatus("");
    } catch (e) {
      if (e && e.status === 429) {
        setStatus("요청이 너무 많아요. " + ERROR_MESSAGE);
      } else if (e && e.status === 413) {
        setStatus(`메모가 너무 길어요. ${MAX_CHARS}자 이하로 줄여 주세요.`);
      } else if (e && (e.status === 404 || e.status === 405 || e.status === 501)) {
        // 내 컴퓨터의 간단한 서버(localhost)에는 AI 서버 기능이 없어요
        setStatus(ERROR_MESSAGE + " (이 주소에는 AI 서버가 없어요. 배포된 주소에서 사용해 주세요.)", true);
      } else {
        setStatus(ERROR_MESSAGE, true);
      }
    } finally {
      busy = false;
      summarizeBtn.disabled = false;
      render();
    }
  }

  // ---------- 결과 그리기 ----------
  function latestSaved(memoId) {
    return summaries.find((s) => s.memoId === memoId) || null;
  }

  // 요약에서 찾은 할 일 한 줄: 제목·마감일·알림을 고칠 수 있고, "할 일로 추가"를 눌러야만 저장됨
  function buildTodoRow(holder, index, memoId, persist) {
    const item = holder.todos[index];
    const row = el("li", "ai-todo");

    const title = el("input");
    title.type = "text";
    title.value = item.title;
    title.maxLength = 100;
    title.setAttribute("aria-label", "할 일 제목");

    const dueLabel = el("label", "", "마감일 ");
    const due = el("input");
    due.type = "date";
    due.value = item.due || "";
    dueLabel.appendChild(due);

    const remindLabel = el("label", "", "알림 ");
    const remind = el("input");
    remind.type = "datetime-local";
    remindLabel.appendChild(remind);

    const btn = el("button", "mini-btn primary", "할 일로 추가");
    btn.type = "button";

    function markAdded() {
      row.classList.add("added");
      title.disabled = due.disabled = remind.disabled = btn.disabled = true;
      btn.textContent = "추가됨 ✓";
    }
    row.addTodo = function () {
      const text = title.value.trim();
      if (!text) { setStatus("할 일 제목을 입력해 주세요."); return false; }
      const ms = remind.value ? new Date(remind.value).getTime() : null;
      window.Planner.addTodo({
        title: text,
        dueDate: due.value,
        remindAt: Number.isNaN(ms) ? null : ms,
        memoId: memoId
      });
      holder.added = holder.added || [];
      holder.added.push(index);
      persist();
      markAdded();
      return true;
    };
    btn.addEventListener("click", () => {
      if (row.addTodo()) setStatus("할 일에 추가했어요 ✅ (할 일·캘린더 탭에서 볼 수 있어요)");
    });

    if ((holder.added || []).indexOf(index) >= 0) markAdded();
    row.append(title, dueLabel, remindLabel, btn);
    return row;
  }

  function renderResult(holder, mode, memoId) {
    const box = el("div", "ai-box");
    const persist = mode === "saved" ? saveSummaries : function () {};

    box.appendChild(el("h4", "", mode === "saved" ? "✨ 저장된 요약" : "✨ 요약 결과 (아직 저장 전)"));
    box.appendChild(el("p", "ai-summary", holder.summary));

    if (holder.points.length > 0) {
      box.appendChild(el("h5", "", "핵심 내용"));
      const ul = el("ul");
      holder.points.forEach((p) => ul.appendChild(el("li", "", p)));
      box.appendChild(ul);
    }

    box.appendChild(el("h5", "", "발견한 할 일"));
    if (holder.todos.length === 0) {
      box.appendChild(el("p", "item-empty", "메모에서 찾은 할 일이 없어요."));
    } else {
      box.appendChild(el("p", "hint", "AI가 읽은 날짜는 틀릴 수 있어요. 마감일과 알림을 확인하고 고친 뒤에 추가하세요."));
      const list = el("ul", "plain");
      const rows = holder.todos.map((_, i) => buildTodoRow(holder, i, memoId, persist));
      rows.forEach((r) => list.appendChild(r));
      box.appendChild(list);

      if (holder.todos.length > 1) {
        const all = el("button", "mini-btn", "남은 할 일 모두 추가");
        all.type = "button";
        all.addEventListener("click", () => {
          const pending = rows.filter((r) => !r.classList.contains("added"));
          if (pending.length === 0) return;
          if (!confirm(`화면에 보이는 제목·마감일·알림으로 ${pending.length}개를 할 일에 추가할까요?`)) return;
          let count = 0;
          pending.forEach((r) => { if (r.addTodo()) count++; });
          if (count > 0) setStatus(`할 일 ${count}개를 추가했어요 ✅`);
        });
        box.appendChild(all);
      }
    }

    if (holder.dates.length > 0) {
      box.appendChild(el("h5", "", "발견한 날짜"));
      const ul = el("ul");
      holder.dates.forEach((d) => ul.appendChild(el("li", "", d.date ? `${d.text} → ${shortDate(d.date)}` : d.text)));
      box.appendChild(ul);
    }

    const actions = el("div", "ai-actions");
    if (mode === "draft") {
      const save = el("button", "primary", "저장");
      save.type = "button";
      save.addEventListener("click", () => saveDraft());
      const discard = el("button", "", "버리기");
      discard.type = "button";
      discard.addEventListener("click", () => { draft = null; render(); });
      actions.append(save);
      actions.append(retryButton());
      actions.append(discard);
    } else {
      actions.append(retryButton());
      const remove = el("button", "danger", "요약 삭제");
      remove.type = "button";
      remove.addEventListener("click", () => {
        if (!confirm("저장된 요약을 삭제할까요? 원본 메모는 그대로 남아요.")) return;
        summaries = summaries.filter((s) => s.memoId !== memoId);
        saveSummaries();
        render();
      });
      actions.append(remove);
    }
    box.appendChild(actions);
    return box;
  }

  function retryButton() {
    const again = el("button", "", "다시 요약");
    again.type = "button";
    again.addEventListener("click", summarize);
    return again;
  }

  function saveDraft() {
    if (!draft) return;
    const data = draft.data;
    summaries = summaries.filter((s) => s.memoId !== draft.memoId);   // 메모마다 요약 1개만 보관
    summaries.push({
      id: String(Date.now()) + Math.random().toString(36).slice(2, 6),
      memoId: draft.memoId,
      summary: data.summary,
      points: data.points,
      todos: data.todos,
      dates: data.dates,
      added: data.added || [],
      createdAt: Date.now()
    });
    if (saveSummaries()) {
      draft = null;
      setStatus("요약을 저장했어요 ✅");
    }
    render();
  }

  function render() {
    resultEl.innerHTML = "";
    const memoId = currentId;   // app.js에서 지금 보고 있는 메모 id
    summarizeBtn.disabled = busy;
    if (draft && draft.memoId === memoId && memoId) {
      resultEl.appendChild(renderResult(draft.data, "draft", memoId));
      return;
    }
    const saved = memoId ? latestSaved(memoId) : null;
    if (saved) resultEl.appendChild(renderResult(saved, "saved", memoId));
  }

  summarizeBtn.addEventListener("click", summarize);

  // app.js가 메모를 바꾸거나 지울 때 불러 주는 함수
  window.onMemoChanged = render;
  window.onMemoDeleted = function (memoId) {
    summaries = summaries.filter((s) => s.memoId !== memoId);
    saveSummaries();
    if (draft && draft.memoId === memoId) draft = null;
    render();
  };

  render();
})();
