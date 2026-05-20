import {
    showToast,
    generateOTP,
    formatDate,
    seedAdmin,
    getAdminCreds,
    saveDriver,
    updateDriver,
    deleteDriver,
    updateBooking,
    checkMobileExists,
    listenDrivers,
    listenBookings,
    getAllCustomers,
    listenCustomers
} from './script.js';

let D = {},
    B = {},
    C = {},
    cT = null,
    cR = null,
    cDR = null,
    otp = null,
    period = 'today';

// Password toggle
window.togglePw = (id, btn) => {
    const e = document.getElementById(id);
    e.type = e.type === 'password' ? 'text' : 'password';
    btn.textContent = e.type === 'password' ? '👁' : '🙈';
};

// Admin forgot password
window.showAdminForgot = () => {
    document.getElementById('admin-login-form').style.display = 'none';
    document.getElementById('admin-forgot-form').style.display = 'block';
};

window.showAdminLogin = () => {
    document.getElementById('admin-forgot-form').style.display = 'none';
    document.getElementById('admin-login-form').style.display = 'block';
};

// Admin login
window.adminLogin = async () => {
    const m = document.getElementById('adm-mobile').value.trim();
    const p = document.getElementById('adm-password').value.trim();
    if (!m || !p) {
        showToast('Enter mobile and password', 'error');
        return;
    }
    if (m === '9334252886' && p === 'karan128') {
        enterDash();
        seedAdmin().catch(() => {});
        return;
    }
    const btn = document.getElementById('login-btn');
    btn.disabled = true;
    btn.textContent = 'Checking...';
    try {
        await seedAdmin();
        const c = await getAdminCreds();
        if (c && c.mobile === m && c.password === p) {
            enterDash();
        } else showToast('Wrong credentials. Use 9334252886 / karan128', 'error');
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '🔐 Login to Dashboard';
    }
};

function enterDash() {
    document.getElementById('admin-login').style.display = 'none';
    document.getElementById('admin-dashboard').style.display = 'block';
    initDash();
    showToast('Welcome, Admin!', 'success');
}

window.adminSendOTP = async () => {
    const m = document.getElementById('adm-forgot-mobile').value.trim();
    try {
        const c = await getAdminCreds();
        if (!c || c.mobile !== m) {
            showToast('Mobile not found', 'error');
            return;
        }
        otp = generateOTP();
        // Send OTP to server-side SMS endpoint. Do NOT display OTP in UI for privacy.
        try {
            await fetch('/api/send-sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mobile: m, message: `Your SR Admin OTP is ${otp}` })
            });
            document.getElementById('adm-otp-display').textContent = 'Sent';
            showToast('OTP sent to your mobile', 'info');
        } catch (err) {
            console.error('SMS send failed', err);
            document.getElementById('adm-otp-display').textContent = 'Failed';
            showToast('Failed to send SMS. Contact support.', 'error');
        }
        document.getElementById('adm-forgot-s1').style.display = 'none';
        document.getElementById('adm-forgot-s2').style.display = 'block';
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
};

window.adminResetPw = async () => {
    const o = document.getElementById('adm-otp-input').value.trim();
    const p = document.getElementById('adm-new-pw').value.trim();
    if (o !== otp) {
        showToast('Invalid OTP', 'error');
        return;
    }
    if (p.length < 6) {
        showToast('Password too short', 'error');
        return;
    }
    try {
        const fb = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
        const fa = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
        await fb.set(fb.ref(fb.getDatabase(fa.getApp()), 'admin/password'), p);
        showToast('Password reset!', 'success');
        document.getElementById('adm-forgot-s2').style.display = 'none';
        document.getElementById('adm-forgot-s1').style.display = 'block';
        showAdminLogin();
    } catch (e) {
        showToast('Reset failed: ' + e.message, 'error');
    }
};

window.adminLogout = () => {
    document.getElementById('admin-dashboard').style.display = 'none';
    document.getElementById('admin-login').style.display = 'flex';
    showToast('Logged out', 'info');
};

// Sidebar toggle (mobile)
window.toggleSidebar = () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('open');
};

window.closeSidebar = () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('open');
};

