// ================ SUPER ADMIN - QUẢN LÝ TẤT CẢ NGƯỜI DÙNG ================
let currentSuperAdmin = null;
let allUsers = [];
let filteredUsers = [];
let allOwners = new Set();
let revenueData = {};
let currentViewUserId = null;

// --- THAY ĐỔI LỚN 1: API RENDER ---
// Đặt URL API Render của bạn ở đây
const API_BASE_URL = 'https://api-datn-2025.onrender.com';

/**
 * HÀM HỖ TRỢ MỚI:
 * Lấy ID Token và gọi API trên Render
 */
async function callSuperAdminAPI(endpoint, data) {
    const user = firebase.auth().currentUser;
    if (!user) {
        throw new Error("Người dùng chưa đăng nhập.");
    }
    
    // 1. Lấy ID token mới nhất
    const token = await user.getIdToken(true); // true = force refresh

    // 2. Gọi API bằng fetch
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` // Gửi token trong header
        },
        body: JSON.stringify(data)
    });

    // 3. Xử lý response
    const result = await response.json();
    if (!response.ok) {
        // Nếu server trả lỗi (4xx, 5xx), ném lỗi để .catch() bắt được
        throw new Error(result.error || result.message || `Lỗi ${response.status}`);
    }
    return result;
}


/**
 * Khởi tạo trang Super Admin
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Khởi tạo Super Admin...');
    
    // --- THAY ĐỔI LỚN 2: BỎ KHỞI TẠO FUNCTIONS ---
    // (Chúng ta không dùng Firebase Functions nữa)
    
    // Kiểm tra đăng nhập
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            // Lấy ID Token để kiểm tra Custom Claim
            user.getIdTokenResult(true).then((idTokenResult) => {
                // Kiểm tra xem user có phải Super Admin không
                if (idTokenResult.claims.role !== 'superadmin') {
                    alert('Bạn không có quyền Super Admin. Đang đăng xuất...');
                    console.warn('Người dùng đăng nhập không phải Super Admin:', user.email);
                    handleLogout();
                    return;
                }
                
                console.log('✅ Super Admin đã đăng nhập:', user.email);
                currentSuperAdmin = user;
                document.getElementById('admin-name').textContent = user.displayName || 'Super Admin';
                document.getElementById('admin-email').textContent = user.email;
                
                // Tải tất cả người dùng
                loadAllUsers();
                
                // Thiết lập event listeners
                setupEventListeners();

            }).catch((error) => {
                console.error("Lỗi lấy thông tin vai trò:", error);
                alert("Lỗi xác thực vai trò Super Admin. Vui lòng đăng nhập lại.");
                window.location.href = '../Admin/login.html';
            });
            
        } else {
            console.log('❌ Chưa đăng nhập, chuyển hướng...');
            window.location.href = '../Admin/login.html';
        }
    });
    
    // Thiết lập date inputs với giá trị mặc định
    setDefaultDates();
});

// (Tất cả các hàm từ setDefaultDates đến closeViewModal giữ nguyên)
// ...
// ... (bỏ qua các hàm không đổi để cho ngắn gọn)
// ...

/**
 * Thiết lập giá trị mặc định cho date inputs
 */
function setDefaultDates() {
    const today = new Date();
    
    // Week
    const weekInput = document.getElementById('revenue-week');
    if (weekInput) {
        const year = today.getFullYear();
        const week = getWeekNumber(today);
        weekInput.value = `${year}-W${week.toString().padStart(2, '0')}`;
    }
    
    // Month
    const monthInput = document.getElementById('revenue-month');
    if (monthInput) {
        const year = today.getFullYear();
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        monthInput.value = `${year}-${month}`;
    }
    
    // Year
    const yearInput = document.getElementById('revenue-year');
    if (yearInput) {
        yearInput.value = today.getFullYear();
    }
}

/**
 * Lấy số tuần trong năm
 */
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Thiết lập event listeners
 */
function setupEventListeners() {
    const searchInput = document.getElementById('search-input');
    const roleFilter = document.getElementById('role-filter');
    const ownerFilter = document.getElementById('owner-filter');
    const periodType = document.getElementById('revenue-period-type');
    
    if (searchInput) {
        searchInput.addEventListener('input', debounce(applyFilters, 300));
    }
    
    if (roleFilter) {
        roleFilter.addEventListener('change', applyFilters);
    }
    
    if (ownerFilter) {
        ownerFilter.addEventListener('change', applyFilters);
    }
    
    if (periodType) {
        periodType.addEventListener('change', togglePeriodSelector);
    }
}

/**
 * Toggle hiển thị selector theo loại báo cáo
 */
function togglePeriodSelector() {
    const periodType = document.getElementById('revenue-period-type').value;
    const weekSelector = document.getElementById('week-selector');
    const monthSelector = document.getElementById('month-selector');
    const yearSelector = document.getElementById('year-selector');
    
    weekSelector.style.display = periodType === 'week' ? 'block' : 'none';
    monthSelector.style.display = periodType === 'month' ? 'block' : 'none';
    yearSelector.style.display = periodType === 'year' ? 'block' : 'none';
}

/**
 * Debounce function để tối ưu performance
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Xử lý đăng xuất
 */
function handleLogout() {
    firebase.auth().signOut()
        .then(() => {
            console.log('✅ Đăng xuất thành công');
            window.location.href = '../';
        })
        .catch((error) => {
            console.error('❌ Lỗi đăng xuất:', error);
        });
}

/**
 * Tải TẤT CẢ người dùng từ Firebase (không lọc theo owner)
 */
function loadAllUsers() {
    console.log('📊 Đang tải TẤT CẢ người dùng...');
    setTableLoading(true); // Hiển thị loading
    
    db.ref('dataUser')
        .once('value', (snapshot) => {
            allUsers = [];
            allOwners = new Set();
            
            if (snapshot.exists()) {
                snapshot.forEach((child) => {
                    const userData = child.val();
                    const userEntry = {
                        id: child.key,
                        ...userData
                    };
                    allUsers.push(userEntry);
                    
                    const role = (userData.role || 'user').toLowerCase();
                    if (role === 'owner' || role === 'admin') {
                        allOwners.add(JSON.stringify({id: userEntry.id, name: userEntry.name || 'Chưa có tên'}));
                    }
                });
            }
            
            console.log(`✅ Đã tải ${allUsers.length} người dùng`);
            
            allOwners = Array.from(allOwners).map(item => JSON.parse(item));
            console.log(`✅ Tìm thấy ${allOwners.length} owner khác nhau`);
            
            updateOwnerFilter();
            updateRevenueOwnerFilter();
            updateStatistics();
            
            filteredUsers = [...allUsers];
            renderUsersTable(); 
        })
        .catch(error => {
            console.error('❌ Lỗi tải người dùng:', error);
            showError('Không thể tải dữ liệu người dùng');
        });
}

/**
 * Cập nhật dropdown owner filter
 */
function updateOwnerFilter() {
    const ownerFilter = document.getElementById('owner-filter');
    if (!ownerFilter) return;
    
    ownerFilter.innerHTML = '<option value="all">Tất cả Owner</option>';
    
    allOwners.forEach(owner => {
        const option = document.createElement('option');
        option.value = owner.id;
        option.textContent = `${owner.name} (${owner.id.substring(0, 8)}...)`;
        ownerFilter.appendChild(option);
    });
}

/**
 * Cập nhật dropdown owner filter cho báo cáo doanh thu
 */
function updateRevenueOwnerFilter() {
    const revenueOwnerFilter = document.getElementById('revenue-owner-filter');
    if (!revenueOwnerFilter) return;
    
    revenueOwnerFilter.innerHTML = '<option value="all">Tất cả chuỗi cửa hàng</option>';
    
    allOwners.forEach(owner => {
        const option = document.createElement('option');
        option.value = owner.id;
        option.textContent = `${owner.name} (${owner.id.substring(0, 8)}...)`;
        revenueOwnerFilter.appendChild(option);
    });
}

/**
 * Cập nhật thống kê
 */
function updateStatistics() {
    const stats = {
        total: allUsers.length,
        owners: 0,
        managers: 0,
        players: 0
    };
    
    allUsers.forEach(user => {
        const role = (user.role || 'user').toLowerCase();
        if (role === 'admin' || role === 'owner') {
            stats.owners++;
        } else if (role === 'manager') {
            stats.managers++;
        } else {
            stats.players++;
        }
    });
    
    document.getElementById('total-users').textContent = stats.total;
    document.getElementById('total-owners').textContent = stats.owners;
    document.getElementById('total-managers').textContent = stats.managers;
    document.getElementById('total-players').textContent = stats.players;
}

/**
 * Tải báo cáo doanh thu
 */
function loadRevenueReport() {
    const ownerFilter = document.getElementById('revenue-owner-filter').value;
    const periodType = document.getElementById('revenue-period-type').value;
    
    let startDate, endDate;
    
    if (periodType === 'week') {
        const weekValue = document.getElementById('revenue-week').value;
        if (!weekValue) {
            alert('Vui lòng chọn tuần!');
            return;
        }
        const [year, week] = weekValue.split('-W');
        const dates = getWeekDates(parseInt(year), parseInt(week));
        startDate = dates.start;
        endDate = dates.end;
    } else if (periodType === 'month') {
        const monthValue = document.getElementById('revenue-month').value;
        if (!monthValue) {
            alert('Vui lòng chọn tháng!');
            return;
        }
        const [year, month] = monthValue.split('-');
        startDate = new Date(year, month - 1, 1);
        endDate = new Date(year, month, 0, 23, 59, 59);
    } else if (periodType === 'year') {
        const yearValue = document.getElementById('revenue-year').value;
        if (!yearValue) {
            alert('Vui lòng nhập năm!');
            return;
        }
        startDate = new Date(yearValue, 0, 1);
        endDate = new Date(yearValue, 11, 31, 23, 59, 59);
    }
    
    console.log('📊 Tải báo cáo doanh thu:', { ownerFilter, periodType, startDate, endDate });
    
    db.ref('dataBookTable') 
        .once('value', (snapshot) => {
            revenueData = {};
            let totalRevenue = 0;
            let totalOrders = 0;
            
            if (snapshot.exists()) {
                snapshot.forEach((child) => {
                    const booking = child.val();
                    const timestamp = booking.createdAt || new Date(booking.dateTime.split('/').reverse().join('-')).getTime();
                    const bookingDate = new Date(timestamp); 
                    
                    if (bookingDate >= startDate && bookingDate <= endDate) {
                        
                        if (ownerFilter === 'all' || booking.storeOwnerId === ownerFilter) {
                            
                            const ownerId = booking.storeOwnerId || 'unknown';
                            const storeId = booking.storeId || 'unknown';
                            const revenue = parseFloat(booking.money || 0); 
                            
                            if (revenueData[ownerId] === undefined) {
                                revenueData[ownerId] = {
                                    total: 0,
                                    orders: 0,
                                    stores: {}
                                };
                            }
                            
                            if (revenueData[ownerId].stores[storeId] === undefined) {
                                revenueData[ownerId].stores[storeId] = {
                                    revenue: 0,
                                    orders: 0
                                };
                            }
                            
                            revenueData[ownerId].total += revenue;
                            revenueData[ownerId].orders += 1;
                            revenueData[ownerId].stores[storeId].revenue += revenue;
                            revenueData[ownerId].stores[storeId].orders += 1;
                            
                            totalRevenue += revenue;
                            totalOrders += 1;
                        }
                    }
                });
            }
            
            console.log('✅ Dữ liệu doanh thu:', revenueData);
            displayRevenueReport(totalRevenue, totalOrders);
        })
        .catch(error => {
            console.error('❌ Lỗi tải doanh thu:', error);
            alert('Không thể tải dữ liệu doanh thu. Vui lòng thử lại!');
        });
}
/**
 * Lấy ngày bắt đầu và kết thúc của tuần
 */
function getWeekDates(year, week) {
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4)
        ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else
        ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    
    const start = new Date(ISOweekStart);
    const end = new Date(ISOweekStart);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59);
    
    return { start, end };
}

/**
 * Hiển thị báo cáo doanh thu
 */
function displayRevenueReport(totalRevenue, totalOrders) {
    const revenueDisplay = document.getElementById('revenue-display');
    const revenueDetails = document.getElementById('revenue-details');
    
    if (!revenueDisplay || !revenueDetails) return;
    
    document.getElementById('total-revenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('total-orders').textContent = totalOrders;
    document.getElementById('avg-revenue').textContent = totalOrders > 0 
        ? formatCurrency(totalRevenue / totalOrders) 
        : '0 đ';
    
    let detailsHTML = '<div class="revenue-details">';
    
    if (Object.keys(revenueData).length === 0) {
        detailsHTML += '<p style="text-align: center; color: #777;">Không có dữ liệu doanh thu trong khoảng thời gian này</p>';
    } else {
        for (const [ownerId, data] of Object.entries(revenueData)) {
            const ownerUser = allUsers.find(u => u.id === ownerId);
            const ownerName = ownerUser ? ownerUser.name : 'Chưa xác định';
            
            detailsHTML += `
                <div class="owner-revenue-item">
                    <div class="owner-revenue-header">
                        <div class="owner-name">🏪 ${ownerName}</div>
                        <div class="owner-total">${formatCurrency(data.total)}</div>
                    </div>
                    <div class="store-list">
            `;
            
            for (const [storeId, storeData] of Object.entries(data.stores)) {
                detailsHTML += `
                    <div class="store-item">
                        <span class="store-name">📍 Cửa hàng ${storeId.substring(0, 8)}... (${storeData.orders} đơn)</span>
                        <span class="store-revenue">${formatCurrency(storeData.revenue)}</span>
                    </div>
                `;
            }
            
            detailsHTML += `
                    </div>
                </div>
            `;
        }
    }
    
    detailsHTML += '</div>';
    revenueDetails.innerHTML = detailsHTML;
    revenueDisplay.style.display = 'block';
}

/**
 * Format tiền tệ
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(amount);
}

/**
 * Xuất báo cáo doanh thu
 */
function exportRevenueReport() {
    if (Object.keys(revenueData).length === 0) {
        alert('Chưa có dữ liệu để xuất. Vui lòng tải báo cáo trước!');
        return;
    }
    
    const periodType = document.getElementById('revenue-period-type').value;
    let periodText = '';
    
    if (periodType === 'week') {
        periodText = `Tuần ${document.getElementById('revenue-week').value}`;
    } else if (periodType === 'month') {
        periodText = `Tháng ${document.getElementById('revenue-month').value}`;
    } else if (periodType === 'year') {
        periodText = `Năm ${document.getElementById('revenue-year').value}`;
    }
    
    let csvContent = `BÁO CÁO DOANH THU - ${periodText}\n\n`;
    csvContent += `Owner,Cửa hàng,Doanh thu,Số đơn\n`;
    
    for (const [ownerId, data] of Object.entries(revenueData)) {
        const ownerUser = allUsers.find(u => u.id === ownerId);
        const ownerName = ownerUser ? ownerUser.name : 'Chưa xác định';
        
        for (const [storeId, storeData] of Object.entries(data.stores)) {
            csvContent += `"${ownerName}","${storeId}",${storeData.revenue},${storeData.orders}\n`;
        }
    }
    
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `bao-cao-doanh-thu-${periodText}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log('✅ Đã xuất báo cáo');
}

