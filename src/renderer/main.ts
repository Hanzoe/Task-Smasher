import './style.css';
import Vditor from 'vditor';
import 'vditor/dist/index.css';

interface Todo {
  id: string;
  text: string;
  detailsMarkdown?: string;
  completed: boolean; // legacy
  completedDates?: string[]; // array of YYYY-MM-DD
  createdAt: string;
  completedAt?: string;
  imageUrl?: string;
  quadrant: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
}

let todos: Todo[] = [];
let dailyNotes: Record<string, string> = {};
let isMiniMode = false;
let activeDetailTodoId: string | null = null;
let vditorInstance: Vditor | null = null;

// Global Views
let currentViewDate = getLocalISODate(new Date()); 
let pendingImagePath: string | null = null; 
let currentMonthOffset = 0; // 0 is current month, -1 is prev, 1 is next

function getLocalISODate(date: Date) {
  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - (offset*60*1000))
  return localDate.toISOString().split('T')[0]
}

// Setup UI structure
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="titlebar">
    <div class="titlebar-title">Task Smasher</div>
    <div class="actions">
      <button class="action-btn" id="btn-mini" title="Toggle Sticky Note Mode">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8h16M4 16h16"/></svg>
      </button>
      <button class="action-btn" id="btn-minimize" title="Minimize">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/></svg>
      </button>
      <button class="action-btn close" id="btn-close" title="Close">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
  </div>
  <div class="content auto-scroll">
    <!-- View 1: Calendar Grid -->
    <div id="view-calendar" class="view-panel active">
      <div class="calendar-header">
        <button id="btn-prev-month" class="icon-btn">&lt;</button>
        <h2 id="calendar-month-title">Month YYYY</h2>
        <button id="btn-next-month" class="icon-btn">&gt;</button>
      </div>
      <div class="calendar-weekdays">
        <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
      </div>
      <!-- Monthly Stats Bar -->
      <div id="calendar-stats" class="calendar-stats">
        <div class="stat-card" id="stat-total">
          <span class="stat-value">0</span>
          <span class="stat-label">This Month</span>
        </div>
        <div class="stat-card" id="stat-done">
          <span class="stat-value">0%</span>
          <span class="stat-label">Completed</span>
        </div>
        <div class="stat-card" id="stat-streak">
          <span class="stat-value">0 🔥</span>
          <span class="stat-label">Day Streak</span>
        </div>
        <div class="stat-card" id="stat-best-day">
          <span class="stat-value">—</span>
          <span class="stat-label">Best Day</span>
        </div>
      </div>
      <div id="calendar-grid" class="calendar-grid">
        <!-- Rendered via JS -->
      </div>
    </div>

    <!-- View 2: Daily Details & Matrix -->
    <div id="view-detail" class="view-panel">
      <div class="header-section">
        <div class="date-controls">
          <button id="btn-back-calendar" class="date-btn" style="padding: 6px 8px; margin-right: 8px;">&larr; Back</button>
          <span id="detail-date-title" style="font-weight: 600; margin-left:8px;">YYYY-MM-DD</span>
        </div>
        <div class="summary" id="daily-summary">0 Tasks</div>
      </div>
      
      <!-- Global Image Upload (hidden button triggered by context) -->
      <input type="file" id="image-input" accept="image/*" style="display:none" />
      <div id="preview-container" class="preview-container" style="display:none; margin-bottom: 8px;">
         <img id="image-preview" class="preview-image" src="" />
         <button type="button" id="btn-clear-image" class="btn-clear-image">&times;</button>
         <span style="font-size: 0.8rem; color: var(--text-muted); align-self: center;">Image staged for next task</span>
      </div>

      <!-- Mini Mode Quick Add -->
      <form id="mini-mode-add-form" class="mini-mode-add-form">
        <select id="mini-quadrant-select" title="Priority">
          <option value="Q1">🔴</option>
          <option value="Q2" selected>🟡</option>
          <option value="Q3">🔵</option>
          <option value="Q4">⚪</option>
        </select>
        <input type="text" id="mini-add-input" placeholder="Quick add task..." required autocomplete="off"/>
        <button type="submit" title="Add Task">+</button>
      </form>

      <!-- Eisenhower Matrix Grid -->
      <div class="matrix-container" id="matrix-container">
        
        <div class="quadrant quadrant-q1" data-quadrant="Q1">
           <div class="quadrant-header">🔴 Urgent & Important</div>
           <ul class="todo-list" id="todo-list-q1"></ul>
           <form class="inline-add-form" data-target="Q1">
             <input type="text" placeholder="Add task..." required autocomplete="off"/>
             <button type="submit" title="Add Task">+</button>
           </form>
        </div>
        
        <div class="quadrant quadrant-q2" data-quadrant="Q2">
           <div class="quadrant-header">🟡 Important, Not Urgent</div>
           <ul class="todo-list" id="todo-list-q2"></ul>
           <form class="inline-add-form" data-target="Q2">
             <input type="text" placeholder="Add task..." required autocomplete="off"/>
             <button type="submit" title="Add Task">+</button>
           </form>
        </div>
        
        <div class="quadrant quadrant-q3" data-quadrant="Q3">
           <div class="quadrant-header">🔵 Urgent, Not Important</div>
           <ul class="todo-list" id="todo-list-q3"></ul>
           <form class="inline-add-form" data-target="Q3">
             <input type="text" placeholder="Add task..." required autocomplete="off"/>
             <button type="submit" title="Add Task">+</button>
           </form>
        </div>
        
        <div class="quadrant quadrant-q4" data-quadrant="Q4">
           <div class="quadrant-header">⚪ Neither</div>
           <ul class="todo-list" id="todo-list-q4"></ul>
           <form class="inline-add-form" data-target="Q4">
             <input type="text" placeholder="Add task..." required autocomplete="off"/>
             <button type="submit" title="Add Task">+</button>
           </form>
        </div>
        
      </div>

      <div class="daily-thoughts-container">
         <h3>📝 Daily Thoughts</h3>
         <textarea id="daily-thoughts-input" class="daily-thoughts-input" placeholder="Jot down some thoughts about today..."></textarea>
      </div>
      
    </div>
  </div>

  <!-- Task Detail Modal -->
  <div id="task-detail-backdrop" class="task-detail-backdrop">
    <div id="task-detail-panel" class="task-detail-panel">
      <div class="detail-panel-header">
        <input type="text" class="detail-title-input" id="detail-panel-title" placeholder="Task title..." />
        <button class="action-btn" id="btn-close-detail" title="Close Panel">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="detail-panel-controls">
         <select id="detail-recurrence" title="Recurrence">
            <option value="none">🔁 None</option>
            <option value="daily">🔁 Daily</option>
            <option value="weekly">🔁 Weekly</option>
            <option value="monthly">🔁 Monthly</option>
         </select>
         <input type="date" id="detail-date" title="Move Date" />
      </div>
      <div class="detail-panel-body">
        <div id="vditor-container"></div>
      </div>
    </div>
  </div>

  <!-- Global Image Zoom Overlay -->
  <div id="image-zoom-overlay" class="image-zoom-overlay">
    <button class="close-zoom-btn">&times;</button>
    <img id="zoomed-image" class="zoomed-image" src="" />
  </div>
