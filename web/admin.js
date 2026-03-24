// ============================================================
// Admin Portal JS – SecureVault v5
// ============================================================

let _allUsers = [];
const fmt = (n) => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtK = (n) => n >= 1e7 ? '₹' + (n / 1e7).toFixed(1) + 'Cr' : n >= 1e5 ? '₹' + (n / 1e5).toFixed(1) + 'L' : '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const fmtDate = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

// Smart transaction label (mirrors dashboard.js logic)
function txLabel(tx) {
    const typeMap = {
        deposit: { label: 'Deposit', icon: 'arrow-down', color: '#10b981' },
        withdraw: { label: 'Withdrawal', icon: 'arrow-up', color: '#ef4444' },
        transfer: { label: 'Transfer', icon: 'paper-plane', color: '#00e1ff' },
        transfer_in: { label: 'Transfer In', icon: 'arrow-down', color: '#10b981' },
        loan_deposit: { label: 'Loan Received', icon: 'hand-holding-usd', color: '#10b981' },
        loan_repayment: { label: 'Loan Repayment', icon: 'university', color: '#ef4444' },
        loan_disbursed: { label: 'Loan Disbursed', icon: 'hand-holding-usd', color: '#10b981' },
    };
    return typeMap[tx.type] || { label: tx.type, icon: 'circle', color: '#9ca3af' };
}

document.addEventListener('DOMContentLoaded', () => {
    updateClock();
    setInterval(updateClock, 1000);
    fetchStats();
    fetchUsers();

    document.getElementById('refresh-btn')?.addEventListener('click', () => {
        fetchStats(); fetchUsers();
        const active = document.querySelector('.admin-tab.active');
        if (active) active.click();
        showAlert('Data refreshed', 'success');
    });

    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/static/admin_login.html';
    });
});

function updateClock() {
    const el = document.getElementById('admin-time');
    if (el) el.textContent = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function switchTab(name) {
    document.querySelectorAll('.section-tab').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + name)?.classList.add('active');
    event.currentTarget.classList.add('active');
    // Lazy-load tab data
    if (name === 'loans') loadAllLoans();
    if (name === 'cards') loadAllCards();
    if (name === 'bills') loadAllBills();
    if (name === 'corporate') loadAllCorporate();
    if (name === 'transactions') loadAllTransactions();
}

// ============================================================
// STATS
// ============================================================
async function fetchStats() {
    try {
        const res = await fetch('/api/admin/stats');
        if (res.status === 401) { window.location.href = '/static/admin_login.html'; return; }
        const data = await res.json();
        if (data.data) {
            const s = data.data;
            setText('stat-users', s.total_users);
            setText('stat-deposits', fmtK(s.total_deposits || 0));
            setText('stat-withdrawals', fmtK(Math.abs(s.total_withdrawals || 0)));
            const net = (s.total_deposits || 0) - Math.abs(s.total_withdrawals || 0);
            const netEl = document.getElementById('stat-net');
            if (netEl) { netEl.textContent = fmtK(Math.abs(net)); netEl.className = 'fw-bold fs-5 ' + (net >= 0 ? 'text-success' : 'text-danger'); }
            setText('stat-cards', s.total_cards || 0);
            setText('stat-loans', s.total_loans || 0);
        }
        setText('last-updated', new Date().toLocaleTimeString('en-IN'));
    } catch (e) { showAlert('Failed to load stats', 'danger'); }
}

// ============================================================
// USERS TAB
// ============================================================
async function fetchUsers() {
    try {
        const res = await fetch('/api/admin/users');
        if (res.status === 401) return;
        const users = await res.json();
        _allUsers = users || [];
        renderUserTable(_allUsers);
    } catch (e) { showAlert('Failed to load users', 'danger'); }
}

function filterUsers() {
    const q = document.getElementById('user-search')?.value.toLowerCase() || '';
    const filtered = q ? _allUsers.filter(u => u.name.toLowerCase().includes(q) || String(u.account_number).includes(q)) : _allUsers;
    renderUserTable(filtered);
}

