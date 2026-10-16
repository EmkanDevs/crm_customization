// Copyright (c) 2026, Finbyz and contributors
// For license information, please see license.txt

// Reuse the BD Control Center building blocks so this page's record section
// behaves identically to the BD Control Center sections (25/75 split, shared
// master-list pane, dirty-state guard, record loading).
{% include "crm_customization/crm_customization/page/bd_control_center/bd_cc_sections/section_base_styles.js" %}
{% include "crm_customization/crm_customization/page/bd_control_center/bd_cc_sections/section_list_pane.js" %}

frappe.provide('crm_customization');

function init_assigned_task_center(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Assigned Task Center',
        single_column: true
    });
    new crm_customization.AssignedTaskCenter(page);
}

frappe.pages['assigned-task-center'] = frappe.pages['assigned-task-center'] || {};
frappe.pages['assigned-task-center'].on_page_load = init_assigned_task_center;

crm_customization.AssignedTaskCenter = class {
    constructor(page) {
        this.page = page;
        this.filters = {
            view: 'assigned_by_me',    // 'assigned_to' | 'assigned_by_me'
            user: frappe.session.user,
            from_date: '',
            to_date: '',
            due_by: '',
            status_card: ''
        };
        this.dashboard_data = {
            total: 0,
            open: 0,
            working: 0,
            pending_review: 0,
            overdue: 0,
            completed: 0
        };

        this.add_css();
        this.setup_page();
        this.bind_events();
        this.load_user_list();
        this.load_dashboard_data();
        this.setup_records_section();
        this.set_status_filter(this.filters.status_card || '', { apply: false });
    }

    setup_records_section() {
        this.records = new crm_customization.PTMRecordsPane(this);
        this.records.render($('#ptm-records-host'));
    }

    /* ─────────────────────────── CSS ─────────────────────────── */
    add_css() {
        if ($('#ptm-custom-style').length) return;

        var style = `
        <style id="ptm-custom-style">
            /* Hide default page header */
            body[data-route="assigned-task-center"] .page-head {
                display: none !important;
            }

            body[data-route="assigned-task-center"] .page-body,
            body[data-route="assigned-task-center"] .layout-main,
            body[data-route="assigned-task-center"] .layout-main-section-wrapper,
            body[data-route="assigned-task-center"] .layout-main-section,
            .layout-main-section-wrapper,
            .layout-main-section {
                max-width: none !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
            }

            .layout-main-section > .page-form { display: none !important; }

            /* ── Wrapper ─────────────────────────────────────────────── */
            .ptm-wrapper {
                width: 100%;
                max-width: 100%;
                box-sizing: border-box;
                background: #f1f5f9;
                min-height: 100vh;
                font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }

            /* ── Top Navbar ──────────────────────────────────────────── */
            .ptm-navbar {
                background: #ffffff;
                border-bottom: 1px solid #e2e8f0;
                padding: 0 28px;
                display: flex;
                align-items: stretch;
                justify-content: space-between;
                min-height: 60px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                position: sticky;
                top: 0;
                z-index: 100;
            }

            /* Left brand block */
            .ptm-brand {
                display: flex;
                flex-direction: column;
                justify-content: center;
                padding: 10px 0;
                min-width: 200px;
            }
            .ptm-brand-title {
                font-size: 15px;
                font-weight: 800;
                color: #0f172a;
                letter-spacing: -0.2px;
                line-height: 1.2;
            }
            .ptm-brand-sub {
                font-size: 11px;
                color: #94a3b8;
                font-weight: 500;
                margin-top: 2px;
            }

            /* Center nav groups */
            .ptm-nav-groups {
                display: flex;
                align-items: center;
                gap: 36px;
                flex: 1;
                padding: 0 32px;
            }
            .ptm-nav-group {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .ptm-nav-group-label {
                font-size: 9px;
                font-weight: 700;
                color: #94a3b8;
                letter-spacing: 0.8px;
                text-transform: uppercase;
            }
            .ptm-nav-group-content {
                display: flex;
                align-items: center;
                gap: 4px;
            }

            /* Toggle view buttons */
            .ptm-view-btn {
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                color: #64748b;
                font-size: 12px;
                font-weight: 600;
                padding: 6px 14px;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.15s ease;
                white-space: nowrap;
            }
            .ptm-view-btn:first-child { border-radius: 6px 0 0 6px; border-right: none; }
            .ptm-view-btn:last-child  { border-radius: 0 6px 6px 0; border-left: 1px solid #e2e8f0; }
            .ptm-view-btn.active {
                background: #2563eb;
                color: #ffffff;
                border-color: #2563eb;
                box-shadow: 0 1px 3px rgba(37,99,235,0.3);
                z-index: 1;
            }
            .ptm-view-btn:hover:not(.active) {
                background: #f1f5f9;
                color: #1e293b;
            }

            /* User select */
            .ptm-user-select {
                height: 34px;
                padding: 4px 10px;
                font-size: 12px;
                font-weight: 500;
                color: #1e293b;
                background: #ffffff;
                border: 1px solid #cbd5e1;
                border-radius: 6px;
                outline: none;
                min-width: 170px;
                cursor: pointer;
                transition: border-color 0.2s, box-shadow 0.2s;
            }
            .ptm-user-select:focus {
                border-color: #2563eb;
                box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
            }

            /* Right date filters */
            .ptm-nav-right {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 0 0 0 20px;
                border-left: 1px solid #f1f5f9;
            }
            .ptm-date-group {
                display: flex;
                flex-direction: column;
                gap: 3px;
            }
            .ptm-date-label {
                font-size: 9px;
                font-weight: 700;
                color: #94a3b8;
                letter-spacing: 0.8px;
                text-transform: uppercase;
            }
            .ptm-date-input {
                height: 32px;
                padding: 4px 8px;
                font-size: 12px;
                color: #1e293b;
                background: #ffffff;
                border: 1px solid #cbd5e1;
                border-radius: 6px;
                outline: none;
                width: 130px;
                transition: border-color 0.2s, box-shadow 0.2s;
            }
            .ptm-date-input:focus {
                border-color: #2563eb;
                box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
            }

            .ptm-btn-reset {
                height: 32px;
                padding: 0 14px;
                background: #ffffff;
                border: 1px solid #cbd5e1;
                border-radius: 6px;
                color: #475569;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.15s ease;
            }
            .ptm-date-label-spacer { visibility: hidden; }
            .ptm-btn-reset:hover {
                background: #f1f5f9;
                border-color: #94a3b8;
                color: #1e293b;
            }

            /* ── Body ─────────────────────────────────────────────────── */
            .ptm-body {
                padding: 24px 28px 50px;
            }

            /* User account hint text */
            .ptm-user-hint {
                font-size: 11px;
                color: #94a3b8;
                margin-bottom: 20px;
                font-style: italic;
            }

            /* ── Summary Cards ────────────────────────────────────────── */
            .ptm-cards-grid {
                display: grid;
                grid-template-columns: repeat(6, 1fr);
                gap: 14px;
                margin-bottom: 28px;
            }
            @media (max-width: 1400px) {
                .ptm-cards-grid { grid-template-columns: repeat(3, 1fr); }
            }
            @media (max-width: 768px) {
                .ptm-cards-grid { grid-template-columns: repeat(2, 1fr); }
            }
            @media (max-width: 480px) {
                .ptm-cards-grid { grid-template-columns: 1fr; }
            }

            .ptm-card {
                background: #ffffff;
                border: 1px solid #e2e8f0;
                border-radius: 10px;
                padding: 10px 16px 10px 20px;
                position: relative;
                overflow: hidden;
                box-shadow: 0 1px 3px rgba(0,0,0,0.04);
                display: flex;
                align-items: stretch;
                cursor: pointer;
                transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
            }
            .ptm-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 18px rgba(0,0,0,0.08);
            }
            .ptm-card.active-filter {
                border-color: var(--card-color, #2563eb);
                box-shadow: 0 0 0 2px rgba(37,99,235,0.12), 0 4px 12px rgba(0,0,0,0.06);
            }
            .ptm-card-accent {
                position: absolute;
                top: 0; left: 0; bottom: 0;
                width: 5px;
                border-radius: 10px 0 0 10px;
                background: var(--card-color, #64748b);
            }
            .ptm-card-body {
                padding-left: 8px;
            }
            .ptm-card-label {
                font-size: 10px;
                font-weight: 700;
                color: #64748b;
                letter-spacing: 0.6px;
                text-transform: uppercase;
                margin-bottom: 4px;
            }
            .ptm-card-value {
                font-size: 22px;
                font-weight: 800;
                color: #0f172a;
                line-height: 1;
                margin-bottom: 3px;
                transition: color 0.15s;
            }
            .ptm-card:hover .ptm-card-value {
                color: var(--card-color, #2563eb);
            }
            .ptm-card-subtext {
                font-size: 11px;
                color: #94a3b8;
                font-weight: 400;
            }

            /* Active card status filter indicator */
            .ptm-active-status-pill {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                background: #eff6ff;
                border: 1px solid #bfdbfe;
                border-radius: 20px;
                padding: 3px 10px 3px 8px;
                font-size: 11px;
                font-weight: 600;
                color: #2563eb;
                margin-left: 10px;
            }
            .ptm-active-status-pill button {
                background: none;
                border: none;
                color: #93c5fd;
                cursor: pointer;
                font-size: 14px;
                line-height: 1;
                padding: 0;
                display: flex;
                align-items: center;
            }
            .ptm-active-status-pill button:hover { color: #2563eb; }

            /* Loading / empty states */
            .ptm-loading {
                text-align: center;
                color: #94a3b8;
                padding: 40px 20px;
                font-size: 13px;
            }

            /* Active filter pill container (no space when empty) */
            #ptm-active-status-container:not(:empty) {
                margin-bottom: 14px;
            }
            #ptm-active-status-container .ptm-active-status-pill {
                margin-left: 0;
            }

            /* ── Projects & Tasks record section (25/75) ─────────────── */
            .ptx-split > .sc-split-left { flex: 0 0 25%; max-width: 25%; top: 70px; overflow: visible; }

            .ptx-project-node { margin-bottom: 2px; }
            .ptx-project-item { position: relative; padding-left: 26px !important; }
            .ptx-expander {
                position: absolute; left: 5px; top: 8px;
                width: 16px; height: 16px; line-height: 15px; text-align: center;
                font-size: 10px; color: #64748b; cursor: pointer; border-radius: 4px;
                user-select: none;
            }
            .ptx-expander:hover { background: #e2e8f0; color: #1f2937; }
            .ptx-task-count {
                margin-left: auto; flex-shrink: 0; font-size: 10px; font-weight: 600;
                color: #475569; background: #f1f5f9; border: 1px solid #e2e8f0;
                padding: 0 6px; border-radius: 999px; line-height: 16px; white-space: nowrap;
            }
            .ptx-status-filter { display: flex; }
            .ptx-status-select {
                width: 100%; box-sizing: border-box; height: 28px;
                font-size: 12px; padding: 4px 9px; border-radius: 6px;
                border: 1px solid #d1d5db; outline: none; color: #374151;
                background: #fff; cursor: pointer; font-family: inherit;
                transition: border-color 0.15s, box-shadow 0.15s;
            }
            .ptx-status-select:focus { border-color: #93c5fd; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
            .ptx-project-node.expanded > .ptx-project-item { background: #f1f5f9; }
            .ptx-task-sublist {
                background: #f8fafc; border-left: 2px solid #dbeafe;
                margin: 0 0 4px 18px; padding: 2px 0; border-radius: 0 6px 6px 0;
            }
            .ptx-task-item { padding-left: 12px !important; }
            /* Task card: left = subject + "Is Group" tag; right cluster =
               status, % progress, then days-until-due at the far right. */
            .sc-list-item.ptx-task-card {
                display: flex; align-items: center; gap: 8px;
                padding-right: 8px !important;
            }
            .ptx-task-card .ptx-task-main {
                flex: 1 1 auto; min-width: 0;
                display: flex; align-items: center; gap: 6px;
            }
            .ptx-task-card .ptx-task-name {
                overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
                font-size: 12.5px; font-weight: 600; color: #1f2937;
            }
            .ptx-task-istag {
                flex-shrink: 0; font-size: 9px; font-weight: 700; letter-spacing: 0.4px;
                text-transform: uppercase; color: #7c3aed; background: #f5f3ff;
                border: 1px solid #ddd6fe; border-radius: 4px; padding: 0 5px; line-height: 15px;
            }
            .ptx-task-status {
                flex-shrink: 0; max-width: 78px; overflow: hidden; text-overflow: ellipsis;
                white-space: nowrap; font-size: 9.5px; font-weight: 600; color: #475569;
                background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 4px;
                padding: 0 5px; line-height: 15px;
            }
            .ptx-task-progress {
                flex-shrink: 0; width: 40px; text-align: center; font-size: 10.5px; font-weight: 700;
                color: #2563eb; background: #eff6ff; border: 1px solid #bfdbfe;
                border-radius: 999px; line-height: 16px;
            }
            .ptx-task-due {
                flex-shrink: 0; min-width: 66px; text-align: right;
                font-size: 10px; font-weight: 600; color: #64748b; white-space: nowrap;
            }
            .ptx-task-due.soon { color: #16a34a; }
            .ptx-task-due.today { color: #d97706; }
            .ptx-task-due.overdue { color: #dc2626; }
            .ptx-task-child { padding-left: 26px !important; }
            .ptx-task-child .ptx-task-name { font-weight: 500; color: #475569; }
            .ptx-sublist-loading, .ptx-sublist-empty {
                font-size: 11px; color: #94a3b8; padding: 6px 12px; font-style: italic;
            }
            .ptx-search-group {
                font-size: 10px; font-weight: 700; letter-spacing: 0.6px;
                text-transform: uppercase; color: #94a3b8; padding: 12px 8px 4px;
            }
            .ptx-search-task .sc-list-item-badge {
                color: #1d4ed8; background: #eff6ff; border-color: #bfdbfe;
            }

            /* Right record pane */
            .ptm-record-toolbar {
                display: flex; align-items: center; justify-content: space-between;
                gap: 12px; margin-bottom: 12px;
            }
            .ptm-record-title { font-size: 15px; font-weight: 700; color: #1f2937; min-width: 0; }
            .ptm-record-title .ptm-record-doctype {
                font-size: 10px; font-weight: 700; text-transform: uppercase;
                letter-spacing: 0.6px; color: #2563eb; background: #eff6ff;
                border: 1px solid #bfdbfe; border-radius: 4px;
                padding: 1px 6px; margin-right: 8px; vertical-align: middle;
            }
            .ptm-record-actions { display: flex; gap: 8px; flex-shrink: 0; }
            .ptm-record-placeholder {
                text-align: center; color: #9ca3af; font-style: italic; font-size: 13px;
                padding: 60px 20px; background: #fff;
                border: 1px dashed #e2e8f0; border-radius: 8px;
            }
            .ptm-form-section {
                background: #fff; border: 1px solid #e2e6ea; border-radius: 8px;
                padding: 16px 18px; margin-bottom: 16px;
            }
            .ptm-form-section-header {
                display: flex; align-items: center; gap: 8px;
                width: 100%; background: none; border: none; padding: 0;
                margin: 0 0 12px 0; text-align: left;
                font-family: inherit;
            }
            .ptm-form-section-header[data-collapsible="1"] { cursor: pointer; }
            .ptm-form-section-header[data-collapsible="1"]:hover h3 { color: #1d4ed8; }
            .ptm-form-section-header h3 {
                font-size: 13px; font-weight: 700; color: #374151; margin: 0;
                flex: 1 1 auto; min-width: 0;
            }
            .ptm-section-caret {
                font-size: 10px; color: #64748b; flex-shrink: 0;
                transition: transform 0.15s ease; transform: rotate(0deg);
            }
            .ptm-form-section.collapsed .ptm-section-caret { transform: rotate(-90deg); }
            .ptm-form-section.collapsed .ptm-form-section-header { margin-bottom: 0; }
            .ptm-form-section.collapsed .ptm-form-section-body { display: none; }
            .ptm-form-grid {
                display: grid;
                grid-template-columns: repeat(var(--ptm-column-count), minmax(0, 1fr));
                gap: 20px;
            }
            .ptm-form-column { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
            .ptm-form-grid-auto { grid-template-columns: 1fr 1fr; gap: 14px 20px; }
            .ptm-form-grid-auto .ptm-field-wide { grid-column: 1 / -1; }
            @media (max-width: 900px) { .ptm-form-grid { grid-template-columns: 1fr; } }
            .ptm-field-group .frappe-control { margin-bottom: 0 !important; }
            .ptm-field-group .frappe-control .form-group { margin-bottom: 0 !important; }
            .ptm-field-group .frappe-control .control-label {
                font-size: 12px !important; font-weight: 600 !important; color: #374151 !important;
            }

            /* Child table (BD Control Center style) */
            .ptm-child-grid { border: 1px solid #e2e8f0; border-radius: 6px; }
            .ptm-child-wrap { overflow-x: auto; }
            .ptm-child-table { width: 100%; border-collapse: collapse; font-size: 12px; }
            .ptm-child-table thead tr { background: #f8fafc; border-bottom: 2px solid #e5e7eb; }
            .ptm-child-table thead th {
                padding: 8px 10px; text-align: left; font-weight: 600;
                color: #374151; font-size: 11.5px; white-space: nowrap;
                border-right: 1px solid #e5e7eb;
            }
            .ptm-child-table thead th:last-child { border-right: none; }
            .ptm-child-table tbody tr { border-bottom: 1px solid #f1f5f9; transition: background 0.12s; }
            .ptm-child-table tbody tr:hover { background: #f8faff; }
            .ptm-child-table tbody td {
                padding: 6px 10px; color: #374151; vertical-align: middle;
                border-right: 1px solid #f1f5f9; overflow: visible;
            }
            .ptm-child-table tbody td:last-child { border-right: none; }
            .ptm-child-table .ptm-col-num { color: #6b7280; font-size: 11px; text-align: center; width: 1%; white-space: nowrap; }
            .ptm-child-table .ptm-col-actions { text-align: center; white-space: nowrap; width: 1%; }
            .ptm-child-table td .frappe-control { margin-bottom: 0 !important; }
            .ptm-child-table td .frappe-control .form-group { margin-bottom: 0 !important; }
            .ptm-child-table td .frappe-control .control-label { display: none !important; }
            .ptm-child-table td .link-btn { display: none; }
            .ptm-child-table td .awesomplete > ul {
                z-index: 2000; max-height: 200px; overflow-y: auto;
                width: max-content; min-width: 100%;
            }
            .ptm-child-chk {
                width: 16px !important; height: 16px !important;
                min-width: 16px !important; margin: 0 !important; padding: 0 !important;
                display: block; margin: 0 auto !important;
                accent-color: #2563eb; cursor: pointer;
            }
            .ptm-no-data-row td {
                text-align: center; color: #9ca3af;
                padding: 24px 10px !important; font-style: italic;
            }
            .ptm-add-row-bar { display: flex; align-items: center; padding: 10px 0 0 0; }
            .ptm-add-row-btn {
                font-size: 12px; padding: 5px 12px;
                border: 1px solid #d1d5db; background: #fff; border-radius: 5px;
                cursor: pointer; color: #374151; font-weight: 500;
                transition: background 0.15s; font-family: inherit;
            }
            .ptm-add-row-btn:hover { background: #f3f4f6; }
            .ptm-edit-row-btn {
                padding: 3px 10px; font-size: 11px; font-weight: 500;
                border: 1px solid #bfdbfe; background: #eff6ff; color: #2563eb;
                border-radius: 5px; cursor: pointer; white-space: nowrap;
                margin-right: 4px; transition: background 0.15s, border-color 0.15s;
                font-family: inherit;
            }
            .ptm-edit-row-btn:hover { background: #dbeafe; border-color: #60a5fa; }
            .ptm-remove-row-btn {
                padding: 3px 10px; font-size: 11px; font-weight: 500;
                border: 1px solid #fecaca; background: #fef2f2; color: #dc2626;
                border-radius: 5px; cursor: pointer; white-space: nowrap;
                transition: background 0.15s, border-color 0.15s; font-family: inherit;
            }
            .ptm-remove-row-btn:hover { background: #fee2e2; border-color: #f87171; }

            /* Child table Link dropdown teleport (overlaps scroll) */
            .sc-table-dd-teleported.ptm-dd-teleported {
                position: fixed !important; z-index: 99999 !important;
                background: #ffffff !important;
                border: 1px solid #d1d5db !important;
                border-radius: 6px !important;
                box-shadow: 0 8px 24px rgba(0,0,0,0.14) !important;
                max-height: 200px !important; overflow-y: auto !important;
                list-style: none !important; margin: 0 !important; padding: 4px !important;
                min-width: max-content !important; width: max-content !important;
            }

            /* ── Context cards (Business Request / Customer / Subsidiary / Project) ── */
            .ptm-ctx-cards {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 10px;
                margin-bottom: 14px;
            }
            @media (max-width: 1100px) { .ptm-ctx-cards { grid-template-columns: repeat(2, 1fr); } }
            @media (max-width: 640px)  { .ptm-ctx-cards { grid-template-columns: 1fr; } }

            .ptm-ctx-card {
                background: #fff;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 10px 14px 10px 18px;
                position: relative;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                gap: 3px;
                min-width: 0;
                transition: box-shadow 0.15s ease, border-color 0.15s ease;
            }
            .ptm-ctx-card-accent {
                position: absolute;
                top: 0; left: 0; bottom: 0;
                width: 4px;
                background: var(--ctx-color, #94a3b8);
                border-radius: 8px 0 0 8px;
            }
            .ptm-ctx-card-label {
                font-size: 9px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.7px;
                color: #94a3b8;
                white-space: nowrap;
            }
            .ptm-ctx-card-value {
                font-size: 12px;
                font-weight: 600;
                color: #1e293b;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                line-height: 1.3;
            }
            .ptm-ctx-card-value.is-empty {
                color: #cbd5e1;
                font-weight: 400;
                font-style: italic;
            }
            .ptm-ctx-card.is-link {
                cursor: pointer;
            }
            .ptm-ctx-card.is-link:hover {
                border-color: var(--ctx-color, #93c5fd);
                box-shadow: 0 2px 8px rgba(0,0,0,0.06);
            }
            .ptm-ctx-card.is-link:hover .ptm-ctx-card-value {
                color: var(--ctx-color, #2563eb);
            }
            .ptm-ctx-card-open-icon {
                position: absolute;
                top: 8px;
                right: 8px;
                font-size: 10px;
                color: #cbd5e1;
                opacity: 0;
                transition: opacity 0.15s;
            }
            .ptm-ctx-card.is-link:hover .ptm-ctx-card-open-icon { opacity: 1; }

            /* Connections (linked doctypes) section */
            .ptm-connections { margin-bottom: 16px; }
            .ptm-conn-section {
                background: #fff; border: 1px solid #e2e6ea; border-radius: 8px;
                padding: 16px 18px;
            }
            .ptm-conn-header {
                display: flex; align-items: center; gap: 8px;
                width: 100%; background: none; border: none; padding: 0;
                margin: 0 0 12px 0; cursor: pointer; text-align: left;
                font-family: inherit;
            }
            .ptm-conn-header:hover .ptm-conn-title { color: #1d4ed8; }
            .ptm-conn-title { font-size: 13px; font-weight: 700; color: #374151; margin: 0; flex: 1 1 auto; min-width: 0; }
            .ptm-conn-section.collapsed .ptm-section-caret { transform: rotate(-90deg); }
            .ptm-conn-section.collapsed .ptm-conn-header { margin-bottom: 0; }
            .ptm-conn-section.collapsed .ptm-conn-body { display: none; }
            .ptm-conn-grid {
                display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px 20px;
            }
            @media (max-width: 1100px) { .ptm-conn-grid { grid-template-columns: repeat(2, 1fr); } }
            @media (max-width: 700px)  { .ptm-conn-grid { grid-template-columns: 1fr; } }
            .ptm-conn-group-label {
                font-size: 10px; font-weight: 700; text-transform: uppercase;
                letter-spacing: 0.5px; color: #000; margin-bottom: 6px;
            }
            .ptm-conn-items { display: flex; flex-wrap: wrap; gap: 6px; }
            .ptm-conn-badge {
                display: inline-flex; align-items: center; gap: 6px;
                background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px;
                padding: 3px 4px 3px 10px; font-size: 11.5px; color: #334155;
                cursor: pointer; font-family: inherit; transition: all 0.15s ease;
            }
            .ptm-conn-badge:hover { border-color: #bfdbfe; background: #eff6ff; color: #1d4ed8; }
            .ptm-conn-count {
                min-width: 18px; text-align: center; font-size: 10px; font-weight: 700;
                background: #e2e8f0; color: #475569; border-radius: 3px; padding: 1px 6px;
            }
            .ptm-conn-badge:hover .ptm-conn-count { background: #bfdbfe; color: #1d4ed8; }
            .ptm-conn-count.is-zero { background: #f1f5f9; color: #cbd5e1; }
        </style>`;
        $('head').append(style);
    }

    /* ─────────────────────────── HTML ─────────────────────────── */
    setup_page() {
        $(this.page.main).empty().append(`
            <div class="ptm-wrapper">

                <!-- ── Top Navbar ─────────────────────────────────── -->
                <div class="ptm-navbar">
                    <!-- Brand -->
                    <div class="ptm-brand">
                        <div class="ptm-brand-title">Assigned Task Center</div>
                        <div class="ptm-brand-sub" id="ptm-logged-in-label">Logged in as ${frappe.session.user_fullname || frappe.session.user}</div>
                    </div>

                    <!-- Center nav groups -->
                    <div class="ptm-nav-groups">
                        <!-- Assignment View Toggle -->
                        <div class="ptm-nav-group">
                            <div class="ptm-nav-group-label">Assignment View</div>
                            <div class="ptm-nav-group-content">
                                <button class="ptm-view-btn" id="ptm-btn-assigned-to" data-view="assigned_to">Assigned To</button>
                                <button class="ptm-view-btn active" id="ptm-btn-assigned-by-me" data-view="assigned_by_me">Assigned by Me</button>
                            </div>
                        </div>

                        <!-- User Account -->
                        <div class="ptm-nav-group">
                            <div class="ptm-nav-group-label">User Account</div>
                            <div class="ptm-nav-group-content">
                                <select class="ptm-user-select" id="ptm-user-select">
                                    <option value="">Loading users…</option>
                                </select>
                            </div>
                        </div>

                    </div>

                    <!-- Right Date Filters -->
                    <div class="ptm-nav-right">
                        <div class="ptm-date-group">
                            <div class="ptm-date-label">From Date</div>
                            <input type="date" class="ptm-date-input" id="ptm-from-date" />
                        </div>
                        <div class="ptm-date-group">
                            <div class="ptm-date-label">To Date</div>
                            <input type="date" class="ptm-date-input" id="ptm-to-date" />
                        </div>
                        <div class="ptm-date-group">
                            <div class="ptm-date-label">Due By</div>
                            <input type="date" class="ptm-date-input" id="ptm-due-by" />
                        </div>
                        <div class="ptm-date-group ptm-reset-group">
                            <div class="ptm-date-label ptm-date-label-spacer">&nbsp;</div>
                            <button class="ptm-btn-reset" id="ptm-navbar-reset">Reset</button>
                        </div>
                    </div>
                </div>

                <!-- ── Body ───────────────────────────────────────── -->
                <div class="ptm-body">

                    <!-- Summary Cards -->
                    <div id="ptm-active-status-container"></div>

                    <div class="ptm-cards-grid" id="ptm-cards-grid">
                        <!-- TOTAL TASKS -->
                        <div class="ptm-card" data-status="" style="--card-color:#1e293b;">
                            <div class="ptm-card-accent"></div>
                            <div class="ptm-card-body">
                                <div class="ptm-card-label">Total Tasks</div>
                                <div class="ptm-card-value" id="ptm-stat-total">0</div>
                                <div class="ptm-card-subtext" id="ptm-stat-total-sub">For ${frappe.session.user_fullname || frappe.session.user}</div>
                            </div>
                        </div>
                        <!-- OPEN -->
                        <div class="ptm-card" data-status="Open" style="--card-color:#3b82f6;">
                            <div class="ptm-card-accent"></div>
                            <div class="ptm-card-body">
                                <div class="ptm-card-label">Open</div>
                                <div class="ptm-card-value" id="ptm-stat-open">0</div>
                                <div class="ptm-card-subtext">Ready to start</div>
                            </div>
                        </div>
                        <!-- WORKING -->
                        <div class="ptm-card" data-status="Working" style="--card-color:#f59e0b;">
                            <div class="ptm-card-accent"></div>
                            <div class="ptm-card-body">
                                <div class="ptm-card-label">Working</div>
                                <div class="ptm-card-value" id="ptm-stat-working">0</div>
                                <div class="ptm-card-subtext">Currently in progress</div>
                            </div>
                        </div>
                        <!-- PENDING REVIEW -->
                        <div class="ptm-card" data-status="Pending Review" style="--card-color:#8b5cf6;">
                            <div class="ptm-card-accent"></div>
                            <div class="ptm-card-body">
                                <div class="ptm-card-label">Pending Review</div>
                                <div class="ptm-card-value" id="ptm-stat-pending-review">0</div>
                                <div class="ptm-card-subtext">Waiting for review</div>
                            </div>
                        </div>
                        <!-- OVERDUE -->
                        <div class="ptm-card" data-status="Overdue" style="--card-color:#ef4444;">
                            <div class="ptm-card-accent"></div>
                            <div class="ptm-card-body">
                                <div class="ptm-card-label">Overdue</div>
                                <div class="ptm-card-value" id="ptm-stat-overdue">0</div>
                                <div class="ptm-card-subtext">Past expected end date</div>
                            </div>
                        </div>
                        <!-- COMPLETED -->
                        <div class="ptm-card" data-status="Completed" style="--card-color:#10b981;">
                            <div class="ptm-card-accent"></div>
                            <div class="ptm-card-body">
                                <div class="ptm-card-label">Completed</div>
                                <div class="ptm-card-value" id="ptm-stat-completed">0</div>
                                <div class="ptm-card-subtext">Finished tasks</div>
                            </div>
                        </div>
                    </div>

                    <!-- Projects & Tasks record section (25% list / 75% form) -->
                    <div id="ptm-records-host"></div>

                </div>
            </div>
        `);
    }

    /* ─────────────────────────── Events ─────────────────────────── */
    bind_events() {
        var me = this;

        // View toggle buttons
        $(document).on('click', '.ptm-view-btn', function() {
            var view = $(this).data('view');
            me.filters.view = view;
            $('.ptm-view-btn').removeClass('active');
            $(this).addClass('active');
            me.apply_scope_change();
        });

        // User select change
        $(document).on('change', '#ptm-user-select', function() {
            me.filters.user = $(this).val();
            var name = $(this).find('option:selected').text();
            $('#ptm-stat-total-sub').text('For ' + name);
            me.apply_scope_change();
        });

        // Navbar date filters – apply automatically as soon as a value changes
        $(document).on('change', '#ptm-from-date, #ptm-to-date, #ptm-due-by', function() {
            me.filters.from_date = $('#ptm-from-date').val();
            me.filters.to_date   = $('#ptm-to-date').val();
            me.filters.due_by    = $('#ptm-due-by').val();
            me.apply_scope_change();
        });

        // Navbar reset
        $(document).on('click', '#ptm-navbar-reset', function() {
            $('#ptm-from-date, #ptm-to-date, #ptm-due-by').val('');
            me.filters.from_date = '';
            me.filters.to_date   = '';
            me.filters.due_by    = '';
            me.apply_scope_change();
        });

        // Summary card click – applies the card's status filter to the tree.
        // Total Tasks (data-status="") always returns to the full scoped list.
        // A status card toggles off when clicked a second time.
        $(document).on('click', '.ptm-card', function() {
            var status = $(this).data('status') || '';
            if (status && me.filters.status_card === status) status = '';
            me.set_status_filter(status);
        });

        // Dismiss status pill
        $(document).on('click', '#ptm-pill-dismiss', function() {
            me.set_status_filter('');
        });
    }

    // Refresh both the summary cards and the Project/Task tree for the current
    // assignment + date scope, keeping them in sync.
    apply_scope_change() {
        this.load_dashboard_data();
        if (this.records && typeof this.records.apply_scope === 'function') {
            this.records.apply_scope();
        }
    }

    // Single source of truth for the status filter. Updates the card's active
    // visual state, the indicator pill, and the left-side Project/Task tree.
    // Passing '' clears the filter (all scoped tasks).
    set_status_filter(status, opts) {
        opts = opts || {};
        status = status || '';
        this.filters.status_card = status;

        $('.ptm-card').removeClass('active-filter');
        var $card = status
            ? $('.ptm-card[data-status="' + status + '"]')
            : $('.ptm-card[data-status=""]');
        $card.addClass('active-filter');

        if (opts.apply === false) return;

        if (status) this._show_status_pill(status);
        else $('#ptm-active-status-container').empty();

        if (this.records && typeof this.records.apply_status_filter === 'function') {
            this.records.apply_status_filter(status);
        }
    }

    _show_status_pill(label) {
        $('#ptm-active-status-container').html(`
            <span class="ptm-active-status-pill">
                Filtered: ${label}
                <button id="ptm-pill-dismiss" title="Clear filter">×</button>
            </span>
        `);
    }

    /* ─────────────────────────── Data Loaders ─────────────────────── */
    load_user_list() {
        var me = this;
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'User',
                filters: [['enabled', '=', 1], ['user_type', '=', 'System User']],
                fields: ['name', 'full_name'],
                limit_page_length: 500
            },
            callback: function(r) {
                var users = (r && r.message) ? r.message : [];
                var $sel = $('#ptm-user-select').empty();
                var current = me.filters.user;
                users.forEach(function(u) {
                    var label = u.full_name || u.name;
                    $sel.append($('<option>').val(u.name).text(label));
                });
                // Set to current logged-in user
                $sel.val(current);
                if (!$sel.val() && users.length) {
                    $sel.val(users[0].name);
                    me.filters.user = $sel.val();
                }
                var selectedName = $sel.find('option:selected').text();
                $('#ptm-stat-total-sub').text('For ' + selectedName);
            }
        });
    }

    load_dashboard_data() {
        var me = this;
        $('#ptm-loading-indicator').show().text('Loading tasks…');

        // Build filters for task count queries
        var base_filters = me._build_filters();

        // Count all statuses in parallel
        var status_map = {
            'total':          null,
            'open':           'Open',
            'working':        'Working',
            'pending_review': 'Pending Review',
            'completed':      'Completed'
        };

        var promises = [];
        var results  = {};

        // Total count
        promises.push(me._count_tasks(base_filters, null).then(function(n) { results.total = n; }));
        promises.push(me._count_tasks(base_filters, 'Open').then(function(n) { results.open = n; }));
        promises.push(me._count_tasks(base_filters, 'Working').then(function(n) { results.working = n; }));
        promises.push(me._count_tasks(base_filters, 'Pending Review').then(function(n) { results.pending_review = n; }));
        promises.push(me._count_tasks(base_filters, 'Completed').then(function(n) { results.completed = n; }));

        // Overdue: exp_end_date < today AND status != Completed
        promises.push(me._count_overdue(base_filters).then(function(n) { results.overdue = n; }));

        Promise.all(promises).then(function() {
            me._update_cards(results);
            $('#ptm-loading-indicator').text('No tasks found matching the current filters.').toggle(results.total === 0);
        }).catch(function() {
            $('#ptm-loading-indicator').text('Error loading data. Please try again.');
        });
    }

    _build_filters() {
        var me = this;
        var filters = [];

        // Assignment view
        if (me.filters.view === 'assigned_to') {
            // Tasks assigned to the selected user (Task.assignee).
            if (me.filters.user) filters.push(['assignee', '=', me.filters.user]);
        } else {
            // "Assigned by Me" – tasks the logged-in user owns/created.
            filters.push(['owner', '=', frappe.session.user]);
        }

        // Dates
        if (me.filters.from_date) filters.push(['modified', '>=', me.filters.from_date]);
        if (me.filters.to_date)   filters.push(['modified', '<=', me.filters.to_date]);
        if (me.filters.due_by)    filters.push(['exp_end_date', '<=', me.filters.due_by]);

        return filters;
    }

    _count_tasks(base_filters, status) {
        var filters = base_filters.slice();
        if (status) filters.push(['status', '=', status]);

        return new Promise(function(resolve) {
            frappe.call({
                method: 'frappe.client.get_count',
                args: { doctype: 'Task', filters: filters },
                callback: function(r) { resolve((r && r.message) ? r.message : 0); },
                error: function() { resolve(0); }
            });
        });
    }

    _count_overdue(base_filters) {
        var today = frappe.datetime.get_today();
        var filters = base_filters.slice();
        filters.push(['exp_end_date', '<', today]);
        filters.push(['status', 'not in', ['Completed', 'Cancelled']]);

        return new Promise(function(resolve) {
            frappe.call({
                method: 'frappe.client.get_count',
                args: { doctype: 'Task', filters: filters },
                callback: function(r) { resolve((r && r.message) ? r.message : 0); },
                error: function() { resolve(0); }
            });
        });
    }

    _update_cards(data) {
        $('#ptm-stat-total').text(data.total || 0);
        $('#ptm-stat-open').text(data.open || 0);
        $('#ptm-stat-working').text(data.working || 0);
        $('#ptm-stat-pending-review').text(data.pending_review || 0);
        $('#ptm-stat-overdue').text(data.overdue || 0);
        $('#ptm-stat-completed').text(data.completed || 0);
    }
};

