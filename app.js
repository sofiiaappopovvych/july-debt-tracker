import { firebaseConfig } from './firebase-config.js';

let appAuth = null;
let db = null;
let user = null;
let unsub = null;

const defaultState = () => ({
  settings: {
    startingDebt: 0,
    startingCash: 0,
    dueDate: '',
    cushion: 0,
    hasSetup: false
  },
  transactions: []
});

const state = defaultState();
const $ = id => document.getElementById(id);
const money = n => '$' + (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 0 });
const todayISO = () => new Date().toISOString().slice(0, 10);
const hasFirebaseConfig = firebaseConfig && typeof firebaseConfig === 'object' && firebaseConfig.apiKey && firebaseConfig.projectId;
const cloudDocPath = uid => ['users', uid, 'apps', 'julyDebtTracker'];

function normalizeState(raw) {
  const clean = defaultState();
  if (!raw || typeof raw !== 'object') return clean;
  clean.settings = {
    ...clean.settings,
    ...(raw.settings || {})
  };
  clean.transactions = Array.isArray(raw.transactions) ? raw.transactions : [];
  clean.settings.startingDebt = Number(clean.settings.startingDebt) || 0;
  clean.settings.startingCash = Number(clean.settings.startingCash) || 0;
  clean.settings.cushion = Number(clean.settings.cushion) || 0;
  clean.settings.dueDate = clean.settings.dueDate || '';
  clean.settings.hasSetup = Boolean(clean.settings.hasSetup);
  return clean;
}

function applyState(next) {
  const clean = normalizeState(next);
  state.settings = clean.settings;
  state.transactions = clean.transactions;
}

function loadLocal() {
  const saved = localStorage.getItem('debtTrackerState');
  if (saved) {
    try { applyState(JSON.parse(saved)); } catch { applyState(defaultState()); }
  }
}

function saveLocal() {
  localStorage.setItem('debtTrackerState', JSON.stringify(state));
}

