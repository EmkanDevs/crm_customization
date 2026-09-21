// Copyright (c) 2026, Finbyz and contributors
// For license information, please see license.txt
frappe.provide('crm_customization');

frappe.pages['bd_achievements'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Business Development & Registration Executive Dashboard',
        single_column: true
    });

    // Load Chart.js from CDN if not already available, then boot the dashboard
    crm_customization.load_chartjs().then(() => {
        new crm_customization.BDAchievementsDashboard(page);
    });
};

crm_customization.load_chartjs = function() {
    return new Promise((resolve) => {
        if (window.Chart) { resolve(); return; }
        var script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
        script.onload = resolve;
        script.onerror = () => {
            // Fallback to unpkg
            var s2 = document.createElement('script');
            s2.src = 'https://unpkg.com/chart.js@4.4.0/dist/chart.umd.min.js';
            s2.onload = resolve;
            s2.onerror = resolve; // resolve anyway to avoid hanging
            document.head.appendChild(s2);
        };
        document.head.appendChild(script);
    });
};

var bda_chart_bg_plugin = {
    id: 'bdaChartBackground',
    beforeDraw(chart) {
        var bgCtx = chart.ctx;
        bgCtx.save();
        bgCtx.globalCompositeOperation = 'destination-over';
        bgCtx.fillStyle = '#ffffff';
        bgCtx.fillRect(0, 0, chart.width, chart.height);
        bgCtx.restore();
    }
};