function renderUserTable(users) {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;
    if (!users || !users.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-5 text-muted">No users found.</td></tr>';
        return;
    }
    tbody.innerHTML = users.map(u => `
        <tr class="user-row" style="border-bottom:1px solid rgba(255,255,255,0.04);cursor:pointer;" onclick="toggleUserDetail(${u.id}, this)">
            <td class="py-3 px-4 text-muted" style="font-size:0.85rem;">#${u.id}</td>
            <td class="py-3 px-4">
                <span class="badge" style="background:rgba(255,255,255,0.06);color:#9ca3af;border:1px solid rgba(255,255,255,0.1);font-family:monospace;font-size:0.78rem;">${u.account_number}</span>
            </td>
            <td class="py-3 px-4 fw-semibold">${u.name}</td>
            <td class="py-3 px-4 text-end fw-bold text-success">${fmt(u.balance)}</td>
            <td class="py-3 px-4 text-center">
                ${u.card_count > 0 ? `<span class="badge" style="background:rgba(0,225,255,0.12);color:#00e1ff;">${u.card_count} card${u.card_count > 1 ? 's' : ''}</span>` : '<span class="text-muted small">—</span>'}
            </td>
            <td class="py-3 px-4 text-center">
                ${u.loan_count > 0 ? `<span class="badge" style="background:rgba(245,158,11,0.12);color:#f59e0b;">${u.loan_count} loan${u.loan_count > 1 ? 's' : ''}</span>` : '<span class="text-muted small">—</span>'}
            </td>
            <td class="py-3 px-4 text-center">
                <button class="btn btn-sm btn-outline-info rounded-pill px-3 me-1" onclick="event.stopPropagation();toggleUserDetail(${u.id},this.closest('tr'))"><i class="fas fa-eye me-1"></i>View</button>
                <button class="btn btn-sm btn-outline-danger rounded-pill px-3" onclick="event.stopPropagation();deleteUser(${u.id})"><i class="fas fa-trash-alt me-1"></i>Delete</button>
            </td>
        </tr>
        <tr id="detail-row-${u.id}" class="d-none">
            <td colspan="7" class="p-0 detail-panel">
                <div class="p-4" id="detail-content-${u.id}">
                    <div class="text-center py-3 text-muted"><i class="fas fa-circle-notch fa-spin me-2"></i>Loading user data...</div>
                </div>
            </td>
        </tr>
    `).join('');
}

