(function(){
  const api = (path, opts) => fetch('/api'+path, opts).then(r=>r.json());

  const showAlert = (msg, type='danger') => {
    const a = document.getElementById('alert');
    a.className = `alert alert-${type}`;
    a.textContent = msg;
    a.classList.remove('d-none');
    setTimeout(()=>a.classList.add('d-none'),3000);
  }

  // Register
  document.getElementById('register-form').addEventListener('submit', async e=>{
    e.preventDefault();
    const payload = {
      account_number: Number(document.getElementById('reg-account').value),
      name: document.getElementById('reg-name').value,
      password: document.getElementById('reg-pass').value,
      initial_balance: Number(document.getElementById('reg-balance').value)
    }
    const res = await api('/register', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(payload)});
    if(res.error) return showAlert(res.error,'danger');
    showAlert('Registered! You can now login', 'success');
  });

  // Login
  document.getElementById('login-form').addEventListener('submit', async e=>{
    e.preventDefault();
    const payload = {
      account_number: Number(document.getElementById('login-account').value),
      password: document.getElementById('login-pass').value
    }
    let res = await api('/login', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(payload)});
    if(res.error) return showAlert(res.error,'danger');
    if(res["2fa_required"]) {
      const otp = prompt('Two-factor code from your authenticator app:');
      if(!otp) return showAlert('2FA code is required','danger');
      payload.otp = otp;
      res = await api('/login', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(payload)});
    }
    if(res.error) return showAlert(res.error,'danger');
    if(res.access_token){
      localStorage.setItem('access_token', res.access_token);
      window.location = '/dashboard';
    }
  });

  // Dashboard page actions
  if(location.pathname === '/dashboard'){
    const token = localStorage.getItem('access_token');
    if(!token) return window.location = '/';

    const headers = { 'Authorization': 'Bearer '+token }

    let txChart = null

    const loadMe = async ()=>{
      const me = await api('/me', {headers});
      if(me.error){ showAlert(me.error); return window.location='/'; }
      document.getElementById('balance').textContent = me.balance.toFixed(2);
      document.getElementById('profile-name').textContent = `${me.name} (#${me.account_number})`;
      document.getElementById('2fa-status').textContent = me.totp_enabled ? 'Enabled' : 'Disabled';
      if(me.totp_enabled){ document.getElementById('btn-2fa-setup').classList.add('d-none'); document.getElementById('btn-2fa-disable').classList.remove('d-none'); }
      else { document.getElementById('btn-2fa-setup').classList.remove('d-none'); document.getElementById('btn-2fa-disable').classList.add('d-none'); }
    }

    const loadTx = async ()=>{
      const txs = await api('/transactions', {headers});
      const tbody = document.querySelector('#tx-table tbody'); tbody.innerHTML='';
      txs.forEach(t=>{ const tr = document.createElement('tr'); tr.innerHTML=`<td>${t.type}</td><td>${t.amount.toFixed(2)}</td><td>${t.created_at}</td>`; tbody.appendChild(tr); });

      // prepare chart data by date
      const byDate = {};
      txs.slice().reverse().forEach(t=>{
        const d = new Date(t.created_at).toLocaleDateString();
        byDate[d] = (byDate[d]||0) + (t.type === 'deposit' ? t.amount : -t.amount);
      });
      const labels = Object.keys(byDate);
      const data = labels.map(l=>byDate[l]);

      const ctx = document.getElementById('tx-chart').getContext('2d');
      if(txChart) txChart.destroy();
      txChart = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Net change', data, backgroundColor: 'rgba(54,162,235,0.6)' }] },
        options: { responsive: true }
      });
    }

    document.getElementById('deposit-form').addEventListener('submit', async e=>{
      e.preventDefault(); const amt = Number(document.getElementById('deposit-amount').value); if(!amt) return; const res = await api('/deposit', {method:'POST', headers:{'content-type':'application/json','Authorization':'Bearer '+token}, body:JSON.stringify({amount:amt})}); if(res.error) return showAlert(res.error); showAlert(res.message,'success'); loadMe(); loadTx();
    });

    document.getElementById('withdraw-form').addEventListener('submit', async e=>{
      e.preventDefault(); const amt = Number(document.getElementById('withdraw-amount').value); if(!amt) return; const res = await api('/withdraw', {method:'POST', headers:{'content-type':'application/json','Authorization':'Bearer '+token}, body:JSON.stringify({amount:amt})}); if(res.error) return showAlert(res.error); showAlert(res.message,'success'); loadMe(); loadTx();
    });

    document.getElementById('logout').addEventListener('click', async ()=>{ await fetch('/api/logout', {method:'POST'}); localStorage.removeItem('access_token'); window.location='/'; });
    document.getElementById('refresh').addEventListener('click', ()=>{ loadMe(); loadTx(); });

    // 2FA flows
    const modalElem = document.getElementById('2faModal');
    const modal = new bootstrap.Modal(modalElem);
    document.getElementById('btn-2fa-setup').addEventListener('click', async ()=>{
      const res = await api('/2fa/setup', {method:'POST', headers});
      if(res.error) return showAlert(res.error);
      document.getElementById('qr-img').src = res.qr;
      document.getElementById('totp-secret').textContent = res.secret;
      modal.show();
    });
    document.getElementById('verify-2fa').addEventListener('click', async ()=>{
      const code = document.getElementById('totp-code').value.trim();
      const secret = document.getElementById('totp-secret').textContent;
      const res = await api('/2fa/verify', {method:'POST', headers:{...headers, 'content-type':'application/json'}, body:JSON.stringify({secret, code})});
      if(res.error) return showAlert(res.error);
      modal.hide();
      showAlert('2FA enabled', 'success');
      loadMe();
    });
    document.getElementById('btn-2fa-disable').addEventListener('click', async ()=>{
      const code = prompt('Enter current code to disable 2FA:');
      if(!code) return; const res = await api('/2fa/disable', {method:'POST', headers:{...headers,'content-type':'application/json'}, body:JSON.stringify({code})}); if(res.error) return showAlert(res.error); showAlert('2FA disabled', 'success'); loadMe();
    });

    loadMe(); loadTx();
  }

})();