async function saveCloud() {
  saveLocal();
  if (db && user) {
    const { doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
    await setDoc(doc(db, ...cloudDocPath(user.uid)), { ...state, updatedAt: serverTimestamp() }, { merge: false });
  }
}

const incomeGroups = {
  'Earned Income': ['School', 'DoorDash', 'Sales Commission', 'Animator', 'Freelance', 'Other Work'],
  'Refunds': ['Amazon', 'Walmart', 'Target', 'Other Refund'],
  'Sold Items': ['Vinted', 'Facebook Marketplace', 'OfferUp', 'eBay', 'Other Sold Item'],
  'Gifts': ['Birthday', 'Family', 'Other Gift'],
  'Other': ['Other']
};
const expenseGroups = {
  'Expenses': ['Tesla', 'Charging/Gas', 'Food', 'Supplies', 'Personal', 'Bills', 'Other']
};
const incomeGroupNames = Object.keys(incomeGroups);
const sourceToGroup = {};
Object.entries(incomeGroups).forEach(([group, sources]) => sources.forEach(source => sourceToGroup[source] = group));
Object.entries(expenseGroups).forEach(([group, sources]) => sources.forEach(source => sourceToGroup[source] = group));

function getTxCategory(tx) {
  if (tx.category) return tx.category;
  return sourceToGroup[tx.source] || (tx.type === 'expense' ? 'Expenses' : 'Other');
}

function txGroup(tx) {
  if (tx.group) return tx.group;
  return getTxCategory(tx);
}

function txCategory(tx) {
  if (tx.category && tx.category !== tx.group) return tx.category;
  return tx.source || tx.category || 'Other';
}

function txSource(tx) {
  return tx.source || txCategory(tx) || 'Other';
}

function txCreated(tx) {
  return tx.createdAt || tx.id || '';
}

function transactionMatchesHistorySearch(tx) {
  const q = ($('historySearch')?.value || '').trim().toLowerCase();
  if (!q) return true;
  return [tx.note, txSource(tx), txCategory(tx), txGroup(tx), tx.type]
    .some(value => String(value || '').toLowerCase().includes(q));
}


function optionsForType(type) {
  return type === 'expense' ? expenseGroups : incomeGroups;
}

function populateCategoryAndSource(selectedCategory, selectedSource) {
  const type = $('txType').value;
  const groups = optionsForType(type);
  const categories = Object.keys(groups);
  const category = categories.includes(selectedCategory) ? selectedCategory : categories[0];
  $('txCategory').innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('');
  $('txCategory').value = category;
  const sources = groups[category] || [];
  const source = sources.includes(selectedSource) ? selectedSource : sources[0];
  $('txSource').innerHTML = sources.map(src => `<option value="${src}">${src}</option>`).join('');
  $('txSource').value = source;
}


const schoolPayrollSchedule = [
  { start: '2026-07-01', end: '2026-07-15', due: '2026-07-15', pay: '2026-07-24' },
  { start: '2026-07-16', end: '2026-07-31', due: '2026-07-31', pay: '2026-08-07' },
  { start: '2026-08-01', end: '2026-08-15', due: '2026-08-14', pay: '2026-08-25' },
  { start: '2026-08-16', end: '2026-08-31', due: '2026-08-31', pay: '2026-09-09' },
  { start: '2026-09-01', end: '2026-09-15', due: '2026-09-15', pay: '2026-09-25' },
  { start: '2026-09-16', end: '2026-09-30', due: '2026-09-30', pay: '2026-10-09' },
  { start: '2026-10-01', end: '2026-10-15', due: '2026-10-15', pay: '2026-10-23' },
  { start: '2026-10-16', end: '2026-10-31', due: '2026-10-30', pay: '2026-11-09' },
  { start: '2026-11-01', end: '2026-11-15', due: '2026-11-13', pay: '2026-11-25' },
  { start: '2026-11-16', end: '2026-11-30', due: '2026-11-30', pay: '2026-12-09' },
  { start: '2026-12-01', end: '2026-12-13', due: '2026-12-11', pay: '2026-12-23' },
  { start: '2026-12-14', end: '2026-12-31', due: '2026-12-31', pay: '2027-01-08' },
  { start: '2027-01-01', end: '2027-01-15', due: '2027-01-15', pay: '2027-01-25' },
  { start: '2027-01-16', end: '2027-01-31', due: '2027-01-29', pay: '2027-02-09' },
  { start: '2027-02-01', end: '2027-02-15', due: '2027-02-15', pay: '2027-02-25' },
  { start: '2027-02-16', end: '2027-02-28', due: '2027-02-26', pay: '2027-03-09' },
  { start: '2027-03-01', end: '2027-03-15', due: '2027-03-15', pay: '2027-03-25' },
  { start: '2027-03-16', end: '2027-03-31', due: '2027-03-31', pay: '2027-04-09' },
  { start: '2027-04-01', end: '2027-04-15', due: '2027-04-15', pay: '2027-04-23' },
  { start: '2027-04-16', end: '2027-04-30', due: '2027-04-30', pay: '2027-05-07' },
  { start: '2027-05-01', end: '2027-05-15', due: '2027-05-14', pay: '2027-05-25' },
  { start: '2027-05-16', end: '2027-05-31', due: '2027-05-31', pay: '2027-06-09' },
  { start: '2027-06-01', end: '2027-06-15', due: '2027-06-15', pay: '2027-06-25' },
  { start: '2027-06-16', end: '2027-06-30', due: '2027-06-30', pay: '2027-07-09' }
];

function schoolPayrollForDate(date) {
  return schoolPayrollSchedule.find(p => date >= p.start && date <= p.end) || null;
}

function schoolEstimate() {
  const date = $('schoolWorkDate')?.value || todayISO();
  const hours = Number($('schoolHours')?.value || 0);
  const rate = Number($('schoolRate')?.value || 20.81);
  const netPercent = Number($('schoolNetPercent')?.value || 83.05);
  const gross = Math.max(0, hours * rate);
  const net = Math.max(0, gross * (netPercent / 100));
  const period = schoolPayrollForDate(date);
  return { date, hours, rate, netPercent, gross, net, period };
}

function renderSchoolEstimate() {
  if (!$('schoolEstimate')) return;
  const estimate = schoolEstimate();
  const periodText = estimate.period ? `${estimate.period.start} – ${estimate.period.end}` : 'Not in schedule';
  const payText = estimate.period ? estimate.period.pay : 'Check schedule';
  $('schoolEstimate').innerHTML = `
    <div><span>Pay period</span><strong>${periodText}</strong></div>
    <div><span>Expected payday</span><strong>${payText}</strong></div>
    <div><span>Gross estimate</span><strong>${money(estimate.gross)}</strong></div>
    <div><span>Net estimate</span><strong>${money(estimate.net)}</strong></div>
  `;
}

function calc() {
  // Remaining Debt = Starting Debt - Starting Cash - Total Cash In + Total Expenses + Target Cushion
  // Total Cash In includes earned income, refunds, sold items, gifts, and other incoming cash.
  const cashInByGroup = Object.fromEntries(incomeGroupNames.map(g => [g, 0]));
  state.transactions
    .filter(t => t.type === 'income')
    .forEach(t => {
      const group = incomeGroupNames.includes(getTxCategory(t)) ? getTxCategory(t) : 'Other';
      cashInByGroup[group] = (cashInByGroup[group] || 0) + Number(t.amount || 0);
    });
  const totalIncome = Object.values(cashInByGroup).reduce((sum, value) => sum + value, 0);
  const expensesByCategory = Object.fromEntries(expenseGroups['Expenses'].map(g => [g, 0]));
  state.transactions
    .filter(t => t.type === 'expense')
    .forEach(t => {
      const category = expenseGroups['Expenses'].includes(t.source) ? t.source : (t.source || 'Other');
      const safeCategory = expenseGroups['Expenses'].includes(category) ? category : 'Other';
      expensesByCategory[safeCategory] = (expensesByCategory[safeCategory] || 0) + Number(t.amount || 0);
    });
  const totalExpenses = Object.values(expensesByCategory).reduce((s, value) => s + value, 0);

  const startingDebt = Number(state.settings.startingDebt || 0);
  const startingCash = Number(state.settings.startingCash || 0);
  const cushion = Number(state.settings.cushion || 0);
  const rawRemaining = startingDebt - startingCash - totalIncome + totalExpenses + cushion;
  const remaining = Math.max(0, rawRemaining);
  const surplus = Math.max(0, -rawRemaining);
  const goalTotal = Math.max(0, startingDebt - startingCash + cushion);
  const paidTowardGoal = Math.max(0, goalTotal - remaining);
  const progress = goalTotal ? Math.min(100, Math.max(0, paidTowardGoal / goalTotal * 100)) : 0;

  let days = 0;
  if (state.settings.dueDate) {
    // Days Until Payment is counted from today to the saved Payment Date.
    // If the payment date is today or has passed, Days Left stays 0 and Needed Per Day shows the amount needed today.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(state.settings.dueDate + 'T00:00:00');
    days = Math.max(0, Math.ceil((due - today) / 86400000));
  }
  const neededPerDay = days > 0 ? remaining / days : remaining;
  const goalStatus = !state.settings.hasSetup
    ? 'Set up goal'
    : remaining <= 0
      ? 'Goal Reached'
      : days === 0 && state.settings.dueDate
        ? 'Due Today'
        : 'In Progress';

  return {
    totalIncome,
    cashInByGroup,
    totalExpenses,
    expensesByCategory,
    remaining,
    surplus,
    progress,
    days,
    needed: neededPerDay,
    goalStatus
  };
}


function getJulyYear() {
  const base = state.settings.dueDate || todayISO();
  return Number(base.slice(0, 4)) || new Date().getFullYear();
}

function transactionPassesCalendarFilters(t) {
  const incomeFilter = $('calendarIncomeFilter')?.value || 'All';
  const expenseFilter = $('calendarExpenseFilter')?.value || 'All';
  if (t.type === 'income' && incomeFilter !== 'All' && t.source !== incomeFilter) return false;
  if (t.type === 'expense' && expenseFilter !== 'All' && t.source !== expenseFilter) return false;
  return true;
}

function populateCalendarFilters() {
  if (!$('calendarIncomeFilter') || !$('calendarExpenseFilter')) return;
  const currentIncome = $('calendarIncomeFilter').value || 'All';
  const currentExpense = $('calendarExpenseFilter').value || 'All';
  const incomeSources = Array.from(new Set(Object.values(incomeGroups).flat()));
  const expenseSources = Array.from(new Set(expenseGroups['Expenses']));
  $('calendarIncomeFilter').innerHTML = ['All', ...incomeSources].map(v => `<option value="${v}">${v === 'All' ? 'All income sources' : v}</option>`).join('');
  $('calendarExpenseFilter').innerHTML = ['All', ...expenseSources].map(v => `<option value="${v}">${v === 'All' ? 'All expense categories' : v}</option>`).join('');
  $('calendarIncomeFilter').value = incomeSources.includes(currentIncome) || currentIncome === 'All' ? currentIncome : 'All';
  $('calendarExpenseFilter').value = expenseSources.includes(currentExpense) || currentExpense === 'All' ? currentExpense : 'All';
}

function renderCalendar(c) {
  if (!$('calendarGrid')) return;
  const year = getJulyYear();
  const today = todayISO();
  const filtered = state.transactions.filter(transactionPassesCalendarFilters);
  const byDate = {};
  for (const t of filtered) {
    const d = t.date || todayISO();
    if (!d.startsWith(`${year}-07`)) continue;
    if (!byDate[d]) byDate[d] = { income: 0, expenses: 0 };
    if (t.type === 'expense') byDate[d].expenses += Number(t.amount || 0);
    else byDate[d].income += Number(t.amount || 0);
  }

  let runningRemainingRaw = Number(state.settings.startingDebt || 0) - Number(state.settings.startingCash || 0) + Number(state.settings.cushion || 0);
  const days = [];
  for (let day = 1; day <= 31; day++) {
    const date = `${year}-07-${String(day).padStart(2, '0')}`;
    const value = byDate[date] || { income: 0, expenses: 0 };
    runningRemainingRaw = runningRemainingRaw - value.income + value.expenses;
    const remainingAfterDay = Math.max(0, runningRemainingRaw);
    const net = value.income - value.expenses;
    const isToday = date === today;
    days.push(`
      <div class="calendar-day ${isToday ? 'today' : ''}">
        <div class="calendar-date">${day}${isToday ? '<span>Today</span>' : ''}</div>
        <div class="calendar-line income-line">Income <strong>${money(value.income)}</strong></div>
        <div class="calendar-line expense-line">Expenses <strong>${money(value.expenses)}</strong></div>
        <div class="calendar-line">Net <strong>${money(net)}</strong></div>
        <div class="calendar-line remaining-line">Remaining <strong>${money(remainingAfterDay)}</strong></div>
      </div>
    `);
  }
  $('calendarGrid').innerHTML = days.join('');
}

function render() {
  $('startingDebt').value = state.settings.startingDebt || '';
  $('startingCash').value = state.settings.startingCash || '';
  $('dueDate').value = state.settings.dueDate || '';
  $('cushion').value = state.settings.cushion || '';
  $('txDate').value ||= todayISO();

  populateCalendarFilters();
  const c = calc();
  $('remainingDebt').textContent = money(c.remaining);
  $('earnedIncome').textContent = money(c.cashInByGroup['Earned Income']);
  $('refundsIncome').textContent = money(c.cashInByGroup['Refunds']);
  $('soldItemsIncome').textContent = money(c.cashInByGroup['Sold Items']);
  $('giftsIncome').textContent = money(c.cashInByGroup['Gifts']);
  $('totalIncome').textContent = money(c.totalIncome);
  $('totalExpenses').textContent = money(c.totalExpenses);
  $('surplusAmount').textContent = money(c.surplus);
  $('surplusCard').classList.toggle('hidden', c.surplus <= 0);
  $('daysLeft').textContent = state.settings.dueDate ? c.days : '0';
  $('neededPerDay').textContent = money(c.needed);
  $('progressPercent').textContent = Math.round(c.progress) + '%';
  $('progressFill').style.width = c.progress + '%';
  $('goalStatus').textContent = c.goalStatus;

  if (!state.settings.hasSetup) {
    $('progressNote').textContent = 'Set up your July goal first. No demo numbers are included.';
  } else if (!state.settings.dueDate) {
    $('progressNote').textContent = 'Add a payment date to calculate days left and needed per day.';
  } else if (c.remaining <= 0) {
    $('progressNote').textContent = c.surplus > 0 ? `Goal reached. Surplus: ${money(c.surplus)}.` : 'Goal reached.';
  } else if (c.days === 0) {
    $('progressNote').textContent = `Payment date is today or already passed. You need ${money(c.needed)} today to reach the goal.`;
  } else {
    $('progressNote').textContent = `You need about ${money(c.needed)} per day to reach the goal by ${state.settings.dueDate}.`;
  }

  const by = {};
  state.transactions
    .filter(t => t.type === 'income')
    .forEach(t => {
      const source = t.source || 'Other';
      const group = getTxCategory(t);
      const label = `${group}: ${source}`;
      by[label] = (by[label] || 0) + Number(t.amount || 0);
    });
  $('sourceSummary').innerHTML = Object.entries(by)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `<div class="source-item"><span>${k}</span><strong>${money(v)}</strong></div>`)
    .join('') || '<p>No cash in yet.</p>';

  $('expenseSummary').innerHTML = Object.entries(c.expensesByCategory)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `<div class="source-item expense-item"><span>${k}</span><strong>${money(v)}</strong></div>`)
    .join('') || '<p>No expenses yet.</p>';

  const daily = {};
  state.transactions.forEach(t => {
    const date = t.date || todayISO();
    if (!daily[date]) daily[date] = { income: 0, expenses: 0 };
    if (t.type === 'expense') daily[date].expenses += Number(t.amount || 0);
    else daily[date].income += Number(t.amount || 0);
  });
  $('dailyLog').innerHTML = Object.entries(daily)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, value]) => {
      const net = value.income - value.expenses;
      return `<tr><td>${date}</td><td>${money(value.income)}</td><td>${money(value.expenses)}</td><td>${money(net)}</td></tr>`;
    })
    .join('') || '<tr><td colspan="4">No daily activity yet.</td></tr>';

  renderCalendar(c);
  renderSchoolEstimate();

  $('txTable').innerHTML = state.transactions.slice()
    .filter(transactionMatchesHistorySearch)
    .sort((a, b) => {
      const dateCompare = (b.date || '').localeCompare(a.date || '');
      if (dateCompare) return dateCompare;
      return String(txCreated(b)).localeCompare(String(txCreated(a)));
    })
    .map(t => `<tr><td>${t.date || ''}</td><td>${t.type || ''}</td><td>${txGroup(t)}</td><td>${txCategory(t)}</td><td>${txSource(t)}</td><td>${money(t.amount)}</td><td>${t.note || ''}</td><td class="actions"><button class="edit-btn" data-id="${t.id}">Edit</button><button class="delete-btn" data-id="${t.id}">Delete</button></td></tr>`)
    .join('') || '<tr class="empty-row"><td colspan="8">No matching transactions.</td></tr>';

  document.querySelectorAll('.delete-btn').forEach(b => {
    b.onclick = async () => {
      state.transactions = state.transactions.filter(t => t.id !== b.dataset.id);
      await saveCloud();
      render();
    };
  });

  document.querySelectorAll('.edit-btn').forEach(b => {
    b.onclick = async () => {
      const tx = state.transactions.find(t => t.id === b.dataset.id);
      if (!tx) return;
      $('txDate').value = tx.date || todayISO();
      $('txType').value = tx.type || 'income';
      populateCategoryAndSource(txGroup(tx), txCategory(tx));
      $('txAmount').value = tx.amount || '';
      $('txNote').value = tx.note || '';
      state.transactions = state.transactions.filter(t => t.id !== b.dataset.id);
      await saveCloud();
      render();
      $('txAmount').focus();
    };
  });
}