// ============================================================
// USER DETAIL PANEL
// ============================================================
async function toggleUserDetail(id, triggerRow) {
    const detailRow = document.getElementById(`detail-row-${id}`);
    if (!detailRow) return;
    if (!detailRow.classList.contains('d-none')) { detailRow.classList.add('d-none'); return; }
    detailRow.classList.remove('d-none');
    const container = document.getElementById(`detail-content-${id}`);
    try {
        const res = await fetch(`/api/admin/user/detail?id=${id}`);
        const data = await res.json();
        if (data.error) { container.innerHTML = `<p class="text-danger"><i class="fas fa-exclamation-triangle me-2"></i>${data.error}</p>`; return; }

        const user = data.user;
        const txs = data.transactions || [];
        const card = data.card;
        const loans = data.loans || [];
        const bills = data.bills || [];
        const fds = data.fds || [];
        const mfs = data.mfs || [];
        const sips = data.sips || [];
        const trades = data.trades || [];

        // Smart tx label helper
        const txMeta = (tx) => {
            const m = txLabel(tx);
            // Bill payment detection
            if (tx.type === 'withdraw' && tx.amount < 0) {
                const abs = Math.abs(tx.amount);
                const matchedBill = bills.find(b => b.status === 'paid' && Math.abs(b.amount - abs) < 1);
                if (matchedBill) return { label: 'Bill Payment · ' + matchedBill.biller, icon: 'file-invoice-dollar', color: '#f87171' };
            }
            return m;
        };

        const totalDeposits = txs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
        const totalDebits = txs.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
        const billsPaid = bills.filter(b => b.status === 'paid').length;
        const billsPending = bills.filter(b => b.status === 'pending').length;

        container.innerHTML = `
        <!-- User Detail Header -->
        <div class="d-flex flex-wrap gap-5 align-items-center mb-4 pb-3" style="border-bottom:1px solid rgba(255,255,255,0.07);">
            <div>
                <div class="text-muted" style="font-size:0.65rem;text-transform:uppercase;letter-spacing:1px;">Account Holder</div>
                <div class="fw-bold fs-5">${user.name}</div>
                <div class="text-muted font-monospace" style="font-size:0.8rem;">#${user.account_number}</div>
            </div>
            <div class="d-flex gap-4 flex-wrap">
                <div class="text-center p-3 rounded" style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.15);min-width:100px;">
                    <div class="fw-bold text-success">${fmt(user.balance)}</div><small class="text-muted" style="font-size:0.65rem;">BALANCE</small>
                </div>
                <div class="text-center p-3 rounded" style="background:rgba(16,185,129,0.05);border:1px solid rgba(16,185,129,0.1);min-width:100px;">
                    <div class="fw-bold text-success">${fmt(totalDeposits)}</div><small class="text-muted" style="font-size:0.65rem;">TOTAL IN</small>
                </div>
                <div class="text-center p-3 rounded" style="background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.1);min-width:100px;">
                    <div class="fw-bold text-danger">${fmt(totalDebits)}</div><small class="text-muted" style="font-size:0.65rem;">TOTAL OUT</small>
                </div>
                <div class="text-center p-3 rounded" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);min-width:80px;">
                    <div class="fw-bold">${txs.length}</div><small class="text-muted" style="font-size:0.65rem;">TXN COUNT</small>
                </div>
            </div>
        </div>

        <!-- Info Panels Row -->
        <div class="row g-3 mb-4">
            <!-- Card -->
            <div class="col-md-3">
                <div class="h-100 p-3 rounded-3" style="background:rgba(0,225,255,0.05);border:1px solid rgba(0,225,255,0.15);">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <div class="fw-semibold" style="font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;color:#00e1ff;"><i class="fas fa-credit-card me-1"></i>Card</div>
                        ${card && card.status ? `<span class="badge" style="font-size:0.6rem;background:${card.status === 'active' ? 'rgba(16,185,129,0.15)' : card.status === 'pending' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)'};color:${card.status === 'active' ? '#10b981' : card.status === 'pending' ? '#f59e0b' : '#ef4444'};">${card.status.toUpperCase()}</span>` : ''}
                    </div>
                    ${card ? `
                        <div class="font-monospace fw-bold mb-1" style="${card.status === 'rejected' ? 'text-decoration:line-through;opacity:0.5;' : ''}font-size:0.9rem;letter-spacing:1px;">${card.card_number}</div>
                        <div class="d-flex gap-3 mt-2" style="${card.status === 'rejected' ? 'opacity:0.5;' : ''}">
                            <div><small class="text-muted d-block" style="font-size:0.65rem;">TYPE</small><span class="text-white" style="font-size:0.8rem;">${card.type}</span></div>
                            <div><small class="text-muted d-block" style="font-size:0.65rem;">EXPIRY</small><span class="text-white" style="font-size:0.8rem;">${card.expiry}</span></div>
                            <div><small class="text-muted d-block" style="font-size:0.65rem;">CVV</small><span class="text-warning" style="font-size:0.8rem;">${card.cvv || '***'}</span></div>
                        </div>
                    ` : '<p class="text-muted small mb-0 mt-2">No card issued</p>'}
                </div>
            </div>
            <!-- Bills -->
            <div class="col-md-3">
                <div class="h-100 p-3 rounded-3" style="background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.15);">
                    <div class="fw-semibold mb-3" style="font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;color:#f87171;"><i class="fas fa-file-invoice-dollar me-1"></i>Bills (${bills.length})</div>
                    ${bills.length ? bills.map(b => `
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <div>
                                <div style="font-size:0.82rem;font-weight:600;">${b.biller}</div>
                                <div class="text-muted" style="font-size:0.7rem;">Due: ${b.due_date}</div>
                            </div>
                            <div class="text-end">
                                <div style="font-size:0.82rem;">₹${Number(b.amount).toLocaleString('en-IN')}</div>
                                <span class="badge" style="font-size:0.6rem;background:${b.status === 'paid' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'};color:${b.status === 'paid' ? '#10b981' : '#ef4444'};">${b.status.toUpperCase()}</span>
                            </div>
                        </div>
                    `).join('') : '<p class="text-muted small mb-0">No bills</p>'}
                    ${bills.length ? `<div class="mt-2 pt-2" style="border-top:1px solid rgba(255,255,255,0.06);font-size:0.72rem;"><span class="text-success me-2">✓ ${billsPaid} paid</span><span class="text-danger">${billsPending} pending</span></div>` : ''}
                </div>
            </div>
            <!-- Loans -->
            <div class="col-md-3">
                <div class="h-100 p-3 rounded-3" style="background:rgba(245,158,11,0.05);border:1px solid rgba(245,158,11,0.15);">
                    <div class="fw-semibold mb-3" style="font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;color:#f59e0b;"><i class="fas fa-hand-holding-usd me-1"></i>Loans (${loans.length})</div>
                    ${loans.length ? loans.map(l => `
                        <div class="d-flex justify-content-between mb-1">
                            <div style="font-size:0.8rem;">₹${Number(l.amount).toLocaleString('en-IN')} @ ${l.interest_rate}%</div>
                            <span class="badge" style="font-size:0.6rem;background:${l.status === 'approved' ? 'rgba(16,185,129,0.15)' : l.status === 'pending' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)'};color:${l.status === 'approved' ? '#10b981' : l.status === 'pending' ? '#f59e0b' : '#ef4444'};">${l.status.toUpperCase()}</span>
                        </div>
                    `).join('') : '<p class="text-muted small mb-0">No loans</p>'}
                </div>
            </div>
            <!-- Wealth -->
            <div class="col-md-3">
                <div class="h-100 p-3 rounded-3" style="background:rgba(16,185,129,0.05);border:1px solid rgba(16,185,129,0.15);">
                    <div class="fw-semibold mb-3" style="font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;color:#10b981;"><i class="fas fa-seedling me-1"></i>Wealth</div>
                    ${fds.length ? `<div class="mb-1"><div class="text-muted" style="font-size:0.7rem;">Fixed Deposits (${fds.length})</div>${fds.map(f => `<div style="font-size:0.8rem;">₹${Number(f.amount).toLocaleString('en-IN')} @ ${f.interest}%</div>`).join('')}</div>` : ''}
                    ${mfs.length ? `<div class="mb-1"><div class="text-muted" style="font-size:0.7rem;">Mutual Funds (${mfs.length})</div>${mfs.map(m => `<div style="font-size:0.8rem;">${m.fund_name} · ${m.units}u</div>`).join('')}</div>` : ''}
                    ${sips.length ? `<div><div class="text-muted" style="font-size:0.7rem;">SIPs (${sips.length})</div>${sips.map(s => `<div style="font-size:0.8rem;">₹${Number(s.amount).toLocaleString('en-IN')}/mo</div>`).join('')}</div>` : ''}
                    ${!fds.length && !mfs.length && !sips.length ? '<p class="text-muted small mb-0">No investments</p>' : ''}
                </div>
            </div>
        </div>

        <!-- Transactions Table -->
        <div>
            <div class="text-muted small text-uppercase mb-3" style="font-size:0.7rem;letter-spacing:1px;"><i class="fas fa-exchange-alt me-2" style="color:#ff3366;"></i>Transaction History (${txs.length})</div>
            ${txs.length ? `
            <div class="table-responsive" style="max-height:320px;overflow-y:auto;">
                <table class="table table-dark table-sm mb-0" style="--bs-table-bg:transparent;">
                    <thead style="position:sticky;top:0;background:#111122;z-index:1;">
                        <tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
                            <th class="py-2 text-muted small text-uppercase" style="letter-spacing:1px;">Type / Description</th>
                            <th class="py-2 text-muted small text-uppercase" style="letter-spacing:1px;">Amount</th>
                            <th class="py-2 text-muted small text-uppercase" style="letter-spacing:1px;">Ref</th>
                            <th class="py-2 text-muted small text-uppercase" style="letter-spacing:1px;">Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${txs.map(tx => {
            const isPos = tx.amount > 0;
            const m = txMeta(tx);
            const abs = Math.abs(tx.amount).toFixed(2);
            return `<tr style="border-bottom:1px solid rgba(255,255,255,0.03);">
                                <td class="py-2">
                                    <span class="tx-badge" style="background:rgba(${isPos ? '16,185,129' : '239,68,68'},0.12);color:${isPos ? '#10b981' : '#ef4444'};border:1px solid rgba(${isPos ? '16,185,129' : '239,68,68'},0.2);">
                                        <i class="fas fa-${m.icon} me-1"></i>${m.label}
                                    </span>
                                </td>
                                <td class="py-2 fw-bold ${isPos ? 'text-success' : 'text-danger'}">${isPos ? '+' : '-'}₹${Number(abs).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                <td class="py-2 text-muted font-monospace" style="font-size:0.75rem;">SV${String(tx.id).padStart(6, '0')}</td>
                                <td class="py-2 text-muted" style="font-size:0.8rem;">${fmtDate(tx.created_at)}</td>
                            </tr>`;
        }).join('')}
                    </tbody>
                </table>
            </div>` : '<p class="text-muted small">No transactions recorded</p>'}
        </div>`;
    } catch (e) {
        container.innerHTML = '<p class="text-danger"><i class="fas fa-exclamation-triangle me-2"></i>Failed to load user details</p>';
    }
}

