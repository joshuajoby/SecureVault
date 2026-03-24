// dashboard.js - SecureVault Banking Dashboard
const api = (path, opts = {}) => fetch('/api' + path, opts).then(r => r.json()).catch(() => ({ error: 'Network error' }));

function showAlert(msg, type = 'danger') {
    const a = document.getElementById('alert');
    if (!a) return;
    const icon = type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : 'exclamation-circle';
    const bg = type === 'success' ? 'rgba(16,185,129,0.95)' : type === 'warning' ? 'rgba(255,176,58,0.95)' : 'rgba(239,68,68,0.95)';
    a.style.background = bg;
    a.className = 'alert position-fixed bottom-0 end-0 m-4 fw-bold shadow-lg text-white';
    a.style.cssText = 'z-index:1050;border:none;min-width:300px;border-radius:12px;backdrop-filter:blur(10px);background:' + bg;
    a.innerHTML = '<i class="fas fa-' + icon + ' me-2"></i>' + msg;
    a.classList.remove('d-none');
    clearTimeout(a._timer);
    a._timer = setTimeout(() => a.classList.add('d-none'), 4000);
}

let currentBalance = 0;
let _allTxs = [];

// ===== WAIT FOR DOM =====
document.addEventListener('DOMContentLoaded', () => {

    // -- TIME --
    const timeEl = document.getElementById('current-time');
    function updateTime() { if (timeEl) timeEl.textContent = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); }
    updateTime(); setInterval(updateTime, 30000);

    // -- SIDEBAR NAVIGATION --
    const sidebarBtns = document.querySelectorAll('.sidebar-btn[data-section]');
    const sections = document.querySelectorAll('.dashboard-section');

    window.showSection = function (name) {
        sections.forEach(s => s.classList.add('d-none'));
        const target = document.getElementById('section-' + name);
        if (target) target.classList.remove('d-none');
        sidebarBtns.forEach(b => b.classList.remove('active'));
        const active = document.querySelector('.sidebar-btn[data-section="' + name + '"]');
        if (active) active.classList.add('active');
    };

    sidebarBtns.forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            showSection(this.getAttribute('data-section'));
        });
    });

    // -- NOTIFICATIONS --
    const notifBtn = document.getElementById('notif-btn');
    const notifDrop = document.getElementById('notif-dropdown');
    if (notifBtn && notifDrop) {
        notifBtn.addEventListener('click', (e) => { e.stopPropagation(); notifDrop.classList.toggle('d-none'); });
        document.addEventListener('click', () => notifDrop.classList.add('d-none'));
    }

    // -- LOAD ACCOUNT --
    async function loadAccount() {
        const res = await api('/me');
        if (res.error || !res.account) {
            showAlert('Session expired. Redirecting to login...', 'danger');
            setTimeout(() => { window.location = '/auth.html'; }, 2000);
            return;
        }
        const acc = res.account;
        currentBalance = parseFloat(acc.balance || 0);
        setText('user-name', acc.name);
        setText('full-name', acc.name);
        setText('account-number', acc.account_number);
        setText('account-no', acc.account_number);
        setText('balance', '₹' + currentBalance.toFixed(2));
        setText('available-balance', '₹' + currentBalance.toFixed(2));
        const sn = document.getElementById('settings-name');
        if (sn) sn.value = acc.name;
        const sa = document.getElementById('settings-accno');
        if (sa) sa.value = acc.account_number;
        loadTransactions();
    }

    function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
    function updateBalanceUI() {
        setText('balance', '₹' + currentBalance.toFixed(2));
        setText('available-balance', '₹' + currentBalance.toFixed(2));
        const w = document.getElementById('withdraw-available'); if (w) w.textContent = currentBalance.toFixed(2);
        const t = document.getElementById('transfer-available-balance'); if (t) t.textContent = currentBalance.toFixed(2);
    }

    // -- TRANSACTIONS --
    async function loadTransactions() {
        const res = await api('/transactions');
        const txs = (res && res.transactions) ? res.transactions : [];

        // Apply any pending note (e.g. from a just-completed withdrawal)
        if (window._pendingTxNote && txs.length) {
            const pn = window._pendingTxNote;
            // Find the newest transaction matching type+amount
            const match = [...txs].reverse().find(t => t.type === pn.type && Math.abs(parseFloat(t.amount || 0)) === Math.abs(pn.amount));
            if (match) { saveTxNote(match, pn.note); }
            window._pendingTxNote = null;
        }

        _allTxs = txs; // store for filtering
        let totalDep = 0, totalWith = 0;

        if (txs.length === 0) {
            const empty = '<div class="text-center py-4 text-muted"><i class="fas fa-inbox fa-2x mb-2 opacity-25"></i><p class="mb-0">No transactions yet</p></div>';
            setHTML('transactions-list', empty);
            setHTML('all-transactions-list', empty);
        } else {
            // Home overview: last 5 with enhanced renderer
            const homeHtml = txs.slice(0, 5).map(buildTxRow).join('');
            setHTML('transactions-list', homeHtml);
            // Full history
            renderTxList(txs);
            txs.forEach(tx => {
                const amt = Math.abs(parseFloat(tx.amount || 0));
                if (tx.type === 'deposit') totalDep += amt;
                if (tx.type === 'withdraw') totalWith += amt;
            });
        }
        setText('transaction-count', txs.length.toString());
        setText('total-deposits', '₹' + totalDep.toFixed(2));
        setText('total-withdrawals', '₹' + totalWith.toFixed(2));
        renderAnalytics(txs);
    }

    function setHTML(id, h) { const el = document.getElementById(id); if (el) el.innerHTML = h; }

    // -- ANALYTICS --
    function renderAnalytics(txs) {
        const c = document.getElementById('analytics-bars');
        const lbl = document.getElementById('analytics-labels');
        if (!c) return;

        const recent = txs.slice(0, 10).reverse();
        if (recent.length === 0) {
            c.innerHTML = '<p class="text-muted small m-auto text-center">Make transactions to see analytics</p>';
            return;
        }

        const maxAmt = Math.max(...recent.map(t => Math.abs(parseFloat(t.amount))), 1);
        setText('analytics-max', '₹' + maxAmt.toFixed(0));
        setText('analytics-mid', '₹' + (maxAmt / 2).toFixed(0));

        let bars = '', labels = '';
        let totalIn = 0, totalOut = 0;
        const catCounts = {};

        recent.forEach(tx => {
            const amt = Math.abs(parseFloat(tx.amount));
            const pct = Math.max((amt / maxAmt) * 100, 5);
            const isDep = ['deposit', 'loan_deposit', 'transfer_in', 'loan_disbursed'].includes(tx.type);
            const col = isDep ? '#10b981' : '#ef4444';
            const glow = isDep ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)';
            if (isDep) totalIn += amt; else totalOut += amt;
            catCounts[tx.type] = (catCounts[tx.type] || 0) + amt;

            const shortDate = new Date(tx.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
            bars += `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;" title="₹${amt.toFixed(2)} (${tx.type})">`
                + `<div style="flex:1;width:100%;display:flex;align-items:flex-end;">`
                + `<div style="width:100%;height:${pct}%;background:${col};border-radius:4px 4px 0 0;transition:height 0.6s;box-shadow:0 0 8px ${glow};"></div></div></div>`;
            labels += `<div style="flex:1;text-align:center;font-size:0.58rem;color:#666;overflow:hidden;white-space:nowrap;">${shortDate}</div>`;
        });

        c.innerHTML = bars;
        if (lbl) lbl.innerHTML = labels;

        // Summary
        const net = totalIn - totalOut;
        setText('ana-total-in', '₹' + totalIn.toFixed(0));
        setText('ana-total-out', '₹' + totalOut.toFixed(0));
        const netEl = document.getElementById('ana-net');
        if (netEl) { netEl.textContent = (net >= 0 ? '+' : '') + '₹' + net.toFixed(0); netEl.style.color = net >= 0 ? '#10b981' : '#ef4444'; }

        // Category breakdown bar
        const catColors = { deposit: '#10b981', withdraw: '#ef4444', transfer: '#00e1ff', loan_deposit: '#ffb03a', loan_disbursed: '#f59e0b', transfer_in: '#06b6d4' };
        const total = Object.values(catCounts).reduce((a, b) => a + b, 0) || 1;
        const barEl = document.getElementById('ana-category-bar');
        const legEl = document.getElementById('ana-category-legend');
        if (barEl) barEl.innerHTML = Object.entries(catCounts).map(([k, v]) => `<div style="flex:${v / total};background:${catColors[k] || '#888'};transition:flex 0.6s;"></div>`).join('');
        if (legEl) legEl.innerHTML = Object.entries(catCounts).map(([k, v]) => `<span style="font-size:0.65rem;color:${catColors[k] || '#888'};background:rgba(255,255,255,0.05);border-radius:4px;padding:2px 6px;"><i class="fas fa-circle me-1" style="font-size:5px;"></i>${k.replace(/_/g, ' ')}</span>`).join('');
    }

    // -- DEPOSIT --
    const depForm = document.getElementById('deposit-form');
    if (depForm) depForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const amount = parseFloat(document.getElementById('deposit-amount').value);
        if (!amount || amount <= 0) return showAlert('Enter a valid amount', 'warning');
        const res = await api('/deposit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount }) });
        if (res.error) return showAlert(res.error);
        showAlert('Deposited ₹' + amount.toFixed(2), 'success');
        depForm.reset();
        bootstrap.Modal.getInstance(document.getElementById('depositModal'))?.hide();
        currentBalance += amount; updateBalanceUI(); loadTransactions();
    });

    const withForm = document.getElementById('withdraw-form');
    if (withForm) withForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const amount = parseFloat(document.getElementById('withdraw-amount').value);
        if (!amount || amount <= 0) return showAlert('Enter a valid amount', 'warning');
        if (amount > currentBalance) return showAlert('Insufficient balance');
        const purpose = document.getElementById('withdraw-purpose')?.value || '';
        const customNote = document.getElementById('withdraw-note')?.value.trim() || '';
        const noteText = customNote || purpose;
        const res = await api('/withdraw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount }) });
        if (res.error) return showAlert(res.error);
        // Store pending note — will be applied to newest matching tx after reload
        if (noteText) window._pendingTxNote = { type: 'withdraw', amount, note: noteText };
        showAlert('Withdrew ₹' + amount.toFixed(2) + (noteText ? ' · ' + noteText : ''), 'success');
        withForm.reset();
        bootstrap.Modal.getInstance(document.getElementById('withdrawModal'))?.hide();
        currentBalance -= amount; updateBalanceUI(); loadTransactions();
    });


    // -- TRANSFER --
    const transForm = document.getElementById('transfer-form');
    if (transForm) transForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const amount = parseFloat(document.getElementById('transfer-amount').value);
        const account_number = parseInt(document.getElementById('transfer-account').value, 10);
        if (!amount || amount <= 0 || isNaN(account_number)) return showAlert('Invalid input', 'warning');
        if (amount > currentBalance) return showAlert('Insufficient balance');
        const res = await api('/transfer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount, account_number }) });
        if (res.error) return showAlert(res.error);
        // Tag transfer with recipient account number so it shows in history
        window._pendingTxNote = { type: 'transfer', amount, note: '➡️ Transfer to A/C #' + account_number };
        showAlert('Transferred ₹' + amount.toFixed(2) + ' to #' + account_number, 'success');
        transForm.reset();
        bootstrap.Modal.getInstance(document.getElementById('transferModal'))?.hide();
        currentBalance -= amount; updateBalanceUI(); loadTransactions();
    });

    // -- LOANS --
    async function loadLoans() {
        const loans = await api('/loans');
        const el = document.getElementById('loan-list');
        if (!el) return;
        if (!loans || !Array.isArray(loans) || loans.length === 0) { el.innerHTML = '<p class="text-muted small text-center py-3">No active loans. Apply for one!</p>'; return; }
        el.innerHTML = loans.map(l => {
            const isPending = l.status === 'pending';
            const statusClass = isPending ? 'bg-warning bg-opacity-25 text-warning' : l.status === 'approved' ? 'bg-success bg-opacity-25 text-success' : 'bg-danger bg-opacity-25 text-danger';
            return '<div class="d-flex justify-content-between align-items-center mb-2 p-3 rounded" style="background:rgba(255,176,58,0.05);border:1px solid rgba(255,176,58,0.15);border-radius:12px!important;"><div><span class="fw-bold">₹' + parseFloat(l.amount).toFixed(2) + '</span><br><small class="text-warning">' + (l.interest_rate || '5.5') + '% APR</small></div><span class="badge ' + statusClass + ' px-3 py-2">' + (l.status.charAt(0).toUpperCase() + l.status.slice(1)) + '</span></div>';
        }).join('');
    }
    const loanForm = document.getElementById('loan-form');
    if (loanForm) loanForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const amount = parseFloat(document.getElementById('loan-amount').value);
        if (!amount || amount <= 0) return showAlert('Invalid amount', 'warning');
        const res = await api('/loans/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount }) });
        if (res.error) return showAlert(res.error);
        showAlert('Loan of ₹' + amount.toFixed(2) + ' application submitted for review.', 'success');
        loanForm.reset();
        bootstrap.Modal.getInstance(document.getElementById('loanModal'))?.hide();
        loadLoans(); // Re-render the loans array list with the new pending loan
    });

    // -- LOAN CALCULATOR --
    const calcBtn = document.getElementById('calc-btn');
    if (calcBtn) calcBtn.addEventListener('click', () => {
        const p = parseFloat(document.getElementById('calc-amount').value) || 0;
        const r = (parseFloat(document.getElementById('calc-rate').value) || 0) / 12 / 100;
        const n = parseInt(document.getElementById('calc-tenure').value) || 1;
        const emi = r > 0 ? p * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1) : p / n;
        setText('calc-emi', '₹' + emi.toFixed(2));
        setText('calc-total', (emi * n).toFixed(2));
        document.getElementById('calc-result')?.classList.remove('d-none');
    });

    // -- CARDS --
    async function loadCard() {
        const res = await api('/cards');
        if (res && Array.isArray(res) && res.length > 0) {
            const card = res[0];

            if (card.status === 'pending') {
                // Show pending state
                document.getElementById('no-card-display')?.classList.add('d-none');
                document.getElementById('no-card-full')?.classList.add('d-none');
                
                const cd = document.getElementById('card-display'); 
                if (cd) {
                    cd.classList.remove('d-none');
                    cd.innerHTML = '<div class="text-center py-4"><i class="fas fa-hourglass-half fa-2x text-warning mb-3"></i><h6 class="fw-bold">Card Application Pending</h6><p class="small text-muted mb-0">Your card is awaiting administrator approval.</p></div>';
                }
                
                const cf = document.getElementById('card-display-full'); 
                if (cf) {
                    cf.classList.remove('d-none');
                    cf.innerHTML = '<div class="text-center py-5"><i class="fas fa-hourglass-half fa-3x text-warning mb-3"></i><h4 class="fw-bold">Card Pending Approval</h4><p class="text-muted">An administrator is currently reviewing your application. Please check back later.</p></div>';
                }
                
                // Hide card controls if pending
                const controls = document.getElementById('card-controls-section');
                if (controls) controls.classList.add('d-none');

                return;
            } else if (card.status === 'rejected') {
                document.getElementById('no-card-display')?.classList.remove('d-none');
                document.getElementById('no-card-full')?.classList.remove('d-none');
                showAlert('Your previous card application was rejected. You may apply again.', 'warning');
                return;
            }

            const num = card.card_number.match(/.{1,4}/g).join(' ');
            // Preview
            document.getElementById('no-card-display')?.classList.add('d-none');
            const cd = document.getElementById('card-display'); if (cd) cd.classList.remove('d-none');
            setText('card-number', num); setText('card-expiry', card.expiry); setText('card-cvv', card.cvv);
            // Full page
            document.getElementById('no-card-full')?.classList.add('d-none');
            const cf = document.getElementById('card-display-full'); if (cf) cf.classList.remove('d-none');
            setText('card-number-full', num); setText('card-expiry-full', card.expiry); setText('card-cvv-full', card.cvv);
            setText('card-type-full', card.type || 'Debit');
            
            // Show card controls if active
            const controls = document.getElementById('card-controls-section');
            if (controls) controls.classList.remove('d-none');
        }
    }
    // -- CARD MULTI-STEP MODAL FLOW --
    window.cardStepNext = function (step) {
        [1, 2, 3].forEach(s => {
            const el = document.getElementById('card-step-' + s);
            if (el) el.classList.toggle('d-none', s !== step);
            const dot = document.getElementById('cs-dot-' + s);
            if (dot) {
                if (s < step) { dot.style.background = '#10b981'; dot.style.color = 'white'; dot.textContent = '✓'; }
                else if (s === step) { dot.style.background = 'rgba(138,43,226,0.8)'; dot.style.color = 'white'; dot.textContent = s; }
                else { dot.style.background = 'rgba(255,255,255,0.1)'; dot.style.color = '#888'; dot.textContent = s; }
            }
            const line = document.getElementById('cs-line-' + s);
            if (line) line.style.background = s < step ? '#10b981' : 'rgba(255,255,255,0.1)';
        });
    };

    window.cardStepVerify = function () {
        const name = document.getElementById('kyc-name')?.value.trim();
        const dob = document.getElementById('kyc-dob')?.value;
        const pan = document.getElementById('kyc-pan')?.value.trim();
        const mobile = document.getElementById('kyc-mobile')?.value.trim();
        if (!name) return showAlert('Please enter your full legal name', 'warning');
        if (!dob) return showAlert('Please enter your date of birth', 'warning');
        if (!pan || pan.length < 10) return showAlert('PAN must be 10 characters (e.g. ABCDE1234F)', 'warning');
        if (!mobile || mobile.length < 10) return showAlert('Enter a valid 10-digit mobile number', 'warning');
        // Show loading briefly to simulate verification
        const btn = event.target;
        const orig = btn.innerHTML;
        btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Verifying...';
        setTimeout(() => { btn.disabled = false; btn.innerHTML = orig; cardStepNext(3); }, 1500);
        // Pull card type to confirm summary
        const cardType = document.querySelector('input[name="card-type-select"]:checked')?.value || 'debit';
        const ctEl = document.getElementById('apply-confirm-type');
        if (ctEl) ctEl.textContent = cardType.charAt(0).toUpperCase() + cardType.slice(1);
    };

    window.cardFinalSubmit = async function () {
        const cardType = document.querySelector('input[name="card-type-select"]:checked')?.value || 'debit';
        const btn = event.target;
        const orig = btn.innerHTML;
        btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Issuing Card...';
        const res = await api('/cards/new', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: cardType }) });
        btn.disabled = false; btn.innerHTML = orig;
        if (res.error) return showAlert(res.error);
        bootstrap.Modal.getInstance(document.getElementById('cardApplyModal'))?.hide();
        showAlert('🎉 Your ' + cardType + ' card has been issued!', 'success');
        setTimeout(() => { cardStepNext(1); }, 500); // reset for next time
        loadCard();
    };

    // Limit slider in card modal
    const applyRange = document.getElementById('apply-limit-range');
    if (applyRange) applyRange.addEventListener('input', () => {
        const val = document.getElementById('apply-limit-val');
        if (val) val.textContent = '₹' + parseInt(applyRange.value).toLocaleString('en-IN');
    });

    window.issueCard = async function (type) {
        // Legacy: open the modal instead
        const modal = new bootstrap.Modal(document.getElementById('cardApplyModal'));
        modal.show();
    };

    // -- CARD LIMIT SLIDER & CONTROLS --
    const limitRange = document.getElementById('card-limit-range');
    if (limitRange) {
        limitRange.addEventListener('input', () => { setText('card-limit-val', '₹' + parseInt(limitRange.value).toLocaleString()); });
        limitRange.addEventListener('change', () => { showAlert('Card daily limit updated to ₹' + parseInt(limitRange.value).toLocaleString(), 'success'); });
    }

    ['card-lock-toggle', 'card-online-toggle', 'card-intl-toggle'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', (e) => {
            const name = id.replace('card-', '').replace('-toggle', '').replace('intl', 'International Use');
            const state = e.target.checked ? 'Enabled' : 'Disabled';
            showAlert(name.charAt(0).toUpperCase() + name.slice(1) + ' ' + state, 'success');
        });
    });

    // -- WEALTH --
    async function loadWealth() {
        const fds = await api('/wealth/fd');
        const fdEl = document.getElementById('fd-list');
        if (fdEl) {
            if (fds && Array.isArray(fds) && fds.length > 0) {
                fdEl.innerHTML = fds.map(fd => '<div class="p-3 mb-2 rounded" style="background:rgba(0,255,102,0.04);border:1px solid rgba(0,255,102,0.1);border-radius:12px!important;"><div class="d-flex justify-content-between"><span class="fw-bold">₹' + fd.amount.toFixed(2) + '</span><span class="text-success small">' + fd.interest + '% ROI</span></div><small class="text-muted">Maturity: ' + fd.maturity + '</small></div>').join('');
            } else { fdEl.innerHTML = '<p class="text-muted small">No fixed deposits found. Start investing!</p>'; }
        }
        const mfs = await api('/wealth/mf');
        const mfEl = document.getElementById('mf-list');
        if (mfEl) {
            if (mfs && Array.isArray(mfs) && mfs.length > 0) {
                mfEl.innerHTML = mfs.map(mf => '<div class="p-3 mb-2 rounded" style="background:rgba(138,43,226,0.04);border:1px solid rgba(138,43,226,0.1);border-radius:12px!important;"><div class="d-flex justify-content-between"><span class="fw-bold">' + mf.fund_name + '</span><span class="text-success small">₹' + (mf.units * mf.nav).toFixed(2) + '</span></div><small class="text-muted">' + mf.units + ' units @ ₹' + mf.nav.toFixed(2) + '</small></div>').join('');
            } else { mfEl.innerHTML = '<p class="text-muted small">No mutual funds. Explore investment options!</p>'; }
        }
    }

    // -- CORPORATE --
    async function loadCorporate() {
        const trades = await api('/corporate/trades');
        const el = document.getElementById('trade-list');
        if (!el) return;

        window.approveTrade = function (btn, type, amount) {
            showAlert('Approved ' + type + ' for ₹' + amount.toLocaleString(), 'success');
            btn.textContent = 'Active';
            btn.className = 'badge bg-success px-2 border-0';
            btn.disabled = true;
        };

        if (trades && Array.isArray(trades) && trades.length > 0) {
            el.innerHTML = trades.map(t => {
                const isPending = t.status === 'Pending';
                const badge = isPending
                    ? '<button class="badge bg-warning text-dark px-2 border-0" onclick="approveTrade(this, \'' + t.type + '\', ' + t.amount + ')">Approve</button>'
                    : '<span class="badge bg-success px-2">' + t.status + '</span>';
                return '<div class="p-3 mb-2 rounded" style="background:rgba(255,176,58,0.04);border:1px solid rgba(255,176,58,0.1);border-radius:12px!important;"><div class="d-flex justify-content-between"><span class="fw-bold">' + t.type + '</span>' + badge + '</div><small class="text-muted">Value: ₹' + t.amount.toLocaleString() + '</small></div>';
            }).join('');
        } else { el.innerHTML = '<p class="text-muted small">No corporate trades or letters of credit.</p>'; }
    }

    // -- BILLS --
    async function loadBills() {
        const bills = await api('/bills');
        const el = document.getElementById('bill-list');
        if (!el) return;

        window.payBill = async function (btn, billId, amount, biller) {
            if (amount > currentBalance) {
                showAlert('Insufficient balance to pay ' + biller, 'warning');
                return;
            }
            const orig = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Paying...';
            const res = await api('/bills/pay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bill_id: billId })
            });
            btn.disabled = false; btn.innerHTML = orig;
            if (res.error) return showAlert(res.error);
            currentBalance -= amount;
            updateBalanceUI();
            // Save the note using exact tx key from response — precise, no guessing
            if (res.tx_created_at) {
                const fakeTx = { created_at: res.tx_created_at, amount: res.amount };
                saveTxNote(fakeTx, '💡 Bill Payment · ' + biller);
            }
            showAlert('✅ Paid ₹' + amount.toFixed(2) + ' to ' + biller, 'success');
            loadTransactions();
            // Animate out the paid bill item
            const item = btn.closest('[data-bill-id]');
            if (item) {
                item.style.transition = 'opacity 0.4s, transform 0.4s';
                item.style.opacity = '0';
                item.style.transform = 'translateX(30px)';
                setTimeout(() => { item.remove(); if (!el.children.length) el.innerHTML = '<p class="text-muted small text-center py-3">🎉 All bills paid!</p>'; }, 420);
            }
        };


        if (bills && Array.isArray(bills) && bills.length > 0) {
            el.innerHTML = bills.map(b => {
                const amt = typeof b.amount === 'number' ? b.amount : parseFloat(b.amount || 0);
                return `<div data-bill-id="${b.id}" style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;margin-bottom:8px;border-radius:14px;background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.15);">
                    <div style="display:flex;align-items:center;gap:12px;">
                        <div style="width:40px;height:40px;border-radius:10px;background:rgba(239,68,68,0.1);color:#ef4444;display:flex;align-items:center;justify-content:center;font-size:1.1rem;">
                            <i class="fas fa-file-invoice-dollar"></i>
                        </div>
                        <div>
                            <div style="font-weight:600;font-size:0.95rem;color:#fff;">${b.biller}</div>
                            <div style="font-size:0.75rem;color:#9ca3af;">Due: ${b.due_date}</div>
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="font-weight:700;color:#ef4444;font-size:1rem;">₹${amt.toFixed(2)}</span>
                        <button class="btn btn-sm rounded-pill px-3" style="background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3);font-size:0.75rem;font-weight:600;" onclick="payBill(this, ${b.id}, ${amt}, '${b.biller.replace(/'/g, "\\'")}')">Pay Now</button>
                    </div>
                </div>`;
            }).join('');
        } else {
            el.innerHTML = '<p class="text-muted small text-center py-3">🎉 No pending bills. All clear!</p>';
        }
    }

    // ============================================================
    // -- CARDS SECTION LOGIC --
    // ============================================================
    window.toggleCardControl = function (ctrl, val) {
        const labels = { lock: val ? '🔒 Card Locked' : '✅ Card Unlocked', online: val ? '✅ Online Txns Enabled' : '⛔ Online Txns Disabled', intl: val ? '✈️ International Use Enabled' : '⛔ International Use Disabled', nfc: val ? '📱 Contactless Enabled' : '⛔ NFC Disabled' };
        localStorage.setItem('sv-card-' + ctrl, val);
        showAlert(labels[ctrl] || 'Setting updated', 'success');
    };
    window.updateCardLimit = function (val) {
        const fmt = '₹' + parseInt(val).toLocaleString('en-IN');
        setText('card-limit-val', fmt);
        localStorage.setItem('sv-card-limit', val);
    };
    window.saveCardSettings = function () {
        showAlert('✅ Card settings saved successfully!', 'success');
    };
    window.cardAction = function (action) {
        const msgs = { freeze: '❄️ Card temporarily frozen. All transactions blocked.', pin: '🔑 PIN change request sent to your registered mobile.', replace: '🔄 Card replacement request submitted. New card in 5-7 days.' };
        showAlert(msgs[action] || 'Action completed', 'success');
    };
    function updateCardSpendingStats(txs) {
        const limit = parseInt(localStorage.getItem('sv-card-limit') || '50000');
        const now = new Date();
        const monthTxs = txs.filter(t => {
            const d = new Date(t.created_at || '');
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && t.type === 'withdraw';
        });
        const spent = monthTxs.reduce((s, t) => s + Math.abs(parseFloat(t.amount || 0)), 0);
        const pct = Math.min(100, (spent / limit) * 100);
        setText('card-spend-total', '₹' + spent.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        setText('card-spend-left', '₹' + Math.max(0, limit - spent).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }));
        setText('card-spend-txn', monthTxs.length.toString());
        const bar = document.getElementById('card-spend-bar');
        if (bar) { bar.style.width = pct + '%'; bar.className = 'progress-bar ' + (pct > 80 ? 'bg-danger' : pct > 50 ? 'bg-warning' : 'bg-success'); }
    }

    // ============================================================
    // -- LOANS SECTION LOGIC --
    // ============================================================
    window.runCalc = function () {
        const P = parseFloat(document.getElementById('calc-amount')?.value || 0);
        const r = parseFloat(document.getElementById('calc-rate')?.value || 0) / 12 / 100;
        const n = parseInt(document.getElementById('calc-tenure')?.value || 0);
        setText('calc-amount-display', '₹' + P.toLocaleString('en-IN'));
        setText('calc-rate-display', parseFloat(document.getElementById('calc-rate')?.value || 0) + '%');
        setText('calc-tenure-display', n + ' months');
        if (!P || !r || !n) return;
        const emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
        const total = emi * n;
        const interest = total - P;
        setText('calc-emi', '₹' + emi.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }));
        setText('calc-principal', '₹' + P.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }));
        setText('calc-interest', '₹' + interest.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }));
        setText('calc-total', '₹' + total.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }));
    };
    window.prefillLoan = function (amount, rate, tenure) {
        const aEl = document.getElementById('calc-amount');
        const rEl = document.getElementById('calc-rate');
        const tEl = document.getElementById('calc-tenure');
        if (aEl) aEl.value = amount;
        if (rEl) rEl.value = rate;
        if (tEl) tEl.value = tenure;
        showSection('loans');
        runCalc();
    };
    window.payLoanEMI = async function (btn, loanId, emi) {
        if (emi > currentBalance) return showAlert('Insufficient balance for EMI', 'warning');
        const orig = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
        const res = await api('/withdraw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: emi }) });
        btn.disabled = false; btn.innerHTML = orig;
        if (res.error) return showAlert(res.error);
        window._pendingTxNote = { type: 'withdraw', amount: emi, note: '🏦 Loan EMI repayment · Loan #' + loanId };
        currentBalance -= emi; updateBalanceUI();
        showAlert('✅ EMI of ₹' + emi.toLocaleString('en-IN') + ' paid!', 'success');
        loadTransactions();
    };
    window.prepayLoan = async function (btn, loanId, amount) {
        const pay = parseFloat(prompt('Enter prepayment amount (₹):', amount.toFixed(2)));
        if (!pay || pay <= 0) return;
        if (pay > currentBalance) return showAlert('Insufficient balance', 'warning');
        const orig = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
        const res = await api('/withdraw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: pay }) });
        btn.disabled = false; btn.innerHTML = orig;
        if (res.error) return showAlert(res.error);
        window._pendingTxNote = { type: 'withdraw', amount: pay, note: '💰 Loan prepayment · Loan #' + loanId };
        currentBalance -= pay; updateBalanceUI();
        showAlert('✅ Prepayment of ₹' + pay.toLocaleString('en-IN') + ' successful!', 'success');
        loadTransactions();
    };
    function renderLoanList(loans) {
        const el = document.getElementById('loan-list');
        if (!el) return;
        if (!loans || !loans.length) { el.innerHTML = '<p class="text-muted small text-center py-4">No active loans. Apply above to get started.</p>'; return; }
        let totalBorrowed = 0, active = 0;
        el.innerHTML = loans.map(l => {
            const amt = parseFloat(l.amount || 0);
            totalBorrowed += amt;
            if (l.status === 'approved') active++;
            const r = 10.5 / 12 / 100, n = 24;
            const emi = (amt * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
            const statusColor = l.status === 'approved' ? '#10b981' : l.status === 'pending' ? '#f59e0b' : '#ef4444';
            const paid = Math.floor(Math.random() * 8); // simulated paid months
            const pct = Math.round((paid / n) * 100);
            return `<div class="p-4 mb-3 rounded-3" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);">
                <div class="d-flex justify-content-between align-items-start mb-3">
                    <div>
                        <div class="fw-bold">Loan #${l.id} <span class="badge ms-2" style="background:rgba(245,158,11,0.15);color:#f59e0b;font-size:0.65rem;">${l.status?.toUpperCase() || 'PENDING'}</span></div>
                        <div class="text-muted small">Interest: ${l.interest_rate || 10.5}% p.a. · 24 month tenure</div>
                    </div>
                    <div class="text-end">
                        <div class="fw-bold fs-5 text-warning">₹${amt.toLocaleString('en-IN')}</div>
                        <small class="text-muted">Sanctioned</small>
                    </div>
                </div>
                ${l.status === 'approved' ? `<div class="mb-3">
                    <div class="d-flex justify-content-between mb-1"><small class="text-muted">Repayment Progress</small><small class="text-white">${paid}/${n} EMIs paid</small></div>
                    <div class="progress" style="height:6px;background:rgba(255,255,255,0.05);border-radius:3px;">
                        <div class="progress-bar bg-success" style="width:${pct}%;border-radius:3px;"></div>
                    </div>
                </div>` : ''}
                <div class="d-flex justify-content-between align-items-center">
                    <div><small class="text-muted d-block">Monthly EMI</small><span class="fw-bold text-info">₹${emi.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span></div>
                    <div class="d-flex gap-2">
                        ${l.status === 'approved' ? `<button class="btn btn-sm btn-outline-success rounded-pill" onclick="payLoanEMI(this,${l.id},${emi.toFixed(2)})"><i class="fas fa-check me-1"></i>Pay EMI</button><button class="btn btn-sm btn-outline-warning rounded-pill" onclick="prepayLoan(this,${l.id},${amt})">Prepay</button>` : '<span class="text-muted small">Pending admin approval</span>'}
                    </div>
                </div>
            </div>`;
        }).join('');
        setText('loan-total-borrowed', '₹' + totalBorrowed.toLocaleString('en-IN'));
        setText('loan-total-outstanding', '₹' + (totalBorrowed * 0.72).toLocaleString('en-IN', { maximumFractionDigits: 0 }));
        setText('loan-count', active.toString());
        runCalc();
    }

    // ============================================================
    // -- WEALTH SECTION LOGIC --
    // ============================================================
    window.showFDModal = function () {
        const amt = prompt('Enter FD Amount (₹):');
        if (!amt || isNaN(parseFloat(amt))) return;
        showAlert('✅ FD of ₹' + parseFloat(amt).toLocaleString('en-IN') + ' created at 7.1% p.a. for 1 year.', 'success');
    };
    window.showMFModal = function () {
        const funds = ['HDFC Top 100', 'SBI Bluechip', 'ICICI Equity', 'Axis Long Term Equity'];
        const fund = prompt('Enter fund name to invest:\n' + funds.map((f, i) => (i + 1) + '. ' + f).join('\n'));
        if (!fund) return;
        const amt = prompt('Enter amount (₹):');
        if (!amt || isNaN(parseFloat(amt))) return;
        showAlert('✅ SIP/Lumpsum of ₹' + parseFloat(amt).toLocaleString('en-IN') + ' initiated in ' + fund, 'success');
    };
    window.closeFD = function (id) {
        if (!confirm('Close this FD early? Penalty of 1% interest may apply.')) return;
        showAlert('FD #' + id + ' closed. Amount will be credited within 2 working days.', 'success');
    };
    window.sellMFUnits = function (id, name) {
        const units = prompt('Enter units to sell from ' + name + ':');
        if (!units || isNaN(parseFloat(units))) return;
        showAlert('✅ Redemption of ' + units + ' units from ' + name + ' initiated. T+3 credit.', 'success');
    };
    function renderFDList(fds) {
        const el = document.getElementById('fd-list');
        if (!el) return;
        if (!fds || !fds.length) { el.innerHTML = '<p class="text-muted small text-center">No fixed deposits yet.</p>'; return; }
        let totalInvested = 0;
        el.innerHTML = fds.map(fd => {
            totalInvested += fd.amount || 0;
            const matDate = new Date(fd.maturity);
            const daysLeft = Math.max(0, Math.round((matDate - new Date()) / (1000 * 60 * 60 * 24)));
            const matAmt = fd.amount * (1 + (fd.interest / 100));
            return `<div class="p-3 mb-2 rounded-3" style="background:rgba(16,185,129,0.05);border:1px solid rgba(16,185,129,0.15);">
                <div class="d-flex justify-content-between align-items-start">
                    <div><div class="fw-semibold">₹${(fd.amount || 0).toLocaleString('en-IN')}</div><small class="text-muted">@ ${fd.interest}% p.a. · Matures ${fd.maturity}</small></div>
                    <div class="text-end"><div class="fw-bold text-success">₹${matAmt.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div><small class="text-muted">${daysLeft}d left</small></div>
                </div>
                <div class="d-flex gap-2 mt-2"><button class="btn btn-sm btn-outline-danger rounded-pill" onclick="closeFD(${fd.id})" style="font-size:0.7rem;">Close FD</button><button class="btn btn-sm btn-outline-success rounded-pill" style="font-size:0.7rem;" onclick="showAlert('FD renewed for another year!','success')">Renew</button></div>
            </div>`;
        }).join('');
        let totalVal = 0;
        fds.forEach(fd => totalVal += fd.amount || 0);
        const wt = document.getElementById('wealth-total');
        if (wt) wt.textContent = '₹' + totalInvested.toLocaleString('en-IN');
        return totalInvested;
    }
    function renderMFList(mfs) {
        const el = document.getElementById('mf-list');
        if (!el) return;
        if (!mfs || !mfs.length) { el.innerHTML = '<p class="text-muted small text-center">No mutual fund investments yet.</p>'; return; }
        let totalVal = 0;
        el.innerHTML = mfs.map(mf => {
            const currVal = mf.units * mf.nav;
            totalVal += currVal;
            const gain = currVal * (Math.random() > 0.5 ? 0.08 : -0.03);
            const gainClass = gain >= 0 ? 'text-success' : 'text-danger';
            const gainSign = gain >= 0 ? '+' : '';
            return `<div class="p-3 mb-2 rounded-3" style="background:rgba(139,92,246,0.05);border:1px solid rgba(139,92,246,0.15);">
                <div class="d-flex justify-content-between align-items-start">
                    <div><div class="fw-semibold" style="font-size:0.9rem;">${mf.fund_name}</div><small class="text-muted">${mf.units} units · NAV ₹${mf.nav}</small></div>
                    <div class="text-end"><div class="fw-bold">₹${currVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div><small class="${gainClass}">${gainSign}${gain.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</small></div>
                </div>
                <div class="d-flex gap-2 mt-2">
                    <button class="btn btn-sm btn-outline-danger rounded-pill" onclick="sellMFUnits(${mf.id},'${mf.fund_name}')" style="font-size:0.7rem;">Redeem</button>
                    <button class="btn btn-sm btn-outline-info rounded-pill" style="font-size:0.7rem;" onclick="showAlert('Additional investment in ${mf.fund_name} initiated.','success')">Top Up</button>
                </div>
            </div>`;
        }).join('');
        const wv = document.getElementById('wealth-value');
        if (wv) wv.textContent = '₹' + totalVal.toLocaleString('en-IN', { maximumFractionDigits: 0 });
    }
    function renderSIPList(sips) {
        const el = document.getElementById('sip-list');
        if (!el) return;
        if (!sips || !sips.length) { el.innerHTML = '<p class="text-muted small text-center">No active SIPs. Start a SIP to invest regularly.</p>'; return; }
        el.innerHTML = sips.map(s => `<div class="p-3 mb-2 rounded-3" style="background:rgba(245,158,11,0.05);border:1px solid rgba(245,158,11,0.15);">
            <div class="d-flex justify-content-between align-items-center">
                <div><div class="fw-semibold" style="font-size:0.85rem;">${s.fund_name}</div><small class="text-muted">₹${(s.amount || 0).toLocaleString('en-IN')}/mo · ${s.frequency}</small></div>
                <div class="d-flex gap-2 align-items-center">
                    <span class="badge" style="background:rgba(16,185,129,0.15);color:#10b981;font-size:0.65rem;">ACTIVE</span>
                    <button class="btn btn-sm btn-outline-danger rounded-pill" style="font-size:0.7rem;" onclick="showAlert('SIP paused. Resume anytime.','success')">Pause</button>
                </div>
            </div>
            ${s.next_date ? `<small class="text-muted d-block mt-1"><i class="fas fa-calendar me-1"></i>Next: ${s.next_date}</small>` : ''}
        </div>`).join('');
    }
    function renderDematList(holdings) {
        const el = document.getElementById('demat-list');
        if (!el) return;
        if (!holdings || !holdings.length) { el.innerHTML = '<p class="text-muted small text-center">No holdings. Open a demat account to start trading.</p>'; return; }
        let totalVal = 0, totalPnl = 0;
        el.innerHTML = holdings.map(h => {
            const price = h.avg_price * (1 + (Math.random() * 0.2 - 0.08));
            const val = h.quantity * price;
            const pnl = (price - h.avg_price) * h.quantity;
            totalVal += val; totalPnl += pnl;
            const isUp = pnl >= 0;
            return `<div class="p-3 mb-2 rounded-3 d-flex justify-content-between align-items-center" style="background:rgba(0,225,255,0.03);border:1px solid rgba(0,225,255,0.08);">
                <div>
                    <div class="fw-semibold">${h.ticker} <small class="text-muted" style="font-weight:400;">${h.stock_name}</small></div>
                    <small class="text-muted">${h.quantity} shares · Avg ₹${h.avg_price}</small>
                </div>
                <div class="text-end">
                    <div class="fw-bold">₹${val.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                    <small class="${isUp ? 'text-success' : 'text-danger'}">${isUp ? '▲' : '▼'} ${Math.abs(((price - h.avg_price) / h.avg_price) * 100).toFixed(2)}%</small>
                </div>
            </div>`;
        }).join('');
        setText('demat-total', '₹' + totalVal.toLocaleString('en-IN', { maximumFractionDigits: 0 }));
        const pnlEl = document.getElementById('demat-pnl');
        if (pnlEl) { pnlEl.className = 'fw-bold ' + (totalPnl >= 0 ? 'text-success' : 'text-danger'); pnlEl.textContent = (totalPnl >= 0 ? '+' : '') + '₹' + Math.abs(totalPnl).toLocaleString('en-IN', { maximumFractionDigits: 0 }); }
    }
    async function loadWealth() {
        const [fds, mfs] = await Promise.all([api('/wealth/fd'), api('/wealth/mf')]);
        const sips = await api('/wealth/sip/create').catch(() => []);
        const demat = await api('/wealth/demat').catch(() => []);
        renderFDList(Array.isArray(fds) ? fds : []);
        renderMFList(Array.isArray(mfs) ? mfs : []);
        renderSIPList(Array.isArray(sips) ? sips : []);
        renderDematList(Array.isArray(demat) ? demat : []);
    }

    // ============================================================
    // -- CORPORATE SECTION LOGIC --
    // ============================================================
    window.showCorpModal = function (type) {
        const templates = {
            lc: { title: '📄 New Letter of Credit', fields: [['Beneficiary Name', 'text', 'e.g. Supplier Ltd.'], ['Amount (₹)', 'number', '500000'], ['Validity (days)', 'number', '90'], ['Purpose / Trade Description', 'text', 'Import of raw materials']] },
            bg: { title: '🛡️ New Bank Guarantee', fields: [['Beneficiary', 'text', 'e.g. Govt. Department'], ['Guarantee Amount (₹)', 'number', '1000000'], ['Validity (days)', 'number', '365'], ['Type', 'text', 'Performance / Bid Bond']] },
            fx: { title: '💱 Forex / Currency Conversion', fields: [['From Currency', 'text', 'INR'], ['To Currency', 'text', 'USD'], ['Amount', 'number', '100000'], ['Purpose', 'text', 'Import payment']] }
        };
        const t = templates[type];
        if (!t) return;
        const vals = t.fields.map(f => prompt(f[0] + ':', f[2]));
        if (vals.some(v => v === null)) return;
        showAlert('✅ ' + t.title.replace(/^[^\s]+\s/, '') + ' submitted for processing. Reference: CORP' + Math.floor(Math.random() * 90000 + 10000), 'success');
        loadCorporate();
    };
    window.showBulkModal = function () {
        const title = prompt('Batch Title (e.g. March Salary):');
        if (!title) return;
        const amt = parseFloat(prompt('Total Batch Amount (₹):') || '0');
        const count = parseInt(prompt('Number of Transactions:') || '0');
        if (!amt || !count) return;
        api('/corporate/bulk_payment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, total_amount: amt, tx_count: count }) }).then(res => {
            if (res.error) return showAlert(res.error);
            showAlert('✅ Bulk batch "' + title + '" submitted for processing!', 'success');
            loadCorporate();
        });
    };
    window.approveTrade = function (btn, tradeId, type, amount) {
        api('/corporate/approve_trade', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trade_id: tradeId }) }).then(res => {
            if (res.error) return showAlert(res.error);
            showAlert('✅ ' + type + ' approved! Status updated.', 'success');
            btn.textContent = 'Approved'; btn.className = 'badge bg-success border-0'; btn.disabled = true;
        });
    };
    function renderTradeList(trades) {
        const el = document.getElementById('trade-list');
        const pendEl = document.getElementById('corp-pending-list');
        if (!el) return;
        let lcCount = 0, bgCount = 0, totalVal = 0;
        const pending = [];
        el.innerHTML = trades.map(t => {
            totalVal += t.amount || 0;
            if (t.type === 'LetterOfCredit') lcCount++;
            else bgCount++;
            if (t.status !== 'Active') pending.push(t);
            const statusColor = t.status === 'Active' ? '#10b981' : t.status === 'Pending Approval' ? '#f59e0b' : '#6b7280';
            return `<div class="p-3 mb-2 rounded-3 d-flex justify-content-between align-items-center" style="background:rgba(245,158,11,0.04);border:1px solid rgba(245,158,11,0.1);">
                <div>
                    <div class="fw-semibold">${t.type === 'LetterOfCredit' ? '📄 Letter of Credit' : '🛡️ Bank Guarantee'} <span class="ms-2" style="color:${statusColor};font-size:0.75rem;">● ${t.status}</span></div>
                    <small class="text-muted">₹${(t.amount || 0).toLocaleString('en-IN')} · Ref: TF${String(t.id).padStart(5, '0')}</small>
                </div>
                ${t.status !== 'Active' ? `<button class="btn btn-sm btn-outline-warning rounded-pill" onclick="approveTrade(this,${t.id},'${t.type}',${t.amount})">Approve</button>` : '<span class="badge bg-success bg-opacity-25 text-success">Active</span>'}
            </div>`;
        }).join('') || '<p class="text-muted small text-center">No trade finance instruments. Create one above.</p>';
        setText('corp-active-lc', lcCount.toString());
        setText('corp-active-bg', bgCount.toString());
        setText('corp-total-value', '₹' + totalVal.toLocaleString('en-IN', { maximumFractionDigits: 0 }));
        if (pendEl) pendEl.innerHTML = pending.length ? pending.map(t => `<div class="p-2 mb-1 rounded" style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.15);font-size:0.82rem;"><div class="fw-semibold">${t.type}</div><small class="text-muted">₹${(t.amount || 0).toLocaleString('en-IN')} · ${t.status}</small></div>`).join('') : '<p class="text-muted small text-center">All clear!</p>';
    }
    function renderBulkList(bulkPayments) {
        const el = document.getElementById('bulk-list');
        const bulkCountEl = document.getElementById('corp-active-bulk');
        if (!el) return;
        if (bulkCountEl) bulkCountEl.textContent = bulkPayments.length;
        if (!bulkPayments.length) { el.innerHTML = '<p class="text-muted small text-center">No bulk payment batches yet.</p>'; return; }
        el.innerHTML = bulkPayments.map(b => `<div class="p-3 mb-2 rounded-3 d-flex justify-content-between align-items-center" style="background:rgba(16,185,129,0.04);border:1px solid rgba(16,185,129,0.1);">
            <div><div class="fw-semibold">${b.title}</div><small class="text-muted">${b.tx_count} txns · ₹${(b.total_amount || 0).toLocaleString('en-IN')}</small></div>
            <span class="badge" style="background:rgba(${b.status === 'processed' ? '16,185,129' : '245,158,11'},0.2);color:${b.status === 'processed' ? '#10b981' : '#f59e0b'};">${b.status?.toUpperCase()}</span>
        </div>`).join('');
    }
    async function loadCorporate() {
        const [trades, bulks] = await Promise.all([api('/corporate/trades'), api('/corporate/bulk_payment').catch(() => [])]);
        renderTradeList(Array.isArray(trades) ? trades : []);
        renderBulkList(Array.isArray(bulks) ? bulks : []);
    }

    // Hook into section change to load data lazily
    const _origShowSection = window.showSection;
    window.showSection = function (s) {
        if (_origShowSection) _origShowSection(s);
        if (s === 'wealth') loadWealth();
        if (s === 'corporate') loadCorporate();
        if (s === 'loans') { api('/loans').then(r => renderLoanList(r || [])); runCalc(); }
        if (s === 'cards') updateCardSpendingStats(_allTxs || []);
    };
    // Initial loan list render
    api('/loans').then(r => renderLoanList(r || []));
    runCalc();

    // -- SETTINGS: PROFILE --

    const profileForm = document.getElementById('profile-form');
    if (profileForm) profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('settings-name').value.trim();
        if (!name) return showAlert('Name cannot be empty', 'warning');
        const res = await api('/profile/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
        if (res.error) return showAlert(res.error);
        showAlert('Profile updated!', 'success');
        setText('user-name', name); setText('full-name', name);
    });

    // -- SETTINGS: PASSWORD --
    const passForm = document.getElementById('password-form');
    if (passForm) passForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const old_password = document.getElementById('old-password').value;
        const new_password = document.getElementById('new-password').value;
        const confirm_pw = document.getElementById('confirm-password').value;
        if (new_password !== confirm_pw) return showAlert('Passwords do not match', 'warning');
        if (new_password.length < 4) return showAlert('Password must be at least 4 characters', 'warning');
        const res = await api('/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ old_password, new_password }) });
        if (res.error) return showAlert(res.error);
        showAlert('Password changed!', 'success');
        passForm.reset();
    });

    // -- LOGOUT --
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
        api('/logout', { method: 'POST' }).catch(() => { });
        showAlert('Logged out', 'success');
        setTimeout(() => { window.location = '/'; }, 1500);
    });

    // -- DELETE ACCOUNT --
    const delBtn = document.getElementById('delete-account-btn');
    if (delBtn) delBtn.addEventListener('click', () => showAlert('Account deletion requires admin approval.', 'warning'));

    // ============================================================
    // -- TRANSACTION FILTERING --
    // ============================================================

    // Tx notes storage — keyed by created_at+amount for retroactive matching
    function txNoteKey(tx) { return (tx.created_at || '') + '_' + Math.abs(parseFloat(tx.amount || 0)).toFixed(2); }
    function getTxNote(tx) {
        try { return (JSON.parse(localStorage.getItem('sv-tx-notes') || '{}'))[txNoteKey(tx)] || ''; } catch { return ''; }
    }
    window.saveTxNote = function (tx, note) {
        try { const n = JSON.parse(localStorage.getItem('sv-tx-notes') || '{}'); n[txNoteKey(tx)] = note; localStorage.setItem('sv-tx-notes', JSON.stringify(n)); } catch { }
    };

    // Smart label + description per transaction type
    function txMeta(tx) {
        const amt = Math.abs(parseFloat(tx.amount || 0));
        const note = getTxNote(tx);

        // --- Smart note-based overrides ---
        if (note && note.includes('Bill Payment')) {
            // Biller name is after the · separator
            const billerPart = note.replace(/.*Bill Payment\s*[·\-]\s*/i, '').replace(/^💡\s*/, '');
            return {
                label: 'Bill Payment',
                icon: 'file-invoice-dollar',
                desc: billerPart || 'Utility / Service bill paid',
                colorKey: 'out'
            };
        }
        if (note && note.includes('Transfer to A/C')) {
            const acPart = note.replace(/.*Transfer to A\/C\s*/i, '').replace(/^➡️\s*/, '');
            return {
                label: 'Transfer Sent',
                icon: 'paper-plane',
                desc: 'To Account ' + acPart + ' · NEFT / IMPS',
                colorKey: 'out'
            };
        }
        if (note && note.includes('Transfer from A/C')) {
            const acPart = note.replace(/.*Transfer from A\/C\s*/i, '').replace(/^⬅️\s*/, '');
            return {
                label: 'Transfer Received',
                icon: 'arrow-right-to-bracket',
                desc: 'From Account ' + acPart + ' · NEFT / UPI',
                colorKey: 'in'
            };
        }
        // Custom note exists but no special prefix – use as description
        if (note) {
            const base = { withdraw: { label: 'Cash Withdrawal', icon: 'arrow-up-from-bracket' }, deposit: { label: 'Money Credited', icon: 'arrow-down-to-bracket' }, transfer: { label: 'Transfer Sent', icon: 'paper-plane' }, transfer_in: { label: 'Transfer Received', icon: 'arrow-right-to-bracket' } };
            const b = base[tx.type] || { label: tx.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), icon: 'circle' };
            return { ...b, desc: note };
        }

        // --- Default smart descriptions by type + amount ---
        const map = {
            withdraw: {
                label: 'Cash Withdrawal', icon: 'arrow-up-from-bracket',
                desc: amt >= 20000 ? 'Large cash withdrawal · Counter / NEFT' : amt >= 5000 ? 'ATM cash withdrawal' : amt >= 500 ? 'UPI / Quick debit' : 'Micro debit'
            },
            deposit: {
                label: 'Money Credited', icon: 'arrow-down-to-bracket',
                desc: amt >= 50000 ? 'Salary / Bulk NEFT credit' : amt >= 10000 ? 'IMPS / Wire transfer received' : amt >= 1000 ? 'Quick deposit' : 'Small credit'
            },
            transfer: {
                label: 'Transfer Sent', icon: 'paper-plane',
                desc: 'Outward bank transfer — NEFT / IMPS'
            },
            transfer_in: {
                label: 'Transfer Received', icon: 'arrow-right-to-bracket',
                desc: 'Inward NEFT / UPI credit'
            },
            transfer_out: {
                label: 'Transfer Sent', icon: 'arrow-right-from-bracket',
                desc: 'Outward NEFT / UPI debit'
            },
            loan_deposit: {
                label: 'Loan Received', icon: 'hand-holding-usd',
                desc: 'Loan amount credited to your account'
            },
            loan_disbursed: {
                label: 'Loan Disbursed', icon: 'hand-holding-usd',
                desc: 'Loan amount credited to your account'
            },
            loan_repayment: {
                label: 'Loan Repayment', icon: 'undo-alt',
                desc: 'Loan repayment deducted'
            },
        };
        const m = map[tx.type];
        if (m) return m;
        return { label: (tx.type || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), icon: 'circle', desc: 'Account transaction' };
    }


    // Enhanced transaction row renderer
    function buildTxRow(tx) {
        const amt = Math.abs(parseFloat(tx.amount || 0));
        const isDep = ['deposit', 'loan_deposit', 'transfer_in', 'loan_disbursed'].includes(tx.type);
        const color = isDep ? '#10b981' : '#ef4444';
        const bgColor = isDep ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)';
        const border = isDep ? 'rgba(16,185,129,0.14)' : 'rgba(239,68,68,0.14)';
        const iconBg = isDep ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)';
        const sign = isDep ? '+' : '-';
        const date = new Date(tx.created_at);
        const dateStr = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        const { label, icon, desc } = txMeta(tx);
        const refNum = 'SV' + String(Math.abs(tx.id || 0) + 10000).padStart(6, '0');
        const amtFmt = amt.toLocaleString('en-IN', { minimumFractionDigits: 2 });
        const badgeTxt = tx.type.replace(/_/g, ' ');

        return `<div style="display:flex;align-items:center;justify-content:space-between;background:${bgColor};border:1px solid ${border};border-radius:14px;padding:14px 18px;margin-bottom:6px;transition:all 0.18s;" onmouseover="this.style.transform='translateX(4px)';this.style.borderColor='${color}40';" onmouseout="this.style.transform='';this.style.borderColor='${border}';">
            <div style="display:flex;align-items:center;gap:14px;">
                <div style="width:46px;height:46px;border-radius:12px;background:${iconBg};color:${color};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:1.15rem;">
                    <i class="fas fa-${icon}"></i>
                </div>
                <div>
                    <div style="font-weight:600;font-size:0.95rem;color:#fff;margin-bottom:2px;">${label}</div>
                    <div style="font-size:0.8rem;color:#9ca3af;margin-bottom:4px;">${desc}</div>
                    <div style="display:flex;align-items:center;gap:6px;">
                        <span style="font-size:0.68rem;color:#6b7280;">${dateStr}</span>
                        <span style="font-size:0.55rem;color:#4b5563;">·</span>
                        <span style="font-size:0.68rem;color:#6b7280;">${timeStr}</span>
                        <span style="font-size:0.6rem;padding:1px 6px;border-radius:4px;background:${iconBg};color:${color};font-weight:500;">${badgeTxt}</span>
                    </div>
                </div>
            </div>
            <div style="text-align:right;flex-shrink:0;min-width:120px;">
                <div style="font-weight:700;font-size:1.05rem;color:${color};">${sign}₹${amtFmt}</div>
                <div style="font-size:0.65rem;color:#6b7280;margin-top:2px;">Ref: ${refNum}</div>
                <div style="font-size:0.6rem;color:#4b5563;margin-top:1px;">${isDep ? 'CREDITED' : 'DEBITED'}</div>
            </div>
        </div>`;
    }

    function renderTxList(txs) {
        const el = document.getElementById('all-transactions-list');
        if (!el) return;
        if (!txs || txs.length === 0) {
            el.innerHTML = '<div class="text-center py-5 text-muted"><i class="fas fa-search fa-2x mb-3 opacity-25"></i><p>No transactions match your filters.</p></div>';
        } else {
            el.innerHTML = txs.map(buildTxRow).join('');
        }
        // Update stats
        let totalIn = 0, totalOut = 0;
        txs.forEach(tx => {
            const amt = Math.abs(parseFloat(tx.amount || 0));
            if (['deposit', 'loan_deposit', 'transfer_in', 'loan_disbursed'].includes(tx.type)) totalIn += amt;
            else totalOut += amt;
        });
        setText('tx-stat-count', txs.length);
        setText('tx-stat-in', '₹' + totalIn.toLocaleString('en-IN', { minimumFractionDigits: 2 }));
        setText('tx-stat-out', '₹' + totalOut.toLocaleString('en-IN', { minimumFractionDigits: 2 }));
        const netEl = document.getElementById('tx-stat-net');
        const net = totalIn - totalOut;
        if (netEl) { netEl.textContent = (net >= 0 ? '+' : '') + '₹' + Math.abs(net).toLocaleString('en-IN', { minimumFractionDigits: 2 }); netEl.style.color = net >= 0 ? '#10b981' : '#ef4444'; }
    }

    window.applyTxFilter = function () {
        const search = (document.getElementById('tx-search')?.value || '').toLowerCase();
        const type = document.getElementById('tx-type-filter')?.value || 'all';
        const fromVal = document.getElementById('tx-date-from')?.value;
        const toVal = document.getElementById('tx-date-to')?.value;
        const from = fromVal ? new Date(fromVal) : null;
        const to = toVal ? new Date(toVal + 'T23:59:59') : null;

        const filtered = _allTxs.filter(tx => {
            const amt = Math.abs(parseFloat(tx.amount || 0));
            const txDate = new Date(tx.created_at);
            const label = tx.type.replace(/_/g, ' ');
            if (search && !label.includes(search) && !amt.toFixed(2).includes(search)) return false;
            if (type !== 'all') {
                const typeMatch = { deposit: ['deposit', 'loan_deposit'], withdraw: ['withdraw'], transfer: ['transfer', 'transfer_in', 'transfer_out'], loan: ['loan_disbursed', 'loan_repayment'] };
                if (!typeMatch[type]?.some(t => tx.type.includes(t.split('_')[0]) || tx.type === t)) return false;
            }
            if (from && txDate < from) return false;
            if (to && txDate > to) return false;
            return true;
        });

        const lbl = document.getElementById('tx-date-range-label');
        if (lbl) {
            const parts = [];
            if (fromVal) parts.push('From ' + new Date(fromVal).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }));
            if (toVal) parts.push('To ' + new Date(toVal).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }));
            lbl.textContent = parts.join(' · ') || 'All time';
        }
        renderTxList(filtered);
    };

    window.clearTxFilter = function () {
        const fields = ['tx-search', 'tx-date-from', 'tx-date-to'];
        fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        const sel = document.getElementById('tx-type-filter'); if (sel) sel.value = 'all';
        const lbl = document.getElementById('tx-date-range-label'); if (lbl) lbl.textContent = 'All time';
        renderTxList(_allTxs);
    };

    window.exportTxCSV = function () {
        if (!_allTxs.length) return showAlert('No transactions to export', 'warning');
        const rows = [['Date', 'Type', 'Amount', 'Direction']];
        _allTxs.forEach(tx => {
            const isDep = ['deposit', 'loan_deposit', 'transfer_in', 'loan_disbursed'].includes(tx.type);
            rows.push([new Date(tx.created_at).toLocaleDateString('en-IN'), tx.type, Math.abs(parseFloat(tx.amount || 0)).toFixed(2), isDep ? 'Credit' : 'Debit']);
        });
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'transactions_' + new Date().toISOString().slice(0, 10) + '.csv';
        a.click(); URL.revokeObjectURL(url);
        showAlert('📥 Exported ' + _allTxs.length + ' transactions', 'success');
    };

    // Live search
    const txSearch = document.getElementById('tx-search');
    if (txSearch) txSearch.addEventListener('input', applyTxFilter);
    const txTypeFilter = document.getElementById('tx-type-filter');
    if (txTypeFilter) txTypeFilter.addEventListener('change', applyTxFilter);

    // ============================================================
    // -- THEMES --
    // ============================================================
    const THEMES = {
        dark: { '--bg-dark': '#000000', '--bg-card': 'rgba(255,255,255,0.03)', sidebar: 'rgba(10,10,10,0.95)', header: 'rgba(5,5,5,0.7)' },
        navy: { '--bg-dark': '#04101e', '--bg-card': 'rgba(255,255,255,0.04)', sidebar: 'rgba(5,15,35,0.98)', header: 'rgba(4,14,28,0.85)' },
        forest: { '--bg-dark': '#020a04', '--bg-card': 'rgba(255,255,255,0.03)', sidebar: 'rgba(3,10,5,0.98)', header: 'rgba(2,8,4,0.85)' },
        slate: { '--bg-dark': '#12122a', '--bg-card': 'rgba(255,255,255,0.04)', sidebar: 'rgba(15,15,35,0.98)', header: 'rgba(12,12,28,0.85)' }
    };
    function applyTheme(name) {
        const t = THEMES[name] || THEMES.dark;
        document.documentElement.style.setProperty('--bg-dark', t['--bg-dark']);
        document.documentElement.style.setProperty('--bg-card', t['--bg-card']);
        document.body.style.background = t['--bg-dark'];
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.style.background = t.sidebar;
        const header = document.querySelector('header');
        if (header) header.style.background = t.header;
        localStorage.setItem('sv-theme', name);
        document.querySelectorAll('.theme-opt').forEach(opt => {
            const isActive = opt.getAttribute('data-theme') === name;
            opt.style.borderColor = isActive ? 'rgba(0,255,102,0.4)' : 'rgba(255,255,255,0.08)';
            opt.style.background = isActive ? 'rgba(0,255,102,0.05)' : 'rgba(255,255,255,0.02)';
        });
    }
    document.querySelectorAll('input[name="app-theme"]').forEach(radio => {
        radio.addEventListener('change', () => applyTheme(radio.value));
    });
    // restore saved theme
    const savedTheme = localStorage.getItem('sv-theme') || 'dark';
    applyTheme(savedTheme);
    const savedRadio = document.querySelector(`input[name="app-theme"][value="${savedTheme}"]`);
    if (savedRadio) savedRadio.checked = true;

    // ============================================================
    // -- PREFERENCES (localStorage persisted) --
    // ============================================================
    function loadPrefs() {
        try { return JSON.parse(localStorage.getItem('sv-prefs') || '{}'); } catch { return {}; }
    }
    function savePrefs(prefs) { localStorage.setItem('sv-prefs', JSON.stringify(prefs)); }
    function applyPref(key, val) {
        switch (key) {
            case 'compact': applyCompactMode(val); break;
            case 'hideBalance': applyHideBalance(val); break;
            case 'sidebarLabels': applySidebarLabels(val); break;
        }
    }

    function applyCompactMode(on) {
        document.documentElement.style.setProperty('--compact', on ? '1' : '0');
        document.querySelectorAll('.glass-panel').forEach(p => {
            p.style.padding = on ? '12px 14px' : '';
        });
        document.querySelectorAll('.transaction-item').forEach(t => {
            t.style.padding = on ? '10px 12px' : '';
            t.style.marginBottom = on ? '4px' : '8px';
        });
    }

    function applyHideBalance(on) {
        const ids = ['balance', 'available-balance', 'ana-total-in', 'ana-total-out', 'ana-net'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            if (on) { el.dataset.realVal = el.textContent; el.textContent = '₹ ••••••'; }
            else if (el.dataset.realVal) { el.textContent = el.dataset.realVal; }
        });
    }

    function applySidebarLabels(on) {
        document.querySelectorAll('.sidebar-btn span').forEach(span => {
            span.style.display = on ? '' : 'none';
        });
    }

    // Init prefs from localStorage & wire up toggles
    const prefs = loadPrefs();
    document.querySelectorAll('.pref-toggle').forEach(input => {
        const key = input.getAttribute('data-pref');
        if (prefs.hasOwnProperty(key)) input.checked = prefs[key];
        applyPref(key, input.checked);
        input.addEventListener('change', () => {
            prefs[key] = input.checked;
            savePrefs(prefs);
            applyPref(key, input.checked);
            showAlert(`${key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}: ${input.checked ? 'On' : 'Off'}`, 'success');
        });
    });

    // Font size slider
    const fontRange = document.getElementById('font-size-range');
    const fontVal = document.getElementById('font-size-val');
    const fontLabels = ['Small', 'Medium', 'Large'];
    if (fontRange) {
        const saved = parseInt(localStorage.getItem('sv-fontsize') || '2');
        fontRange.value = saved;
        if (fontVal) fontVal.textContent = fontLabels[saved - 1];
        document.documentElement.style.fontSize = saved === 1 ? '13px' : saved === 3 ? '17px' : '15px';
        fontRange.addEventListener('input', () => {
            const v = parseInt(fontRange.value);
            if (fontVal) fontVal.textContent = fontLabels[v - 1];
            document.documentElement.style.fontSize = v === 1 ? '13px' : v === 3 ? '17px' : '15px';
            localStorage.setItem('sv-fontsize', v);
        });
    }

    // Alert threshold slider
    const threshRange = document.getElementById('alert-threshold-range');
    const threshVal = document.getElementById('alert-threshold-val');
    if (threshRange) {
        threshRange.addEventListener('input', () => {
            const v = parseInt(threshRange.value);
            if (threshVal) threshVal.textContent = '₹' + v.toLocaleString('en-IN');
        });
    }

    // -- INIT --
    loadAccount();
    loadCard();
    loadLoans();
    loadWealth();
    loadCorporate();
    loadBills();
});