// ─────────────────────────────────────────────────────────────────────────
//  Projects & Tasks record pane
//  A BD Control Center style master/detail section: 25% left pane (a Project
//  selector plus the list of that project's Tasks) and a 75% right pane that
//  opens the selected Project/Task in an editable form built from the doctype
//  meta, with Save and Open Original Doc actions.
// ─────────────────────────────────────────────────────────────────────────
crm_customization.PTMRecordsPane = class extends crm_customization.BDCCListPane {
    constructor(page) {
        super();
        this.page = page;
        this.$panel = null;
        this.controller = {
            page: page,
            prefill_form_context() {},
        };

        this._expanded = {};          // project name -> true while its task list is open
        this._project_tasks = {};     // project name -> loaded task rows
        this._task_counts = {};       // project name -> number of tasks
        this._counts_sig = '';        // signature of the project names counts were loaded for
        this._counts_request = 0;
        this._counts_ready = false;
        this._status_filter = '';     // '' = All Statuses, else a Task status / 'Overdue'
        this._task_search = [];       // tasks matching the current search box query
        this._search_timer = null;
        this._task_search_request = 0;
        this._record_doctype = '';
        this._record_doc = null;
        this._controls = {};

        this._saved_doc = '';
        this._load_seq = 0;
        this._list_data = [];
        this._list_query = '';
        this._active_list_item = '';
        this._list_request = 0;
        this._applied_scope = null;
        this._loading = false;
        this._silent = 0;
        this._dirty = false;
        this._baseline = null;
        this._user_edited = false;
    }

    render($host) {
        crm_customization.ensure_base_section_styles();
        this.$panel = $host;

        $host.html(`
            <div class="sc-split ptx-split">
                ${this.list_pane_html()}
                <section class="sc-split-right">
                    <div class="ptm-record-toolbar">
                        <div class="ptm-record-title" id="ptx-record-title">No record selected</div>
                        <div class="ptm-record-actions">
                            <button class="sc-btn sc-btn-outline" id="ptx-open-doc">Open Original Doc</button>
                            <button class="sc-btn sc-btn-primary" id="ptx-save-record">Save</button>
                        </div>
                    </div>
                    <div id="ptx-context-cards"></div>
                    <div class="ptm-connections" id="ptx-connections"></div>
                    <div class="ptm-record-form" id="ptx-record-form">
                        <div class="ptm-record-placeholder">Select a project or task on the left to view and edit it here.</div>
                    </div>
                </section>
            </div>
        `);

        this.bind_user_edit_signal();
        this.wire_buttons();
        this._loading = false;
        this.mount_list_pane();
    }

    // Extend the shared pane so the one search box also looks up tasks, not
    // just projects. The base handler keeps the instant local project filter;
    // this adds a debounced server query for matching tasks on top.
    mount_list_pane() {
        super.mount_list_pane();

        const p = this.list_prefix();
        $(`#${p}-list-search`).on('input', () => {
            const q = ($(`#${p}-list-search`).val() || '').trim();
            clearTimeout(this._search_timer);
            // Drop results from the previous query so stale task rows don't
            // linger while the new request is in flight.
            this._task_search = [];
            this.render_list();
            if (!q) {
                this._task_search_request++;
                return;
            }
            this._search_timer = setTimeout(() => this.search_tasks(q), 300);
        });

        this.insert_status_filter();
    }

    // Status dropdown below the search box. Options mirror the dashboard
    // summary cards: All Statuses (default) / Open / Working / Pending Review /
    // Overdue / Completed.
    insert_status_filter() {
        const p = this.list_prefix();
        const $head = $(`.ptx-split #${p}-list-body`).closest('.sc-split-left').find('.sc-list-head');
        if (!$head.length || $head.find('#ptx-status-filter').length) return;

        const $sel = $('<select id="ptx-status-filter" class="ptx-status-select"></select>');
        [
            ['', __('All Statuses')],
            ['Open', __('Open')],
            ['Working', __('Working')],
            ['Pending Review', __('Pending Review')],
            ['Overdue', __('Overdue')],
            ['Completed', __('Completed')],
        ].forEach(([value, label]) => $sel.append($('<option></option>').val(value).text(label)));
        $sel.val(this._status_filter || '');

        $('<div class="ptx-status-filter"></div>').append($sel).insertAfter($head.find('.sc-list-tools'));

        $sel.on('change', () => {
            const val = $sel.val() || '';
            // Route through the dashboard so the summary cards' active state
            // and the indicator pill stay in sync with the dropdown.
            if (this.page && typeof this.page.set_status_filter === 'function') {
                this.page.set_status_filter(val);
            } else {
                this.apply_status_filter(val);
            }
        });
    }

    // Translates the dropdown selection into Task query filters.
    status_task_filters() {
        const s = this._status_filter;
        if (!s) return [];
        if (s === 'Overdue') {
            return [
                ['exp_end_date', '<', frappe.datetime.get_today()],
                ['status', 'not in', ['Completed', 'Cancelled']],
            ];
        }
        return [['status', '=', s]];
    }

    // Assignment + date scope. Shared with the dashboard summary cards so the
    // tree and the cards always describe the same set of tasks.
    scope_task_filters() {
        if (this.page && typeof this.page._build_filters === 'function') {
            return this.page._build_filters() || [];
        }
        return [];
    }

    // Full filter set applied to every Task query the tree makes: the shared
    // scope plus the selected status.
    task_filters() {
        return [...this.scope_task_filters(), ...this.status_task_filters()];
    }

    // Called by the dashboard when a summary card is clicked: adopt the status,
    // keep the dropdown in sync, and reload the tree.
    apply_status_filter(status) {
        this._status_filter = status || '';
        $('#ptx-status-filter').val(this._status_filter);
        this.on_status_filter_change();
    }

    // Called by the dashboard when the assignment view / user / dates change so
    // the tree reloads under the new scope.
    apply_scope() {
        this._counts_sig = '';
        this._counts_ready = false;
        this._task_counts = {};
        this._project_tasks = {};

        this.load_list();

        const q = (this._list_query || '').trim();
        if (q) this.search_tasks(q);

        Object.keys(this._expanded).forEach((name) => {
            if (this._expanded[name]) this.load_project_tasks(name);
        });
    }

    on_status_filter_change() {
        // Counts and cached tasks were computed under the previous status, so
        // drop them and let the list/sublists reload with the new filter.
        this._counts_sig = '';
        this._counts_ready = false;
        this._task_counts = {};
        this._project_tasks = {};

        const q = (this._list_query || '').trim();
        if (q) this.search_tasks(q);

        this.render_list();

        Object.keys(this._expanded).forEach((name) => {
            if (this._expanded[name]) this.load_project_tasks(name);
        });
    }

    search_tasks(q) {
        // frappe.client.get_list does NOT support or_filters — they are silently
        // dropped by the server. Run two parallel calls instead (one matching on
        // `name`, the other on `subject`) and merge/deduplicate the results so
        // exact task-ID lookups and subject searches both work.
        const req = ++this._task_search_request;
        const FIELDS = ['name', 'subject', 'status', 'priority', 'exp_end_date', 'assignee', 'project', 'is_group', 'parent_task', 'progress'];
        const ORDER  = 'modified desc';
        const LIMIT  = 50;
        const STATUS = this.task_filters();

        const by_name = new Promise((resolve) => {
            frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Task',
                    fields: FIELDS,
                    filters: [['name', 'like', `%${q}%`], ...STATUS],
                    order_by: ORDER,
                    limit_page_length: LIMIT,
                },
                callback: (r) => resolve((r && r.message) || []),
                error:    ()  => resolve([]),
            });
        });

        const by_subject = new Promise((resolve) => {
            frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Task',
                    fields: FIELDS,
                    filters: [['subject', 'like', `%${q}%`], ...STATUS],
                    order_by: ORDER,
                    limit_page_length: LIMIT,
                },
                callback: (r) => resolve((r && r.message) || []),
                error:    ()  => resolve([]),
            });
        });

        Promise.all([by_name, by_subject]).then(([name_rows, subj_rows]) => {
            if (req !== this._task_search_request) return;
            // Guard: if the user kept typing and _list_query moved on, discard.
            if ((this._list_query || '').trim() !== q) return;

            // Merge and deduplicate by task name.
            const seen = new Set();
            const merged = [];
            [...name_rows, ...subj_rows].forEach((row) => {
                if (!seen.has(row.name)) {
                    seen.add(row.name);
                    merged.push(row);
                }
            });

            this._task_search = merged;
            this.render_list();
        });
    }

    // ─────────────────────────────────────────────
    //  LEFT PANE
    // ─────────────────────────────────────────────
    list_prefix() { return 'ptx'; }
    list_title() { return __('Projects'); }
    list_search_hint() { return __('Search projects or tasks'); }
    list_doctype() { return 'Project'; }
    list_fields() { return ['name', 'project_name', 'status', 'priority', 'percent_complete']; }
    list_order_by() { return 'modified desc'; }
    list_empty_message() { return __('No projects found.'); }

    list_filters() { return []; }

    list_scope_parts() { return []; }

    list_row_title(row) { return row.project_name || row.name; }
    list_row_badge(row) { return row.status || ''; }
    list_row_meta(row) { return [row.name, row.priority]; }
    list_match(row) {
        return [row.name, row.project_name, row.status, row.priority]
            .filter(Boolean).join(' ');
    }

    load_list_record(name) { this.load_record('Project', name); }
    new_list_record() {}

    // Render each Project as an expandable node: clicking the row loads the
    // project on the right, while the caret reveals that project's tasks, each
    // of which loads the task on the right when clicked.
    render_list(empty_msg) {
        const p = this.list_prefix();
        const $body = $(`#${p}-list-body`);
        if (!$body.length) return;

        const query = (this._list_query || '').trim();
        let rows = this._filtered_list();
        const tasks = query ? (this._task_search || []) : [];

        // Fetch per-project task counts once for the currently listed projects.
        // The signature includes the status filter so switching it refetches.
        const proj_names = (this._list_data || []).map((r) => r.name).filter(Boolean);
        const sig = `${this._status_filter}||${JSON.stringify(this.scope_task_filters())}||${proj_names.join('|')}`;
        if (proj_names.length && sig !== this._counts_sig) {
            this._counts_sig = sig;
            this._counts_ready = false;
            this.load_project_task_counts(proj_names);
        }

        // With a status selected, keep only projects that have matching tasks.
        if (this._status_filter) {
            rows = rows.filter((row) => (this._task_counts[row.name] || 0) > 0);
        }
        $(`#${p}-list-count`).text(rows.length + tasks.length);

        if (!rows.length && !tasks.length) {
            let msg;
            if (empty_msg) msg = empty_msg;
            else if (this._status_filter && !this._counts_ready) msg = __('Loading...');
            else if (query) msg = __('No matching project or task.');
            else if (this._status_filter) msg = __('No projects match the selected status.');
            else msg = this.list_empty_message();
            $body.html(`<div class="sc-list-empty">${frappe.utils.escape_html(msg)}</div>`);
            return;
        }

        const esc = (v) => frappe.utils.escape_html(v == null ? '' : String(v));

        let html = rows.map((row) => {
            const name = row.name || '';
            const active = name && name === this._active_list_item ? ' active' : '';
            const badge = this.list_row_badge(row);
            const expanded = !!this._expanded[name];
            const meta = (this.list_row_meta(row) || []).filter(Boolean);
            const cnt = this._task_counts[name];
            const count_label = cnt === undefined || cnt === null
                ? ''
                : (cnt === 1 ? __('1 Task') : __('{0} Tasks', [cnt]));

            return `
                <div class="ptx-project-node${expanded ? ' expanded' : ''}" data-project="${esc(name)}">
                    <button type="button" class="sc-list-item ptx-project-item${active}" data-name="${esc(name)}" data-doctype="Project" title="${esc(name)}">
                        <span class="ptx-expander" data-project="${esc(name)}">${expanded ? '&#9662;' : '&#9656;'}</span>
                        <span class="sc-list-item-title">
                            <span class="sc-list-item-name">${esc(this.list_row_title(row))}</span>
                            ${badge ? `<span class="sc-list-item-badge">${esc(badge)}</span>` : ''}
                            ${count_label ? `<span class="ptx-task-count">${esc(count_label)}</span>` : ''}
                        </span>
                        ${meta.length ? `<span class="sc-list-item-meta">${esc(meta.join(' · '))}</span>` : ''}
                    </button>
                    <div class="ptx-task-sublist" data-project="${esc(name)}"></div>
                </div>
            `;
        }).join('');

        // Server search across Task surfaces here, below the matching projects.
        if (tasks.length) {
            html += `<div class="ptx-search-group">${__('Matching Tasks')}</div>`;
            html += tasks.map((t) => this._task_card_html(t, { extraClass: 'ptx-search-task' })).join('');
        }

        $body.html(html);

        $body.find('.ptx-project-item').on('click', (e) => {
            if ($(e.target).closest('.ptx-expander').length) return;
            const name = $(e.currentTarget).data('name');
            if (!name) return;
            // Opening a project also reveals its tasks (without collapsing an
            // already-open list; the caret is the explicit collapse control).
            if (!this._expanded[name]) this.toggle_project_tasks(name);
            this.select_from_list(name, 'Project');
        });

        $body.find('.ptx-expander').on('click', (e) => {
            e.stopPropagation();
            this.toggle_project_tasks($(e.currentTarget).data('project'));
        });

        $body.find('.ptx-search-task').on('click', (e) => {
            e.stopPropagation();
            const name = $(e.currentTarget).data('name');
            if (name) this.select_from_list(name, 'Task');
        });

        // Re-render any sublists that were already open before this redraw.
        Object.keys(this._expanded).forEach((name) => {
            if (this._expanded[name]) this.render_project_tasks(name);
        });
    }

    toggle_project_tasks(project) {
        if (!project) return;
        const $node = $(`.ptx-project-node[data-project="${project}"]`);
        if (!$node.length) return;

        const is_open = !!this._expanded[project];
        this._expanded[project] = !is_open;
        $node.toggleClass('expanded', !is_open);
        $node.find('.ptx-expander').first().html(is_open ? '&#9656;' : '&#9662;');
        $node.find('.ptx-task-sublist').toggle(!is_open);

        if (is_open) return;

        if (this._project_tasks[project]) {
            this.render_project_tasks(project);
        } else {
            this.load_project_tasks(project);
        }
    }

    load_project_task_counts(names) {
        if (!names || !names.length) {
            this._task_counts = {};
            this._counts_ready = true;
            return;
        }
        const req = ++this._counts_request;
        frappe.call({
            method: 'frappe.desk.reportview.get_list',
            args: {
                doctype: 'Task',
                fields: ['project'],
                filters: [['project', 'in', names], ...this.task_filters()],
                group_by: 'project',
                aggregate_function: 'count',
                aggregate_on_doctype: 'Task',
                aggregate_on_field: 'name',
                order_by: 'project',
                limit_page_length: 0,
            },
            callback: (r) => {
                if (req !== this._counts_request) return;
                const map = {};
                names.forEach((n) => { map[n] = 0; });
                (r.message || []).forEach((row) => {
                    if (row.project) map[row.project] = parseInt(row._aggregate_column, 10) || 0;
                });
                this._task_counts = map;
                this._counts_ready = true;
                this.render_list();
            },
        });
    }

    load_project_tasks(project) {
        const $sub = $(`.ptx-task-sublist[data-project="${project}"]`);
        if ($sub.length) $sub.html(`<div class="ptx-sublist-loading">${__('Loading tasks...')}</div>`);

        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Task',
                fields: ['name', 'subject', 'status', 'priority', 'exp_end_date', 'assignee', 'is_group', 'parent_task', 'progress'],
                filters: [['project', '=', project], ...this.task_filters()],
                order_by: 'modified desc',
                limit_page_length: 200,
            },
            callback: (r) => {
                this._project_tasks[project] = r.message || [];
                this.render_project_tasks(project);
            },
            error: () => {
                if ($sub.length) $sub.html(`<div class="ptx-sublist-empty">${__('Could not load tasks.')}</div>`);
            },
        });
    }

    // Compact task card: left = subject + "Is Group" tag, center = % progress,
    // right = days until due.
    _task_card_html(t, opts) {
        opts = opts || {};
        const esc = (v) => frappe.utils.escape_html(v == null ? '' : String(v));
        const active = (t.name && t.name === this._active_list_item) ? ' active' : '';
        const group = t.is_group ? ' ptx-task-group' : '';
        const child = opts.indent ? ' ptx-task-child' : '';
        const extra = opts.extraClass ? ' ' + opts.extraClass : '';

        const due = this._due_info(t.exp_end_date);
        const progress = (t.progress === null || t.progress === undefined || t.progress === '')
            ? 0 : Math.round(parseFloat(t.progress) || 0);

        return `
            <button type="button" class="sc-list-item ptx-task-item ptx-task-card${group}${child}${extra}${active}"
                    data-name="${esc(t.name)}" data-doctype="Task"
                    title="${esc(t.subject || t.name)}">
                <span class="ptx-task-main">
                    <span class="ptx-task-name">${esc(t.subject || t.name)}</span>
                    ${t.is_group ? `<span class="ptx-task-istag">${__('Is Group')}</span>` : ''}
                </span>
                ${t.status ? `<span class="ptx-task-status" title="${esc(t.status)}">${esc(t.status)}</span>` : ''}
                <span class="ptx-task-progress" title="${__('% Progress')}">${progress}%</span>
                <span class="ptx-task-due${due.cls ? ' ' + due.cls : ''}" title="${esc(due.title)}">${esc(due.label)}</span>
            </button>
        `;
    }

    _due_info(v) {
        if (!v) return { label: '', cls: '', title: '' };
        const today = frappe.datetime.get_today();
        let diff = 0;
        try { diff = frappe.datetime.get_diff(v, today); } catch (e) { diff = 0; }
        const date_txt = (frappe.datetime.str_to_user && frappe.datetime.str_to_user(v)) || v;
        if (diff < 0) {
            return { label: __('{0}d overdue', [Math.abs(diff)]), cls: 'overdue',
                title: __('Due {0} · {1} days overdue', [date_txt, Math.abs(diff)]) };
        }
        if (diff === 0) {
            return { label: __('Due today'), cls: 'today',
                title: __('Due today ({0})', [date_txt]) };
        }
        return { label: __('Due in {0}d', [diff]), cls: diff <= 3 ? 'soon' : '',
            title: __('Due in {0} days ({1})', [diff, date_txt]) };
    }

    render_project_tasks(project) {
        const $sub = $(`.ptx-task-sublist[data-project="${project}"]`);
        if (!$sub.length) return;

        const tasks = this._project_tasks[project] || [];
        if (!tasks.length) {
            $sub.html(`<div class="ptx-sublist-empty">${
                this._status_filter ? __('No matching tasks in this project.') : __('No tasks in this project.')
            }</div>`);
            return;
        }

        // Group tasks first, their child tasks (parent_task) nested directly
        // beneath; everything else follows.
        const groupNames = new Set(tasks.filter((t) => t.is_group).map((t) => t.name));
        const children = {};
        const rest = [];
        tasks.forEach((t) => {
            if (t.is_group) return;
            if (t.parent_task && groupNames.has(t.parent_task)) {
                (children[t.parent_task] = children[t.parent_task] || []).push(t);
            } else {
                rest.push(t);
            }
        });

        const ordered = [];
        tasks.filter((t) => t.is_group).forEach((g) => {
            ordered.push({ t: g, indent: false });
            (children[g.name] || []).forEach((c) => ordered.push({ t: c, indent: true }));
        });
        rest.forEach((t) => ordered.push({ t: t, indent: false }));

        $sub.html(ordered.map((x) => this._task_card_html(x.t, { indent: x.indent })).join(''));

        $sub.find('.ptx-task-item').on('click', (e) => {
            e.stopPropagation();
            const name = $(e.currentTarget).data('name');
            if (name) this.select_from_list(name, 'Task');
        });
    }

    select_from_list(name, doctype) {
        if (!name) return;
        doctype = doctype || this.list_doctype();

        if (name === this._saved_doc && doctype === this._record_doctype) {
            this.set_active_list_item(name);
            return;
        }

        const proceed = () => {
            this.set_active_list_item(name);
            this.load_record(doctype, name);
        };

        if (this.is_dirty()) {
            this.confirm_discard_changes(proceed);
            return;
        }

        proceed();
    }

    reset_after_discard() {
        if (this._saved_doc && this._record_doctype) {
            this.load_record(this._record_doctype, this._saved_doc);
            return;
        }
        $('#ptx-connections').empty();
        super.reset_after_discard();
    }

    // ─────────────────────────────────────────────
    //  RIGHT PANE — record loading
    // ─────────────────────────────────────────────
    load_record(doctype, name) {
        const me = this;
        const seq = ++this._load_seq;
        this._loading = true;

        frappe.call({
            method: 'frappe.client.get',
            args: { doctype: doctype, name: name },
            callback: function(r) {
                if (seq !== me._load_seq || !r.message) return;
                me._record_doctype = doctype;
                me._saved_doc = name;
                me._record_doc = r.message;
                me.build_record_form(doctype, r.message);
                me.refresh_record_title(doctype, r.message);
                me.set_active_list_item(name);
                me.after_record_loaded();
            },
            error: function() {
                me._loading = false;
            },
        });
    }

    after_record_loaded() {
        this._loading = false;
        this.capture_dirty_baseline(250);
        this.render_context_cards(this._record_doctype, this._record_doc);
        this.render_connections(this._record_doctype, this._saved_doc);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  CONTEXT CARDS  —  Business Request / Customer / Subsidiary / Project
    //  Shown above the Connections section for both Project and Task forms.
    //  For Tasks we resolve the values via the linked Project document.
    // ─────────────────────────────────────────────────────────────────────
    render_context_cards(doctype, doc) {
        const $host = $('#ptx-context-cards');
        if (!$host.length || !doc) { $host.empty(); return; }

        if (doctype === 'Project') {
            this._build_context_cards($host, {
                business_request:   doc.custom_business_request || '',
                customer:           doc.customer                || '',
                subsidiary_company: doc.custom_lead             || '',
                project:            doc.name                    || '',
            });
        } else if (doctype === 'Task') {
            // Resolve via the linked Project.  Show a skeleton immediately then
            // fill in once the Project doc arrives.
            const project_name = doc.project || '';
            this._build_context_cards($host, {
                business_request:   '',
                customer:           '',
                subsidiary_company: '',
                project:            project_name,
            }, true /* loading */);

            if (!project_name) return;

            frappe.call({
                method: 'frappe.client.get',
                args: { doctype: 'Project', name: project_name },
                callback: (r) => {
                    if (!r.message) return;
                    const proj = r.message;
                    this._build_context_cards($host, {
                        business_request:   proj.custom_business_request || '',
                        customer:           proj.customer                || '',
                        subsidiary_company: proj.custom_lead             || '',
                        project:            project_name,
                    });
                },
                error: () => {},
            });
        } else {
            $host.empty();
        }
    }

    _build_context_cards($host, ctx, loading) {
        const esc = (v) => frappe.utils.escape_html(v == null ? '' : String(v));

        const cards = [
            {
                label:    __('Business Request'),
                value:    ctx.business_request,
                doctype:  'Business Request',
                color:    '#6366f1',
            },
            {
                label:    __('Customer'),
                value:    ctx.customer,
                doctype:  'Customer',
                color:    '#0ea5e9',
            },
            {
                label:    __('Subsidiary Company'),
                value:    ctx.subsidiary_company,
                doctype:  'Lead',
                color:    '#f59e0b',
            },
            {
                label:    __('Project'),
                value:    ctx.project,
                doctype:  'Project',
                color:    '#10b981',
            },
        ];

        $host.html(`
            <div class="ptm-ctx-cards">
                ${cards.map((c) => {
                    const empty   = !c.value;
                    const display = loading && !c.value ? '\u2026' : (c.value || __('Not set'));
                    const is_link = !empty && !loading ? ' is-link' : '';
                    return `
                        <div class="ptm-ctx-card${is_link}" style="--ctx-color:${esc(c.color)};"
                             data-doctype="${esc(c.doctype)}" data-name="${esc(c.value)}">
                            <div class="ptm-ctx-card-accent"></div>
                            <div class="ptm-ctx-card-label">${esc(c.label)}</div>
                            <div class="ptm-ctx-card-value${empty && !loading ? ' is-empty' : ''}">${esc(display)}</div>
                            ${is_link ? '<span class="ptm-ctx-card-open-icon" aria-hidden="true">&#8599;</span>' : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        `);

        // Clicking a populated card opens the linked document in a new form.
        $host.find('.ptm-ctx-card.is-link').on('click', function() {
            const dt   = $(this).data('doctype');
            const name = $(this).data('name');
            if (dt && name) frappe.set_route('Form', dt, name);
        });
    }

    // Teleport helper for Link dropdowns inside child tables (matches BDCC)
    _teleport_link_dropdown(ctrl, $cell) {
        if (!ctrl || !$cell || !$cell.length) return;
        const input = ctrl.$input && ctrl.$input[0];
        if (!input) return;
        const root = $cell[0].querySelector('.awesomplete');
        const ul = root ? root.querySelector('[role="listbox"], ul') : null;
        if (!ul) return;
        let open = false;
        const reposition = () => {
            if (!open) return;
            const rect = input.getBoundingClientRect();
            if (!rect.width) return;
            ul.style.top = (rect.bottom + 2) + 'px';
            ul.style.left = Math.min(rect.left, window.innerWidth - 280) + 'px';
            ul.style.width = Math.max(rect.width, 240) + 'px';
        };
        const openList = () => {
            open = true;
            document.body.appendChild(ul);
            ul.classList.add('sc-table-dd-teleported', 'ptm-dd-teleported');
            reposition();
            window.addEventListener('scroll', reposition, true);
        };
        const closeList = () => {
            open = false;
            window.removeEventListener('scroll', reposition, true);
            ul.classList.remove('sc-table-dd-teleported', 'ptm-dd-teleported');
            ul.style.top = ''; ul.style.left = ''; ul.style.width = '';
            if (root && ul.parentElement !== root) root.appendChild(ul);
        };
        ctrl.$input.off('awesomplete-open.ptm-teleport').on('awesomplete-open.ptm-teleport', openList);
        ctrl.$input.off('awesomplete-close.ptm-teleport').on('awesomplete-close.ptm-teleport', closeList);
    }
    render_connections(doctype, name) {
        const $host = $('#ptx-connections');
        if (!$host.length) return;
        $host.empty();
        if (!doctype || !name) return;

        frappe.model.with_doctype(doctype, () => {
            const dash = frappe.get_meta(doctype).__dashboard || {};
            const groups = (dash.transactions || []).map((g) => ({
                label: g.label,
                items: (g.items || []).filter((dt) => frappe.model.can_read(dt)),
            })).filter((g) => g.items.length);
            if (!groups.length) return;

            const esc = (v) => frappe.utils.escape_html(v == null ? '' : String(v));
            $host.html(`
                <div class="ptm-conn-section collapsed">
                    <div class="ptm-conn-header" role="button" tabindex="0">
                        <span class="ptm-section-caret">&#9662;</span>
                        <h3 class="ptm-conn-title">${__('Connections')}</h3>
                    </div>
                    <div class="ptm-conn-body">
                        <div class="ptm-conn-grid">
                            ${groups.map((g) => `
                                <div class="ptm-conn-group">
                                    <div class="ptm-conn-group-label">${esc(__(g.label || __('Links')))}</div>
                                    <div class="ptm-conn-items">
                                        ${g.items.map((dt) => `
                                            <button type="button" class="ptm-conn-badge" data-doctype="${esc(dt)}">
                                                <span class="ptm-conn-name">${esc(__(dt))}</span>
                                                <span class="ptm-conn-count" data-doctype="${esc(dt)}">&hellip;</span>
                                            </button>
                                        `).join('')}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `);

            $host.off('click.ptm-conn keydown.ptm-conn')
                .on('click.ptm-conn', '.ptm-conn-header', function() {
                    $(this).closest('.ptm-conn-section').toggleClass('collapsed');
                })
                .on('keydown.ptm-conn', '.ptm-conn-header', function(e) {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        $(this).closest('.ptm-conn-section').toggleClass('collapsed');
                    }
                });

            const items = [];
            groups.forEach((g) => g.items.forEach((dt) => items.push(dt)));

            $host.find('.ptm-conn-badge').on('click', (e) => {
                this.open_connected_list(doctype, name, $(e.currentTarget).data('doctype'), dash);
            });

            frappe.call({
                type: 'GET',
                method: 'frappe.desk.notifications.get_open_count',
                args: { doctype: doctype, name: name, items: items },
                callback: (r) => {
                    const count = (r.message && r.message.count) || {};
                    const map = {};
                    (count.internal_links_found || []).forEach((d) => { map[d.doctype] = d; });
                    (count.external_links_found || []).forEach((d) => { map[d.doctype] = d; });
                    $host.find('.ptm-conn-count').each((i, el) => {
                        const dt = $(el).data('doctype');
                        const d = map[dt];
                        const c = d ? d.count : 0;
                        $(el).text(c === '?' ? '?' : (c > 99 ? '99+' : c));
                        $(el).toggleClass('is-zero', c === 0);
                    });
                },
                error: () => $host.find('.ptm-conn-count').text('0'),
            });
        });
    }

    open_connected_list(doctype, name, linked_doctype, dash) {
        if (!linked_doctype) return;
        dash = dash || frappe.get_meta(doctype).__dashboard || {};
        const fieldname = (dash.non_standard_fieldnames || {})[linked_doctype] || dash.fieldname;

        if (!fieldname) {
            frappe.set_route('List', linked_doctype, 'List');
            return;
        }

        // Navigate to the linked list pre-filtered to this document, exactly
        // like clicking a connection badge on a standard form.
        frappe.route_options = {};
        frappe.route_options[fieldname] = name;
        frappe.set_route('List', linked_doctype, 'List');
    }

    refresh_record_title(doctype, doc) {
        $('#ptx-record-title').html(
            `<span class="ptm-record-doctype">${frappe.utils.escape_html(doctype)}</span>` +
            `${frappe.utils.escape_html(doc.name || '')}`
        );
    }

    // Match the DocType form's depends_on rules, including expressions that use
    // other fields in the current (possibly unsaved) document.
    record_condition_is_met(condition, doc) {
        if (!condition) return true;
        if (typeof condition === 'boolean') return condition;
        if (typeof condition === 'function') return !!condition(doc);
        if (condition.indexOf('eval:') === 0) {
            try {
                return !!frappe.utils.eval(condition.slice(5), { doc: doc, parent: doc });
            } catch (e) {
                console.warn('Invalid DocType depends_on expression', condition, e);
                return false;
            }
        }
        // Form script callbacks need a full frm and cannot run on this page.
        if (condition.indexOf('fn:') === 0) return true;
        const value = doc[condition];
        return Array.isArray(value) ? value.length > 0 : !!value;
    }

    refresh_record_field_visibility(groups, saved_doc) {
        const doc = Object.assign({}, saved_doc);
        Object.keys(this._controls).forEach(fieldname => {
            try {
                const value = this._controls[fieldname].get_value();
                if (value !== undefined) doc[fieldname] = value;
            } catch (e) {}
        });

        groups.forEach(g => {
            const section_visible = g.layouts.every(df =>
                !df.hidden && this.record_condition_is_met(df.depends_on, doc)
            );
            let visible_fields = 0;
            g.fields.forEach(f => {
                const visible = section_visible && this.record_condition_is_met(f.depends_on, doc);
                const container = document.getElementById('ptx-fld-' + f.fieldname);
                if (container) container.closest('.ptm-field-group').style.display = visible ? '' : 'none';
                if (visible) visible_fields++;
            });
            const section = document.getElementById(g.id);
            if (section) section.style.display = visible_fields ? '' : 'none';
        });
    }

    // Build an editable form from the doctype meta. Layout fields are turned
    // into section cards; child tables and non-input widgets are skipped so a
    // save never drops rows the form can't edit (see save_record).
    build_record_form(doctype, doc) {
        const me = this;
        this._controls = {};

        frappe.model.with_doctype(doctype, function() {
            const meta = frappe.get_meta(doctype);
            const skip_types = [
                'Section Break', 'Column Break', 'Tab Break', 'Fold',
                'Heading', 'HTML', 'Button',
            ];
            const skip_fields = [
                'name', 'owner', 'creation', 'modified', 'modified_by', 'docstatus',
                'idx', '_user_tags', '_comments', '_assign', '_liked_by',
                'parent', 'parentfield', 'parenttype',
            ];
            // These Task process fields are managed on the original DocType form.
            if (doctype === 'Task') {
                skip_fields.push('process_flow', 'document_url',
                    'process_flow_steps', 'process_flow_checks');
            }
            const groups = [];
            const field_status = {};
            let current = null;
            let tab = null;
            const add_group = function(section) {
                const group = {
                    id: 'ptx-section-' + groups.length,
                    label: section ? section.label || '' : '',
                    section: section,
                    layouts: [tab, section].filter(Boolean),
                    columns: [{ fields: [] }],
                    fields: [],
                };
                groups.push(group);
                return group;
            };

            (meta.fields || []).forEach(function(f) {
                if (f.fieldtype === 'Tab Break') {
                    tab = f;
                    current = null;
                    return;
                }
                if (f.fieldtype === 'Section Break') {
                    current = add_group(f);
                    return;
                }
                if (f.fieldtype === 'Column Break') {
                    if (!current) current = add_group(null);
                    current.columns.push({ fields: [] });
                    return;
                }
                if (skip_types.indexOf(f.fieldtype) !== -1) return;
                if (f.hidden || !f.fieldname || skip_fields.indexOf(f.fieldname) !== -1) return;
                const status = frappe.perm.get_field_display_status(f, doc);
                if (status === 'None') return;
                if (status === 'Read' && is_null(doc[f.fieldname]) &&
                    !['Image', 'Geolocation'].includes(f.fieldtype)) return;
                field_status[f.fieldname] = status;
                if (!current) current = add_group(null);
                current.fields.push(f);
                current.columns[current.columns.length - 1].fields.push(f);
            });

            const esc = frappe.utils.escape_html;
            const html = groups.filter(function(g) { return g.fields.length; }).map(function(g) {
                const task_layout = doctype === 'Task';
                const collapsible = task_layout ? !!(g.section && g.section.collapsible) : !!g.label;
                const collapsed = task_layout
                    ? collapsible && (!g.section.collapsible_depends_on ||
                        !me.record_condition_is_met(g.section.collapsible_depends_on, doc))
                    : collapsible;
                return `
                    <div id="${g.id}" class="ptm-form-section${collapsed ? ' collapsed' : ''}">
                        ${g.label ? `<div class="ptm-form-section-header"${collapsible ? ' data-collapsible="1" role="button" tabindex="0"' : ''}>${collapsible ? '<span class="ptm-section-caret">&#9662;</span>' : ''}<h3>${esc(g.label)}</h3></div>` : ''}
                        <div class="ptm-form-section-body">
                            <div class="ptm-form-grid${task_layout ? '' : ' ptm-form-grid-auto'}"${task_layout ? ` style="--ptm-column-count:${g.columns.length}"` : ''}>
                                ${task_layout ? g.columns.map(function(column) {
                                    return `<div class="ptm-form-column">${column.fields.map(function(f) {
                                        return `<div class="ptm-field-group"><div id="ptx-fld-${f.fieldname}"></div></div>`;
                                    }).join('')}</div>`;
                                }).join('') : g.fields.map(function(f) {
                                    const wide = ['Table', 'Table MultiSelect'].includes(f.fieldtype) ? ' ptm-field-wide' : '';
                                    return `<div class="ptm-field-group${wide}"><div id="ptx-fld-${f.fieldname}"></div></div>`;
                                }).join('')}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            const $form = $('#ptx-record-form');
            $form.html(html || `<div class="ptm-record-placeholder">${__('No editable fields.')}</div>`);
            $form.off('click.ptm-section keydown.ptm-section')
                .on('click.ptm-section', '.ptm-form-section-header[data-collapsible="1"]', function() {
                    $(this).closest('.ptm-form-section').toggleClass('collapsed');
                })
                .on('keydown.ptm-section', '.ptm-form-section-header[data-collapsible="1"]', function(e) {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        $(this).closest('.ptm-form-section').toggleClass('collapsed');
                    }
                });

            groups.forEach(function(g) {
                g.fields.forEach(function(f) {
                    const container = document.getElementById('ptx-fld-' + f.fieldname);
                    if (!container) return;

                    // Child tables get an editable mini-grid (add/remove rows)
                    // so their rows can be viewed and edited like the doctype.
                    if (f.fieldtype === 'Table MultiSelect') {
                        me.build_table_multiselect(f, doc, container, field_status[f.fieldname] === 'Read', groups);
                        return;
                    }
                    if (f.fieldtype === 'Table') {
                        me.build_child_grid(f, doc, container, field_status[f.fieldname] === 'Read');
                        return;
                    }

                    let ctrl = null;
                    try {
                        ctrl = frappe.ui.form.make_control({
                            df: {
                                fieldtype: f.fieldtype,
                                fieldname: f.fieldname,
                                label: f.label || f.fieldname,
                                options: f.options || '',
                                reqd: f.reqd ? 1 : 0,
                                read_only: field_status[f.fieldname] === 'Read' ? 1 : 0,
                                description: f.description || '',
                                change: function() { me.refresh_record_field_visibility(groups, doc); },
                            },
                            parent: container,
                            render_input: true,
                        });
                        ctrl.refresh();
                    } catch (e) {
                        ctrl = null;
                    }

                    if (!ctrl) {
                        container.innerHTML =
                            `<label style="display:block;font-size:12px;font-weight:600;color:#374151;">${esc(f.label || f.fieldname)}</label>` +
                            `<div style="color:#6b7280;font-size:12px;word-break:break-word;">${esc(String(doc[f.fieldname] == null ? '' : doc[f.fieldname]))}</div>`;
                        return;
                    }

                    me._controls[f.fieldname] = ctrl;

                    let val = doc[f.fieldname];
                    if (f.fieldtype === 'Datetime') val = me.normalize_datetime_value(val);
                    else if (f.fieldtype === 'Time') val = me.normalize_time_value(val);
                    if (val === null || val === undefined) val = '';
                    try { ctrl.set_value(val); } catch (e) {}
                });
            });
            me.refresh_record_field_visibility(groups, doc);
        });
    }

    // A Table MultiSelect is a single pill-style field on a DocType form. Keep
    // its child rows intact for saving instead of rendering the table editor.
    build_table_multiselect(f, doc, container, read_only, groups) {
        const me = this;
        frappe.model.with_doctype(f.options, function() {
            if (me._record_doc !== doc || !container.isConnected) return;
            const ctrl = frappe.ui.form.make_control({
                df: {
                    fieldtype: f.fieldtype,
                    fieldname: f.fieldname,
                    label: f.label || f.fieldname,
                    options: f.options,
                    reqd: f.reqd ? 1 : 0,
                    read_only: read_only ? 1 : 0,
                    description: f.description || '',
                    change: function() { me.refresh_record_field_visibility(groups, doc); },
                },
                parent: container,
                render_input: true,
            });
            ctrl.refresh();
            me._controls[f.fieldname] = ctrl;
            ctrl.set_value(Array.isArray(doc[f.fieldname]) ? doc[f.fieldname] : []);
        });
    }

    // Editable child table rendered like the BD Control Center tables: a bordered
    // table with a subset of list-view columns, an "Add Row" button below, and an
    // Edit modal that exposes every field of the child doctype. Link cells get an
    // inline control whose dropdown is teleported so the options stay visible.
    build_child_grid(f, doc, container, read_only = false) {
        const me = this;
        const fieldname = f.fieldname;
        const child = f.options;
        if (!child) return;

        const esc = frappe.utils.escape_html;

        frappe.model.with_doctype(child, function() {
            const cmeta = frappe.get_meta(child);
            const layout = ['Section Break', 'Column Break', 'Tab Break', 'Fold',
                'Heading', 'HTML', 'Button', 'Image'];

            const editable = (cmeta.fields || []).filter(function(cf) {
                return cf.fieldname && !cf.hidden && layout.indexOf(cf.fieldtype) === -1;
            });

            let cols = editable.filter(function(cf) { return cf.in_list_view; });
            if (!cols.length) cols = editable.slice(0, 5);
            cols = cols.slice(0, 5);

            const rows = Array.isArray(doc[fieldname])
                ? doc[fieldname].map(function(r) { return $.extend({}, r); })
                : [];

            const $host = $(container);
            $host.html(`
                <div class="ptm-child-grid" data-fieldname="${esc(fieldname)}">
                    <div class="ptm-child-wrap">
                        <table class="ptm-child-table">
                            <thead>
                                <tr>
                                    <th class="ptm-col-num">#</th>
                                    ${cols.map(function(cf) {
                                        return `<th>${esc(cf.label || cf.fieldname)}</th>`;
                                    }).join('')}
                                    ${read_only ? '' : `<th class="ptm-col-actions">${__('Actions')}</th>`}
                                </tr>
                            </thead>
                            <tbody class="ptm-child-tbody"></tbody>
                        </table>
                    </div>
                    <div class="ptm-add-row-bar" ${read_only ? 'style="display:none"' : ''}>
                        <button type="button" class="ptm-add-row-btn">+ ${__('Add Row')}</button>
                    </div>
                </div>
            `);

            const $tbody = $host.find('.ptm-child-tbody');
            const colspan = cols.length + (read_only ? 1 : 2);
            const ctrlRefs = [];

            const render = function() {
                ctrlRefs.length = 0;
                if (!rows.length) {
                    $tbody.html(`<tr class="ptm-no-data-row"><td colspan="${colspan}">${__('No rows yet.')}</td></tr>`);
                    return;
                }

                $tbody.empty();
                rows.forEach(function(row, idx) {
                    const refs = {};
                    ctrlRefs[idx] = refs;
                    const $tr = $('<tr></tr>');
                    $('<td class="ptm-col-num"></td>').text(idx + 1).appendTo($tr);

                    cols.forEach(function(cf) {
                        const $td = $('<td></td>').appendTo($tr);
                        const raw = row[cf.fieldname];
                        const val = (raw === null || raw === undefined) ? '' : raw;

                        if (!read_only && ['Link', 'Dynamic Link', 'Autocomplete'].indexOf(cf.fieldtype) !== -1) {
                            let ctrl = null;
                            try {
                                ctrl = frappe.ui.form.make_control({
                                    df: {
                                        fieldtype: cf.fieldtype,
                                        fieldname: cf.fieldname,
                                        options: cf.options || '',
                                        label: '',
                                        reqd: 0,
                                        read_only: cf.read_only ? 1 : 0,
                                    },
                                    parent: $td.get(0),
                                    render_input: true,
                                });
                                ctrl.refresh();
                                ctrl.set_value(val);
                            } catch (e) {
                                ctrl = null;
                            }
                            if (ctrl) {
                                refs[cf.fieldname] = ctrl;
                                me._teleport_link_dropdown(ctrl, $td);
                                ctrl.$input.on('change', function() {
                                    row[cf.fieldname] = ctrl.get_value() || '';
                                    me.mark_dirty();
                                });
                                ctrl.$wrapper.on('awesomplete-selectcomplete', function() {
                                    row[cf.fieldname] = ctrl.get_value() || '';
                                    me.mark_dirty();
                                });
                            } else {
                                $td.text(val);
                            }
                        } else if (cf.fieldtype === 'Check') {
                            const $chk = $('<input type="checkbox" class="ptm-child-chk">').appendTo($td);
                            $chk.prop('checked', !!raw);
                            if (read_only) {
                                $chk.prop('disabled', true);
                                return;
                            }
                            refs[cf.fieldname] = { get_value: function() { return $chk.is(':checked') ? 1 : 0; } };
                            $chk.on('change', function() {
                                row[cf.fieldname] = $chk.is(':checked') ? 1 : 0;
                                me.mark_dirty();
                            });
                        } else {
                            $td.text(val);
                        }
                    });

                    if (read_only) {
                        $tbody.append($tr);
                        return;
                    }
                    const $act = $('<td class="ptm-col-actions"></td>').appendTo($tr);
                    $('<button type="button" class="ptm-edit-row-btn"></button>')
                        .text(__('Edit'))
                        .appendTo($act)
                        .on('click', function() {
                            me.open_child_row_dialog(cmeta, child, rows, idx, render);
                        });
                    $('<button type="button" class="ptm-remove-row-btn"></button>')
                        .text(__('Delete'))
                        .appendTo($act)
                        .on('click', function() {
                            rows.splice(idx, 1);
                            me.mark_dirty();
                            render();
                        });

                    $tbody.append($tr);
                });
            };

            render();

            if (read_only) return;

            $host.find('.ptm-add-row-btn').on('click', function() {
                rows.push({ doctype: child });
                me.mark_dirty();
                render();
            });

            me._controls[fieldname] = {
                get_value: function() {
                    return rows.map(function(row, idx) {
                        const out = $.extend({}, row);
                        const refs = ctrlRefs[idx] || {};
                        Object.keys(refs).forEach(function(fn) {
                            try { out[fn] = refs[fn].get_value(); } catch (e) {}
                        });
                        out.doctype = child;
                        return out;
                    });
                },
            };
        });
    }

    // Modal that edits every field of a child-table row (the fields not shown as
    // columns in the table). Mirrors the BD Control Center row dialogs.
    open_child_row_dialog(cmeta, child, rows, idx, rerender) {
        const me = this;
        if (isNaN(idx) || idx < 0 || idx >= rows.length) return;
        const row = rows[idx];

        const skip = ['Tab Break', 'Fold', 'Heading', 'HTML', 'Button', 'Image'];
        const dfs = [];
        (cmeta.fields || []).forEach(function(cf) {
            if (skip.indexOf(cf.fieldtype) !== -1) return;
            if (cf.fieldtype === 'Section Break' || cf.fieldtype === 'Column Break') {
                dfs.push({ fieldtype: cf.fieldtype, fieldname: cf.fieldname });
                return;
            }
            if (!cf.fieldname || cf.hidden) return;
            dfs.push({
                fieldtype: cf.fieldtype,
                fieldname: cf.fieldname,
                label: cf.label || cf.fieldname,
                options: cf.options || '',
                reqd: cf.reqd ? 1 : 0,
                read_only: cf.read_only ? 1 : 0,
            });
        });

        const d = new frappe.ui.Dialog({
            title: __('Edit') + ' ' + __(child),
            size: 'large',
            fields: dfs,
            primary_action_label: __('Save'),
            primary_action: function(values) {
                Object.keys(values || {}).forEach(function(k) {
                    if (k === 'name') return;
                    row[k] = values[k];
                });
                row.doctype = child;
                me.mark_dirty();
                rerender();
                d.hide();
            },
        });
        d.set_values(row);
        d.show();
    }

    wire_buttons() {
        $('#ptx-open-doc').on('click', () => {
            if (this._record_doctype && this._saved_doc) {
                frappe.set_route('Form', this._record_doctype, this._saved_doc);
            } else {
                frappe.msgprint({ message: __('Select a record first.'), indicator: 'orange' });
            }
        });

        $('#ptx-save-record').on('click', () => this.save_record());
    }

    save_record() {
        const me = this;
        if (!this._record_doctype || !this._saved_doc) {
            frappe.msgprint({ message: __('No record loaded.'), indicator: 'orange' });
            return;
        }

        // Start from the full server doc so fields/child tables not rendered
        // here are preserved, then overlay the edited controls.
        const doc = JSON.parse(JSON.stringify(this._record_doc || {}));
        doc.doctype = this._record_doctype;
        doc.name = this._saved_doc;

        Object.keys(this._controls).forEach(function(fieldname) {
            const ctrl = me._controls[fieldname];
            if (ctrl.df && ctrl.df.read_only) return;
            try {
                const value = ctrl.get_value();
                if (value !== undefined) doc[fieldname] = value;
            } catch (e) {}
        });

        frappe.call({
            method: 'frappe.client.save',
            args: { doc: doc },
            callback: function(r) {
                if (!r.message) return;
                me._record_doc = r.message;
                frappe.show_alert({ message: __('Saved: {0}', [r.message.name]), indicator: 'green' });
                me.capture_dirty_baseline(250);
                me.load_list();
            },
            error: function(r) {
                frappe.msgprint({
                    title: __('Error'),
                    message: (r && r.message) ? r.message : __('Save failed.'),
                    indicator: 'red',
                });
            },
        });
    }
};