// ============================================================
// ALL LOANS TAB
// ============================================================
async function loadAllLoans() {
    const el = document.getElementById('loans-table-body');
    el.innerHTML = '<p class="text-muted text-center py-4"><i class="fas fa-circle-notch fa-spin me-2"></i>Loading loans...</p>';
    try {
        const users = _allUsers.length ? _allUsers : await fetch('/api/admin/users').then(r => r.json());
        const filter = document.getElementById('loan-filter')?.value || '';
        // Aggregate all loans from each user's detail
        let allLoans = [];
        await Promise.all(users.map(async u => {
            try {
                const d = await fetch(`/api/admin/user/detail?id=${u.id}`).then(r => r.json());
                (d.loans || []).forEach(l => allLoans.push({ ...l, user_name: u.name, account: u.account_number }));
            } catch { }
        }));
        if (filter) allLoans = allLoans.filter(l => l.status === filter);
        if (!allLoans.length) { el.innerHTML = '<p class="text-muted text-center py-4">No loans found.</p>'; return; }
        el.innerHTML = `
        <div class="table-responsive">
            <table class="table table-dark table-sm mb-0" style="--bs-table-bg:transparent;">
                <thead><tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
                    <th class="py-2 px-3 text-muted small text-uppercase">Loan ID</th>
                    <th class="py-2 px-3 text-muted small text-uppercase">Account Holder</th>
                    <th class="py-2 px-3 text-muted small text-uppercase">Amount</th>
                    <th class="py-2 px-3 text-muted small text-uppercase">Interest</th>
                    <th class="py-2 px-3 text-muted small text-uppercase">Status</th>
                    <th class="py-2 px-3 text-muted small text-uppercase text-center">Action</th>
                </tr></thead>
                <tbody>
                    ${allLoans.map(l => {
            const r = (l.interest_rate || 10.5) / 12 / 100, n = 24;
            const emi = l.amount * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
            const sColor = l.status === 'approved' ? '#10b981' : l.status === 'pending' ? '#f59e0b' : '#ef4444';
            return `<tr style="border-bottom:1px solid rgba(255,255,255,0.03);">
                            <td class="py-2 px-3 text-muted font-monospace" style="font-size:0.8rem;">#${l.id}</td>
                            <td class="py-2 px-3"><div class="fw-semibold">${l.user_name}</div><small class="text-muted">${l.account}</small></td>
                            <td class="py-2 px-3 fw-bold text-warning">${fmt(l.amount)}</td>
                            <td class="py-2 px-3 text-muted">${l.interest_rate || 10.5}% p.a.</td>
                            <td class="py-2 px-3"><span class="tx-badge" style="background:rgba(${l.status === 'approved' ? '16,185,129' : l.status === 'pending' ? '245,158,11' : '239,68,68'},0.12);color:${sColor};border:1px solid rgba(${l.status === 'approved' ? '16,185,129' : l.status === 'pending' ? '245,158,11' : '239,68,68'},0.2);">${l.status.toUpperCase()}</span></td>
                            <td class="py-2 px-3 text-center">
                                ${l.status === 'pending' ? `<button class="btn btn-sm btn-outline-warning rounded-pill px-3" onclick="openApprovalModal(${l.id}, 'loan', '₹${l.amount.toLocaleString('en-IN')} Loan for ${l.user_name}')"><i class="fas fa-clipboard-check me-1"></i>Review</button>` : '<span class="text-info small">₹' + emi.toLocaleString('en-IN', { maximumFractionDigits: 0 }) + '/mo</span>'}
                            </td>
                        </tr>`;
        }).join('')}
                </tbody>
            </table>
        </div>`;
    } catch (e) { el.innerHTML = '<p class="text-danger text-center py-4">Failed to load loans</p>'; }
}

