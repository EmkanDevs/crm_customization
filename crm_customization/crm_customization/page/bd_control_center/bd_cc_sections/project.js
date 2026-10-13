// Copyright (c) 2026, Finbyz and contributors
// For license information, please see license.txt
// Project section (mirrors the Project doctype) for the BD Control Center page.

frappe.provide('crm_customization');

crm_customization.BDCCProject = class extends crm_customization.BDCCListPane {
	constructor(controller, $panel) {
		super(controller, $panel);
		this.controller = controller;
		this.page = controller.page;
		this.$panel = $panel;

		this._saved_doc = '';
		this._saved_doc_data = null;
		this._current_subsidiary = '';
		this._current_customer = '';
		this._current_business_request = '';
		this._users_rows = [];
		this._controls = {};
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

	render() {
		this.add_styles();
		this.$panel.html(`
			<div id="pj-tab-root">
				<div class="sc-split">

					${this.list_pane_html()}

					<section class="sc-split-right">

				<!-- Header action buttons -->
				<div class="sc-header-btns">
					<button class="sc-btn sc-btn-outline" id="pj-open-doctype">Open Original DocType</button>
					<button class="sc-btn sc-btn-outline" id="pj-new-entry">New Entry</button>
					<button class="sc-btn sc-btn-outline" id="pj-next-btn">Next</button>
					<button class="sc-btn sc-btn-primary" id="pj-save-btn">Save</button>
				</div>

				<!-- Project Details -->
				<div class="sc-form-section">
					<div class="sc-form-section-header">
						<h2>Project Details</h2>
						<span class="pj-save-badge" id="pj-save-badge">Not Saved</span>
					</div>
					<div class="pj-cols">
						<div class="pj-col">
							<div class="sc-field-group"><div id="pj-field-naming_series"></div></div>
							<div class="sc-field-group"><div id="pj-field-project_name"></div></div>
							<div class="sc-field-group"><div id="pj-field-status"></div></div>
							<div class="sc-field-group"><div id="pj-field-project_type"></div></div>
							<div class="sc-field-group"><div id="pj-field-is_active"></div></div>
							<div class="sc-field-group"><div id="pj-field-percent_complete_method"></div></div>
							<div class="sc-field-group"><div id="pj-field-percent_complete"></div></div>
						</div>
						<div class="pj-col">
							<div class="sc-field-group"><div id="pj-field-project_template"></div></div>
							<div class="sc-field-group"><div id="pj-field-expected_start_date"></div></div>
							<div class="sc-field-group"><div id="pj-field-expected_end_date"></div></div>
							<div class="sc-field-group"><div id="pj-field-priority"></div></div>
							<div class="sc-field-group"><div id="pj-field-department"></div></div>
							<div class="sc-field-group"><div id="pj-field-custom_business_request"></div></div>
						</div>
					</div>
				</div>

				<!-- Customer Details -->
				<div class="sc-form-section">
					<div class="sc-form-section-header"><h2>Customer Details</h2></div>
					<div class="pj-cols">
						<div class="pj-col">
							<div class="sc-field-group"><div id="pj-field-customer"></div></div>
						</div>
						<div class="pj-col">
							<div class="sc-field-group"><div id="pj-field-sales_order"></div></div>
						</div>
					</div>
				</div>

				<!-- Users -->
				<div class="sc-form-section">
					<div class="sc-form-section-header"><h2>Users</h2></div>
					<div class="sc-table-wrap">
						<table class="sc-child-table">
							<thead>
								<tr>
									<th>No.</th>
									<th>User</th>
									<th>Email</th>
									<th>Full Name</th>
									<th>Welcome email sent</th>
									<th>View attachments</th>
									<th>Hide timesheets</th>
									<th>Actions</th>
								</tr>
							</thead>
							<tbody id="pj-users-tbody">
								<tr class="sc-no-data-row"><td colspan="8">No users added yet.</td></tr>
							</tbody>
						</table>
					</div>
					<div class="sc-add-row-bar">
						<button class="sc-add-row-btn" id="pj-users-add-row">Add Row</button>
					</div>
				</div>

				<!-- Notes -->
				<div class="sc-form-section">
					<div class="sc-form-section-header"><h2>Notes</h2></div>
					<div class="sc-field-group"><div id="pj-field-notes"></div></div>
				</div>

				<!-- Start and End Dates -->
				<div class="sc-form-section pj-hidden-section">
					<div class="sc-form-section-header"><h2>Start and End Dates</h2></div>
					<div class="pj-cols">
						<div class="pj-col">
							<div class="sc-field-group"><div id="pj-field-actual_start_date"></div></div>
							<div class="sc-field-group"><div id="pj-field-actual_time"></div></div>
						</div>
						<div class="pj-col">
							<div class="sc-field-group"><div id="pj-field-actual_end_date"></div></div>
						</div>
					</div>
				</div>

				<!-- Costing and Billing -->
				<div class="sc-form-section">
					<div class="sc-form-section-header"><h2>Costing and Billing</h2></div>
					<div class="pj-cols">
						<div class="pj-col">
							<div class="sc-field-group"><div id="pj-field-estimated_costing"></div></div>
							<div class="sc-field-group pj-hidden-field"><div id="pj-field-total_costing_amount"></div></div>
							<div class="sc-field-group pj-hidden-field"><div id="pj-field-total_purchase_cost"></div></div>
							<div class="sc-field-group pj-hidden-field"><div id="pj-field-total_sales_amount"></div></div>
							<div class="sc-field-group pj-hidden-field"><div id="pj-field-total_billable_amount"></div></div>
						</div>
						<div class="pj-col">
							<div class="sc-field-group"><div id="pj-field-company"></div></div>
							<div class="sc-field-group"><div id="pj-field-cost_center"></div></div>
							<div class="sc-field-group pj-hidden-field"><div id="pj-field-total_billed_amount"></div></div>
							<div class="sc-field-group pj-hidden-field"><div id="pj-field-total_consumed_material_cost"></div></div>
						</div>
					</div>
				</div>

				<!-- Margin -->
				<div class="sc-form-section pj-hidden-section">
					<div class="sc-form-section-header"><h2>Margin</h2></div>
					<div class="pj-cols">
						<div class="pj-col">
							<div class="sc-field-group"><div id="pj-field-gross_margin"></div></div>
						</div>
						<div class="pj-col">
							<div class="sc-field-group"><div id="pj-field-per_gross_margin"></div></div>
						</div>
					</div>
				</div>

				<!-- Monitor Progress -->
				<div class="sc-form-section">
					<div class="sc-form-section-header"><h2>Monitor Progress</h2></div>
					<div class="pj-cols">
						<div class="pj-col">
							<div class="sc-field-group"><div id="pj-field-collect_progress"></div></div>
							<div class="sc-field-group pj-hidden-field"><div id="pj-field-holiday_list"></div></div>
							<div class="sc-field-group pj-hidden-field"><div id="pj-field-frequency"></div></div>
							<div class="sc-field-group pj-hidden-field"><div id="pj-field-from_time"></div></div>
							<div class="sc-field-group pj-hidden-field"><div id="pj-field-to_time"></div></div>
							<div class="sc-field-group pj-hidden-field"><div id="pj-field-first_email"></div></div>
							<div class="sc-field-group pj-hidden-field"><div id="pj-field-daily_time_to_send"></div></div>
							<div class="sc-field-group pj-hidden-field"><div id="pj-field-day_to_send"></div></div>
						</div>
						<div class="pj-col">
							<div class="sc-field-group"><div id="pj-field-milestone_based_project"></div></div>
							<div class="sc-field-group pj-hidden-field"><div id="pj-field-subject"></div></div>
							<div class="sc-field-group pj-hidden-field"><div id="pj-field-message"></div></div>
							<div class="sc-field-group pj-hidden-field"><div id="pj-field-second_email"></div></div>
							<div class="sc-field-group pj-hidden-field"><div id="pj-field-weekly_time_to_send"></div></div>
						</div>
					</div>
					</div>
				</section>
			</div>
			</div>
		`);

		this.mount_controls();
		this.render_users_table();
		this.wire_pj_buttons();
		this.bind_user_edit_signal();
		this.mount_list_pane();
	}

	// ─────────────────────────────────────────────
	//  LEFT PANE CONFIG — Projects
	// ─────────────────────────────────────────────
	list_prefix() { return 'pj'; }
	list_title() { return __('Projects'); }
	list_search_hint() { return __('Search project, customer...'); }
	list_doctype() { return 'Project'; }
	list_fields() { return ['name', 'project_name', 'customer', 'status', 'department', 'modified']; }
	list_empty_message() { return __('No Projects yet.'); }

	list_filters() {
		const filters = [];
		if (this._current_customer) filters.push(['customer', '=', this._current_customer]);
		if (this._current_business_request) filters.push(['custom_business_request', '=', this._current_business_request]);
		return filters;
	}

	list_scope_parts() {
		const parts = [];
		if (this._current_customer) parts.push(this._current_customer);
		if (this._current_business_request) parts.push(this._current_business_request);
		return parts;
	}

	list_row_title(row) { return row.project_name || row.name; }
	list_row_badge(row) { return row.status || ''; }
	list_row_meta(row) { return [row.customer, row.department]; }
	list_match(row) {
		return [row.name, row.project_name, row.customer, row.status, row.department]
			.filter(Boolean).join(' ');
	}

	load_list_record(name) { this.load_project(name); }
	new_list_record() { this.new_project_entry(); }

	/**
	 * Mark the form dirty whenever a control the section owns changes. The left
	 * pane's search box and buttons live outside `.sc-split-right`, so the
	 * selector excludes them.
	 */
	

	/**
	 * Called by the record loader once the form is populated, so the shared
	 * pane can release `_loading`, clear its dirty flag and highlight the row.
	 */
	after_record_loaded() {
		this._loading = false;
		this.capture_dirty_baseline(250);
		this.set_active_list_item(this._saved_doc);
	}

	add_styles() {
		if (document.getElementById('bd-cc-project-styles')) return;

		const style = document.createElement('style');
		style.id = 'bd-cc-project-styles';
		style.innerHTML = `
			/* ── Project section ── */
			.pj-save-badge {
				font-size: 11px; font-weight: 500; padding: 2px 8px;
				border-radius: 10px; border: 1px solid #d1d5db;
				color: #6b7280; background: #f9fafb;
			}
			.pj-cols { display: flex; gap: 24px; align-items: flex-start; }
			.pj-col { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 16px; }
			@media (max-width: 900px) { .pj-cols { flex-direction: column; } }
			.pj-hidden-field { display: none !important; }
			.pj-hidden-section { display: none; }

			.pj-user-check { min-width: 50px; text-align: center; }
			.pj-user-check input[type="checkbox"] {
				width: 16px !important; height: 16px !important;
				min-width: 16px !important; max-width: 16px !important;
				max-height: 16px !important;
				margin: 0 auto !important; padding: 0 !important;
				display: inline-block !important; vertical-align: middle;
				accent-color: #2563eb; cursor: pointer;
				appearance: auto; -webkit-appearance: checkbox;
			}
			.sc-child-table tbody td.pj-user-ro {
				color: #6b7280; background: #f9fafb;
			}

			/* Text / Text Editor sizing */
			#pj-field-notes .frappe-control { min-width: 100%; }
			#pj-field-message .frappe-control { min-width: 100%; }
			#pj-field-message textarea { min-height: 80px !important; }
		`;
		document.head.appendChild(style);
	}

	field_definitions() {
		return [
			{ fieldname: 'project_name',            label: 'Project Name',                type: 'Data', reqd: true },
			{ fieldname: 'status',                  label: 'Status',                      type: 'Select', options: ['Open', 'Completed', 'Cancelled'] },
			{ fieldname: 'project_type',            label: 'Project Type',                type: 'Link', options: 'Project Type' },
			{ fieldname: 'is_active',               label: 'Is Active',                   type: 'Select', options: ['Yes', 'No'] },
			{ fieldname: 'percent_complete_method', label: '% Complete Method',           type: 'Select', options: ['Manual', 'Task Completion', 'Task Progress', 'Task Weight'] },
			{ fieldname: 'percent_complete',        label: '% Completed',                 type: 'Percent', read_only: true },
			{ fieldname: 'project_template',        label: 'From Template',               type: 'Link', options: 'Project Template' },
			{ fieldname: 'expected_start_date',     label: 'Expected Start Date',         type: 'Date' },
			{ fieldname: 'expected_end_date',       label: 'Expected End Date',           type: 'Date' },
			{ fieldname: 'priority',                label: 'Priority',                    type: 'Select', options: ['Medium', 'Low', 'High'] },
			{ fieldname: 'department',              label: 'Department',                  type: 'Link', options: 'Department' },
			{ fieldname: 'naming_series',           label: 'Series',                      type: 'Select', options: ['PROJ-.####'], reqd: true },
			{ fieldname: 'customer',                label: 'Customer',                    type: 'Link', options: 'Customer' },
			{ fieldname: 'sales_order',             label: 'Sales Order',                 type: 'Link', options: 'Sales Order' },
			{ fieldname: 'custom_business_request', label: 'Business Request',            type: 'Link', options: 'Business Request' },
			{ fieldname: 'notes',                   label: 'Notes',                       type: 'Text Editor' },
			{ fieldname: 'actual_start_date',       label: 'Actual Start Date (via Timesheet)', type: 'Date', read_only: true },
			{ fieldname: 'actual_time',             label: 'Actual Time in Hours (via Timesheet)', type: 'Float', read_only: true },
			{ fieldname: 'actual_end_date',         label: 'Actual End Date (via Timesheet)', type: 'Date', read_only: true },
			{ fieldname: 'estimated_costing',       label: 'Estimated Cost',              type: 'Currency' },
			{ fieldname: 'total_costing_amount',    label: 'Total Costing Amount (via Timesheet)', type: 'Currency', read_only: true },
			{ fieldname: 'total_purchase_cost',     label: 'Total Purchase Cost (via Purchase Invoice)', type: 'Currency', read_only: true },
			{ fieldname: 'total_sales_amount',      label: 'Total Sales Amount (via Sales Order)', type: 'Currency', read_only: true },
			{ fieldname: 'total_billable_amount',   label: 'Total Billable Amount (via Timesheet)', type: 'Currency', read_only: true },
			{ fieldname: 'total_billed_amount',     label: 'Total Billed Amount (via Sales Invoice)', type: 'Currency', read_only: true },
			{ fieldname: 'total_consumed_material_cost', label: 'Total Consumed Material Cost (via Stock Entry)', type: 'Currency', read_only: true },
			{ fieldname: 'cost_center',             label: 'Default Cost Center',         type: 'Link', options: 'Cost Center' },
			{ fieldname: 'company',                 label: 'Company',                     type: 'Link', options: 'Company', reqd: true },
			{ fieldname: 'gross_margin',            label: 'Gross Margin',                type: 'Currency', read_only: true },
			{ fieldname: 'per_gross_margin',        label: 'Gross Margin %',              type: 'Percent', read_only: true },
			{ fieldname: 'collect_progress',        label: 'Collect Progress',            type: 'Check' },
			{ fieldname: 'holiday_list',            label: 'Holiday List',                type: 'Link', options: 'Holiday List' },
			{ fieldname: 'frequency',               label: 'Frequency To Collect Progress', type: 'Select', options: ['Hourly', 'Twice Daily', 'Daily', 'Weekly'] },
			{ fieldname: 'from_time',               label: 'From Time',                   type: 'Time' },
			{ fieldname: 'to_time',                 label: 'To Time',                     type: 'Time' },
			{ fieldname: 'first_email',             label: 'First Email',                 type: 'Time' },
			{ fieldname: 'second_email',            label: 'Second Email',                type: 'Time' },
			{ fieldname: 'daily_time_to_send',      label: 'Daily Time to send',          type: 'Time' },
			{ fieldname: 'day_to_send',             label: 'Day to Send',                 type: 'Select', options: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
			{ fieldname: 'weekly_time_to_send',     label: 'Weekly Time to send',         type: 'Time' },
			{ fieldname: 'subject',                 label: 'Subject',                     type: 'Data', reqd: true },
			{ fieldname: 'message',                 label: 'Message',                     type: 'Text', reqd: true },
			{ fieldname: 'milestone_based_project', label: 'Milestone Based Project',     type: 'Check' },
		];
	}

	field_value(fieldname) {
		const val = this._controls[fieldname] ? this._controls[fieldname].get_value() : '';
		return (val === null || val === undefined) ? '' : val;
	}

system_default_company() {
return (frappe.boot && frappe.boot.sysdefaults && frappe.boot.sysdefaults.company)
|| frappe.defaults.get_default('company')
|| '';
}

// Project requires a company; fall back to the system default when the
// stored record has none. Consumed by BDCCListPane.populate_from_doc.
doc_field_fallback(def, raw) {
if (def.fieldname === 'company' && !raw) return this.system_default_company();
return null;
}

	mount_controls() {
		this._ctrl_subsidiary = crm_customization.make_link_control(
			'pj-subsidiary-control', 'Subsidairy Company', 'Subsidiary Company (primary)',
			(val) => this.on_subsidiary_change(val)
		);
		this._ctrl_customer = crm_customization.make_link_control(
			'pj-customer-control', 'Customer', 'Client/Customer (optional)',
			(val) => this.on_customer_change(val)
		);

		this.field_definitions().forEach(def => {
			const container = document.getElementById('pj-field-' + def.fieldname);
			if (!container) return;
			const ctrl = frappe.ui.form.make_control({
				df: {
					fieldtype: def.type,
					fieldname: 'pj_' + def.fieldname,
					label: def.label,
					options: Array.isArray(def.options) ? def.options.join('\n') : (def.options || ''),
					reqd: def.reqd ? 1 : 0,
					read_only: def.read_only ? 1 : 0,
				},
				parent: container,
				render_input: true,
			});
			ctrl.refresh();
			this._controls[def.fieldname] = ctrl;
		});

		const defaults = {
			status: 'Open',
			percent_complete_method: 'Task Completion',
			priority: 'Medium',
			naming_series: 'PROJ-.####',
			company: this.system_default_company(),
		};
		Object.keys(defaults).forEach(fn => {
			const ctrl = this._controls[fn];
			if (ctrl) { try { ctrl.set_value(defaults[fn]); } catch (e) {} }
		});

		const cp = this._controls['collect_progress'];
		if (cp) {
			const refresh = () => this.update_progress_fields();
			if (cp.df) cp.df.change = refresh;
			if (cp.$wrapper) {
				cp.$wrapper.on('change', 'input[type="checkbox"]', refresh);
				cp.$wrapper.on('click', 'input[type="checkbox"]', () => setTimeout(refresh, 50));
			}
		}

		this.bind_form_to_context(this._controls['customer'], 'customer');
		this.update_progress_fields();
		this.update_costing_fields();
	}

		bind_form_to_context(ctrl, fieldname) {
			if (!ctrl) return;
			const push = () => {
				const val = ctrl.get_value() || '';
				if (fieldname === 'customer') {
					this._current_customer = val;
					if (this._ctrl_customer && (this._ctrl_customer.get_value() || '') !== val) {
						this._ctrl_customer.set_value(val);
					}
				}
				this.update_context_desc();
			};
			ctrl.$input.on('change', () => setTimeout(push, 100));
			ctrl.$input.on('awesomplete-selectcomplete', () => setTimeout(push, 150));
		}

		set_field_visible(fieldname, visible) {
			const el = document.getElementById('pj-field-' + fieldname);
			if (!el) return;
			const wrapper = el.closest('.sc-field-group') || el;
			wrapper.classList.toggle('pj-hidden-field', !visible);
		}

		update_costing_fields() {
			[
				'total_costing_amount',
				'total_purchase_cost',
				'total_sales_amount',
				'total_billable_amount',
				'total_billed_amount',
				'total_consumed_material_cost',
			].forEach(fn => {
				this.set_field_visible(fn, (this.field_value(fn) || '') !== '');
			});
		}

		update_progress_fields() {
			const on = !!this.field_value('collect_progress');
			['holiday_list', 'frequency', 'subject', 'from_time', 'to_time', 'message'].forEach(fn => {
				this.set_field_visible(fn, on);
			});
		}

	update_context_desc() {
		const parts = [];
		if (this._current_subsidiary) parts.push(frappe.utils.escape_html(String(this._current_subsidiary)));
		if (this._saved_doc) parts.push(frappe.utils.escape_html(String(this._saved_doc)));
		if (this._current_customer) parts.push(frappe.utils.escape_html(String(this._current_customer)));
		if (this._current_business_request) parts.push(frappe.utils.escape_html(String(this._current_business_request)));
		const text = parts.length
			? 'Working on ' + parts.map(p => '<strong>' + p + '</strong>').join(' / ')
			: 'Select a Project to begin';
		$('#pj-context-desc').html(text);
	}

	// ─────────────────────────────────────────────
	//  CONTEXT SELECTOR HANDLERS
	// ─────────────────────────────────────────────
	on_subsidiary_change(val) {
		this._current_subsidiary = val || '';
		this.on_working_context_change();
		this.update_context_desc();
	}

	on_customer_change(val) {
		const customer_ctrl = this._controls['customer'];
		if (customer_ctrl) customer_ctrl.set_value(val || '');
		this._current_customer = val || '';
		this.on_working_context_change();
		this.update_context_desc();
	}

	on_business_request_change(val) {
		this._current_business_request = val || '';
		this.on_working_context_change();
		const ctrl = this._controls['custom_business_request'];
		if (ctrl && String(ctrl.get_value() || '') !== String(val || '')) {
			ctrl.set_value(val || '');
		}
		this.update_context_desc();
	}

	// ─────────────────────────────────────────────
	//  USERS CHILD TABLE
	// ─────────────────────────────────────────────
	render_users_table() {
		const tbody = document.getElementById('pj-users-tbody');
		if (!tbody) return;
		if (!this._users_rows || this._users_rows.length === 0) {
			tbody.innerHTML = `<tr class="sc-no-data-row"><td colspan="8">No users added yet.</td></tr>`;
			return;
		}

		const esc = (v) => frappe.utils.escape_html(v || '');
		const check = (v) => v ? 'checked' : '';

		tbody.innerHTML = this._users_rows.map((row, idx) => `
			<tr data-idx="${idx}">
				<td class="sc-row-num">${idx + 1}</td>
				<td><div class="pj-user-link sc-table-link" data-field="user" data-doctype="User"></div></td>
				<td><input type="text" class="pj-user-ro" value="${esc(row.email)}" data-field="email" readonly></td>
				<td><input type="text" class="pj-user-ro" value="${esc(row.full_name)}" data-field="full_name" readonly></td>
				<td class="pj-user-check"><input type="checkbox" data-field="welcome_email_sent" ${check(row.welcome_email_sent)}></td>
				<td class="pj-user-check"><input type="checkbox" data-field="view_attachments" ${check(row.view_attachments)}></td>
				<td class="pj-user-check"><input type="checkbox" data-field="hide_timesheets" ${check(row.hide_timesheets)}></td>
				<td class="sc-actions-cell">
					<button type="button" class="sc-remove-row-btn" data-action="remove-row">Delete</button>
				</td>
			</tr>
		`).join('');

		$(tbody).find('input[type="checkbox"]').on('change', (e) => {
			const $el = $(e.target);
			const idx = parseInt($el.closest('tr').data('idx'));
			const field = $el.data('field');
			if (!isNaN(idx) && field) this._users_rows[idx][field] = $el.is(':checked') ? 1 : 0;
		});

		$(tbody).find('.pj-user-link').each((_, el) => {
			const $el = $(el);
			const idx = parseInt($el.closest('tr').data('idx'));
			if (isNaN(idx) || !this._users_rows[idx]) return;
			const row = this._users_rows[idx];

			const ctrl = frappe.ui.form.make_control({
				df: { fieldtype: 'Link', fieldname: 'user', options: 'User', placeholder: 'User' },
				parent: el,
				render_input: true,
			});
			ctrl.refresh();
			ctrl.set_value(row.user || '');

			const save = () => {
				if (!this._users_rows[idx]) return;
				this._users_rows[idx].user = ctrl.get_value() || '';
				const user = this._users_rows[idx].user;
				if (user) {
					frappe.db.get_value('User', user, ['email', 'full_name'], (r) => {
						if (!this._users_rows[idx] || this._users_rows[idx].user !== user) return;
						this._users_rows[idx].email = (r && r.email) || '';
						this._users_rows[idx].full_name = (r && r.full_name) || '';
						const $tr = $el.closest('tr');
						$tr.find('[data-field="email"]').val(this._users_rows[idx].email);
						$tr.find('[data-field="full_name"]').val(this._users_rows[idx].full_name);
					});
				} else {
					this._users_rows[idx].email = '';
					this._users_rows[idx].full_name = '';
					const $tr = $el.closest('tr');
					$tr.find('[data-field="email"]').val('');
					$tr.find('[data-field="full_name"]').val('');
				}
			};
			const $tr = $el.closest('tr');
			ctrl.$input.on('focusin', () => $tr.addClass('sc-focus-row'));
			ctrl.$input.on('focusout', () => setTimeout(() => $tr.removeClass('sc-focus-row'), 200));
			ctrl.$input.on('change', () => setTimeout(save, 80));
			ctrl.$wrapper.on('awesomplete-selectcomplete', () => setTimeout(save, 120));
			crm_customization.attach_link_teleport(ctrl, $el);
		});

		$(tbody).find('.sc-remove-row-btn').on('click', (e) => {
			const idx = parseInt($(e.currentTarget).closest('tr').data('idx'));
			if (!isNaN(idx) && idx >= 0 && idx < this._users_rows.length) {
				this._users_rows.splice(idx, 1);
				this.render_users_table();
				this.mark_dirty();
			}
		});
	}

	// ─────────────────────────────────────────────
	//  BUTTON WIRING
	// ─────────────────────────────────────────────
	wire_pj_buttons() {
		$('#pj-open-doctype').on('click', () => frappe.set_route('List', 'Project'));
		$('#pj-new-entry').on('click', () => this.new_entry_with_guard(() => this.new_project_entry()));
		$('#pj-next-btn').on('click', () => this.navigate_next());
		$('#pj-save-btn').on('click', () => this.save_project());

		$('#pj-clear-context').on('click', () => {
			if (this._ctrl_subsidiary) this._ctrl_subsidiary.set_value('');
			if (this._ctrl_customer) this._ctrl_customer.set_value('');
			this._current_subsidiary = '';
			this._current_customer = '';
			this.new_project_entry();
		});

		$('#pj-users-add-row').on('click', () => {
			this._users_rows.push({
				user: '', email: '', full_name: '',
				welcome_email_sent: 0, view_attachments: 0, hide_timesheets: 0,
			});
			this.render_users_table();
			this.mark_dirty();
		});
	}

	// ─────────────────────────────────────────────
	//  SAVE / NEW / NEXT / LOAD
	// ─────────────────────────────────────────────
	build_payload() {
		const doc = this._saved_doc_data
			? JSON.parse(JSON.stringify(this._saved_doc_data))
			: { doctype: 'Project' };
		doc.doctype = 'Project';
		doc.name = this._saved_doc || undefined;

		const fields = this.field_definitions().map(f => f.fieldname);
		fields.forEach(fieldname => {
			doc[fieldname] = this.field_value(fieldname);
		});

		if (!doc.name && !doc.naming_series) doc.naming_series = 'PROJ-.####';

		doc.users = this._users_rows.map(row => ({
			doctype: 'Project User',
			user: row.user || '',
			email: row.email || '',
			full_name: row.full_name || '',
			welcome_email_sent: row.welcome_email_sent ? 1 : 0,
			view_attachments: row.view_attachments ? 1 : 0,
			hide_timesheets: row.hide_timesheets ? 1 : 0,
		}));

		return doc;
	}

	save_project() {
		const doc = this.build_payload();
		if (this.field_value('collect_progress')) {
			if (!this.field_value('subject')) {
				frappe.msgprint({ message: __('Subject is mandatory when Collect Progress is enabled.'), indicator: 'orange' });
				return;
			}
			if (!this.field_value('message')) {
				frappe.msgprint({ message: __('Message is mandatory when Collect Progress is enabled.'), indicator: 'orange' });
				return;
			}
		}
		frappe.call({
			method: 'frappe.client.save',
			args: { doc: doc },
			callback: (r) => {
				if (r.message) {
					this._saved_doc = r.message.name;
					this._saved_doc_data = r.message;
					$('#pj-save-badge').text(r.message.name).css({ color: '#16a34a', borderColor: '#86efac', background: '#f0fdf4' });
					frappe.show_alert({ message: __('Saved: {0}', [r.message.name]), indicator: 'green' });
				this.capture_dirty_baseline(250);
				this.set_active_list_item(r.message.name);
				this.load_list();
					this.update_context_desc();
					this.update_costing_fields();
				}
			},
			error: (r) => {
				frappe.msgprint({ title: __('Error'), message: r.message || __('Save failed.'), indicator: 'red' });
			},
		});
	}

	new_project_entry() {
		this.capture_dirty_baseline(250);
		this.set_active_list_item('');
		this._load_seq++;
		if (this._ctrl_subsidiary) this._ctrl_subsidiary.set_value('');
		if (this._ctrl_customer) this._ctrl_customer.set_value('');
		this._saved_doc = '';
		this._saved_doc_data = null;
		this._users_rows = [];
		this._current_subsidiary = '';
		this._current_customer = '';
		this._current_business_request = '';

		Object.keys(this._controls).forEach(fieldname => {
			try { this._controls[fieldname].set_value(''); } catch (e) {}
		});
		const defaults = {
			status: 'Open',
			percent_complete_method: 'Task Completion',
			priority: 'Medium',
			naming_series: 'PROJ-.####',
			company: this.system_default_company(),
		};
		Object.keys(defaults).forEach(fn => {
			if (this._controls[fn]) { try { this._controls[fn].set_value(defaults[fn]); } catch (e) {} }
		});

		this.render_users_table();
		$('#pj-save-badge').text('Not Saved').css({ color: '#6b7280', borderColor: '#d1d5db', background: '#f9fafb' });
		this.update_context_desc();
		this.update_progress_fields();
		this.update_costing_fields();
	}

	navigate_next() {
		const current = this._saved_doc;
		if (!current) {
			frappe.msgprint({ message: __('Save a Project first.'), indicator: 'orange' });
			return;
		}
		frappe.call({
			method: 'frappe.client.get_list',
			args: {
				doctype: 'Project',
				filters: [['name', '>', current]],
				fields: ['name'],
				order_by: 'name asc',
				limit: 1,
			},
			callback: (r) => {
				if (r.message && r.message.length > 0) {
					this.load_project(r.message[0].name);
				} else {
					frappe.show_alert({ message: __('This is the last record.'), indicator: 'blue' });
				}
			},
		});
	}

	load_project(name) {
		const seq = ++this._load_seq;
		this._loading = true;
		frappe.call({
			method: 'frappe.client.get',
			args: { doctype: 'Project', name: name },
			callback: (r) => {
				if (seq !== this._load_seq || !r.message) return;
				const doc = r.message;
				this._saved_doc = doc.name;
				this._saved_doc_data = doc;

this.populate_from_doc(doc);

				this._users_rows = (doc.users || []).map(u => ({
					user: u.user || '',
					email: u.email || '',
					full_name: u.full_name || '',
					welcome_email_sent: u.welcome_email_sent || 0,
					view_attachments: u.view_attachments || 0,
					hide_timesheets: u.hide_timesheets || 0,
				}));
				this.render_users_table();

				this._current_customer = doc.customer || '';
				if (this._ctrl_customer) this._ctrl_customer.set_value(doc.customer || '');

				$('#pj-save-badge').text(doc.name).css({ color: '#16a34a', borderColor: '#86efac', background: '#f0fdf4' });
				this.update_context_desc();
				this.update_progress_fields();
				this.update_costing_fields();
				this.after_record_loaded();
			},
		});
	}
};