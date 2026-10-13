// Copyright (c) 2026, Finbyz and contributors
// For license information, please see license.txt
// Customer Portal Document Report section for the BD Control Center page.

frappe.provide('crm_customization');

crm_customization.BDCCCustomerPortalDocumentReport = class {
	constructor(controller, $panel) {
		this.controller = controller;
		this.page = controller.page;
		this.$panel = $panel;

		this._ctrl = {};
		this._report_timer = null;
		this._report_seq = 0;
	}

	render() {
		this.add_styles();
		this.$panel.html(`
			<div id="cpdr-tab-root">

				<!-- Header action buttons -->
				<div class="sc-header-btns">
					<button class="sc-btn sc-btn-outline" id="cpdr-open-report">Open Original Report</button>
					<button class="sc-btn sc-btn-outline" id="cpdr-refresh-btn">Refresh</button>
				</div>

				<!-- Report Filters -->
				<div class="sc-form-section">
					<div class="sc-form-section-header">
						<h2>Report Filters</h2>
					</div>
					<div class="cpdr-filter-grid">
						<div class="sc-field-group"><div id="cpdr-filter-customer"></div></div>
						<div class="sc-field-group"><div id="cpdr-filter-subsidairy_company"></div></div>
						<div class="sc-field-group"><div id="cpdr-filter-document_type"></div></div>
						<div class="sc-field-group"><div id="cpdr-filter-show_expired"></div></div>
						<div class="sc-field-group"><div id="cpdr-filter-days_to_expire"></div></div>
					</div>
					<div class="cpdr-filter-actions">
						<button class="sc-btn sc-btn-outline" id="cpdr-reset-btn">Reset</button>
					</div>
				</div>

				<!-- Report Table -->
				<div class="sc-form-section">
					<div class="sc-form-section-header">
						<h2>Customer Portal Document Report</h2>
					</div>
					<div class="cpdr-table-wrap">
						<table class="cpdr-table" id="cpdr-table">
							<thead id="cpdr-table-head"></thead>
							<tbody id="cpdr-table-body"></tbody>
						</table>
					</div>
				</div>

			</div>
		`);

		this.mount_controls();
		this.wire_buttons();
		this.run_report();
	}

	add_styles() {
		if (document.getElementById('bd-cc-cpdr-styles')) return;

		const style = document.createElement('style');
		style.id = 'bd-cc-cpdr-styles';
		style.innerHTML = `
			/* ── Customer Portal Document Report ── */
			.cpdr-filter-grid {
				display: grid; grid-template-columns: repeat(5, 1fr);
				gap: 14px; align-items: start;
			}
			@media (max-width: 1300px) { .cpdr-filter-grid { grid-template-columns: repeat(3, 1fr); } }
			@media (max-width: 900px) { .cpdr-filter-grid { grid-template-columns: repeat(2, 1fr); } }
			@media (max-width: 600px)  { .cpdr-filter-grid { grid-template-columns: 1fr; } }
			.cpdr-filter-actions { margin-top: 14px; }

			.cpdr-table-wrap { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 8px; }
			.cpdr-table { border-collapse: separate; border-spacing: 0; width: 100%; min-width: 1200px; font-size: 12.5px; }
			.cpdr-table thead th {
				background: #f8fafc; color: #334155; font-weight: 600; text-align: left;
				padding: 9px 12px; border-bottom: 1px solid #e2e8f0;
				position: sticky; top: 0; z-index: 1; white-space: nowrap;
			}
			.cpdr-table tbody td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
			.cpdr-table tbody tr:hover td { background: #f8fafc; }
			.cpdr-table tbody tr:last-child td { border-bottom: none; }
			.cpdr-empty { text-align: center !important; color: #9ca3af; padding: 32px 12px !important; }
			.cpdr-link { color: #2563eb; cursor: pointer; text-decoration: none; font-weight: 500; }
			.cpdr-link:hover { text-decoration: underline; }
			.cpdr-days-ok { color: #16a34a; font-weight: 600; }
			.cpdr-days-warn { color: #ea580c; font-weight: 600; }
			.cpdr-days-over { color: #dc2626; font-weight: 700; }

			[data-theme="dark"] .cpdr-table-wrap { border-color: #2d3748; }
			[data-theme="dark"] .cpdr-table thead th { background: #1e2533; color: #cbd5e1; border-bottom-color: #2d3748; }
			[data-theme="dark"] .cpdr-table tbody td { border-bottom-color: #253044; }
			[data-theme="dark"] .cpdr-table tbody tr:hover td { background: #242c3d; }
			[data-theme="dark"] .cpdr-link { color: #93c5fd; }
		`;
		document.head.appendChild(style);
	}

	// ─────────────────────────────────────────────
	//  FILTER CONTROLS
	// ─────────────────────────────────────────────
	mount_controls() {
		this._ctrl.customer = crm_customization.make_link_control(
			'cpdr-filter-customer', 'Customer', 'Customer'
		);
		this._ctrl.subsidairy_company = crm_customization.make_link_control(
			'cpdr-filter-subsidairy_company', 'Subsidairy Company', 'Subsidiary Company'
		);
		this._ctrl.document_type = crm_customization.make_link_control(
			'cpdr-filter-document_type', 'Company Document Type', 'Document Type'
		);
		this._ctrl.show_expired = this.make_control(
			'cpdr-filter-show_expired', 'Show Expired Only', 'Check'
		);
		this._ctrl.days_to_expire = this.make_control(
			'cpdr-filter-days_to_expire', 'Expiring Within (Days)', 'Int'
		);

		const auto_refresh = () => this._schedule_report();
		Object.keys(this._ctrl).forEach(key => {
			const ctrl = this._ctrl[key];
			if (ctrl && ctrl.df) ctrl.df.change = auto_refresh;
		});
	}

	make_control(container_id, label, fieldtype) {
		const container = document.getElementById(container_id);
		if (!container) return null;
		const ctrl = frappe.ui.form.make_control({
			df: {
				fieldtype: fieldtype,
				fieldname: container_id.replace(/-/g, '_'),
				label: label,
				placeholder: fieldtype === 'Check' ? '' : label,
			},
			parent: container,
			render_input: true,
		});
		ctrl.refresh();
		return ctrl;
	}

	// ─────────────────────────────────────────────
	//  BUTTON WIRING
	// ─────────────────────────────────────────────
	wire_buttons() {
		$('#cpdr-open-report').on('click', () => frappe.set_route('query-report', 'Customer Portal Document Report'));
		$('#cpdr-refresh-btn').on('click', () => this.run_report());
		$('#cpdr-reset-btn').on('click', () => this.reset_filters());
	}

	// ─────────────────────────────────────────────
	//  FILTERS + RUN
	// ─────────────────────────────────────────────
	build_filters() {
		const get = (ctrl) => {
			if (!ctrl) return '';
			const v = ctrl.get_value();
			return (v === null || v === undefined) ? '' : String(v);
		};

		const filters = {};
		if (get(this._ctrl.customer)) filters.customer = get(this._ctrl.customer);
		if (get(this._ctrl.subsidairy_company)) filters.subsidairy_company = get(this._ctrl.subsidairy_company);
		if (get(this._ctrl.document_type)) filters.document_type = get(this._ctrl.document_type);
		if (Number(get(this._ctrl.show_expired)) === 1) filters.show_expired = 1;
		const days = parseInt(get(this._ctrl.days_to_expire), 10);
		if (!isNaN(days) && days > 0) filters.days_to_expire = days;
		return filters;
	}

	reset_filters() {
		Object.keys(this._ctrl).forEach(key => {
			const ctrl = this._ctrl[key];
			if (ctrl) { try { ctrl.set_value(''); } catch (e) {} }
		});
		if (this._report_timer) clearTimeout(this._report_timer);
		this.run_report();
	}

	_schedule_report() {
		if (this._report_timer) clearTimeout(this._report_timer);
		this._report_timer = setTimeout(() => this.run_report(), 300);
	}

	run_report() {
		const seq = ++this._report_seq;
		const $refresh = $('#cpdr-refresh-btn');
		$refresh.prop('disabled', true);

		frappe.call({
			method: 'frappe.desk.query_report.run',
			args: {
				report_name: 'Customer Portal Document Report',
				filters: this.build_filters()
			},
			callback: (r) => {
				$refresh.prop('disabled', false);
				if (seq !== this._report_seq) return;
				if (r.message) {
					this.render_table(r.message.columns || [], r.message.result || []);
				}
			},
			error: () => {
				$refresh.prop('disabled', false);
				if (seq !== this._report_seq) return;
				frappe.msgprint({ title: __('Error'), message: __('Could not run the report.'), indicator: 'red' });
			}
		});
	}

	// ─────────────────────────────────────────────
	//  RENDER
	// ─────────────────────────────────────────────
	render_table(columns, data) {
		const esc = (v) => frappe.utils.escape_html(v === null || v === undefined ? '' : String(v));

		const linkColumns = {};
		columns.forEach(col => {
			if ((col.fieldtype || '') === 'Link' && col.options) {
				linkColumns[col.fieldname || col.name] = col.options;
			}
		});

		const head = '<tr><th style="width:44px">#</th>' +
			columns.map(col => '<th>' + esc(col.label || col.fieldname || '') + '</th>').join('') +
			'</tr>';
		$('#cpdr-table-head').html(head);

		if (!data.length) {
			$('#cpdr-table-body').html(
				'<tr><td class="cpdr-empty" colspan="' + (columns.length + 1) + '">No data found. Set filters to load results.</td></tr>'
			);
			return;
		}

		const rows = data.map((row, index) => {
			const tds = columns.map(col => {
				const fieldname = col.fieldname || col.name;
				let value = row[fieldname];
				if (value === null || value === undefined) value = '';

				if (linkColumns[fieldname] && value) {
					return '<td><a class="cpdr-link" href="#" data-doctype="' + esc(linkColumns[fieldname]) + '" data-name="' + esc(value) + '">' + esc(value) + '</a></td>';
				}
				if (fieldname === 'days_remaining') {
					const n = parseInt(value, 10);
					let cls = 'cpdr-days-ok';
					if (!isNaN(n) && n < 0) cls = 'cpdr-days-over';
					else if (!isNaN(n) && n <= 30) cls = 'cpdr-days-warn';
					return '<td><span class="' + cls + '">' + esc(value) + '</span></td>';
				}
				return '<td>' + esc(value) + '</td>';
			}).join('');

			return '<tr><td>' + (index + 1) + '</td>' + tds + '</tr>';
		}).join('');

		$('#cpdr-table-body').html(rows);

		// Link cells → open the doc
		this.$panel.find('.cpdr-link').off('click').on('click', (e) => {
			e.preventDefault();
			frappe.set_route('Form', $(e.currentTarget).data('doctype'), $(e.currentTarget).data('name'));
		});
	}
};