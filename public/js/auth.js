(function() {
  var token = localStorage.getItem('token');
  if (token) {
    var isLogin = window.location.pathname.includes('login.html');
    var isRegister = window.location.pathname.includes('register.html');
    if (isLogin || isRegister) {
      window.location.href = 'dashboard.html';
      return;
    }
  }

  function setState(btn, state) {
    btn.className = 'aw-btn';
    if (state === 'loading') btn.classList.add('loading');
    else if (state === 'done') btn.classList.add('done');
  }

  // Login form
  var loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      var btn = document.getElementById('loginBtn');
      var err = document.getElementById('loginError');
      var email = document.getElementById('email').value.trim();
      var password = document.getElementById('password').value;

      [].slice.call(document.querySelectorAll('.aw-input')).forEach(function(i){i.classList.remove('e')});
      err.textContent = '';

      if (!email || !email.includes('@')) { err.textContent = 'Enter a valid email'; document.getElementById('email').classList.add('e'); document.getElementById('email').focus(); return; }
      if (!password) { err.textContent = 'Enter your password'; document.getElementById('password').classList.add('e'); document.getElementById('password').focus(); return; }

      setState(btn, 'loading');
      try {
        var res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email, password: password })
        });
        var data = await res.json();
        if (res.ok) {
          setState(btn, 'done');
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          err.textContent = '';
          setTimeout(function() { window.location.href = 'dashboard.html'; }, 400);
        } else {
          setState(btn, '');
          err.textContent = data.error || 'Invalid credentials';
          document.getElementById('password').classList.add('e');
        }
      } catch {
        setState(btn, '');
        err.textContent = 'Network error. Please try again.';
      }
    });
  }

  // Register form
  var registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      var btn = document.getElementById('registerBtn');
      var err = document.getElementById('registerError');
      var name = document.getElementById('name').value.trim();
      var email = document.getElementById('email').value.trim();
      var password = document.getElementById('password').value;

      [].slice.call(document.querySelectorAll('.aw-input')).forEach(function(i){i.classList.remove('e')});
      err.textContent = '';

      if (!name) { err.textContent = 'Enter your name'; document.getElementById('name').classList.add('e'); document.getElementById('name').focus(); return; }
      if (!email || !email.includes('@')) { err.textContent = 'Enter a valid email'; document.getElementById('email').classList.add('e'); document.getElementById('email').focus(); return; }
      if (!password || password.length < 6) { err.textContent = 'Password must be at least 6 characters'; document.getElementById('password').classList.add('e'); document.getElementById('password').focus(); return; }

      setState(btn, 'loading');
      try {
        var res = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name, email: email, password: password })
        });
        var data = await res.json();
        if (res.ok) {
          setState(btn, 'done');
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          err.textContent = '';
          setTimeout(function() { window.location.href = 'dashboard.html'; }, 400);
        } else {
          setState(btn, '');
          err.textContent = data.error || 'Registration failed';
        }
      } catch {
        setState(btn, '');
        err.textContent = 'Network error. Please try again.';
      }
    });
  }
})();
