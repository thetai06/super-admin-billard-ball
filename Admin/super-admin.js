// ================ SUPER ADMIN - QUẢN LÝ TẤT CẢ NGƯỜI DÙNG ================
let currentSuperAdmin = null;
let allUsers = [];
let filteredUsers = [];
let allOwners = new Set();
let revenueData = {};

/**
 * Khởi tạo trang Super Admin
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Khởi tạo Super Admin...');
    
    // Kiểm tra đăng nhập
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            currentSuperAdmin = user;
            document.getElementById('admin-name').textContent = user.displayName || 'Super Admin';
            document.getElementById('admin-email').textContent = user.email;
            
            console.log('✅ Super Admin đã đăng nhập:', user.email);
            
            // Tải tất cả người dùng
            loadAllUsers();
            
            // Thiết lập event listeners
            setupEventListeners();
        } else {
            console.log('❌ Chưa đăng nhập, chuyển hướng...');
            window.location.href = '../Admin/login.html';
        }
    });
    
    // Thiết lập date inputs với giá trị mặc định
    setDefaultDates();
});

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
    const confirmed = confirm('Bạn có chắc chắn muốn đăng xuất?');
    if (confirmed) {
        firebase.auth().signOut()
            .then(() => {
                console.log('✅ Đăng xuất thành công');
                window.location.href = '../';
            })
            .catch((error) => {
                console.error('❌ Lỗi đăng xuất:', error);
                alert('Có lỗi xảy ra khi đăng xuất. Vui lòng thử lại!');
            });
    }
}

/**
 * Tải TẤT CẢ người dùng từ Firebase (không lọc theo owner)
 */