$('saveSettings').onclick = async () => {
  state.settings = {
    startingDebt: +$('startingDebt').value || 0,
    startingCash: +$('startingCash').value || 0,
    dueDate: $('dueDate').value || '',
    cushion: +$('cushion').value || 0,
    hasSetup: true
  };
  await saveCloud();
  render();
};

$('addTx').onclick = async () => {
  const amount = +$('txAmount').value;
  if (!amount) return alert('Enter amount');
  const selectedGroup = $('txCategory').value;
  const selectedCategory = $('txSource').value.trim() || 'Other';
  state.transactions.push({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    date: $('txDate').value || todayISO(),
    type: $('txType').value,
    group: selectedGroup,
    category: selectedCategory,
    source: selectedCategory,
    amount,
    note: $('txNote').value.trim()
  });
  $('txAmount').value = '';
  $('txNote').value = '';
  await saveCloud();
  render();
};

$('clearAll').onclick = async () => {
  if (confirm('Delete all settings and transactions?')) {
    applyState(defaultState());
    localStorage.removeItem('debtTrackerState');
    await saveCloud();
    render();
  }
};

async function initFirebase() {
  if (!hasFirebaseConfig) {
    $('syncStatus').textContent = 'Local Mode';
    $('syncStatus').className = 'pill offline';
    $('signInBtn').onclick = () => alert('Firebase is not configured yet. Add your Firebase web config to firebase-config.js, then redeploy the site.');
    return;
  }

  try {
    const [
      { initializeApp },
      { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged },
      { getFirestore, doc, onSnapshot, setDoc, getDoc, serverTimestamp }
    ] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js')
    ]);

    const app = initializeApp(firebaseConfig);
    appAuth = getAuth(app);
    db = getFirestore(app);
    const provider = new GoogleAuthProvider();

    $('signInBtn').onclick = async () => {
      try {
        await signInWithPopup(appAuth, provider);
      } catch (error) {
        console.error(error);
        alert('Google Sign-In failed. Check Firebase Authorized Domains and Google Auth provider.');
      }
    };
    $('signOutBtn').onclick = async () => {
      await signOut(appAuth);
      $('syncStatus').textContent = 'Local Mode';
      $('syncStatus').className = 'pill offline';
    };

    onAuthStateChanged(appAuth, async currentUser => {
      user = currentUser;
      $('signInBtn').classList.toggle('hidden', !!currentUser);
      $('signOutBtn').classList.toggle('hidden', !currentUser);

      if (unsub) {
        unsub();
        unsub = null;
      }

      if (!currentUser) {
        $('syncStatus').textContent = 'Local Mode';
        $('syncStatus').className = 'pill offline';
        return;
      }

      $('syncStatus').textContent = 'Syncing...';
      $('syncStatus').className = 'pill syncing';

      const ref = doc(db, ...cloudDocPath(currentUser.uid));
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        await setDoc(ref, { ...state, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: false });
      }

      unsub = onSnapshot(ref, snapshot => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          delete data.createdAt;
          delete data.updatedAt;
          applyState(data);
          saveLocal();
          render();
        }
        $('syncStatus').textContent = 'Cloud Sync';
        $('syncStatus').className = 'pill online';
      }, error => {
        console.error(error);
        $('syncStatus').textContent = 'Sync Error';
        $('syncStatus').className = 'pill offline';
      });
    });
  } catch (e) {
    console.error(e);
    $('syncStatus').textContent = 'Local Mode';
    $('syncStatus').className = 'pill offline';
  }
}


