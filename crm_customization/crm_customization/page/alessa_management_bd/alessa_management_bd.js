// Copyright (c) 2026, Finbyz and contributors
// For license information, please see license.txt
frappe.provide('crm_customization');

function init_alessa_mgmt_dashboard(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Business Development Management Dashboard',
        single_column: true
    });

    // Build the dashboard immediately so cards/tables always render,
    // even if Chart.js cannot be loaded.
    var instance = new crm_customization.AlessaManagementBDDashboard(page);

    // Charts are drawn once the library is available.
    crm_customization.load_chartjs().then((ok) => {
        if (ok) instance.render_all_charts();
    });
}

frappe.pages['alessa_management_bd'] = frappe.pages['alessa_management_bd'] || {};
frappe.pages['alessa_management_bd'].on_page_load = init_alessa_mgmt_dashboard;

frappe.pages['alessa-management-bd'] = frappe.pages['alessa-management-bd'] || {};
frappe.pages['alessa-management-bd'].on_page_load = init_alessa_mgmt_dashboard;

crm_customization.load_chartjs = function() {
    return new Promise((resolve) => {
        if (window.Chart) { resolve(true); return; }

        // Chart.js is loaded from CDN.
        var sources = [
            'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
            'https://unpkg.com/chart.js@4.4.0/dist/chart.umd.min.js'
        ];

        var idx = 0;
        var try_next = function() {
            if (idx >= sources.length) {
                resolve(false);
                return;
            }
            var src = sources[idx++];
            var script = document.createElement('script');
            script.src = src;
            script.async = false;
            script.onload = function() {
                if (window.Chart) resolve(true);
                else try_next();
            };
            script.onerror = try_next;
            document.head.appendChild(script);
        };

        try_next();
    });
};

/* Shared Chart.js legend styling - keeps spacing consistent across charts */
crm_customization.LEGEND_LABELS = {
    color: '#475569',
    font: { size: 11, weight: '600' },
    usePointStyle: true,
    pointStyle: 'circle',
    boxWidth: 8,
    boxHeight: 8,
    padding: 18,
    useBorderRadius: true,
    borderRadius: 4
};

crm_customization.apply_legend_margin = function(chart, margin) {
    if (!chart.legend || chart.legend._fitOverridden) return;
    var fit = chart.legend.fit;
    var extraMargin = margin || 22;
    chart.legend.fit = function() {
        fit.call(this);
        this.height += extraMargin;
    };
    chart.legend._fitOverridden = true;
};

crm_customization.LEGEND_MARGIN_PLUGIN = {
    id: 'legendMargin',
    beforeInit: function(chart) {
        crm_customization.apply_legend_margin(chart, 22);
    },
    beforeUpdate: function(chart) {
        crm_customization.apply_legend_margin(chart, 22);
    }
};

crm_customization.BAR_VALUE_PLUGIN = {
    id: 'barValuesAbove',
    afterDatasetsDraw: function(chart) {
        var ctx = chart.ctx;
        chart.data.datasets.forEach(function(dataset, i) {
            var meta = chart.getDatasetMeta(i);
            if (meta.hidden) return;
            meta.data.forEach(function(element, index) {
                var val = dataset.data[index];
                if (val !== null && val !== undefined && val > 0) {
                    ctx.save();
                    ctx.fillStyle = '#0f172a';
                    ctx.font = '700 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    ctx.fillText(String(val), element.x, element.y - 3);
                    ctx.restore();
                }
            });
        });
    }
};

crm_customization.show_chart_error = function() {
    // Note: keep the <canvas> in place. If Chart.js loads later the
    // charts still draw, so the message is only appended, never replacing.
    ['pipeline', 'reg_vs_pq', 'progress'].forEach(function(name) {
        var el = document.getElementById('amb-chart-' + name + '-container');
        if (el && !el.querySelector('.amb-chart-error')) {
            var note = document.createElement('div');
            note.className = 'amb-chart-error';
            note.textContent = 'Chart library unavailable - use the Table view for this data.';
            el.appendChild(note);
        }
    });
};

