// Copyright (c) 2026, Finbyz and contributors
// For license information, please see license.txt
// Customer section for the BD Control Center page.
//
// 20% left pane with a searchable master list of Customers, 80% right pane
// with the Customer form: core fields (name / type / group) plus the
// "Customer IDs" section (VAT registration number and the
// `custom_additional_ids` child table of Additional Buyer IDs).

frappe.provide('crm_customization');

crm_customization.BDCCCustomer = class {
	constructor(controller, $panel) {
		this.controller = controller;
		this.page = controller.page;
		this.$panel = $panel;

		this._controls = {};
		this._id_rows = [];

		this._saved_doc = '';
		this._saved_doc_data = null;

//  Kept so the controller can propagate working context here even
		// though this tab no longer renders a context bar of its own. The
		// selected Subsidiary Company scopes the left list to the clients
		// listed in its `task_registered` child table.
		this._current_subsidiary = '';

		// The subsidiary the left list was last loaded for. The controller sets
		// `_current_subsidiary` itself before invoking `on_subsidiary_change`,
		// so this separate marker is what tells us a reload is actually needed.
		this._applied_subsidiary = '';
		this._subsidiary_clients = [];

		// Working context from the global bar's Customer filter. When set (and
		// not cleared with the filter pill's ×), the left list shows only that
		// customer. Row clicks in this tab do not touch it — only the global
		// filter does (see `on_customer_change`).
		this._current_customer = '';
		this._applied_customer = '';

		// Master list of Customer records shown in the left pane.
		this._list_data = [];
		this._list_query = '';
		this._active_list_item = '';

		// Guards against a slow list response overwriting a newer one.
		this._list_request = 0;

		this._loading = false;
		this._silent = 0;
		this._dirty = false;
	}

	// ─────────────────────────────────────────────
	//  RENDER
	// ─────────────────────────────────────────────
	render() {
		this.add_styles();
		this.$panel.html(`
			<div id="cu-tab-root">
				<div class="sc-split">

					<!-- ── LEFT 20% : Customer list ── -->
					<aside class="sc-split-left">
						<div class="sc-list-head">
							<div class="sc-list-title">
								Customers
								<span class="sc-list-count" id="cu-list-count">0</span>
							</div>
							<div class="sc-list-filter" id="cu-list-filter" style="display: none;"></div>
							<div class="sc-list-tools">
								<input
									type="text"
									id="cu-list-search"
									class="sc-list-search"
									placeholder="Search customer, group, VAT No..."
									autocomplete="off"
								/>
								<button class="sc-list-refresh" id="cu-list-refresh" title="Refresh list">
									<span class="sc-list-refresh-icon">&#8635;</span>
								</button>
							</div>
						</div>
						<div class="sc-list-body" id="cu-list-body">
							<div class="sc-list-empty">Loading...</div>
						</div>
					</aside>

					<!-- ── RIGHT 80% : Form + child tables ── -->
					<section class="sc-split-right">

						<!-- Header action buttons -->
						<div class="sc-header-btns">
							<button class="sc-btn sc-btn-outline" id="cu-open-doctype">Open Original DocType</button>
							<button class="sc-btn sc-btn-outline" id="cu-new-entry">New Entry</button>
							<button class="sc-btn sc-btn-outline" id="cu-next-btn">Next</button>
							<button class="sc-btn sc-btn-primary" id="cu-save-btn">Save</button>
						</div>

						<!-- Customer Details -->
						<div class="sc-form-section">
							<div class="sc-form-section-header">
								<h2 id="cu-form-heading">Customer</h2>
								<span class="sc-form-abbrev" id="cu-type-badge"></span>
							</div>

							<div class="sc-form-row">
								<div class="sc-field-group"><div id="cu-field-customer_name"></div></div>
								<div class="sc-field-group"><div id="cu-field-customer_type"></div></div>
							</div>
							<div class="sc-form-row single">
								<div class="sc-field-group"><div id="cu-field-customer_group"></div></div>
							</div>
						</div>

						<!-- Customer IDs -->
						<div class="sc-form-section">
							<div class="sc-section-title">Customer IDs</div>

							<div class="sc-form-row single">
								<div class="sc-field-group"><div id="cu-field-vat_registration_number"></div></div>
							</div>

							<div class="sc-section-title">Additional IDs</div>
							<div class="sc-table-wrap">
								<table class="sc-child-table">
									<thead>
										<tr>
											<th>No.</th>
											<th>Type Name</th>
											<th>Type Code</th>
											<th>Value</th>
											<th>Actions</th>
										</tr>
									</thead>
									<tbody id="cu-ids-tbody">
										<tr class="sc-no-data-row"><td colspan="5">No additional IDs yet. Add a row to begin.</td></tr>
									</tbody>
								</table>
							</div>
							<div class="sc-add-row-bar">
								<button class="sc-add-row-btn" id="cu-ids-add-row">Add Row</button>
							</div>
						</div>

					</section>
				</div>
			</div>
		`);

		this.mount_controls();
		this.wire_buttons();
		this.load_list();
	}

	add_styles() {
		crm_customization.ensure_base_section_styles();
		if (document.getElementById('bd-cc-customer-styles')) return;

		const style = document.createElement('style');
		style.id = 'bd-cc-customer-styles';
		style.innerHTML = `
			/* ── Customer section ── */
			.sc-list-filter {
				font-size: 10.5px; font-weight: 600; color: #1d4ed8;
				background: #eff6ff; border: 1px solid #bfdbfe;
				padding: 2px 7px; border-radius: 10px;
				overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
				display: inline-flex; align-items: center; gap: 6px; max-width: 100%;
			}
			.cu-id-type select { font-weight: 600; color: #374151; }
			.cu-id-code {
				font-size: 11px; font-weight: 600; color: #6b7280;
				background: #f1f5f9; border-radius: 4px; padding: 2px 6px;
				display: inline-block; min-width: 46px; text-align: center;
			}

			/* Dark mode */
			[data-theme="dark"] .sc-list-filter { background: #2a3f6e; border-color: #3b5b8f; color: #93c5fd; }
			[data-theme="dark"] .cu-id-code { background: #2d3748; color: #a0aec0; }
		`;
		document.head.appendChild(style);
	}

	// ─────────────────────────────────────────────
	//  FRAPPE CONTROLS
	// ─────────────────────────────────────────────
	field_definitions() {
		return [
			{ fieldname: 'customer_name',  label: 'Customer Name',  type: 'Data',   reqd: true },
			{ fieldname: 'customer_type',  label: 'Customer Type',  type: 'Select', reqd: true },
			{ fieldname: 'customer_group', label: 'Customer Group', type: 'Link',   options: 'Customer Group', reqd: false },
		];
	}

	customer_type_options() {
		// Read the options from the doctype itself so the field never drifts
		// from what the standard Customer form offers.
		const df = frappe.meta.get_docfield('Customer', 'customer_type');
		let options = [];
		if (df && df.options) {
			options = String(df.options).split('\n').map((o) => o.trim()).filter(Boolean);
		}
		if (!options.length) options = ['Company', 'Individual', 'Partnership'];
		return ['', ...options];
	}

	mount_controls() {
		this.field_definitions().forEach((def) => {
			const container = document.getElementById('cu-field-' + def.fieldname);
			if (!container) return;
			const ctrl = frappe.ui.form.make_control({
				df: {
					fieldtype: def.type,
					fieldname: def.fieldname,
					label: def.label,
					options: def.type === 'Select'
						? this.customer_type_options().join('\n')
						: (def.options || ''),
					reqd: def.reqd ? 1 : 0,
					placeholder: def.label,
				},
				parent: container,
				render_input: true,
			});
			ctrl.refresh();
			this._controls[def.fieldname] = ctrl;

			if (ctrl.$input) {
				ctrl.$input.on('change', () => {
					if (def.fieldname === 'customer_type') {
						$('#cu-type-badge').text(ctrl.get_value() || '');
					}
					this.mark_dirty();
				});
			}
			if (ctrl.$wrapper) {
				ctrl.$wrapper.on('awesomplete-selectcomplete', () => this.mark_dirty());
			}
		});

		this._controls['custom_vat_registration_number'] = crm_customization.make_data_control(
			'cu-field-vat_registration_number', 'VAT Registration Number', false
		);
		if (this._controls['custom_vat_registration_number']) {
			this._controls['custom_vat_registration_number'].$input.on('change', () => this.mark_dirty());
		}
	}

	field_value(fieldname) {
		const ctrl = this._controls[fieldname];
		const val = ctrl ? ctrl.get_value() : '';
		return (val === null || val === undefined) ? '' : val;
	}

	// ─────────────────────────────────────────────
	//  DIRTY TRACKING
	// ─────────────────────────────────────────────
	mark_dirty() {
		if (this._loading || this._silent) return;
		this._dirty = true;
	}

	/**
	 * Run `fn` without its value changes marking the form dirty. Frappe
	 * controls emit `change` asynchronously after `set_value`, so the guard is
	 * held for `grace_ms` afterwards to swallow those late events.
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

	// ─────────────────────────────────────────────
	//  LEFT PANE — Customer list
	//
	//  When a Subsidiary Company is active in the working context the list is
	//  restricted to the clients that appear in its `task_registered` rows.
	// ─────────────────────────────────────────────
	load_list() {
		const subsidiary = this._list_unscoped ? '' : (this._current_subsidiary || '');
		const request_id = ++this._list_request;

		$('#cu-list-refresh').addClass('sc-spinning');
		this.update_list_filter_label();

		const show_message = (msg) => {
			if (request_id !== this._list_request) return;
			$('#cu-list-refresh').removeClass('sc-spinning');
			this._list_data = [];
			this.render_list(msg);
		};

		if (!subsidiary) {
			this.load_customers(request_id, null, show_message);
			return;
		}

		this.subsidiary_clients(subsidiary).then((clients) => {
			// The context may have moved on while the clients were loading.
			if (request_id !== this._list_request) return;

			this._subsidiary_clients = clients;
			if (!clients.length) {
				show_message(__('This Subsidiary Company has no clients in Task Registered yet.'));
				return;
			}
			this.load_customers(request_id, clients, show_message);
		});
	}

	/**
	 * Unique customers linked to a Subsidiary Company through its
	 * `task_registered` child table's `client` column.
	 *
	 * Child doctypes cannot be listed through `frappe.client.get_list`
	 * without a `parent` argument (it raises PermissionError), so this uses a
	 * dedicated whitelisted method on the page.
	 */
	subsidiary_clients(subsidiary) {
		if (!subsidiary) return Promise.resolve([]);

		return frappe.call({
			method: 'crm_customization.crm_customization.page.bd_control_center.bd_control_center.get_subsidiary_clients',
			args: { subsidiary: subsidiary },
		}).then((r) => {
			const clients = [];
			(r && r.message ? r.message : []).forEach((client) => {
				const value = String(client || '').trim();
				if (value && !clients.includes(value)) clients.push(value);
			});
			return clients;
		}).catch(() => []);
	}

	load_customers(request_id, clients, show_message) {
		const filters = [];
		if (!this._list_unscoped) {
			if (clients && clients.length) filters.push(['name', 'in', clients]);
			if (this._current_customer) filters.push(['name', '=', this._current_customer]);
		}

		frappe.call({
			method: 'frappe.client.get_list',
			args: {
				doctype: 'Customer',
				fields: [
					'name',
					'customer_name',
					'customer_type',
					'customer_group',
					'custom_vat_registration_number',
					'modified',
				],
				filters: filters,
				order_by: 'modified desc',
				limit_page_length: 500,
			},
			callback: (r) => {
				if (request_id !== this._list_request) return;
				$('#cu-list-refresh').removeClass('sc-spinning');
				this._list_data = r.message || [];
				this.render_list();
			},
			error: () => {
				if (request_id !== this._list_request) return;
				show_message(__('Could not load the Customer list.'));
			},
		});
	}

	update_list_filter_label() {
		const $filter = $('#cu-list-filter');
		if (!$filter.length) return;

		if (this._list_unscoped) {
			$filter.hide();
			return;
		}

		const parts = [];
		if (this._current_subsidiary) {
			parts.push(frappe.utils.escape_html(this._current_subsidiary));
		}
		if (this._current_customer) {
			parts.push(frappe.utils.escape_html(this._current_customer));
		}
		if (!parts.length) {
			$filter.hide();
			return;
		}
		$filter.show().html(
			`<span class="sc-list-scope-text">` +
			__('Filtered by') + ': <strong>' + parts.join('</strong> · <strong>') + '</strong>' +
			`</span>` +
			`<button type="button" class="sc-filter-clear" title="${__('Remove filter')}" aria-label="${__('Remove filter')}">&times;</button>`
		);
	}

	/**
	 * Remove the scope filter from the left list: reload unscoped so every
	 * customer shows. Re-applies automatically when the Subsidiary Company or
	 * Customer context actually changes (see `on_subsidiary_change` /
	 * `on_customer_change`).
	 */
	clear_list_filter() {
		this._list_unscoped = true;
		this.update_list_filter_label();
		this.load_list();
	}

	_filtered_list() {
		const q = (this._list_query || '').trim().toLowerCase();
		if (!q) return this._list_data;
		return this._list_data.filter((d) => {
			return [d.name, d.customer_name, d.customer_type, d.customer_group, d.custom_vat_registration_number]
				.some((v) => String(v || '').toLowerCase().includes(q));
		});
	}

	render_list(empty_msg) {
		const $body = $('#cu-list-body');
		if (!$body.length) return;

		const rows = this._filtered_list();
		$('#cu-list-count').text(rows.length);

		if (!rows.length) {
			$body.html(`<div class="sc-list-empty">${frappe.utils.escape_html(
				empty_msg || (this._list_query ? __('No matching Customer.') : __('No Customer yet.'))
			)}</div>`);
			return;
		}

		const esc = (v) => frappe.utils.escape_html(v || '');
		const fmt_date = (v) => (frappe.datetime && frappe.datetime.str_to_user ? frappe.datetime.str_to_user(v) : (v || ''));

		$body.html(rows.map((d) => {
			const name = d.name || '';
			const active = name && name === this._active_list_item ? ' active' : '';
			const meta = [];
			if (d.customer_group) meta.push(d.customer_group);
			if (d.custom_vat_registration_number) meta.push('VAT: ' + d.custom_vat_registration_number);
			if (!meta.length) meta.push(fmt_date(d.modified));
			return `
				<button type="button" class="sc-list-item${active}" data-name="${esc(name)}" title="${esc(name)}">
					<span class="sc-list-item-title">
						<span class="sc-list-item-name">${esc(d.customer_name || name)}</span>
						${d.customer_type ? `<span class="sc-list-item-badge">${esc(d.customer_type)}</span>` : ''}
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
		const $body = $('#cu-list-body');
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
			this.load_customer(name);
		};

		if (this._dirty) {
			this.confirm_discard_changes(proceed);
			return;
		}

		proceed();
	}

	confirm_discard_changes(on_confirm) {
		// `frappe.confirm` in this version is positional (message, yes, no),
		// so build the dialog explicitly.
		const d = new frappe.ui.Dialog({
			title: __('Unsaved Changes'),
			size: 'small',
			fields: [
				{
					fieldtype: 'HTML',
					fieldname: 'message',
					options:
						'<p>' +
						__('This Customer has unsaved changes. Discard them and open the selected one?') +
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
	//  ADDITIONAL IDS TABLE
	// ─────────────────────────────────────────────
	additional_id_types() {
		// Standard ZATCA buyer ID types, merged with whatever already exists on
		// the loaded record so nothing is lost from the option list.
		const types = [
			{ type_name: 'Commercial Registration Number', type_code: 'CRN' },
			{ type_name: 'MOMRAH License', type_code: 'MOM' },
			{ type_name: 'MHRSD License', type_code: 'MLS' },
			{ type_name: '700 Number', type_code: '700' },
			{ type_name: 'MISA License', type_code: 'SAG' },
			{ type_name: 'Tax Identification Number', type_code: 'TIN' },
			{ type_name: 'GCC ID', type_code: 'GCC' },
			{ type_name: 'National ID', type_code: 'NAT' },
			{ type_name: 'Iqama', type_code: 'IQA' },
			{ type_name: 'Passport ID', type_code: 'PAS' },
			{ type_name: 'Other ID', type_code: 'OTH' },
		];

		(this._id_rows || []).forEach((row) => {
			const name = row.type_name || '';
			if (!name) return;
			if (!types.some((t) => t.type_name === name)) {
				types.push({ type_name: name, type_code: row.type_code || '' });
			}
		});

		return types;
	}

	type_code_for(type_name) {
		const found = this.additional_id_types().find((t) => t.type_name === type_name);
		return found ? found.type_code : '';
	}

	render_id_table() {
		const tbody = document.getElementById('cu-ids-tbody');
		if (!tbody) return;

		if (!this._id_rows || !this._id_rows.length) {
			tbody.innerHTML = `<tr class="sc-no-data-row"><td colspan="5">No additional IDs yet. Add a row to begin.</td></tr>`;
			return;
		}

		const esc = (v) => frappe.utils.escape_html(v || '');
		const opts = this.additional_id_types();

		tbody.innerHTML = this._id_rows.map((row, idx) => {
			const type_name = row.type_name || '';
			const options = opts
				.map((t) => `<option value="${esc(t.type_name)}" ${t.type_name === type_name ? 'selected' : ''}>${esc(t.type_name)}</option>`)
				.join('');
			return `
				<tr data-idx="${idx}">
					<td class="sc-row-num">${idx + 1}</td>
					<td class="cu-id-type"><select data-field="type_name"><option value=""></option>${options}</select></td>
					<td><span class="cu-id-code" data-field-code>${esc(row.type_code || '')}</span></td>
					<td><input type="text" value="${esc(row.value)}" data-field="value" placeholder="Enter value"></td>
					<td class="sc-actions-cell">
						<button type="button" class="sc-remove-row-btn" data-action="remove-row">Delete</button>
					</td>
				</tr>
			`;
		}).join('');

		$(tbody).find('select[data-field="type_name"]').on('change', (e) => {
			const $tr = $(e.currentTarget).closest('tr');
			const idx = parseInt($tr.data('idx'));
			if (isNaN(idx) || !this._id_rows[idx]) return;
			const type_name = $(e.currentTarget).val();
			this._id_rows[idx].type_name = type_name;
			this._id_rows[idx].type_code = this.type_code_for(type_name);
			$tr.find('[data-field-code]').text(this._id_rows[idx].type_code || '');
			this.mark_dirty();
		});

		$(tbody).find('input[data-field="value"]').on('change', (e) => {
			const $el = $(e.currentTarget);
			const idx = parseInt($el.closest('tr').data('idx'));
			if (isNaN(idx) || !this._id_rows[idx]) return;
			this._id_rows[idx].value = $el.val();
			this.mark_dirty();
		});

		$(tbody).find('.sc-remove-row-btn').on('click', (e) => {
			const idx = parseInt($(e.currentTarget).closest('tr').data('idx'));
			this.remove_id_row(idx);
		});
	}

	remove_id_row(idx) {
		if (isNaN(idx) || idx < 0 || idx >= this._id_rows.length) return;
		this._id_rows.splice(idx, 1);
		this.mark_dirty();
		this.render_id_table();
	}

	add_id_row() {
		const defaults = this.additional_id_types();
		const used = (this._id_rows || []).map((r) => r.type_name);
		const next = defaults.find((t) => !used.includes(t.type_name)) || defaults[0];

		this._id_rows.push({ type_name: next.type_name, type_code: next.type_code, value: '' });
		this.mark_dirty();
		this.render_id_table();
	}

	// ─────────────────────────────────────────────
	//  WORKING CONTEXT HOOKS
	// ─────────────────────────────────────────────
	//  This tab has no context bar of its own; it still records the Subsidiary
	//  Company inherited from the tab on its left and narrows the left list to
	//  the clients of that company.
	on_subsidiary_change(val) {
		const subsidiary = val || '';
		if (subsidiary === this._applied_subsidiary) return;
		this._list_unscoped = false;
		this._applied_subsidiary = subsidiary;
		this._current_subsidiary = subsidiary;
		this._subsidiary_clients = [];
		this.load_list();
	}

	/**
	 * The global bar's Customer filter changed. Reload the left list scoped to
	 * that customer (row clicks in this tab never reach here — the controller
	 * skips the source tab).
	 */
	on_customer_change(val) {
		const customer = val || '';
		if (customer === this._applied_customer) return;
		this._list_unscoped = false;
		this._applied_customer = customer;
		this.load_list();
	}

	// ─────────────────────────────────────────────
	//  BUTTON WIRING
	// ─────────────────────────────────────────────
	wire_buttons() {
		// Left pane
		$('#cu-list-refresh').on('click', () => this.load_list());
		$('#cu-list-filter').on('click', '.sc-filter-clear', () => this.clear_list_filter());

		let search_timer = null;
		$('#cu-list-search').on('input', (e) => {
			const val = $(e.currentTarget).val();
			clearTimeout(search_timer);
			search_timer = setTimeout(() => {
				this._list_query = val;
				this.render_list();
			}, 200);
		});

		// Right pane
		$('#cu-open-doctype').on('click', () => {
			frappe.set_route('List', 'Customer');
		});
		$('#cu-new-entry').on('click', () => this.new_entry());
		$('#cu-next-btn').on('click', () => this.controller.go_next_tab());
		$('#cu-save-btn').on('click', () => this.save_customer());
		$('#cu-ids-add-row').on('click', () => this.add_id_row());
	}

	// ─────────────────────────────────────────────
	//  LOAD / CLEAR
	// ─────────────────────────────────────────────
	load_customer(name) {
		this._loading = true;
		frappe.call({
			method: 'frappe.client.get',
			args: { doctype: 'Customer', name: name },
			callback: (r) => {
				if (!r.message) {
					this._loading = false;
					return;
				}
				const doc = r.message;

				// Mark the record as loaded *before* pushing values into the
				// controls, otherwise the fields' own change handlers would fire
				// a second, redundant load for the same record.
				this._saved_doc = doc.name || name;
				this._saved_doc_data = doc;
				this._dirty = false;

				// Everything below only reflects stored data, so it must never be
				// treated as a user edit. The grace window absorbs the late
				// `change` events controls emit after set_value.
				this.with_silent_changes(() => {
					['customer_name', 'customer_type', 'customer_group', 'custom_vat_registration_number']
						.forEach((fieldname) => {
							const ctrl = this._controls[fieldname];
							if (ctrl) ctrl.set_value(doc[fieldname] || '');
						});

					$('#cu-type-badge').text(doc.customer_type || '');
					$('#cu-form-heading').text(doc.customer_name || doc.name || __('Customer'));

					this._id_rows = (doc.custom_additional_ids || []).map((row) => ({
						name: row.name,
						type_name: row.type_name || '',
						type_code: row.type_code || '',
						value: row.value || '',
					}));
					this.render_id_table();
				}, 300);

				// Keep the left list in sync with the record now shown on the right.
				this.set_active_list_item(this._saved_doc);

				// The loaded Customer becomes the active Working Context and is
				// propagated to every tab on the right.
				if (this.controller && this._saved_doc) {
					this.controller.set_working_context('customer', {
						customer: this._saved_doc,
					});
				}

				this._loading = false;
			},
			error: () => {
				this._loading = false;
			},
		});
	}

	clear_form_fields() {
		this._loading = true;
		this.with_silent_changes(() => {
			Object.keys(this._controls).forEach((fieldname) => {
				const ctrl = this._controls[fieldname];
				if (ctrl) ctrl.set_value('');
			});

			$('#cu-type-badge').text('');
			$('#cu-form-heading').text(__('New Customer'));

			this._id_rows = [];
			this.render_id_table();
		}, 300);
		this._saved_doc = '';
		this._saved_doc_data = null;
		this._dirty = false;
		this.set_active_list_item('');
		this._loading = false;
	}

	// ─────────────────────────────────────────────
	//  SAVE
	// ─────────────────────────────────────────────
	validate_required() {
		const checks = [
			['customer_name', __('Customer Name is required.')],
			['customer_type', __('Customer Type is required.')],
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
		// Start from the loaded document so untouched standard fields survive.
		const doc = this._saved_doc_data
			? JSON.parse(JSON.stringify(this._saved_doc_data))
			: { doctype: 'Customer' };

		doc.doctype = 'Customer';
		doc.name = this._saved_doc || undefined;

		['customer_name', 'customer_type', 'customer_group'].forEach((fieldname) => {
			doc[fieldname] = this.field_value(fieldname);
		});
		doc.custom_vat_registration_number = this.field_value('custom_vat_registration_number');

		// Drop fully blank rows so saving does not persist IDs that are empty.
		doc.custom_additional_ids = (this._id_rows || [])
			.filter((row) => row.type_name || row.value)
			.map((row, idx) => ({
				name: row.name || undefined,
				idx: idx + 1,
				parent: this._saved_doc || doc.name || undefined,
				parenttype: 'Customer',
				parentfield: 'custom_additional_ids',
				type_name: row.type_name || '',
				type_code: row.type_code || '',
				value: row.value || '',
			}));

		return doc;
	}

	save_customer() {
		if (!this.validate_required()) return;

		frappe.call({
			method: 'frappe.client.save',
			args: { doc: this.build_payload() },
			callback: (r) => {
				if (!r.message) return;
				const doc = r.message;

				this._saved_doc = doc.name;
				this._saved_doc_data = doc;
				this._dirty = false;

				this.with_silent_changes(() => {
					$('#cu-form-heading').text(doc.customer_name || doc.name);
					$('#cu-type-badge').text(doc.customer_type || '');

					this._id_rows = (doc.custom_additional_ids || []).map((row) => ({
						name: row.name,
						type_name: row.type_name || '',
						type_code: row.type_code || '',
						value: row.value || '',
					}));
					this.render_id_table();
				}, 300);

				// Pull the saved record into the left list and mark it active.
				this._active_list_item = doc.name;
				this.load_list();

				// A newly created Customer becomes the active Working Context
				// and overrides the context on every tab to the right.
				if (this.controller && doc.name) {
					this.controller.set_working_context('customer', {
						customer: doc.name,
					});
				}

				frappe.show_alert({ message: __('Saved successfully'), indicator: 'green' });
			},
			error: (r) => {
				frappe.msgprint({ title: __('Error'), message: r.message || __('Save failed.'), indicator: 'red' });
			},
		});
	}

	new_entry() {
		crm_customization.show_form_pane(this.$panel);
		this.clear_form_fields();
		if (this._controls['customer_name'] && this._controls['customer_name'].$input) {
			this._controls['customer_name'].$input.focus();
		}
	}
};