// Copyright (c) 2026, Finbyz and contributors
// For license information, please see license.txt
// Client Issue Register section for the BD Control Center page.

frappe.provide('crm_customization');

crm_customization.BDCCClientIssueRegister = class extends crm_customization.BDCCListPane {
	constructor(controller, $panel) {
		super(controller, $panel);
		this.controller = controller;
		this.page = controller.page;
		this.$panel = $panel;

		this._current_subsidiary = '';
		this._current_customer = '';
		this._saved_doc = '';
		this._saved_doc_data = null;
		this._controls = {};
		this._impact_rows = [];
		this._action_rows = [];
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
			<div id="cir-tab-root">
				<div class="sc-split">

					${this.list_pane_html()}

					<section class="sc-split-right">

				<!-- Header action buttons -->
				<div class="sc-header-btns">
					<button class="sc-btn sc-btn-outline" id="cir-open-doctype">Open Original DocType</button>
					<button class="sc-btn sc-btn-outline" id="cir-new-entry">New Entry</button>
					<button class="sc-btn sc-btn-outline" id="cir-next-btn">Next</button>
					<button class="sc-btn sc-btn-primary" id="cir-save-btn">Save</button>
				</div>

				<!-- Issue Details -->
				<div class="sc-form-section">
					<div class="sc-form-section-header">
						<h2>Issue Details</h2>
						<span class="cir-save-badge" id="cir-save-badge">Not Saved</span>
					</div>
					<div class="cir-cols">
						<div class="cir-col">
							<div class="sc-field-group"><div id="cir-field-customer"></div></div>
							<div class="sc-field-group"><div id="cir-field-issue_title"></div></div>
							<div class="sc-field-group"><div id="cir-field-detailed_description"></div></div>
						</div>
						<div class="cir-col">
							<div class="sc-field-group"><div id="cir-field-subsidairy_company"></div></div>
							<div class="sc-field-group"><div id="cir-field-date_identified"></div></div>
							<div class="sc-field-group"><div id="cir-field-department"></div></div>
						</div>
						<div class="cir-col">
							<div class="sc-field-group"><div id="cir-field-issue_type"></div></div>
							<div class="sc-field-group"><div id="cir-field-root_cause"></div></div>
							<div class="sc-field-group"><div id="cir-field-raised_by"></div></div>
						</div>
					</div>
				</div>

				<!-- Impact Assessment -->
				<div class="sc-form-section">
					<div class="sc-form-section-header"><h2>Impact Assessment</h2></div>
					<div class="cir-cols">
						<div class="cir-col">
							<div class="sc-field-group"><div id="cir-field-business_blocked"></div></div>
							<div class="sc-field-group"><div id="cir-field-custom_business_on_hold"></div></div>
						</div>
						<div class="cir-col">
							<div class="sc-field-group"><div id="cir-field-impact_level"></div></div>
						</div>
						<div class="cir-col">
							<div class="sc-field-group"><div id="cir-field-estimated_value_impact"></div></div>
						</div>
					</div>
					<div class="sc-table-wrap">
						<table class="sc-child-table">
							<thead>
								<tr>
									<th>No.</th>
									<th>Impact Type</th>
									<th>Impact Amount</th>
									<th>Actions</th>
								</tr>
							</thead>
							<tbody id="cir-impact-tbody">
								<tr class="sc-no-data-row"><td colspan="4">No impact types yet. Add a row to begin.</td></tr>
							</tbody>
						</table>
					</div>
					<div class="sc-add-row-bar">
						<button class="sc-add-row-btn" id="cir-impact-add-row">Add Row</button>
					</div>
				</div>

				<!-- Timeline Tracking -->
				<div class="sc-form-section">
					<div class="sc-form-section-header"><h2>Timeline Tracking</h2></div>
					<div class="cir-cols">
						<div class="cir-col">
							<div class="sc-field-group"><div id="cir-field-issue_start_date"></div></div>
							<div class="sc-field-group"><div id="cir-field-actual_resolution_date"></div></div>
							<div class="sc-field-group"><div id="cir-field-days_lost"></div></div>
						</div>
						<div class="cir-col">
							<div class="sc-field-group"><div id="cir-field-expected_resolution_date"></div></div>
							<div class="sc-field-group"><div id="cir-field-business_resume_date"></div></div>
							<div class="sc-field-group"><div id="cir-field-resolved_by"></div></div>
						</div>
					</div>
				</div>

				<!-- Action Tracking -->
				<div class="sc-form-section">
					<div class="sc-form-section-header"><h2>Action Tracking</h2></div>
					<div class="sc-table-wrap">
						<table class="sc-child-table">
							<thead>
								<tr>
									<th>No.</th>
									<th>Action Date</th>
									<th>Action Taken</th>
									<th>Action Owner</th>
									<th>Next Step</th>
									<th>Remarks</th>
									<th>Actions</th>
								</tr>
							</thead>
							<tbody id="cir-actions-tbody">
								<tr class="sc-no-data-row"><td colspan="7">No actions yet. Add a row to begin.</td></tr>
							</tbody>
						</table>
					</div>
					<div class="sc-add-row-bar">
						<button class="sc-add-row-btn" id="cir-actions-add-row">Add Row</button>
					</div>
				</div>

				<!-- Resolution Details -->
				<div class="sc-form-section">
					<div class="sc-form-section-header"><h2>Resolution Details</h2></div>
					<div class="cir-cols">
						<div class="cir-col">
							<div class="sc-field-group"><div id="cir-field-resolution_summary"></div></div>
						</div>
						<div class="cir-col">
							<div class="sc-field-group"><div id="cir-field-preventive_action"></div></div>
						</div>
					</div>
					</div>
				</section>
			</div>
			</div>
		`);

		this.mount_controls();
		this.render_impact_table();
		this.render_actions_table();
		this.wire_buttons();
		this.bind_user_edit_signal();
		this.mount_list_pane();
	}

	// ─────────────────────────────────────────────
	//  LEFT PANE CONFIG — Client Issues
	// ─────────────────────────────────────────────
	list_prefix() { return 'cir'; }
	list_title() { return __('Client Issues'); }
	list_search_hint() { return __('Search issue, customer...'); }
	list_doctype() { return 'Client Issue Register'; }
	list_fields() { return ['name', 'issue_title', 'customer', 'subsidairy_company', 'issue_type', 'modified']; }
	list_empty_message() { return __('No Client Issues yet.'); }

	list_filters() {
		const filters = [];
		if (this._current_subsidiary) filters.push(['subsidairy_company', '=', this._current_subsidiary]);
		if (this._current_customer) filters.push(['customer', '=', this._current_customer]);
		return filters;
	}

	list_scope_parts() {
		const parts = [];
		if (this._current_subsidiary) parts.push(this._current_subsidiary);
		if (this._current_customer) parts.push(this._current_customer);
		return parts;
	}

	list_row_title(row) { return row.issue_title || row.name; }
	list_row_badge(row) { return row.issue_type || ''; }
	list_row_meta(row) { return [row.customer, row.subsidairy_company]; }
	list_match(row) {
		return [row.name, row.issue_title, row.customer, row.subsidairy_company, row.issue_type]
			.filter(Boolean).join(' ');
	}

	load_list_record(name) { this.load_client_issue(name); }
	new_list_record() { this.new_entry(); }

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
		if (document.getElementById('bd-cc-client-issue-register-styles')) return;

		const style = document.createElement('style');
		style.id = 'bd-cc-client-issue-register-styles';
		style.innerHTML = `
			/* ── Client Issue Register section ── */
			.cir-save-badge {
				font-size: 11px; font-weight: 500; padding: 2px 8px;
				border-radius: 10px; border: 1px solid #d1d5db;
				color: #6b7280; background: #f9fafb;
			}
			.cir-cols { display: flex; gap: 24px; align-items: flex-start; }
			.cir-col { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 16px; }
			@media (max-width: 900px) { .cir-cols { flex-direction: column; } }
		`;
		document.head.appendChild(style);
	}

	field_definitions() {
		return [
			{ fieldname: 'customer',                 label: 'Customer',                 type: 'Link', options: 'Customer' },
			{ fieldname: 'issue_title',              label: 'Issue Title',              type: 'Data' },
			{ fieldname: 'department',               label: 'Department',               type: 'Link', options: 'Department' },
			{ fieldname: 'subsidairy_company',       label: 'Subsidiary Company',       type: 'Link', options: 'Subsidairy Company' },
			{ fieldname: 'detailed_description',     label: 'Detailed Description',     type: 'Small Text' },
			{ fieldname: 'date_identified',          label: 'Date Identified',          type: 'Date' },
			{ fieldname: 'issue_type',               label: 'Issue Type',               type: 'Link', options: 'Client Issue Type' },
			{ fieldname: 'root_cause',               label: 'Root Cause',               type: 'Select', options: '\nData\nInternal\nClient\nExternal Authority' },
			{ fieldname: 'raised_by',                label: 'Raised By',                type: 'Link', options: 'User' },
			{ fieldname: 'impact_level',             label: 'Impact Level',             type: 'Select', options: '\nLow\nMedium\nHigh\nCritical' },
			{ fieldname: 'estimated_value_impact',   label: 'Estimated Value Impact',   type: 'Currency' },
			{ fieldname: 'business_blocked',         label: 'Business Blocked',         type: 'Check' },
			{ fieldname: 'custom_business_on_hold',  label: 'Business On Hold',         type: 'Check' },
			{ fieldname: 'issue_start_date',         label: 'Issue Start Date',         type: 'Date' },
			{ fieldname: 'actual_resolution_date',   label: 'Actual Resolution Date',   type: 'Date' },
			{ fieldname: 'days_lost',                label: 'Days Lost',                type: 'Int', read_only: true },
			{ fieldname: 'expected_resolution_date', label: 'Expected Resolution Date', type: 'Date' },
			{ fieldname: 'business_resume_date',     label: 'Business Resume Date',     type: 'Date' },
			{ fieldname: 'resolution_summary',       label: 'Resolution Summary',       type: 'Small Text' },
			{ fieldname: 'preventive_action',        label: 'Preventive Action',        type: 'Small Text' },
			{ fieldname: 'resolved_by',              label: 'Resolved By',              type: 'Link', options: 'User' },
		];
	}

	mount_controls() {
		this._ctrl_subsidiary = crm_customization.make_link_control(
			'cir-subsidiary-control', 'Subsidairy Company', 'Subsidiary Company (primary)',
			(val) => this.on_subsidiary_change(val)
		);
		this._ctrl_customer = crm_customization.make_link_control(
			'cir-customer-control', 'Customer', 'Client/Customer (optional)',
			(val) => this.on_customer_change(val)
		);

		this.field_definitions().forEach(def => {
			const container = document.getElementById('cir-field-' + def.fieldname);
			if (!container) return;
			const ctrl = frappe.ui.form.make_control({
				df: {
					fieldtype: def.type,
					fieldname: 'cir_' + def.fieldname,
					label: def.label,
					options: def.options || '',
					read_only: def.read_only ? 1 : 0,
				},
				parent: container,
				render_input: true,
			});
			ctrl.refresh();
			this._controls[def.fieldname] = ctrl;
		});

		this.bind_form_to_context(this._controls['subsidairy_company'], 'subsidairy_company');
		this.bind_form_to_context(this._controls['customer'], 'customer');

		const identified = this._controls['date_identified'];
		if (identified) identified.set_value(frappe.datetime.get_today());

		['issue_start_date', 'business_resume_date'].forEach(fieldname => {
			const ctrl = this._controls[fieldname];
			if (ctrl && ctrl.$input) {
				ctrl.$input.on('change', () => this.recalculate_days_lost());
			}
		});
	}

	recalculate_days_lost() {
		const ctrl = this._controls['days_lost'];
		if (!ctrl) return;
		const start = this.field_value('issue_start_date');
		const resume = this.field_value('business_resume_date');
		let days = 0;
		if (start && resume) {
			days = frappe.datetime.get_diff(resume, start);
		}
		ctrl.set_value(days);
	}

	// ─────────────────────────────────────────────
	//  IMPACT TYPE TABLE
	// ─────────────────────────────────────────────
	render_impact_table() {
		const tbody = document.getElementById('cir-impact-tbody');
		if (!tbody) return;
		if (!this._impact_rows || this._impact_rows.length === 0) {
			tbody.innerHTML = `<tr class="sc-no-data-row"><td colspan="4">No impact types yet. Add a row to begin.</td></tr>`;
			return;
		}

		const IMPACT_OPTS = ['', 'Revenue Loss', 'Delay in Registration', 'Blocked Tender Participation', 'Client Relationship Risk'];
		const sel = (opts, val) => opts.map(o =>
			`<option value="${o}" ${o === val ? 'selected' : ''}>${o || '&nbsp;'}</option>`
		).join('');
		const esc = (v) => frappe.utils.escape_html(v || '');

		tbody.innerHTML = this._impact_rows.map((row, idx) => `
			<tr data-idx="${idx}">
				<td class="sc-row-num">${idx + 1}</td>
				<td><select data-field="impact_type">${sel(IMPACT_OPTS, row.impact_type)}</select></td>
				<td><input type="number" value="${esc(row.impact_amount)}" data-field="impact_amount" style="min-width:90px;"></td>
				<td class="sc-actions-cell">
					<button type="button" class="sc-remove-row-btn" data-action="remove-row">Delete</button>
				</td>
			</tr>
		`).join('');

		$(tbody).find('input, select').on('change', (e) => {
			const $el = $(e.target);
			const idx = parseInt($el.closest('tr').data('idx'));
			const field = $el.data('field');
			if (!isNaN(idx) && field) this._impact_rows[idx][field] = $el.val();
		});

		$(tbody).find('.sc-remove-row-btn').on('click', (e) => {
			const idx = parseInt($(e.currentTarget).closest('tr').data('idx'));
			this.remove_impact_row(idx);
		});
	}

	remove_impact_row(idx) {
		if (isNaN(idx) || idx < 0 || idx >= this._impact_rows.length) return;
		this._impact_rows.splice(idx, 1);
		this.render_impact_table();
		this.mark_dirty();
	}

	// ─────────────────────────────────────────────
	//  ISSUE ACTIONS TABLE
	// ─────────────────────────────────────────────
	render_actions_table() {
		const tbody = document.getElementById('cir-actions-tbody');
		if (!tbody) return;
		if (!this._action_rows || this._action_rows.length === 0) {
			tbody.innerHTML = `<tr class="sc-no-data-row"><td colspan="7">No actions yet. Add a row to begin.</td></tr>`;
			return;
		}

		const esc = (v) => frappe.utils.escape_html(v || '');

		tbody.innerHTML = this._action_rows.map((row, idx) => `
			<tr data-idx="${idx}">
				<td class="sc-row-num">${idx + 1}</td>
				<td><div class="sc-table-date" data-field="action_date"></div></td>
				<td><input type="text" value="${esc(row.action_taken)}" data-field="action_taken"></td>
				<td><div class="sc-table-link" data-field="action_owner" data-doctype="User"></div></td>
				<td><input type="text" value="${esc(row.next_step)}" data-field="next_step"></td>
				<td><input type="text" value="${esc(row.remarks)}" data-field="remarks"></td>
				<td class="sc-actions-cell">
					<button type="button" class="sc-remove-row-btn" data-action="remove-row">Delete</button>
				</td>
			</tr>
		`).join('');

		$(tbody).find('input').on('change', (e) => {
			const $el = $(e.target);
			const idx = parseInt($el.closest('tr').data('idx'));
			const field = $el.data('field');
			if (!isNaN(idx) && field) this._action_rows[idx][field] = $el.val();
		});

		$(tbody).find('.sc-table-date').each((_, el) => {
			const $el = $(el);
			const idx = parseInt($el.closest('tr').data('idx'));
			const field = $el.data('field');
			if (isNaN(idx) || !field || !this._action_rows[idx]) return;
			const ctrl = frappe.ui.form.make_control({
				df: { fieldtype: 'Date', fieldname: field, label: '', placeholder: 'Select Date' },
				parent: el,
				render_input: true,
			});
			ctrl.refresh();
			ctrl.set_value(this._action_rows[idx][field] || '');
			const save = () => {
				if (this._action_rows[idx]) this._action_rows[idx][field] = ctrl.get_value() || '';
			};
			ctrl.$input.on('change', () => setTimeout(save, 80));
		});

		$(tbody).find('.sc-table-link').each((_, el) => {
			const $el = $(el);
			const idx = parseInt($el.closest('tr').data('idx'));
			const field = $el.data('field');
			const doctype = $el.data('doctype');
			const row = this._action_rows[idx];
			if (isNaN(idx) || !field || !doctype || !row) return;

			const ctrl = frappe.ui.form.make_control({
				df: { fieldtype: 'Link', fieldname: field, options: doctype, placeholder: doctype },
				parent: el,
				render_input: true,
			});
			ctrl.refresh();
			ctrl.set_value(row[field] || '');
			const save = () => {
				if (this._action_rows[idx]) this._action_rows[idx][field] = ctrl.get_value();
			};
			ctrl.$input.on('change', () => setTimeout(save, 80));
			ctrl.$wrapper.on('awesomplete-selectcomplete', () => setTimeout(save, 120));
			crm_customization.attach_link_teleport(ctrl, $el);
		});

		$(tbody).find('.sc-remove-row-btn').on('click', (e) => {
			const idx = parseInt($(e.currentTarget).closest('tr').data('idx'));
			this.remove_action_row(idx);
		});
	}

	remove_action_row(idx) {
		if (isNaN(idx) || idx < 0 || idx >= this._action_rows.length) return;
		this._action_rows.splice(idx, 1);
		this.render_actions_table();
		this.mark_dirty();
	}

	// ─────────────────────────────────────────────
	//  CONTEXT HANDLERS
	// ─────────────────────────────────────────────
	on_subsidiary_change(val) {
		this._current_subsidiary = val;
		this.on_working_context_change();
		const field = this._controls['subsidairy_company'];
		if (field && (field.get_value() || '') !== (val || '')) {
			try { field.set_value(val || ''); } catch (e) {}
		}
		this.update_context_desc();
	}

	on_customer_change(val) {
		this._current_customer = val;
		this.on_working_context_change();
		const field = this._controls['customer'];
		if (field && (field.get_value() || '') !== (val || '')) {
			try { field.set_value(val || ''); } catch (e) {}
		}
		this.update_context_desc();
	}

	bind_form_to_context(ctrl, fieldname) {
		if (!ctrl || !ctrl.$input || !ctrl.$input.length) return;
		const push = () => {
			const val = ctrl.get_value() || '';
			if (fieldname === 'subsidairy_company') {
				this._current_subsidiary = val;
				if (this._ctrl_subsidiary && (this._ctrl_subsidiary.get_value() || '') !== val) {
					this._ctrl_subsidiary.set_value(val);
				}
			} else if (fieldname === 'customer') {
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

	update_context_desc() {
		const sub  = this._current_subsidiary || '';
		const cust = this._current_customer || '';
		let desc = 'Select a Subsidiary Company to begin';
		if (sub && cust) {
			desc = 'Registering client issues for <strong>' + sub + '</strong> / <strong>' + cust + '</strong>';
		} else if (sub) {
			desc = 'Registering client issues for <strong>' + sub + '</strong>';
		}
		$('#cir-context-desc').html(desc);
	}

	// ─────────────────────────────────────────────
	//  BUTTON WIRING
	// ─────────────────────────────────────────────
	wire_buttons() {
		$('#cir-open-doctype').on('click', () => frappe.set_route('List', 'Client Issue Register'));
		$('#cir-new-entry').on('click', () => this.new_entry_with_guard(() => this.new_entry()));
		$('#cir-next-btn').on('click', () => this.controller.go_next_tab());
		$('#cir-save-btn').on('click', () => this.save_client_issue());

		$('#cir-clear-context').on('click', () => {
			if (this._ctrl_subsidiary) this._ctrl_subsidiary.set_value('');
			if (this._ctrl_customer) this._ctrl_customer.set_value('');
			this._current_subsidiary = '';
			this._current_customer = '';
			this.update_context_desc();
		});

		$('#cir-impact-add-row').on('click', () => {
			this._impact_rows.push({ impact_type: '', impact_amount: '' });
			this.render_impact_table();
			this.mark_dirty();
		});

		$('#cir-actions-add-row').on('click', () => {
			this._action_rows.push({ action_date: '', action_taken: '', action_owner: '', next_step: '', remarks: '' });
			this.render_actions_table();
			this.mark_dirty();
		});
	}

	field_value(fieldname) {
		const val = this._controls[fieldname] ? this._controls[fieldname].get_value() : '';
		return (val === null || val === undefined) ? '' : val;
	}

	// ─────────────────────────────────────────────
	//  SAVE / NEW / NEXT
	// ─────────────────────────────────────────────
	build_payload() {
		const doc = this._saved_doc_data
			? JSON.parse(JSON.stringify(this._saved_doc_data))
			: { doctype: 'Client Issue Register' };
		doc.doctype = 'Client Issue Register';
		doc.name = this._saved_doc || undefined;

		[
			'customer', 'issue_title', 'department', 'subsidairy_company', 'detailed_description',
			'date_identified', 'issue_type', 'root_cause', 'raised_by', 'impact_level',
			'estimated_value_impact', 'business_blocked', 'custom_business_on_hold',
			'issue_start_date', 'actual_resolution_date',
			'days_lost', 'expected_resolution_date', 'business_resume_date', 'resolution_summary',
			'preventive_action', 'resolved_by',
		].forEach(fieldname => {
			doc[fieldname] = this.field_value(fieldname);
		});

		doc.impact_type = this._impact_rows.map(row => ({
			doctype: 'Issue impact type',
			impact_type: row.impact_type || '',
			impact_amount: row.impact_amount || 0,
		}));

		doc.issue_actions = this._action_rows.map(row => ({
			doctype: 'Issue Actions',
			action_date: row.action_date || '',
			action_taken: row.action_taken || '',
			action_owner: row.action_owner || '',
			next_step: row.next_step || '',
			remarks: row.remarks || '',
		}));

		return doc;
	}

	save_client_issue() {
		frappe.call({
			method: 'frappe.client.save',
			args: { doc: this.build_payload() },
			callback: (r) => {
				if (r.message) {
					this._saved_doc = r.message.name;
					this._saved_doc_data = r.message;
					this._impact_rows = r.message.impact_type || [];
					this._action_rows = r.message.issue_actions || [];
					this.render_impact_table();
					this.render_actions_table();
					$('#cir-save-badge').text(r.message.name).css({ color: '#16a34a', borderColor: '#86efac', background: '#f0fdf4' });
					frappe.show_alert({ message: __('Saved successfully'), indicator: 'green' });
				this.capture_dirty_baseline(250);
				this.set_active_list_item(r.message.name);
				this.load_list();
				}
			},
			error: (r) => {
				frappe.msgprint({ title: __('Error'), message: r.message || __('Save failed.'), indicator: 'red' });
			}
		});
	}

	new_entry() {
		this.capture_dirty_baseline(250);
		this.set_active_list_item('');
		if (this._ctrl_subsidiary) this._ctrl_subsidiary.set_value('');
		if (this._ctrl_customer) this._ctrl_customer.set_value('');
		this._current_subsidiary = '';
		this._current_customer = '';
		this._saved_doc = '';
		this._saved_doc_data = null;
		this._impact_rows = [];
		this._action_rows = [];

		Object.keys(this._controls).forEach(fieldname => {
			try { this._controls[fieldname].set_value(''); } catch (e) {}
		});
		if (this._controls['date_identified']) {
			this._controls['date_identified'].set_value(frappe.datetime.get_today());
		}

		this.render_impact_table();
		this.render_actions_table();
		$('#cir-save-badge').text('Not Saved').css({ color: '#6b7280', borderColor: '#d1d5db', background: '#f9fafb' });
		this.update_context_desc();
	}

	navigate_next() {
		const current = this._saved_doc;
		if (!current) {
			frappe.msgprint({ message: __('Save a Client Issue Register first.'), indicator: 'orange' });
			return;
		}
		frappe.call({
			method: 'frappe.client.get_list',
			args: {
				doctype: 'Client Issue Register',
				filters: [['name', '>', current]],
				fields: ['name'],
				order_by: 'name asc',
				limit: 1
			},
			callback: (r) => {
				if (r.message && r.message.length > 0) {
					this.load_client_issue(r.message[0].name);
				} else {
					frappe.show_alert({ message: __('This is the last record.'), indicator: 'blue' });
				}
			}
		});
	}

	load_client_issue(name) {
		this._loading = true;
		frappe.call({
			method: 'frappe.client.get',
			args: { doctype: 'Client Issue Register', name: name },
			callback: (r) => {
				if (!r.message) return;
				const doc = r.message;
				this._saved_doc = doc.name;
				this._saved_doc_data = doc;
				this._impact_rows = doc.impact_type || [];
				this._action_rows = doc.issue_actions || [];

				this.populate_fields_from_doc(doc, [
					'customer', 'issue_title', 'department', 'subsidairy_company', 'detailed_description',
					'date_identified', 'issue_type', 'root_cause', 'raised_by', 'impact_level',
					'estimated_value_impact', 'business_blocked', 'custom_business_on_hold',
					'issue_start_date', 'actual_resolution_date',
					'days_lost', 'expected_resolution_date', 'business_resume_date', 'resolution_summary',
					'preventive_action', 'resolved_by',
				]);

				if (this._ctrl_subsidiary) this._ctrl_subsidiary.set_value(doc.subsidairy_company || '');
				if (this._ctrl_customer) this._ctrl_customer.set_value(doc.customer || '');
				this._current_subsidiary = doc.subsidairy_company || '';
				this._current_customer = doc.customer || '';

				this.render_impact_table();
				this.render_actions_table();
				$('#cir-save-badge').text(doc.name).css({ color: '#16a34a', borderColor: '#86efac', background: '#f0fdf4' });
				this.update_context_desc();
				this.after_record_loaded();
			}
		});
	}
};
