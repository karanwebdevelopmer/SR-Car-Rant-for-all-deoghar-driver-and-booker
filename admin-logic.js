import {
    showToast,
    seedAdmin,
    getAdminCreds,
    updateAdminPassword,
    saveDriver,
    updateDriver,
    listenDrivers,
    listenBookings,
    listenCustomers
} from './script.js';

const SESSION_KEY = 'sr_admin_session';
let adminSession = null;
let drivers = {};
let customers = {};
let bookings = {};
let currentPeriod = 'today';
let charts = {};
let adminGeneratedOTP = null;
let adminOtpMobile = null;

function escapeHtml(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function setElementText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function setElementHtml(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
}

function toggleClass(selector, cls, condition) {
    document.querySelectorAll(selector).forEach(el => el.classList.toggle(cls, condition));
}

function saveSession(mobile) {
    adminSession = { mobile };
    localStorage.setItem(SESSION_KEY, JSON.stringify(adminSession));
}

function clearSession() {
    adminSession = null;
    localStorage.removeItem(SESSION_KEY);
}

function showLoginScreen() {
    document.getElementById('admin-login').style.display = 'flex';
    document.getElementById('admin-dashboard').style.display = 'none';
    document.getElementById('admin-forgot-form').style.display = 'none';
    showAdminLogin();
}

function showAdminDashboard() {
    document.getElementById('admin-login').style.display = 'none';
    document.getElementById('admin-dashboard').style.display = 'block';
    showTab('dashboard');
    updateAllData();
}

async function init() {
    await seedAdmin();
    attachWindowHelpers();
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
        try {
            const session = JSON.parse(stored);
            if (session?.mobile) {
                adminSession = session;
                showAdminDashboard();
            }
        } catch {
            clearSession();
        }
    }

    listenDrivers(data => {
        drivers = data || {};
        if (adminSession) updateAllData();
    });
    listenCustomers(data => {
        customers = data || {};
        if (adminSession) updateAllData();
    });
    listenBookings(data => {
        bookings = data || {};
        if (adminSession) updateAllData();
    });
}