`;

// Element References
const viewCalendar = document.getElementById('view-calendar') as HTMLDivElement;
const viewDetail = document.getElementById('view-detail') as HTMLDivElement;

const taskDetailBackdrop = document.getElementById('task-detail-backdrop') as HTMLDivElement;
const taskDetailPanel = document.getElementById('task-detail-panel') as HTMLDivElement;
const btnCloseDetail = document.getElementById('btn-close-detail') as HTMLButtonElement;
const detailPanelTitle = document.getElementById('detail-panel-title') as HTMLInputElement;
const detailRecurrence = document.getElementById('detail-recurrence') as HTMLSelectElement;
const detailDate = document.getElementById('detail-date') as HTMLInputElement;

function openDetailModal() {
  taskDetailBackdrop.classList.add('open');
}
function closeDetailModal() {
  taskDetailBackdrop.classList.remove('open');
}

const listQ1 = document.getElementById('todo-list-q1') as HTMLUListElement;
const listQ2 = document.getElementById('todo-list-q2') as HTMLUListElement;
const listQ3 = document.getElementById('todo-list-q3') as HTMLUListElement;
const listQ4 = document.getElementById('todo-list-q4') as HTMLUListElement;
const dailySummary = document.getElementById('daily-summary') as HTMLDivElement;
const dailyThoughtsInput = document.getElementById('daily-thoughts-input') as HTMLTextAreaElement;

const btnMini = document.getElementById('btn-mini');
const btnMinimize = document.getElementById('btn-minimize');
const btnClose = document.getElementById('btn-close');

// Calendar Controls
const btnPrevMonth = document.getElementById('btn-prev-month') as HTMLButtonElement;
const btnNextMonth = document.getElementById('btn-next-month') as HTMLButtonElement;
const monthTitle = document.getElementById('calendar-month-title') as HTMLHeadingElement;
const calendarGrid = document.getElementById('calendar-grid') as HTMLDivElement;

// Detail Controls
const btnBackCalendar = document.getElementById('btn-back-calendar') as HTMLButtonElement;
const detailDateTitle = document.getElementById('detail-date-title') as HTMLSpanElement;

const imageInput = document.getElementById('image-input') as HTMLInputElement;
// Note: We'll now capture images globally from clipboard instead of a dedicated button, 
// but clicking the container can also trigger it if needed.
const previewContainer = document.getElementById('preview-container') as HTMLDivElement;
const imagePreview = document.getElementById('image-preview') as HTMLImageElement;
const btnClearImage = document.getElementById('btn-clear-image') as HTMLButtonElement;

// Zoom Overlay
const zoomOverlay = document.getElementById('image-zoom-overlay') as HTMLDivElement;
const zoomedImage = document.getElementById('zoomed-image') as HTMLImageElement;
const btnCloseZoom = document.querySelector('.close-zoom-btn') as HTMLButtonElement;

function closeZoom() {
  zoomOverlay?.classList.remove('active');
  if (zoomedImage) setTimeout(() => { zoomedImage.src = '' }, 300);
}
btnCloseZoom?.addEventListener('click', closeZoom);
zoomOverlay?.addEventListener('click', (e) => {
  if (e.target === zoomOverlay) closeZoom();
});

// Markdown Panel Hooks
btnCloseDetail?.addEventListener('click', () => {
    closeDetailModal();
    if (activeDetailTodoId && vditorInstance) {
       const todo = todos.find(t => t.id === activeDetailTodoId);
       if (todo) {
           todo.detailsMarkdown = vditorInstance.getValue();
           // Save title changes
           const newTitle = detailPanelTitle?.value.trim();
           if (newTitle && newTitle !== todo.text) {
               todo.text = newTitle;
               renderTodos();
           }
       }
    }
    activeDetailTodoId = null;
    saveTodos();
});

// Close when clicking the backdrop
taskDetailBackdrop?.addEventListener('mousedown', (e) => {
    if (e.target === taskDetailBackdrop) {
        btnCloseDetail?.click();
    }
});

// Image double click (Needs to be hooked via DOM observation or Vditor's image click API if available, 
// for now we'll observe the vditor container)
document.getElementById('vditor-container')?.addEventListener('dblclick', (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName.toLowerCase() === 'img') {
        const url = target.getAttribute('src');
        if (url) {
            zoomedImage.src = url;
            zoomOverlay.classList.add('active');
        }
    }
});

// Detail Panel Input Hooks
detailRecurrence.addEventListener('change', () => {
    if (activeDetailTodoId) {
       const todo = todos.find(t => t.id === activeDetailTodoId);
       if (todo) {
           todo.recurrence = detailRecurrence.value as any;
           renderTodos();
           saveTodos();
       }
    }
});

detailDate.addEventListener('change', () => {
    if (activeDetailTodoId) {
       const todo = todos.find(t => t.id === activeDetailTodoId);
       if (todo && detailDate.value) {
           todo.createdAt = detailDate.value + "T00:00:00.000Z";
           renderTodos();
           saveTodos();
       }
    }
});

// Window Controls
if (window.electronAPI) {
  btnMinimize?.addEventListener('click', () => window.electronAPI.minimize());
  btnClose?.addEventListener('click', () => window.electronAPI.close());
  btnMini?.addEventListener('click', () => {
    isMiniMode = !isMiniMode;
    window.electronAPI.toggleMiniMode(isMiniMode);
    document.body.classList.toggle('mini-mode', isMiniMode);
    
    // UI layout logic for Window switching
    if (isMiniMode) {
      // When collapsing: always jump to today
      showDetail(getLocalISODate(new Date()));
    } else {
      // When expanding: stay on the current day's detail view (don't go back to calendar)
      showDetail(currentViewDate);
    }
  });
}

// View Navigation
function showCalendar() {
  viewCalendar.classList.add('active');
  viewDetail.classList.remove('active');
  taskDetailPanel.classList.remove('open');
  activeDetailTodoId = null;
  renderCalendar();
}

function showDetail(dateStr: string) {
  currentViewDate = dateStr;
  detailDateTitle.textContent = dateStr;
  viewCalendar.classList.remove('active');
  viewDetail.classList.add('active');
  taskDetailPanel.classList.remove('open');
  activeDetailTodoId = null;
  
  // Load Daily Thoughts
  dailyThoughtsInput.value = dailyNotes[dateStr] || '';
  
  renderTodos();
}

// Daily Thoughts Input Hook
dailyThoughtsInput.addEventListener('input', () => {
   dailyNotes[currentViewDate] = dailyThoughtsInput.value;
   saveNotes();
});

btnBackCalendar.addEventListener('click', showCalendar);

// Calendar Rendering
btnPrevMonth.addEventListener('click', () => { currentMonthOffset--; renderCalendar(); });
btnNextMonth.addEventListener('click', () => { currentMonthOffset++; renderCalendar(); });

function calculateStreak(): number {
  const todayStr = getLocalISODate(new Date());
  let streak = 0;
  const checkDate = new Date();

  // Bounded loop — max 365 days back, guaranteed to exit
  for (let i = 0; i < 365; i++) {
    const dateStr = getLocalISODate(checkDate);
    const dayTasks = todos.filter(t => t.createdAt.startsWith(dateStr));

    if (dayTasks.length === 0) {
      if (dateStr === todayStr) {
        // Today has no tasks yet — skip, don't break the streak
        checkDate.setDate(checkDate.getDate() - 1);
        continue;
      }
      break; // Past day with no tasks → streak ends
    }

    const allDone = dayTasks.every(t =>
      (t.completedDates || []).includes(dateStr) || t.completed
    );

    if (!allDone) {
      if (dateStr === todayStr) {
        // Today not fully done yet — skip, give user time
        checkDate.setDate(checkDate.getDate() - 1);
        continue;
      }
      break; // Past day incomplete → streak ends
    }

    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return streak;
}

function renderCalendar() {
  calendarGrid.innerHTML = '';
  const now = new Date();
  const targetMonth = new Date(now.getFullYear(), now.getMonth() + currentMonthOffset, 1);
  
  monthTitle.textContent = targetMonth.toLocaleDateString('default', { month: 'long', year: 'numeric' });
  
  const year = targetMonth.getFullYear();
  const month = targetMonth.getMonth();
  
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = getLocalISODate(new Date());

  // ── Monthly Stats ──
  let monthTotal = 0, monthDone = 0, bestDayCount = 0, bestDayStr = '—';
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = getLocalISODate(new Date(year, month, d));
    const dayTasks = todos.filter(t => t.createdAt.startsWith(ds));
    monthTotal += dayTasks.length;
    const doneTasks = dayTasks.filter(t => (t.completedDates || []).includes(ds) || t.completed).length;
    monthDone += doneTasks;
    if (doneTasks > bestDayCount) { bestDayCount = doneTasks; bestDayStr = `${d}日 (${doneTasks}✓)`; }
  }
  const completionPct = monthTotal > 0 ? Math.round(monthDone / monthTotal * 100) : 0;
  const streak = calculateStreak();

  // Update stat cards safely
  const statTotal = document.querySelector('#stat-total .stat-value');
  const statDone = document.querySelector('#stat-done .stat-value');
  const statStreak = document.querySelector('#stat-streak .stat-value');
  const statBest = document.querySelector('#stat-best-day .stat-value');
  if (statTotal) statTotal.textContent = String(monthTotal);
  if (statDone) statDone.textContent = `${completionPct}%`;
  if (statStreak) statStreak.textContent = `${streak} 🔥`;
  if (statBest) statBest.textContent = bestDayStr;

  // Completion % colour of the #stat-done card
  const doneCard = document.getElementById('stat-done');
  if (doneCard) doneCard.style.setProperty('--pct-color',
    completionPct >= 80 ? 'var(--success)' : completionPct >= 40 ? 'var(--q2-color)' : 'var(--danger)');

  // Padding days
  for (let i = 0; i < firstDay; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'calendar-cell empty';
    calendarGrid.appendChild(emptyCell);
  }

  // Month days
  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(year, month, day);
    const dateStr = getLocalISODate(dateObj);
    
    const dayTasks = todos.filter(t => t.createdAt.startsWith(dateStr));
    const completedCount = dayTasks.filter(t => (t.completedDates || []).includes(dateStr) || t.completed).length;
    const pct = dayTasks.length > 0 ? completedCount / dayTasks.length : 0;
    
    const cell = document.createElement('div');
    cell.className = 'calendar-cell';
    if (dateStr === todayStr) cell.classList.add('today');
    if (dateStr > todayStr) cell.classList.add('future');
    if (dayTasks.length > 0 && pct === 1) cell.classList.add('all-complete');

    // Heat-map: set opacity based on task density
    if (dayTasks.length > 0) {
      const intensity = Math.min(dayTasks.length / 8, 1); // max at 8 tasks
      cell.style.setProperty('--heat', String(intensity));
      cell.classList.add('has-tasks');
    }

    // Completion mini-bar width
    const barWidth = dayTasks.length > 0 ? Math.round(pct * 100) : 0;

    cell.innerHTML = `
      <div class="date-number">${day}</div>
      <div class="task-indicators">
        ${dayTasks.length > 0 ? `<div class="task-count-badge">${completedCount}/${dayTasks.length}</div>` : ''}
        ${dayTasks.length > 0 && pct === 1 ? `<div class="all-done-check">✓</div>` : ''}
      </div>
      ${dayTasks.length > 0 ? `<div class="completion-bar"><div class="completion-fill" style="width:${barWidth}%"></div></div>` : ''}
    `;

    cell.addEventListener('click', () => showDetail(dateStr));
    calendarGrid.appendChild(cell);
  }
}

// Global Image Upload Events

// Mini Mode form bindings
const miniModeAddForm = document.getElementById('mini-mode-add-form') as HTMLFormElement;
const miniQuadrantSelect = document.getElementById('mini-quadrant-select') as HTMLSelectElement;
const miniAddInput = document.getElementById('mini-add-input') as HTMLInputElement;

miniModeAddForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = miniAddInput.value.trim();
    if (!text) return;
    const targetQ = miniQuadrantSelect.value as 'Q1' | 'Q2' | 'Q3' | 'Q4';

    // Save image via main process if selected (from global preview)
    let finalImageUrl: string | undefined = undefined;
    let initialMarkdown = '';
    if (pendingImagePath) {
      if (pendingImagePath.startsWith('file://')) {
        finalImageUrl = pendingImagePath;
      } else if (window.electronAPI && window.electronAPI.saveImage) {
        const savedUrl = await window.electronAPI.saveImage(pendingImagePath);
        if (savedUrl) finalImageUrl = savedUrl;
      }
      
      if (finalImageUrl) {
          initialMarkdown = `![Attached Image](${finalImageUrl})\n\n`;
      }
    }

    todos.push({
      id: Date.now().toString(),
      text,
      detailsMarkdown: initialMarkdown,
      completed: false,
      completedDates: [],
      createdAt: currentViewDate + "T00:00:00.000Z",
      imageUrl: finalImageUrl,
      quadrant: targetQ,
      recurrence: 'none'
    });

    // Reset Forms globally
    miniAddInput.value = '';
    
    // Clear image preview
    pendingImagePath = null;
    imageInput.value = '';
    previewContainer.style.display = 'none';

    renderTodos();
    saveTodos();
});

imageInput.addEventListener('change', () => {
  const file = imageInput.files?.[0];
  if (file) {
    pendingImagePath = file.path; // Electron exposes local path via File object
    imagePreview.src = URL.createObjectURL(file);
    previewContainer.style.display = 'flex';
  }
});

// Clipboard Paste support
document.addEventListener('paste', async (e) => {
  if (!viewDetail.classList.contains('active')) return;

  const items = e.clipboardData?.items;
  if (!items) return;
  
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      const file = items[i].getAsFile();
      if (!file) continue;
      
      const buffer = await file.arrayBuffer();
      if (window.electronAPI && window.electronAPI.saveImageFromBuffer) {
        const savedUrl = await window.electronAPI.saveImageFromBuffer(buffer, file.type);
        if (savedUrl) {
          pendingImagePath = savedUrl; // Reuse pending path to store final URL
          imagePreview.src = savedUrl;
          previewContainer.style.display = 'flex';
        }
      }
      break;
    }
  }
});

btnClearImage.addEventListener('click', () => {
  pendingImagePath = null;
  imageInput.value = '';
  previewContainer.style.display = 'none';
});

function renderTodos() {
  listQ1.innerHTML = '';
  listQ2.innerHTML = '';
  listQ3.innerHTML = '';
  listQ4.innerHTML = '';
  
  // Filter by currently selected date using Recurrence Logic!
  const viewDateObj = new Date(currentViewDate);
  const viewDateStr = currentViewDate;

  const filteredTodos = todos.filter(t => {
    // Exact Origin Match
    if (t.createdAt && t.createdAt.startsWith(viewDateStr)) return true;
    
    // Evaluate recurrence
    if (!t.recurrence || t.recurrence === 'none') return false;
    
    // Don't show recurrences before their creation date!
    const createdDateRaw = t.createdAt.split('T')[0];
    if (!createdDateRaw) return false;
    const createdDateObj = new Date(createdDateRaw);
    if (viewDateObj < createdDateObj) return false;
    
    if (t.recurrence === 'daily') return true;
    if (t.recurrence === 'weekly') {
      return createdDateObj.getDay() === viewDateObj.getDay();
    }
    if (t.recurrence === 'monthly') {
      return createdDateObj.getDate() === viewDateObj.getDate();
    }
    if (t.recurrence === 'yearly') {
      return createdDateObj.getMonth() === viewDateObj.getMonth() && createdDateObj.getDate() === viewDateObj.getDate();
    }
    return false;
  });
  
  // Update view summary
  const total = filteredTodos.length;
  // A task is completed TODAY if it has today in completedDates OR it's legacy completed and created on this day.
  const getIsCompletedToday = (t: Todo) => {
    if (t.completedDates && t.completedDates.includes(viewDateStr)) return true;
    if (t.completed && t.createdAt.startsWith(viewDateStr)) return true;
    return false;
  }
  const completed = filteredTodos.filter(getIsCompletedToday).length;
  dailySummary.textContent = `${completed} / ${total} Completed`;

  filteredTodos.forEach(todo => {
    const isCompletedToday = getIsCompletedToday(todo);
    const li = document.createElement('li');
    li.className = `todo-item ${isCompletedToday ? 'completed' : ''}`;
    
    // HTML5 Drag
    li.draggable = true;
    li.addEventListener('dragstart', (e) => {
      e.dataTransfer?.setData('text/plain', todo.id);
      li.classList.add('dragging');
      // Set drag image optionally, but default is fine
    });
    li.addEventListener('dragend', () => li.classList.remove('dragging'));

    li.innerHTML = `
      <div class="todo-content" style="cursor: pointer;" title="Click to view details">
        <div class="todo-text-row">
          <input type="checkbox" class="todo-checkbox" ${isCompletedToday ? 'checked' : ''}>
          <span class="todo-text" style="${todo.detailsMarkdown || todo.imageUrl ? 'text-decoration-thickness: 2px;' : ''}">${todo.text} ${todo.detailsMarkdown || todo.imageUrl ? '📝' : ''}</span>
        </div>
      </div>
      <div style="display:flex; gap: 4px; align-items:center;">
        <button class="delete-btn" title="Delete">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
        </button>
      </div>
    `;

    // Click to open Detail Panel
    li.querySelector('.todo-content')?.addEventListener('click', async (e) => {
        // Prevent opening if clicking on checkbox
        if ((e.target as HTMLElement).tagName.toLowerCase() === 'input') return;
        
        activeDetailTodoId = todo.id;
        detailPanelTitle.value = todo.text; // Use .value since it's now an input
        
        if (vditorInstance) {
           let rawMd = todo.detailsMarkdown || '';
           if (todo.imageUrl && !rawMd.includes(todo.imageUrl)) {
              rawMd = `![Attached Image](${todo.imageUrl})\n\n` + rawMd;
           }
           vditorInstance.setValue(rawMd);
        }
        
        detailRecurrence.value = todo.recurrence || 'none';
        detailDate.value = todo.createdAt.split('T')[0];
        
        openDetailModal();
    });

    // Deleted Zoom Image inline listeners since it's now in the detail panel
    
    // Toggle Completeness via completedDates array
    li.querySelector('.todo-checkbox')?.addEventListener('change', () => {
      const dates = todo.completedDates || [];
      if (dates.includes(viewDateStr)) {
        todo.completedDates = dates.filter(d => d !== viewDateStr);
      } else {
        todo.completedDates = [...dates, viewDateStr];
      }
      // legacy sync
      if (todo.createdAt.startsWith(viewDateStr)) {
         todo.completed = todo.completedDates.includes(viewDateStr); 
      }
      renderTodos();
      saveTodos();
    });

    // Delete
    li.querySelector('.delete-btn')?.addEventListener('click', () => {
      todos = todos.filter(t => t.id !== todo.id);
      renderTodos();
      saveTodos();
    });

    // Append to corresponding Matrix quadrant
    const targetQ = todo.quadrant || 'Q1';
    if (targetQ === 'Q1') listQ1.appendChild(li);
    else if (targetQ === 'Q2') listQ2.appendChild(li);
    else if (targetQ === 'Q3') listQ3.appendChild(li);
    else listQ4.appendChild(li);
  });
}

// Inline Form Hooks
document.querySelectorAll('.inline-add-form').forEach(form => {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target as HTMLFormElement;
    const input = f.querySelector('input') as HTMLInputElement;
    const targetQ = f.getAttribute('data-target') as 'Q1'|'Q2'|'Q3'|'Q4';
    
    const text = input.value.trim();
    if (!text) return;
    
    // Save image via main process if selected (from global preview)
    let finalImageUrl: string | undefined = undefined;
    let initialMarkdown = '';
    if (pendingImagePath) {
      if (pendingImagePath.startsWith('file://')) {
        finalImageUrl = pendingImagePath;
      } else if (window.electronAPI && window.electronAPI.saveImage) {
        const savedUrl = await window.electronAPI.saveImage(pendingImagePath);
        if (savedUrl) finalImageUrl = savedUrl;
      }
      
      if (finalImageUrl) {
          initialMarkdown = `![Attached Image](${finalImageUrl})\n\n`;
      }
    }

    todos.push({
      id: Date.now().toString(),
      text,
      detailsMarkdown: initialMarkdown,
      completed: false,
      completedDates: [],
      createdAt: currentViewDate + "T00:00:00.000Z", // anchor to current view date
      imageUrl: finalImageUrl,
      quadrant: targetQ,
      recurrence: 'none'
    });

    input.value = '';
    pendingImagePath = null;
    imageInput.value = '';
    previewContainer.style.display = 'none';
    
    renderTodos();
    saveTodos();
  });
});

// Drag and Drop Zone logic
document.querySelectorAll('.quadrant').forEach(quadrant => {
  quadrant.addEventListener('dragover', (e) => {
    e.preventDefault(); // allow drop
    const event = e as DragEvent;
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    quadrant.classList.add('drag-over');
  });
  
  quadrant.addEventListener('dragleave', () => {
    quadrant.classList.remove('drag-over');
  });
  
  quadrant.addEventListener('drop', (e) => {
    e.preventDefault();
    quadrant.classList.remove('drag-over');
    
    const id = (e as DragEvent).dataTransfer?.getData('text/plain');
    const targetQ = quadrant.getAttribute('data-quadrant') as 'Q1'|'Q2'|'Q3'|'Q4';
    
    if (id && targetQ) {
       const todo = todos.find(t => t.id === id);
       if (todo && todo.quadrant !== targetQ) {
          todo.quadrant = targetQ;
          renderTodos();
          saveTodos();
       }
    }
  });
});

// Storage Logic 
function saveTodos() {
  if (window.electronAPI && window.electronAPI.saveTodos) {
    window.electronAPI.saveTodos(todos);
  } else {
    // Fallback for browser dev
    localStorage.setItem('todos', JSON.stringify(todos));
  }
}

function saveNotes() {
  if (window.electronAPI && window.electronAPI.saveNotes) {
    window.electronAPI.saveNotes(dailyNotes);
  } else {
    // Fallback for browser dev
    localStorage.setItem('dailyNotes', JSON.stringify(dailyNotes));
  }
}

async function loadTodos() {
  const loadData = async () => {
    if (window.electronAPI) {
      todos = await window.electronAPI.getTodos();
      dailyNotes = await window.electronAPI.getNotes() || {};
    } else {
      // Fallback for browser dev
      const savedTodos = localStorage.getItem('todos');
      if (savedTodos) todos = JSON.parse(savedTodos);
      const savedNotes = localStorage.getItem('dailyNotes');
      if (savedNotes) dailyNotes = JSON.parse(savedNotes);
    }
    
    // Initialize Vditor instance
    vditorInstance = new Vditor('vditor-container', {
      mode: 'ir', // Instant Rendering (Typora-like WYSIWYG)
      toolbarConfig: { hide: true }, // Keep it clean
      cache: { enable: false },
      outline: { enable: false, position: 'left' },
      upload: {
          accept: 'image/*',
          handler: async (files) => {
             // Use our custom upload via IPC
             let resultSrc = '';
             for (const file of files) {
                 const buffer = await file.arrayBuffer();
                 const uri = await window.electronAPI?.saveImageFromBuffer(buffer, file.type);
                 if (uri) {
                     resultSrc += `![${file.name}](${uri})\n`;
                 }
             }
             if (resultSrc) {
                 vditorInstance?.insertValue(resultSrc);
             }
             return null;
          }
      },
      after: () => {
         // Also refresh after Vditor fully initializes
         renderCalendar();
      }
    });
  };
  // Load data first, then show calendar with real data
  loadData().then(() => {
    showCalendar();
  });
}


// Initial Load
loadTodos();
