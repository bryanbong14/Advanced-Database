//Handles: dashboard stat cards, quick-access cards.

//--Stats
async function loadDashboardStats(profile) {
    const role = profile.role;

    //Invoices + overdue )finance, sales, admin)
    if (['admin', 'finance', 'sales'].includes(role)) {
        let q = sb.from('invoices').select('*', { count: 'exact', head: true });
        if (role === 'sales') q = q.eq('sales_agent', profile.department);
        const { count } = await q;
        document.getElementById('stat-invoices').textContent = count ?? 0;

        let oq = sb.from('invoices')
            .select('*', { count: 'exact', head: true })
            .lt('due_date', new Date().toISOString().split('T')[0])
            .not('status', 'in', '("paid","cancelled")');
        if (role === 'sales') oq = oq.eq('sales_agent', profile.department);
        const { count: overdueCount } = await oq;
        document.getElementById('stat-overdue').textContent = overdueCount ?? 0;

        if (overdueCount > 0) {
            const badge = document.getElementById('overdue-badge');
            badge.style.display = '';
            badge.textContent = overdueCount;
        } 
    } else {
        document.getElementById('stat-overdue-card').style.display = 'none';
    }
    
    // Customers (finance, sales, admin)
    if (['admin', 'finance', 'sales'].includes(role)) {
        const { count } = await sb.from('customers')
            .select('*', {count: 'exact', head: true })
            .eq('is_active', true);
        document.getElementById('stat-customers').textContent = count ?? 0;
    } else {
        document.getElementById('stat-customers').textContent = '-';
    }

    // Open orders (all roles)
    const { count: orderCount } =await sb.from('sales_orders')
        .select('*', { count: 'exact', head: true });
    document.getElementById('stat-orders').textContent = orderCount ?? 0;

    //Low stock (admin, warehouse, sales)
    
}