function attachWindowHelpers() {
    window.togglePw = (id, btn) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.type = el.type === 'password' ? 'text' : 'password';
        btn.textContent = el.type === 'password' ? '👁' : '🙈';
    };

    window.showAdminForgot = () => {
        document.getElementById('admin-login-form').style.display = 'none';
        document.getElementById('admin-forgot-form').style.display = 'block';
    };

    window.showAdminLogin = () => {
        document.getElementById('admin-login-form').style.display = 'block';
        document.getElementById('admin-forgot-form').style.display = 'none';
    };

    window.adminLogin = async () => {
        const mobile = document.getElementById('adm-mobile').value.trim();
        const password = document.getElementById('adm-password').value.trim();
        if (!/^\d{10}$/.test(mobile) || password.length < 6) {
            showToast('Enter valid admin mobile and password', 'error');
            return;
        }
        const creds = await getAdminCreds();
        if (!creds || creds.mobile !== mobile || creds.password !== password) {
            showToast('Invalid admin credentials', 'error');
            return;
        }
        saveSession(mobile);
        showToast('Admin login successful', 'success');
        showAdminDashboard();
    };

    window.adminLogout = () => {
        clearSession();
        showToast('Logged out', 'info');
        showLoginScreen();
    };

    window.adminSendOTP = () => {
        const mobile = document.getElementById('adm-forgot-mobile').value.trim();
        if (!/^\d{10}$/.test(mobile)) {
            showToast('Enter valid admin mobile', 'error');
            return;
        }
        adminOtpMobile = mobile;
        adminGeneratedOTP = Math.floor(100000 + Math.random() * 900000).toString();
        document.getElementById('adm-otp-display').textContent = 'Sent';
        document.getElementById('adm-forgot-s1').style.display = 'none';
        document.getElementById('adm-forgot-s2').style.display = 'block';
        showToast('OTP generated. Use it to reset your password.', 'info');
    };

    window.adminResetPw = async () => {
        const otp = document.getElementById('adm-otp-input').value.trim();
        const password = document.getElementById('adm-new-pw').value.trim();
        if (!adminGeneratedOTP || otp !== adminGeneratedOTP) {
            showToast('Invalid OTP', 'error');
            return;
        }
        if (password.length < 6) {
            showToast('Password must be at least 6 characters', 'error');
            return;
        }
        const creds = await getAdminCreds();
        if (!creds || creds.mobile !== adminOtpMobile) {
            showToast('Admin mobile mismatch', 'error');
            return;
        }
        await updateAdminPassword(password);
        showToast('Admin password reset successfully', 'success');
        showAdminLogin();
    };

    window.toggleSidebar = () => {
        document.getElementById('sidebar').classList.toggle('open');
        document.getElementById('sidebar-overlay').style.display = document.getElementById('sidebar').classList.contains('open') ? 'block' : 'none';
    };

    window.closeSidebar = () => {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebar-overlay').style.display = 'none';
    };

    window.showTab = tab => {
        document.querySelectorAll('.tab-content-panel').forEach(panel => {
            panel.style.display = panel.id === `tab-${tab}` ? 'block' : 'none';
        });
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
            item.classList.toggle('active', item.textContent.toLowerCase().includes(tab));
        });
        document.querySelectorAll('.period-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.period === currentPeriod));
        const activeTab = document.getElementById(`tab-${tab}`);
        if (activeTab) activeTab.scrollTop = 0;
        updateAllData();
    };

    window.setPeriod = period => {
        currentPeriod = period;
        document.querySelectorAll('.period-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.period === period));
        updateAllData();
    };

    window.openAddDriverModal = () => {
        document.getElementById('add-driver-modal').style.display = 'flex';
        ['ad-name','ad-mobile','ad-pw','ad-exp','ad-car','ad-cap','ad-cardetails'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        ['ad-prev-d','ad-prev-c'].forEach(id => {
            const img = document.getElementById(id);
            if (img) { img.src = ''; img.classList.remove('show'); }
        });
    };

    window.submitAddDriver = async () => {
        const name = document.getElementById('ad-name').value.trim();
        const mobile = document.getElementById('ad-mobile').value.trim();
        const password = document.getElementById('ad-pw').value.trim();
        const experience = parseInt(document.getElementById('ad-exp').value, 10);
        const carModel = document.getElementById('ad-car').value.trim();
        const capacity = parseInt(document.getElementById('ad-cap').value, 10);
        const carDetails = document.getElementById('ad-cardetails').value.trim();
        const driverFile = document.getElementById('ad-dimg').files[0];
        const carFile = document.getElementById('ad-cimg').files[0];

        if (!name || !/^\d{10}$/.test(mobile) || password.length < 6 || isNaN(experience) || !carModel || isNaN(capacity) || capacity < 1 || !driverFile || !carFile) {
            showToast('Please fill all required driver fields', 'error');
            return;
        }

        const toBase64 = file => new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.readAsDataURL(file);
        });

        const [driverImage, carImage] = await Promise.all([toBase64(driverFile), toBase64(carFile)]);
        await saveDriver({ name, mobile, password, experience, carModel, carCapacity: capacity, carDetails, driverImage, carImage, status: 'approved', live: false });
        showToast('Driver added and approved successfully', 'success');
        document.getElementById('add-driver-modal').style.display = 'none';
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

    window.openDriversListModal = status => {
        const modal = document.getElementById('drivers-list-modal');
        const body = document.getElementById('drvlist-body');
        const filtered = Object.entries(drivers).filter(([, d]) => status === 'all' || d.status === status);
        body.innerHTML = filtered.map(([id, d], index) => `
            <div class="card-panel" style="margin-bottom:1rem">
                <div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap">
                    <div>
                        <strong>${escapeHtml(d.name)}</strong> · ${escapeHtml(d.carModel)} · ${escapeHtml(d.mobile)}
                    </div>
                    <div style="display:flex;gap:.35rem;align-items:center;flex-wrap:wrap">
                        <span class="badge ${d.live ? 'badge-success' : 'badge-secondary'}">${d.live ? 'Live' : 'Offline'}</span>
                        <span class="badge ${d.status === 'approved' ? 'badge-success' : 'badge-warning'}">${escapeHtml(d.status)}</span>
                    </div>
                </div>
                <div style="margin-top:.75rem;color:var(--muted-text);font-size:.9rem">${escapeHtml(d.carDetails || 'No details')}</div>
            </div>
        `).join('');
        modal.style.display = 'flex';
        document.getElementById('drvlist-title').textContent = status === 'all' ? 'All Drivers' : `${status.charAt(0).toUpperCase() + status.slice(1)} Drivers`;
    };
}

