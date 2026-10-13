// Copyright (c) 2026, Finbyz and contributors
// For license information, please see license.txt
// Document Expiration section for the BD Control Center page.

frappe.provide('crm_customization');

crm_customization.BDCCDocumentExpiration = class extends crm_customization.BDCCListPane {
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
			<div id="de-tab-root">
				<div class="sc-split">

					${this.list_pane_html()}

					<section class="sc-split-right">

				<!-- Header action buttons -->
				<div class="sc-header-btns">
					<button class="sc-btn sc-btn-outline" id="de-open-doctype">Open Original DocType</button>
					<button class="sc-btn sc-btn-outline" id="de-new-entry">New Entry</button>
					<button class="sc-btn sc-btn-outline" id="de-next-btn">Next</button>
					<button class="sc-btn sc-btn-primary" id="de-save-btn">Save</button>
				</div>

				<!-- Document Details -->
				<div class="sc-form-section">
					<div class="sc-form-section-header">
						<h2>Document Details</h2>
						<span class="de-save-badge" id="de-save-badge">Not Saved</span>
					</div>
					<div class="de-grid">
						<div class="sc-field-group"><div id="de-field-document_type"></div></div>
						<div class="sc-field-group"><div id="de-field-reminder_in_days"></div></div>
						<div class="sc-field-group"><div id="de-field-valid_from"></div></div>
						<div class="sc-field-group"><div id="de-field-expire_on"></div></div>
					</div>
				</div>

				<!-- Department -->
				<div class="sc-form-section">
					<div class="sc-form-section-header">
						<h2>Department</h2>
					</div>
					<div class="de-grid">
						<div class="sc-field-group"><div id="de-field-department"></div></div>
						<div class="sc-field-group"><div id="de-field-latest_copy"></div></div>
						<div class="sc-field-group"><div id="de-field-subsidairy_company"></div></div>
						<div class="sc-field-group"><div id="de-field-expires_in_days"></div></div>
						<div class="sc-field-group de-field-full"><div id="de-field-remark"></div></div>
					</div>
					</div>
				</section>
			</div>
			</div>
		`);

		this.mount_controls();
		this.wire_buttons();
		this.bind_user_edit_signal();
		this.mount_list_pane();
	}

	// ─────────────────────────────────────────────
	//  LEFT PANE CONFIG — Document Expirations
	// ─────────────────────────────────────────────
	list_prefix() { return 'de'; }
	list_title() { return __('Document Expirations'); }
	list_search_hint() { return __('Search document type...'); }
	list_doctype() { return 'Document Expiration'; }
	list_fields() { return ['name', 'document_type', 'subsidairy_company', 'valid_from', 'expire_on', 'modified']; }
	list_empty_message() { return __('No Document Expirations yet.'); }

	list_filters() {
		const filters = [];
		if (this._current_subsidiary) filters.push(['subsidairy_company', '=', this._current_subsidiary]);
		if (this._current_document_type) filters.push(['document_type', '=', this._current_document_type]);
		return filters;
	}

	list_scope_parts() {
		const parts = [];
		if (this._current_subsidiary) parts.push(this._current_subsidiary);
		if (this._current_document_type) parts.push(this._current_document_type);
		return parts;
	}

	list_row_title(row) { return row.document_type || row.name; }
	list_row_badge(row) { return row.subsidairy_company || ''; }
	list_row_meta(row) { return [row.valid_from, row.expire_on]; }
	list_match(row) {
		return [row.name, row.document_type, row.subsidairy_company]
			.filter(Boolean).join(' ');
	}

	load_list_record(name) { this.load_document_expiration(name); }
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
		if (document.getElementById('bd-cc-document-expiration-styles')) return;

		const style = document.createElement('style');
		style.id = 'bd-cc-document-expiration-styles';
		style.innerHTML = `
			/* ── Document Expiration section ── */
			.de-save-badge {
				font-size: 11px; font-weight: 500; padding: 2px 8px;
				border-radius: 10px; border: 1px solid #d1d5db;
				color: #6b7280; background: #f9fafb;
			}
			.de-grid {
				display: grid; grid-template-columns: 1fr 1fr;
				gap: 16px 24px;
			}
			.de-field-full { grid-column: 1 / -1; }
			@media (max-width: 720px) { .de-grid { grid-template-columns: 1fr; } }
		`;
		document.head.appendChild(style);
	}

	field_definitions() {
		return [
			{ fieldname: 'document_type',      label: 'Document Type',      type: 'Link', options: 'Company Document Type', reqd: true },
			{ fieldname: 'reminder_in_days',   label: 'Reminder in Days',   type: 'Data', read_only: true },
			{ fieldname: 'valid_from',         label: 'Valid From',         type: 'Date' },
			{ fieldname: 'expire_on',          label: 'Expire On',          type: 'Date', reqd: true },
			{ fieldname: 'department',         label: 'Department',         type: 'Data', read_only: true },
			{ fieldname: 'latest_copy',        label: 'Latest Copy',        type: 'Attach', reqd: true },
			{ fieldname: 'subsidairy_company', label: 'Subsidiary Company', type: 'Link', options: 'Subsidairy Company', reqd: true },
			{ fieldname: 'expires_in_days',    label: 'Expires in Days',    type: 'Data', read_only: true },
			{ fieldname: 'remark',             label: 'Remark',             type: 'Small Text' },
		];
	}

	mount_controls() {
		this._ctrl_subsidiary = crm_customization.make_link_control(
			'de-subsidiary-control', 'Subsidairy Company', 'Subsidiary Company (primary)',
			(val) => this.on_subsidiary_change(val)
		);
		this._ctrl_customer = crm_customization.make_link_control(
			'de-customer-control', 'Customer', 'Client/Customer (optional)',
			(val) => this.on_customer_change(val)
		);

		this.field_definitions().forEach(def => {
			const container = document.getElementById('de-field-' + def.fieldname);
			if (!container) return;
			const ctrl = frappe.ui.form.make_control({
				df: {
					fieldtype: def.type,
					fieldname: 'de_' + def.fieldname,
					label: def.label,
					options: def.options || '',
					reqd: def.reqd ? 1 : 0,
					read_only: def.read_only ? 1 : 0,
				},
				parent: container,
				render_input: true,
			});
			ctrl.refresh();
			this._controls[def.fieldname] = ctrl;
		});

		const doc_type_ctrl = this._controls['document_type'];
		if (doc_type_ctrl && doc_type_ctrl.$input) {
			const fetch = () => this.fetch_document_type_defaults();
			doc_type_ctrl.$input.on('change', () => setTimeout(fetch, 100));
			doc_type_ctrl.$input.on('awesomplete-selectcomplete', () => setTimeout(fetch, 150));
		}

		const expire_ctrl = this._controls['expire_on'];
		if (expire_ctrl && expire_ctrl.$input) {
			expire_ctrl.$input.on('change', () => this.recalculate_expires_in_days());
		}

		this.bind_form_to_context(this._controls['subsidairy_company'], 'subsidairy_company');
	}

	// ─────────────────────────────────────────────
	//  FETCH / AUTO-CALC
	// ─────────────────────────────────────────────
	fetch_document_type_defaults() {
		const doc_type = this.field_value('document_type');
		const reminder = this._controls['reminder_in_days'];
		const department = this._controls['department'];

		if (!doc_type) {
			if (reminder) reminder.set_value('');
			if (department) department.set_value('');
			return;
		}

		frappe.db.get_value('Company Document Type', doc_type, ['reminder_in_days', 'department'])
			.then((r) => {
				const values = (r && r.message) || {};
				if (reminder) reminder.set_value(values.reminder_in_days || '');
				if (department) department.set_value(values.department || '');
			});
	}

	recalculate_expires_in_days() {
		const ctrl = this._controls['expires_in_days'];
		if (!ctrl) return;
		const expire_on = this.field_value('expire_on');
		if (!expire_on) {
			ctrl.set_value('');
			return;
		}
		const days = frappe.datetime.get_diff(expire_on, frappe.datetime.get_today());
		ctrl.set_value(String(days));
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
		this.update_context_desc();
	}

	on_document_type_change(val) {
		this._current_document_type = val;
		this.on_working_context_change();
		this.fetch_document_type_defaults();
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
			desc = 'Managing document expirations for <strong>' + sub + '</strong> / <strong>' + cust + '</strong>';
		} else if (sub) {
			desc = 'Managing document expirations for <strong>' + sub + '</strong>';
		}
		if (dt) {
			desc += ' &middot; Document Type: <strong>' + frappe.utils.escape_html(dt) + '</strong>';
		}
		$('#de-context-desc').html(desc);
	}

	// ─────────────────────────────────────────────
	//  BUTTON WIRING
	// ─────────────────────────────────────────────
	wire_buttons() {
		$('#de-open-doctype').on('click', () => frappe.set_route('List', 'Document Expiration'));
		$('#de-new-entry').on('click', () => this.new_entry_with_guard(() => this.new_entry()));
		$('#de-next-btn').on('click', () => this.controller.go_next_tab());
		$('#de-save-btn').on('click', () => this.save_document_expiration());

		$('#de-clear-context').on('click', () => {
			if (this._ctrl_subsidiary) this._ctrl_subsidiary.set_value('');
			if (this._ctrl_customer) this._ctrl_customer.set_value('');
			this._current_subsidiary = '';
			this._current_customer = '';
			this._current_document_type = '';
			this.update_context_desc();
		});
	}

	field_value(fieldname) {
		const val = this._controls[fieldname] ? this._controls[fieldname].get_value() : '';
		return (val === null || val === undefined) ? '' : val;
	}

	// ─────────────────────────────────────────────
	//  SAVE / NEW / NEXT
	// ─────────────────────────────────────────────
	validate_required() {
		const checks = [
			['document_type',      __('Document Type is required.')],
			['expire_on',          __('Expire On is required.')],
			['subsidairy_company', __('Subsidiary Company is required.')],
			['latest_copy',        __('Latest Copy is required.')],
		];
		for (const [fieldname, message] of checks) {
			if (!this.field_value(fieldname)) {
				frappe.msgprint({ title: __('Validation'), message: message, indicator: 'red' });
				return false;
			}
		}
		return true;
	}

	build_payload() {
		const doc = this._saved_doc_data
			? JSON.parse(JSON.stringify(this._saved_doc_data))
			: { doctype: 'Document Expiration' };
		doc.doctype = 'Document Expiration';
		doc.name = this._saved_doc || undefined;
		doc.document_type = this.field_value('document_type');
		doc.reminder_in_days = this.field_value('reminder_in_days');
		doc.valid_from = this.field_value('valid_from');
		doc.expire_on = this.field_value('expire_on');
		doc.department = this.field_value('department');
		doc.latest_copy = this.field_value('latest_copy');
		doc.subsidairy_company = this.field_value('subsidairy_company');
		doc.expires_in_days = this.field_value('expires_in_days');
		doc.remark = this.field_value('remark');
		return doc;
	}

	save_document_expiration() {
		if (!this.validate_required()) return;

		frappe.call({
			method: 'frappe.client.save',
			args: { doc: this.build_payload() },
			callback: (r) => {
				if (r.message) {
					this._saved_doc = r.message.name;
					this._saved_doc_data = r.message;
					$('#de-save-badge').text(r.message.name).css({ color: '#16a34a', borderColor: '#86efac', background: '#f0fdf4' });
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

		Object.keys(this._controls).forEach(fieldname => {
			try { this._controls[fieldname].set_value(''); } catch (e) {}
		});

		$('#de-save-badge').text('Not Saved').css({ color: '#6b7280', borderColor: '#d1d5db', background: '#f9fafb' });
		this.update_context_desc();
	}

	navigate_next() {
		const current = this._saved_doc;
		if (!current) {
			frappe.msgprint({ message: __('Save a Document Expiration first.'), indicator: 'orange' });
			return;
		}
		frappe.call({
			method: 'frappe.client.get_list',
			args: {
				doctype: 'Document Expiration',
				filters: [['name', '>', current]],
				fields: ['name'],
				order_by: 'name asc',
				limit: 1
			},
			callback: (r) => {
				if (r.message && r.message.length > 0) {
					this.load_document_expiration(r.message[0].name);
				} else {
					frappe.show_alert({ message: __('This is the last record.'), indicator: 'blue' });
				}
			}
		});
	}

	load_document_expiration(name) {
		this._loading = true;
		frappe.call({
			method: 'frappe.client.get',
			args: { doctype: 'Document Expiration', name: name },
			callback: (r) => {
				if (!r.message) return;
				const doc = r.message;
				this._saved_doc = doc.name;
				this._saved_doc_data = doc;

				this.populate_fields_from_doc(doc, [
					'document_type', 'reminder_in_days', 'valid_from', 'expire_on', 'department',
					'latest_copy', 'subsidairy_company', 'expires_in_days', 'remark',
				]);

				if (this._ctrl_subsidiary) this._ctrl_subsidiary.set_value(doc.subsidairy_company || '');
				this._current_subsidiary = doc.subsidairy_company || '';
				this._current_document_type = doc.document_type || '';
				this.recalculate_expires_in_days();

				$('#de-save-badge').text(doc.name).css({ color: '#16a34a', borderColor: '#86efac', background: '#f0fdf4' });
				this.update_context_desc();
				this.after_record_loaded();
			}
		});
	}
};