// Tab navigation
window.showTab = (tab) => {
    document.querySelectorAll('.tab-content-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => {
        if ((n.getAttribute('onclick') || '').includes(tab)) n.classList.add('active');
    });
    if (tab === 'analytics') renderAnalytics();
    if (tab === 'drivers') filterDriverCards();
    if (tab === 'customers') renderCustomersTab();
};

function initDash() {
    listenDrivers(drivers => {
        D = drivers;
        updateStats();
        filterDriverCards();
        renderNotifs();
    });
    listenBookings(bookings => {
        B = bookings;
        updateStats();
        renderAllBookings();
        renderCharts();
    });
    listenCustomers(customers => {
        C = customers;
        updateStats();
    });
}

window.setPeriod = (p) => {
    period = p;
    document.querySelectorAll('.period-tab').forEach(t => t.classList.toggle('active', t.dataset.period === p));
    updateStats();
};

function getPB(p) {
    const all = Object.values(B),
        now = Date.now(),
        td = new Date().toISOString().split('T')[0];
    if (p === 'today') return all.filter(b => b.bookingDate === td || (b.createdAt && new Date(b.createdAt).toISOString().split('T')[0] === td));
    if (p === 'week') return all.filter(b => b.createdAt > now - 7 * 86400000);
    if (p === 'month') return all.filter(b => b.createdAt > now - 30 * 86400000);
    if (p === 'year') return all.filter(b => b.createdAt > now - 365 * 86400000);
    return all;
}

function updateStats() {
    const dv = Object.values(D),
        cv = Object.values(C),
        f = getPB(period),
        all = Object.values(B);
    const rev = f.reduce((s, b) => s + (b.earnings || 0), 0);
    se('s-total-drivers', dv.length);
    se('s-approved-drivers', dv.filter(d => d.status === 'approved').length);
    se('s-pending-drivers', dv.filter(d => d.status === 'pending').length);
    se('s-total-customers', cv.length);
    se('s-total-bookings', all.length);
    se('s-period-bookings', f.length);
    se('s-confirmed', f.filter(b => b.status === 'confirmed').length);
    se('s-pending-bk', f.filter(b => b.status === 'pending').length);
    se('s-revenue', 'Rs.' + rev.toLocaleString('en-IN'));
}

function se(id, v) {
    const e = document.getElementById(id);
    if (e) e.textContent = v;
}

function renderCharts() {
    const bks = Object.values(B),
        tc = {
            today: 0,
            urgent: 0,
            after: 0
        };
    bks.forEach(b => {
        if (tc[b.bookingType] !== undefined) tc[b.bookingType]++;
    });
    if (cT) cT.destroy();
    cT = new Chart(document.getElementById('chart-type'), {
        type: 'doughnut',
        data: {
            labels: ['Today', 'Urgent', 'After Days'],
            datasets: [{
                data: [tc.today, tc.urgent, tc.after],
                backgroundColor: ['#3b82f6', '#facc15', '#8b5cf6'],
                borderWidth: 0
            }]
        },
        options: {
            plugins: {
                legend: {
                    labels: {
                        color: '#e2e8f0'
                    }
                }
            },
            cutout: '65%'
        }
    });
    const days = [],
        rbd = {};
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const k = d.toISOString().split('T')[0];
        days.push(k.slice(5));
        rbd[k] = 0;
    }
    bks.forEach(b => {
        const k = b.bookingDate || (b.createdAt ? new Date(b.createdAt).toISOString().split('T')[0] : null);
        if (k && rbd[k] !== undefined) rbd[k] += (b.earnings || 0);
    });
    if (cR) cR.destroy();
    cR = new Chart(document.getElementById('chart-revenue'), {
        type: 'line',
        data: {
            labels: days,
            datasets: [{
                label: 'Revenue',
                data: Object.values(rbd),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59,130,246,.15)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#3b82f6',
                pointRadius: 5
            }]
        },
        options: {
            plugins: {
                legend: {
                    labels: {
                        color: '#e2e8f0'
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: '#94a3b8'
                    },
                    grid: {
                        color: 'rgba(255,255,255,.05)'
                    }
                },
                y: {
                    ticks: {
                        color: '#94a3b8'
                    },
                    grid: {
                        color: 'rgba(255,255,255,.05)'
                    }
                }
            }
        }
    });
}