function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? '');
  return '"' + text.replace(/"/g, '""') + '"';
}

function exportJsonBackup() {
  const payload = {
    app: 'July Debt Tracker',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: state.settings,
    transactions: state.transactions
  };
  downloadFile(`july-debt-tracker-backup-${todayISO()}.json`, JSON.stringify(payload, null, 2), 'application/json');
}

function exportTransactionsCsv() {
  const headers = ['date', 'type', 'group', 'category', 'source', 'amount', 'note', 'id', 'createdAt'];
  const rows = state.transactions
    .slice()
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || String(txCreated(b)).localeCompare(String(txCreated(a))))
    .map(tx => [
      tx.date || '',
      tx.type || '',
      txGroup(tx),
      txCategory(tx),
      txSource(tx),
      Number(tx.amount || 0),
      tx.note || '',
      tx.id || '',
      tx.createdAt || ''
    ]);
  const csv = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\n');
  downloadFile(`july-debt-tracker-transactions-${todayISO()}.csv`, csv, 'text/csv;charset=utf-8');
}

async function importJsonBackup(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const imported = normalizeState({
      settings: data.settings || {},
      transactions: data.transactions || []
    });
    if (!confirm('Import this JSON backup? This will replace current settings and transactions.')) return;
    applyState(imported);
    await saveCloud();
    render();
    alert('Backup imported successfully.');
  } catch (error) {
    console.error(error);
    alert('Import failed. Please choose a valid July Debt Tracker JSON backup.');
  } finally {
    if ($('importJson')) $('importJson').value = '';
  }
}