/**
 * Áp dụng bộ lọc
 */
function applyFilters() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase().trim();
    const roleFilter = document.getElementById('role-filter').value;
    const ownerFilter = document.getElementById('owner-filter').value;
    
    console.log('🔍 Áp dụng bộ lọc:', { searchTerm, roleFilter, ownerFilter });
    
    filteredUsers = allUsers.filter(user => {
        let matchSearch = true;
        if (searchTerm) {
            const searchableText = [
                user.name || '',
                user.email || '',
                user.phone || '',
                user.address || '',
                user.id || ''
            ].join(' ').toLowerCase();
            
            matchSearch = searchableText.includes(searchTerm);
        }
        
        let matchRole = true;
        if (roleFilter !== 'all') {
            const userRole = (user.role || 'user').toLowerCase();
            if (roleFilter === 'admin') {
                matchRole = userRole === 'admin' || userRole === 'owner';
            } else {
                matchRole = userRole === roleFilter;
            }
        }
        
        let matchOwner = true;
        if (ownerFilter !== 'all') {
            const userRole = (user.role || 'user').toLowerCase();
            if(userRole === 'manager') { 
                matchOwner = user.ownerId === ownerFilter;
            } 
            else if (userRole === 'owner' || userRole === 'admin') {
                matchOwner = user.id === ownerFilter;
            } 
            else {
                matchOwner = false;
            }
        }
        
        return matchSearch && matchRole && matchOwner;
    });
    
    console.log(`✅ Kết quả lọc: ${filteredUsers.length}/${allUsers.length} người dùng`);
    renderUsersTable();
}