function updateAllData() {
    updateStats();
    filterDriverCards();
    renderCustomersTable();
    renderBookingsTable();
    renderNotificationsList();
    renderAnalytics();
}

function updateStats() {
    const driverEntries = Object.entries(drivers);
    const bookingEntries = Object.entries(bookings);
    const customerEntries = Object.entries(customers);
    const approved = driverEntries.filter(([, d]) => d.status === 'approved').length;
    const pending = driverEntries.filter(([, d]) => d.status === 'pending').length;
    const bookingConfirmed = bookingEntries.filter(([, b]) => b.status === 'confirmed').length;
    const bookingPending = bookingEntries.filter(([, b]) => b.status === 'pending').length;
    const bookingCancelled = bookingEntries.filter(([, b]) => b.status === 'cancelled').length;
    const revenue = bookingEntries.reduce((sum, [, b]) => sum + (Number(b.earnings) || 0), 0);
    const periodRevenue = bookingEntries.reduce((sum, [, b]) => {
        if (matchesPeriod(b.createdAt, currentPeriod)) return sum + (Number(b.earnings) || 0);
        return sum;
    }, 0);
    const periodBookings = bookingEntries.filter(([, b]) => matchesPeriod(b.createdAt, currentPeriod)).length;

    setElementText('s-total-drivers', driverEntries.length);
    setElementText('s-approved-drivers', approved);
    setElementText('s-pending-drivers', pending);
    setElementText('s-total-customers', customerEntries.length);
    setElementText('s-total-bookings', bookingEntries.length);
    setElementText('s-period-bookings', periodBookings);
    setElementText('s-revenue', `Rs.${periodRevenue}`);
    setElementText('s-confirmed', bookingConfirmed);
    setElementText('s-pending-bk', bookingPending);
}

function filterDriverCards() {
    const queryText = document.getElementById('driver-search')?.value.toLowerCase().trim() || '';
    const filterValue = document.getElementById('driver-filter')?.value || 'all';
    const filteredEntries = Object.entries(drivers).filter(([, d]) => {
        const matchesStatus = filterValue === 'all' || d.status === filterValue;
        const matchesQuery = !queryText || [d.name, d.carModel, d.carDetails, d.mobile].some(field => String(field || '').toLowerCase().includes(queryText));
        return matchesStatus && matchesQuery;
    });
    renderDriverCards(filteredEntries);
}
window.filterDriverCards = filterDriverCards;

function matchesPeriod(timestamp, period) {
    if (!timestamp) return false;
    const createdAt = Number(timestamp);
    const now = Date.now();
    const diffDays = (now - createdAt) / (1000 * 60 * 60 * 24);
    if (period === 'today') return diffDays <= 1;
    if (period === 'week') return diffDays <= 7;
    if (period === 'month') return diffDays <= 30;
    if (period === 'year') return diffDays <= 365;
    return true;
}

function renderDriverCards(entries = Object.entries(drivers)) {
    const container = document.getElementById('drivers-cards');
    if (!entries.length) {
        container.innerHTML = `<div style="grid-column:1/-1" class="empty-state"><div class="icon">👥</div><p>No drivers found.</p></div>`;
        return;
    }
    container.innerHTML = entries.map(([id, d]) => `
        <div class="card-panel" style="display:flex;flex-direction:column;gap:.85rem">
            <div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap">
                <div><strong>${escapeHtml(d.name)}</strong><br><small>${escapeHtml(d.carModel)}</small></div>
                <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center">
                    <span class="badge ${d.live ? 'badge-success' : 'badge-secondary'}">${d.live ? 'Live' : 'Offline'}</span>
                    <span class="badge ${d.status === 'approved' ? 'badge-success' : 'badge-warning'}">${escapeHtml(d.status)}</span>
                </div>
            </div>
            <div>${escapeHtml(d.carDetails || 'No car details')}</div>
            <div style="display:flex;gap:.5rem;flex-wrap:wrap">
                <button class="btn btn-secondary btn-sm" type="button" onclick="openDriverDashboard('${id}')">View</button>
                ${d.status === 'pending' ? `<button class="btn btn-primary btn-sm" type="button" onclick="approveDriver('${id}')">Approve</button>` : ''}
            </div>
        </div>
    `).join('');
}