if ($('schoolWorkDate')) $('schoolWorkDate').value ||= todayISO();
['schoolWorkDate', 'schoolHours', 'schoolRate', 'schoolNetPercent'].forEach(id => {
  if ($(id)) $(id).oninput = renderSchoolEstimate;
});
if ($('addSchoolPay')) $('addSchoolPay').onclick = async () => {
  const estimate = schoolEstimate();
  if (!estimate.hours) return alert('Enter school hours worked, for example 5.5.');
  if (!estimate.period) return alert('This date is outside the saved 2026–2027 payroll schedule.');

  const periodKey = `${estimate.period.start}_${estimate.period.end}`;
  const existing = state.transactions.find(t =>
    t.type === 'income' &&
    t.source === 'School' &&
    t.date === estimate.period.pay &&
    (t.kind === 'schoolPaycheckEstimate' || t.schoolPeriodKey === periodKey)
  );

  if (existing) {
    const oldHours = Number(existing.schoolHours || 0);
    const oldGross = Number(existing.schoolGross || 0);
    const oldNet = Number(existing.amount || 0);
    existing.schoolHours = Number((oldHours + estimate.hours).toFixed(2));
    existing.schoolGross = Number((oldGross + estimate.gross).toFixed(2));
    existing.amount = Number((oldNet + estimate.net).toFixed(2));
    existing.updatedAt = new Date().toISOString();
    existing.note = `School paycheck estimate: ${existing.schoolHours} total hrs; gross ${money(existing.schoolGross)}; estimated net ${money(existing.amount)}; pay period ${estimate.period.start}–${estimate.period.end}; payday ${estimate.period.pay}. Last added: ${estimate.hours} hrs on ${estimate.date}.`;
  } else {
    state.transactions.push({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      date: estimate.period.pay,
      type: 'income',
      group: 'Earned Income',
      category: 'School',
      source: 'School',
      amount: Number(estimate.net.toFixed(2)),
      kind: 'schoolPaycheckEstimate',
      schoolPeriodKey: periodKey,
      schoolHours: Number(estimate.hours.toFixed(2)),
      schoolGross: Number(estimate.gross.toFixed(2)),
      note: `School paycheck estimate: ${estimate.hours} hrs; gross ${money(estimate.gross)}; estimated net ${money(estimate.net)}; pay period ${estimate.period.start}–${estimate.period.end}; payday ${estimate.period.pay}. Added from work date ${estimate.date}.`
    });
  }

  $('schoolHours').value = '';
  await saveCloud();
  renderSchoolEstimate();
  render();
  alert(`Added ${estimate.hours} school hours to the ${estimate.period.pay} paycheck estimate.`);
};

