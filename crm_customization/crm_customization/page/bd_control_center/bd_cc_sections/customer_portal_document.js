// Copyright (c) 2026, Finbyz and contributors
// For license information, please see license.txt
// Customer Portal Document section for the BD Control Center page.

frappe.provide('crm_customization');

crm_customization.BDCCCustomerPortalDocument = class extends crm_customization.BDCCListPane {
	constructor(controller, $panel) {
		super(controller, $panel);
		this.controller = controller;
		this.page = controller.page;
		this.$panel = $panel;

		this._current_subsidiary = '';
		this._current_customer = '';
		this._current_document_type = '';
		this._saved_doc = '';
		this._saved_doc_data = null;
		this._history_rows = [];
		this._controls = {};
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
			<div id="cpd-tab-root">
				<div class="sc-split">

					${this.list_pane_html()}

					<section class="sc-split-right">

				<!-- Header action buttons -->
				<div class="sc-header-btns">
					<button class="sc-btn sc-btn-outline" id="cpd-open-doctype">Open Original DocType</button>
					<button class="sc-btn sc-btn-outline" id="cpd-new-entry">New Entry</button>
					<button class="sc-btn sc-btn-outline" id="cpd-next-btn">Next</button>
					<button class="sc-btn sc-btn-primary" id="cpd-save-btn">Save</button>
				</div>

				<!-- Document Details -->
				<div class="sc-form-section">
					<div class="sc-form-section-header">
						<h2>Document Details</h2>
						<span class="cpd-save-badge" id="cpd-save-badge">Not Saved</span>
					</div>
					<div class="cpd-cols">
						<div class="cpd-col">
							<div class="sc-field-group"><div id="cpd-field-customer"></div></div>
							<div class="sc-field-group"><div id="cpd-field-updated_on"></div></div>
						</div>
						<div class="cpd-col">
							<div class="sc-field-group"><div id="cpd-field-subsidairy_company"></div></div>
							<div class="sc-field-group"><div id="cpd-field-next_update"></div></div>
						</div>
						<div class="cpd-col">
							<div class="sc-field-group"><div id="cpd-field-document_type"></div></div>
							<div class="sc-field-group"><div id="cpd-field-expire_in_days"></div></div>
						</div>
					</div>
				</div>

				<!-- Remarks -->
				<div class="sc-form-section">
					<div class="sc-form-section-header"><h2>Remarks</h2></div>
					<div class="sc-field-group"><div id="cpd-field-remarks"></div></div>
				</div>

				<!-- Update Tracking -->
				<div class="sc-form-section">
					<div class="sc-form-section-header"><h2>Update Tracking</h2></div>
					<div class="cpd-cols">
						<div class="cpd-col">
							<div class="sc-field-group"><div id="cpd-field-updated_by"></div></div>
						</div>
						<div class="cpd-col">
							<div class="sc-field-group"><div id="cpd-field-next_update_by"></div></div>
						</div>
						<div class="cpd-col">
							<div class="sc-field-group"><div id="cpd-field-attachment"></div></div>
						</div>
					</div>
				</div>

				<!-- Previous Uploads -->
				<div class="sc-form-section">
					<div class="sc-form-section-header"><h2>Previous Uploads</h2></div>
					<div class="sc-table-wrap">
						<table class="sc-child-table">
							<thead>
								<tr>
									<th>No.</th>
									<th>File Url</th>
									<th>Uploaded On</th>
									<th>Uploaded By</th>
									<th>User Name</th>
									<th>Actions</th>
								</tr>
							</thead>
							<tbody id="cpd-history-tbody">
								<tr class="sc-no-data-row"><td colspan="6">No previous uploads yet.</td></tr>
							</tbody>
						</table>
					</div>
					<div class="sc-add-row-bar">
						<button class="sc-add-row-btn" id="cpd-history-add-row">Add Row</button>
					</div>
					</div>
				</section>
			</div>
			</div>
		`);

		this.mount_controls();
		this.render_history_table();
		this.wire_buttons();
		this.bind_user_edit_signal();
		this.mount_list_pane();
	}

	// ─────────────────────────────────────────────
	//  LEFT PANE CONFIG — Portal Documents
	// ─────────────────────────────────────────────
	list_prefix() { return 'cpd'; }
	list_title() { return __('Portal Documents'); }
	list_search_hint() { return __('Search customer, document type...'); }
	list_doctype() { return 'Customer Portal Document'; }
	list_fields() { return ['name', 'customer', 'subsidairy_company', 'document_type', 'next_update', 'modified']; }
	list_empty_message() { return __('No Portal Documents yet.'); }

	list_filters() {
		const filters = [];
		if (this._current_customer) filters.push(['customer', '=', this._current_customer]);
		if (this._current_subsidiary) filters.push(['subsidairy_company', '=', this._current_subsidiary]);
		if (this._current_document_type) filters.push(['document_type', '=', this._current_document_type]);
		return filters;
	}

	list_scope_parts() {
		const parts = [];
		if (this._current_customer) parts.push(this._current_customer);
		if (this._current_subsidiary) parts.push(this._current_subsidiary);
		if (this._current_document_type) parts.push(this._current_document_type);
		return parts;
	}

	list_row_title(row) { return row.document_type || row.name; }
	list_row_badge(row) { return row.customer || ''; }
	list_row_meta(row) { return [row.subsidairy_company, row.next_update]; }
	list_match(row) {
		return [row.name, row.customer, row.subsidairy_company, row.document_type]
			.filter(Boolean).join(' ');
	}

	load_list_record(name) { this.load_customer_portal_document(name); }
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
		if (document.getElementById('bd-cc-customer-portal-document-styles')) return;

		const style = document.createElement('style');
		style.id = 'bd-cc-customer-portal-document-styles';
		style.innerHTML = `
			/* ── Customer Portal Document section ── */
			.cpd-save-badge {
				font-size: 11px; font-weight: 500; padding: 2px 8px;
				border-radius: 10px; border: 1px solid #d1d5db;
				color: #6b7280; background: #f9fafb;
			}
			.cpd-cols { display: flex; gap: 24px; align-items: flex-start; }
			.cpd-col { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 16px; }
			@media (max-width: 900px) { .cpd-cols { flex-direction: column; } }

			.cpd-attach-cell, .cpd-dt-cell, .cpd-user-cell { min-width: 180px; }
			.cpd-dt-cell { min-width: 220px; }
			.cpd-attach-cell .frappe-control,
			.cpd-dt-cell .frappe-control,
			.cpd-user-cell .frappe-control { margin-bottom: 0; }
			.cpd-dt-cell .control-input-wrapper,
			.cpd-dt-cell .control-input { display: flex; width: 100%; }
			.cpd-dt-cell .input-group { flex-wrap: nowrap; width: 100%; }
			.sc-child-table tbody td.cpd-attach-cell input,
			.sc-child-table tbody td.cpd-dt-cell input,
			.sc-child-table tbody td.cpd-user-cell input {
				background: #fff !important; border: 1px solid #d1d5db !important;
				border-radius: 4px !important; color: #6b7280 !important;
				padding: 2px 6px !important; height: 26px;
			}
			.cpd-attach-cell .timezone-indicator,
			.cpd-dt-cell .timezone-indicator,
			.cpd-user-cell .timezone-indicator { display: none; }
		`;
		document.head.appendChild(style);
	}

	field_definitions() {
		return [
			{ fieldname: 'customer',           label: 'Customer',           type: 'Link', options: 'Customer' },
			{ fieldname: 'updated_on',         label: 'Updated On',         type: 'Date' },
			{ fieldname: 'subsidairy_company', label: 'Subsidiary Company', type: 'Link', options: 'Subsidairy Company' },
			{ fieldname: 'next_update',        label: 'Next Update',        type: 'Date' },
			{ fieldname: 'document_type',      label: 'Document Type',      type: 'Link', options: 'Company Document Type' },
			{ fieldname: 'expire_in_days',     label: 'Expire in Days',     type: 'Int', read_only: true },
			{ fieldname: 'remarks',            label: 'Remarks',            type: 'Small Text' },
			{ fieldname: 'updated_by',         label: 'Updated By',         type: 'Data', read_only: true },
			{ fieldname: 'next_update_by',     label: 'Next Update By',     type: 'Link', options: 'User' },
			{ fieldname: 'attachment',         label: 'Attachment',         type: 'Attach' },
		];
	}

	mount_controls() {
		this._ctrl_subsidiary = crm_customization.make_link_control(
			'cpd-subsidiary-control', 'Subsidairy Company', 'Subsidiary Company (primary)',
			(val) => this.on_subsidiary_change(val)
		);
		this._ctrl_customer = crm_customization.make_link_control(
			'cpd-customer-control', 'Customer', 'Client/Customer (optional)',
			(val) => this.on_customer_change(val)
		);

		this.field_definitions().forEach(def => {
			const container = document.getElementById('cpd-field-' + def.fieldname);
			if (!container) return;
			const ctrl = frappe.ui.form.make_control({
				df: {
					fieldtype: def.type,
					fieldname: 'cpd_' + def.fieldname,
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

		const updated_on = this._controls['updated_on'];
		if (updated_on) updated_on.set_value(frappe.datetime.get_today());

		const next_update = this._controls['next_update'];
		if (next_update && next_update.$input) {
			next_update.$input.on('change', () => this.recalculate_expire_in_days());
		}

		const updated_by = this._controls['updated_by'];
		if (updated_by) updated_by.set_value(frappe.session.user);
	}

	_set_updated_by_user() {
		if (this._controls['updated_by']) this._controls['updated_by'].set_value(frappe.session.user);
	}

	recalculate_expire_in_days() {
		const ctrl = this._controls['expire_in_days'];
		if (!ctrl) return;
		const next_update = this.field_value('next_update');
		if (!next_update) {
			ctrl.set_value('');
			return;
		}
		const days = frappe.datetime.get_diff(next_update, frappe.datetime.get_today());
		ctrl.set_value(String(days));
	}

	// ─────────────────────────────────────────────
	//  PREVIOUS UPLOADS TABLE
	// ─────────────────────────────────────────────
	render_history_table() {
		const tbody = document.getElementById('cpd-history-tbody');
		if (!tbody) return;
		if (!this._history_rows || this._history_rows.length === 0) {
			tbody.innerHTML = `<tr class="sc-no-data-row"><td colspan="6">No previous uploads yet. Add a row to begin.</td></tr>`;
			return;
		}

		const esc = (v) => frappe.utils.escape_html(v || '');

		tbody.innerHTML = this._history_rows.map((row, idx) => `
			<tr data-idx="${idx}">
				<td class="sc-row-num">${idx + 1}</td>
				<td class="cpd-attach-cell" data-idx="${idx}"></td>
				<td class="cpd-dt-cell" data-idx="${idx}"></td>
				<td class="cpd-user-cell" data-idx="${idx}"></td>
				<td><input type="text" value="${esc(row.user_name)}" data-field="user_name" style="min-width:130px;"></td>
				<td class="sc-actions-cell">
					<button type="button" class="sc-remove-row-btn" data-action="remove-row">Delete</button>
				</td>
			</tr>
		`).join('');

		$(tbody).find('.cpd-attach-cell').each((i, el) => {
			const idx = parseInt($(el).data('idx'));
			const ctrl = frappe.ui.form.make_control({
				df: {
					fieldtype: 'Attach',
					fieldname: 'file_url_' + idx,
					label: '',
					options: '',
					onchange: () => {
						this._history_rows[idx].file_url = ctrl.get_value() || '';
					},
				},
				parent: el,
				render_input: true,
			});
			ctrl.refresh();
			ctrl.set_value(this._history_rows[idx].file_url || '');
		});

		$(tbody).find('.cpd-dt-cell').each((i, el) => {
			const idx = parseInt($(el).data('idx'));
			const ctrl = frappe.ui.form.make_control({
				df: {
					fieldtype: 'Datetime',
					fieldname: 'uploaded_on_' + idx,
					label: '',
					hide_timezone: 1,
					onchange: () => {
						this._history_rows[idx].uploaded_on = ctrl.get_value() || '';
					},
				},
				parent: el,
				render_input: true,
			});
			ctrl.refresh();
			ctrl.set_value(this.normalize_datetime_value(this._history_rows[idx].uploaded_on) || '');
		});

		$(tbody).find('.cpd-user-cell').each((i, el) => {
			const idx = parseInt($(el).data('idx'));
			const ctrl = frappe.ui.form.make_control({
				df: {
					fieldtype: 'Link',
					fieldname: 'uploaded_by_' + idx,
					label: '',
					options: 'User',
					onchange: () => {
						const val = ctrl.get_value() || '';
						this._history_rows[idx].uploaded_by = val;
						const rowEl = $(el).closest('tr')[0];
						if (val) {
							frappe.db.get_value('User', val, 'full_name').then((r) => {
								const full = (r && r.message && r.message.full_name) ? r.message.full_name : '';
								$(rowEl).find('[data-field="user_name"]').val(full);
								this._history_rows[idx].user_name = full;
							});
						} else {
							$(rowEl).find('[data-field="user_name"]').val('');
							this._history_rows[idx].user_name = '';
						}
					},
				},
				parent: el,
				render_input: true,
			});
			ctrl.refresh();
			ctrl.set_value(this._history_rows[idx].uploaded_by || '');
			crm_customization.attach_link_teleport(ctrl, $(el));
		});

		$(tbody).find('input').not('.input-with-feedback').on('change', (e) => {
			const $el = $(e.target);
			const idx = parseInt($el.closest('tr').data('idx'));
			const field = $el.data('field');
			if (!isNaN(idx) && field) this._history_rows[idx][field] = $el.val();
		});

		$(tbody).find('.sc-remove-row-btn').on('click', (e) => {
			const idx = parseInt($(e.currentTarget).closest('tr').data('idx'));
			this.remove_history_row(idx);
		});
	}

	remove_history_row(idx) {
		if (isNaN(idx) || idx < 0 || idx >= this._history_rows.length) return;
		this._history_rows.splice(idx, 1);
		this.render_history_table();
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

	on_document_type_change(val) {
		this._current_document_type = val;
		this.on_working_context_change();
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
		const dt   = this._current_document_type || '';
		let desc = 'Select a Subsidiary Company to begin';
		if (sub && cust) {
			desc = 'Managing portal documents for <strong>' + sub + '</strong> / <strong>' + cust + '</strong>';
		} else if (sub) {
			desc = 'Managing portal documents for <strong>' + sub + '</strong>';
		}
		if (dt) {
			desc += ' &middot; Document Type: <strong>' + frappe.utils.escape_html(dt) + '</strong>';
		}
		$('#cpd-context-desc').html(desc);
	}

	// ─────────────────────────────────────────────
	//  BUTTON WIRING
	// ─────────────────────────────────────────────
	wire_buttons() {
		$('#cpd-open-doctype').on('click', () => frappe.set_route('List', 'Customer Portal Document'));
		$('#cpd-new-entry').on('click', () => this.new_entry_with_guard(() => this.new_entry()));
		$('#cpd-next-btn').on('click', () => this.controller.go_next_tab());
		$('#cpd-save-btn').on('click', () => this.save_customer_portal_document());

		$('#cpd-clear-context').on('click', () => {
			if (this._ctrl_subsidiary) this._ctrl_subsidiary.set_value('');
			if (this._ctrl_customer) this._ctrl_customer.set_value('');
			this._current_subsidiary = '';
			this._current_customer = '';
			this._current_document_type = '';
			this.update_context_desc();
		});

		$('#cpd-history-add-row').on('click', () => {
			this._history_rows.push({ file_url: '', uploaded_on: '', uploaded_by: '', user_name: '' });
			this.render_history_table();
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
			: { doctype: 'Customer Portal Document' };
		doc.doctype = 'Customer Portal Document';
		doc.name = this._saved_doc || undefined;

		[
			'customer', 'updated_on', 'subsidairy_company', 'next_update',
			'document_type', 'expire_in_days', 'remarks', 'updated_by',
			'next_update_by', 'attachment',
		].forEach(fieldname => {
			doc[fieldname] = this.field_value(fieldname);
		});

		const to_server_dt = (v) => {
			if (!v) return '';
			return String(v).replace('T', ' ').length === 19 ? String(v).replace('T', ' ') : String(v).replace('T', ' ') + ':00';
		};

		doc.attachment_history = this._history_rows.map(row => ({
			doctype: 'Attachment History',
			file_url: row.file_url || '',
			uploaded_on: to_server_dt(row.uploaded_on),
			uploaded_by: row.uploaded_by || '',
			user_name: row.user_name || '',
		}));

		return doc;
	}

	save_customer_portal_document() {
		frappe.call({
			method: 'frappe.client.save',
			args: { doc: this.build_payload() },
			callback: (r) => {
				if (r.message) {
					this._saved_doc = r.message.name;
					this._saved_doc_data = r.message;
					this._history_rows = r.message.attachment_history || [];
					this.render_history_table();
					$('#cpd-save-badge').text(r.message.name).css({ color: '#16a34a', borderColor: '#86efac', background: '#f0fdf4' });
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
		this._current_document_type = '';
		this._saved_doc = '';
		this._saved_doc_data = null;
		this._history_rows = [];

		Object.keys(this._controls).forEach(fieldname => {
			try { this._controls[fieldname].set_value(''); } catch (e) {}
		});
		if (this._controls['updated_on']) {
			this._controls['updated_on'].set_value(frappe.datetime.get_today());
		}
		this._set_updated_by_user();

		this.render_history_table();
		$('#cpd-save-badge').text('Not Saved').css({ color: '#6b7280', borderColor: '#d1d5db', background: '#f9fafb' });
		this.update_context_desc();
	}

	navigate_next() {
		const current = this._saved_doc;
		if (!current) {
			frappe.msgprint({ message: __('Save a Customer Portal Document first.'), indicator: 'orange' });
			return;
		}
		frappe.call({
			method: 'frappe.client.get_list',
			args: {
				doctype: 'Customer Portal Document',
				filters: [['name', '>', current]],
				fields: ['name'],
				order_by: 'name asc',
				limit: 1
			},
			callback: (r) => {
				if (r.message && r.message.length > 0) {
					this.load_customer_portal_document(r.message[0].name);
				} else {
					frappe.show_alert({ message: __('This is the last record.'), indicator: 'blue' });
				}
			}
		});
	}

	load_customer_portal_document(name) {
		this._loading = true;
		frappe.call({
			method: 'frappe.client.get',
			args: { doctype: 'Customer Portal Document', name: name },
			callback: (r) => {
				if (!r.message) return;
				const doc = r.message;
				this._saved_doc = doc.name;
				this._saved_doc_data = doc;
				this._history_rows = doc.attachment_history || [];

				this.populate_fields_from_doc(doc, [
					'customer', 'updated_on', 'subsidairy_company', 'next_update',
					'document_type', 'expire_in_days', 'remarks', 'updated_by',
					'next_update_by', 'attachment',
				]);
				this._set_updated_by_user();

				if (this._ctrl_subsidiary) this._ctrl_subsidiary.set_value(doc.subsidairy_company || '');
				if (this._ctrl_customer) this._ctrl_customer.set_value(doc.customer || '');
				this._current_subsidiary = doc.subsidairy_company || '';
				this._current_customer = doc.customer || '';
				this._current_document_type = doc.document_type || '';

				this.render_history_table();
				$('#cpd-save-badge').text(doc.name).css({ color: '#16a34a', borderColor: '#86efac', background: '#f0fdf4' });
				this.update_context_desc();
				this.after_record_loaded();
			}
		});
	}
};