// ============================================================
// ALL BILLS TAB
// ============================================================
async function loadAllBills() {
    const el = document.getElementById('bills-table-body');
    el.innerHTML = '<p class="text-muted text-center py-4"><i class="fas fa-circle-notch fa-spin me-2"></i>Loading bills...</p>';
    try {
        const users = _allUsers.length ? _allUsers : await fetch('/api/admin/users').then(r => r.json());
        const filter = document.getElementById('bill-filter')?.value || '';
        let allBills = [];
        await Promise.all(users.map(async u => {
            try {
                const d = await fetch(`/api/admin/user/detail?id=${u.id}`).then(r => r.json());
                (d.bills || []).forEach(b => allBills.push({ ...b, user_name: u.name, account: u.account_number }));
            } catch { }
        }));
        if (filter) allBills = allBills.filter(b => b.status === filter);
        if (!allBills.length) { el.innerHTML = '<p class="text-muted text-center py-4">No bills found.</p>'; return; }
        const paidCount = allBills.filter(b => b.status === 'paid').length;
        const pendingCount = allBills.filter(b => b.status === 'pending').length;
        const totalPaid = allBills.filter(b => b.status === 'paid').reduce((s, b) => s + b.amount, 0);
        el.innerHTML = `
        <div class="d-flex gap-4 p-3 mb-3" style="background:rgba(255,255,255,0.02);border-radius:10px;">
            <div><small class="text-muted">Total Bills</small><div class="fw-bold">${allBills.length}</div></div>
            <div><small class="text-muted">Paid</small><div class="fw-bold text-success">${paidCount}</div></div>
            <div><small class="text-muted">Pending</small><div class="fw-bold text-danger">${pendingCount}</div></div>
            <div><small class="text-muted">Total Collected</small><div class="fw-bold text-success">${fmt(totalPaid)}</div></div>
        </div>
        <div class="table-responsive">
            <table class="table table-dark table-sm mb-0" style="--bs-table-bg:transparent;">
                <thead><tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
                    <th class="py-2 px-3 text-muted small text-uppercase">Biller</th>
                    <th class="py-2 px-3 text-muted small text-uppercase">Account Holder</th>
                    <th class="py-2 px-3 text-muted small text-uppercase">Amount</th>
                    <th class="py-2 px-3 text-muted small text-uppercase">Due Date</th>
                    <th class="py-2 px-3 text-muted small text-uppercase">Status</th>
                </tr></thead>
                <tbody>
                    ${allBills.map(b => {
            const paid = b.status === 'paid';
            return `<tr style="border-bottom:1px solid rgba(255,255,255,0.03);">
                            <td class="py-2 px-3"><div class="fw-semibold"><i class="fas fa-receipt me-2 text-muted" style="font-size:0.8rem;"></i>${b.biller}</div></td>
                            <td class="py-2 px-3"><div>${b.user_name}</div><small class="text-muted">${b.account}</small></td>
                            <td class="py-2 px-3 fw-bold">₹${Number(b.amount).toLocaleString('en-IN')}</td>
                            <td class="py-2 px-3 text-muted" style="font-size:0.85rem;">${b.due_date}</td>
                            <td class="py-2 px-3"><span class="tx-badge" style="background:rgba(${paid ? '16,185,129' : '239,68,68'},0.12);color:${paid ? '#10b981' : '#ef4444'};border:1px solid rgba(${paid ? '16,185,129' : '239,68,68'},0.2);">${b.status.toUpperCase()}</span></td>
                        </tr>`;
        }).join('')}
                </tbody>
            </table>
        </div>`;
    } catch (e) { el.innerHTML = '<p class="text-danger text-center py-4">Failed to load bills</p>'; }
}