window.openDriverDashboard = id => {
    const driver = drivers[id];
    if (!driver) return;
    const body = document.getElementById('drvdash-body');
    const driverBookings = Object.values(bookings).filter(b => b.driverId === id);
    body.innerHTML = `
        <div class="dd-profile-grid">
            <div class="dd-imgs">
                <img class="dd-avatar" src="${escapeHtml(driver.driverImage || 'https://placehold.co/300x190?text=Driver')}" alt="Driver">
                <img class="dd-car" src="${escapeHtml(driver.carImage || 'https://placehold.co/300x110?text=Car')}" alt="Car">
            </div>
            <div>
                <div class="dd-info-box">
                    <div><strong>Name:</strong> ${escapeHtml(driver.name)}</div>
                    <div><strong>Mobile:</strong> ${escapeHtml(driver.mobile)}</div>
                    <div><strong>Car:</strong> ${escapeHtml(driver.carModel)}</div>
                    <div><strong>Seats:</strong> ${escapeHtml(driver.carCapacity)}</div>
                    <div><strong>Status:</strong> ${escapeHtml(driver.status)}</div>
                </div>
                <div class="earn-grid" style="margin-top:1rem">
                    <div class="card-panel"><strong>${driverBookings.length}</strong><br>Bookings</div>
                    <div class="card-panel"><strong>Rs.${driverBookings.reduce((sum, b) => sum + (Number(b.earnings)||0),0)}</strong><br>Earnings</div>
                    <div class="card-panel"><strong>${driverBookings.filter(b => b.status === 'confirmed').length}</strong><br>Confirmed</div>
                </div>
            </div>
        </div>
    `;
    document.getElementById('driver-dash-modal').style.display = 'flex';
};

window.approveDriver = async id => {
    await updateDriver(id, { status: 'approved' });
    showToast('Driver approved in seconds', 'success');
};

function renderCustomersTable() {
    const body = document.getElementById('customers-tbody');
    const entries = Object.entries(customers);
    if (!entries.length) {
        document.getElementById('no-customers').style.display = 'block';
        body.innerHTML = '';
        return;
    }
    document.getElementById('no-customers').style.display = 'none';
    body.innerHTML = entries.map(([id, c]) => {
        const customerBookings = Object.values(bookings).filter(b => b.customerId === id);
        return `
            <tr>
                <td><img class="customer-avatar" src="${escapeHtml(c.photo || 'https://placehold.co/80x80?text=User')}" alt="${escapeHtml(c.name)}" /></td>
                <td>${escapeHtml(c.name)}</td>
                <td>${escapeHtml(c.mobile)}</td>
                <td>${customerBookings.length}</td>
                <td>${customerBookings.filter(b => b.status === 'confirmed').length}</td>
                <td>${customerBookings.filter(b => b.status === 'pending').length}</td>
                <td>${customerBookings.filter(b => b.status === 'cancelled').length}</td>
                <td>${formatDate(c.createdAt)}</td>
            </tr>
        `;
    }).join('');
}

function renderBookingsTable() {
    const body = document.getElementById('all-bookings-tbody');
    const entries = Object.entries(bookings);
    if (!entries.length) {
        document.getElementById('no-all-bookings').style.display = 'block';
        body.innerHTML = '';
        return;
    }
    document.getElementById('no-all-bookings').style.display = 'none';
    body.innerHTML = entries.map(([id, b]) => `
        <tr>
            <td>${escapeHtml(b.customerName || b.customerMobile)}</td>
            <td>${escapeHtml(b.driverName)}</td>
            <td>${escapeHtml(b.bookingType)}</td>
            <td>${escapeHtml(b.pickupLocation)}</td>
            <td>${escapeHtml(b.dropLocation)}</td>
            <td>${escapeHtml(b.status)}</td>
            <td>Rs.${Number(b.earnings)||0}</td>
            <td>${formatDate(b.createdAt)}</td>
            <td><button class="btn btn-secondary btn-sm" type="button" onclick="approveBooking('${id}')">View</button></td>
        </tr>
    `).join('');
}

