// Copyright (c) 2026, Finbyz and contributors
// For license information, please see license.txt
// Registration and Qualification report section for the BD Control Center page.

frappe.provide('crm_customization');

crm_customization.BDCCRegistrationAndQualification = class {
	constructor(controller, $panel) {
		this.controller = controller;
		this.page = controller.page;
		this.$panel = $panel;

		this._filters = {};
		this._period_fields = [];
		this._check_fields = [];
		this._report_timer = null;
		this._report_seq = 0;
	}

	render() {
		this.add_styles();
		this.$panel.html(`
			<div id="rq-tab-root">

				<!-- Header action buttons -->
				<div class="sc-header-btns">
					<button class="sc-btn sc-btn-outline" id="rq-open-report">Open Original Report</button>
					<button class="sc-btn sc-btn-outline" id="rq-refresh-btn">Refresh</button>
				</div>

				<!-- Report Filters -->
				<div class="sc-form-section">
					<div class="sc-form-section-header">
						<h2>Report Filters</h2>
					</div>
					<div class="rq-filter-grid">
						<div class="sc-field-group"><div id="rq-filter-period_type"></div></div>
						<div class="sc-field-group"><div id="rq-filter-year"></div></div>
						<div class="sc-field-group"><div id="rq-filter-subsidiary_company"></div></div>
						<div class="sc-field-group"><div id="rq-filter-vendor"></div></div>
						<div class="sc-field-group"><div id="rq-filter-vendor_no"></div></div>
						<div class="sc-field-group"><div id="rq-filter-status"></div></div>
						<div class="sc-field-group"><div id="rq-filter-stage"></div></div>
					</div>
					<div class="rq-filter-actions">
						<button class="sc-btn sc-btn-outline" id="rq-reset-btn">Reset</button>
					</div>
				</div>

				<!-- Report Summary -->
				<div class="rq-summary" id="rq-summary-wrap"></div>

				<!-- Report Table -->
				<div class="sc-form-section">
					<div class="sc-form-section-header">
						<h2>Registration &amp; Qualification</h2>
					</div>
					<div class="rq-table-wrap">
						<table class="rq-table" id="rq-table">
							<thead id="rq-table-head"></thead>
							<tbody id="rq-table-body"></tbody>
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
		if (document.getElementById('bd-cc-registration-styles')) return;

		const style = document.createElement('style');
		style.id = 'bd-cc-registration-styles';
		style.innerHTML = `
			/* ── Registration and Qualification report ── */
			.rq-filter-grid {
				display: grid; grid-template-columns: repeat(7, 1fr);
				gap: 14px; align-items: start;
			}
			@media (max-width: 1500px) { .rq-filter-grid { grid-template-columns: repeat(4, 1fr); } }
			@media (max-width: 1100px) { .rq-filter-grid { grid-template-columns: repeat(3, 1fr); } }
			@media (max-width: 800px)  { .rq-filter-grid { grid-template-columns: repeat(2, 1fr); } }
			@media (max-width: 600px)  { .rq-filter-grid { grid-template-columns: 1fr; } }
			.rq-filter-actions { margin-top: 14px; }
			.rq-filter-grid .control-label,
			.bri-filter-grid .control-label,
			.cpdr-filter-grid .control-label { display: none; }

			.rq-summary {
				display: flex; background: linear-gradient(to bottom right, #ffffff, #f9fafb);
				border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 16px;
				margin: 16px 0 6px 0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
			}
			.rq-summary-item {
				flex: 1; text-align: center; padding: 0 12px;
				border-right: 1px dotted #cbd5e1;
			}
			.rq-summary-item:last-child { border-right: none; }
			.rq-summary-value { font-size: 26px; font-weight: 800; color: #0f172a; display: block; }
			.rq-summary-label {
				font-size: 10px; font-weight: 700; color: #64748b;
				text-transform: uppercase; margin-top: 6px; display: block; letter-spacing: 0.4px;
			}

			.rq-table-wrap { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 8px; }
			.rq-table { border-collapse: separate; border-spacing: 0; width: 100%; min-width: 1400px; font-size: 12.5px; }
			.rq-table thead th {
				background: #f8fafc; color: #334155; font-weight: 600; text-align: left;
				padding: 9px 12px; border-bottom: 1px solid #e2e8f0;
				position: sticky; top: 0; z-index: 1; white-space: nowrap;
			}
			.rq-table tbody td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
			.rq-table tbody tr:hover td { background: #f8fafc; }
			.rq-table tbody tr:last-child td { border-bottom: none; }
			.rq-check { text-align: center; }
			.rq-check-on { color: #16a34a; font-weight: 700; }
			.rq-check-off { color: #e2e8f0; }
			.rq-row-highlight td { background-color: #FEF3C7 !important; font-weight: 500; }
			.rq-row-highlight td:first-child { border-left: 4px solid #10b981; }
			.rq-empty { text-align: center !important; color: #9ca3af; padding: 32px 12px !important; }

			[data-theme="dark"] .rq-summary { background: linear-gradient(to bottom right, #1e2533, #242c3d); border-color: #2d3748; }
			[data-theme="dark"] .rq-summary-value { color: #f0f4ff; }
			[data-theme="dark"] .rq-summary-label { color: #94a3b8; }
			[data-theme="dark"] .rq-table-wrap { border-color: #2d3748; }
			[data-theme="dark"] .rq-table thead th { background: #1e2533; color: #cbd5e1; border-bottom-color: #2d3748; }
			[data-theme="dark"] .rq-table tbody td { border-bottom-color: #253044; }
			[data-theme="dark"] .rq-table tbody tr:hover td { background: #242c3d; }
			[data-theme="dark"] .rq-row-highlight td { background-color: #4a3f1f !important; }
		`;
		document.head.appendChild(style);
	}

	// ─────────────────────────────────────────────
	//  FILTER CONTROLS
	// ─────────────────────────────────────────────
	mount_controls() {
		this._ctrl_period_type = this.make_select('rq-filter-period_type', 'Period Type', '\nMonthly\nQuarterly\nYearly');
		this._ctrl_year = this.make_select('rq-filter-year', 'Year', this.year_options());
		this._ctrl_subsidiary_filter = crm_customization.make_link_control(
			'rq-filter-subsidiary_company', 'Subsidairy Company', 'Subsidiary Company'
		);
		this._ctrl_vendor = crm_customization.make_link_control(
			'rq-filter-vendor', 'Customer', 'Client'
		);
		this._ctrl_vendor_no = crm_customization.make_data_control('rq-filter-vendor_no', 'Vendor No');
		this._ctrl_status = this.make_select(
			'rq-filter-status', 'Status',
			'\nNot Started\nNot Qualified\nPending Approval\nWaiting for the Request Approval\nPending Submission\nPending Re-Submission\nIn Process\nOn Hold\nQualified\nCompleted\nRejected\nUnder Qualification\nCancelled'
		);
		this._ctrl_stage = this.make_select(
			'rq-filter-stage', 'Stage',
			'\nRegistration\nPrequalification\nPQ Project\nRFQ Invitation'
		);

		const auto_refresh = () => this._schedule_report();
		[
			this._ctrl_period_type,
			this._ctrl_year,
			this._ctrl_subsidiary_filter,
			this._ctrl_vendor,
			this._ctrl_vendor_no,
			this._ctrl_status,
			this._ctrl_stage,
		].forEach(ctrl => {
			if (ctrl && ctrl.df) ctrl.df.change = auto_refresh;
		});
	}

	make_select(container_id, label, options) {
		const container = document.getElementById(container_id);
		if (!container) return null;
		const ctrl = frappe.ui.form.make_control({
			df: {
				fieldtype: 'Select',
				fieldname: container_id.replace(/-/g, '_'),
				label: label,
				options: options,
				placeholder: label,
			},
			parent: container,
			render_input: true,
		});
		ctrl.refresh();
		return ctrl;
	}

	year_options() {
		const years = [];
		const current_year = new Date().getFullYear();
		for (let i = current_year - 5; i <= current_year + 2; i++) {
			years.push(i);
		}
		return '\n' + years.join('\n');
	}

	// ─────────────────────────────────────────────
	//  BUTTON WIRING
	// ─────────────────────────────────────────────
	wire_buttons() {
		$('#rq-open-report').on('click', () => frappe.set_route('query-report', 'Registration and Qualification'));
		$('#rq-refresh-btn').on('click', () => this.run_report());
		$('#rq-reset-btn').on('click', () => this.reset_filters());
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
		const period_type = get(this._ctrl_period_type);
		const year = get(this._ctrl_year);
		if (period_type) filters.period_type = period_type;
		if (year) filters.year = year;
		if (get(this._ctrl_subsidiary_filter)) filters.subsidiary_company = get(this._ctrl_subsidiary_filter);
		if (get(this._ctrl_vendor)) filters.vendor = get(this._ctrl_vendor);
		if (get(this._ctrl_vendor_no)) filters.vendor_no = get(this._ctrl_vendor_no);
		if (get(this._ctrl_status)) filters.status = get(this._ctrl_status);
		if (get(this._ctrl_stage)) filters.stage = get(this._ctrl_stage);
		return filters;
	}

	reset_filters() {
		['period_type', 'year', 'status', 'stage'].forEach(key => {
			const ctrl = this['_ctrl_' + key];
			if (ctrl) { try { ctrl.set_value(''); } catch (e) {} }
		});
		if (this._ctrl_subsidiary_filter) this._ctrl_subsidiary_filter.set_value('');
		if (this._ctrl_vendor) this._ctrl_vendor.set_value('');
		if (this._ctrl_vendor_no) this._ctrl_vendor_no.set_value('');
		if (this._report_timer) clearTimeout(this._report_timer);
		this.run_report();
	}

	_schedule_report() {
		if (this._report_timer) clearTimeout(this._report_timer);
		this._report_timer = setTimeout(() => this.run_report(), 300);
	}

	run_report() {
		const seq = ++this._report_seq;
		const $refresh = $('#rq-refresh-btn');
		$refresh.prop('disabled', true);

		frappe.call({
			method: 'frappe.desk.query_report.run',
			args: {
				report_name: 'Registration and Qualification',
				filters: this.build_filters()
			},
			callback: (r) => {
				$refresh.prop('disabled', false);
				if (seq !== this._report_seq) return;
				if (r.message) {
					this.render_report(r.message);
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
	render_report(res) {
		const esc = (v) => frappe.utils.escape_html(v === null || v === undefined ? '' : String(v));

		const columns = res.columns || [];
		const data = res.result || [];
		const summary = res.report_summary || [];

		// Detect dynamic period columns (Monthly / Quarterly / Yearly)
		this._period_fields = columns.filter(col => {
			const name  = ((col.fieldname || col.name || '') + '').toLowerCase();
			const label = ((col.label || '') + '').toLowerCase();
			return (
				/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/.test(name) ||
				/^q[1-4]/.test(name) ||
				/^\d{4}$/.test(name) ||
				/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/.test(label) ||
				/^q[1-4]/.test(label) ||
				/^\d{4}$/.test(label)
			);
		}).map(col => col.fieldname || col.name);

		this._check_fields = columns
			.filter(col => (col.fieldtype || '').toLowerCase() === 'check')
			.map(col => col.fieldname || col.name);

		this.render_summary(summary);
		this.render_table(columns, data);
	}

	render_summary(summary) {
		const esc = (v) => frappe.utils.escape_html(v === null || v === undefined ? '' : String(v));
		const colors = {
			'Blue':   '#2563eb',
			'Orange': '#ea580c',
			'Green':  '#16a34a',
			'Cyan':   '#0891b2',
			'Purple': '#9333ea',
			'Red':    '#dc2626',
			'Yellow': '#ca8a04'
		};
		const cards = summary.map(s => {
			const val = esc(s.value || 0);
			const label = esc(s.label || '');
			const color = colors[s.indicator] || '#2563eb';
			return `
				<div class="rq-summary-item">
					<span class="rq-summary-value" style="color:${color}">${val}</span>
					<span class="rq-summary-label">${label}</span>
				</div>
			`;
		}).join('');

		$('#rq-summary-wrap').html(cards || '');
	}

	render_table(columns, data) {
		const esc = (v) => frappe.utils.escape_html(v === null || v === undefined ? '' : String(v));

		const head = '<tr><th style="width:44px">#</th>' +
			columns.map(col => '<th>' + esc(col.label || col.fieldname || '') + '</th>').join('') +
			'</tr>';
		$('#rq-table-head').html(head);

		if (!data.length) {
			$('#rq-table-body').html(
				'<tr><td class="rq-empty" colspan="' + (columns.length + 1) + '">No data found. Select a Period Type and Year to load results.</td></tr>'
			);
			return;
		}

		const rows = data.map((row, index) => {
			const highlighted = this._period_fields.some(key => row[key] === 1 || row[key] === '1' || row[key] === true);
			const tds = columns.map(col => {
				const fieldname = col.fieldname || col.name;
				let value = row[fieldname];
				if (value === null || value === undefined) value = '';
				if (this._check_fields.indexOf(fieldname) !== -1) {
					const on = (value === 1 || value === '1' || value === true);
					return '<td class="rq-check"><span class="' + (on ? 'rq-check-on' : 'rq-check-off') + '">' +
						(on ? '&#10003;' : '&#8722;') + '</span></td>';
				}
				if (fieldname === 'business_request' && value) {
					return '<td><a class="rq-link" href="' + esc(value) + '" data-name="' + esc(value) + '">' + esc(value) + '</a></td>';
				}
				return '<td>' + esc(value) + '</td>';
			}).join('');

			return '<tr class="' + (highlighted ? 'rq-row-highlight' : '') + '">' +
				'<td>' + (index + 1) + '</td>' + tds + '</tr>';
		}).join('');

		$('#rq-table-body').html(rows);

		// Business Request links → open the doc
		this.$panel.find('.rq-link').off('click').on('click', (e) => {
			e.preventDefault();
			frappe.set_route('Form', 'Business Request', $(e.currentTarget).data('name'));
		});
	}
};