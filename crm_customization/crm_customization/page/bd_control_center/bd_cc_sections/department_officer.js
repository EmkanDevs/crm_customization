// Copyright (c) 2026, Finbyz and contributors
// For license information, please see license.txt
// Department Officer section for the BD Control Center page.

frappe.provide('crm_customization');

crm_customization.BDCCDepartmentOfficer = class extends crm_customization.BDCCListPane {
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
			<div id="dof-tab-root">
				<div class="sc-split">

					${this.list_pane_html()}

					<section class="sc-split-right">

				<!-- Header action buttons -->
				<div class="sc-header-btns">
					<button class="sc-btn sc-btn-outline" id="dof-open-doctype">Open Original DocType</button>
					<button class="sc-btn sc-btn-outline" id="dof-new-entry">New Entry</button>
					<button class="sc-btn sc-btn-outline" id="dof-next-btn">Next</button>
					<button class="sc-btn sc-btn-primary" id="dof-save-btn">Save</button>
				</div>

				<!-- Officer Details -->
				<div class="sc-form-section">
					<div class="sc-form-section-header">
						<h2>Officer Details</h2>
						<span class="dof-save-badge" id="dof-save-badge">Not Saved</span>
					</div>
					<div class="dof-cols">
						<div class="dof-col">
							<div class="sc-field-group"><div id="dof-field-subsidairy_company"></div></div>
							<div class="sc-field-group"><div id="dof-field-department_officer"></div></div>
							<div class="sc-field-group"><div id="dof-field-department_officer_name"></div></div>
						</div>
						<div class="dof-col">
							<div class="sc-field-group"><div id="dof-field-department"></div></div>
							<div class="sc-field-group"><div id="dof-field-department_head"></div></div>
							<div class="sc-field-group"><div id="dof-field-department_head_name"></div></div>
						</div>
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
	//  LEFT PANE CONFIG — Department Officers
	// ─────────────────────────────────────────────
	list_prefix() { return 'dof'; }
	list_title() { return __('Department Officers'); }
	list_search_hint() { return __('Search officer, department...'); }
	list_doctype() { return 'Department Officer'; }
	list_fields() { return ['name', 'department_officer_name', 'department_head_name', 'department', 'subsidairy_company', 'modified']; }
	list_empty_message() { return __('No Department Officers yet.'); }

	list_filters() {
		const filters = [];
		if (this._current_subsidiary) filters.push(['subsidairy_company', '=', this._current_subsidiary]);
		return filters;
	}

	list_scope_parts() {
		const parts = [];
		if (this._current_subsidiary) parts.push(this._current_subsidiary);
		return parts;
	}

	list_row_title(row) { return row.department_officer_name || row.department_officer || row.name; }
	list_row_badge(row) { return row.department || ''; }
	list_row_meta(row) { return [row.department_head_name, row.subsidairy_company]; }
	list_match(row) {
		return [row.name, row.department_officer, row.department_officer_name, row.department_head_name, row.department, row.subsidairy_company]
			.filter(Boolean).join(' ');
	}

	load_list_record(name) { this.load_department_officer(name); }
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
		if (document.getElementById('bd-cc-department-officer-styles')) return;

		const style = document.createElement('style');
		style.id = 'bd-cc-department-officer-styles';
		style.innerHTML = `
			/* ── Department Officer section ── */
			.dof-save-badge {
				font-size: 11px; font-weight: 500; padding: 2px 8px;
				border-radius: 10px; border: 1px solid #d1d5db;
				color: #6b7280; background: #f9fafb;
			}
			.dof-cols { display: flex; gap: 24px; align-items: flex-start; }
			.dof-col { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 16px; }
			@media (max-width: 900px) { .dof-cols { flex-direction: column; } }
		`;
		document.head.appendChild(style);
	}

	field_definitions() {
		return [
			{ fieldname: 'subsidairy_company',      label: 'Subsidiary Company',       type: 'Link', options: 'Subsidairy Company', reqd: true },
			{ fieldname: 'department_officer',      label: 'Department Officer',       type: 'Link', options: 'User', reqd: true },
			{ fieldname: 'department_officer_name', label: 'Department Officer Name',  type: 'Data', read_only: true },
			{ fieldname: 'department',              label: 'Department',               type: 'Link', options: 'Department', reqd: true },
			{ fieldname: 'department_head',         label: 'Department Head',          type: 'Link', options: 'User', reqd: true },
			{ fieldname: 'department_head_name',    label: 'Department Head Name',     type: 'Data', read_only: true },
		];
	}

	mount_controls() {
		this._ctrl_subsidiary = crm_customization.make_link_control(
			'dof-subsidiary-control', 'Subsidairy Company', 'Subsidiary Company (primary)',
			(val) => this.on_subsidiary_change(val)
		);
		this._ctrl_customer = crm_customization.make_link_control(
			'dof-customer-control', 'Customer', 'Client/Customer (optional)',
			(val) => this.on_customer_change(val)
		);

		this.field_definitions().forEach(def => {
			const container = document.getElementById('dof-field-' + def.fieldname);
			if (!container) return;
			const ctrl = frappe.ui.form.make_control({
				df: {
					fieldtype: def.type,
					fieldname: 'dof_' + def.fieldname,
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

		this.bind_form_to_context(this._controls['subsidairy_company'], 'subsidairy_company');

		[
			['department_officer', 'department_officer_name'],
			['department_head', 'department_head_name'],
		].forEach(([source, target]) => {
			const ctrl = this._controls[source];
			if (ctrl && ctrl.$input) {
				const fetch = () => this.fetch_user_name(source, target);
				ctrl.$input.on('change', () => setTimeout(fetch, 100));
				ctrl.$input.on('awesomplete-selectcomplete', () => setTimeout(fetch, 150));
			}
		});
	}

	fetch_user_name(source, target) {
		const target_ctrl = this._controls[target];
		if (!target_ctrl) return;
		const user = this.field_value(source);
		if (!user) {
			target_ctrl.set_value('');
			return;
		}
		frappe.db.get_value('User', user, 'full_name').then((r) => {
			const full_name = (r && r.message && r.message.full_name) || '';
			target_ctrl.set_value(full_name);
		});
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
		let desc = 'Select a Subsidiary Company to begin';
		if (sub && cust) {
			desc = 'Assigning department officers for <strong>' + sub + '</strong> / <strong>' + cust + '</strong>';
		} else if (sub) {
			desc = 'Assigning department officers for <strong>' + sub + '</strong>';
		}
		$('#dof-context-desc').html(desc);
	}

	// ─────────────────────────────────────────────
	//  BUTTON WIRING
	// ─────────────────────────────────────────────
	wire_buttons() {
		$('#dof-open-doctype').on('click', () => frappe.set_route('List', 'Department Officer'));
		$('#dof-new-entry').on('click', () => this.new_entry_with_guard(() => this.new_entry()));
		$('#dof-next-btn').on('click', () => this.controller.go_next_tab());
		$('#dof-save-btn').on('click', () => this.save_department_officer());

		$('#dof-clear-context').on('click', () => {
			if (this._ctrl_subsidiary) this._ctrl_subsidiary.set_value('');
			if (this._ctrl_customer) this._ctrl_customer.set_value('');
			this._current_subsidiary = '';
			this._current_customer = '';
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
			['subsidairy_company', __('Subsidiary Company is required.')],
			['department_officer', __('Department Officer is required.')],
			['department',         __('Department is required.')],
			['department_head',    __('Department Head is required.')],
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
			: { doctype: 'Department Officer' };
		doc.doctype = 'Department Officer';
		doc.name = this._saved_doc || undefined;

		[
			'subsidairy_company', 'department_officer', 'department_officer_name',
			'department', 'department_head', 'department_head_name',
		].forEach(fieldname => {
			doc[fieldname] = this.field_value(fieldname);
		});

		return doc;
	}

	save_department_officer() {
		if (!this.validate_required()) return;

		frappe.call({
			method: 'frappe.client.save',
			args: { doc: this.build_payload() },
			callback: (r) => {
				if (r.message) {
					this._saved_doc = r.message.name;
					this._saved_doc_data = r.message;
					$('#dof-save-badge').text(r.message.name).css({ color: '#16a34a', borderColor: '#86efac', background: '#f0fdf4' });
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

		Object.keys(this._controls).forEach(fieldname => {
			try { this._controls[fieldname].set_value(''); } catch (e) {}
		});

		$('#dof-save-badge').text('Not Saved').css({ color: '#6b7280', borderColor: '#d1d5db', background: '#f9fafb' });
		this.update_context_desc();
	}

	navigate_next() {
		const current = this._saved_doc;
		if (!current) {
			frappe.msgprint({ message: __('Save a Department Officer first.'), indicator: 'orange' });
			return;
		}
		frappe.call({
			method: 'frappe.client.get_list',
			args: {
				doctype: 'Department Officer',
				filters: [['name', '>', current]],
				fields: ['name'],
				order_by: 'name asc',
				limit: 1
			},
			callback: (r) => {
				if (r.message && r.message.length > 0) {
					this.load_department_officer(r.message[0].name);
				} else {
					frappe.show_alert({ message: __('This is the last record.'), indicator: 'blue' });
				}
			}
		});
	}

	load_department_officer(name) {
		this._loading = true;
		frappe.call({
			method: 'frappe.client.get',
			args: { doctype: 'Department Officer', name: name },
			callback: (r) => {
				if (!r.message) return;
				const doc = r.message;
				this._saved_doc = doc.name;
				this._saved_doc_data = doc;

				this.populate_fields_from_doc(doc, [
					'subsidairy_company', 'department_officer', 'department_officer_name',
					'department', 'department_head', 'department_head_name',
				]);

				if (this._ctrl_subsidiary) this._ctrl_subsidiary.set_value(doc.subsidairy_company || '');
				this._current_subsidiary = doc.subsidairy_company || '';

				$('#dof-save-badge').text(doc.name).css({ color: '#16a34a', borderColor: '#86efac', background: '#f0fdf4' });
				this.update_context_desc();
				this.after_record_loaded();
			}
		});
	}
};