function renderAnalytics() {
    const bks = Object.values(B),
        de = {};
    bks.forEach(b => {
        if (!de[b.driverId]) de[b.driverId] = {
            earnings: 0,
            count: 0
        };
        de[b.driverId].earnings += (b.earnings || 0);
        de[b.driverId].count++;
    });
    const sorted = Object.entries(de).sort((a, b) => b[1].earnings - a[1].earnings).slice(0, 10);
    if (cDR) cDR.destroy();
    cDR = new Chart(document.getElementById('chart-driver-rev'), {
        type: 'bar',
        data: {
            labels: sorted.map(([id]) => (D[id] || {}).name || id.slice(0, 8)),
            datasets: [{
                label: 'Earnings',
                data: sorted.map(([, v]) => v.earnings),
                backgroundColor: 'rgba(59,130,246,.7)',
                borderColor: '#3b82f6',
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: {
            plugins: {
                legend: {
                    labels: {
                        color: '#e2e8f0'
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: '#94a3b8'
                    },
                    grid: {
                        color: 'rgba(255,255,255,.05)'
                    }
                },
                y: {
                    ticks: {
                        color: '#94a3b8'
                    },
                    grid: {
                        color: 'rgba(255,255,255,.05)'
                    }
                }
            }
        }
    });
    document.getElementById('top-drivers-tbody').innerHTML = sorted.slice(0, 5).map(([id, v], i) => {
        const d = D[id] || {};
        return '<tr><td>' + (i + 1) + '</td><td>' + (d.name || '-') + '</td><td>' + (d.carModel || '-') + '</td><td>' + v.count + '</td><td>Rs.' + v.earnings.toLocaleString('en-IN') + '</td></tr>';
    }).join('');
}

window.filterDriverCards = () => {
    const q = (document.getElementById('driver-search') ? document.getElementById('driver-search').value : '').toLowerCase();
    const f = document.getElementById('driver-filter') ? document.getElementById('driver-filter').value : 'all';
    const entries = Object.entries(D).filter(([, d]) => (f === 'all' || d.status === f) && (!q || d.name.toLowerCase().includes(q) || d.carModel.toLowerCase().includes(q) || d.mobile.includes(q)));
    const c = document.getElementById('drivers-cards');
    if (!entries.length) {
        c.innerHTML = '<div style="grid-column:1/-1"><div class="empty-state"><div class="icon">👥</div><p>No drivers found.</p></div></div>';
        return;
    }
    c.innerHTML = entries.map(([id, d]) => {
        const bks = Object.values(B).filter(b => b.driverId === id);
        const td = new Date().toISOString().split('T')[0];
        const tB = bks.filter(b => b.bookingDate === td || (b.createdAt && new Date(b.createdAt).toISOString().split('T')[0] === td)).length;
        const wB = bks.filter(b => b.createdAt > Date.now() - 7 * 86400000).length;
        const mB = bks.filter(b => b.createdAt > Date.now() - 30 * 86400000).length;
        const earn = bks.reduce((s, b) => s + (b.earnings || 0), 0);
        const sb = d.status === 'approved' ? '<span class="badge badge-success">Approved</span>' : '<span class="badge badge-warning">Pending</span>';
        const ab = d.status === 'pending' ? '<button class="btn btn-success btn-sm" type="button" onclick="approveDriver(\'' + id + '\')">✓ Approve</button>' : '';
        return '<div><div class="driver-mgmt-card" onclick="openDriverDashboard(\'' + id + '\')">' +
            '<img class="card-img" src="' + (d.carImage || 'https://placehold.co/400x130?text=Car') + '" alt="Car"/>' +
            '<div class="card-body">' +
            '<div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.75rem">' +
            '<img src="' + (d.driverImage || 'https://placehold.co/48?text=D') + '" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid var(--primary-color);flex-shrink:0"/>' +
            '<div style="flex:1;min-width:0"><div style="font-weight:700">' + d.name + '</div><div style="color:var(--primary-color);font-size:.8rem">' + d.carModel + '</div><div style="color:var(--muted-text);font-size:.75rem">' + d.mobile + '</div></div>' +
            sb +
            '</div>' +
            '<div class="admin-stat-row">' +
            '<div class="mini-stat"><div class="ms-label">Today</div><div class="ms-value">' + tB + '</div></div>' +
            '<div class="mini-stat"><div class="ms-label">Week</div><div class="ms-value">' + wB + '</div></div>' +
            '<div class="mini-stat"><div class="ms-label">Month</div><div class="ms-value">' + mB + '</div></div>' +
            '<div class="mini-stat"><div class="ms-label">Earned</div><div class="ms-value" style="font-size:.85rem">Rs.' + earn.toLocaleString('en-IN') + '</div></div>' +
            '</div>' +
            '</div>' +
            '<div class="card-footer-actions" onclick="event.stopPropagation()">' +
            ab +
            '<button class="btn btn-primary btn-sm" type="button" onclick="openDriverDashboard(\'' + id + '\')">📊 Dashboard</button>' +
            '<button class="btn btn-danger btn-sm" type="button" onclick="removeDriver(\'' + id + '\')">🗑️</button>' +
            '</div>' +
            '</div></div>';
    }).join('');
};

window.approveDriver = async (id) => {
    await updateDriver(id, {
        status: 'approved'
    });
    showToast('Driver approved! Now live on customer portal.', 'success');
};
window.removeDriver = async (id) => {
    if (!confirm('Remove this driver permanently?')) return;
    await deleteDriver(id);
    showToast('Driver removed', 'info');
};

function sBadge(s) {
    const m = {
        confirmed: 'badge-success',
        pending: 'badge-warning',
        cancelled: 'badge-danger'
    };
    return '<span class="badge ' + (m[s] || 'badge-info') + '">' + s + '</span>';
}

function driverRow(id, d) {
    const bks = Object.values(B).filter(b => b.driverId === id);
    const td = new Date().toISOString().split('T')[0];
    const yd = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const earn = arr => arr.reduce((s, b) => s + (b.earnings || 0), 0);
    const cnt = arr => arr.length;
    const tB = bks.filter(b => b.bookingDate === td || (b.createdAt && new Date(b.createdAt).toISOString().split('T')[0] === td));
    const yB = bks.filter(b => b.bookingDate === yd || (b.createdAt && new Date(b.createdAt).toISOString().split('T')[0] === yd));
    const wB = bks.filter(b => b.createdAt > Date.now() - 7 * 86400000);
    const mB = bks.filter(b => b.createdAt > Date.now() - 30 * 86400000);
    const yRB = bks.filter(b => b.createdAt > Date.now() - 365 * 86400000);
    const sb = d.status === 'approved' ? '<span class="badge badge-success">Live</span>' : '<span class="badge badge-warning">Pending</span>';
    return {
        bks,
        earn,
        cnt,
        tB,
        yB,
        wB,
        mB,
        yRB,
        sb
    };
}

window.openDriversListModal = (type) => {
    const titles = {
        all: 'All Drivers',
        approved: 'Approved (Live) Drivers',
        pending: 'Pending Approval - New Registrations'
    };
    document.getElementById('drvlist-title').textContent = titles[type] || 'Drivers';
    const entries = Object.entries(D).filter(([, d]) => type === 'all' || d.status === type);
    if (!entries.length) {
        document.getElementById('drvlist-body').innerHTML = '<div class="empty-state"><p>' + (type === 'pending' ? 'No pending registrations!' : 'No drivers found.') + '</p></div>';
        document.getElementById('drivers-list-modal').style.display = 'flex';
        return;
    }
    document.getElementById('drvlist-body').innerHTML = entries.map(([id, d]) => {
        const {
            bks,
            earn,
            cnt,
            tB,
            sb
        } = driverRow(id, d);
        const totalEarn = earn(bks);
        const todayCnt = cnt(tB);
        const appBtn = d.status === 'pending' ? '<button class="btn btn-success btn-sm" type="button" onclick="approveDriver(\'' + id + '\')">✓ Approve</button>' : '';
        const rejBtn = d.status === 'pending' ? '<button class="btn btn-danger btn-sm" type="button" onclick="removeDriver(\'' + id + '\')">✕ Reject</button>' : '';
        return '<div style="display:flex;align-items:center;gap:1rem;padding:1rem;background:var(--glass);border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:.75rem;transition:border-color .2s;cursor:pointer" onmouseover="this.style.borderColor=\'var(--primary-color)\'" onmouseout="this.style.borderColor=\'var(--border)\'" onclick="openDriverDashboard(\'' + id + '\')" >' +
            '<img src="' + (d.driverImage || 'https://placehold.co/56?text=D') + '" style="width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid var(--primary-color);flex-shrink:0"/>' +
            '<img src="' + (d.carImage || 'https://placehold.co/80x56?text=Car') + '" style="width:80px;height:56px;border-radius:8px;object-fit:cover;flex-shrink:0"/>' +
            '<div style="flex:1;min-width:0">' +
            '<div style="font-weight:700;font-size:1rem">' + d.name + ' ' + sb + '</div>' +
            '<div style="color:var(--primary-color);font-size:.85rem">' + d.carModel + ' | ' + d.carCapacity + ' seats | ' + d.experience + ' yrs exp</div>' +
            '<div style="color:var(--muted-text);font-size:.8rem;margin-top:.2rem">' + d.mobile + ' | Registered: ' + formatDate(d.createdAt) + '</div>' +
            (d.carDetails ? '<div style="color:var(--muted-text);font-size:.78rem">' + d.carDetails + '</div>' : '') +
            '</div>' +
            '<div style="display:flex;flex-direction:column;gap:.4rem;flex-shrink:0;align-items:flex-end" onclick="event.stopPropagation()">' +
            '<div style="font-size:.75rem;color:var(--muted-text)">Today: <strong style="color:var(--text-color)">' + todayCnt + '</strong> | Earned: <strong style="color:var(--success-color)">Rs.' + totalEarn.toLocaleString('en-IN') + '</strong></div>' +
            '<div style="display:flex;gap:.4rem">' +
            appBtn + rejBtn +
            '<button class="btn btn-primary btn-sm" type="button" onclick="openDriverDashboard(\'' + id + '\')">📊 Dashboard</button>' +
            '</div>' +
            '</div>' +
            '</div>';
    }).join('');
    document.getElementById('drivers-list-modal').style.display = 'flex';
};

window.openDriverDashboard = (id) => {
        const d = D[id];
        if (!d) return;
        const {
            bks,
            earn,
            cnt,
            tB,
            yB,
            wB,
            mB,
            yRB,
            sb
        } = driverRow(id, d);
        const tb = {
            today: 0,
            urgent: 0,
            after: 0
        };
        bks.forEach(b => {
            if (tb[b.bookingType] !== undefined) tb[b.bookingType]++;
        });
        const sc = {
            confirmed: 0,
            pending: 0,
            cancelled: 0
        };
        bks.forEach(b => {
            if (sc[b.status] !== undefined) sc[b.status]++;
        });
        const allRows = bks.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(b =>
            '<tr>' +
            '<td><strong>' + b.customerName + '</strong><br><small style="color:var(--muted-text)">' + b.customerMobile + '</small></td>' +
            '<td>' + b.pickupLocation + '</td>' +
            '<td>' + b.dropLocation + '</td>' +
            '<td><span class="badge badge-info">' + b.bookingType + '</span></td>' +
            '<td>' + sBadge(b.status) + '</td>' +
            '<td>Rs.' + (b.earnings || 0).toLocaleString('en-IN') + '</td>' +
            '<td>' + (b.bookingDate || formatDate(b.createdAt)) + '</td>' +
            '</tr>'
        ).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--muted-text)">No bookings yet</td></tr>';
        const appBtn = d.status === 'pending' ? '<button class="btn btn-success btn-full" type="button" onclick="approveDriver(\'' + id + '\');document.getElementById(\'driver-dash-modal\').style.display=\'none\'" style="margin-bottom:1rem">✓ Approve This Driver - Make Live on Customer Portal</button>' : '';
        document.getElementById('drvdash-title').innerHTML = '<img src="' + (d.driverImage || 'https://placehold.co/32?text=D') + '" style="width:32px;height:32px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:.5rem"/>' + d.name + ' - Driver Dashboard';
        document.getElementById('drvdash-body').innerHTML =
            '<div class="dd-profile-grid">' +
            '<div class="dd-imgs">' +
            '<img src="' + (d.driverImage || 'https://placehold.co/190?text=Driver') + '" class="dd-avatar"/>' +
            '<img src="' + (d.carImage || 'https://placehold.co/190x110?text=Car') + '" class="dd-car"/>' +
            '<div class="dd-info-box">' +
            '<div style="font-weight:700">' + d.name + '</div>' +
            '<div style="color:var(--primary-color)">' + d.carModel + '</div>' +
            '<div>' + d.mobile + '</div>' +
            '<div>' + d.experience + ' yrs exp</div>' +
            '<div>' + d.carCapacity + ' seats</div>' +
            (d.carDetails ? '<div style="color:var(--muted-text)">' + d.carDetails + '</div>' : '') +
            '<div style="margin-top:.3rem">' + sb + '</div>' +
            '</div>' +
            '</div>' +
            '<div>' +
            appBtn +
            '<div class="section-title">Earnings by Period</div>' +
            '<div class="earn-grid">' +
            '<div class="stat-card" style="border-left-color:var(--accent-color)"><div class="stat-label">Today</div><div class="stat-value" style="font-size:1.1rem">Rs.' + earn(tB).toLocaleString('en-IN') + '</div><div style="font-size:.7rem;color:var(--muted-text)">' + cnt(tB) + ' bookings</div></div>' +
            '<div class="stat-card"><div class="stat-label">Yesterday</div><div class="stat-value" style="font-size:1.1rem">Rs.' + earn(yB).toLocaleString('en-IN') + '</div><div style="font-size:.7rem;color:var(--muted-text)">' + cnt(yB) + ' bookings</div></div>' +
            '<div class="stat-card success"><div class="stat-label">This Week</div><div class="stat-value" style="font-size:1.1rem">Rs.' + earn(wB).toLocaleString('en-IN') + '</div><div style="font-size:.7rem;color:var(--muted-text)">' + cnt(wB) + ' bookings</div></div>' +
            '<div class="stat-card accent"><div class="stat-label">This Month</div><div class="stat-value" style="font-size:1.1rem">Rs.' + earn(mB).toLocaleString('en-IN') + '</div><div style="font-size:.7rem;color:var(--muted-text)">' + cnt(mB) + ' bookings</div></div>' +
            '<div class="stat-card secondary"><div class="stat-label">This Year</div><div class="stat-value" style="font-size:1.1rem">Rs.' + earn(yRB).toLocaleString('en-IN') + '</div><div style="font-size:.7rem;color:var(--muted-text)">' + cnt(yRB) + ' bookings</div></div>' +
            '<div class="stat-card danger"><div class="stat-label">All Time</div><div class="stat-value" style="font-size:1.1rem">Rs.' + earn(bks).toLocaleString('en-IN') + '</div><div style="font-size:.7rem;color:var(--muted-text)">' + cnt(bks) + ' bookings</div></div>' +
            '</div>' +
            '<div class="type-status-grid">' +
            '<div><div class="section-title" style="font-size:.85rem">Booking Types</div>' +
            '<div style="display:flex;gap:.5rem">' +
            '<div class="mini-stat" style="flex:1"><div class="ms-label">Today</div><div class="ms-value" style="color:var(--primary-color)">' + tb.today + '</div></div>' +
            '<div class="mini-stat" style="flex:1"><div class="ms-label">Urgent</div><div class="ms-value" style="color:var(--accent-color)">' + tb.urgent + '</div></div>' +
            '<div class="mini-stat" style="flex:1"><div class="ms-label">After Days</div><div class="ms-value" style="color:var(--secondary-color)">' + tb.after + '</div></div>' +
            '</div></div>' +
            '<div><div class="section-title" style="font-size:.85rem">Booking Status</div>' +
            '<div style="display:flex;gap:.5rem">' +
            '<div class="mini-stat" style="flex:1"><div class="ms-label">Confirmed</div><div class="ms-value" style="color:var(--success-color)">' + sc.confirmed + '</div></div>' +
            '<div class="mini-stat" style="flex:1"><div class="ms-label">Pending</div><div class="ms-value" style="color:var(--warning-color)">' + sc.pending + '</div></div>' +
            '<div class="mini-stat" style="flex:1"><div class="ms-label">Cancelled</div><div class="ms-value" style="color:var(--danger-color)">' + sc.cancelled + '</div></div>' +
            '</div></div>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '<div class="section-title">All Bookings (' + cnt(bks) + ' total)</div>' +
            '<div class="table-wrap"><table>' +
            '<thead><tr><th>Customer</th><th>Pickup</th><th>Drop</th><th>Type</th><th>Status</th><th>Earnings</th><th>Date</th></tr></thead>' +
            '<tbody>' + allRows + '</tbody>' +
            '</table></div>';
        document.getElementById('driver-dash-modal').style.display = 'flex';
    };

window.previewAdImg = (input, previewId) => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        const img = document.getElementById(previewId);
        img.src = e.target.result;
        img.classList.add('show');
    };
    reader.readAsDataURL(file);
};

