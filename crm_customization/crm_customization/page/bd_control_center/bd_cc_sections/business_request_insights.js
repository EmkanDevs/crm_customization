// Copyright (c) 2026, Finbyz and contributors
// For license information, please see license.txt
// Business Request Insights report section for the BD Control Center page.

frappe.provide('crm_customization');

crm_customization.BDCCBusinessRequestInsights = class {
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
			<div id="bri-tab-root">

				<!-- Header action buttons -->
				<div class="sc-header-btns">
					<button class="sc-btn sc-btn-outline" id="bri-open-report">Open Original Report</button>
					<button class="sc-btn sc-btn-outline" id="bri-refresh-btn">Refresh</button>
				</div>

				<!-- Report Filters -->
				<div class="sc-form-section">
					<div class="sc-form-section-header">
						<h2>Report Filters</h2>
					</div>
					<div class="bri-filter-grid">
						<div class="sc-field-group"><div id="bri-filter-planned_from"></div></div>
						<div class="sc-field-group"><div id="bri-filter-planned_to"></div></div>
						<div class="sc-field-group"><div id="bri-filter-status"></div></div>
						<div class="sc-field-group"><div id="bri-filter-customer"></div></div>
						<div class="sc-field-group"><div id="bri-filter-subsidairy_company"></div></div>
					</div>
					<div class="bri-filter-actions">
						<button class="sc-btn sc-btn-outline" id="bri-reset-btn">Reset</button>
					</div>
				</div>

				<!-- Report Summary -->
				<div class="bri-summary" id="bri-summary-wrap"></div>

				<!-- Report Table -->
				<div class="sc-form-section">
					<div class="sc-form-section-header">
						<h2>Business Request Insights</h2>
					</div>
					<div class="bri-table-wrap">
						<table class="bri-table" id="bri-table">
							<thead id="bri-table-head"></thead>
							<tbody id="bri-table-body"></tbody>
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
		if (document.getElementById('bd-cc-bri-styles')) return;

		const style = document.createElement('style');
		style.id = 'bd-cc-bri-styles';
		style.innerHTML = `
			/* ── Business Request Insights report ── */
			.bri-filter-grid {
				display: grid; grid-template-columns: repeat(5, 1fr);
				gap: 14px; align-items: start;
			}
			@media (max-width: 1300px) { .bri-filter-grid { grid-template-columns: repeat(3, 1fr); } }
			@media (max-width: 900px) { .bri-filter-grid { grid-template-columns: repeat(2, 1fr); } }
			@media (max-width: 600px)  { .bri-filter-grid { grid-template-columns: 1fr; } }
			.bri-filter-actions { margin-top: 14px; }

			.bri-summary {
				display: none; background: linear-gradient(to bottom right, #ffffff, #f9fafb);
				border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 16px;
				margin: 16px 0 6px 0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
			}
			.bri-summary.has-cards { display: flex; }
			.bri-summary-item {
				flex: 1; text-align: center; padding: 0 12px;
				border-right: 1px dotted #cbd5e1;
			}
			.bri-summary-item:last-child { border-right: none; }
			.bri-summary-value { font-size: 26px; font-weight: 800; color: #0f172a; display: block; }
			.bri-summary-label {
				font-size: 10px; font-weight: 700; color: #64748b;
				text-transform: uppercase; margin-top: 6px; display: block; letter-spacing: 0.4px;
			}

			.bri-table-wrap { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 8px; }
			.bri-table { border-collapse: separate; border-spacing: 0; width: 100%; min-width: 1300px; font-size: 12.5px; }
			.bri-table thead th {
				background: #f8fafc; color: #334155; font-weight: 600; text-align: left;
				padding: 9px 12px; border-bottom: 1px solid #e2e8f0;
				position: sticky; top: 0; z-index: 1; white-space: nowrap;
			}
			.bri-table tbody td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
			.bri-table tbody tr:hover td { background: #f8fafc; }
			.bri-table tbody tr:last-child td { border-bottom: none; }
			.bri-empty { text-align: center !important; color: #9ca3af; padding: 32px 12px !important; }
			.bri-link { color: #2563eb; cursor: pointer; text-decoration: none; font-weight: 500; }
			.bri-link:hover { text-decoration: underline; }

			[data-theme="dark"] .bri-summary { background: linear-gradient(to bottom right, #1e2533, #242c3d); border-color: #2d3748; }
			[data-theme="dark"] .bri-summary-value { color: #f0f4ff; }
			[data-theme="dark"] .bri-summary-label { color: #94a3b8; }
			[data-theme="dark"] .bri-table-wrap { border-color: #2d3748; }
			[data-theme="dark"] .bri-table thead th { background: #1e2533; color: #cbd5e1; border-bottom-color: #2d3748; }
			[data-theme="dark"] .bri-table tbody td { border-bottom-color: #253044; }
			[data-theme="dark"] .bri-table tbody tr:hover td { background: #242c3d; }
			[data-theme="dark"] .bri-link { color: #93c5fd; }
		`;
		document.head.appendChild(style);
	}

	// ─────────────────────────────────────────────
	//  FILTER CONTROLS
	// ─────────────────────────────────────────────
	mount_controls() {
		this._ctrl.planned_from = this.make_control(
			'bri-filter-planned_from', 'Planned From', 'Date'
		);
		this._ctrl.planned_to = this.make_control(
			'bri-filter-planned_to', 'Planned To', 'Date'
		);
		this._ctrl.status = this.make_control(
			'bri-filter-status', 'Status', 'Select',
			'\nNew\nPlanned\nOn-Going\nCancel\nCompleted'
		);
		this._ctrl.customer = crm_customization.make_link_control(
			'bri-filter-customer', 'Customer', 'Customer'
		);
		this._ctrl.subsidairy_company = crm_customization.make_link_control(
			'bri-filter-subsidairy_company', 'Subsidairy Company', 'Subsidiary Company'
		);

		const auto_refresh = () => this._schedule_report();
		Object.keys(this._ctrl).forEach(key => {
			const ctrl = this._ctrl[key];
			if (ctrl && ctrl.df) ctrl.df.change = auto_refresh;
		});
	}

	make_control(container_id, label, fieldtype, options) {
		const container = document.getElementById(container_id);
		if (!container) return null;
		const ctrl = frappe.ui.form.make_control({
			df: {
				fieldtype: fieldtype,
				fieldname: container_id.replace(/-/g, '_'),
				label: label,
				options: options || '',
				placeholder: label,
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
		$('#bri-open-report').on('click', () => frappe.set_route('query-report', 'Business Request Insights'));
		$('#bri-refresh-btn').on('click', () => this.run_report());
		$('#bri-reset-btn').on('click', () => this.reset_filters());
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
		const mapping = {
			planned_from: 'planned_from',
			planned_to: 'planned_to',
			status: 'status',
			customer: 'customer',
			subsidairy_company: 'subsidairy_company',
		};
		Object.keys(mapping).forEach(key => {
			const val = get(this._ctrl[key]);
			if (val) filters[mapping[key]] = val;
		});
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
		const $refresh = $('#bri-refresh-btn');
		$refresh.prop('disabled', true);

		frappe.call({
			method: 'frappe.desk.query_report.run',
			args: {
				report_name: 'Business Request Insights',
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
		this.render_summary(res.report_summary || []);
		this.render_table(res.columns || [], res.result || []);
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

		const $wrap = $('#bri-summary-wrap');
		if (!summary.length) {
			$wrap.removeClass('has-cards').html('');
			return;
		}

		const cards = summary.map(s => {
			const val = esc(s.value || 0);
			const label = esc(s.label || '');
			const color = colors[s.indicator] || '#2563eb';
			return `
				<div class="bri-summary-item">
					<span class="bri-summary-value" style="color:${color}">${val}</span>
					<span class="bri-summary-label">${label}</span>
				</div>
			`;
		}).join('');

		$wrap.addClass('has-cards').html(cards);
	}

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
		$('#bri-table-head').html(head);

		if (!data.length) {
			$('#bri-table-body').html(
				'<tr><td class="bri-empty" colspan="' + (columns.length + 1) + '">No data found. Set filters to load results.</td></tr>'
			);
			return;
		}

		const rows = data.map((row, index) => {
			const tds = columns.map(col => {
				const fieldname = col.fieldname || col.name;
				let value = row[fieldname];
				if (value === null || value === undefined) value = '';

				if (linkColumns[fieldname] && value) {
					return '<td><a class="bri-link" href="#" data-doctype="' + esc(linkColumns[fieldname]) + '" data-name="' + esc(value) + '">' + esc(value) + '</a></td>';
				}
				return '<td>' + esc(value) + '</td>';
			}).join('');

			return '<tr><td>' + (index + 1) + '</td>' + tds + '</tr>';
		}).join('');

		$('#bri-table-body').html(rows);

		// Link cells → open the doc
		this.$panel.find('.bri-link').off('click').on('click', (e) => {
			e.preventDefault();
			frappe.set_route('Form', $(e.currentTarget).data('doctype'), $(e.currentTarget).data('name'));
		});
	}
};