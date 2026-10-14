/**
 * SV Real Estates Hyderabad — Dashboard Chart.js Visualizations
 */

document.addEventListener('DOMContentLoaded', () => {
    ensureChartJs(initDashboardCharts);
});

// Robust poller to wait for Chart.js CDN script if loading async
function ensureChartJs(callback, maxAttempts = 30) {
    if (typeof Chart !== 'undefined') {
        callback();
        return;
    }
    let attempts = 0;
    const interval = setInterval(() => {
        attempts++;
        if (typeof Chart !== 'undefined') {
            clearInterval(interval);
            callback();
        } else if (attempts >= maxAttempts) {
            clearInterval(interval);
            console.warn('Chart.js CDN did not load in time. Retrying in 1s...');
            setTimeout(() => {
                if (typeof Chart !== 'undefined') callback();
            }, 1000);
        }
    }, 100);
}

function formatDateLabel(dateStr) {
    if (!dateStr || dateStr === 'No data') return dateStr;
    try {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const m = parseInt(parts[1], 10) - 1;
            const d = parseInt(parts[2], 10);
            return `${d} ${months[m] || ''}`;
        }
    } catch {
        // fallback
    }
    return dateStr;
}

async function initDashboardCharts() {
    if (typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded.');
        return;
    }

    const goldColor = '#d4af37';
    const darkGrid = 'rgba(255, 255, 255, 0.06)';

    // Global Chart.js styling
    Chart.defaults.color = '#9aa0ac';
    Chart.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
    Chart.defaults.font.size = 12;

    // ── 1. Leads Over Time ───────────────────────────────────────
    const timeCanvas = document.getElementById('leadsOverTimeChart');
    if (timeCanvas) {
        try {
            const res = await fetch('/api/dashboard/charts/leads-over-time');
            const data = await res.json();
            const labels = (data || []).map(d => formatDateLabel(d.date));
            const counts = (data || []).map(d => d.count);

            const ctx = timeCanvas.getContext('2d');
            let gradient = 'rgba(212, 175, 55, 0.15)';
            if (ctx) {
                const grad = ctx.createLinearGradient(0, 0, 0, 240);
                grad.addColorStop(0, 'rgba(212, 175, 55, 0.35)');
                grad.addColorStop(1, 'rgba(212, 175, 55, 0.00)');
                gradient = grad;
            }

            new Chart(timeCanvas, {
                type: 'line',
                data: {
                    labels: labels.length > 0 ? labels : ['Today'],
                    datasets: [{
                        label: 'Enquiries',
                        data: counts.length > 0 ? counts : [0],
                        borderColor: goldColor,
                        borderWidth: 2.5,
                        backgroundColor: gradient,
                        fill: true,
                        tension: 0.35,
                        pointBackgroundColor: goldColor,
                        pointBorderColor: '#0f1115',
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        pointHoverRadius: 7
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: '#1c212c',
                            borderColor: 'rgba(212, 175, 55, 0.4)',
                            borderWidth: 1,
                            padding: 10,
                            callbacks: {
                                label: (c) => ` ${c.parsed.y} Enquiries`
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: darkGrid },
                            ticks: { color: '#88909d' }
                        },
                        y: {
                            grid: { color: darkGrid },
                            beginAtZero: true,
                            ticks: {
                                precision: 0,
                                color: '#88909d',
                                stepSize: 1
                            }
                        }
                    }
                }
            });
        } catch (e) {
            console.error('Time chart error:', e);
        }
    }

    // ── 2. Lead Status Distribution ─────────────────────────────
    const statusCanvas = document.getElementById('leadStatusChart');
    if (statusCanvas) {
        try {
            const res = await fetch('/api/dashboard/charts/lead-status');
            const data = await res.json();
            const labels = (data || []).map(d => (d.status || '').replace(/_/g, ' ').toUpperCase());
            const counts = (data || []).map(d => d.count);

            const colors = ['#3b82f6', '#10b981', '#f59e0b', '#d4af37', '#8b5cf6', '#ef4444', '#06b6d4'];

            new Chart(statusCanvas, {
                type: 'doughnut',
                data: {
                    labels: labels.length > 0 ? labels : ['NO DATA'],
                    datasets: [{
                        data: counts.length > 0 ? counts : [1],
                        backgroundColor: counts.length > 0 ? colors.slice(0, labels.length) : ['#262c3b'],
                        borderColor: '#161a22',
                        borderWidth: 3,
                        hoverOffset: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '68%',
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                boxWidth: 12,
                                padding: 12,
                                color: '#c5cbda',
                                font: { size: 11 }
                            }
                        },
                        tooltip: {
                            backgroundColor: '#1c212c',
                            borderColor: 'rgba(212, 175, 55, 0.4)',
                            borderWidth: 1,
                            padding: 10
                        }
                    }
                }
            });
        } catch (e) {
            console.error('Status chart error:', e);
        }
    }

    // ── 3. Leads by Category ────────────────────────────────────
    const catCanvas = document.getElementById('leadsByCategoryChart');
    if (catCanvas) {
        try {
            const res = await fetch('/api/dashboard/charts/leads-by-category');
            const data = await res.json();
            const labels = (data || []).map(d => (d.category || 'General').replace(/_/g, ' '));
            const counts = (data || []).map(d => d.count);

            new Chart(catCanvas, {
                type: 'bar',
                data: {
                    labels: labels.length > 0 ? labels : ['None'],
                    datasets: [{
                        label: 'Enquiries',
                        data: counts.length > 0 ? counts : [0],
                        backgroundColor: 'rgba(212, 175, 55, 0.75)',
                        hoverBackgroundColor: goldColor,
                        borderColor: goldColor,
                        borderWidth: 1,
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: '#1c212c',
                            borderColor: 'rgba(212, 175, 55, 0.4)',
                            borderWidth: 1,
                            padding: 10
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { color: '#88909d', font: { size: 11 } }
                        },
                        y: {
                            grid: { color: darkGrid },
                            beginAtZero: true,
                            ticks: { precision: 0, color: '#88909d', stepSize: 1 }
                        }
                    }
                }
            });
        } catch (e) {
            console.error('Category chart error:', e);
        }
    }

    // ── 4. Properties by Category ───────────────────────────────
    const propCanvas = document.getElementById('propertiesByCategoryChart');
    if (propCanvas) {
        try {
            const res = await fetch('/api/dashboard/charts/properties-by-category');
            const data = await res.json();
            const labels = (data || []).map(d => (d.category || '').replace(/_/g, ' '));
            const totalCounts = (data || []).map(d => d.count);
            const publishedCounts = (data || []).map(d => d.published);

            new Chart(propCanvas, {
                type: 'bar',
                data: {
                    labels: labels.length > 0 ? labels : ['None'],
                    datasets: [
                        {
                            label: 'Published',
                            data: publishedCounts.length > 0 ? publishedCounts : [0],
                            backgroundColor: '#10b981',
                            borderRadius: 6
                        },
                        {
                            label: 'Total Listings',
                            data: totalCounts.length > 0 ? totalCounts : [0],
                            backgroundColor: 'rgba(255, 255, 255, 0.18)',
                            borderRadius: 6
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: { boxWidth: 12, color: '#c5cbda' }
                        },
                        tooltip: {
                            backgroundColor: '#1c212c',
                            borderColor: 'rgba(212, 175, 55, 0.4)',
                            borderWidth: 1,
                            padding: 10
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { color: '#88909d', font: { size: 11 } }
                        },
                        y: {
                            grid: { color: darkGrid },
                            beginAtZero: true,
                            ticks: { precision: 0, color: '#88909d', stepSize: 1 }
                        }
                    }
                }
            });
        } catch (e) {
            console.error('Property category chart error:', e);
        }
    }
}