crm_customization.AlessaManagementBDDashboard = class {
    constructor(page) {
        this.ATTENTION_LABELS = ["Overdue Actions", "Due Next 14 Days", "High Priority", "Stale Follow-up >30d"];
        this.ATTENTION_COLORS = ["#ef4444", "#f59e0b", "#10b981", "#2563eb"];

        this.page = page;
        this.filters = {};
        this.charts = {};
        this.dashboard_data = {};
        this.active_tab = 'priority_actions';
        this.current_page = 1;
        this.page_length = 10;

        this.add_css();
        this.setup_page();
        this.load_filter_options();
        this.load_dashboard_data();
        this.bind_events();
    }

    add_css() {
        if ($('#amb-custom-style').length) return;

        var style = `
        <style id="amb-custom-style">
            body[data-route="alessa_management_bd"] .page-head,
            body[data-route="alessa-management-bd"] .page-head {
                display: none !important;
            }

            body[data-route="alessa_management_bd"] .page-body,
            body[data-route="alessa_management_bd"] .layout-main,
            body[data-route="alessa_management_bd"] .layout-main-section-wrapper,
            body[data-route="alessa_management_bd"] .layout-main-section,
            body[data-route="alessa_management_bd"] .page-wrapper,
            body[data-route="alessa_management_bd"] .page-content,
            body[data-route="alessa-management-bd"] .page-body,
            body[data-route="alessa-management-bd"] .layout-main,
            body[data-route="alessa-management-bd"] .layout-main-section-wrapper,
            body[data-route="alessa-management-bd"] .layout-main-section,
            body[data-route="alessa-management-bd"] .page-wrapper,
            body[data-route="alessa-management-bd"] .page-content,
            .layout-main-section-wrapper,
            .layout-main-section {
                max-width: none !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
            }

            .layout-main-section > .page-form { display: none !important; }

            .amb-dashboard-wrapper {
                width: 100% !important;
                max-width: 100% !important;
                box-sizing: border-box;
                padding: 20px 30px 50px 30px;
                background-color: #f8fafc;
                min-height: 100vh;
                font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }

            .amb-header {
                margin-bottom: 18px;
            }
            .amb-title {
                font-size: 20px;
                font-weight: 700;
                color: #1e293b;
                margin: 0;
            }

            /* Filter Card */
            .amb-filter-card {
                background: #ffffff;
                border: 1px solid #e2e8f0;
                border-radius: 10px;
                padding: 18px 22px;
                margin-bottom: 22px;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
            }
            .amb-filter-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 16px;
            }
            .amb-filter-title {
                font-size: 15px;
                font-weight: 700;
                color: #1e293b;
            }
            .amb-filter-actions {
                display: flex;
                gap: 10px;
            }
            .amb-btn-apply {
                background-color: #2563eb;
                color: #ffffff;
                border: none;
                border-radius: 6px;
                padding: 8px 20px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                transition: background-color 0.2s;
            }
            .amb-btn-apply:hover {
                background-color: #1d4ed8;
            }
            .amb-btn-reset {
                background-color: #ffffff;
                color: #475569;
                border: 1px solid #cbd5e1;
                border-radius: 6px;
                padding: 8px 18px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                transition: background-color 0.2s, border-color 0.2s;
            }
            .amb-btn-reset:hover {
                background-color: #f1f5f9;
                border-color: #94a3b8;
            }
            .amb-filter-grid {
                display: grid;
                grid-template-columns: repeat(6, 1fr);
                gap: 14px 14px;
            }
            @media (max-width: 1400px) {
                .amb-filter-grid {
                    grid-template-columns: repeat(3, 1fr);
                }
            }
            @media (max-width: 768px) {
                .amb-filter-grid {
                    grid-template-columns: repeat(1, 1fr);
                }
            }
            .amb-filter-group label {
                display: block;
                font-size: 10px;
                font-weight: 700;
                color: #64748b;
                letter-spacing: 0.4px;
                text-transform: uppercase;
                margin-bottom: 5px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .amb-filter-group select,
            .amb-filter-group input {
                width: 100%;
                height: 36px;
                padding: 6px 10px;
                font-size: 13px;
                color: #1e293b;
                background-color: #ffffff;
                border: 1px solid #cbd5e1;
                border-radius: 6px;
                outline: none;
                transition: border-color 0.2s, box-shadow 0.2s;
            }
            .amb-filter-group select:focus,
            .amb-filter-group input:focus {
                border-color: #2563eb;
                box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
            }

            /* Summary Cards Grid */
            .amb-cards-grid {
                display: grid;
                grid-template-columns: repeat(5, 1fr);
                gap: 14px;
                margin-bottom: 30px;
            }
            @media (max-width: 1200px) {
                .amb-cards-grid {
                    grid-template-columns: repeat(3, 1fr);
                }
            }
            @media (max-width: 640px) {
                .amb-cards-grid {
                    grid-template-columns: repeat(1, 1fr);
                }
            }
            .amb-card {
                background: #ffffff;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 14px 16px;
                position: relative;
                overflow: hidden;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
                display: flex;
                align-items: stretch;
                transition: transform 0.15s ease, box-shadow 0.15s ease;
            }
            .amb-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
            }
            .amb-card-accent {
                position: absolute;
                top: 0;
                left: 0;
                bottom: 0;
                width: 4px;
            }
            .amb-card-body {
                padding-left: 6px;
            }
            .amb-card-label {
                font-size: 10px;
                font-weight: 700;
                color: #64748b;
                letter-spacing: 0.5px;
                text-transform: uppercase;
                margin-bottom: 4px;
            }
            .amb-card-value {
                font-size: 26px;
                font-weight: 800;
                color: #0f172a;
                line-height: 1.1;
                margin-bottom: 4px;
            }
            .amb-card-subtext {
                font-size: 11px;
                color: #94a3b8;
                font-weight: 400;
            }

            /* PERFORMANCE Section */
            .amb-section-header {
                margin-bottom: 14px;
            }
            .amb-section-title {
                font-size: 13px;
                font-weight: 800;
                color: #1e3a8a;
                letter-spacing: 0.6px;
                text-transform: uppercase;
            }

            /* Graphs 2x2 Grid */
            .amb-graphs-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 20px;
                margin-bottom: 24px;
            }
            @media (max-width: 1024px) {
                .amb-graphs-grid {
                    grid-template-columns: 1fr;
                }
            }

            .amb-chart-box {
                background: #ffffff;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
                display: flex;
                flex-direction: column;
                min-height: 340px;
            }

            .amb-box-head {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 14px 18px;
                border-bottom: 1px solid #f1f5f9;
            }
            .amb-box-title {
                font-size: 14px;
                font-weight: 700;
                color: #0f172a;
            }
            .amb-box-actions {
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .amb-box-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 5px;
                background: #ffffff;
                border: 1px solid #cbd5e1;
                color: #475569;
                font-size: 12px;
                font-weight: 600;
                padding: 4px 10px;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.15s ease;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
            }
            .amb-box-btn svg {
                flex-shrink: 0;
                pointer-events: none;
            }
            .amb-box-btn:hover {
                background-color: #f8fafc;
                color: #0f172a;
                border-color: #94a3b8;
            }
            .amb-box-btn.active {
                background-color: #2563eb;
                color: #ffffff;
                border-color: #2563eb;
                box-shadow: 0 1px 3px rgba(37, 99, 235, 0.25);
            }
            .amb-box-download {
                padding: 5px 8px;
                color: #475569;
                border-radius: 6px;
            }
            .amb-box-download:hover {
                color: #2563eb;
                border-color: #2563eb;
                background-color: #eff6ff;
            }

            .amb-box-body {
                padding: 16px 18px;
                flex: 1;
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .amb-box-body canvas {
                max-width: 100%;
                max-height: 270px;
            }
            /* Chart.js with maintainAspectRatio:false needs a sized parent,
               otherwise the canvas collapses to 0 height and nothing paints. */
            .amb-box-body.amb-view-chart:not(.amb-attention-layout) {
                min-height: 250px;
                width: 100%;
                padding-top: 6px;
            }
            .amb-box-body.amb-view-chart:not(.amb-attention-layout) canvas {
                width: 100% !important;
                height: 250px !important;
            }
            .amb-attention-layout .amb-donut-wrapper,
            .amb-attention-layout canvas {
                min-height: 220px;
                height: 220px;
                max-height: 220px;
            }
            .amb-attention-layout .amb-donut-wrapper {
                flex: 0 0 220px;
                width: 220px;
            }
            .amb-attention-layout canvas {
                width: 220px !important;
            }
            .amb-chart-error {
                color: #94a3b8;
                font-size: 13px;
                text-align: center;
                padding: 20px;
            }

            #amb-owner-perf-container,
            #amb-completeness-container,
            #amb-chart-pipeline-container {
                align-items: flex-start;
                padding-top: 14px;
            }

            /* BD Pipeline Custom Progress List */
            .amb-pipeline-list {
                width: 100%;
                display: flex;
                flex-direction: column;
                gap: 12px;
                padding: 4px 0;
            }
            .amb-pipeline-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                font-size: 12px;
            }
            .amb-pipeline-left {
                display: flex;
                align-items: center;
                gap: 8px;
                width: 110px;
                min-width: 110px;
                flex-shrink: 0;
            }
            .amb-pipeline-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                flex-shrink: 0;
            }
            .amb-pipeline-label {
                font-weight: 600;
                color: #334155;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .amb-pipeline-track {
                flex: 1;
                height: 10px;
                background-color: #f1f5f9;
                border-radius: 6px;
                margin: 0 14px;
                overflow: hidden;
                position: relative;
            }
            .amb-pipeline-fill {
                height: 100%;
                border-radius: 6px;
                transition: width 0.4s ease;
            }
            .amb-pipeline-val {
                font-weight: 700;
                font-size: 12px;
                color: #0f172a;
                width: 24px;
                text-align: right;
                flex-shrink: 0;
            }

            /* Owner Performance Legend */
            .amb-owner-legend {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 6px 20px;
                margin: 0 0 14px;
                padding-bottom: 12px;
                border-bottom: 1px solid #f1f5f9;
            }
            .amb-owner-legend-item {
                display: flex;
                align-items: center;
                gap: 7px;
                font-size: 11px;
                font-weight: 600;
                color: #475569;
                white-space: nowrap;
            }
            .amb-legend-swatch {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                flex-shrink: 0;
            }

            /* Owner Performance List */
            .amb-owner-perf-list {
                width: 100%;
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            .amb-owner-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                font-size: 12px;
            }
            .amb-owner-name {
                width: 92px;
                min-width: 92px;
                flex-shrink: 0;
                font-weight: 600;
                color: #1e293b;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                text-align: left;
                padding-right: 8px;
            }
            .amb-owner-bar-wrap {
                flex: 1;
                min-width: 0;
                height: 9px;
                background-color: #cbd5e1;
                border-radius: 4px;
                margin: 0 10px;
                position: relative;
                overflow: hidden;
            }
            /* stacked segments: reg from left, pq continues after it */
            .amb-owner-bar-reg,
            .amb-owner-bar-pq {
                position: absolute;
                top: 0; bottom: 0;
            }
            .amb-owner-bar-reg {
                left: 0;
                background-color: #2563eb;
                border-radius: 4px 0 0 4px;
            }
            .amb-owner-bar-pq {
                background-color: #10b981;
            }
            .amb-owner-marker-overdue {
                position: absolute;
                top: -1px; bottom: -1px;
                width: 3px;
                margin-left: -1px;
                background-color: #ef4444;
                border-radius: 2px;
            }
            .amb-owner-total {
                width: 26px;
                min-width: 26px;
                flex-shrink: 0;
                text-align: right;
                font-weight: 700;
                font-size: 12px;
                color: #0f172a;
            }

            /* Data Completeness List */
            .amb-completeness-list {
                width: 100%;
                display: flex;
                flex-direction: column;
                gap: 14px;
            }
            .amb-comp-row {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .amb-comp-head {
                display: flex;
                justify-content: space-between;
                font-size: 12px;
                font-weight: 600;
                color: #1e293b;
            }
            .amb-comp-sub {
                font-size: 11px;
                color: #94a3b8;
                font-weight: 400;
            }
            .amb-comp-bar-track {
                width: 100%;
                height: 10px;
                background-color: #f1f5f9;
                border-radius: 5px;
                overflow: hidden;
            }
            .amb-comp-bar-fill {
                height: 100%;
                border-radius: 5px;
            }

            /* Attention Layout */
            .amb-attention-layout {
                display: flex;
                flex-direction: row;
                align-items: center;
                justify-content: space-between;
                width: 100%;
            }
            .amb-donut-wrapper {
                position: relative;
                width: 190px;
                height: 190px;
            }
            .amb-donut-center {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                text-align: center;
                pointer-events: none;
            }
            .amb-donut-number {
                font-size: 26px;
                font-weight: 800;
                color: #0f172a;
                line-height: 1;
            }
            .amb-donut-label {
                font-size: 9px;
                font-weight: 700;
                color: #64748b;
                letter-spacing: 0.5px;
                margin-top: 2px;
            }
            /* legend takes the remaining width and spreads out to fill it */
            .amb-attention-legend {
                flex: 1;
                min-width: 0;
                padding-left: 40px;
                padding-right: 12px;
                display: flex;
                flex-direction: column;
                justify-content: center;
                gap: 18px;
            }
            .amb-legend-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 20px;
                font-size: 13px;
                color: #334155;
                width: 100%;
            }
            .amb-legend-left {
                display: flex;
                align-items: center;
                gap: 10px;
                min-width: 0;
            }
            .amb-legend-dot {
                width: 12px;
                height: 12px;
                border-radius: 50%;
                display: inline-block;
                flex-shrink: 0;
            }
            .amb-legend-val {
                font-weight: 700;
                color: #0f172a;
                flex-shrink: 0;
                min-width: 34px;
                text-align: right;
            }

            /* Tabbed Table Container */
            .amb-table-section-card {
                background: #ffffff;
                border: 1px solid #e2e8f0;
                border-radius: 10px;
                padding: 18px 22px;
                margin-top: 24px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.04);
            }
            .amb-tabs-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid #f1f5f9;
                padding-bottom: 14px;
                margin-bottom: 16px;
            }
            .amb-tabs-list {
                display: flex;
                gap: 10px;
            }
            .amb-tab-btn {
                background: #f8fafc;
                color: #64748b;
                border: 1px solid #cbd5e1;
                border-radius: 6px;
                padding: 7px 16px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.15s ease;
            }
            .amb-tab-btn:hover {
                background: #f1f5f9;
                color: #1e293b;
            }
            .amb-tab-btn.active {
                background: #ffffff;
                color: #2563eb;
                border-color: #2563eb;
                box-shadow: 0 1px 2px rgba(37, 99, 235, 0.08);
            }
            .amb-tabs-actions {
                display: flex;
                align-items: center;
                gap: 12px;
                font-size: 12px;
                color: #64748b;
            }
            .amb-btn-download-csv {
                background: #ffffff;
                border: 1px solid #cbd5e1;
                color: #334155;
                padding: 5px 12px;
                border-radius: 5px;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
            }
            .amb-btn-download-csv:hover {
                background: #f8fafc;
                border-color: #94a3b8;
            }
            .amb-pagination {
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .amb-btn-page {
                background: #ffffff;
                border: 1px solid #cbd5e1;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 11px;
                cursor: pointer;
            }
            .amb-btn-page:hover {
                background: #f1f5f9;
            }

            /* Table View */
            .amb-table-wrap {
                width: 100%;
                overflow-x: auto;
            }
            .amb-data-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 12px;
            }
            .amb-data-table th {
                background: #f8fafc;
                color: #475569;
                font-weight: 600;
                text-align: left;
                padding: 10px 12px;
                border-bottom: 2px solid #e2e8f0;
                white-space: nowrap;
            }
            .amb-data-table td {
                padding: 10px 12px;
                border-bottom: 1px solid #f1f5f9;
                color: #1e293b;
                white-space: nowrap;
            }
            .amb-data-table tr:hover td {
                background: #f8fafc;
            }

            /* Badges styling */
            .amb-badge {
                display: inline-block;
                padding: 3px 10px;
                border-radius: 12px;
                font-size: 11px;
                font-weight: 600;
                text-align: center;
            }
            .amb-badge-overdue { background: #fee2e2; color: #ef4444; }
            .amb-badge-due-week { background: #dbeafe; color: #2563eb; }
            .amb-badge-completed { background: #d1fae5; color: #059669; }
            .amb-badge-process { background: #dbeafe; color: #2563eb; }
            .amb-badge-pending { background: #fef3c7; color: #d97706; }
            .amb-badge-high { background: #fef3c7; color: #d97706; }
            .amb-badge-medium { background: #e0f2fe; color: #0284c7; }
            .amb-badge-blank { color: #94a3b8; }
        </style>`;
        $('head').append(style);
    }

    setup_page() {
        $(this.page.main).empty().append(`
            <div class="amb-dashboard-wrapper">

                <!-- Header Section -->
                <div class="amb-header">
                    <h1 class="amb-title">Business Development Management Dashboard</h1>
                </div>

                <!-- Filters Section -->
                <div class="amb-filter-card">
                    <div class="amb-filter-header">
                        <span class="amb-filter-title">Dashboard Filters</span>
                        <div class="amb-filter-actions">
                            <button class="amb-btn-apply" id="amb-apply-filters">Apply Filters</button>
                            <button class="amb-btn-reset" id="amb-reset-filters">Reset</button>
                        </div>
                    </div>
                    
                    <div class="amb-filter-grid">
                        <!-- Row 1 -->
                        <div class="amb-filter-group">
                            <label>CUSTOMER (OPTIONAL)</label>
                            <select id="amb-filter-customer">
                                <option value="">All Customers</option>
                            </select>
                        </div>
                        <div class="amb-filter-group">
                            <label>SUBSIDIARY COMPANY (OPTIONAL)</label>
                            <select id="amb-filter-subsidiary">
                                <option value="">All Subsidiary Companies</option>
                            </select>
                        </div>
                        <div class="amb-filter-group">
                            <label>CLIENT / SCOPE</label>
                            <input type="text" id="amb-filter-scope" placeholder="Search client or BD scope" />
                        </div>
                        <div class="amb-filter-group">
                            <label>OPPORTUNITY STAGE</label>
                            <select id="amb-filter-stage">
                                <option value="">All</option>
                            </select>
                        </div>
                        <div class="amb-filter-group">
                            <label>REGISTRATION STATUS</label>
                            <select id="amb-filter-reg-status">
                                <option value="">All</option>
                            </select>
                        </div>
                        <div class="amb-filter-group">
                            <label>PQ STATUS</label>
                            <select id="amb-filter-pq-status">
                                <option value="">All</option>
                            </select>
                        </div>

                        <!-- Row 2 -->
                        <div class="amb-filter-group">
                            <label>CLIENT CATEGORY</label>
                            <select id="amb-filter-category">
                                <option value="">All</option>
                            </select>
                        </div>
                        <div class="amb-filter-group">
                            <label>ASSIGNED TO</label>
                            <select id="amb-filter-assigned">
                                <option value="">All</option>
                            </select>
                        </div>
                        <div class="amb-filter-group">
                            <label>PRIORITY</label>
                            <select id="amb-filter-priority">
                                <option value="">All</option>
                            </select>
                        </div>
                        <div class="amb-filter-group">
                            <label>ACTIVITY MONTH</label>
                            <select id="amb-filter-month">
                                <option value="">All</option>
                                <option>January</option><option>February</option><option>March</option>
                                <option>April</option><option>May</option><option>June</option>
                                <option>July</option><option>August</option><option>September</option>
                                <option>October</option><option>November</option><option>December</option>
                            </select>
                        </div>
                        <div class="amb-filter-group">
                            <label>FROM DATE</label>
                            <input type="date" id="amb-filter-from-date" placeholder="dd/mm/yyyy" />
                        </div>
                        <div class="amb-filter-group">
                            <label>TO DATE</label>
                            <input type="date" id="amb-filter-to-date" placeholder="dd/mm/yyyy" />
                        </div>
                    </div>
                </div>

                <!-- Summary Cards Grid (2 rows x 5 columns) -->
                <div class="amb-cards-grid">
                    <!-- Row 1 Cards -->
                    <div class="amb-card">
                        <div class="amb-card-accent" style="background-color: #1e293b;"></div>
                        <div class="amb-card-body">
                            <div class="amb-card-label">CLIENTS / RECORDS</div>
                            <div class="amb-card-value" id="stat-clients-records">0</div>
                            <div class="amb-card-subtext">Filtered master records</div>
                        </div>
                    </div>

                    <div class="amb-card">
                        <div class="amb-card-accent" style="background-color: #10b981;"></div>
                        <div class="amb-card-body">
                            <div class="amb-card-label">REG. COMPLETED</div>
                            <div class="amb-card-value" id="stat-reg-completed">0</div>
                            <div class="amb-card-subtext">Registration status completed</div>
                        </div>
                    </div>

                    <div class="amb-card">
                        <div class="amb-card-accent" style="background-color: #3b82f6;"></div>
                        <div class="amb-card-body">
                            <div class="amb-card-label">PQ COMPLETED</div>
                            <div class="amb-card-value" id="stat-pq-completed">0</div>
                            <div class="amb-card-subtext">PQ status completed</div>
                        </div>
                    </div>

                    <div class="amb-card">
                        <div class="amb-card-accent" style="background-color: #f97316;"></div>
                        <div class="amb-card-body">
                            <div class="amb-card-label">RFQ ACTIVE</div>
                            <div class="amb-card-value" id="stat-rfq-active">0</div>
                            <div class="amb-card-subtext">RFQ invitation checked</div>
                        </div>
                    </div>

                    <div class="amb-card">
                        <div class="amb-card-accent" style="background-color: #8b5cf6;"></div>
                        <div class="amb-card-body">
                            <div class="amb-card-label">DIRECT</div>
                            <div class="amb-card-value" id="stat-direct">0</div>
                            <div class="amb-card-subtext">Direct invitation checked</div>
                        </div>
                    </div>

                    <!-- Row 2 Cards -->
                    <div class="amb-card">
                        <div class="amb-card-accent" style="background-color: #ef4444;"></div>
                        <div class="amb-card-body">
                            <div class="amb-card-label">OVERDUE ACTIONS</div>
                            <div class="amb-card-value" id="stat-overdue-actions">0</div>
                            <div class="amb-card-subtext">Target date passed</div>
                        </div>
                    </div>

                    <div class="amb-card">
                        <div class="amb-card-accent" style="background-color: #f59e0b;"></div>
                        <div class="amb-card-body">
                            <div class="amb-card-label">DUE NEXT 14 DAYS</div>
                            <div class="amb-card-value" id="stat-due-next-14">0</div>
                            <div class="amb-card-subtext">Upcoming target dates</div>
                        </div>
                    </div>

                    <div class="amb-card">
                        <div class="amb-card-accent" style="background-color: #a855f7;"></div>
                        <div class="amb-card-body">
                            <div class="amb-card-label">HIGH PRIORITY</div>
                            <div class="amb-card-value" id="stat-high-priority">0</div>
                            <div class="amb-card-subtext">Immediate attention</div>
                        </div>
                    </div>

                    <div class="amb-card">
                        <div class="amb-card-accent" style="background-color: #14b8a6;"></div>
                        <div class="amb-card-body">
                            <div class="amb-card-label">REG. PENDING</div>
                            <div class="amb-card-value" id="stat-reg-pending">0</div>
                            <div class="amb-card-subtext">In process or pending approval</div>
                        </div>
                    </div>

                    <div class="amb-card">
                        <div class="amb-card-accent" style="background-color: #6366f1;"></div>
                        <div class="amb-card-body">
                            <div class="amb-card-label">PQ PENDING</div>
                            <div class="amb-card-value" id="stat-pq-pending">0</div>
                            <div class="amb-card-subtext">In process or pending approval</div>
                        </div>
                    </div>
                </div>

                <!-- PERFORMANCE Section -->
                <div class="amb-section-header">
                    <span class="amb-section-title">PERFORMANCE</span>
                </div>

                <!-- Graphs 2x2 Grid -->
                <div class="amb-graphs-grid">

                    <!-- Box 1: BD Pipeline -->
                    <div class="amb-chart-box" data-box="pipeline" style="border-top: 3px solid #2563eb;">
                        <div class="amb-box-head">
                            <span class="amb-box-title">BD Pipeline</span>
                            <div class="amb-box-actions">
                                <button class="amb-box-btn amb-box-download" title="Download Image">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                </button>
                                <button class="amb-box-btn amb-btn-chart active" title="Chart View">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                                    <span>Chart</span>
                                </button>
                                <button class="amb-box-btn amb-btn-table" title="Table View">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line></svg>
                                    <span>Table</span>
                                </button>
                            </div>
                        </div>
                        <div class="amb-box-body amb-view-chart" id="amb-chart-pipeline-container">
                            <canvas id="amb-chart-pipeline"></canvas>
                        </div>
                        <div class="amb-box-body amb-view-table" id="amb-table-pipeline" style="display:none;"></div>
                    </div>

                    <!-- Box 2: Registration vs PQ Status -->
                    <div class="amb-chart-box" data-box="reg_vs_pq" style="border-top: 3px solid #10b981;">
                        <div class="amb-box-head">
                            <span class="amb-box-title">Registration vs PQ Status</span>
                            <div class="amb-box-actions">
                                <button class="amb-box-btn amb-box-download" title="Download Image">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                </button>
                                <button class="amb-box-btn amb-btn-chart active" title="Chart View">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                                    <span>Chart</span>
                                </button>
                                <button class="amb-box-btn amb-btn-table" title="Table View">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line></svg>
                                    <span>Table</span>
                                </button>
                            </div>
                        </div>
                        <div class="amb-box-body amb-view-chart" id="amb-chart-reg-vs-pq-container">
                            <canvas id="amb-chart-reg-vs-pq"></canvas>
                        </div>
                        <div class="amb-box-body amb-view-table" id="amb-table-reg-vs-pq" style="display:none;"></div>
                    </div>

                    <!-- Box 3: Management Attention -->
                    <div class="amb-chart-box" data-box="attention" style="border-top: 3px solid #8b5cf6;">
                        <div class="amb-box-head">
                            <span class="amb-box-title">Management Attention</span>
                            <div class="amb-box-actions">
                                <button class="amb-box-btn amb-box-download" title="Download Image">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                </button>
                                <button class="amb-box-btn amb-btn-chart active" title="Chart View">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                                    <span>Chart</span>
                                </button>
                                <button class="amb-box-btn amb-btn-table" title="Table View">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line></svg>
                                    <span>Table</span>
                                </button>
                            </div>
                        </div>
                        <div class="amb-box-body amb-view-chart amb-attention-layout" id="amb-chart-attention-container">
                            <div class="amb-donut-wrapper">
                                <canvas id="amb-chart-attention"></canvas>
                                <div class="amb-donut-center">
                                    <div class="amb-donut-number" id="amb-signals-total">0</div>
                                    <div class="amb-donut-label">SIGNALS</div>
                                </div>
                            </div>
                            <div class="amb-attention-legend" id="amb-attention-legend-list"></div>
                        </div>
                        <div class="amb-box-body amb-view-table" id="amb-table-attention" style="display:none;"></div>
                    </div>

                    <!-- Box 4: Monthly Progress -->
                    <div class="amb-chart-box" data-box="progress" style="border-top: 3px solid #f59e0b;">
                        <div class="amb-box-head">
                            <span class="amb-box-title">Monthly Progress</span>
                            <div class="amb-box-actions">
                                <button class="amb-box-btn amb-box-download" title="Download Image">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                </button>
                                <button class="amb-box-btn amb-btn-chart active" title="Chart View">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                                    <span>Chart</span>
                                </button>
                                <button class="amb-box-btn amb-btn-table" title="Table View">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line></svg>
                                    <span>Table</span>
                                </button>
                            </div>
                        </div>
                        <div class="amb-box-body amb-view-chart" id="amb-chart-progress-container">
                            <canvas id="amb-chart-progress"></canvas>
                        </div>
                        <div class="amb-box-body amb-view-table" id="amb-table-progress" style="display:none;"></div>
                    </div>

                </div>

                <!-- Owner Performance & Data Completeness Row -->
                <div class="amb-graphs-grid">

                    <!-- Owner Performance Box -->
                    <div class="amb-chart-box" data-box="owner_perf" style="border-top: 3px solid #10b981;">
                        <div class="amb-box-head">
                            <span class="amb-box-title">Owner Performance</span>
                            <div class="amb-box-actions">
                                <button class="amb-box-btn amb-box-download" title="Download Image">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                </button>
                                <button class="amb-box-btn amb-btn-chart active" title="Chart View">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                                    <span>Chart</span>
                                </button>
                                <button class="amb-box-btn amb-btn-table" title="Table View">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line></svg>
                                    <span>Table</span>
                                </button>
                            </div>
                        </div>
                        <div class="amb-box-body amb-view-chart" id="amb-owner-perf-container">
                            <div class="amb-owner-perf-list" id="amb-owner-perf-list"></div>
                        </div>
                        <div class="amb-box-body amb-view-table" id="amb-table-owner-perf" style="display:none;"></div>
                    </div>

                    <!-- Data Completeness Box -->
                    <div class="amb-chart-box" data-box="data_completeness" style="border-top: 3px solid #ef4444;">
                        <div class="amb-box-head">
                            <span class="amb-box-title">Data Completeness</span>
                            <div class="amb-box-actions">
                                <button class="amb-box-btn amb-box-download" title="Download Image">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                </button>
                                <button class="amb-box-btn amb-btn-chart active" title="Chart View">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                                    <span>Chart</span>
                                </button>
                                <button class="amb-box-btn amb-btn-table" title="Table View">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line></svg>
                                    <span>Table</span>
                                </button>
                            </div>
                        </div>
                        <div class="amb-box-body amb-view-chart" id="amb-completeness-container">
                            <div class="amb-completeness-list" id="amb-completeness-list"></div>
                        </div>
                        <div class="amb-box-body amb-view-table" id="amb-table-completeness" style="display:none;"></div>
                    </div>

                </div>

                <!-- Tabbed Data Table Container -->
                <div class="amb-table-section-card">
                    <div class="amb-tabs-header">
                        <div class="amb-tabs-list">
                            <button class="amb-tab-btn active" data-tab="priority_actions">Priority Actions</button>
                            <button class="amb-tab-btn" data-tab="registration_qualification">Registration &amp; Qualification</button>
                            <button class="amb-tab-btn" data-tab="business_request_insights">Business Request Insights</button>
                        </div>
                        <div class="amb-tabs-actions">
                            <span id="amb-records-count">115 actionable records</span>
                            <button class="amb-btn-download-csv" id="amb-download-csv">Download CSV</button>
                            <div class="amb-pagination">
                                <button class="amb-btn-page" id="amb-page-prev">Prev</button>
                                <span id="amb-page-info">Page 1/10</span>
                                <button class="amb-btn-page" id="amb-page-next">Next</button>
                            </div>
                        </div>
                    </div>

                    <!-- Tab Contents Container -->
                    <div class="amb-table-wrap" id="amb-tab-content-area">
                        <!-- Priority Actions Table -->
                        <table class="amb-data-table" id="amb-priority-actions-table">
                            <thead>
                                <tr>
                                    <th>CLIENT</th>
                                    <th>SCOPE</th>
                                    <th>OWNER</th>
                                    <th>PRIORITY</th>
                                    <th>STAGE</th>
                                    <th>REGISTRATION</th>
                                    <th>PQ</th>
                                    <th>LAST FOLLOW-UP</th>
                                    <th>NEXT ACTION</th>
                                    <th>TARGET DATE</th>
                                    <th>DAYS TO DUE</th>
                                    <th>ACTION STATUS</th>
                                </tr>
                            </thead>
                            <tbody id="amb-priority-actions-tbody"></tbody>
                        </table>
                    </div>
                </div>

            </div>
        `);
    }

    load_filter_options() {
        var me = this;
        frappe.call({
            method: 'crm_customization.crm_customization.page.alessa_management_bd.alessa_management_bd.get_filter_options',
            callback: function(r) {
                if (r.message) {
                    var opts = r.message;

                    var $cust = $('#amb-filter-customer').empty().append('<option value="">All Customers</option>');
                    (opts.customers || []).forEach(function(c) {
                        $cust.append($('<option>', { value: c, text: c }));
                    });

                    var $sub = $('#amb-filter-subsidiary').empty().append('<option value="">All Subsidiary Companies</option>');
                    (opts.subsidiaries || []).forEach(function(s) {
                        $sub.append($('<option>', { value: s, text: s }));
                    });

                    var $stg = $('#amb-filter-stage').empty().append('<option value="">All</option>');
                    (opts.stages || []).forEach(function(st) {
                        $stg.append($('<option>', { value: st, text: st }));
                    });

                    var $reg = $('#amb-filter-reg-status').empty().append('<option value="">All</option>');
                    (opts.registration_statuses || []).forEach(function(rs) {
                        $reg.append($('<option>', { value: rs, text: rs }));
                    });

                    var $pq = $('#amb-filter-pq-status').empty().append('<option value="">All</option>');
                    (opts.pq_statuses || []).forEach(function(pq) {
                        $pq.append($('<option>', { value: pq, text: pq }));
                    });

                    var $cat = $('#amb-filter-category').empty().append('<option value="">All</option>');
                    (opts.categories || []).forEach(function(cat) {
                        $cat.append($('<option>', { value: cat, text: cat }));
                    });

                    var $usr = $('#amb-filter-assigned').empty().append('<option value="">All</option>');
                    (opts.users || []).forEach(function(u) {
                        $usr.append($('<option>', { value: u.name, text: u.full_name || u.name }));
                    });

                    var $prio = $('#amb-filter-priority').empty().append('<option value="">All</option>');
                    (opts.priorities || []).forEach(function(p) {
                        $prio.append($('<option>', { value: p, text: p }));
                    });
                }
            }
        });
    }

    get_filter_values() {
        return {
            customer: $('#amb-filter-customer').val(),
            subsidiary_company: $('#amb-filter-subsidiary').val(),
            client_scope: $('#amb-filter-scope').val(),
            opportunity_stage: $('#amb-filter-stage').val(),
            registration_status: $('#amb-filter-reg-status').val(),
            pq_status: $('#amb-filter-pq-status').val(),
            client_category: $('#amb-filter-category').val(),
            assigned_to: $('#amb-filter-assigned').val(),
            priority: $('#amb-filter-priority').val(),
            activity_month: $('#amb-filter-month').val(),
            from_date: $('#amb-filter-from-date').val(),
            to_date: $('#amb-filter-to-date').val()
        };
    }

    load_dashboard_data() {
        var me = this;
        var current_filters = this.get_filter_values();

        frappe.call({
            method: 'crm_customization.crm_customization.page.alessa_management_bd.alessa_management_bd.get_dashboard_data',
            args: { filters: current_filters },
            callback: function(r) {
                if (r && r.message) {
                    var data = r.message;
                    me.dashboard_data = data;

                    // Summary cards
                    $('#stat-clients-records').text(data.clients_records || 0);
                    $('#stat-reg-completed').text(data.reg_completed || 0);
                    $('#stat-pq-completed').text(data.pq_completed || 0);
                    $('#stat-rfq-active').text(data.rfq_active || 0);
                    $('#stat-direct').text(data.direct || 0);
                    $('#stat-overdue-actions').text(data.overdue_actions || 0);
                    $('#stat-due-next-14').text(data.due_next_14 || 0);
                    $('#stat-high-priority').text(data.high_priority || 0);
                    $('#stat-reg-pending').text(data.reg_pending || 0);
                    $('#stat-pq-pending').text(data.pq_pending || 0);

                    // Table / HTML based sections
                    me.render_bd_pipeline_table(data.pipeline);
                    me.render_reg_vs_pq_table(data.reg_vs_pq);
                    me.render_management_attention_legend(data.management_attention);
                    me.render_monthly_progress_table(data.monthly_progress);
                    me.render_owner_performance(data.owner_performance);
                    me.render_data_completeness(data.data_completeness);

                    // Priority Actions tab — rebuild table and reset to page 1
                    if (me.active_tab === 'priority_actions') {
                        // Ensure the priority actions table is present in the DOM
                        if (!$('#amb-priority-actions-tbody').length) {
                            $('#amb-tab-content-area').html(
                                '<table class="amb-data-table" id="amb-priority-actions-table">' +
                                '<thead><tr>' +
                                '<th>CLIENT</th><th>SCOPE</th><th>OWNER</th><th>PRIORITY</th><th>STAGE</th>' +
                                '<th>REGISTRATION</th><th>PQ</th><th>LAST FOLLOW-UP</th>' +
                                '<th>NEXT ACTION</th><th>TARGET DATE</th><th>DAYS TO DUE</th><th>ACTION STATUS</th>' +
                                '</tr></thead><tbody id="amb-priority-actions-tbody"></tbody></table>'
                            );
                        }
                        me.render_priority_actions_table(data.priority_actions);
                    } else if (me.active_tab === 'registration_qualification') {
                        // Reload the active report tab with new filters
                        me.load_query_report('Registration and Qualification', '#amb-tab-content-area');
                    } else if (me.active_tab === 'business_request_insights') {
                        // Reload the active report tab with new filters, reset to page 1
                        me.load_query_report('Business Request Insights', '#amb-tab-content-area');
                    }
                }

                // Charts last, each guarded independently
                me.render_all_charts();
            },
            error: function() {
                frappe.msgprint({
                    title: __('Error'),
                    message: __('Failed to load dashboard data.'),
                    indicator: 'red'
                });
            }
        });
    }

    /* -------------------------------------------------------------
       Render every chart from the cached dashboard payload.
       Each chart is isolated so one failure cannot blank the page.
    ------------------------------------------------------------- */
    render_all_charts() {
        var data = this.dashboard_data || {};
        var jobs = [
            ['pipeline', () => this.render_bd_pipeline_chart(data.pipeline)],
            ['reg_vs_pq', () => this.render_reg_vs_pq_chart(data.reg_vs_pq)],
            ['attention', () => this.render_management_attention_chart(data.management_attention)],
            ['progress', () => this.render_monthly_progress_chart(data.monthly_progress)]
        ];

        if (!window.Chart) {
            crm_customization.show_chart_error();
            return;
        }

        // library is available now - drop any earlier "unavailable" note
        $('.amb-chart-error').remove();

        jobs.forEach(([name, fn]) => {
            try {
                fn();
            } catch (e) {
                console.error('ALESSA dashboard: chart "' + name + '" failed', e);
            }
        });
    }

    /* -------------------------------------------------------------
       Owner Performance Render
    ------------------------------------------------------------- */
    render_owner_performance(owner_data) {
        if (!owner_data) return;
        var html = '';
        var table_html = `<table class="amb-data-table"><thead><tr><th>Owner</th><th>Assigned</th><th>Reg. Completed</th><th>PQ Completed</th><th>Overdue</th></tr></thead><tbody>`;

        owner_data.forEach(function(o) {
            var assigned = o.assigned || 0;
            var reg = o.reg_completed || 0;
            var pq = o.pq_completed || 0;
            var overdue = o.overdue || 0;

            // both segments share one track, so cap their combined width at 100%
            var reg_pct = assigned ? Math.min((reg / assigned) * 100, 100) : 0;
            var pq_pct = assigned ? Math.min((pq / assigned) * 100, 100 - reg_pct) : 0;
            var overdue_pct = assigned ? Math.min((overdue / assigned) * 100, 99) : 0;

            html += `
                <div class="amb-owner-row" title="${o.name} &middot; Assigned ${assigned} &middot; Reg Completed ${reg} &middot; PQ Completed ${pq} &middot; Overdue ${overdue}">
                    <span class="amb-owner-name">${o.name}</span>
                    <div class="amb-owner-bar-wrap">
                        <div class="amb-owner-bar-reg" style="width: ${reg_pct}%;"></div>
                        <div class="amb-owner-bar-pq" style="left: ${reg_pct}%; width: ${pq_pct}%;"></div>
                        ${overdue ? `<div class="amb-owner-marker-overdue" style="left: ${overdue_pct}%;"></div>` : ''}
                    </div>
                    <span class="amb-owner-total">${assigned}</span>
                </div>`;

            table_html += `<tr><td><b>${o.name}</b></td><td>${assigned}</td><td>${reg}</td><td>${pq}</td><td>${overdue}</td></tr>`;
        });

        var legend = [
            { label: 'Assigned', color: '#cbd5e1' },
            { label: 'Reg Completed', color: '#2563eb' },
            { label: 'PQ Completed', color: '#10b981' },
            { label: 'Overdue', color: '#ef4444' }
        ].map(function(item) {
            return `<div class="amb-owner-legend-item">
                        <span class="amb-legend-swatch" style="background-color: ${item.color};"></span>
                        <span>${item.label}</span>
                    </div>`;
        }).join('');

        html = `<div class="amb-owner-legend">${legend}</div>` + html;

        table_html += `</tbody></table>`;

        $('#amb-owner-perf-list').html(html);
        $('#amb-table-owner-perf').html(table_html);
    }

    /* -------------------------------------------------------------
       Data Completeness Render
    ------------------------------------------------------------- */
    render_data_completeness(comp_data) {
        if (!comp_data) return;

        var html = '';
        var table_html = `<table class="amb-data-table"><thead><tr><th>Field Name</th><th>Missing Count</th><th>Completeness %</th></tr></thead><tbody>`;

        (comp_data.fields || []).forEach(function(f) {
            html += `
                <div class="amb-comp-row">
                    <div class="amb-comp-head">
                        <span>${f.field}</span>
                        <span>${f.percentage}%</span>
                    </div>
                    <div class="amb-comp-sub">${f.missing} missing</div>
                    <div class="amb-comp-bar-track">
                        <div class="amb-comp-bar-fill" style="width: ${f.percentage}%; background-color: ${f.color || '#2563eb'};"></div>
                    </div>
                </div>`;

            table_html += `<tr><td><b>${f.field}</b></td><td>${f.missing}</td><td>${f.percentage}%</td></tr>`;
        });

        table_html += `</tbody></table>`;

        $('#amb-completeness-list').html(html);
        $('#amb-table-completeness').html(table_html);
    }

    /* -------------------------------------------------------------
       Priority Actions Table Render & Pagination
    ------------------------------------------------------------- */
    render_priority_actions_table(records) {
        records = records || [];
        this.all_priority_records = records;

        var total = records.length;
        var total_pages = Math.ceil(total / this.page_length) || 1;
        if (this.current_page > total_pages) this.current_page = 1;

        // Only update count/pagination controls when this tab is active
        if (this.active_tab === 'priority_actions') {
            $('#amb-records-count').text(total + ' actionable records');
            $('#amb-page-info').text('Page ' + this.current_page + '/' + total_pages);
        }

        var start = (this.current_page - 1) * this.page_length;
        var paged_recs = records.slice(start, start + this.page_length);

        var tbody = '';
        paged_recs.forEach(function(r) {
            var prio_badge = r.priority === 'High' ? '<span class="amb-badge amb-badge-high">High</span>' :
                            (r.priority === 'Medium' ? '<span class="amb-badge amb-badge-medium">Medium</span>' : '<span class="amb-badge amb-badge-blank">' + (r.priority || 'Blank') + '</span>');

            var stage_badge = '<span class="amb-badge amb-badge-pending">' + (r.stage || '-') + '</span>';

            // Registration badge — render any status value the server returns
            var reg_val = r.registration || 'Blank';
            var reg_cls = reg_val === 'Completed' ? 'amb-badge-completed' :
                          (reg_val === 'In Process' ? 'amb-badge-process' :
                          (reg_val === 'Pending Approval' ? 'amb-badge-pending' :
                          (reg_val === 'Blank' ? 'amb-badge-blank' : 'amb-badge-blank')));
            var reg_badge = '<span class="amb-badge ' + reg_cls + '">' + reg_val + '</span>';

            // PQ badge — render any status value the server returns
            var pq_val = r.pq || 'Blank';
            var pq_cls = pq_val === 'Completed' ? 'amb-badge-completed' :
                         (pq_val === 'In Process' ? 'amb-badge-process' :
                         (pq_val === 'Not Qualified' ? 'amb-badge-overdue' :
                         (pq_val === 'Pending Approval' ? 'amb-badge-pending' :
                         (pq_val === 'Blank' ? 'amb-badge-blank' : 'amb-badge-blank'))));
            var pq_badge = '<span class="amb-badge ' + pq_cls + '">' + pq_val + '</span>';

            // Action status badge — use server-returned value exactly
            var act_badge;
            if (r.action_status === 'Overdue') {
                act_badge = '<span class="amb-badge amb-badge-overdue">Overdue</span>';
            } else if (r.action_status === 'Due This Week') {
                act_badge = '<span class="amb-badge amb-badge-due-week">Due This Week</span>';
            } else if (r.action_status === 'Due Next 14 Days') {
                act_badge = '<span class="amb-badge amb-badge-pending">Due Next 14 Days</span>';
            } else if (r.action_status === 'Upcoming') {
                act_badge = '<span class="amb-badge amb-badge-medium">Upcoming</span>';
            } else {
                act_badge = '<span class="amb-badge amb-badge-blank">' + (r.action_status || 'No Due Date') + '</span>';
            }

            tbody += '<tr>' +
                '<td><a href="/app/customer/' + encodeURIComponent(r.client) + '" style="color: #2563eb; font-weight: 600; text-decoration: none;">' + r.client + '</a></td>' +
                '<td>' + r.scope + '</td>' +
                '<td>' + r.owner + '</td>' +
                '<td>' + prio_badge + '</td>' +
                '<td>' + stage_badge + '</td>' +
                '<td>' + reg_badge + '</td>' +
                '<td>' + pq_badge + '</td>' +
                '<td>' + (r.last_followup || '-') + '</td>' +
                '<td>' + (r.next_action || '-') + '</td>' +
                '<td>' + r.target_date + '</td>' +
                '<td><b>' + (r.days_to_due !== '' && r.days_to_due !== null && r.days_to_due !== undefined ? r.days_to_due : '-') + '</b></td>' +
                '<td>' + act_badge + '</td>' +
                '</tr>';
        });

        $('#amb-priority-actions-tbody').html(tbody);
    }

    /* -------------------------------------------------------------
       Load Query Report for Tabs 2 & 3
    ------------------------------------------------------------- */
    get_report_filters(report_name) {
        var f = this.get_filter_values();
        var rf = {};
        if (report_name === 'Business Request Insights') {
            // Field name mapping: subsidairy_company (with typo) is the actual ERPNext field
            if (f.customer) rf.customer = f.customer;
            if (f.subsidiary_company) rf.subsidairy_company = f.subsidiary_company;
            if (f.client_category) rf.request_category = f.client_category;
            if (f.priority) rf.priority = f.priority;
            // Date filter mapping: from_date -> planned_from, to_date -> planned_to
            if (f.from_date) rf.planned_from = f.from_date;
            if (f.to_date) rf.planned_to = f.to_date;
            if (f.activity_month && f.activity_month !== 'All') rf.activity_month = f.activity_month;
            return rf;
        }
        if (report_name === 'Registration and Qualification') {
            // Always supply period_type and year so the report returns data
            rf.period_type = 'Yearly';
            rf.year = new Date().getFullYear();
            if (f.subsidiary_company) rf.subsidiary_company = f.subsidiary_company;
            if (f.customer) rf.customer = f.customer;
            if (f.client_category) rf.client_category = f.client_category;
            if (f.opportunity_stage) rf.stage = f.opportunity_stage;
            if (f.registration_status) rf.registration_status = f.registration_status;
            if (f.pq_status) rf.pq_status = f.pq_status;
            return rf;
        }
        return f;
    }

    load_query_report(report_name, container_id) {
        var me = this;
        $(container_id).html('<div style="padding: 20px; text-align: center; color: #64748b;">Loading report data...</div>');

        frappe.call({
            method: 'frappe.desk.query_report.run',
            args: { report_name: report_name, filters: me.get_report_filters(report_name) },
            callback: function(r) {
                var cols = [];
                var rows = [];
                if (r && r.message) {
                    cols = r.message.columns || [];
                    // Filter out subtotal/total rows (arrays with empty first cell)
                    rows = (r.message.result || []).filter(function(row) {
                        if (Array.isArray(row)) return row[0] !== '' && row[0] !== null && row[0] !== undefined;
                        return true;
                    });
                }

                me.active_report = { type: report_name, rows: rows, cols: cols };
                me.current_page = 1;

                // Update tab controls to reflect this report
                $('#amb-records-count').text(rows.length + ' report records');
                $('#amb-page-info').text('');

                var html = '<table class="amb-data-table"><thead><tr>';
                cols.forEach(function(c) {
                    var label = typeof c === 'object' ? (c.label || c.fieldname) : c;
                    html += '<th>' + label + '</th>';
                });
                html += '</tr></thead><tbody>';

                rows.forEach(function(row) {
                    html += '<tr>';
                    cols.forEach(function(c, ci) {
                        var key = typeof c === 'object' ? c.fieldname : c;
                        var fieldtype = typeof c === 'object' ? c.fieldtype : null;
                        var options = typeof c === 'object' ? c.options : null;
                        var val;
                        if (Array.isArray(row)) {
                            val = row[ci];
                        } else {
                            val = (row[key] !== undefined && row[key] !== null) ? row[key] : '';
                        }
                        var linkable = fieldtype === 'Link' && options && frappe.utils.get_form_link && key !== 'request_category';
                        if (val !== null && val !== undefined && val !== '' && linkable) {
                            var href = frappe.utils.get_form_link(options, String(val));
                            html += '<td><a href="' + href + '" style="color: #2563eb; font-weight: 600; text-decoration: none;">' + val + '</a></td>';
                        } else {
                            html += '<td>' + (val !== null && val !== undefined ? val : '') + '</td>';
                        }
                    });
                    html += '</tr>';
                });

                html += '</tbody></table>';
                $(container_id).html(html);
            }
        });
    }

    /* -------------------------------------------------------------
       Performance Charts
    ------------------------------------------------------------- */
    render_bd_pipeline_chart(pipeline_data) {
        if (!pipeline_data || !pipeline_data.categories) return;
        var container = document.getElementById('amb-chart-pipeline-container');
        if (!container) return;

        var categories = pipeline_data.categories;
        var values = pipeline_data.values || [];
        var maxVal = Math.max.apply(null, values.concat([1]));

        var colors = ['#2563eb', '#0d9488', '#d97706', '#dc2626', '#7c3aed', '#059669'];

        var html = '<div class="amb-pipeline-list">';
        categories.forEach(function(cat, idx) {
            var val = values[idx] || 0;
            var pct = Math.min((val / maxVal) * 100, 100);
            var color = colors[idx % colors.length];

            html += `
                <div class="amb-pipeline-row" title="${cat}: ${val}">
                    <div class="amb-pipeline-left">
                        <span class="amb-pipeline-dot" style="background-color: ${color};"></span>
                        <span class="amb-pipeline-label">${cat}</span>
                    </div>
                    <div class="amb-pipeline-track">
                        <div class="amb-pipeline-fill" style="width: ${pct}%; background-color: ${color};"></div>
                    </div>
                    <span class="amb-pipeline-val">${val}</span>
                </div>`;
        });
        html += '</div>';

        $(container).html(html);
    }

    render_bd_pipeline_table(pipeline_data) {
        if (!pipeline_data) return;
        var html = `<table class="amb-data-table"><thead><tr><th>Stage</th><th>Count</th></tr></thead><tbody>`;
        pipeline_data.categories.forEach((cat, idx) => {
            html += `<tr><td>${cat}</td><td><b>${pipeline_data.values[idx]}</b></td></tr>`;
        });
        html += `</tbody></table>`;
        $('#amb-table-pipeline').html(html);
    }

    render_reg_vs_pq_chart(reg_vs_pq_data) {
        if (!reg_vs_pq_data) return;
        var ctx = document.getElementById('amb-chart-reg-vs-pq');
        if (!ctx) return;
        if (this.charts.reg_vs_pq) this.charts.reg_vs_pq.destroy();

        var reg_vals = reg_vs_pq_data.registration || [];
        var pq_vals = reg_vs_pq_data.pq || [];
        var max_val = Math.max.apply(null, reg_vals.concat(pq_vals).concat([10]));

        this.charts.reg_vs_pq = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: reg_vs_pq_data.categories,
                datasets: [
                    { label: 'Registration', data: reg_vals, backgroundColor: '#2563eb', borderRadius: 3, barPercentage: 0.8, categoryPercentage: 0.7 },
                    { label: 'PQ', data: pq_vals, backgroundColor: '#ef4444', borderRadius: 3, barPercentage: 0.8, categoryPercentage: 0.7 }
                ]
            },
            plugins: [crm_customization.LEGEND_MARGIN_PLUGIN, crm_customization.BAR_VALUE_PLUGIN],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { top: 8, bottom: 4, left: 4, right: 8 } },
                plugins: {
                    legend: {
                        position: 'top',
                        align: 'start',
                        labels: Object.assign({}, crm_customization.LEGEND_LABELS, { pointStyle: 'rect', borderRadius: 2 })
                    }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { font: { size: 10, weight: '500' } } },
                    y: {
                        grid: { color: '#e2e8f0', borderDash: [3, 3] },
                        suggestedMax: Math.ceil(max_val * 1.18)
                    }
                }
            }
        });
    }

    render_reg_vs_pq_table(reg_vs_pq_data) {
        if (!reg_vs_pq_data) return;
        var html = `<table class="amb-data-table"><thead><tr><th>Status</th><th>Registration</th><th>PQ</th></tr></thead><tbody>`;
        reg_vs_pq_data.categories.forEach((cat, idx) => {
            html += `<tr><td>${cat}</td><td><b>${reg_vs_pq_data.registration[idx]}</b></td><td><b>${reg_vs_pq_data.pq[idx]}</b></td></tr>`;
        });
        html += `</tbody></table>`;
        $('#amb-table-reg-vs-pq').html(html);
    }

    render_management_attention_chart(attn_data) {
        if (!attn_data) return;
        var ctx = document.getElementById('amb-chart-attention');
        if (!ctx) return;
        if (this.charts.attention) this.charts.attention.destroy();

        var values = this.attention_values(attn_data);

        this.charts.attention = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: this.ATTENTION_LABELS, datasets: [{ data: values, backgroundColor: this.ATTENTION_COLORS, borderWidth: 2, borderColor: '#ffffff' }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '55%', plugins: { legend: { display: false } } }
        });
    }

    attention_values(attn_data) {
        return [
            attn_data.overdue_actions || 0,
            attn_data.due_next_14 || 0,
            attn_data.high_priority || 0,
            attn_data.stale_followup || 0
        ];
    }

    render_management_attention_legend(attn_data) {
        if (!attn_data) return;
        var values = this.attention_values(attn_data);
        var labels = this.ATTENTION_LABELS;
        var colors = this.ATTENTION_COLORS;

        $('#amb-signals-total').text(attn_data.total_signals || 0);

        var legend_html = '';
        labels.forEach((lbl, idx) => {
            legend_html += `<div class="amb-legend-item"><div class="amb-legend-left"><span class="amb-legend-dot" style="background-color:${colors[idx]};"></span><span>${lbl}</span></div><span class="amb-legend-val">${values[idx]}</span></div>`;
        });
        $('#amb-attention-legend-list').html(legend_html);

        var html = `<table class="amb-data-table"><thead><tr><th>Signal</th><th>Count</th></tr></thead><tbody>`;
        labels.forEach((lbl, idx) => {
            html += `<tr><td>${lbl}</td><td><b>${values[idx]}</b></td></tr>`;
        });
        html += `</tbody></table>`;
        $('#amb-table-attention').html(html);
    }

    render_monthly_progress_chart(prog_data) {
        if (!prog_data) return;
        var ctx = document.getElementById('amb-chart-progress');
        if (!ctx) return;
        if (this.charts.progress) this.charts.progress.destroy();

        this.charts.progress = new Chart(ctx, {
            type: 'line',
            data: {
                labels: prog_data.months,
                datasets: [
                    { label: 'Registration Approved', data: prog_data.reg_approved, borderColor: '#2563eb', backgroundColor: '#2563eb', borderWidth: 2, tension: 0.3 },
                    { label: 'PQ Approved', data: prog_data.pq_approved, borderColor: '#ef4444', backgroundColor: '#ef4444', borderWidth: 2, tension: 0.3 },
                    { label: 'RFQ Received', data: prog_data.rfq_received, borderColor: '#f59e0b', backgroundColor: '#f59e0b', borderWidth: 2, tension: 0.3 }
                ]
            },
            plugins: [crm_customization.LEGEND_MARGIN_PLUGIN],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { top: 0, bottom: 4 } },
                plugins: {
                    legend: {
                        position: 'top',
                        align: 'start',
                        labels: crm_customization.LEGEND_LABELS
                    }
                },
                scales: { x: { grid: { display: false } }, y: { grid: { color: '#f1f5f9' } } }
            }
        });
    }

    render_monthly_progress_table(prog_data) {
        if (!prog_data) return;
        var html = `<table class="amb-data-table"><thead><tr><th>Month</th><th>Registration Approved</th><th>PQ Approved</th><th>RFQ Received</th></tr></thead><tbody>`;
        prog_data.months.forEach((m, idx) => {
            html += `<tr><td>${m}</td><td><b>${prog_data.reg_approved[idx]}</b></td><td><b>${prog_data.pq_approved[idx]}</b></td><td><b>${prog_data.rfq_received[idx]}</b></td></tr>`;
        });
        html += `</tbody></table>`;
        $('#amb-table-progress').html(html);
    }

    bind_events() {
        var me = this;

        $('#amb-apply-filters').on('click', function() {
            me.current_page = 1;
            // Reload dashboard KPIs and charts; also reload whichever report tab is open
            me.load_dashboard_data();
        });

        $('#amb-reset-filters').on('click', function() {
            $('#amb-filter-customer').val('');
            $('#amb-filter-subsidiary').val('');
            $('#amb-filter-scope').val('');
            $('#amb-filter-stage').val('');
            $('#amb-filter-reg-status').val('');
            $('#amb-filter-pq-status').val('');
            $('#amb-filter-category').val('');
            $('#amb-filter-assigned').val('');
            $('#amb-filter-priority').val('');
            $('#amb-filter-month').val('');
            $('#amb-filter-from-date').val('');
            $('#amb-filter-to-date').val('');

            me.current_page = 1;
            me.load_dashboard_data();
        });

        // Tab Switching Logic
        $(document).on('click', '.amb-tab-btn', function() {
            $('.amb-tab-btn').removeClass('active');
            $(this).addClass('active');

            var tab = $(this).data('tab');
            me.active_tab = tab;
            me.current_page = 1;

            if (tab === 'priority_actions') {
                me.active_report = null;
                $('#amb-tab-content-area').html(`
                    <table class="amb-data-table" id="amb-priority-actions-table">
                        <thead>
                            <tr>
                                <th>CLIENT</th>
                                <th>SCOPE</th>
                                <th>OWNER</th>
                                <th>PRIORITY</th>
                                <th>STAGE</th>
                                <th>REGISTRATION</th>
                                <th>PQ</th>
                                <th>LAST FOLLOW-UP</th>
                                <th>NEXT ACTION</th>
                                <th>TARGET DATE</th>
                                <th>DAYS TO DUE</th>
                                <th>ACTION STATUS</th>
                            </tr>
                        </thead>
                        <tbody id="amb-priority-actions-tbody"></tbody>
                    </table>
                `);
                var pa = (me.dashboard_data && me.dashboard_data.priority_actions) || [];
                me.render_priority_actions_table(pa);
            } else if (tab === 'registration_qualification') {
                me.load_query_report('Registration and Qualification', '#amb-tab-content-area');
            } else if (tab === 'business_request_insights') {
                me.load_query_report('Business Request Insights', '#amb-tab-content-area');
            }
        });

        // Pagination
        // Keep charts sized correctly when the layout changes
        $(window).on('resize', () => {
            Object.keys(me.charts).forEach(function(key) {
                if (me.charts[key]) me.charts[key].resize();
            });
        });

        $('#amb-page-prev').on('click', function() {
            // Pagination only applies to Priority Actions (report tabs show all rows)
            if (me.active_tab !== 'priority_actions') return;
            if (me.current_page > 1) {
                me.current_page--;
                me.render_priority_actions_table(me.all_priority_records);
            }
        });

        $('#amb-page-next').on('click', function() {
            if (me.active_tab !== 'priority_actions') return;
            var max_pages = Math.ceil((me.all_priority_records || []).length / me.page_length) || 1;
            if (me.current_page < max_pages) {
                me.current_page++;
                me.render_priority_actions_table(me.all_priority_records);
            }
        });

        // Download CSV
        $('#amb-download-csv').on('click', function() {
            if (me.active_tab === 'priority_actions') {
                var records = me.all_priority_records || [];
                if (!records.length) return;
                var csv = 'CLIENT,SCOPE,OWNER,PRIORITY,STAGE,REGISTRATION,PQ,LAST FOLLOW-UP,NEXT ACTION,TARGET DATE,DAYS TO DUE,ACTION STATUS\n';
                records.forEach(function(r) {
                    csv += `"${r.client}","${r.scope}","${r.owner}","${r.priority}","${r.stage}","${r.registration}","${r.pq}","${r.last_followup}","${r.next_action}","${r.target_date}","${r.days_to_due}","${r.action_status}"\n`;
                });
                var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                var link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = 'Priority_Actions.csv';
                link.click();
                return;
            }
            var ar = me.active_report || {};
            var rows = ar.rows || [];
            var cols = ar.cols || [];
            if (!rows.length) return;
            var headers = [];
            cols.forEach(function(c) {
                headers.push(typeof c === 'object' ? (c.label || c.fieldname || '') : c);
            });
            var csvLines = [headers.map(function(h) { return '"' + String(h).replace(/"/g, '""') + '"'; }).join(',')];
            rows.forEach(function(row) {
                var line = cols.map(function(c) {
                    var key = typeof c === 'object' ? c.fieldname : c;
                    var val = (row && row[key] !== undefined && row[key] !== null) ? row[key] : (Array.isArray(row) ? row[cols.indexOf(c)] : '');
                    val = String(val).replace(/"/g, '""');
                    return '"' + val + '"';
                });
                csvLines.push(line.join(','));
            });
            var blob2 = new Blob([csvLines.join('\n') + '\n'], { type: 'text/csv;charset=utf-8;' });
            var link2 = document.createElement('a');
            link2.href = URL.createObjectURL(blob2);
            var fname = ar.type ? ar.type.replace(/ /g, '_') : 'Report';
            link2.download = fname + '.csv';
            link2.click();
        });

        // Toggle Chart / Table View inside each chart box
        $(document).on('click', '.amb-btn-chart', function() {
            var $box = $(this).closest('.amb-chart-box');
            $box.find('.amb-box-btn').removeClass('active');
            $(this).addClass('active');
            $box.find('.amb-view-table').hide().removeClass('active');
            $box.find('.amb-view-chart')
                .addClass('active')
                .css('display', $box.data('box') === 'attention' ? 'flex' : 'block');
            // canvas was hidden while in table view -> force a resize
            Object.keys(me.charts).forEach(function(key) {
                if (me.charts[key]) me.charts[key].resize();
            });
        });

        $(document).on('click', '.amb-btn-table', function() {
            var $box = $(this).closest('.amb-chart-box');
            $box.find('.amb-box-btn').removeClass('active');
            $(this).addClass('active');
            $box.find('.amb-view-chart').hide().removeClass('active');
            $box.find('.amb-view-table').addClass('active').show();
        });

        // Download image for whichever view is currently active in the box
        $(document).on('click', '.amb-box-download', function() {
            var $box = $(this).closest('.amb-chart-box');
            var box_name = $box.data('box');
            var title = $box.find('.amb-box-title').text().trim() || box_name;

            var $table = $box.find('.amb-view-table');
            var table_active = $table.hasClass('active')
                || ($table.is(':visible') && $table.find('table').length > 0);

            if (table_active) {
                me.download_table_image($table, title);
                return;
            }

            var chart = me.charts[box_name];
            if (!chart) {
                // Owner Performance / Data Completeness have no Chart.js instance
                me.download_box_as_image($box, box_name, title);
                return;
            }
            me.download_chart_image(chart, title, box_name);
        });
    }

    /* -------------------------------------------------------------
       Export helpers
       The canvas is transparent, so toBase64Image() produces a PNG
       whose alpha shows as a grey/white checkerboard in image viewers.
       Compose onto an opaque white canvas (and scale up) instead.
    ------------------------------------------------------------- */
    download_chart_image(chart, file_name, box_name) {
        try {
            var source = chart.canvas;
            var width = chart.width || source.width;
            var height = chart.height || source.height;
            if (!width || !height) {
                // chart is hidden (Table view active) -> restore, export, re-hide
                chart.resize();
                width = chart.width || source.width;
                height = chart.height || source.height;
            }

            var scale = 2;
            var out = document.createElement('canvas');

            // The attention doughnut keeps its legend and centre total in
            // sibling DOM nodes, so they must be painted onto the export.
            if (box_name === 'attention') {
                this.render_attention_to_canvas(chart, out, width, height, scale);
            } else {
                out.width = Math.round(width * scale);
                out.height = Math.round(height * scale);
                var ctx = out.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, out.width, out.height);
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(source, 0, 0, out.width, out.height);
            }

            this.save_canvas(out, file_name + '.png');
        } catch (e) {
            console.error('ALESSA dashboard: chart export failed', e);
            // last resort - plain base64 export
            this.save_canvas(null, file_name + '.png', chart.toBase64Image());
        }
    }

    /* -------------------------------------------------------------
       Compose the Management Attention box into one image:
       title, doughnut with its centre total, and a labelled legend
       carrying both counts and percentages.
    ------------------------------------------------------------- */
    render_attention_to_canvas(chart, out, chart_width, chart_height, scale) {
        var data = (this.dashboard_data || {}).management_attention;
        var values = this.attention_values(data || {});
        var labels = this.ATTENTION_LABELS;
        var colors = this.ATTENTION_COLORS;
        var total = (data && data.total_signals) || values.reduce(function(a, b) { return a + b; }, 0);

        var title_height = 40;
        var pad = 18;
        var legend_gap = 24;
        var legend_width = 300;
        var row_height = 30;
        var legend_height = labels.length * row_height + 46;

        // chart + gap + legend, with padding on BOTH sides, otherwise the
        // right-most column (Share) is drawn past the canvas edge and clipped
        var width = pad + chart_width + legend_gap + legend_width + pad;
        var height = Math.max(chart_height, legend_height) + title_height + pad * 2;

        out.width = Math.round(width * scale);
        out.height = Math.round(height * scale);

        var ctx = out.getContext('2d');
        ctx.scale(scale, scale);
        ctx.textBaseline = 'middle';

        // opaque white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        var font = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

        // title
        ctx.fillStyle = '#0f172a';
        ctx.font = '600 15px ' + font;
        ctx.textAlign = 'left';
        ctx.fillText('Management Attention', pad, pad + title_height / 2);

        // doughnut on the left
        var donut_y = pad + title_height;
        ctx.drawImage(chart.canvas, pad, donut_y, chart_width, chart_height);

        // centre total (mirrors the on-screen overlay)
        var cx = pad + chart_width / 2;
        var cy = donut_y + chart_height / 2;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#0f172a';
        ctx.font = '800 26px ' + font;
        ctx.fillText(String(total), cx, cy - 7);
        ctx.fillStyle = '#64748b';
        ctx.font = '700 9px ' + font;
        ctx.fillText('SIGNALS', cx, cy + 14);

        // legend on the right
        var lx = pad + chart_width + legend_gap;
        var ly = donut_y + Math.max((chart_height - legend_height) / 2, 0) + 6;

        // explicit column anchors, all inside the canvas
        var label_x = lx + 20;
        var count_x = lx + legend_width - 84;   // right aligned
        var share_x = lx + legend_width;         // right aligned

        ctx.font = '600 11px ' + font;
        ctx.fillStyle = '#475569';
        ctx.textAlign = 'left';
        ctx.fillText('SIGNAL', label_x, ly);
        ctx.textAlign = 'right';
        ctx.fillText('COUNT', count_x, ly);
        ctx.fillText('SHARE', share_x, ly);

        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(lx, ly + 12);
        ctx.lineTo(share_x, ly + 12);
        ctx.stroke();

        labels.forEach(function(label, idx) {
            var y = ly + 32 + idx * row_height;
            var value = values[idx];
            var pct = total ? ((value / total) * 100).toFixed(1) : '0.0';

            // colour dot
            ctx.fillStyle = colors[idx];
            ctx.beginPath();
            ctx.arc(lx + 6, y, 5, 0, Math.PI * 2);
            ctx.fill();

            // label
            ctx.textAlign = 'left';
            ctx.fillStyle = '#334155';
            ctx.font = '400 12px ' + font;
            ctx.fillText(this.truncate(ctx, label, count_x - label_x - 24), label_x, y);

            // count
            ctx.textAlign = 'right';
            ctx.fillStyle = '#0f172a';
            ctx.font = '700 12px ' + font;
            ctx.fillText(String(value), count_x, y);

            // share
            ctx.fillStyle = '#64748b';
            ctx.font = '400 11px ' + font;
            ctx.fillText(pct + '%', share_x, y);
        }, this);

        // subtle divider between chart and legend
        ctx.strokeStyle = '#f1f5f9';
        ctx.beginPath();
        ctx.moveTo(pad + chart_width + legend_gap / 2, donut_y);
        ctx.lineTo(pad + chart_width + legend_gap / 2, donut_y + height - title_height - pad * 2);
        ctx.stroke();
    }

    /* -------------------------------------------------------------
       Owner Performance and Data Completeness are plain HTML bar
       lists with no Chart.js canvas, so they are painted directly
       onto a canvas instead of relying on html2canvas.
    ------------------------------------------------------------- */
    download_box_as_image($box, box_name, title) {
        if (box_name === 'pipeline') {
            this.download_bd_pipeline_image(title);
            return;
        }
        if (box_name === 'owner_perf') {
            this.download_owner_performance_image(title);
            return;
        }
        if (box_name === 'data_completeness') {
            this.download_data_completeness_image(title);
            return;
        }
        frappe.msgprint({
            title: __('Export unavailable'),
            message: __('This view cannot be exported as an image.'),
            indicator: 'orange'
        });
    }

    download_bd_pipeline_image(title) {
        var data = (this.dashboard_data || {}).pipeline;
        if (!data || !data.categories || !data.categories.length) {
            frappe.msgprint({ title: __('Nothing to export'), message: __('No pipeline data available.'), indicator: 'orange' });
            return;
        }

        var categories = data.categories;
        var values = data.values || [];
        var maxVal = Math.max.apply(null, values.concat([1]));
        var colors = ['#2563eb', '#0d9488', '#d97706', '#dc2626', '#7c3aed', '#059669'];

        var scale = 2;
        var pad = 20;
        var title_height = 40;
        var row_height = 32;
        var bar_height = 10;
        var name_width = 140;
        var value_width = 40;
        var bar_width = 420;

        var width = pad * 2 + name_width + bar_width + value_width + 24;
        var height = pad * 2 + title_height + row_height * categories.length + 10;

        var canvas = document.createElement('canvas');
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);

        var ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        ctx.textBaseline = 'middle';

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        var font = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

        ctx.fillStyle = '#0f172a';
        ctx.font = '600 15px ' + font;
        ctx.textAlign = 'left';
        ctx.fillText(title, pad, pad + title_height / 2);

        var top = pad + title_height;
        var track_x = pad + name_width;
        var track_y_offset = (row_height - bar_height) / 2;

        categories.forEach(function(cat, idx) {
            var val = values[idx] || 0;
            var pct = Math.min((val / maxVal) * 100, 100);
            var color = colors[idx % colors.length];
            var y = top + idx * row_height;
            var bar_y = y + track_y_offset;

            // dot
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(pad + 5, y + row_height / 2, 4, 0, Math.PI * 2);
            ctx.fill();

            // label
            ctx.fillStyle = '#1e293b';
            ctx.font = '600 12px ' + font;
            ctx.textAlign = 'left';
            ctx.fillText(this.truncate(ctx, cat, name_width - 24), pad + 16, y + row_height / 2);

            // track
            ctx.fillStyle = '#f1f5f9';
            this.round_rect(ctx, track_x, bar_y, bar_width, bar_height, 5);
            ctx.fill();

            // fill
            if (pct > 0) {
                ctx.fillStyle = color;
                var w = Math.max(bar_width * pct / 100, 4);
                this.round_rect(ctx, track_x, bar_y, w, bar_height, 5);
                ctx.fill();
            }

            // value
            ctx.fillStyle = '#0f172a';
            ctx.font = '700 12px ' + font;
            ctx.textAlign = 'right';
            ctx.fillText(String(val), track_x + bar_width + value_width, y + row_height / 2);
        }, this);

        this.save_canvas(canvas, title + '.png');
    }

    download_owner_performance_image(title) {
        var data = (this.dashboard_data || {}).owner_performance || [];
        if (!data.length) {
            frappe.msgprint({ title: __('Nothing to export'), message: __('No owner data available.'), indicator: 'orange' });
            return;
        }

        var scale = 2;
        var pad = 20;
        var title_height = 40;
        var legend_height = 34;
        var name_width = 150;
        var value_width = 46;
        var row_height = 30;
        var bar_height = 10;

        var bar_width = 420;
        var width = pad * 2 + name_width + bar_width + value_width + 24;
        var height = pad * 2 + title_height + legend_height + row_height * data.length + 14;

        var canvas = document.createElement('canvas');
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);

        var ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        ctx.textBaseline = 'middle';

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        var font = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

        ctx.fillStyle = '#0f172a';
        ctx.font = '600 15px ' + font;
        ctx.textAlign = 'left';
        ctx.fillText(title, pad, pad + title_height / 2);

        // legend row, mirroring the on-screen swatches
        var legend = [
            { label: 'Assigned', color: '#cbd5e1' },
            { label: 'Reg Completed', color: '#2563eb' },
            { label: 'PQ Completed', color: '#10b981' },
            { label: 'Overdue', color: '#ef4444' }
        ];
        var lx = pad;
        var ly = pad + title_height + legend_height / 2;
        ctx.font = '600 11px ' + font;
        legend.forEach(function(item) {
            ctx.fillStyle = item.color;
            ctx.beginPath();
            ctx.arc(lx + 5, ly, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#475569';
            ctx.textAlign = 'left';
            ctx.fillText(item.label, lx + 16, ly);
            lx += 24 + ctx.measureText(item.label).width;
        });

        var top = pad + title_height + legend_height;
        var track_x = pad + name_width;
        var track_y_offset = (row_height - bar_height) / 2;

        data.forEach(function(o, idx) {
            var assigned = o.assigned || 0;
            var reg = o.reg_completed || 0;
            var pq = o.pq_completed || 0;
            var overdue = o.overdue || 0;

            var reg_pct = assigned ? Math.min((reg / assigned) * 100, 100) : 0;
            var pq_pct = assigned ? Math.min((pq / assigned) * 100, 100 - reg_pct) : 0;
            var overdue_pct = assigned ? Math.min((overdue / assigned) * 100, 99) : 0;

            var y = top + idx * row_height;
            var bar_y = y + track_y_offset;

            // owner name
            ctx.fillStyle = '#1e293b';
            ctx.font = '600 12px ' + font;
            ctx.textAlign = 'left';
            ctx.fillText(this.truncate(ctx, o.name, name_width - 16), pad, y + row_height / 2);

            // track
            ctx.fillStyle = '#cbd5e1';
            this.round_rect(ctx, track_x, bar_y, bar_width, bar_height, 4);
            ctx.fill();

            // reg segment
            if (reg_pct > 0) {
                ctx.fillStyle = '#2563eb';
                var w = bar_width * reg_pct / 100;
                this.round_rect(ctx, track_x, bar_y, Math.max(w, 3), bar_height, 4);
                ctx.fill();
            }

            // pq segment continues after reg
            if (pq_pct > 0) {
                ctx.fillStyle = '#10b981';
                var w2 = bar_width * pq_pct / 100;
                this.round_rect(ctx, track_x + bar_width * reg_pct / 100, bar_y, Math.max(w2, 3), bar_height, 0);
                ctx.fill();
            }

            // overdue marker
            if (overdue > 0) {
                ctx.fillStyle = '#ef4444';
                var mx = track_x + bar_width * overdue_pct / 100;
                ctx.fillRect(Math.round(mx) - 1, bar_y - 2, 3, bar_height + 4);
            }

            // assigned total
            ctx.fillStyle = '#0f172a';
            ctx.font = '700 12px ' + font;
            ctx.textAlign = 'right';
            ctx.fillText(String(assigned), track_x + bar_width + value_width, y + row_height / 2);
        }, this);

        this.save_canvas(canvas, title + '.png');
    }

    download_data_completeness_image(title) {
        var data = (this.dashboard_data || {}).data_completeness || {};
        var fields = data.fields || [];
        if (!fields.length) {
            frappe.msgprint({ title: __('Nothing to export'), message: __('No completeness data available.'), indicator: 'orange' });
            return;
        }

        var scale = 2;
        var pad = 20;
        var title_height = 40;
        var head_height = 30;
        var row_height = 34;
        var bar_height = 10;
        var name_width = 190;
        var bar_width = 420;

        var width = pad * 2 + name_width + bar_width + 90;
        var height = pad * 2 + title_height + head_height + row_height * fields.length + 14;

        var canvas = document.createElement('canvas');
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);

        var ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        ctx.textBaseline = 'middle';

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        var font = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

        ctx.fillStyle = '#0f172a';
        ctx.font = '600 15px ' + font;
        ctx.textAlign = 'left';
        ctx.fillText(title, pad, pad + title_height / 2);

        var top = pad + title_height;
        var track_x = pad + name_width;

        // header row
        ctx.fillStyle = '#f1f5f9';
        ctx.fillRect(pad, top, name_width + bar_width + 80, head_height);
        ctx.fillStyle = '#334155';
        ctx.font = '600 11px ' + font;
        ctx.fillText('FIELD', pad + 10, top + head_height / 2);
        ctx.textAlign = 'right';
        ctx.fillText('COMPLETENESS', pad + name_width + bar_width + 70, top + head_height / 2);

        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.strokeRect(pad + 0.5, top + 0.5, name_width + bar_width + 80 - 1, head_height + row_height * fields.length - 1);

        fields.forEach(function(f, idx) {
            var y = top + head_height + idx * row_height;
            var bar_y = y + (row_height - bar_height) / 2 - 4;
            var pct = f.percentage || 0;
            var color = f.color || '#2563eb';

            if (idx % 2 === 1) {
                ctx.fillStyle = '#f8fafc';
                ctx.fillRect(pad, y, name_width + bar_width + 80, row_height);
            }

            // field name
            ctx.fillStyle = '#1e293b';
            ctx.font = '600 12px ' + font;
            ctx.textAlign = 'left';
            ctx.fillText(this.truncate(ctx, f.field, name_width - 24), pad + 10, y + row_height / 2 - 6);

            // missing count
            ctx.fillStyle = '#64748b';
            ctx.font = '400 10px ' + font;
            ctx.fillText((f.missing || 0) + ' missing', pad + 10, y + row_height / 2 + 9);

            // track + fill
            ctx.fillStyle = '#e2e8f0';
            this.round_rect(ctx, track_x, bar_y, bar_width, bar_height, 4);
            ctx.fill();

            ctx.fillStyle = color;
            this.round_rect(ctx, track_x, bar_y, Math.max(bar_width * pct / 100, 3), bar_height, 4);
            ctx.fill();

            // percentage
            ctx.fillStyle = '#0f172a';
            ctx.font = '700 12px ' + font;
            ctx.textAlign = 'right';
            ctx.fillText(pct + '%', pad + name_width + bar_width + 70, y + row_height / 2);

            ctx.strokeStyle = '#e2e8f0';
            ctx.beginPath();
            ctx.moveTo(pad, y + row_height - 0.5);
            ctx.lineTo(pad + name_width + bar_width + 80, y + row_height - 0.5);
            ctx.stroke();
        }, this);

        this.save_canvas(canvas, title + '.png');
    }

    /* Rounded rectangle path; radius 0 gives square corners for stacked segments */
    round_rect(ctx, x, y, w, h, r) {
        var radius = Math.min(r, h / 2, w / 2);
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    /* -------------------------------------------------------------
       Export the Table view of a box as a PNG.
       The table is drawn directly onto a canvas rather than rasterised
       from the DOM, so it works without html2canvas and keeps the
       header row / borders / text crisp at 2x scale.
    ------------------------------------------------------------- */
    download_table_image($table, title) {
        var $el = $table.find('table').first();
        if (!$el.length) {
            frappe.msgprint({
                title: __('Nothing to export'),
                message: __('This table has no rows yet.'),
                indicator: 'orange'
            });
            return;
        }

        var headers = [];
        $el.find('thead th').each(function() { headers.push($(this).text().trim()); });

        var rows = [];
        $el.find('tbody tr').each(function() {
            var row = [];
            $(this).find('td').each(function() { row.push($(this).text().trim()); });
            if (row.length) rows.push(row);
        });

        if (!rows.length) {
            frappe.msgprint({
                title: __('Nothing to export'),
                message: __('This table has no rows yet.'),
                indicator: 'orange'
            });
            return;
        }

        this.render_table_to_canvas(headers, rows, title);
    }

    render_table_to_canvas(headers, rows, title) {
        var scale = 2;
        var cols = headers.length;
        var col_width = 150;
        var row_height = 32;
        var header_height = 38;
        var title_height = 46;
        var pad = 16;

        var width = pad * 2 + col_width * cols;
        var height = pad * 2 + title_height + header_height + row_height * rows.length;

        var canvas = document.createElement('canvas');
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);

        var ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        ctx.textBaseline = 'middle';

        // opaque white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        // title
        ctx.fillStyle = '#0f172a';
        ctx.font = '600 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(title, pad, pad + title_height / 2);

        var top = pad + title_height;

        // header row
        ctx.fillStyle = '#f1f5f9';
        ctx.fillRect(pad, top, col_width * cols, header_height);
        ctx.fillStyle = '#334155';
        ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        headers.forEach(function(h, i) {
            ctx.fillText(this.truncate(ctx, h, col_width - pad), pad + i * col_width + 10, top + header_height / 2);
        }, this);

        // body rows
        ctx.font = '400 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        rows.forEach(function(row, r) {
            var y = top + header_height + r * row_height;

            if (r % 2 === 1) {
                ctx.fillStyle = '#f8fafc';
                ctx.fillRect(pad, y, col_width * cols, row_height);
            }

            ctx.fillStyle = '#1e293b';
            for (var i = 0; i < cols; i++) {
                var value = row[i] === undefined ? '' : row[i];
                ctx.fillText(this.truncate(ctx, value, col_width - pad), pad + i * col_width + 10, y + row_height / 2);
            }

            // horizontal rule
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(pad, y + row_height - 0.5);
            ctx.lineTo(pad + col_width * cols, y + row_height - 0.5);
            ctx.stroke();
        }, this);

        // outer border + vertical separators
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.strokeRect(pad + 0.5, top + 0.5, col_width * cols - 1, header_height + row_height * rows.length - 1);

        ctx.beginPath();
        for (var c = 1; c < cols; c++) {
            var x = pad + c * col_width + 0.5;
            ctx.moveTo(x, top);
            ctx.lineTo(x, top + header_height + row_height * rows.length);
        }
        ctx.stroke();

        this.save_canvas(canvas, title + '.png');
    }

    truncate(ctx, text, max_width) {
        var value = String(text === undefined || text === null ? '' : text);
        if (ctx.measureText(value).width <= max_width) return value;
        var out = value;
        while (out.length > 1 && ctx.measureText(out + '...').width > max_width) {
            out = out.slice(0, -1);
        }
        return out + '...';
    }

    save_canvas(canvas, file_name, fallback_url) {
        var a = document.createElement('a');
        if (canvas) {
            a.href = canvas.toDataURL('image/png');
        } else {
            a.href = fallback_url;
        }
        a.download = file_name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
};