window.approveBooking = id => {
    const booking = bookings[id];
    if (!booking) return;
    showToast(`Booking #${id} selected.`, 'info');
};

function renderNotificationsList() {
    const container = document.getElementById('notif-list');
    const pending = Object.entries(drivers).filter(([, d]) => d.status === 'pending');
    const badge = document.getElementById('notif-badge');
    if (badge) {
        badge.textContent = pending.length;
        badge.style.display = pending.length ? 'inline-flex' : 'none';
    }
    if (!pending.length) {
        document.getElementById('no-notifs').style.display = 'block';
        container.innerHTML = '';
        return;
    }
    document.getElementById('no-notifs').style.display = 'none';
    container.innerHTML = pending.map(([id, d]) => `
        <div class="card-panel" style="margin-bottom:1rem">
            <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:1rem">
                <div>
                    <strong>${escapeHtml(d.name)}</strong><br>
                    <small>${escapeHtml(d.carModel)} · ${escapeHtml(d.mobile)}</small>
                </div>
                <button class="btn btn-primary btn-sm" type="button" onclick="approveDriver('${id}')">Approve Now</button>
            </div>
        </div>
    `).join('');
}

function renderAnalytics() {
    const entries = Object.entries(bookings);
    const types = ['today', 'urgent', 'after'];
    const typeCounts = types.map(type => entries.filter(([, b]) => b.bookingType === type).length);
    const revenueLast7 = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        const dayKey = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        const total = entries.reduce((sum, [, b]) => {
            const createdAt = Number(b.createdAt);
            const diffDays = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
            if (Math.floor(diffDays) === 6 - i) return sum + (Number(b.earnings) || 0);
            return sum;
        }, 0);
        return { label: dayKey, value: total };
    });
    const driverEarnings = Object.entries(drivers).map(([id, d]) => {
        const total = Object.values(bookings).filter(b => b.driverId === id).reduce((sum, b) => sum + (Number(b.earnings) || 0), 0);
        return { name: d.name || 'Driver', total };
    }).sort((a, b) => b.total - a.total).slice(0, 10);

    if (!charts.typeChart) {
        charts.typeChart = new Chart(document.getElementById('chart-type'), {
            type: 'doughnut',
            data: {
                labels: ['Today', 'Urgent', 'After'],
                datasets: [{ data: typeCounts, backgroundColor: ['#3b82f6', '#f59e0b', '#8b5cf6'] }]
            },
            options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
        });
    } else {
        charts.typeChart.data.datasets[0].data = typeCounts;
        charts.typeChart.update();
    }

    if (!charts.revenueChart) {
        charts.revenueChart = new Chart(document.getElementById('chart-revenue'), {
            type: 'line',
            data: {
                labels: revenueLast7.map(item => item.label),
                datasets: [{
                    label: 'Revenue',
                    data: revenueLast7.map(item => item.value),
                    borderColor: '#22c55e',
                    backgroundColor: 'rgba(34,197,94,0.15)',
                    fill: true,
                    tension: 0.35
                }]
            },
            options: { responsive: true, plugins: { legend: { display: false } } }
        });
    } else {
        charts.revenueChart.data.labels = revenueLast7.map(item => item.label);
        charts.revenueChart.data.datasets[0].data = revenueLast7.map(item => item.value);
        charts.revenueChart.update();
    }

    const topDriversBody = document.getElementById('top-drivers-tbody');
    topDriversBody.innerHTML = driverEarnings.slice(0, 5).map((driver, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(driver.name)}</td>
            <td>—</td>
            <td>${Object.values(bookings).filter(b => b.driverName === driver.name).length}</td>
            <td>Rs.${driver.total}</td>
        </tr>
    `).join('');
}

init();

