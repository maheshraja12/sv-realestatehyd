/**
 * SV Real Estates Hyderabad — Admin Management Scripts
 */

function toggleSidebar() {
    const sidebar = document.getElementById('adminSidebar');
    if (sidebar) {
        sidebar.classList.toggle('open');
    }
}

function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${message}`;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ── Notifications ──────────────────────────────────────────
async function toggleNotifications() {
    const dropdown = document.getElementById('notificationDropdown');
    if (!dropdown) return;

    if (dropdown.style.display === 'none' || dropdown.style.display === '') {
        dropdown.style.display = 'block';
        await loadNotificationsList();
    } else {
        dropdown.style.display = 'none';
    }
}

async function loadNotificationsList() {
    const listEl = document.getElementById('notificationList');
    if (!listEl) return;

    listEl.innerHTML = '<div style="padding:14px; text-align:center; color:#999;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

    try {
        const res = await fetch('/api/notifications');
        const data = await res.json();
        const items = data.notifications || [];

        if (items.length === 0) {
            listEl.innerHTML = '<div style="padding:16px; text-align:center; color:#6b7280; font-size:0.85rem;">No new notifications</div>';
            return;
        }

        listEl.innerHTML = items.map(n => `
            <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="handleNotifClick(${n.id}, '${n.link || ''}')">
                <strong>${n.title}</strong>
                <p style="font-size:0.8rem; color:#9aa0ac; margin:2px 0;">${n.message}</p>
                <small style="font-size:0.7rem; color:#6b7280;">${new Date(n.created_at).toLocaleString('en-IN')}</small>
            </div>
        `).join('');
    } catch (e) {
        listEl.innerHTML = '<div style="padding:14px; text-align:center; color:#ef4444; font-size:0.85rem;">Failed to load</div>';
    }
}

async function handleNotifClick(id, link) {
    try {
        await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
    } catch (e) {}
    if (link) window.location = link;
}

async function markAllRead() {
    try {
        const res = await fetch('/api/notifications/read-all', { method: 'POST' });
        if (res.ok) {
            const badge = document.querySelector('.notification-bell .badge');
            if (badge) badge.remove();
            await loadNotificationsList();
            showToast('All notifications marked as read');
        }
    } catch (e) {
        showToast('Failed to mark read', 'error');
    }
}

// ── Property Actions ───────────────────────────────────────
async function publishProperty(id) {
    try {
        const res = await fetch(`/api/properties/${id}/publish`, { method: 'PATCH' });
        if (res.ok) {
            showToast('Property published successfully');
            setTimeout(() => location.reload(), 600);
        } else {
            const err = await res.json();
            showToast(err.error || 'Failed to publish', 'error');
        }
    } catch (e) {
        showToast('Network error', 'error');
    }
}

async function unpublishProperty(id) {
    try {
        const res = await fetch(`/api/properties/${id}/unpublish`, { method: 'PATCH' });
        if (res.ok) {
            showToast('Property unpublished (moved to drafts)');
            setTimeout(() => location.reload(), 600);
        } else {
            const err = await res.json();
            showToast(err.error || 'Failed to unpublish', 'error');
        }
    } catch (e) {
        showToast('Network error', 'error');
    }
}

async function duplicateProperty(id) {
    if (!confirm('Duplicate this property listing?')) return;
    try {
        const res = await fetch(`/api/properties/${id}/duplicate`, { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.newPropertyId) {
            showToast('Property duplicated');
            setTimeout(() => window.location = `/admin/properties/${data.newPropertyId}/edit`, 800);
        } else {
            showToast(data.error || 'Failed to duplicate', 'error');
        }
    } catch (e) {
        showToast('Network error', 'error');
    }
}

async function deleteProperty(id, title) {
    if (!confirm(`Are you sure you want to permanently delete "${title}"? This cannot be undone.`)) {
        return;
    }
    try {
        const res = await fetch(`/api/properties/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Property deleted successfully');
            setTimeout(() => location.reload(), 600);
        } else {
            const err = await res.json();
            showToast(err.error || 'Failed to delete', 'error');
        }
    } catch (e) {
        showToast('Network error', 'error');
    }
}

// ── Leads Actions ──────────────────────────────────────────
async function updateLeadStatus(id, status) {
    try {
        const res = await fetch(`/api/leads/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        if (res.ok) {
            showToast('Lead status updated');
        } else {
            const err = await res.json();
            showToast(err.error || 'Failed to update status', 'error');
        }
    } catch (e) {
        showToast('Network error', 'error');
    }
}

// Close dropdowns on outside click
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('notificationDropdown');
    const bell = document.querySelector('.notification-bell');
    if (dropdown && dropdown.style.display === 'block') {
        if (!dropdown.contains(e.target) && !bell.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    }
});
