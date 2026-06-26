(function() {
  var token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  var userData = JSON.parse(localStorage.getItem('user') || '{}');

  function countUp(el, target) {
    var current = 0, step = Math.ceil(target / 30), interval = setInterval(function() {
      current += step;
      if (current >= target) { current = target; clearInterval(interval); }
      el.textContent = current;
    }, 30);
  }

  function showError(msg) {
    document.getElementById('bookingsTable').innerHTML = '<div class="alert alert-error">' + msg + '</div>';
  }

  // Load user
  async function loadUser() {
    try {
      var res = await fetch('/api/me', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) { localStorage.removeItem('token'); localStorage.removeItem('user'); window.location.href = 'login.html'; return; }
      var data = await res.json();
      document.getElementById('userName').textContent = data.name;
      document.getElementById('userEmail').textContent = data.email;
      document.getElementById('profileName').value = data.name;
      document.getElementById('profilePhone').value = data.phone || '';
      document.getElementById('profileEmail').value = data.email;
    } catch {
      showError('Failed to load profile');
    }
  }

  // Load bookings
  async function loadBookings() {
    try {
      var res = await fetch('/api/bookings', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      var bookings = await res.json();
      var container = document.getElementById('bookingsTable');

      if (bookings.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-light);">No bookings yet. <a href="schedule.html">Book a class</a></div>';
      } else {
        var table = document.createElement('table');
        var thead = document.createElement('thead');
        thead.innerHTML = '<tr><th>Class</th><th>Day</th><th>Time</th><th>Date</th><th>Action</th></tr>';
        table.appendChild(thead);
        var tbody = document.createElement('tbody');
        var upcoming = 0;
        var today = new Date().toISOString().split('T')[0];

        bookings.forEach(function(b) {
          var isUpcoming = b.booking_date >= today;
          if (isUpcoming) upcoming++;
          var row = document.createElement('tr');
          row.innerHTML = '<td>' + b.class_name + '</td><td>' + b.day + '</td><td>' + b.time + '</td><td>' + b.booking_date + '</td><td>' +
            (isUpcoming ? '<button class="btn btn-sm btn-outline-dark cancel-btn" data-id="' + b.id + '">Cancel</button>' : '<span style="color:var(--text-light);font-size:0.85rem;">Completed</span>') +
            '</td>';
          tbody.appendChild(row);
        });
        table.appendChild(tbody);
        container.innerHTML = '';
        container.appendChild(table);

        countUp(document.getElementById('totalBookings'), bookings.length);
        countUp(document.getElementById('upcomingCount'), upcoming);

        // Cancel handlers
        var cancelBtns = container.querySelectorAll('.cancel-btn');
        for (var i = 0; i < cancelBtns.length; i++) {
          cancelBtns[i].addEventListener('click', async function() {
            if (!confirm('Cancel this booking?')) return;
            try {
              var res = await fetch('/api/bookings/' + this.dataset.id, {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + token }
              });
              if (res.ok) {
                loadBookings();
              }
            } catch {}
          });
        }
      }

      // Member since
      if (bookings.length > 0 && bookings[0].created_at) {
        document.getElementById('activeSince').textContent = new Date(bookings[0].created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      } else {
        document.getElementById('activeSince').textContent = 'New Member';
      }
    } catch {
      showError('Failed to load bookings');
    }
  }

  // Profile update
  document.getElementById('profileForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    var btn = this.querySelector('button[type="submit"]');
    var result = document.getElementById('profileResult');
    btn.disabled = true;
    btn.textContent = 'Saving...';
    try {
      var res = await fetch('/api/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({
          name: document.getElementById('profileName').value,
          phone: document.getElementById('profilePhone').value
        })
      });
      if (res.ok) {
        var data = await res.json();
        localStorage.setItem('user', JSON.stringify(data));
        document.getElementById('userName').textContent = data.name;
        result.innerHTML = '<div class="alert alert-success">Profile updated!</div>';
        setTimeout(function() { result.innerHTML = ''; }, 2000);
      } else {
        result.innerHTML = '<div class="alert alert-error">Failed to update</div>';
      }
    } catch {
      result.innerHTML = '<div class="alert alert-error">Network error</div>';
    }
    btn.disabled = false;
    btn.textContent = 'Update Profile';
  });

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', function(e) {
    e.preventDefault();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  });

  loadUser();
  loadBookings();
})();
