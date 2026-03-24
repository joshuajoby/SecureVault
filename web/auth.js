// auth.js - Handles login and registration forms for SecureVault

// Toggle password visibility
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const button = input.parentElement.querySelector('button[onclick*="togglePassword"]');
    if (!button) return;
    const icon = button.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

function showAlert(msg, type = 'danger') {
    const toast = document.getElementById('alert-toast');
    const a = document.getElementById('alert');
    if (!a) return;

    const colors = {
        success: { bg: 'rgba(16,185,129,0.97)', border: 'rgba(0,255,150,0.3)', icon: 'fa-check-circle' },
        danger: { bg: 'rgba(239,68,68,0.97)', border: 'rgba(255,80,80,0.3)', icon: 'fa-exclamation-circle' },
        warning: { bg: 'rgba(245,158,11,0.97)', border: 'rgba(255,200,50,0.3)', icon: 'fa-exclamation-triangle' }
    };
    const cfg = colors[type] || colors.danger;

    a.style.background = cfg.bg;
    a.style.borderColor = cfg.border;
    a.innerHTML = `<i class="fas ${cfg.icon} flex-shrink-0" style="font-size:1.1rem;"></i><span>${msg}</span>`;

    if (toast) {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
        toast.style.pointerEvents = 'auto';
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(-80px)';
            toast.style.pointerEvents = 'none';
        }, 4000);
    }
}

function setLoading(btnId, isLoading, originalText) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    if (isLoading) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Processing...';
    } else {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// Attach form handlers once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Check for OAuth redirect messages
    const params = new URLSearchParams(window.location.search);
    if (params.get('oauth') === 'unavailable') {
        showAlert('Google Sign-In requires cloud configuration. Please use Account Number & Password instead.', 'warning');
        // Clean up URL without reloading
        history.replaceState(null, '', '/auth.html');
    } else if (params.get('oauth') === 'error') {
        showAlert('Google Sign-In failed. Please use Account Number & Password instead.', 'danger');
        history.replaceState(null, '', '/auth.html');
    }

    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    // REGISTER
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnId = 'register-btn';
            const btn = document.getElementById(btnId);
            const originalText = btn ? btn.innerHTML : '';
            setLoading(btnId, true, originalText);

            const payload = {
                account_number: Number(document.getElementById('reg-account').value),
                name: document.getElementById('reg-name').value,
                password: document.getElementById('reg-pass').value,
                initial_balance: Number(document.getElementById('reg-balance').value)
            };

            try {
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await response.json();

                setLoading(btnId, false, originalText);

                if (data.error) {
                    showAlert(data.error, 'danger');
                    return;
                }

                showAlert('✓ Account created successfully! You can now login.', 'success');
                registerForm.reset();

                setTimeout(() => {
                    const loginTab = document.getElementById('login-tab');
                    if (loginTab) loginTab.click();
                }, 1500);
            } catch (err) {
                setLoading(btnId, false, originalText);
                showAlert('Network error. Please try again.', 'danger');
            }
        });
    }

    // LOGIN
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnId = 'login-btn';
            const btn = document.getElementById(btnId);
            const originalText = btn ? btn.innerHTML : '';
            setLoading(btnId, true, originalText);

            const payload = {
                account_number: Number(document.getElementById('login-account').value),
                password: document.getElementById('login-pass').value
            };

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await response.json();

                if (data.error) {
                    setLoading(btnId, false, originalText);
                    showAlert(data.error, 'danger');
                    return;
                }

                // Login successful!
                showAlert('✓ Login successful! Redirecting to dashboard...', 'success');

                setTimeout(() => {
                    window.location.href = '/dashboard.html';
                }, 1200);
            } catch (err) {
                setLoading(btnId, false, originalText);
                showAlert('Network error. Please try again.', 'danger');
            }
        });
    }
});