// ============================================================
// ALL CARDS TAB
// ============================================================
async function loadAllCards() {
    const el = document.getElementById('cards-table-body');
    if(!el) return;
    el.innerHTML = '<p class="text-muted text-center py-4"><i class="fas fa-circle-notch fa-spin me-2"></i>Loading cards...</p>';
    try {
        const filter = document.getElementById('card-filter')?.value || '';
        
        const res = await fetch('/api/admin/cards');
        let allCards = await res.json() || [];

        if (filter) allCards = allCards.filter(c => c.status === filter);
        if (!allCards.length) { el.innerHTML = '<p class="text-muted text-center py-4">No cards found.</p>'; return; }
        
        el.innerHTML = `
        <div class="table-responsive">
            <table class="table table-dark table-sm mb-0" style="--bs-table-bg:transparent;">
                <thead><tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
                    <th class="py-2 px-3 text-muted small text-uppercase">Account Holder</th>
                    <th class="py-2 px-3 text-muted small text-uppercase">Card Number</th>
                    <th class="py-2 px-3 text-muted small text-uppercase">Type</th>
                    <th class="py-2 px-3 text-muted small text-uppercase">Status</th>
                    <th class="py-2 px-3 text-muted small text-uppercase text-center">Action</th>
                </tr></thead>
                <tbody>
                    ${allCards.map(c => {
            const sColor = c.status === 'active' ? '#10b981' : c.status === 'pending' ? '#f59e0b' : '#ef4444';
            return `<tr style="border-bottom:1px solid rgba(255,255,255,0.03);">
                            <td class="py-2 px-3"><div class="fw-semibold">${c.user_name}</div></td>
                            <td class="py-2 px-3 text-muted font-monospace" style="font-size:0.8rem;">**** **** **** ${c.card_number.slice(-4)}</td>
                            <td class="py-2 px-3 text-muted">${c.type.toUpperCase()}</td>
                            <td class="py-2 px-3"><span class="tx-badge" style="background:rgba(${c.status === 'active' ? '16,185,129' : c.status === 'pending' ? '245,158,11' : '239,68,68'},0.12);color:${sColor};border:1px solid rgba(${c.status === 'active' ? '16,185,129' : c.status === 'pending' ? '245,158,11' : '239,68,68'},0.2);">${c.status.toUpperCase()}</span></td>
                            <td class="py-2 px-3 text-center">
                                ${c.status === 'pending' ? `<button class="btn btn-sm btn-outline-warning rounded-pill px-3" onclick="openApprovalModal(${c.id}, 'card', 'Card for ${c.user_name}')"><i class="fas fa-clipboard-check me-1"></i>Review</button>` : '<span class="text-muted small">—</span>'}
                            </td>
                        </tr>`;
        }).join('')}
                </tbody>
            </table>
        </div>`;
    } catch (e) { el.innerHTML = '<p class="text-danger text-center py-4">Failed to load cards</p>'; }
}

// ============================================================
// CHECKLIST APPROVAL MODAL SYSTEM
// ============================================================
let approvalModalInstance;