function loadAllUsers() {
    console.log('📊 Đang tải TẤT CẢ người dùng...');
    
    db.ref('dataUser')
        .once('value', (snapshot) => {
            allUsers = [];
            allOwners.clear();
            
            if (snapshot.exists()) {
                snapshot.forEach((child) => {
                    const userData = child.val();
                    allUsers.push({
                        id: child.key,
                        ...userData
                    });
                    
                    // Thu thập danh sách owner
                    if (userData.ownerId) {
                        allOwners.add(userData.ownerId);
                    }
                });
            }
            
            console.log(`✅ Đã tải ${allUsers.length} người dùng`);
            console.log(`✅ Tìm thấy ${allOwners.size} owner khác nhau`);
            
            // Cập nhật dropdown owner filter
            updateOwnerFilter();
            updateRevenueOwnerFilter();
            
            // Cập nhật thống kê
            updateStatistics();
            
            // Hiển thị danh sách
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
    
    // Giữ option "Tất cả Owner"
    ownerFilter.innerHTML = '<option value="all">Tất cả Owner</option>';
    
    // Thêm các owner
    allOwners.forEach(ownerId => {
        const ownerUser = allUsers.find(u => u.id === ownerId);
        const ownerName = ownerUser ? ownerUser.name : 'Chưa có tên';
        const option = document.createElement('option');
        option.value = ownerId;
        option.textContent = `${ownerName} (${ownerId.substring(0, 8)}...)`;
        ownerFilter.appendChild(option);
    });
}

/**
 * Cập nhật dropdown owner filter cho báo cáo doanh thu
 */
function updateRevenueOwnerFilter() {
    const revenueOwnerFilter = document.getElementById('revenue-owner-filter');
    if (!revenueOwnerFilter) return;
    
    // Giữ option "Tất cả chuỗi cửa hàng"
    revenueOwnerFilter.innerHTML = '<option value="all">Tất cả chuỗi cửa hàng</option>';
    
    // Thêm các owner
    allOwners.forEach(ownerId => {
        const ownerUser = allUsers.find(u => u.id === ownerId);
        const ownerName = ownerUser ? ownerUser.name : 'Chưa có tên';
        const option = document.createElement('option');
        option.value = ownerId;
        option.textContent = `${ownerName} (${ownerId.substring(0, 8)}...)`;
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
                    const bookingDate = new Date(booking.createdAt || booking.dateTime); 
                    
                    if (bookingDate >= startDate && bookingDate <= endDate) {
                        
                        if (ownerFilter === 'all' || booking.storeOwnerId === ownerFilter) {
                            
                            const ownerId = booking.storeOwnerId || 'unknown';
                            const storeId = booking.storeId || 'unknown';
                            
                            const revenue = parseFloat(booking.money || 0); 
                            
                            if (!revenueData[ownerId]) {
                                revenueData[ownerId] = {
                                    total: 0,
                                    orders: 0,
                                    stores: {}
                                };
                            }
                            
                            if (!revenueData[ownerId].stores[storeId]) {
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
    
    // Hiển thị tổng quan
    document.getElementById('total-revenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('total-orders').textContent = totalOrders;
    document.getElementById('avg-revenue').textContent = totalOrders > 0 
        ? formatCurrency(totalRevenue / totalOrders) 
        : '0 đ';
    
    // Hiển thị chi tiết theo owner
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
    
    // Tạo file và download
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
        // Lọc theo tìm kiếm
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
        
        // Lọc theo vai trò
        let matchRole = true;
        if (roleFilter !== 'all') {
            const userRole = (user.role || 'user').toLowerCase();
            if (roleFilter === 'admin') {
                matchRole = userRole === 'admin' || userRole === 'owner';
            } else {
                matchRole = userRole === roleFilter;
            }
        }
        
        // Lọc theo owner
        let matchOwner = true;
        if (ownerFilter !== 'all') {
            matchOwner = user.ownerId === ownerFilter;
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
    
    // Cập nhật số lượng hiển thị
    showingCount.textContent = `Hiển thị ${filteredUsers.length} / ${allUsers.length} người dùng`;
    
    // Nếu không có người dùng
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
    
    // Tạo HTML table
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
        
        // Chọn màu avatar
        const avatarColors = [
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
            'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
        ];
        const colorIndex = user.id.charCodeAt(0) % avatarColors.length;
        
        // Role badge
        let roleBadge = '';
        if (role === 'admin' || role === 'owner') {
            roleBadge = '<span class="role-badge role-owner">👑 Owner/Admin</span>';
        } else if (role === 'manager') {
            roleBadge = '<span class="role-badge role-manager">⚙️ Manager</span>';
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
                        <button class="btn-icon btn-edit" onclick="editUser('${user.id}')" title="Chỉnh sửa">
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
    
    wrapper.innerHTML = tableHTML;
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
    
    const role = (user.role || 'user').toLowerCase();
    let roleText = '👤 User/Player';
    if (role === 'admin' || role === 'owner') roleText = '👑 Owner/Admin';
    else if (role === 'manager') roleText = '⚙️ Manager';
    
    const details = `
📋 THÔNG TIN CHI TIẾT NGƯỜI DÙNG
${'='.repeat(50)}

👤 Tên: ${user.name || 'Chưa có'}
📧 Email: ${user.email || 'Chưa có'}
📱 SĐT: ${user.phone || 'Chưa có'}
📍 Địa chỉ: ${user.address || 'Chưa có'}
🎭 Vai trò: ${roleText}

🆔 User ID: ${user.id}
👥 Owner ID: ${user.ownerId || 'N/A'}

${'='.repeat(50)}
    `;
    
    alert(details);
    console.log('👁️ Xem chi tiết:', user);
}

/**
 * Chỉnh sửa người dùng
 */
function editUser(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) {
        alert('❌ Không tìm thấy người dùng');
        return;
    }
    
    const newName = prompt('✏️ Nhập tên mới:', user.name || '');
    if (newName === null) return; // User cancelled
    
    const newPhone = prompt('✏️ Nhập số điện thoại mới:', user.phone || '');
    if (newPhone === null) return;
    
    const newAddress = prompt('✏️ Nhập địa chỉ mới:', user.address || '');
    if (newAddress === null) return;
    
    const newRole = prompt('✏️ Nhập vai trò mới (admin/manager/user):', user.role || 'user');
    if (newRole === null) return;
    
    // Cập nhật vào Firebase
    const updates = {};
    if (newName) updates.name = newName;
    if (newPhone) updates.phone = newPhone;
    if (newAddress) updates.address = newAddress;
    if (newRole) updates.role = newRole.toLowerCase();
    
    db.ref('dataUser/' + userId)
        .update(updates)
        .then(() => {
            console.log('✅ Đã cập nhật người dùng');
            alert('✅ Cập nhật thành công!');
            loadAllUsers(); // Reload
        })
        .catch(error => {
            console.error('❌ Lỗi cập nhật:', error);
            alert('❌ Không thể cập nhật. Vui lòng thử lại!');
        });
}