$('txType').onchange = () => populateCategoryAndSource();
$('txCategory').onchange = () => populateCategoryAndSource($('txCategory').value);
if ($('calendarIncomeFilter')) $('calendarIncomeFilter').onchange = render;
if ($('calendarExpenseFilter')) $('calendarExpenseFilter').onchange = render;
if ($('historySearch')) $('historySearch').oninput = render;
if ($('exportJson')) $('exportJson').onclick = exportJsonBackup;
if ($('exportCsv')) $('exportCsv').onclick = exportTransactionsCsv;
if ($('importJson')) $('importJson').onchange = event => importJsonBackup(event.target.files[0]);

document.querySelectorAll('.quick-btn').forEach(btn => {
  btn.onclick = () => {
    $('txType').value = btn.dataset.type;
    populateCategoryAndSource(btn.dataset.category, btn.dataset.source);
    $('txDate').value ||= todayISO();
    if (btn.dataset.source === 'School') {
      if ($('schoolWorkDate')) $('schoolWorkDate').value = $('txDate').value || todayISO();
      renderSchoolEstimate();
      $('schoolHours')?.focus();
      $('schoolHours')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    $('txAmount').focus();
  };
});

populateCategoryAndSource('Earned Income', 'DoorDash');

loadLocal();
render();
initFirebase();

// Bottom navigation / app screens
function setActiveScreen(screen) {
  const target = screen || 'dashboard';
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.nav === target);
  });
  document.querySelectorAll('.app-screen').forEach(section => {
    section.classList.toggle('screen-hidden', section.dataset.screen !== target);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => setActiveScreen(btn.dataset.nav));
});

// Start on Dashboard for an app-like experience.
setActiveScreen('dashboard');