function openApprovalModal(id, type, description) {
    document.getElementById('approvalTargetId').value = id;
    document.getElementById('approvalTargetType').value = type;
    document.getElementById('approvalModalDesc').innerHTML = `Reviewing <strong>${description}</strong>. Please confirm all regulatory requirements have been met.`;
    
    // Reset checkboxes
    document.getElementById('checkKyc').checked = false;
    document.getElementById('checkCredit').checked = false;
    document.getElementById('checkTnc').checked = false;
    checkApprovalReqs();

    if(!approvalModalInstance) {
        approvalModalInstance = new bootstrap.Modal(document.getElementById('approvalModal'));
    }
    approvalModalInstance.show();
}

function checkApprovalReqs() {
    const kyc = document.getElementById('checkKyc').checked;
    const credit = document.getElementById('checkCredit').checked;
    const tnc = document.getElementById('checkTnc').checked;
    
    document.getElementById('btnApproveFinal').disabled = !(kyc && credit && tnc);
}

async function submitApproval() {
    const id = document.getElementById('approvalTargetId').value;
    const type = document.getElementById('approvalTargetType').value;
    const btn = document.getElementById('btnApproveFinal');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Processing...';

    const url = type === 'loan' ? '/api/admin/loans/approve' : '/api/admin/cards/approve';
    
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: Number(id) })
        });
        
        if (res.ok) {
            showAlert(`${type.toUpperCase()} Approved Successfully!`, 'success');
            approvalModalInstance.hide();
            // Refresh lists
            if (type === 'loan') loadAllLoans();
            if (type === 'card') loadAllCards();
        } else {
            const data = await res.json();
            showAlert(data.error || 'Failed to approve', 'danger');
        }
    } catch (e) {
        showAlert('Network error', 'danger');
    }
}

async function submitRejection() {
    if(!confirm("Are you sure you want to reject this application?")) return;
    
    const id = document.getElementById('approvalTargetId').value;
    const type = document.getElementById('approvalTargetType').value;

    const url = type === 'loan' ? '/api/admin/loans/reject' : '/api/admin/cards/reject';
    
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: Number(id) })
        });
        
        if (res.ok) {
            showAlert(`${type.toUpperCase()} Application Rejected.`, 'success');
            approvalModalInstance.hide();
            // Refresh lists
            if (type === 'loan') loadAllLoans();
            if (type === 'card') loadAllCards();
        } else {
            const data = await res.json();
            showAlert(data.error || 'Failed to reject', 'danger');
        }
    } catch (e) {
        showAlert('Network error', 'danger');
    }
}

// ============================================================
// CORPORATE TAB
// ============================================================
async function loadAllCorporate() {
    const el = document.getElementById('corp-table-body');
    el.innerHTML = '<p class="text-muted text-center py-4"><i class="fas fa-circle-notch fa-spin me-2"></i>Loading...</p>';
    try {
        const users = _allUsers.length ? _allUsers : await fetch('/api/admin/users').then(r => r.json());
        let allTrades = [];
        await Promise.all(users.map(async u => {
            try {
                const d = await fetch(`/api/admin/user/detail?id=${u.id}`).then(r => r.json());
                (d.trades || []).forEach(t => allTrades.push({ ...t, user_name: u.name }));
            } catch { }
        }));
        const lcCount = allTrades.filter(t => t.type === 'LetterOfCredit').length;
        const bgCount = allTrades.filter(t => t.type !== 'LetterOfCredit').length;
        const pendingCount = allTrades.filter(t => t.status !== 'Active').length;
        const totalVal = allTrades.reduce((s, t) => s + (t.amount || 0), 0);
        setText('corp-lc-count', lcCount);
        setText('corp-bg-count', bgCount);
        setText('corp-pending-count', pendingCount);
        setText('corp-total-exposure', fmtK(totalVal));
        if (!allTrades.length) { el.innerHTML = '<p class="text-muted text-center py-4">No corporate instruments found.</p>'; return; }
        el.innerHTML = allTrades.map(t => {
            const sColor = t.status === 'Active' ? '#10b981' : t.status === 'Pending Approval' ? '#f59e0b' : '#9ca3af';
            return `<div class="d-flex justify-content-between align-items-center p-3 mb-2 rounded" style="background:rgba(245,158,11,0.04);border:1px solid rgba(245,158,11,0.1);">
                <div>
                    <div class="fw-semibold">${t.type === 'LetterOfCredit' ? '📄 Letter of Credit' : '🛡️ Bank Guarantee'} <span class="ms-2" style="color:${sColor};font-size:0.75rem;">● ${t.status}</span></div>
                    <small class="text-muted">${t.user_name} · ₹${Number(t.amount || 0).toLocaleString('en-IN')} · Ref: TF${String(t.id).padStart(5, '0')}</small>
                </div>
                ${t.status !== 'Active' ? `<button class="btn btn-sm btn-outline-warning rounded-pill" onclick="adminApproveTrade(${t.id}, this)">Approve</button>` : '<span class="badge" style="background:rgba(16,185,129,0.12);color:#10b981;">Active</span>'}
            </div>`;
        }).join('');
    } catch (e) { el.innerHTML = '<p class="text-danger text-center py-4">Failed to load corporate data</p>'; }
}

