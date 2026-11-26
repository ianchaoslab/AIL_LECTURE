// ===== 설정 =====
// 브라우저 저장소에서 메모를 보관하는 이름표입니다. (바꾸면 기존 메모가 안 보이니 주의!)
const STORAGE_KEY = "memos";

// ===== 화면 요소 가져오기 =====
const listEl = document.getElementById("memo-list");
const emptyMsgEl = document.getElementById("empty-msg");
const titleInput = document.getElementById("title-input");
const bodyInput = document.getElementById("body-input");
const saveBtn = document.getElementById("save-btn");
const deleteBtn = document.getElementById("delete-btn");
const newBtn = document.getElementById("new-btn");
const statusEl = document.getElementById("status");
const timeInfoEl = document.getElementById("time-info");

// ===== 상태 =====
let memos = loadMemos();   // 전체 메모 목록
let currentId = null;      // 지금 편집 중인 메모 id (null이면 새 메모)
let statusTimer = null;

// ===== 저장소 읽기/쓰기 =====
function loadMemos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return []; // 저장된 내용이 깨져 있어도 앱은 빈 목록으로 시작
  }
}

function saveMemos() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memos));
    return true;
  } catch (e) {
    showStatus("저장에 실패했어요. 브라우저 저장 공간을 확인해 주세요.");
    return false;
  }
}

// ===== 화면 그리기 =====
function formatTime(ms) {
  return new Date(ms).toLocaleString("ko-KR", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

function showStatus(message) {
  statusEl.textContent = message;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { statusEl.textContent = ""; }, 2500);
}

function renderList() {
  listEl.innerHTML = "";
  // 최근에 수정한 메모가 위로 오도록 정렬
  const sorted = [...memos].sort((a, b) => b.updatedAt - a.updatedAt);
  emptyMsgEl.hidden = sorted.length > 0;

  sorted.forEach((memo) => {
    const li = document.createElement("li");
    if (memo.id === currentId) li.classList.add("active");

    const title = document.createElement("div");
    title.className = "memo-title";
    title.textContent = memo.title || "(제목 없음)";   // textContent: 입력 글을 코드로 해석하지 않음

    const preview = document.createElement("div");
    preview.className = "memo-preview";
    preview.textContent = memo.body.replace(/\s+/g, " ") || "(내용 없음)";

    li.append(title, preview);
    li.addEventListener("click", () => selectMemo(memo.id));
    listEl.appendChild(li);
  });
}

function renderEditor() {
  const memo = memos.find((m) => m.id === currentId);
  titleInput.value = memo ? memo.title : "";
  bodyInput.value = memo ? memo.body : "";
  deleteBtn.hidden = !memo;   // 새 메모일 때는 삭제 버튼 숨김
  timeInfoEl.textContent = memo
    ? `만든 시각: ${formatTime(memo.createdAt)} · 수정: ${formatTime(memo.updatedAt)}`
    : "";}

// ===== 동작 =====
function selectMemo(id) {
  currentId = id;
  renderEditor();
  renderList();
}

function newMemo() {
  currentId = null;
  renderEditor();
  renderList();
  titleInput.focus();
}

function saveCurrent() {
  const title = titleInput.value.trim();
  const body = bodyInput.value;

  if (!title && !body.trim()) {
    showStatus("제목이나 내용을 입력해 주세요.");
    return;
  }

  const now = Date.now();
  const existing = memos.find((m) => m.id === currentId);

  if (existing) {
    existing.title = title;
    existing.body = body;
    existing.updatedAt = now;
  } else {
    const memo = { id: String(now) + Math.random().toString(36).slice(2, 6), title, body, createdAt: now, updatedAt: now };
    memos.push(memo);
    currentId = memo.id;
  }

  if (saveMemos()) {
    showStatus("저장했어요 ✅");
  }
  renderEditor();
  renderList();
}

function deleteCurrent() {
  if (!currentId) return;
  if (!confirm("이 메모를 삭제할까요? 되돌릴 수 없어요.")) return;

  memos = memos.filter((m) => m.id !== currentId);
  saveMemos();
  currentId = null;
  renderEditor();
  renderList();
  showStatus("삭제했어요");
}

// ===== 버튼 연결 =====
saveBtn.addEventListener("click", saveCurrent);
deleteBtn.addEventListener("click", deleteCurrent);
newBtn.addEventListener("click", newMemo);

// Ctrl+S / Cmd+S 로도 저장
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    saveCurrent();
  }
});

// ===== 시작 화면 =====
const startScreen = document.getElementById("start-screen");
const appEl = document.getElementById("app");
const startBtn = document.getElementById("start-btn");

function enterApp() {
  startScreen.hidden = true;
  appEl.hidden = false;
  try { sessionStorage.setItem("started", "1"); } catch (e) {}
  titleInput.focus();   // 시작하면 바로 입력 가능
}
startBtn.addEventListener("click", enterApp);

// ===== 시작 =====
renderList();
renderEditor();
// 같은 탭에서 새로고침한 경우에는 시작 화면을 건너뜀
let alreadyStarted = false;
try { alreadyStarted = sessionStorage.getItem("started") === "1"; } catch (e) {}
if (alreadyStarted) enterApp();