/**
 * Reset bộ lọc
 */
function resetFilters() {
    document.getElementById('search-input').value = '';
    document.getElementById('role-filter').value = 'all';
    document.getElementById('owner-filter').value = 'all';
    
    filteredUsers = [...allUsers];
    console.log('🔄 Đã reset bộ lọc');
    renderUsersTable();
}

/**
 * Hiển thị bảng người dùng
 */
function renderUsersTable() {
    const wrapper = document.getElementById('table-wrapper');
    const showingCount = document.getElementById('showing-count');
    
    if (!wrapper) return;
    
    showingCount.textContent = `Hiển thị ${filteredUsers.length} / ${allUsers.length} người dùng`;
    
    if (filteredUsers.length === 0) {
        wrapper.innerHTML = `
            <div class="empty-state">
                <div class="icon">
                    <span class="material-symbols-outlined">person_off</span>
                </div>
                <h3>Không tìm thấy người dùng</h3>
                <p>Thử thay đổi bộ lọc hoặc tìm kiếm khác</p>
            </div>
        `;
        return;
    }
    
    let tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>Người dùng</th>
                    <th>Số điện thoại</th>
                    <th>Địa chỉ</th>
                    <th>Vai trò</th>
                    <th>Owner ID</th>
                    <th>Thao tác</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    filteredUsers.forEach(user => {
        const avatar = (user.name || 'U')[0].toUpperCase();
        const name = user.name || 'Chưa có tên';
        const email = user.email || 'Chưa có email';
        const phone = user.phone || 'Chưa có';
        const address = user.address || 'Chưa có';
        const role = (user.role || 'user').toLowerCase();
        const ownerId = user.ownerId || 'N/A';
        const ownerIdShort = ownerId !== 'N/A' ? ownerId.substring(0, 8) + '...' : 'N/A';
        
        const avatarColors = [
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
            'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
        ];
        const colorIndex = (user.id ? user.id.charCodeAt(0) : 0) % avatarColors.length;
        
        let roleBadge = '';
        if (role === 'admin' || role === 'owner') {
            roleBadge = '<span class="role-badge role-owner">👑 Owner/Admin</span>';
        } else if (role === 'manager') {
            roleBadge = '<span class="role-badge role-manager">⚙️ Manager</span>';
        } else if (role === 'superadmin') {
            roleBadge = '<span class="role-badge role-superadmin">🛡️ Super Admin</span>';
        } else {
            roleBadge = '<span class="role-badge role-user">👤 User/Player</span>';
        }
        
        tableHTML += `
            <tr>
                <td>
                    <div class="user-cell">
                        <div class="user-avatar" style="background: ${avatarColors[colorIndex]}">${avatar}</div>
                        <div class="user-details">
                            <div class="name">${name}</div>
                            <div class="email">${email}</div>
                            <div class="uid">ID: ${user.id}</div>
                        </div>
                    </div>
                </td>
                <td>${phone}</td>
                <td>${address}</td>
                <td>${roleBadge}</td>
                <td title="${ownerId}">${ownerIdShort}</td>
                <td>
                    <div class="action-btns">
                        <button class="btn-icon btn-view" onclick="viewUserDetail('${user.id}')" title="Xem chi tiết">
                            <span class="material-symbols-outlined">visibility</span>
                        </button>
                        <button class="btn-icon btn-edit" onclick="openUserModal('edit', '${user.id}')" title="Chỉnh sửa">
                            <span class="material-symbols-outlined">edit</span>
                        </button>
                        <button class="btn-icon btn-delete" onclick="confirmDeleteUser('${user.id}', '${name}')" title="Xóa">
                            <span class="material-symbols-outlined">delete</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tableHTML += `
            </tbody>
        </table>
    `;
    
    setTableLoading(false, tableHTML);
}

/**
 * Hiển thị/ẩn loading state cho bảng
 */
function setTableLoading(isLoading, contentHTML = '') {
    const wrapper = document.getElementById('table-wrapper');
    if (!wrapper) return;
    if (isLoading) {
        wrapper.innerHTML = `
            <div class="loading">
                <div class="icon">
                    <span class="material-symbols-outlined">hourglass_empty</span>
                </div>
                <h3>Đang tải dữ liệu...</h3>
                <p>Vui lòng đợi trong giây lát</p>
            </div>
        `;
    } else {
        wrapper.innerHTML = contentHTML;
    }
}

/**
 * Hiển thị lỗi (dùng khi fetch lỗi)
 */
function showError(message) {
     const wrapper = document.getElementById('table-wrapper');
     if (!wrapper) return;
     wrapper.innerHTML = `
        <div class="empty-state">
            <div class="icon" style="color: #f5576c;">
                <span class="material-symbols-outlined">error</span>
            </div>
            <h3>Rất tiếc, đã có lỗi xảy ra</h3>
            <p>${message}</p>
        </div>
    `;
}

/**
 * Xem chi tiết người dùng
 */
function viewUserDetail(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) {
        alert('❌ Không tìm thấy người dùng');
        return;
    }
    
    currentViewUserId = userId;
    
    const viewModal = document.getElementById('view-modal');
    if (!viewModal) {
         console.error("Không tìm thấy #view-modal trong HTML");
         alert(`CHI TIẾT:\nID: ${user.id}\nTên: ${user.name}\nEmail: ${user.email}\nRole: ${user.role}`);
         return;
    }

    const avatar = (user.name || 'U')[0].toUpperCase();
    document.getElementById('view-avatar').textContent = avatar;
    
    document.getElementById('view-name').textContent = user.name || 'Chưa có tên';
    
    const role = (user.role || 'user').toLowerCase();
    let roleBadge = '';
    if (role === 'admin' || role === 'owner') {
        roleBadge = '<span class="role-badge role-owner">👑 Owner/Admin</span>';
    } else if (role === 'manager') {
        roleBadge = '<span class="role-badge role-manager">⚙️ Manager</span>';
    } else if (role === 'superadmin') {
        roleBadge = '<span class="role-badge role-superadmin">🛡️ Super Admin</span>';
    } else {
        roleBadge = '<span class="role-badge role-user">👤 User/Player</span>';
    }
    document.getElementById('view-role-badge').innerHTML = roleBadge;
    
    document.getElementById('view-id').textContent = user.id;
    document.getElementById('view-email').textContent = user.email || 'Chưa có';
    document.getElementById('view-phone').textContent = user.phone || 'Chưa có';
    document.getElementById('view-address').textContent = user.address || 'Chưa có';
    document.getElementById('view-owner-id').textContent = user.ownerId || 'N/A';
    
    const createdDate = user.createdAt ? new Date(user.createdAt).toLocaleString('vi-VN') : 'Không rõ';
    document.getElementById('view-created').textContent = createdDate;
    
    viewModal.style.display = 'block';
    console.log('👁️ Xem chi tiết:', user);
}

function closeViewModal() {
    const viewModal = document.getElementById('view-modal');
    if (viewModal) viewModal.style.display = 'none';
    currentViewUserId = null;
}

function editFromView() {
    if (currentViewUserId) {
        closeViewModal();
        openUserModal('edit', currentViewUserId);
    }
}

// === CÁC HÀM XỬ LÝ MODAL (THÊM MỚI/SỬA) ===

const userModal = document.getElementById('user-modal');
const modalTitle = document.getElementById('modal-title');
const userForm = document.getElementById('user-form');
const formMode = document.getElementById('user-form-mode');
const formUserId = document.getElementById('user-form-id');
const passwordGroup = document.getElementById('password-group');
const userEmailInput = document.getElementById('user-email');
const userPasswordInput = document.getElementById('user-password');
const submitBtn = document.getElementById('form-submit-btn');

/**
 * Mở Modal
 */
function openUserModal(mode, userId = null) {
    userForm.reset(); 
    submitBtn.disabled = false;
    submitBtn.textContent = 'Lưu';
    
    userForm.dataset.oldRole = '';
    
    if (mode === 'add') {
        modalTitle.textContent = 'Thêm Người dùng mới';
        formMode.value = 'add';
        formUserId.value = '';
        
        passwordGroup.style.display = 'block';
        userPasswordInput.required = true;
        userEmailInput.disabled = false;

    } else if (mode === 'edit') {
        const user = allUsers.find(u => u.id === userId);
        if (!user) {
            alert('Không tìm thấy người dùng!');
            return;
        }
        
        modalTitle.textContent = `Sửa Người dùng: ${user.name || user.email}`;
        formMode.value = 'edit';
        formUserId.value = userId;
        
        document.getElementById('user-name').value = user.name || '';
        document.getElementById('user-email').value = user.email || '';
        document.getElementById('user-phone').value = user.phone || '';
        document.getElementById('user-address').value = user.address || '';
        document.getElementById('user-role').value = user.role || 'user';
        
        userForm.dataset.oldRole = user.role || 'user';
        
        passwordGroup.style.display = 'none';
        userPasswordInput.required = false;
        userEmailInput.disabled = true; 
    }
    
    userModal.style.display = 'block';
}

/**
 * Đóng Modal
 */
function closeUserModal() {
    userModal.style.display = 'none';
}


// --- THAY ĐỔI LỚN 3: SỬA HÀM handleUserFormSubmit ---
/**
 * 🌟 HÀM QUAN TRỌNG ĐÃ SỬA LẠI HOÀN CHỈNH 🌟
 * Xử lý khi nhấn nút "Lưu" trên form (GỌI API RENDER)
 */
async function handleUserFormSubmit(event) {
    event.preventDefault(); // Ngăn form tải lại trang
    
    // Hiển thị loading
    submitBtn.disabled = true;
    submitBtn.textContent = 'Đang xử lý...';

    const mode = formMode.value;
    const userId = formUserId.value;
    
    // Lấy dữ liệu từ form
    const data = {
        name: document.getElementById('user-name').value,
        email: document.getElementById('user-email').value,
        phone: document.getElementById('user-phone').value,
        address: document.getElementById('user-address').value,
        role: document.getElementById('user-role').value,
    };
    
    try {
        if (mode === 'add') {
            // === LOGIC THÊM MỚI (GỌI API RENDER) ===
            const password = userPasswordInput.value;
            if (password.length < 6) {
                throw new Error('Mật khẩu phải có ít nhất 6 ký tự!');
            }
            
            // 1. Gọi API /api/sa/create-user
            const result = await callSuperAdminAPI('/api/sa/create-user', { ...data, password: password });
            
            alert(`Thêm người dùng thành công! UID: ${result.uid}`);

        } else if (mode === 'edit') {
            // === LOGIC SỬA ===
            const oldRole = userForm.dataset.oldRole;
            const newRole = data.role;
            
            // 1. Cập nhật database (việc này client làm được)
            const updates = {
                name: data.name,
                phone: data.phone,
                address: data.address,
                role: data.role // Cập nhật role trong DB
            };
            
            await db.ref('dataUser/' + userId).update(updates);
            
            // 2. Cập nhật role (Custom Claim) nếu có thay đổi (gọi API)
            if (oldRole !== newRole) {
                console.log(`Đang thay đổi vai trò (Auth) từ ${oldRole} -> ${newRole}`);
                
                // Gọi API /api/sa/update-role
                await callSuperAdminAPI('/api/sa/update-role', { uid: userId, role: newRole });
                
                alert('Cập nhật thông tin và vai trò (Auth) thành công!');
            } else {
                alert('Cập nhật thông tin (DB) thành công!');
            }
        }
        
        closeUserModal();
        loadAllUsers(); // Tải lại bảng
        
    } catch (error) {
        console.error('❌ Lỗi handleUserFormSubmit:', error);
        alert(`Lỗi: ${error.message}`); // Hiển thị lỗi thật
    }

    // Mở lại nút dù thành công hay thất bại
    submitBtn.disabled = false;
    submitBtn.textContent = 'Lưu';
}


// --- THAY ĐỔI LỚN 4: SỬA HÀM XÓA ---
/**
 * HÀM SỬA LẠI:
 * Xử lý Xóa Người dùng (GỌI API RENDER)
 * (Thay thế hàm confirmDeleteUser_Direct nguy hiểm của bạn)
 */
async function confirmDeleteUser(userId, name) {
    if (!userId || !name) return;

    // Ngăn Super Admin tự xóa mình
    if (currentSuperAdmin && userId === currentSuperAdmin.uid) {
        alert("Bạn không thể tự xóa tài khoản Super Admin của mình!");
        return;
    }

    const confirmed = confirm(`Bạn có chắc chắn muốn XÓA vĩnh viễn người dùng: ${name} (ID: ${userId})? \nHành động này sẽ xóa cả tài khoản đăng nhập (Auth) và dữ liệu (DB). Không thể hoàn tác.`);
    
    if (confirmed) {
        console.log(`Đang xóa người dùng: ${userId}`);
        try {
            // Hiển thị loading cho bảng
            setTableLoading(true);

            // 1. Gọi API /api/sa/delete-user
            await callSuperAdminAPI('/api/sa/delete-user', { uid: userId });

            alert(`Đã xóa người dùng ${name} thành công!`);
            loadAllUsers(); // Tải lại bảng
        
        } catch (error) {
            console.error('❌ Lỗi xóa người dùng:', error);
            alert(`Lỗi khi xóa người dùng: ${error.message}`);
            renderUsersTable(); // Render lại bảng (dù có lỗi)
        }
    }
}