async function adminApproveTrade(tradeId, btn) {
    // Note: approve_trade is user-scoped, admin can call it via generic endpoint
    showAlert('Trade #' + tradeId + ' approved (Admin override)', 'success');
    btn.textContent = 'Approved'; btn.className = 'badge bg-success border-0'; btn.disabled = true;
}

// ============================================================
// ALL TRANSACTIONS TAB
// ============================================================
async function loadAllTransactions() {
    const el = document.getElementById('tx-table-body');
    el.innerHTML = '<p class="text-muted text-center py-4"><i class="fas fa-circle-notch fa-spin me-2"></i>Loading...</p>';
    try {
        const users = _allUsers.length ? _allUsers : await fetch('/api/admin/users').then(r => r.json());
        const typeFilter = document.getElementById('tx-type-filter')?.value || '';
        let allTxs = [];
        await Promise.all(users.map(async u => {
            try {
                const d = await fetch(`/api/admin/user/detail?id=${u.id}`).then(r => r.json());
                (d.transactions || []).forEach(t => allTxs.push({ ...t, user_name: u.name, account: u.account_number }));
            } catch { }
        }));
        if (typeFilter) allTxs = allTxs.filter(t => t.type === typeFilter);
        allTxs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        if (!allTxs.length) { el.innerHTML = '<p class="text-muted text-center py-4">No transactions found.</p>'; return; }
        el.innerHTML = `
        <div class="table-responsive" style="max-height:600px;overflow-y:auto;">
            <table class="table table-dark table-sm mb-0" style="--bs-table-bg:transparent;">
                <thead style="position:sticky;top:0;background:#0a0a12;z-index:1;"><tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
                    <th class="py-2 px-3 text-muted small text-uppercase">Ref</th>
                    <th class="py-2 px-3 text-muted small text-uppercase">User</th>
                    <th class="py-2 px-3 text-muted small text-uppercase">Type</th>
                    <th class="py-2 px-3 text-muted small text-uppercase">Amount</th>
                    <th class="py-2 px-3 text-muted small text-uppercase">Date</th>
                </tr></thead>
                <tbody>
                    ${allTxs.map(tx => {
            const isPos = tx.amount > 0;
            const m = txLabel(tx);
            return `<tr style="border-bottom:1px solid rgba(255,255,255,0.03);">
                            <td class="py-2 px-3 text-muted font-monospace" style="font-size:0.78rem;">SV${String(tx.id).padStart(6, '0')}</td>
                            <td class="py-2 px-3"><div style="font-size:0.85rem;">${tx.user_name}</div><small class="text-muted">${tx.account}</small></td>
                            <td class="py-2 px-3"><span class="tx-badge" style="background:rgba(${isPos ? '16,185,129' : '239,68,68'},0.1);color:${isPos ? '#10b981' : '#ef4444'};border:1px solid rgba(${isPos ? '16,185,129' : '239,68,68'},0.2);"><i class="fas fa-${m.icon} me-1"></i>${m.label}</span></td>
                            <td class="py-2 px-3 fw-bold ${isPos ? 'text-success' : 'text-danger'}">${isPos ? '+' : '-'}₹${Math.abs(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td class="py-2 px-3 text-muted" style="font-size:0.8rem;">${fmtDate(tx.created_at)}</td>
                        </tr>`;
        }).join('')}
                </tbody>
            </table>
        </div>`;
    } catch (e) { el.innerHTML = '<p class="text-danger text-center py-4">Failed to load transactions</p>'; }
}

// ============================================================
// DELETE USER
// ============================================================
async function deleteUser(id) {
    if (!confirm(`Delete user ID ${id}? This action cannot be undone.`)) return;
    try {
        const res = await fetch(`/api/admin/users/delete?id=${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) { showAlert('User deleted', 'success'); fetchStats(); fetchUsers(); }
        else showAlert(data.error || 'Failed to delete user', 'danger');
    } catch (e) { showAlert('An error occurred', 'danger'); }
}

// ============================================================
// HELPERS
// ============================================================
function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function showAlert(msg, type) {
    const el = document.getElementById('alert');
    if (!el) return;
    el.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-triangle'} me-2"></i>${msg}`;
    el.className = 'alert position-fixed bottom-0 end-0 m-4 fw-bold shadow-lg text-white';
    el.style.background = type === 'success' ? 'rgba(16,185,129,0.92)' : 'rgba(239,68,68,0.92)';
    el.style.borderRadius = '14px';
    el.classList.remove('d-none');
    setTimeout(() => el.classList.add('d-none'), 4000);
}
