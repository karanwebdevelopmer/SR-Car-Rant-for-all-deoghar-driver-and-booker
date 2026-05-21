// ===== FIREBASE CONFIG =====
import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
    getDatabase,
    ref,
    set,
    get,
    push,
    update,
    remove,
    onValue,
    query,
    orderByChild,
    equalTo
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyC0S5m_jwL_9t7cIn4lS_ls8Asv9S3XwBc",
    authDomain: "car-rent-services-74413.firebaseapp.com",
    databaseURL: "https://car-rent-services-74413-default-rtdb.firebaseio.com",
    projectId: "car-rent-services-74413",
    storageBucket: "car-rent-services-74413.firebasestorage.app",
    messagingSenderId: "929202584626",
    appId: "1:929202584626:web:cb454cb49e40517bb4502b"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ===== UTILITIES =====
export function showToast(msg, type = "info") {
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        container.className = "toast-container";
        document.body.appendChild(container);
    }
    const icons = {
        success: "✅",
        error: "❌",
        info: "ℹ️",
        warning: "⚠️"
    };
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type] || "ℹ️"}</span><span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

export function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

export function formatDate(ts) {
    if (!ts) return "—";
    return new Date(ts).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

export function formatDateTime(ts) {
    if (!ts) return "—";
    return new Date(ts).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
    });
}

export function calculateBookingEarnings(type) {
    const rates = {
        today: 800,
        urgent: 1200,
        after: 600
    };
    return rates[type] || 700;
}

// ===== FIREBASE HELPERS =====
export async function seedAdmin() {
    const adminRef = ref(db, "admin");
    const snap = await get(adminRef);
    if (!snap.exists()) {
        await set(adminRef, {
            mobile: "9334252886",
            password: "karan128"
        });
    }
}

export async function getAdminCreds() {
    const snap = await get(ref(db, "admin"));
    return snap.val();
}

export async function updateAdminPassword(password) {
    await update(ref(db, "admin"), { password });
}

export async function getAllDrivers() {
    const snap = await get(ref(db, "drivers"));
    if (!snap.exists()) return {};
    return snap.val();
}

export async function getAllBookings() {
    const snap = await get(ref(db, "bookings"));
    if (!snap.exists()) return {};
    return snap.val();
}

export async function getDriverById(id) {
    const snap = await get(ref(db, `drivers/${id}`));
    return snap.val();
}

export async function saveDriver(data) {
    const newRef = push(ref(db, "drivers"));
    await set(newRef, {
        ...data,
        createdAt: Date.now()
    });
    return newRef.key;
}

export async function updateDriver(id, data) {
    await update(ref(db, `drivers/${id}`), data);
}

export async function deleteDriver(id) {
    await remove(ref(db, `drivers/${id}`));
}

export async function saveBooking(data) {
    const newRef = push(ref(db, "bookings"));
    await set(newRef, {
        ...data,
        createdAt: Date.now()
    });
    return newRef.key;
}

export async function updateBooking(id, data) {
    await update(ref(db, `bookings/${id}`), data);
}

export async function getDriverByMobile(mobile) {
    const q = query(ref(db, 'drivers'), orderByChild('mobile'), equalTo(mobile));
    const snap = await get(q);
    if (!snap.exists()) return null;
    const entries = Object.entries(snap.val());
    return entries[0] || null;
}

export async function checkMobileExists(mobile) {
    return !!(await getDriverByMobile(mobile));
}

export async function getAllCustomers() {
    const snap = await get(ref(db, "customers"));
    if (!snap.exists()) return {};
    return snap.val();
}

export async function getCustomerByMobile(mobile) {
    const q = query(ref(db, 'customers'), orderByChild('mobile'), equalTo(mobile));
    const snap = await get(q);
    if (!snap.exists()) return null;
    const entries = Object.entries(snap.val());
    return entries[0] || null;
}

export async function saveCustomer(data) {
    const newRef = push(ref(db, "customers"));
    await set(newRef, {
        ...data,
        createdAt: Date.now()
    });
    return newRef.key;
}

export async function updateCustomer(id, data) {
    await update(ref(db, `customers/${id}`), data);
}

export async function checkCustomerMobileExists(mobile) {
    return !!(await getCustomerByMobile(mobile));
}

export function listenCustomers(callback) {
    onValue(ref(db, "customers"), snap => callback(snap.val() || {}));
}

export function listenCustomerBookings(customerId, callback) {
    onValue(ref(db, "bookings"), snap => {
        const all = snap.val() || {};
        const mine = {};
        Object.entries(all).forEach(([k, v]) => {
            if (v.customerId === customerId) mine[k] = v;
        });
        callback(mine);
    });
}

export function listenDrivers(callback) {
    onValue(ref(db, "drivers"), snap => callback(snap.val() || {}));
}

export function listenBookings(callback) {
    onValue(ref(db, "bookings"), snap => callback(snap.val() || {}));
}

export function listenDriverBookings(driverId, callback) {
    onValue(ref(db, "bookings"), snap => {
        const all = snap.val() || {};
        const mine = {};
        Object.entries(all).forEach(([k, v]) => {
            if (v.driverId === driverId) mine[k] = v;
        });
        callback(mine);
    });
}

export {
    db,
    ref,
    set,
    get,
    push,
    update,
    remove,
    onValue
};