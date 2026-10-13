// Copyright (c) 2026, Finbyz and contributors
// For license information, please see license.txt
// Company Document Type section for the BD Control Center page.

frappe.provide('crm_customization');

crm_customization.BDCCCompanyDocumentType = class extends crm_customization.BDCCListPane {
	constructor(controller, $panel) {
		super(controller, $panel);
		this.controller = controller;
		this.page = controller.page;
		this.$panel = $panel;

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
			<div id="cdt-tab-root">
				<div class="sc-split">

					${this.list_pane_html()}

					<section class="sc-split-right">

				<!-- Header action buttons -->
				<div class="sc-header-btns">
					<button class="sc-btn sc-btn-outline" id="cdt-open-doctype">Open Original DocType</button>
					<button class="sc-btn sc-btn-outline" id="cdt-new-entry">New Entry</button>
					<button class="sc-btn sc-btn-outline" id="cdt-next-btn">Next</button>
					<button class="sc-btn sc-btn-primary" id="cdt-save-btn">Save</button>
				</div>

				<!-- Company Document Type Form -->
				<div class="sc-form-section">
					<div class="sc-form-section-header">
						<h2>Company Document Type</h2>
						<span class="cdt-save-badge" id="cdt-save-badge">Not Saved</span>
					</div>

					<div class="cdt-grid">
						<div class="sc-field-group"><div id="cdt-field-document_type"></div></div>
						<div class="sc-field-group"><div id="cdt-field-document_type_ar"></div></div>
						<div class="sc-field-group"><div id="cdt-field-reminder_in_days"></div></div>
						<div class="sc-field-group"><div id="cdt-field-department"></div></div>
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
	//  LEFT PANE CONFIG — Document Types
	// ─────────────────────────────────────────────
	list_prefix() { return 'cdt'; }
	list_title() { return __('Document Types'); }
	list_search_hint() { return __('Search document type...'); }
	list_doctype() { return 'Company Document Type'; }
	list_fields() { return ['name', 'document_type', 'document_type_ar', 'reminder_in_days', 'department', 'modified']; }
	list_empty_message() { return __('No Document Types yet.'); }

	list_filters() {
		const filters = [];
		return filters;
	}

	list_scope_parts() {
		const parts = [];
		return parts;
	}

	list_row_title(row) { return row.document_type || row.name; }
	list_row_badge(row) { return row.department || ''; }
	list_row_meta(row) { return [row.document_type_ar, (row.reminder_in_days ? __('Reminder: {0} days', [row.reminder_in_days]) : '')]; }
	list_match(row) {
		return [row.name, row.document_type, row.document_type_ar, row.department]
			.filter(Boolean).join(' ');
	}

	load_list_record(name) { this.load_document_type(name); }
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
		if (document.getElementById('bd-cc-company-document-type-styles')) return;

		const style = document.createElement('style');
		style.id = 'bd-cc-company-document-type-styles';
		style.innerHTML = `
			/* ── Company Document Type section ── */
			.cdt-save-badge {
				font-size: 11px; font-weight: 500; padding: 2px 8px;
				border-radius: 10px; border: 1px solid #d1d5db;
				color: #6b7280; background: #f9fafb;
			}
			.cdt-grid {
				display: grid; grid-template-columns: 1fr 1fr;
				gap: 16px 24px;
			}
			@media (max-width: 720px) { .cdt-grid { grid-template-columns: 1fr; } }
		`;
		document.head.appendChild(style);
	}

	field_definitions() {
		return [
			{ fieldname: 'document_type',    label: 'Document Type',    type: 'Data', reqd: true },
			{ fieldname: 'document_type_ar', label: 'Document Type AR', type: 'Data' },
			{ fieldname: 'reminder_in_days', label: 'Reminder in Days', type: 'Int', reqd: true },
			{ fieldname: 'department',       label: 'Department',       type: 'Link', options: 'Department', reqd: true },
		];
	}

	mount_controls() {
		this.field_definitions().forEach(def => {
			const container = document.getElementById('cdt-field-' + def.fieldname);
			if (!container) return;
			const ctrl = frappe.ui.form.make_control({
				df: {
					fieldtype: def.type,
					fieldname: 'cdt_' + def.fieldname,
					label: def.label,
					options: def.options || '',
					reqd: def.reqd ? 1 : 0,
				},
				parent: container,
				render_input: true,
			});
			ctrl.refresh();
			this._controls[def.fieldname] = ctrl;
		});

		if (this._controls.reminder_in_days) {
			this._controls.reminder_in_days.set_value(30);
		}
	}

	// ─────────────────────────────────────────────
	//  BUTTON WIRING
	// ─────────────────────────────────────────────
	wire_buttons() {
		$('#cdt-open-doctype').on('click', () => frappe.set_route('List', 'Company Document Type'));
		$('#cdt-new-entry').on('click', () => this.new_entry_with_guard(() => this.new_entry()));
		$('#cdt-next-btn').on('click', () => this.controller.go_next_tab());
		$('#cdt-save-btn').on('click', () => this.save_document_type());
	}

	field_value(fieldname) {
		const val = this._controls[fieldname] ? this._controls[fieldname].get_value() : '';
		return (val === null || val === undefined) ? '' : val;
	}

	// ─────────────────────────────────────────────
	//  SAVE / NEW / NEXT
	// ─────────────────────────────────────────────
	validate_required() {
		if (!this.field_value('document_type')) {
			frappe.msgprint({ title: __('Validation'), message: __('Document Type is required.'), indicator: 'red' });
			return false;
		}
		const reminder = this.field_value('reminder_in_days');
		if (reminder === '' || reminder === null || reminder === undefined) {
			frappe.msgprint({ title: __('Validation'), message: __('Reminder in Days is required.'), indicator: 'red' });
			return false;
		}
		if (!this.field_value('department')) {
			frappe.msgprint({ title: __('Validation'), message: __('Department is required.'), indicator: 'red' });
			return false;
		}
		return true;
	}

	build_payload() {
		const doc = this._saved_doc_data
			? JSON.parse(JSON.stringify(this._saved_doc_data))
			: { doctype: 'Company Document Type' };
		doc.doctype = 'Company Document Type';
		doc.name = this._saved_doc || undefined;
		doc.document_type = this.field_value('document_type');
		doc.document_type_ar = this.field_value('document_type_ar');
		doc.reminder_in_days = cint(this.field_value('reminder_in_days'));
		doc.department = this.field_value('department');
		return doc;
	}

	save_document_type() {
		if (!this.validate_required()) return;

		frappe.call({
			method: 'frappe.client.save',
			args: { doc: this.build_payload() },
			callback: (r) => {
				if (r.message) {
					this._saved_doc = r.message.name;
					this._saved_doc_data = r.message;
					$('#cdt-save-badge').text(r.message.name).css({ color: '#16a34a', borderColor: '#86efac', background: '#f0fdf4' });
					frappe.show_alert({ message: __('Saved successfully'), indicator: 'green' });
				this.capture_dirty_baseline(250);
				this.set_active_list_item(r.message.name);
				this.load_list();

					if (this.controller) {
						this.controller.set_working_context('company_document_type', {
							document_type: r.message.name
						});
					}
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
		this._saved_doc = '';
		this._saved_doc_data = null;

		Object.keys(this._controls).forEach(fieldname => {
			try { this._controls[fieldname].set_value(''); } catch (e) {}
		});
		if (this._controls.reminder_in_days) {
			this._controls.reminder_in_days.set_value(30);
		}

		$('#cdt-save-badge').text('Not Saved').css({ color: '#6b7280', borderColor: '#d1d5db', background: '#f9fafb' });
	}

	navigate_next() {
		const current = this._saved_doc;
		if (!current) {
			frappe.msgprint({ message: __('Save a Company Document Type first.'), indicator: 'orange' });
			return;
		}
		frappe.call({
			method: 'frappe.client.get_list',
			args: {
				doctype: 'Company Document Type',
				filters: [['name', '>', current]],
				fields: ['name'],
				order_by: 'name asc',
				limit: 1
			},
			callback: (r) => {
				if (r.message && r.message.length > 0) {
					this.load_document_type(r.message[0].name);
				} else {
					frappe.show_alert({ message: __('This is the last record.'), indicator: 'blue' });
				}
			}
		});
	}

	load_document_type(name) {
		this._loading = true;
		frappe.call({
			method: 'frappe.client.get',
			args: { doctype: 'Company Document Type', name: name },
			callback: (r) => {
				if (!r.message) return;
				const doc = r.message;
				this._saved_doc = doc.name;
				this._saved_doc_data = doc;

				this.populate_fields_from_doc(doc, [
					'document_type', 'document_type_ar', 'reminder_in_days', 'department',
				]);

				$('#cdt-save-badge').text(doc.name).css({ color: '#16a34a', borderColor: '#86efac', background: '#f0fdf4' });
				this.after_record_loaded();
			}
		});
	}
};