crm_customization.BDAchievementsDashboard = class {
    constructor(page) {
        this.page = page;
        this.charts = {};

        this.configure_sections();
        this.add_css();
        this.setup_page();
        this.setup_header_buttons();
        this.setup_box_controls();
        this.load_filter_options();
        this.load_dashboard_data();
    }

    configure_sections() {
        this._sectionData = {};
        this._sections = {
            trend: {
                title: 'Monthly Achievement Trend',
                headers: ['Month', 'Count'],
                row: (d) => [d.month, d.count],
                label: (d) => d.month,
                limit: null
            },
            sections: {
                title: 'Achievement Type Mix',
                headers: ['Section', 'Count'],
                row: (d) => [d.sections, d.count],
                label: (d) => d.sections,
                limit: 7
            },
            companies: {
                title: 'Top Companies',
                headers: ['Rank', 'Company', 'Count'],
                row: (d, i) => [i + 1, d.company, d.count],
                label: (d) => d.company,
                limit: 10
            },
            clients: {
                title: 'Top Clients',
                headers: ['Rank', 'Client', 'Count'],
                row: (d, i) => [i + 1, d.client, d.count],
                label: (d) => d.client,
                limit: 10
            },
            sectors: {
                title: 'Sectors',
                headers: ['Sector', 'Count'],
                row: (d) => [d.sector, d.count],
                label: (d) => d.sector,
                limit: null
            },
            quarter: {
                title: 'Quarter View',
                headers: ['Quarter', 'Count'],
                row: (d) => [d.quarter, d.count],
                label: (d) => d.quarter,
                limit: null
            }
        };
    }

    setup_page() {
        // Use append() to avoid destroying Frappe's internal page_form element.
        // We build our own filter bar directly in the HTML.
        $(this.page.main).empty().append(`
            <div class="bda-wrapper">

                <!-- Dashboard Header -->
                <div class="bda-header-bar">
                    <h1 class="bda-header-title">Business Development &amp; Registration Executive Dashboard</h1>
                    <button class="bda-btn-refresh" id="bda-refresh-filters">&#8635; Refresh</button>
                </div>

                <!-- Filter Bar -->
                <div class="bda-filter-bar">
                    <div class="bda-filter-left">
                        <span class="bda-filter-icon">&#9776;</span>
                        <span class="bda-filter-title">Dashboard Filters</span>
                    </div>
                    <div class="bda-filters-row">
                        <div class="bda-filter-group">
                            <label>Year</label>
                            <select id="bda-filter-year"><option value="">All</option></select>
                        </div>
                        <div class="bda-filter-group">
                            <label>Month</label>
                            <select id="bda-filter-month">
                                <option value="">All</option>
                                <option>January</option><option>February</option><option>March</option>
                                <option>April</option><option>May</option><option>June</option>
                                <option>July</option><option>August</option><option>September</option>
                                <option>October</option><option>November</option><option>December</option>
                            </select>
                        </div>
                        <div class="bda-filter-group">
                            <label>Company</label>
                            <select id="bda-filter-company"><option value="">All</option></select>
                        </div>
                        <div class="bda-filter-group">
                            <label>Client</label>
                            <select id="bda-filter-client"><option value="">All</option></select>
                        </div>
                        <div class="bda-filter-group">
                            <label>Section</label>
                            <select id="bda-filter-section"><option value="">All</option></select>
                        </div>
                        <div class="bda-filter-group">
                            <label>Sector</label>
                            <select id="bda-filter-sector"><option value="">All</option></select>
                        </div>
                        <div class="bda-filter-group">
                            <label>From Date</label>
                            <input type="date" id="bda-filter-from-date">
                        </div>
                        <div class="bda-filter-group">
                            <label>To Date</label>
                            <input type="date" id="bda-filter-to-date">
                        </div>
                    </div>
                    <div class="bda-filter-actions">
                        <button class="bda-btn-apply" id="bda-apply-filters">Apply Filters</button>
                        <button class="bda-btn-reset" id="bda-reset-filters">Reset</button>
                    </div>
                </div>

                <!-- Summary Cards Row 1 -->
                <div class="bda-cards-grid">
                    <div class="bda-card bda-card-teal">
                        <div class="bda-card-label">Total Achievements</div>
                        <div class="bda-card-value" id="stat-total">0</div>
                        <div class="bda-card-sub">Dashboard total</div>
                    </div>
                    <div class="bda-card bda-card-blue">
                        <div class="bda-card-label">Companies Supported</div>
                        <div class="bda-card-value" id="stat-companies">0</div>
                        <div class="bda-card-sub">Group companies</div>
                    </div>
                    <div class="bda-card bda-card-purple">
                        <div class="bda-card-label">Clients Covered</div>
                        <div class="bda-card-value" id="stat-clients">0</div>
                        <div class="bda-card-sub">Covered accounts</div>
                    </div>
                    <div class="bda-card bda-card-indigo">
                        <div class="bda-card-label">Top Client</div>
                        <div class="bda-card-value bda-card-value-sm" id="stat-top-client">N/A</div>
                        <div class="bda-card-sub">Highest coverage</div>
                    </div>
                    <div class="bda-card bda-card-green">
                        <div class="bda-card-label">Registrations</div>
                        <div class="bda-card-value" id="stat-registrations">0</div>
                        <div class="bda-card-sub">Registration wins</div>
                    </div>
                </div>

                <!-- Summary Cards Row 2 -->
                <div class="bda-cards-grid">
                    <div class="bda-card bda-card-orange">
                        <div class="bda-card-label">Qualifications / PQ</div>
                        <div class="bda-card-value" id="stat-qualifications">0</div>
                        <div class="bda-card-sub">Qualification wins</div>
                    </div>
                    <div class="bda-card bda-card-cyan">
                        <div class="bda-card-label">PQ Projects</div>
                        <div class="bda-card-value" id="stat-pq-projects">0</div>
                        <div class="bda-card-sub">Project qualifications</div>
                    </div>
                    <div class="bda-card bda-card-pink">
                        <div class="bda-card-label">Top Company</div>
                        <div class="bda-card-value bda-card-value-sm" id="stat-top-company">N/A</div>
                        <div class="bda-card-sub">Highest contribution</div>
                    </div>
                    <div class="bda-card bda-card-red">
                        <div class="bda-card-label">Vendor Nos.</div>
                        <div class="bda-card-value" id="stat-vendor-nos">0</div>
                        <div class="bda-card-sub">Vendor references</div>
                    </div>
                    <div class="bda-card bda-card-violet">
                        <div class="bda-card-label">Peak Month</div>
                        <div class="bda-card-value bda-card-value-sm" id="stat-peak-month">N/A</div>
                        <div class="bda-card-sub">Best activity month</div>
                    </div>
                </div>

                <!-- Charts Row 1 -->
                <div class="bda-charts-grid">
                    <div class="bda-chart-box bda-box" data-box="trend">
                        <div class="bda-box-head">
                            <div class="bda-chart-title">Monthly Achievement Trend</div>
                            <div class="bda-box-actions">
                                <button class="bda-box-btn bda-box-download" title="Download as image"><i class="fa fa-download"></i></button>
                                <button class="bda-box-btn bda-box-graph active">Graph</button>
                                <button class="bda-box-btn bda-box-table">Table</button>
                            </div>
                        </div>
                        <div class="bda-chart-area bda-box-graph-view" id="trend-chart-container">
                            <canvas id="trend-chart"></canvas>
                        </div>
                        <div class="bda-box-table-view" id="bda-table-trend" style="display:none;"></div>
                    </div>
                    <div class="bda-chart-box bda-box" data-box="sections">
                        <div class="bda-box-head">
                            <div class="bda-chart-title">Achievement Type Mix</div>
                            <div class="bda-box-actions">
                                <button class="bda-box-btn bda-box-download" title="Download as image"><i class="fa fa-download"></i></button>
                                <button class="bda-box-btn bda-box-graph active">Graph</button>
                                <button class="bda-box-btn bda-box-table">Table</button>
                            </div>
                        </div>
                        <div class="bda-chart-area bda-box-graph-view" id="company-chart-container">
                            <canvas id="company-chart"></canvas>
                        </div>
                        <div class="bda-box-table-view" id="bda-table-sections" style="display:none;"></div>
                    </div>
                </div>

                <!-- Charts Row 2: Top Companies + Top Clients ranked lists -->
                <div class="bda-charts-grid bda-two-col">
                    <div class="bda-chart-box bda-box" data-box="companies">
                        <div class="bda-box-head">
                            <div class="bda-chart-title">Top Companies</div>
                            <div class="bda-box-actions">
                                <button class="bda-box-btn bda-box-download" title="Download as image"><i class="fa fa-download"></i></button>
                                <button class="bda-box-btn bda-box-graph active">Graph</button>
                                <button class="bda-box-btn bda-box-table">Table</button>
                            </div>
                        </div>
                        <div id="top-companies-list" class="bda-rank-list bda-box-graph-view">
                            <div class="bda-no-data">Loading...</div>
                        </div>
                        <div class="bda-box-table-view" id="bda-table-companies" style="display:none;"></div>
                    </div>
                    <div class="bda-chart-box bda-box" data-box="clients">
                        <div class="bda-box-head">
                            <div class="bda-chart-title">Top Clients</div>
                            <div class="bda-box-actions">
                                <button class="bda-box-btn bda-box-download" title="Download as image"><i class="fa fa-download"></i></button>
                                <button class="bda-box-btn bda-box-graph active">Graph</button>
                                <button class="bda-box-btn bda-box-table">Table</button>
                            </div>
                        </div>
                        <div id="top-clients-list" class="bda-rank-list bda-box-graph-view">
                            <div class="bda-no-data">Loading...</div>
                        </div>
                        <div class="bda-box-table-view" id="bda-table-clients" style="display:none;"></div>
                    </div>
                </div>

                <!-- Charts Row 3: Sectors + Quarter View -->
                <div class="bda-charts-grid bda-two-col">
                    <div class="bda-chart-box bda-box" data-box="sectors">
                        <div class="bda-box-head">
                            <div class="bda-chart-title">Sectors</div>
                            <div class="bda-box-actions">
                                <button class="bda-box-btn bda-box-download" title="Download as image"><i class="fa fa-download"></i></button>
                                <button class="bda-box-btn bda-box-graph active">Graph</button>
                                <button class="bda-box-btn bda-box-table">Table</button>
                            </div>
                        </div>
                        <div id="sectors-list" class="bda-sector-list bda-box-graph-view">
                            <div class="bda-no-data">Loading...</div>
                        </div>
                        <div class="bda-box-table-view" id="bda-table-sectors" style="display:none;"></div>
                    </div>
                    <div class="bda-chart-box bda-box" data-box="quarter">
                        <div class="bda-box-head">
                            <div class="bda-chart-title">Quarter View</div>
                            <div class="bda-box-actions">
                                <button class="bda-box-btn bda-box-download" title="Download as image"><i class="fa fa-download"></i></button>
                                <button class="bda-box-btn bda-box-graph active">Graph</button>
                                <button class="bda-box-btn bda-box-table">Table</button>
                            </div>
                        </div>
                        <div class="bda-chart-area bda-box-graph-view" id="quarter-chart-container">
                            <canvas id="quarter-chart"></canvas>
                        </div>
                        <div class="bda-box-table-view" id="bda-table-quarter" style="display:none;"></div>
                    </div>
                </div>

                <!-- BD Achievement Records Preview -->
                <div class="bda-chart-box bda-records-box">
                    <div class="bda-records-header">
                        <span class="bda-chart-title" style="margin:0;border:none;padding:0;">BD Achievement Records Preview</span>
                        <div class="bda-records-nav">
                            <button class="bda-box-btn bda-box-download" id="bda-records-download" title="Download records as Excel"><i class="fa fa-download"></i></button>
                            <span class="bda-records-label">Records preview</span>
                            <button class="bda-nav-btn" id="bda-prev-btn">Prev</button>
                            <span class="bda-page-info" id="bda-page-info">Page 1 / 1</span>
                            <button class="bda-nav-btn" id="bda-next-btn">Next</button>
                        </div>
                    </div>
                    <div class="bda-table-scroll" style="max-height: 320px;">
                        <table class="bda-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Year</th>
                                    <th>Company</th>
                                    <th>Client</th>
                                    <th style="min-width:280px;">Achievement</th>
                                    <th>Section</th>
                                    <th>Vendor No.</th>
                                    <th>Sector</th>
                                </tr>
                            </thead>
                            <tbody id="recent-achievements-body">
                                <tr><td colspan="8" class="bda-no-data">No achievements</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        `);

        // Bind filter events
        document.getElementById('bda-apply-filters').addEventListener('click', () => this.load_dashboard_data());
        document.getElementById('bda-reset-filters').addEventListener('click', () => this.reset_filters());
        document.getElementById('bda-refresh-filters').addEventListener('click', () => this.load_dashboard_data());
        var recordsDownload = document.getElementById('bda-records-download');
        if (recordsDownload) recordsDownload.addEventListener('click', () => this.download_records_preview());
    }

    setup_header_buttons() {
        this.page.set_primary_action('Refresh', () => this.load_dashboard_data(), 'refresh');
        this.page.add_action_item('Open DocType', () => frappe.set_route('List', 'BD Achievements'));
    }

    get_filters() {
        var f = {};
        var map = {
            year: 'bda-filter-year',
            month: 'bda-filter-month',
            company: 'bda-filter-company',
            client: 'bda-filter-client',
            section: 'bda-filter-section',
            sector: 'bda-filter-sector',
            from_date: 'bda-filter-from-date',
            to_date: 'bda-filter-to-date'
        };
        Object.entries(map).forEach(([key, id]) => {
            var el = document.getElementById(id);
            if (el && el.value) f[key] = el.value;
        });
        return f;
    }

    reset_filters() {
        ['bda-filter-year','bda-filter-month','bda-filter-company',
         'bda-filter-client','bda-filter-section','bda-filter-sector',
         'bda-filter-from-date','bda-filter-to-date'].forEach(id => {
            var el = document.getElementById(id);
            if (el) el.value = '';
        });
        this.load_dashboard_data();
    }

    load_filter_options() {
        frappe.call({
            method: 'crm_customization.crm_customization.page.bd_achievements.bd_achievements.get_filter_options',
            callback: (r) => {
                if (r.message) {
                    this.populate_select('bda-filter-year', r.message.year || []);
                    this.populate_select('bda-filter-company', r.message.company || []);
                    this.populate_select('bda-filter-client', r.message.client || []);
                    this.populate_select('bda-filter-sector', r.message.sector || []);
                    this.populate_select('bda-filter-section', r.message.sections || []);
                }
            }
        });
    }

    populate_select(id, options) {
        var el = document.getElementById(id);
        if (!el) return;
        var current = el.value;
        el.innerHTML = '<option value="">All</option>';
        options.forEach(opt => {
            var o = document.createElement('option');
            o.value = opt; o.textContent = opt;
            el.appendChild(o);
        });
        if (current) el.value = current;
    }

    load_dashboard_data() {
        this.show_loading();
        frappe.call({
            method: 'crm_customization.crm_customization.page.bd_achievements.bd_achievements.get_dashboard_data',
            args: { filters: this.get_filters() },
            callback: (r) => {
                if (r.message) this.render_dashboard(r.message);
                this.hide_loading();
            },
            error: () => {
                this.hide_loading();
                frappe.msgprint({ title: __('Error'), message: __('Failed to load dashboard data.'), indicator: 'red' });
            }
        });
    }

    render_dashboard(data) {
        this.set_text('stat-total', data.total_achievements || 0);
        this.set_text('stat-companies', data.companies_supported || 0);
        this.set_text('stat-clients', data.clients_covered || 0);
        this.set_text('stat-top-client', (data.top_client && data.top_client.name) || 'N/A');
        this.set_text('stat-registrations', data.registrations || 0);
        this.set_text('stat-qualifications', data.qualifications || 0);
        this.set_text('stat-pq-projects', data.pq_projects || 0);
        this.set_text('stat-top-company', (data.top_company && data.top_company.name) || 'N/A');
        this.set_text('stat-vendor-nos', data.vendor_nos || 0);
        this.set_text('stat-peak-month', data.peak_month || 'N/A');

        this.render_trend_chart(data.monthly_trend || []);
        this.render_sections_chart(data.sections_breakdown || []);
        this.render_top_companies(data.company_breakdown || []);
        this.render_top_clients(data.client_breakdown || []);
        this.render_sectors(data.sector_breakdown || []);
        this.render_quarter_chart(data.quarter_view || []);

        this._sectionData = {
            trend: data.monthly_trend || [],
            sections: data.sections_breakdown || [],
            companies: data.company_breakdown || [],
            clients: data.client_breakdown || [],
            sectors: data.sector_breakdown || [],
            quarter: data.quarter_view || []
        };
        Object.keys(this._sections).forEach((k) => {
            var wrap = document.getElementById('bda-table-' + k);
            if (wrap) wrap.dataset.built = '';
            var tableBtn = document.querySelector(`[data-box="${k}"] .bda-box-table`);
            if (tableBtn && tableBtn.classList.contains('active')) {
                this.build_section_table(k);
            }
        });
        // Store all achievements for pagination
        this._all_achievements = data.achievements || [];
        this._ach_page = 1;
        this._ach_page_size = 20;
        this.render_recent_achievements();
        // Bind pagination buttons
        var prevBtn = document.getElementById('bda-prev-btn');
        var nextBtn = document.getElementById('bda-next-btn');
        if (prevBtn) prevBtn.onclick = () => { if (this._ach_page > 1) { this._ach_page--; this.render_recent_achievements(); } };
        if (nextBtn) nextBtn.onclick = () => { var pages = Math.ceil(this._all_achievements.length / this._ach_page_size); if (this._ach_page < pages) { this._ach_page++; this.render_recent_achievements(); } };
    }

    set_text(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    render_trend_chart(data) {
        var canvas = document.getElementById('trend-chart');
        if (!canvas) return;
        if (this.charts.trend) { this.charts.trend.destroy(); }
        if (!data || data.length === 0) {
            this.show_no_data_message('trend-chart-container', 'No trend data available');
            return;
        }
        var ctx = canvas.getContext('2d');
        // Use at least 1 so ghost bars always render even on all-zero months
        var maxVal = Math.max(...data.map(d => d.count), 1);

        // Blue-to-teal gradient for the bars
        var grad = ctx.createLinearGradient(0, 0, 0, 220);
        grad.addColorStop(0, '#4f6ef7');
        grad.addColorStop(1, '#00c6c6');

        // Plugin: draw count value below x-axis tick label
        var countLabelPlugin = {
            id: 'countLabels',
            afterDraw(chart) {
                var xAxis = chart.scales.x;
                var ctx2 = chart.ctx;
                ctx2.save();
                ctx2.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                ctx2.fillStyle = '#1a202c';
                ctx2.textAlign = 'center';
                xAxis.ticks.forEach((tick, i) => {
                    var x = xAxis.getPixelForTick(i);
                    var y = xAxis.bottom + 18;
                    ctx2.fillText(chart.data.datasets[1].data[i], x, y);
                });
                ctx2.restore();
            }
        };

        this.charts.trend = new Chart(canvas, {
            type: 'bar',
            plugins: [bda_chart_bg_plugin, countLabelPlugin],
            data: {
                labels: data.map(d => d.month),
                datasets: [
                    // Background ghost bars
                    {
                        label: 'bg',
                        data: data.map(() => maxVal),
                        backgroundColor: '#f0f2f5',
                        borderRadius: 8,
                        borderSkipped: false,
                        barPercentage: 0.55,
                        categoryPercentage: 0.75,
                        order: 2
                    },
                    // Actual gradient bars
                    {
                        label: 'Achievements',
                        data: data.map(d => d.count),
                        backgroundColor: grad,
                        borderRadius: 8,
                        borderSkipped: false,
                        barPercentage: 0.55,
                        categoryPercentage: 0.75,
                        order: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                grouped: false,
                layout: { padding: { bottom: 20 } },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ctx.datasetIndex === 1 ? ` ${ctx.parsed.y}` : null
                        },
                        filter: (item) => item.datasetIndex === 1
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        border: { display: false },
                        ticks: { color: '#6b7280', font: { size: 11 }, padding: 4 }
                    },
                    y: {
                        display: false,
                        beginAtZero: true,
                        max: maxVal * 1.15
                    }
                }
            }
        });
    }

    render_sections_chart(data) {
        var canvas = document.getElementById('company-chart');
        if (!canvas) return;
        if (this.charts.company) { this.charts.company.destroy(); }

        // Clear any previous custom legend
        var existingLegend = document.getElementById('bda-type-legend');
        if (existingLegend) existingLegend.remove();

        if (!data || data.length === 0) {
            this.show_no_data_message('company-chart-container', 'No section data available');
            return;
        }

        var topData = data.slice(0, 7);
        var total = topData.reduce((s, d) => s + (d.count || 0), 0);

        // Colors matching the screenshot: blue, green, orange, purple, grey...
        var colors = [
            '#4f6ef7',  // PQ - blue
            '#11998e',  // Registration - green
            '#f5a623',  // PQ Project - orange
            '#9b59b6',  // Unclassified - purple
            '#e74c3c',  // red
            '#00b4d8',  // cyan
            '#6b7280'   // grey
        ];

        // Rebuild the chart container to split into donut + legend
        var container = document.getElementById('company-chart-container');
        if (!container) return;
        container.innerHTML = '';
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.gap = '16px';
        container.style.height = '250px';

        // Donut wrapper (fixed width so canvas is square-ish)
        var donutWrap = document.createElement('div');
        donutWrap.style.cssText = 'position:relative;width:180px;min-width:180px;height:180px;flex-shrink:0;';

        var newCanvas = document.createElement('canvas');
        newCanvas.id = 'company-chart';
        donutWrap.appendChild(newCanvas);

        // Center label
        var centerLabel = document.createElement('div');
        centerLabel.style.cssText = [
            'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);',
            'text-align:center;pointer-events:none;line-height:1.2;'
        ].join('');
        centerLabel.innerHTML = `<span style="font-size:26px;font-weight:700;color:#1a202c;">${total}</span><br><span style="font-size:11px;color:#8a94a6;font-weight:500;">Total</span>`;
        donutWrap.appendChild(centerLabel);

        container.appendChild(donutWrap);

        // Custom legend on the right
        var legendDiv = document.createElement('div');
        legendDiv.id = 'bda-type-legend';
        legendDiv.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:9px;min-width:0;overflow:hidden;';

        topData.forEach((d, i) => {
            var row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:13px;';

            var dot = document.createElement('span');
            dot.style.cssText = `display:inline-block;width:12px;height:12px;border-radius:50%;background:${colors[i % colors.length]};flex-shrink:0;`;

            var label = document.createElement('span');
            label.style.cssText = 'flex:1;color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
            label.textContent = d.sections || 'Unknown';

            var count = document.createElement('span');
            count.style.cssText = 'font-weight:700;color:#1a202c;flex-shrink:0;margin-left:4px;';
            count.textContent = d.count;

            row.appendChild(dot);
            row.appendChild(label);
            row.appendChild(count);
            legendDiv.appendChild(row);
        });

        container.appendChild(legendDiv);

        // Draw the doughnut chart
        this.charts.company = new Chart(newCanvas, {
            type: 'doughnut',
            data: {
                labels: topData.map(d => d.sections),
                datasets: [{
                    data: topData.map(d => d.count),
                    backgroundColor: colors.slice(0, topData.length),
                    borderWidth: 2,
                    borderColor: '#fff',
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` ${ctx.label}: ${ctx.parsed} (${Math.round(ctx.parsed / total * 100)}%)`
                        }
                    }
                }
            }
        });
    }

    render_top_companies(data) {
        var container = document.getElementById('top-companies-list');
        if (!container) return;
        if (!data || data.length === 0) {
            container.innerHTML = '<div class="bda-no-data">No company data</div>';
            return;
        }
        var top = data.slice(0, 10);
        var max = top[0].count || 1;
        container.innerHTML = top.map((item, i) => `
            <div class="bda-rank-row">
                <span class="bda-rank-num">${i + 1}</span>
                <span class="bda-rank-name">${item.company || ''}</span>
                <div class="bda-rank-bar-wrap">
                    <div class="bda-rank-bar bda-bar-blue" style="width:${Math.round((item.count / max) * 100)}%"></div>
                </div>
                <span class="bda-rank-count">${item.count}</span>
            </div>
        `).join('');
    }

    render_top_clients(data) {
        var container = document.getElementById('top-clients-list');
        if (!container) return;
        if (!data || data.length === 0) {
            container.innerHTML = '<div class="bda-no-data">No client data</div>';
            return;
        }
        var CLIENT_COLORS = [
            '#4f6ef7','#11998e','#f5a623','#764ba2','#e74c3c',
            '#e74c3c','#00b4d8','#27ae60','#f5a623','#9b59b6'
        ];
        var top = data.slice(0, 10);
        var max = top[0].count || 1;
        container.innerHTML = top.map((item, i) => `
            <div class="bda-rank-row">
                <span class="bda-rank-num">${i + 1}</span>
                <span class="bda-rank-name">${item.client || ''}</span>
                <div class="bda-rank-bar-wrap">
                    <div class="bda-rank-bar" style="width:${Math.round((item.count / max) * 100)}%;background:${CLIENT_COLORS[i % CLIENT_COLORS.length]}"></div>
                </div>
                <span class="bda-rank-count">${item.count}</span>
            </div>
        `).join('');
    }

    render_sectors(data) {
        var container = document.getElementById('sectors-list');
        if (!container) return;
        if (!data || data.length === 0) {
            container.innerHTML = '<div class="bda-no-data">No sector data</div>';
            return;
        }
        var SECTOR_STYLES = [
            { bg: '#eef2ff', bar: '#4f6ef7', text: '#3730a3' },
            { bg: '#ecfdf5', bar: '#10b981', text: '#065f46' },
            { bg: '#fff7ed', bar: '#f59e0b', text: '#92400e' },
            { bg: '#f5f3ff', bar: '#8b5cf6', text: '#5b21b6' },
            { bg: '#f0fdfa', bar: '#14b8a6', text: '#134e4a' },
            { bg: '#fef2f2', bar: '#ef4444', text: '#991b1b' },
            { bg: '#fafafa', bar: '#6b7280', text: '#374151' },
        ];
        var max = data[0].count || 1;
        container.innerHTML = data.map((item, i) => {
            var s = SECTOR_STYLES[i % SECTOR_STYLES.length];
            return `
            <div class="bda-sector-row" style="background:${s.bg}">
                <span class="bda-sector-name" style="color:${s.text}">${item.sector || ''}</span>
                <div class="bda-sector-bar-wrap">
                    <div class="bda-sector-bar" style="width:${Math.round((item.count / max) * 100)}%;background:${s.bar}"></div>
                </div>
                <span class="bda-sector-count" style="color:${s.text}">${item.count}</span>
            </div>`;
        }).join('');
    }

    render_quarter_chart(data) {
        var canvas = document.getElementById('quarter-chart');
        if (!canvas) return;
        if (this.charts.quarter) { this.charts.quarter.destroy(); }
        if (!data || data.length === 0) {
            this.show_no_data_message('quarter-chart-container', 'No quarter data available');
            return;
        }
        var ctx = canvas.getContext('2d');
        var maxVal = Math.max(...data.map(d => d.count), 1);

        // Blue-to-teal gradient for the bars
        var grad = ctx.createLinearGradient(0, 0, 0, 220);
        grad.addColorStop(0, '#4f6ef7');
        grad.addColorStop(1, '#00c6c6');

        // Plugin: draw count value below x-axis tick label
        var countLabelPlugin = {
            id: 'qCountLabels',
            afterDraw(chart) {
                var xAxis = chart.scales.x;
                var ctx2 = chart.ctx;
                ctx2.save();
                ctx2.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                ctx2.fillStyle = '#1a202c';
                ctx2.textAlign = 'center';
                xAxis.ticks.forEach((tick, i) => {
                    var x = xAxis.getPixelForTick(i);
                    var y = xAxis.bottom + 18;
                    ctx2.fillText(chart.data.datasets[1].data[i], x, y);
                });
                ctx2.restore();
            }
        };

        this.charts.quarter = new Chart(canvas, {
            type: 'bar',
            plugins: [bda_chart_bg_plugin, countLabelPlugin],
            data: {
                labels: data.map(d => d.quarter),
                datasets: [
                    // Background ghost bars
                    {
                        label: 'bg',
                        data: data.map(() => maxVal),
                        backgroundColor: '#f0f2f5',
                        borderRadius: 8,
                        borderSkipped: false,
                        barPercentage: 0.55,
                        categoryPercentage: 0.75,
                        order: 2
                    },
                    // Actual gradient bars
                    {
                        label: 'Achievements',
                        data: data.map(d => d.count),
                        backgroundColor: grad,
                        borderRadius: 8,
                        borderSkipped: false,
                        barPercentage: 0.55,
                        categoryPercentage: 0.75,
                        order: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                grouped: false,
                layout: { padding: { bottom: 20 } },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ctx.datasetIndex === 1 ? ` ${ctx.parsed.y}` : null
                        },
                        filter: (item) => item.datasetIndex === 1
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        border: { display: false },
                        ticks: { color: '#6b7280', font: { size: 11 }, padding: 4 }
                    },
                    y: {
                        display: false,
                        beginAtZero: true,
                        max: maxVal * 1.15
                    }
                }
            }
        });
    }

    render_recent_achievements() {

        var data = this._all_achievements || [];
        var tbody = document.getElementById('recent-achievements-body');
        var pageInfo = document.getElementById('bda-page-info');
        if (!tbody) return;

        var pageSize = this._ach_page_size || 20;
        var page = this._ach_page || 1;
        var totalPages = Math.max(1, Math.ceil(data.length / pageSize));
        if (page > totalPages) page = this._ach_page = 1;

        if (pageInfo) pageInfo.textContent = `Page ${page} / ${totalPages}`;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="bda-no-data">No achievements found</td></tr>';
            return;
        }

        var SECTION_COLORS = {
            'Registration': { bg: '#dcfce7', text: '#166534' },
            'PQ':           { bg: '#ccfbf1', text: '#0f766e' },
            'Qualification':{ bg: '#ede9fe', text: '#5b21b6' },
        };

        var start = (page - 1) * pageSize;
        var pageData = data.slice(start, start + pageSize);

        tbody.innerHTML = pageData.map(item => {
            var ach = (item.achievement || '');
            var achDisplay = ach.length > 80 ? ach.substring(0, 80) + '...' : ach;
            var achHtml = item.name
                ? `<a href="/app/bd-achievements/${item.name}" target="_blank" class="bda-ach-link" title="${ach.replace(/"/g, '&quot;')}">${achDisplay}</a>`
                : achDisplay;

            var section = item.sections || '';
            var sStyle = SECTION_COLORS[section] || { bg: '#f3f4f6', text: '#374151' };
            var sectionHtml = section
                ? `<span class="bda-section-badge" style="background:${sStyle.bg};color:${sStyle.text}">${section}</span>`
                : '<span style="color:#adb5bd">-</span>';

            return `<tr>
                <td>${item.date || ''}</td>
                <td>${item.year || ''}</td>
                <td>${item.company || ''}</td>
                <td>${item.client || ''}</td>
                <td class="bda-ach-cell">${achHtml}</td>
                <td>${sectionHtml}</td>
                <td>${item.vendor_no || '-'}</td>
                <td class="bda-sector-cell">${item.sector || '-'}</td>
            </tr>`;
        }).join('');
    }

    setup_box_controls() {
        document.querySelectorAll('.bda-box').forEach((box) => {
            box.querySelector('.bda-box-graph').addEventListener('click', () => this.toggle_section_view(box.dataset.box, 'graph'));
            box.querySelector('.bda-box-table').addEventListener('click', () => this.toggle_section_view(box.dataset.box, 'table'));
            box.querySelector('.bda-box-download').addEventListener('click', () => this.download_section_view(box.dataset.box));
        });
    }

    toggle_section_view(key, view) {
        var box = document.querySelector(`[data-box="${key}"]`);
        if (!box) return;
        var graphBtn = box.querySelector('.bda-box-graph');
        var tableBtn = box.querySelector('.bda-box-table');
        var graphView = box.querySelector('.bda-box-graph-view');
        var tableView = box.querySelector('.bda-box-table-view');
        if (!graphView || !tableView) return;
        var isTable = view === 'table';
        graphBtn.classList.toggle('active', !isTable);
        tableBtn.classList.toggle('active', isTable);
        graphView.style.display = isTable ? 'none' : '';
        tableView.style.display = isTable ? '' : 'none';
        if (isTable && !tableView.dataset.built) {
            this.build_section_table(key);
        }
    }

    build_section_table(key) {
        var cfg = this._sections[key];
        var data = (this._sectionData[key] || []).slice(0, cfg.limit || undefined);
        var wrap = document.getElementById('bda-table-' + key);
        if (!wrap) return;
        wrap.dataset.built = '1';
        if (!data.length) {
            wrap.innerHTML = '<div class="bda-no-data">No data available</div>';
            return;
        }
        var head = '<tr>' + cfg.headers.map((h) => '<th>' + this.esc(h) + '</th>').join('') + '</tr>';
        var body = data.map((d, i) =>
            '<tr>' + cfg.row(d, i).map((c) => '<td>' + this.esc(c) + '</td>').join('') + '</tr>'
        ).join('');
        wrap.innerHTML = '<div class="bda-table-scroll"><table class="bda-table"><thead>'
            + head + '</thead><tbody>' + body + '</tbody></table></div>';
    }

    download_section_view(key) {
        var cfg = this._sections[key];
        var data = (this._sectionData[key] || []).slice(0, cfg.limit || undefined);
        if (!data.length) {
            frappe.msgprint({ title: __('Info'), message: __('No data available to download.'), indicator: 'blue' });
            return;
        }
        var box = document.querySelector(`[data-box="${key}"]`);
        var isTable = box && box.querySelector('.bda-box-table').classList.contains('active');
        var filename = cfg.title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
        var canvas = null;

        if (isTable) {
            canvas = this.draw_table_to_canvas(cfg.title, cfg.headers, data.map(cfg.row));
            if (!canvas) {
                frappe.msgprint({ title: __('Info'), message: __('Could not generate the image.'), indicator: 'red' });
                return;
            }
            this.download_canvas(canvas, filename);
        } else {
            // All graph views (including trend/quarter) are rendered offscreen
            // so the download is always full-size, crisp, and independent of
            // the current scroll position or container clipping.
            this.render_offscreen_graph(key, (canvas) => {
                if (!canvas) {
                    frappe.msgprint({ title: __('Info'), message: __('Could not generate the image.'), indicator: 'red' });
                    return;
                }
                this.download_canvas(canvas, filename);
            });
        }
    }

    download_records_preview() {
        var records = this._all_achievements || [];
        if (!records.length) {
            frappe.msgprint({ title: __('Info'), message: __('No records available to export.'), indicator: 'blue' });
            return;
        }
        frappe.call({
            method: 'crm_customization.crm_customization.page.bd_achievements.bd_achievements.export_records',
            args: { filters: this.get_filters() },
            callback: (r) => {
                if (!r.message || !r.message.content) {
                    frappe.msgprint({ title: __('Info'), message: __('No records available to export.'), indicator: 'blue' });
                    return;
                }
                var a = document.createElement('a');
                a.href = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,'
                    + r.message.content;
                a.download = r.message.filename || 'BD Achievement Records.xlsx';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            },
            error: () => {
                frappe.msgprint({ title: __('Error'), message: __('Failed to export records.'), indicator: 'red' });
            }
        });
    }

    render_offscreen_graph(key, callback) {
        if (!window.Chart) { callback(null); return; }
        var cfg = this._sections[key];
        var data = (this._sectionData[key] || []).slice(0, cfg.limit || undefined);
        if (!data.length) { callback(null); return; }

        // Render into a fixed-size offscreen container so Chart.js can
        // properly lay out the chart without depending on the live DOM.
        var isVerticalBar = (key === 'trend' || key === 'quarter');
        var width, height;
        if (key === 'sections') {
            width = 560; height = 320;
        } else if (isVerticalBar) {
            width = 700; height = 340;
        } else {
            width = 620; height = Math.max(260, data.length * 44 + 80);
        }

        var wrapper = document.createElement('div');
        wrapper.style.cssText = `position:fixed;left:-9999px;top:0;width:${width}px;height:${height}px;z-index:-1;overflow:hidden;`;
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        wrapper.appendChild(canvas);
        document.body.appendChild(wrapper);

        var finish = (chart) => {
            // rAF ensures the canvas has been painted before we capture it
            requestAnimationFrame(() => {
                callback(chart.canvas);
                setTimeout(() => {
                    chart.destroy();
                    if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
                }, 500);
            });
        };

        if (key === 'sections') {
            var colors = ['#4f6ef7', '#11998e', '#f5a623', '#9b59b6', '#e74c3c', '#00b4d8', '#6b7280'];
            var totalCount = data.reduce((s, d) => s + (d.count || 0), 0);

            // Plugin: draw the count on each slice + total in the donut centre
            var donutNumbersPlugin = {
                id: 'donutNumbers',
                afterDatasetsDraw(ch) {
                    var meta = ch.getDatasetMeta(0);
                    var c2 = ch.ctx;
                    c2.save();
                    c2.textAlign = 'center';
                    c2.textBaseline = 'middle';

                    // Count on each slice (skip very thin slices to avoid clutter)
                    c2.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                    c2.fillStyle = '#ffffff';
                    meta.data.forEach((arc, i) => {
                        var val = ch.data.datasets[0].data[i];
                        if (!val || (val / totalCount) < 0.04) return;
                        var p = arc.getCenterPoint();
                        c2.fillText(val, p.x, p.y);
                    });

                    // Total in the centre
                    var area = ch.chartArea;
                    var cx = (area.left + area.right) / 2;
                    var cy = (area.top + area.bottom) / 2;
                    c2.fillStyle = '#1a202c';
                    c2.font = 'bold 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                    c2.fillText(totalCount, cx, cy - 8);
                    c2.fillStyle = '#8a94a6';
                    c2.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                    c2.fillText('Total', cx, cy + 14);
                    c2.restore();
                }
            };

            var chart = new Chart(canvas, {
                type: 'doughnut',
                plugins: [bda_chart_bg_plugin, donutNumbersPlugin],
                data: {
                    labels: data.map(cfg.label),
                    datasets: [{
                        data: data.map((d) => d.count),
                        backgroundColor: colors.slice(0, data.length),
                        borderWidth: 2,
                        borderColor: '#fff'
                    }]
                },
                options: {
                    responsive: false,
                    maintainAspectRatio: false,
                    animation: false,
                    cutout: '60%',
                    layout: { padding: 10 },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'right',
                            labels: {
                                boxWidth: 14,
                                padding: 12,
                                font: { size: 12 },
                                // Legend text now includes count and percentage
                                generateLabels: (ch) => {
                                    var ds = ch.data.datasets[0];
                                    return ch.data.labels.map((label, i) => {
                                        var val = ds.data[i];
                                        var pct = totalCount ? Math.round(val / totalCount * 100) : 0;
                                        return {
                                            text: `${label}: ${val} (${pct}%)`,
                                            fillStyle: ds.backgroundColor[i],
                                            strokeStyle: '#ffffff',
                                            lineWidth: 1,
                                            hidden: false,
                                            index: i
                                        };
                                    });
                                }
                            }
                        },
                        tooltip: { enabled: false }
                    }
                }
            });
            finish(chart);
            return;
        }

        if (isVerticalBar) {
            var ctx = canvas.getContext('2d');
            var grad = ctx.createLinearGradient(0, 0, 0, height * 0.75);
            grad.addColorStop(0, '#4f6ef7');
            grad.addColorStop(1, '#00c6c6');

            var maxVal = Math.max(...data.map(d => d.count), 1);

            // Plugin: draw count value above each bar
            var offscreenCountPlugin = {
                id: 'offscreenCountLabels',
                afterDatasetsDraw(ch) {
                    var meta = ch.getDatasetMeta(1);
                    if (!meta || !meta.data) return;
                    var c2 = ch.ctx;
                    c2.save();
                    c2.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                    c2.fillStyle = '#1a202c';
                    c2.textAlign = 'center';
                    meta.data.forEach((bar, i) => {
                        var val = ch.data.datasets[1].data[i];
                        c2.fillText(val, bar.x, bar.y - 6);
                    });
                    c2.restore();
                }
            };

            var barChart = new Chart(canvas, {
                type: 'bar',
                plugins: [bda_chart_bg_plugin, offscreenCountPlugin],
                data: {
                    labels: data.map(cfg.label),
                    datasets: [
                        {
                            label: 'bg',
                            data: data.map(() => maxVal),
                            backgroundColor: '#f0f2f5',
                            borderRadius: 8,
                            borderSkipped: false,
                            barPercentage: 0.55,
                            categoryPercentage: 0.75,
                            order: 2
                        },
                        {
                            label: 'Achievements',
                            data: data.map(d => d.count),
                            backgroundColor: grad,
                            borderRadius: 8,
                            borderSkipped: false,
                            barPercentage: 0.55,
                            categoryPercentage: 0.75,
                            order: 1
                        }
                    ]
                },
                options: {
                    responsive: false,
                    maintainAspectRatio: false,
                    grouped: false,
                    layout: { padding: { top: 24, bottom: 10, left: 10, right: 10 } },
                    animation: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: { enabled: false }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            border: { display: false },
                            ticks: { color: '#6b7280', font: { size: 11 }, padding: 4 }
                        },
                        y: {
                            display: false,
                            beginAtZero: true,
                            max: maxVal * 1.2
                        }
                    }
                }
            });
            finish(barChart);
            return;
        }

        var palettes = {
            companies: ['#4f6ef7', '#11998e', '#f5a623', '#764ba2', '#e74c3c', '#00b4d8', '#27ae60', '#9b59b6', '#f59e0b', '#14b8a6'],
            clients:   ['#4f6ef7', '#11998e', '#f5a623', '#764ba2', '#e74c3c', '#00b4d8', '#27ae60', '#9b59b6'],
            sectors:   ['#4f6ef7', '#10b981', '#f59e0b', '#8b5cf6', '#14b8a6', '#ef4444', '#6b7280']
        };
        var palette = palettes[key] || ['#4f6ef7'];
        var barColors = data.map((_, i) => palette[i % palette.length]);

        var horizChart = new Chart(canvas, {
            type: 'bar',
            plugins: [bda_chart_bg_plugin],
            data: {
                labels: data.map(cfg.label),
                datasets: [{ data: data.map((d) => d.count), backgroundColor: barColors, borderRadius: 4, barThickness: 20 }]
            },
            options: {
                indexAxis: 'y',
                responsive: false,
                maintainAspectRatio: false,
                animation: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: { color: '#eef0f4' },
                        border: { display: false },
                        ticks: { precision: 0 }
                    },
                    y: {
                        grid: { display: false },
                        border: { display: false },
                        ticks: { font: { size: 11 } }
                    }
                }
            }
        });
        finish(horizChart);
    }

    draw_table_to_canvas(title, headers, rows, rowHeight) {
        var font = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        var headerFont = 'bold 13px ' + font;
        var bodyFont = '12px ' + font;
        var titleFont = 'bold 15px ' + font;
        var cellPad = 10;
        var measureCtx = document.createElement('canvas').getContext('2d');
        var measure = (txt, f) => { measureCtx.font = f; return measureCtx.measureText(txt === null || txt === undefined ? '' : String(txt)).width; };

        var colW = headers.map((h) => measure(h, headerFont) + cellPad * 2);
        rows.forEach((r) => r.forEach((c, i) => {
            var w = measure(c, bodyFont) + cellPad * 2;
            if (w > colW[i]) colW[i] = w;
        }));
        colW = colW.map((w) => Math.max(w, 70));

        var tableW = colW.reduce((a, b) => a + b, 0);
        var titleH = 42;
        var headerH = 32;
        var rowH = rowHeight || 27;
        var pad = 12;

        var canvas = document.createElement('canvas');
        canvas.width = tableW + pad * 2;
        canvas.height = titleH + headerH + rows.length * rowH + pad * 2;

        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.textBaseline = 'middle';
        ctx.font = titleFont;
        ctx.fillStyle = '#1f2937';
        ctx.fillText(title, pad, pad + titleH / 2);

        var y0 = pad + titleH;
        var x;
        var y;

        ctx.fillStyle = '#4f6ef7';
        ctx.fillRect(pad, y0, tableW, headerH);
        ctx.fillStyle = '#ffffff';
        ctx.font = headerFont;
        x = pad;
        headers.forEach((h, i) => {
            ctx.fillText(String(h), x + cellPad, y0 + headerH / 2);
            x += colW[i];
        });

        ctx.font = bodyFont;
        y = y0 + headerH;
        rows.forEach((r, ri) => {
            ctx.fillStyle = ri % 2 ? '#f8f9fb' : '#ffffff';
            ctx.fillRect(pad, y, tableW, rowH);
            ctx.fillStyle = '#374151';
            x = pad;
            r.forEach((c, ci) => {
                ctx.fillText(c === null || c === undefined ? '' : String(c), x + cellPad, y + rowH / 2);
                x += colW[ci];
            });
            ctx.strokeStyle = '#eef0f4';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(pad, y + rowH);
            ctx.lineTo(pad + tableW, y + rowH);
            ctx.stroke();
            y += rowH;
        });

        ctx.strokeStyle = '#dde1e7';
        ctx.strokeRect(pad, y0, tableW, headerH + rows.length * rowH);
        return canvas;
    }

    download_canvas(canvas, filename) {
        var save = function(url) {
            var a = document.createElement('a');
            a.href = url;
            a.download = filename + '.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        };
        if (canvas.toBlob) {
            canvas.toBlob((blob) => {
                if (blob) {
                    var url = URL.createObjectURL(blob);
                    save(url);
                    setTimeout(() => URL.revokeObjectURL(url), 3000);
                } else {
                    save(canvas.toDataURL('image/png'));
                }
            }, 'image/png');
        } else {
            save(canvas.toDataURL('image/png'));
        }
    }

    esc(s) {
        return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, (c) => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
        ));
    }

    show_no_data_message(containerId, message) {
        var container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `<div class="bda-no-data" style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;">
                <i class="fa fa-bar-chart" style="font-size:36px;color:#dee2e6;margin-bottom:8px;"></i>
                <span>${message}</span></div>`;
        }
    }

    show_loading() {
        this.hide_loading();
        var overlay = document.createElement('div');
        overlay.className = 'bda-loading-overlay';
        overlay.id = 'bda-loading';
        overlay.innerHTML = `<i class="fa fa-spinner fa-spin"></i><span>Loading...</span>`;
        document.body.appendChild(overlay);
    }

    hide_loading() {
        var el = document.getElementById('bda-loading');
        if (el) el.remove();
    }

    add_css() {
        if (document.getElementById('bda-styles')) return;
        const style = document.createElement('style');
        style.id = 'bda-styles';
        style.textContent = `
            .bda-wrapper {
                background: #f5f6fa;
                min-height: calc(100vh - var(--navbar-height));
                padding-bottom: 30px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }

            /* ── Full screen layout ── */
            body[data-route="bd_achievements"] .page-head {
                display: none;
            }

            body[data-route="bd_achievements"] .page-body,
            body[data-route="bd_achievements"] .layout-main,
            body[data-route="bd_achievements"] .layout-main-section-wrapper,
            body[data-route="bd_achievements"] .layout-main-section,
            body[data-route="bd_achievements"] .page-wrapper,
            body[data-route="bd_achievements"] .page-content {
                max-width: none !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
            }

            /* hide Frappe's built-in page-form since we have our own filter bar */
            .layout-main-section > .page-form { display: none !important; }

            /* ── Dashboard header ── */
            .bda-header-bar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: #fff;
                padding: 14px 20px;
                border-bottom: 1px solid #e8eaed;
            }

            .bda-header-title {
                font-size: 18px;
                font-weight: 700;
                color: #000;
                margin: 0;
                letter-spacing: 0.1px;
            }

            .bda-btn-refresh {
                background: #fff;
                color: #4f6ef7;
                border: 1.5px solid #4f6ef7;
                border-radius: 6px;
                padding: 6px 18px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                white-space: nowrap;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .bda-btn-refresh:hover { background: #f0f2ff; }

            /* ── Filter bar ── */
            .bda-filter-bar {
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                gap: 10px;
                background: #fff;
                border-bottom: 1px solid #e8eaed;
                padding: 12px 16px;
            }

            .bda-filter-left {
                display: flex;
                align-items: center;
                gap: 7px;
                flex-shrink: 0;
                white-space: nowrap;
                padding-right: 6px;
                border-right: 1px solid #e8eaed;
            }

            .bda-filter-icon {
                font-size: 16px;
                color: #667eea;
            }

            .bda-filter-title {
                font-weight: 600;
                font-size: 13px;
                color: #2c3e50;
            }

            .bda-filters-row {
                display: flex;
                align-items: flex-end;
                gap: 10px;
                flex: 1 1 auto;
                flex-wrap: wrap;
                min-width: 0;
            }

            .bda-filter-group {
                display: flex;
                flex-direction: column;
                gap: 2px;
                min-width: 85px;
                flex: 1 1 0;
            }

            .bda-filter-group label {
                font-size: 11px;
                font-weight: 600;
                color: #000;
                margin: 0;
                text-transform: uppercase;
                letter-spacing: 0.3px;
            }

            .bda-filter-group select,
            .bda-filter-group input[type="date"] {
                height: 30px;
                border: 1px solid #dde1e7;
                border-radius: 5px;
                padding: 0 6px;
                font-size: 12px;
                color: #2c3e50;
                background: #fff;
                outline: none;
                cursor: pointer;
                width: 100%;
                transition: border-color 0.2s;
            }

            .bda-filter-group select:focus,
            .bda-filter-group input[type="date"]:focus {
                border-color: #667eea;
                box-shadow: 0 0 0 2px rgba(102,126,234,0.12);
            }

            .bda-filter-actions {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-shrink: 0;
                margin-left: 16px;
                padding-left: 12px;
                border-left: 1px solid #e8eaed;
            }

            .bda-btn-apply {
                background: #4f6ef7;
                color: #fff;
                border: none;
                border-radius: 6px;
                padding: 6px 16px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                white-space: nowrap;
                transition: background 0.2s;
            }
            .bda-btn-apply:hover { background: #3a56e8; }

            .bda-btn-reset {
                background: transparent;
                color: #4f6ef7;
                border: 1px solid #dde1e7;
                border-radius: 6px;
                padding: 5px 14px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                white-space: nowrap;
                transition: all 0.2s;
            }
            .bda-btn-reset:hover { background: #f0f2ff; border-color: #667eea; }

            /* ── Summary cards ── */
            .bda-cards-grid {
                display: grid;
                grid-template-columns: repeat(5, 1fr);
                gap: 12px;
                padding: 14px 16px 0;
            }

            .bda-card {
                background: #fff;
                border-radius: 8px;
                padding: 14px 16px 12px;
                border-left: 4px solid #ccc;
                box-shadow: 0 1px 3px rgba(0,0,0,0.06);
                transition: box-shadow 0.2s, transform 0.2s;
                cursor: default;
            }
            .bda-card:hover {
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                transform: translateY(-2px);
            }

            .bda-card-label {
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.4px;
                margin-bottom: 3px;
            }
            .bda-card-value {
                font-size: 30px;
                font-weight: 700;
                color: #1a202c;
                line-height: 1.15;
                margin-bottom: 3px;
            }
            .bda-card-value-sm { font-size: 20px; }
            .bda-card-sub { font-size: 11px; color: #8a94a6; }

            .bda-card-teal   { border-left-color: #11998e; } .bda-card-teal   .bda-card-label { color: #11998e; }
            .bda-card-blue   { border-left-color: #4facfe; } .bda-card-blue   .bda-card-label { color: #2980b9; }
            .bda-card-purple { border-left-color: #764ba2; } .bda-card-purple .bda-card-label { color: #764ba2; }
            .bda-card-indigo { border-left-color: #5b6cf9; } .bda-card-indigo .bda-card-label { color: #5b6cf9; }
            .bda-card-green  { border-left-color: #27ae60; } .bda-card-green  .bda-card-label { color: #27ae60; }
            .bda-card-orange { border-left-color: #f5a623; } .bda-card-orange .bda-card-label { color: #e67e22; }
            .bda-card-cyan   { border-left-color: #00b4d8; } .bda-card-cyan   .bda-card-label { color: #0077a8; }
            .bda-card-pink   { border-left-color: #f5576c; } .bda-card-pink   .bda-card-label { color: #f5576c; }
            .bda-card-red    { border-left-color: #e74c3c; } .bda-card-red    .bda-card-label { color: #e74c3c; }
            .bda-card-violet { border-left-color: #9b59b6; } .bda-card-violet .bda-card-label { color: #9b59b6; }

            /* ── Charts ── */
            .bda-charts-grid {
                display: grid;
                grid-template-columns: 2fr 1fr;
                gap: 12px;
                padding: 14px 16px 0;
            }

            .bda-chart-box {
                background: #fff;
                border-radius: 8px;
                padding: 16px 18px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.06);
            }

            .bda-chart-title {
                font-size: 13px;
                font-weight: 700;
                color: #2c3e50;
                margin-bottom: 10px;
                padding-bottom: 8px;
                border-bottom: 2px solid #f0f2f5;
            }

            /* ── Chart box header + view controls ── */
            .bda-box-head {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                margin-bottom: 10px;
                padding-bottom: 8px;
                border-bottom: 2px solid #f0f2f5;
            }

            .bda-box-head .bda-chart-title {
                margin: 0;
                padding: 0;
                border: none;
                min-width: 0;
            }

            .bda-box-actions {
                display: flex;
                align-items: center;
                gap: 6px;
                flex-shrink: 0;
            }

            .bda-box-btn {
                background: #fff;
                border: 1px solid #dde1e7;
                border-radius: 6px;
                padding: 4px 12px;
                font-size: 12px;
                font-weight: 600;
                color: #6b7280;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 5px;
                white-space: nowrap;
                transition: all 0.15s;
            }
            .bda-box-btn:hover { border-color: #667eea; color: #4f6ef7; background: #f7f8ff; }
            .bda-box-btn.active { background: #4f6ef7; border-color: #4f6ef7; color: #fff; }
            .bda-box-btn.active:hover { background: #3a56e8; color: #fff; }

            .bda-box-table-view .bda-table-scroll { max-height: 250px; }

            .bda-chart-area {
                height: 250px;
                position: relative;
            }
            .bda-chart-area canvas { width: 100% !important; height: 100% !important; }

            /* ── Table ── */
            .bda-table-scroll { overflow-y: auto; max-height: 250px; }

            .bda-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 12px;
            }
            .bda-table th {
                background: #f8f9fb;
                color: #6b7280;
                font-weight: 700;
                text-transform: uppercase;
                font-size: 10px;
                letter-spacing: 0.5px;
                padding: 8px 10px;
                position: sticky;
                top: 0;
                z-index: 1;
                border-bottom: 1px solid #e5e7eb;
                white-space: nowrap;
            }
            .bda-table td {
                padding: 7px 10px;
                border-bottom: 1px solid #f3f4f6;
                color: #374151;
            }
            .bda-table tr:hover td { background: #fafbff; }
            .bda-no-data { text-align: center; color: #adb5bd; padding: 20px; }

            /* ── Loading overlay ── */
            .bda-loading-overlay {
                position: fixed;
                inset: 0;
                background: rgba(255,255,255,0.75);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                gap: 12px;
                font-size: 15px;
                color: #667eea;
            }
            .bda-loading-overlay i { font-size: 32px; }

            /* ── Ranked list (Top Companies / Top Clients) ── */
            .bda-two-col { grid-template-columns: 1fr 1fr !important; }

            .bda-rank-list {
                display: flex;
                flex-direction: column;
                gap: 6px;
                max-height: 320px;
                overflow-y: auto;
            }

            .bda-rank-row {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 12.5px;
            }

            .bda-rank-num {
                width: 20px;
                text-align: center;
                font-weight: 700;
                color: #6b7280;
                font-size: 12px;
                flex-shrink: 0;
            }

            .bda-rank-name {
                flex: 1 1 180px;
                min-width: 0;
                color: #1f2937;
                font-weight: 500;
                white-space: normal;
                word-break: break-word;
                line-height: 1.3;
            }

            .bda-rank-bar-wrap {
                flex: 1;
                height: 8px;
                background: #e5e7eb;
                border-radius: 4px;
                overflow: hidden;
            }

            .bda-rank-bar {
                height: 100%;
                border-radius: 4px;
                transition: width 0.5s ease;
            }

            .bda-bar-blue { background: #4f6ef7; }

            .bda-rank-count {
                width: 28px;
                text-align: right;
                font-weight: 700;
                color: #374151;
                font-size: 12px;
                flex-shrink: 0;
            }

            /* ── Sector list ── */
            .bda-sector-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .bda-sector-row {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 8px 12px;
                border-radius: 6px;
            }

            .bda-sector-name {
                width: 190px;
                flex-shrink: 0;
                font-size: 12.5px;
                font-weight: 600;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .bda-sector-bar-wrap {
                flex: 1;
                height: 7px;
                background: rgba(0,0,0,0.08);
                border-radius: 4px;
                overflow: hidden;
            }

            .bda-sector-bar {
                height: 100%;
                border-radius: 4px;
                transition: width 0.5s ease;
            }

            .bda-sector-count {
                width: 28px;
                text-align: right;
                font-weight: 700;
                font-size: 13px;
                flex-shrink: 0;
            }


            /* ── BD Achievement Records Preview ── */
            .bda-records-box { margin: 0 16px 20px; }

            .bda-records-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 12px;
                padding-bottom: 10px;
                border-bottom: 2px solid #f0f2f5;
            }

            .bda-records-nav {
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 12px;
            }

            .bda-records-label { color: #6b7280; font-size: 12px; }

            .bda-nav-btn {
                background: #fff;
                border: 1px solid #d1d5db;
                border-radius: 5px;
                padding: 3px 12px;
                font-size: 12px;
                font-weight: 500;
                color: #374151;
                cursor: pointer;
                transition: all 0.15s;
            }
            .bda-nav-btn:hover { background: #f3f4f6; border-color: #9ca3af; }

            .bda-page-info {
                color: #374151;
                font-weight: 600;
                font-size: 12px;
                white-space: nowrap;
            }

            .bda-section-badge {
                display: inline-block;
                padding: 2px 10px;
                border-radius: 12px;
                font-size: 11px;
                font-weight: 700;
                white-space: nowrap;
            }

            .bda-ach-link { color: #4f6ef7; text-decoration: none; font-size: 12px; }
            .bda-ach-link:hover { text-decoration: underline; }
            .bda-ach-cell { max-width: 320px; }
            .bda-sector-cell { max-width: 120px; font-size: 11px; color: #6b7280; }

            @media (max-width: 1100px) {

                .bda-cards-grid { grid-template-columns: repeat(3, 1fr); }
                .bda-charts-grid { grid-template-columns: 1fr; }
            }
            @media (max-width: 680px) {
                .bda-cards-grid { grid-template-columns: 1fr 1fr; }
                .bda-filter-bar { flex-wrap: wrap; }
                .bda-filters-row { flex-wrap: wrap; }
            }
        `;
        document.head.appendChild(style);
    }
};
