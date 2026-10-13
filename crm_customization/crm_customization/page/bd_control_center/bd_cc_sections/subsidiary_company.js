// Copyright (c) 2026, Finbyz and contributors
// For license information, please see license.txt
// Subsidiary Company section for the BD Control Center page.

frappe.provide('crm_customization');

crm_customization.BDCCSubsidiaryCompany = class {
	constructor(controller, $panel) {
		this.controller = controller;
		this.page = controller.page;
		this.$panel = $panel;

		this._task_rows = [];
		this._rfq_rows = [];
		this._saved_doc = '';
		this._saved_doc_data = null;
		this._loading = false;

		// Master list of Subsidiary Company records shown in the left pane.
		this._list_data = [];
		this._list_query = '';
		this._active_list_item = '';
		this._list_request = 0;

		// Working context inherited from the global bar. When set (and not
		// cleared with the scope pill's ×), the left list shows only that
		// subsidiary. Row clicks in this tab do not touch it — only the global
		// filter does (see `on_subsidiary_change`).
		this._current_subsidiary = '';
		this._applied_subsidiary = '';
		this._list_unscoped = false;

		// Tracks unsaved edits on the right pane so switching records warns first.
		this._dirty = false;

		// Counter that suppresses dirty-flagging while values are being pushed
		// into controls programmatically.
		this._silent = 0;
	}

	mark_dirty() {
		if (this._loading || this._silent) return;
		this._dirty = true;
	}

	/**
	 * Run `fn` without any of its value changes marking the form dirty.
	 * Frappe controls (Date pickers, Link fields) fire `change` asynchronously
	 * after `set_value`, so the guard is held for `grace_ms` afterwards to
	 * swallow those late events.
	 */
	with_silent_changes(fn, grace_ms) {
		this._silent++;
		try {
			fn();
		} finally {
			if (!grace_ms) {
				this._silent = 0;
				return;
			}
			clearTimeout(this._silent_timer);
			this._silent_timer = setTimeout(() => {
				this._silent = 0;
			}, grace_ms);
		}
	}

	render() {
		this.add_styles();
		this.$panel.html(`
			<div id="sc-tab-root">
				<div class="sc-split">

					<!-- ── LEFT 20% : Subsidiary Company list ── -->
					<aside class="sc-split-left">
						<div class="sc-list-head">
						<div class="sc-list-title">
							Subsidiary Companies
							<span class="sc-list-count" id="sc-list-count">0</span>
						</div>
						<div class="sc-list-scope" id="sc-list-scope" style="display: none;">
							<span class="sc-list-scope-text"></span>
							<button type="button" class="sc-filter-clear" title="${__('Remove filter')}" aria-label="${__('Remove filter')}">&times;</button>
						</div>
						<div class="sc-list-tools">
								<input
									type="text"
									id="sc-list-search"
									class="sc-list-search"
									placeholder="Search subsidiary, CR No, VAT No..."
									autocomplete="off"
								/>
								<button class="sc-list-refresh" id="sc-list-refresh" title="Refresh list">
									<span class="sc-list-refresh-icon">&#8635;</span>
								</button>
							</div>
						</div>
						<div class="sc-list-body" id="sc-list-body">
							<div class="sc-list-empty">Loading...</div>
						</div>
					</aside>

					<!-- ── RIGHT 80% : Form + child tables ── -->
					<section class="sc-split-right">

						<!-- Header action buttons -->
						<div class="sc-header-btns">
							<button class="sc-btn sc-btn-outline" id="sc-open-doctype">Open Original DocType</button>
							<button class="sc-btn sc-btn-outline" id="sc-new-entry">New Entry</button>
							<button class="sc-btn sc-btn-outline" id="sc-next-btn">Next</button>
							<button class="sc-btn sc-btn-primary" id="sc-save-btn">Save</button>
						</div>

						<!-- Subsidiary Company Form -->
						<div class="sc-form-section">
							<div class="sc-form-section-header">
								<h2 id="sc-form-heading">Subsidiary Company</h2>
								<span class="sc-form-abbrev" id="sc-abbrev-badge"></span>
							</div>

							<div class="sc-form-row">
								<div class="sc-field-group"><div id="sc-field-company_abb"></div></div>
								<div class="sc-field-group"><div id="sc-field-cr_no"></div></div>
							</div>
							<div class="sc-form-row">
								<div class="sc-field-group"><div id="sc-field-subsidairy_company"></div></div>
								<div class="sc-field-group"><div id="sc-field-vat_no"></div></div>
							</div>
							<div class="sc-form-row single">
								<div class="sc-field-group"><div id="sc-field-industry"></div></div>
							</div>
						</div>

						<!-- Task Registered Table -->
						<div class="sc-form-section">
							<div class="sc-section-title">Task Registered</div>
							<div class="sc-table-wrap">
								<table class="sc-child-table">
									<thead>
										<tr>
											<th>No.</th>
											<th>Client</th>
											<th>Status</th>
											<th>BD Task</th>
											<th>Stage</th>
											<th>Registration</th>
											<th>Actions</th>
										</tr>
									</thead>
									<tbody id="sc-task-tbody">
										<tr class="sc-no-data-row"><td colspan="7">No task rows yet. Submit a Business Request to show it here.</td></tr>
									</tbody>
								</table>
							</div>
							<div class="sc-add-row-bar">
								<button class="sc-add-row-btn" id="sc-task-add-row">Add Row</button>
								<div class="sc-table-actions">
									<button class="sc-download-btn" id="sc-task-download">Download</button>
									<button class="sc-upload-btn" id="sc-task-upload">Upload</button>
								</div>
							</div>
						</div>

						<!-- RFQ Statistics Table -->
						<div class="sc-form-section">
							<div class="sc-section-title">RFQ Statistics</div>
							<div class="sc-table-wrap">
								<table class="sc-child-table">
									<thead>
										<tr>
											<th>No.</th>
											<th>Subsidiary Company</th>
											<th>From</th>
											<th>RFQ Requests</th>
											<th>To</th>
											<th>Actions</th>
										</tr>
									</thead>
									<tbody id="sc-rfq-tbody">
										<tr class="sc-no-data-row"><td colspan="6">No RFQ statistics yet. Add a row to begin.</td></tr>
									</tbody>
								</table>
							</div>
							<div class="sc-add-row-bar">
								<button class="sc-add-row-btn" id="sc-rfq-add-row">Add Row</button>
							</div>
						</div>

					</section>
				</div>
			</div>
		`);

		this.mount_controls();
		this.wire_sc_buttons();
		this.load_list();
	}

	add_styles() {
		// All styles for this section (split layout, left list, form, tables)
		// are shared and live in section_base_styles.js.
		crm_customization.ensure_base_section_styles();
	}

	// ─────────────────────────────────────────────
	//  LEFT PANE — Subsidiary Company list
	// ─────────────────────────────────────────────
	load_list() {
		const request_id = ++this._list_request;
		const $refresh = $('#sc-list-refresh');
		$refresh.addClass('sc-spinning');
		this.update_list_scope_label();

		const filters = [];
		if (!this._list_unscoped && this._current_subsidiary) {
			filters.push(['name', '=', this._current_subsidiary]);
		}

		frappe.call({
			method: 'frappe.client.get_list',
			args: {
				doctype: 'Subsidairy Company',
				fields: ['name', 'subsidairy_company', 'company_abb', 'cr_no', 'vat_no', 'modified'],
				filters: filters,
				order_by: 'modified desc',
				limit_page_length: 500
			},
			callback: (r) => {
				if (request_id !== this._list_request) return;
				$refresh.removeClass('sc-spinning');
				this._list_data = r.message || [];
				this.render_list();
			},
			error: () => {
				if (request_id !== this._list_request) return;
				$refresh.removeClass('sc-spinning');
				this._list_data = [];
				this.render_list(__('Could not load the Subsidiary Company list.'));
			}
		});
	}

	// ─────────────────────────────────────
	//  SCOPE FILTER (from the global bar)
	// ─────────────────────────────────────

	/**
	 * Called by the controller when the global Working Context's Subsidiary
	 * Company filter changes (row clicks in this tab never reach here — the
	 * controller skips the source tab). Reloads the list scoped to the value.
	 */
	on_subsidiary_change(val) {
		const subsidiary = val || '';
		if (subsidiary === this._applied_subsidiary) return;
		this._list_unscoped = false;
		this._applied_subsidiary = subsidiary;
		this.load_list();
	}

	update_list_scope_label() {
		const $scope = $('#sc-list-scope');
		if (!$scope.length) return;

		const subsidiary = this._current_subsidiary || '';
		if (!subsidiary || this._list_unscoped) {
			$scope.hide();
			return;
		}
		$scope.show().find('.sc-list-scope-text').html(
			__('Filtered by') + ': <strong>' + frappe.utils.escape_html(subsidiary) + '</strong>'
		);
	}

	/**
	 * Remove the scope filter: reload the list unscoped. Re-applies when the
	 * global filter value actually changes (see `on_subsidiary_change`).
	 */
	clear_list_scope() {
		this._list_unscoped = true;
		this.update_list_scope_label();
		this.load_list();
	}

	_filtered_list() {
		const q = (this._list_query || '').trim().toLowerCase();
		if (!q) return this._list_data;
		return this._list_data.filter((d) => {
			return [d.name, d.subsidairy_company, d.company_abb, d.cr_no, d.vat_no]
				.some((v) => String(v || '').toLowerCase().includes(q));
		});
	}

	render_list(empty_msg) {
		const $body = $('#sc-list-body');
		if (!$body.length) return;

		const rows = this._filtered_list();
		$('#sc-list-count').text(rows.length);

		if (!rows.length) {
			$body.html(`<div class="sc-list-empty">${frappe.utils.escape_html(
				empty_msg || (this._list_query ? __('No matching Subsidiary Company.') : __('No Subsidiary Company yet.'))
			)}</div>`);
			return;
		}

		const esc = (v) => frappe.utils.escape_html(v || '');
		const fmt_date = (v) => (frappe.datetime && frappe.datetime.str_to_user ? frappe.datetime.str_to_user(v) : (v || ''));

		$body.html(rows.map((d) => {
			const name = d.name || '';
			const active = name && name === this._active_list_item ? ' active' : '';
			const meta = [];
			if (d.cr_no) meta.push('CR: ' + d.cr_no);
			if (d.vat_no) meta.push('VAT: ' + d.vat_no);
			if (!meta.length) meta.push(fmt_date(d.modified));
			return `
				<button type="button" class="sc-list-item${active}" data-name="${esc(name)}" title="${esc(name)}">
					<span class="sc-list-item-title">
						<span class="sc-list-item-name">${esc(d.subsidairy_company || name)}</span>
						${d.company_abb ? `<span class="sc-list-item-badge">${esc(d.company_abb)}</span>` : ''}
					</span>
					<span class="sc-list-item-meta">${esc(meta.join(' · '))}</span>
				</button>
			`;
		}).join(''));

		$body.find('.sc-list-item').on('click', (e) => {
			const name = $(e.currentTarget).data('name');
			if (name) this.select_from_list(name);
		});
	}

	set_active_list_item(name) {
		this._active_list_item = name || '';
		const $body = $('#sc-list-body');
		if (!$body.length) return;

		$body.find('.sc-list-item').removeClass('active');
		if (!this._active_list_item) return;

		const $active = $body.find('.sc-list-item').filter((_, el) => $(el).data('name') === this._active_list_item);
		$active.addClass('active');
		if (!$active.length) return;

		// Keep the selected record visible inside the scrolling list.
		const el = $active[0];
		const box = $body[0];
		const top = el.offsetTop;
		const bottom = top + el.offsetHeight;
		if (top < box.scrollTop || bottom > box.scrollTop + box.clientHeight) {
			box.scrollTop = Math.max(0, top - (box.clientHeight - el.offsetHeight) / 2);
		}
	}

	select_from_list(name) {
		if (!name) return;
		crm_customization.show_form_pane(this.$panel);
		if (name === this._saved_doc) {
			this.set_active_list_item(name);
			return;
		}

		const proceed = () => {
			this.set_active_list_item(name);
			this.load_subsidiary_data(name);
		};

		if (this._dirty) {
			this.confirm_discard_changes(proceed);
			return;
		}

		proceed();
	}

	confirm_discard_changes(on_confirm) {
		// `frappe.confirm` in this version is positional
		// (message, yes, no), so build the dialog explicitly.
		const d = new frappe.ui.Dialog({
			title: __('Unsaved Changes'),
			size: 'small',
			fields: [
				{
					fieldtype: 'HTML',
					fieldname: 'message',
					options:
						'<p>' +
						__('This Subsidiary Company has unsaved changes. Discard them and open the selected one?') +
						'</p>',
				},
			],
			primary_action_label: __('Discard Changes'),
			primary_action: () => {
				d.hide();
				on_confirm();
			},
			secondary_action_label: __('Keep Editing'),
			secondary_action: () => d.hide(),
		});
		d.show();
	}

	// ─────────────────────────────────────────────
	//  FRAPPE CONTROLS
	// ─────────────────────────────────────────────
	mount_controls() {
		this._ctrl_company_abb = crm_customization.make_data_control('sc-field-company_abb', 'Company Abb', false);
		this._ctrl_cr_no        = crm_customization.make_data_control('sc-field-cr_no', 'CR No', false);
		this._ctrl_sub_company  = crm_customization.make_data_control('sc-field-subsidairy_company', 'Subsidiary Company', true);
		this._ctrl_vat_no       = crm_customization.make_data_control('sc-field-vat_no', 'VAT No', false);
		this._ctrl_industry     = crm_customization.make_link_control('sc-field-industry', 'CRM Industry', 'Industry');

		if (this._ctrl_company_abb) {
			this._ctrl_company_abb.$input.on('change', () => {
				const val = this._ctrl_company_abb.get_value();
				$('#sc-abbrev-badge').text(val || '');
				this.mark_dirty();
			});
		}

		if (this._ctrl_sub_company) {
			this._ctrl_sub_company.$input.on('change', () => this.on_subsidiary_field_change());
		}

		[ this._ctrl_cr_no, this._ctrl_vat_no ].forEach((ctrl) => {
			if (ctrl && ctrl.$input) ctrl.$input.on('change', () => this.mark_dirty());
		});

		if (this._ctrl_industry && this._ctrl_industry.$input) {
			this._ctrl_industry.$input.on('change', () => this.mark_dirty());
			this._ctrl_industry.$wrapper.on('awesomplete-selectcomplete', () => this.mark_dirty());
		}
	}

	// ─────────────────────────────────────────────
	//  LOAD / CLEAR
	// ─────────────────────────────────────────────
	on_subsidiary_field_change() {
		const name = this._ctrl_sub_company ? this._ctrl_sub_company.get_value() : '';
		if (!name || this._loading) return;
		if (name === this._saved_doc) return;

		frappe.db.exists('Subsidairy Company', name).then((exists) => {
			if (!this._ctrl_sub_company) return;
			if (this._ctrl_sub_company.get_value() !== name) return;

			if (exists) {
				this.load_subsidiary_data(name);
			} else {
				this._saved_doc = '';
				this._dirty = false;
				this.set_active_list_item('');
				this._task_rows = [];
				this._rfq_rows = [];
				this.render_task_table();
				this.render_rfq_table();
			}
		});
	}

	load_subsidiary_data(name) {
		this._loading = true;
		frappe.call({
			method: 'frappe.client.get',
			args: { doctype: 'Subsidairy Company', name: name },
			callback: (r) => {
				if (!r.message) {
					this._loading = false;
					return;
				}
				const doc = r.message;

				// Mark the record as loaded *before* pushing values into the
				// controls, otherwise the field's own change handler would
				// fire a second, redundant load for the same record.
				this._saved_doc = doc.name || name;
				this._saved_doc_data = doc;
				this._dirty = false;

				// Everything below only reflects stored data, so it must never
				// be treated as a user edit. The grace window absorbs the
				// late `change` events Date/Link controls emit after set_value.
				this.with_silent_changes(() => {
					if (this._ctrl_company_abb)  this._ctrl_company_abb.set_value(doc.company_abb || '');
					if (this._ctrl_cr_no)         this._ctrl_cr_no.set_value(doc.cr_no || '');
					if (this._ctrl_sub_company)   this._ctrl_sub_company.set_value(doc.subsidairy_company || doc.name || '');
					if (this._ctrl_vat_no)        this._ctrl_vat_no.set_value(doc.vat_no || '');
					if (this._ctrl_industry)      this._ctrl_industry.set_value(doc.custom_industry || '');

					$('#sc-abbrev-badge').text(doc.company_abb || doc.subsidairy_company || '');
					$('#sc-form-heading').text(doc.subsidairy_company || doc.name || __('Subsidiary Company'));

					this._task_rows = doc.task_registered || [];
					this.render_task_table();

					this._rfq_rows = doc.custom_rfq_stats || [];
					this.render_rfq_table();
				}, 300);

				// Keep the left list in sync with the record now shown on the right.
				this.set_active_list_item(this._saved_doc);

				// The loaded company becomes the active Working Context
				// and is propagated to every tab on the right.
				if (this.controller && this._saved_doc) {
					this.controller.set_working_context('subsidiary_company', {
						subsidiary: doc.subsidairy_company || doc.name,
					});
				}

				this._loading = false;
			},
			error: () => {
				this._loading = false;
			}
		});
	}

	clear_form_fields() {
		this._loading = true;
		this.with_silent_changes(() => {
			if (this._ctrl_company_abb)  this._ctrl_company_abb.set_value('');
			if (this._ctrl_cr_no)         this._ctrl_cr_no.set_value('');
			if (this._ctrl_sub_company)   this._ctrl_sub_company.set_value('');
			if (this._ctrl_vat_no)        this._ctrl_vat_no.set_value('');
			if (this._ctrl_industry)      this._ctrl_industry.set_value('');
			$('#sc-abbrev-badge').text('');
			$('#sc-form-heading').text(__('New Subsidiary Company'));
			this._task_rows = [];
			this._rfq_rows = [];
			this.render_task_table();
			this.render_rfq_table();
		}, 300);
this._saved_doc = '';
		this._saved_doc_data = null;
		this._dirty = false;
		this.set_active_list_item('');
		this._loading = false;
	}

	// ─────────────────────────────────────────────
	//  TASK TABLE
	// ─────────────────────────────────────────────
	render_task_table() {
		const tbody = document.getElementById('sc-task-tbody');
		if (!tbody) return;
		if (!this._task_rows || this._task_rows.length === 0) {
			tbody.innerHTML = `<tr class="sc-no-data-row"><td colspan="7">No task rows yet. Submit a Business Request to show it here.</td></tr>`;
			return;
		}

		const esc = (v) => frappe.utils.escape_html(v || '');
		const visible = this._task_table_columns().slice(0, 5);

		tbody.innerHTML = this._task_rows.map((row, idx) => `
			<tr data-idx="${idx}">
				<td class="sc-row-num">${idx + 1}</td>
				${visible.map(c => `<td>${esc(row[c.field])}</td>`).join('')}
				<td class="sc-actions-cell">
					<button type="button" class="sc-edit-row-btn" data-action="edit-row">Edit</button>
					<button type="button" class="sc-remove-row-btn" data-action="remove-row">Delete</button>
				</td>
			</tr>
		`).join('');

		$(tbody).find('.sc-edit-row-btn').on('click', (e) => {
			const idx = parseInt($(e.currentTarget).closest('tr').data('idx'));
			if (!isNaN(idx)) this.open_task_row_dialog(idx);
		});

		$(tbody).find('.sc-remove-row-btn').on('click', (e) => {
			const idx = parseInt($(e.currentTarget).closest('tr').data('idx'));
			this.remove_task_row(idx);
		});
	}

	remove_task_row(idx) {
		if (isNaN(idx) || idx < 0 || idx >= this._task_rows.length) return;
		this._task_rows.splice(idx, 1);
		this.mark_dirty();
		this.render_task_table();
	}

	_task_field_dfs() {
		const sel = (opts) => ['', ...opts].join('\n');
		return [
			{ fieldname: 'client', label: __('Client'), fieldtype: 'Link', options: 'Customer' },
			{ fieldname: 'bd_task', label: __('BD Task'), fieldtype: 'Data' },
			{ fieldtype: 'Column Break' },
			{ fieldname: 'category', label: __('Category'), fieldtype: 'Link', options: 'BD Request Category' },
			{ fieldname: 'vendor_no', label: __('Vendor No'), fieldtype: 'Data' },
			{ fieldtype: 'Section Break' },
			{ fieldname: 'status', label: __('Status'), fieldtype: 'Select', options: sel(['Not Started','Not Qualified','Pending Approval','Waiting for the Request Approval','Pending Submission','Pending Re-Submission','In Process','On Hold','Qualified','Completed','Rejected','Under Qualification','Cancelled']) },
			{ fieldname: 'expires_on', label: __('Expires On'), fieldtype: 'Date' },
			{ fieldtype: 'Column Break' },
			{ fieldname: 'stage', label: __('Stage'), fieldtype: 'Select', options: sel(['Registration','Prequalification','PQ Project','RFQ Invitation']) },
			{ fieldname: 'service_in_sap', label: __('Service in SAP'), fieldtype: 'Data' },
			{ fieldtype: 'Section Break' },
			{ fieldname: 'acl_msa', label: __('ACL - MSA'), fieldtype: 'Data' },
			{ fieldname: 'gbs', label: __('GBS'), fieldtype: 'Data' },
			{ fieldtype: 'Column Break' },
			{ fieldname: 'p_q', label: __('PQ'), fieldtype: 'Select', options: sel(['Yes','No']) },
			{ fieldname: 'pq_project', label: __('PQ Project'), fieldtype: 'Select', options: sel(['Yes','No']) },
			{ fieldtype: 'Section Break' },
			{ fieldname: 'project_name', label: __('Project Name'), fieldtype: 'Link', options: 'Project' },
			{ fieldname: 'registration_status', label: __('Registration Status'), fieldtype: 'Select', options: sel(['Pending','In Process','Pending Approval','Registered']) },
			{ fieldtype: 'Column Break' },
			{ fieldname: 'reg', label: __('Registration'), fieldtype: 'Select', options: sel(['In Process','Pending','Pending Approval','Projects Only','Yes']) },
		];
	}

	open_task_row_dialog(idx) {
		const is_new = (idx === null || idx === undefined);
		const row = is_new ? {} : (this._task_rows[idx] || {});
		const dfs = this._task_field_dfs();
		const d = new frappe.ui.Dialog({
			title: is_new ? __('New Task Registered Row') : __('Edit Task Registered Row'),
			size: 'large',
			fields: dfs,
			primary_action_label: __('Save'),
			primary_action: (values) => {
				const saved = {};
				dfs.forEach((f) => { if (f.fieldname) saved[f.fieldname] = ''; });
				Object.keys(values || {}).forEach((k) => {
					if (Object.prototype.hasOwnProperty.call(saved, k)) saved[k] = values[k];
				});
				if (is_new) {
					this._task_rows.push(saved);
				} else {
					this._task_rows[idx] = saved;
				}
				this.mark_dirty();
				this.render_task_table();
				d.hide();
			},
		});
		d.set_values(row);
		d.show();
	}

	_task_table_columns() {
		return [
			{ label: 'Client',            field: 'client' },
			{ label: 'Status',            field: 'status' },
			{ label: 'BD Task',           field: 'bd_task' },
			{ label: 'Stage',             field: 'stage' },
			{ label: 'Registration',      field: 'reg' },
			{ label: 'Registration Status', field: 'registration_status' },
			{ label: 'Service in SAP',    field: 'service_in_sap' },
			{ label: 'PQ',                field: 'p_q' },
			{ label: 'GBS',               field: 'gbs' },
			{ label: 'ACL - MSA',         field: 'acl_msa' },
			{ label: 'PQ Project',        field: 'pq_project' },
			{ label: 'Project Name',      field: 'project_name' },
			{ label: 'Vendor No',         field: 'vendor_no' },
			{ label: 'Category',          field: 'category' },
			{ label: 'Expires On',        field: 'expires_on' },
		];
	}

	download_task_table() {
		const rows = this._task_rows || [];
		if (!rows.length) {
			frappe.msgprint({ title: __('Info'), message: __('No Task Registered rows to download.'), indicator: 'blue' });
			return;
		}

		const cols = this._task_table_columns();
		const data = [['No.'].concat(cols.map(c => c.label))];
		rows.forEach((row, i) => {
			data.push([i + 1].concat(cols.map(c => (row[c.field] === null || row[c.field] === undefined) ? '' : String(row[c.field]))));
		});

		frappe.call({
			method: 'crm_customization.crm_customization.page.bd_control_center.bd_control_center.export_task_table',
			args: { data },
			callback: (r) => {
				if (!r.message || !r.message.content) return;
				const a = document.createElement('a');
				a.href = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + r.message.content;
				a.download = r.message.filename || 'Task Registered.xlsx';
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
			},
			error: () => {
				frappe.msgprint({ title: __('Error'), message: __('Failed to export Task Registered table.'), indicator: 'red' });
			},
		});
	}

	upload_task_table() {
		new frappe.ui.FileUploader({
			dialog_title: __('Upload Task Registered'),
			allow_multiple: false,
			as_dataurl: true,
			restrictions: { allowed_file_types: ['.xlsx'] },
			on_success: (file) => {
				if (!file || !file.dataurl) return;
				frappe.call({
					method: 'crm_customization.crm_customization.page.bd_control_center.bd_control_center.read_task_table_upload',
					args: { dataurl: file.dataurl, file_name: file.file_name || file.name || '' },
					callback: (r) => {
						const all = r.message || [];
						let rows = all;
						if (all.length) {
							const first = (all[0] || []).map(v => String(v || '').trim().toLowerCase());
							if (first[0] === 'no.' || first[1] === 'client') rows = all.slice(1);
						}
						if (!rows.length) {
							frappe.msgprint({ title: __('Info'), message: __('The uploaded file has no data rows.'), indicator: 'blue' });
							return;
						}
						const cols = this._task_table_columns();
						this._task_rows = rows.map(row => {
							const t = {};
							cols.forEach((c, ci) => {
								const v = (row[ci + 1] === null || row[ci + 1] === undefined) ? '' : String(row[ci + 1]).trim();
								t[c.field] = v;
							});
							return t;
						});
this.render_task_table();
					this.render_rfq_table();
					this.mark_dirty();
					frappe.show_alert({ message: __('{0} row(s) imported.', [this._task_rows.length]), indicator: 'green' });
					},
					error: () => {
						frappe.msgprint({ title: __('Error'), message: __('Failed to read the uploaded file.'), indicator: 'red' });
					},
				});
			},
		});
	}

	attach_link_teleport(ctrl, $el) {
		const input = ctrl.$input[0];
		if (!input) return;
		const ul = $el[0].querySelector('.awesomplete [role="listbox"]') || $el[0].querySelector('.awesomplete ul');
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
			ul.classList.add('sc-table-dd-teleported');
			reposition();
			window.addEventListener('scroll', reposition, true);
		};
		const closeList = () => {
			open = false;
			window.removeEventListener('scroll', reposition, true);
			ul.classList.remove('sc-table-dd-teleported');
			ul.style.top = '';
			ul.style.left = '';
			ul.style.width = '';
			const awcomplete = $el[0].querySelector('.awesomplete');
			if (awcomplete && ul.parentElement !== awcomplete) awcomplete.appendChild(ul);
		};

		ctrl.$input.on('awesomplete-open', openList);
		ctrl.$input.on('awesomplete-close', closeList);
	}

	// ─────────────────────────────────────────────
	//  RFQ TABLE
	// ─────────────────────────────────────────────
	render_rfq_table() {
		const tbody = document.getElementById('sc-rfq-tbody');
		if (!tbody) return;
		if (!this._rfq_rows || this._rfq_rows.length === 0) {
			tbody.innerHTML = `<tr class="sc-no-data-row"><td colspan="6">No RFQ statistics yet. Add a row to begin.</td></tr>`;
			return;
		}
		tbody.innerHTML = this._rfq_rows.map((row, idx) => `
			<tr data-idx="${idx}">
				<td class="sc-row-num">${idx + 1}</td>
				<td><div class="sc-table-link" data-field="subsidairy_company" data-doctype="Subsidairy Company"></div></td>
				<td><div class="sc-table-date" data-field="from"></div></td>
				<td><input type="number" value="${row.rfq_requests || ''}" data-field="rfq_requests" style="min-width:60px;"></td>
				<td><div class="sc-table-date" data-field="to"></div></td>
				<td class="sc-actions-cell">
					<button type="button" class="sc-remove-row-btn" data-action="remove-row">Delete</button>
				</td>
			</tr>
		`).join('');

		$(tbody).find('input').on('change', (e) => {
			const $el = $(e.target);
			const idx = parseInt($el.closest('tr').data('idx'));
			const field = $el.data('field');
			if (!isNaN(idx) && field) {
				this._rfq_rows[idx][field] = $el.val();
				this.mark_dirty();
			}
		});

		$(tbody).find('.sc-table-date').each((_, el) => {
			const $el = $(el);
			const idx = parseInt($el.closest('tr').data('idx'));
			const field = $el.data('field');
			if (isNaN(idx) || !field || !this._rfq_rows[idx]) return;
			const ctrl = frappe.ui.form.make_control({
				df: { fieldtype: 'Date', fieldname: field, label: '', placeholder: 'Select Date' },
				parent: el,
				render_input: true,
			});
			ctrl.refresh();
			ctrl.set_value(this._rfq_rows[idx][field] || '');
			const save = () => {
				if (this._rfq_rows[idx]) {
					this._rfq_rows[idx][field] = ctrl.get_value() || '';
					this.mark_dirty();
				}
			};
			ctrl.$input.on('change', () => setTimeout(save, 80));
		});

		$(tbody).find('.sc-table-link').each((_, el) => {
			const $el = $(el);
			const idx = parseInt($el.closest('tr').data('idx'));
			const field = $el.data('field');
			const doctype = $el.data('doctype');
			const row = this._rfq_rows[idx];
			if (isNaN(idx) || !field || !doctype || !row) return;

			const ctrl = frappe.ui.form.make_control({
				df: { fieldtype: 'Link', fieldname: field, options: doctype, placeholder: doctype },
				parent: el,
				render_input: true,
			});
			ctrl.refresh();
			ctrl.set_value(row[field] || '');
			const save = () => {
				if (this._rfq_rows[idx]) {
					this._rfq_rows[idx][field] = ctrl.get_value();
					this.mark_dirty();
				}
			};
			ctrl.$input.on('change', () => setTimeout(save, 80));
			ctrl.$wrapper.on('awesomplete-selectcomplete', () => setTimeout(save, 120));
			this.attach_link_teleport(ctrl, $el);
		});

		$(tbody).find('.sc-remove-row-btn').on('click', (e) => {
			const idx = parseInt($(e.currentTarget).closest('tr').data('idx'));
			this.remove_rfq_row(idx);
		});
	}

	remove_rfq_row(idx) {
		if (isNaN(idx) || idx < 0 || idx >= this._rfq_rows.length) return;
		this._rfq_rows.splice(idx, 1);
		this.mark_dirty();
		this.render_rfq_table();
	}

	// ─────────────────────────────────────────────
	//  BUTTON WIRING
	// ─────────────────────────────────────────────
	wire_sc_buttons() {
		// Left pane
		$('#sc-list-refresh').on('click', () => this.load_list());
		$('#sc-list-scope').on('click', '.sc-filter-clear', () => this.clear_list_scope());

		let search_timer = null;
		$('#sc-list-search').on('input', (e) => {
			const val = $(e.currentTarget).val();
			clearTimeout(search_timer);
			search_timer = setTimeout(() => {
				this._list_query = val;
				this.render_list();
			}, 200);
		});

		// Right pane
		$('#sc-open-doctype').on('click', () => {
			frappe.set_route('List', 'Subsidairy Company');
		});
		$('#sc-new-entry').on('click', () => this.new_subsidiary_entry());
		$('#sc-next-btn').on('click', () => this.controller.go_next_tab());
		$('#sc-save-btn').on('click', () => {
			this.save_subsidiary();
		});

		$('#sc-task-add-row').on('click', () => {
			this._task_rows.push({
				client: '', status: '', bd_task: '', stage: '', reg: '',
				registration_status: '', service_in_sap: '', p_q: '', gbs: '',
				acl_msa: '', pq_project: '', project_name: '', vendor_no: '',
				category: '', expires_on: ''
			});
			this.mark_dirty();
			this.render_task_table();
		});

		$('#sc-task-download').on('click', () => this.download_task_table());
		$('#sc-task-upload').on('click', () => this.upload_task_table());

		$('#sc-rfq-add-row').on('click', () => {
			this._rfq_rows.push({ subsidairy_company: '', from: '', rfq_requests: '', to: '' });
			this.mark_dirty();
			this.render_rfq_table();
		});
	}

	// ─────────────────────────────────────────────
	//  SAVE / NEW / NEXT
	// ─────────────────────────────────────────────
	save_subsidiary() {
		const company_name = this._ctrl_sub_company ? this._ctrl_sub_company.get_value() : '';
		if (!company_name) {
			frappe.msgprint({ title: __('Validation'), message: __('Subsidiary Company name is required.'), indicator: 'red' });
			return;
		}
		const doc = this._saved_doc_data
			? JSON.parse(JSON.stringify(this._saved_doc_data))
			: { doctype: 'Subsidairy Company' };
		doc.name = this._saved_doc || undefined;
		doc.subsidairy_company = company_name;
		doc.company_abb = this._ctrl_company_abb ? this._ctrl_company_abb.get_value() : '';
		doc.cr_no = this._ctrl_cr_no ? this._ctrl_cr_no.get_value() : '';
		doc.vat_no = this._ctrl_vat_no ? this._ctrl_vat_no.get_value() : '';
		doc.custom_industry = this._ctrl_industry ? this._ctrl_industry.get_value() : '';
		doc.task_registered = this._task_rows;
		doc.custom_rfq_stats = this._rfq_rows;

		const create_new = !this._saved_doc;

		frappe.call({
			method: 'frappe.client.save',
			args: { doc: doc },
			callback: (r) => {
				if (r.message) {
					this._saved_doc = r.message.name;
					this._saved_doc_data = r.message;
					this._dirty = false;

					this.with_silent_changes(() => {
						this._loading = true;
						if (this._ctrl_sub_company) this._ctrl_sub_company.set_value(r.message.subsidairy_company || r.message.name);
						this._loading = false;

						this._task_rows = r.message.task_registered || [];
						this._rfq_rows  = r.message.custom_rfq_stats || [];
						this.render_task_table();
						this.render_rfq_table();

						$('#sc-form-heading').text(r.message.subsidairy_company || r.message.name);
					}, 300);

					// Pull the saved record into the left list and mark it active.
					this._active_list_item = r.message.name;
					this.load_list();

					// A newly created Subsidiary Company becomes the active
					// Working Context and overrides the context on every tab
					// to the right (Scenario 1).
					if (this.controller) {
						this.controller.set_working_context('subsidiary_company', {
							subsidiary: create_new ? (r.message.subsidairy_company || r.message.name) : undefined,
						});
					}

					frappe.show_alert({ message: __('Saved successfully'), indicator: 'green' });
				}
			},
			error: (r) => {
				frappe.msgprint({ title: __('Error'), message: r.message || __('Save failed.'), indicator: 'red' });
			}
		});
	}

	new_subsidiary_entry() {
		crm_customization.show_form_pane(this.$panel);
		this._saved_doc = '';
		this.clear_form_fields();
		if (this._ctrl_sub_company && this._ctrl_sub_company.$input) {
			this._ctrl_sub_company.$input.focus();
		}
	}

	navigate_next() {
		const current = this._saved_doc;
		if (!current) {
			frappe.msgprint({ message: __('Save a Subsidiary Company first, or enter one to load.'), indicator: 'orange' });
			return;
		}
		frappe.call({
			method: 'frappe.client.get_list',
			args: {
				doctype: 'Subsidairy Company',
				filters: [['name', '>', current]],
				fields: ['name'],
				order_by: 'name asc',
				limit: 1
			},
			callback: (r) => {
				if (r.message && r.message.length > 0) {
					this.load_subsidiary_data(r.message[0].name);
				} else {
					frappe.show_alert({ message: __('This is the last record.'), indicator: 'blue' });
				}
			}
		});
	}
};