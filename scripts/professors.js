// display message
function showMessage(message, type = 'info') {
    const messagesDiv = document.getElementById('messages');
    messagesDiv.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>
  `;
    setTimeout(() => {
        messagesDiv.innerHTML = '';
    }, 5000);
}

async function loadProfessors() {
    const tbody = document.getElementById('professorsBody');
    tbody.innerHTML = `<tr><td colspan="4" class="text-muted">Loading…</td></tr>`;

    try {
        const response = await fetch('/api/professors');
        const profs = await response.json();

        if (!response.ok) {
            const msg = profs?.error || `HTTP ${response.status}`;
            throw new Error(msg);
        }

        if (!Array.isArray(profs) || profs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-muted">No professors found.</td></tr>`;
            showMessage('No professors found', 'info');
            return;
        }

        // populate table with name, department, office, and email
        tbody.innerHTML = profs.map(p => `
      <tr>
        <td>     
        <a href="/schedule.html?professorId=${encodeURIComponent(p._id)}">
        ${p.name} </a>
        </td>
        <td>${p.department}</td>
        <td>${p.office}</td>
        <td>${p.email}</td>
      </tr>
    `).join('');

        showMessage(`📋 Loaded ${profs.length} professors`, 'success');
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-danger">Error loading data</td></tr>`;
        showMessage(`❌ Error: ${error.message}`, 'danger');
    }
}

// Logout functionality
function handleLogout() {
    // Clear any client-side storage
    localStorage.clear();
    sessionStorage.clear();
    
    // Redirect to login page
    window.location.href = '/login.html';
}

// Wire up initial load
window.addEventListener('load', loadProfessors);