window.openAddDriverModal = () => {
    ['ad-name', 'ad-mobile', 'ad-pw', 'ad-exp', 'ad-car', 'ad-cap', 'ad-cardetails'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    ['ad-dimg', 'ad-cimg'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    ['ad-prev-d', 'ad-prev-c'].forEach(id => {
        const img = document.getElementById(id);
        if (img) {
            img.src = '';
            img.classList.remove('show');
        }
    });
    document.getElementById('add-driver-modal').style.display = 'flex';
};

window.submitAddDriver = async () => {
    const name = document.getElementById('ad-name').value.trim();
    const mobile = document.getElementById('ad-mobile').value.trim();
    const pw = document.getElementById('ad-pw').value.trim();
    const exp = parseInt(document.getElementById('ad-exp').value, 10);
    const carModel = document.getElementById('ad-car').value.trim();
    const capacity = parseInt(document.getElementById('ad-cap').value, 10);
    const carDetails = document.getElementById('ad-cardetails').value.trim();
    const driverImgFile = document.getElementById('ad-dimg').files[0];
    const carImgFile = document.getElementById('ad-cimg').files[0];

    if (!name || !mobile || !pw || isNaN(exp) || !carModel || isNaN(capacity)) {
        showToast('Please fill all required fields', 'error');
        return;
    }
    if (!/^[0-9]{10}$/.test(mobile)) {
        showToast('Enter valid 10-digit mobile number', 'error');
        return;
    }
    if (pw.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }
    if (!driverImgFile || !carImgFile) {
        showToast('Upload both driver and car photos', 'error');
        return;
    }

    const exists = await checkMobileExists(mobile);
    if (exists) {
        showToast('Mobile already registered', 'error');
        return;
    }

    const toBase64 = file => new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = event => resolve(event.target.result);
        reader.readAsDataURL(file);
    });

    const [driverImage, carImage] = await Promise.all([toBase64(driverImgFile), toBase64(carImgFile)]);
    await saveDriver({
        name,
        mobile,
        password: pw,
        experience: exp,
        carModel,
        carCapacity: capacity,
        carDetails,
        driverImage,
        carImage,
        status: 'approved',
        createdAt: Date.now()
    });

    showToast('Driver added and approved successfully!', 'success');
    document.getElementById('add-driver-modal').style.display = 'none';
    filterDriverCards();
};

// ===== CUSTOMERS =====
function renderCustomersTab() {
    const entries = Object.entries(C || {}).sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));
    const tbody = document.getElementById('customers-tbody');
    const noCustomers = document.getElementById('no-customers');
    
    if (!entries.length) {
        tbody.innerHTML = '';
        noCustomers.style.display = 'block';
        return;
    }
    noCustomers.style.display = 'none';
    
    tbody.innerHTML = entries.map(([id, c]) => {
        const bookings = Object.values(B || {}).filter(b => b.customerId === id);
        const total = bookings.length;
        const confirmed = bookings.filter(b => b.status === 'confirmed').length;
        const pending = bookings.filter(b => b.status === 'pending').length;
        const cancelled = bookings.filter(b => b.status === 'cancelled').length;
        return '<tr><td><strong>' + (c.name || '-') + '</strong></td><td>' + (c.mobile || '-') + '</td><td><strong>' + total + '</strong></td><td style="color:var(--success-color)">' + confirmed + '</td><td style="color:var(--warning-color)">' + pending + '</td><td style="color:var(--danger-color)">' + cancelled + '</td><td>' + formatDate(c.createdAt) + '</td></tr>';
    }).join('');
}
