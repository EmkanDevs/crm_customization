// Copyright (c) 2026, Finbyz and contributors
// For license information, please see license.txt
//
// Shared base styles for every BD Control Center section. Must be injected by
// whichever section renders first, since later sections rely on these `.sc-*`
// classes.

frappe.provide('crm_customization');

crm_customization.ensure_base_section_styles = function () {
	if (document.getElementById('bd-cc-section-base-styles')) return;

	const style = document.createElement('style');
	style.id = 'bd-cc-section-base-styles';
	style.innerHTML = `
		/* Split layout: 20% list / 80% form */
		.sc-split { display: flex; gap: 16px; align-items: flex-start; }
		.sc-split-left {
			flex: 0 0 20%; max-width: 20%; min-width: 0;
			display: flex; flex-direction: column;
			background: #fff; border: 1px solid #e2e6ea; border-radius: 8px;
			position: sticky; top: 10px;
			max-height: calc(100vh - 160px);
			overflow: hidden;
		}
		.sc-split-right { flex: 1 1 80%; min-width: 0; }
		@media (max-width: 1000px) {
			.sc-split { flex-direction: column; }
			.sc-split-left { flex: 1 1 auto; max-width: 100%; width: 100%; position: static; max-height: 340px; }
			.sc-split-right { flex: 1 1 auto; width: 100%; }
		}

		/* Blank right pane: everything except the New Entry action is hidden
		   until the user starts a new entry or picks a record from the list. */
		.sc-split-right.sc-pane-blank > *:not(.sc-header-btns) { display: none !important; }
		.sc-split-right.sc-pane-blank > .sc-header-btns > :not([id$="-new-entry"]) { display: none !important; }

		/* Left master list */
		.sc-list-head {
			display: flex; flex-direction: column; gap: 8px;
			padding: 12px 12px 10px 12px;
			border-bottom: 1px solid #e2e6ea;
		}
		.sc-list-title {
			font-size: 12.5px; font-weight: 700; color: #374151;
			display: flex; align-items: center; gap: 6px;
		}
		.sc-list-tools { display: flex; align-items: center; gap: 6px; }
		.sc-list-count {
			font-size: 10.5px; font-weight: 600; color: #1d4ed8;
			background: #eff6ff; border: 1px solid #bfdbfe;
			padding: 0 6px; border-radius: 10px; line-height: 16px;
		}
		.sc-list-scope {
			font-size: 10.5px; font-weight: 600; color: #1d4ed8;
			background: #eff6ff; border: 1px solid #bfdbfe;
			padding: 2px 7px; border-radius: 10px;
			overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
			display: inline-flex; align-items: center; gap: 6px; max-width: 100%;
		}
		.sc-filter-clear {
			border: none; background: transparent; cursor: pointer;
			color: inherit; font-size: 13px; line-height: 1; padding: 0 1px;
			opacity: 0.65; flex-shrink: 0; font-family: inherit;
		}
		.sc-filter-clear:hover { opacity: 1; }
		.sc-list-scope-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
		.sc-list-search {
			flex: 1 1 auto; min-width: 0; box-sizing: border-box; height: 28px;
			font-size: 12px; padding: 6px 9px; border-radius: 6px;
			border: 1px solid #d1d5db; outline: none; color: #374151;
			background: #fff; transition: border-color 0.15s, box-shadow 0.15s;
		}
		.sc-list-search:focus { border-color: #93c5fd; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
		.sc-list-refresh {
			flex: 0 0 28px; width: 28px; height: 28px;
			border: 1px solid #d1d5db; background: #fff; border-radius: 6px;
			cursor: pointer; color: #6b7280; font-size: 14px; line-height: 1;
			transition: background 0.15s, color 0.15s;
		}
		.sc-list-refresh:hover { background: #f3f4f6; color: #1d4ed8; }
		.sc-list-refresh.sc-spinning .sc-list-refresh-icon { display: inline-block; animation: sc-spin 0.8s linear infinite; }
		@keyframes sc-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

		.sc-list-body { position: relative; overflow-y: auto; flex: 1 1 auto; padding: 6px; }
		.sc-list-item {
			display: block; width: 100%; text-align: left; cursor: pointer;
			background: transparent; border: 1px solid transparent;
			border-radius: 6px; padding: 7px 9px; margin-bottom: 2px;
			transition: background 0.13s, border-color 0.13s;
			font-family: inherit;
		}
		.sc-list-item:hover { background: #f8faff; border-color: #e2e6ea; }
		.sc-list-item.active { background: #eff6ff; border-color: #bfdbfe; }
		.sc-list-item-title {
			font-size: 12.5px; font-weight: 600; color: #1f2937; line-height: 1.35;
			display: flex; align-items: center; gap: 6px;
		}
		.sc-list-item-name {
			overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;
		}
		.sc-list-item-badge {
			flex-shrink: 0; font-size: 10px; font-weight: 600; color: #c2410c;
			background: #fff7ed; border: 1px solid #fed7aa;
			padding: 0 5px; border-radius: 4px; line-height: 15px;
			max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
		}
		.sc-list-item-meta {
			font-size: 10.5px; color: #6b7280; margin-top: 2px; line-height: 1.35;
			overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
		}
		.sc-list-empty {
			text-align: center; color: #9ca3af; font-size: 12px;
			font-style: italic; padding: 24px 10px;
		}

		/* Buttons */
		.sc-header-btns {
			display: flex; gap: 8px; align-items: center;
			margin-bottom: 12px; justify-content: flex-end;
		}
		.sc-btn {
			padding: 6px 14px; font-size: 12.5px; font-weight: 500;
			border-radius: 6px; cursor: pointer; border: 1px solid;
			transition: all 0.15s;
		}
		.sc-btn-outline { background: #fff; border-color: #d1d5db; color: #374151; }
		.sc-btn-outline:hover { background: #f3f4f6; border-color: #9ca3af; }
		.sc-btn-primary { background: #1d4ed8; border-color: #1d4ed8; color: #fff; }
		.sc-btn-primary:hover { background: #1e40af; border-color: #1e40af; }

		/* Context bar */
		.sc-context-bar {
			background: #fff; border: 1px solid #e2e6ea; border-radius: 8px;
			padding: 14px 18px; margin-bottom: 16px;
			display: flex; align-items: flex-start; gap: 20px; flex-wrap: wrap;
		}
		.sc-context-info { flex: 0 0 auto; min-width: 180px; }
		.sc-context-info .sc-context-title { font-size: 15px; font-weight: 700; color: #374151; margin-bottom: 2px; }
		.sc-context-info .sc-context-sub { font-size: 11px; color: #6b7280; line-height: 1.4; }
		.sc-context-selectors { display: flex; align-items: flex-end; gap: 16px; flex: 1; flex-wrap: wrap; }
		.sc-selector-group { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 200px; }
		.sc-selector-group label { font-size: 13px; font-weight: 600; color: #374151; }
		.sc-selector-group .frappe-control { margin-bottom: 0 !important; }
		.sc-selector-group .frappe-control .form-group { margin-bottom: 0 !important; }
		.sc-selector-group .frappe-control .control-label { display: none !important; }
		.sc-clear-btn {
			padding: 6px 14px; font-size: 12px; font-weight: 500;
			border: 1px solid #d1d5db; background: #fff; border-radius: 6px;
			cursor: pointer; color: #374151; white-space: nowrap;
			height: 32px; line-height: 1; align-self: flex-end;
			transition: background 0.15s, border-color 0.15s;
		}
		.sc-clear-btn:hover { background: #f3f4f6; border-color: #9ca3af; }

		/* Section card */
		.sc-section {
			background: #fff; border: 1px solid #e2e6ea; border-radius: 8px;
			padding: 16px 18px; margin-bottom: 16px;
		}
		.sc-section-title { font-size: 13px; font-weight: 600; color: #1f2937; margin-bottom: 12px; }

		/* Form section */
		.sc-form-section {
			background: #fff; border: 1px solid #e2e6ea; border-radius: 8px;
			padding: 16px 18px; margin-bottom: 16px;
		}
		.sc-form-section-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
		.sc-form-section-header h2 { font-size: 14px; font-weight: 600; color: #1f2937; margin: 0; }
		.sc-form-abbrev {
			font-size: 12px; color: #f97316; font-weight: 600;
			border: 1px solid #fed7aa; background: #fff7ed;
			padding: 1px 6px; border-radius: 4px;
		}
		.sc-form-abbrev:empty { display: none; }
		.sc-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 12px; }
		.sc-form-row.single { grid-template-columns: repeat(2, minmax(0, 1fr)); }
		.sc-form-row.single .sc-field-group:only-child { grid-column: span 1; }
		.sc-field-group .link-field { width: 100%; }
		.sc-field-group .link-field input { width: 100%; }
		.sc-field-group { display: flex; flex-direction: column; gap: 4px; }
		.sc-field-group .frappe-control { margin-bottom: 0 !important; }
		.sc-field-group .frappe-control .form-group { margin-bottom: 0 !important; }
		.sc-field-group .frappe-control .control-label {
			font-size: 13px !important; font-weight: 600 !important; color: #374151 !important;
		}

		/* Child tables */
		.sc-table-wrap { overflow-x: auto; margin-top: 8px; }
		.sc-child-table { width: 100%; border-collapse: collapse; font-size: 12px; }
		.sc-child-table thead tr { background: #f8fafc; border-bottom: 2px solid #e5e7eb; }
		.sc-child-table thead th {
			padding: 8px 10px; text-align: left; font-weight: 600;
			color: #374151; font-size: 11.5px; white-space: nowrap;
			border-right: 1px solid #e5e7eb;
		}
		.sc-child-table thead th:last-child { border-right: none; width: 1%; }
		.sc-child-table tbody tr { border-bottom: 1px solid #f1f5f9; transition: background 0.12s; }
		.sc-child-table tbody tr:hover { background: #f8faff; }
		.sc-child-table tbody td {
			padding: 6px 10px; color: #374151;
			border-right: 1px solid #f1f5f9; vertical-align: middle;
		}
		.sc-child-table tbody td:last-child { border-right: none; }
		.sc-child-table tbody td input,
		.sc-child-table tbody td select {
			width: 100%; border: none; outline: none; background: transparent;
			font-size: 12px; color: #374151; padding: 0; min-width: 70px;
		}
		.sc-child-table tbody td input:focus,
		.sc-child-table tbody td select:focus {
			background: #eff6ff; border-radius: 4px; padding: 2px 4px;
		}
		.sc-no-data-row td {
			text-align: center; color: #9ca3af;
			padding: 24px 10px !important; font-style: italic;
		}
		.sc-add-row-bar {
			display: flex; justify-content: space-between;
			align-items: center; padding: 10px 0 0 0;
		}
		.sc-add-row-btn {
			font-size: 12px; padding: 5px 12px;
			border: 1px solid #d1d5db; background: #fff; border-radius: 5px;
			cursor: pointer; color: #374151; font-weight: 500; transition: background 0.15s;
		}
		.sc-add-row-btn:hover { background: #f3f4f6; }
		.sc-table-actions { display: flex; gap: 8px; }
		.sc-download-btn, .sc-upload-btn {
			font-size: 12px; padding: 5px 12px;
			border: 1px solid #d1d5db; background: #fff; border-radius: 5px;
			cursor: pointer; color: #374151; font-weight: 500; transition: background 0.15s;
		}
		.sc-download-btn:hover, .sc-upload-btn:hover { background: #f3f4f6; }
		.sc-row-num { color: #6b7280; font-size: 11px; text-align: center; min-width: 28px; }
		.sc-link-input { color: #374151 !important; cursor: pointer; }

		/* Link cells inside child tables */
		.sc-child-table tbody td { overflow: visible; }
		.sc-table-link { position: relative; }
		.sc-table-link .frappe-control { margin-bottom: 0 !important; }
		.sc-table-link .frappe-control .form-group { margin-bottom: 0 !important; }
		.sc-table-link .frappe-control .control-label { display: none !important; }
		.sc-table-link .frappe-control .link-btn { display: none; }
		.sc-table-link .frappe-control input { color: #374151 !important; }
		.sc-table-link .awesomplete > ul {
			z-index: 2000; max-height: 200px; overflow-y: auto; width: max-content;
			min-width: 100%;
		}
		.sc-child-table tbody tr.sc-focus-row { position: relative; z-index: 150; }
		.sc-child-table tbody tr.sc-focus-row td { position: relative; z-index: 150; }

		/* Teleported dropdown (escapes the scroll container so options overlap rows below) */
		.sc-table-dd-teleported,
		.sc-table-dd-teleported[role="listbox"] {
			position: fixed !important; z-index: 99999 !important;
			background: var(--bg-color, #ffffff) !important;
			border: 1px solid var(--border-color, #d1d5db) !important;
			border-radius: 6px !important;
			box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14) !important;
			max-height: 200px !important; overflow-y: auto !important;
			list-style: none !important; margin: 0 !important; padding: 4px !important;
			min-width: max-content !important; width: max-content !important;
		}
		.sc-table-dd-teleported li {
			cursor: pointer; font-size: 12.5px; padding: 6px 10px;
			border-radius: 4px; color: var(--text-color, #1f2937);
			display: block; margin: 0 !important; white-space: nowrap;
		}
		.sc-table-dd-teleported li:hover,
		.sc-table-dd-teleported li[aria-selected="true"] {
			background: var(--awesomplete-hover-bg, #f3f4f6) !important;
			color: var(--text-color, #1f2937) !important;
		}

		/* Date cells inside child tables */
		.sc-table-date { min-width: 130px; }
		.sc-table-date .frappe-control { margin-bottom: 0 !important; }
		.sc-table-date .frappe-control .form-group { margin-bottom: 0 !important; }
		.sc-table-date .frappe-control .control-label { display: none !important; }
		.sc-table-date .frappe-control .input-group { width: 100%; flex-wrap: nowrap; }
		.sc-table-date .frappe-control input {
			background: #fff !important; border: 1px solid #d1d5db !important;
			border-radius: 4px !important; color: #6b7280 !important;
			padding: 2px 6px !important; height: 26px; width: 100%;
		}
		.sc-table-date .datepicker-toggle { display: none; }
		.sc-table-date .clear-link { top: 4px; }

		/* Row actions */
		.sc-actions-cell { text-align: center; white-space: nowrap; width: 1%; }
		.sc-remove-row-btn {
			padding: 3px 10px; font-size: 11px; font-weight: 500;
			border: 1px solid #fecaca; background: #fef2f2; color: #dc2626;
			border-radius: 5px; cursor: pointer; white-space: nowrap;
			transition: background 0.15s, border-color 0.15s;
		}
		.sc-remove-row-btn:hover { background: #fee2e2; border-color: #f87171; }
		.sc-edit-row-btn {
			padding: 3px 10px; font-size: 11px; font-weight: 500;
			border: 1px solid #bfdbfe; background: #eff6ff; color: #2563eb;
			border-radius: 5px; cursor: pointer; white-space: nowrap;
			margin-right: 4px;
			transition: background 0.15s, border-color 0.15s;
		}
		.sc-edit-row-btn:hover { background: #dbeafe; border-color: #60a5fa; }

		/* Dark mode */
		[data-theme="dark"] .sc-split-left { background: #1e2533; border-color: #2d3748; }
		[data-theme="dark"] .sc-list-head { border-color: #2d3748; }
		[data-theme="dark"] .sc-list-title,
		[data-theme="dark"] .sc-list-item-title { color: #e2e8f0; }
		[data-theme="dark"] .sc-list-search,
		[data-theme="dark"] .sc-list-refresh { background: #1a202c; border-color: #2d3748; color: #a0aec0; }
		[data-theme="dark"] .sc-list-item:hover { background: #232c3d; border-color: #2d3748; }
		[data-theme="dark"] .sc-list-item.active { background: #2a3f6e; border-color: #3b5b8f; }
		[data-theme="dark"] .sc-list-item-meta { color: #a0aec0; }
		[data-theme="dark"] .sc-list-count { background: #2a3f6e; border-color: #3b5b8f; color: #93c5fd; }
		[data-theme="dark"] .sc-list-scope { background: #2a3f6e; border-color: #3b5b8f; color: #93c5fd; }
		[data-theme="dark"] .sc-list-item-badge { background: #3b2a1a; border-color: #7c4a21; color: #fdba74; }

		[data-theme="dark"] .sc-context-bar,
		[data-theme="dark"] .sc-section,
		[data-theme="dark"] .sc-form-section { background: #1e2533; border-color: #2d3748; }
		[data-theme="dark"] .sc-context-title,
		[data-theme="dark"] .sc-section-title,
		[data-theme="dark"] .sc-form-section-header h2 { color: #e2e8f0; }
		[data-theme="dark"] .sc-selector-group label { color: #e2e8f0; }
		[data-theme="dark"] .sc-btn-outline { background: #1e2533; border-color: #2d3748; color: #e2e8f0; }
		[data-theme="dark"] .sc-btn-outline:hover { background: #2d3748; }
		[data-theme="dark"] .sc-clear-btn { background: #1e2533; border-color: #2d3748; color: #e2e8f0; }
	`;
	document.head.appendChild(style);
};