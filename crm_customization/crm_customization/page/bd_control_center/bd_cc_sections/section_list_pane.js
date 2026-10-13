// Copyright (c) 2026, Finbyz and contributors
// For license information, please see license.txt
//
// Shared master-list pane for BD Control Center sections.
//
// Sections that use it get a 20% left pane (search + refresh + selectable
// record list) and keep their existing form on the right 80% pane. The list is
// scoped by the working context through `list_filters()`, so picking a record
// on the left loads it into the form on the right.
//
// A section opts in by defining, in its own class:
//
//   list_prefix()          -> 'br'
//   list_title()           -> 'Business Requests'
//   list_search_hint()     -> 'Search request no, customer...'
//   list_doctype()         -> 'Business Request'
//   list_fields()          -> ['name', 'customer', ...]
//   list_filters()         -> [['subsidairy_company', '=', this._current_subsidiary]]
//   list_row_title(row)    -> row.name
//   list_row_meta(row)     -> [row.customer, row.status]
//   list_row_badge(row)    -> row.status            (optional)
//   list_match(row)        -> searchable haystack   (optional)
//   load_list_record(name) -> load this record into the form
//   new_list_record()      -> reset the form for a new record
//
// Then `render()` calls `this.list_pane_html()` for the left column and
// `this.mount_list_pane()` once the form controls exist.

frappe.provide('crm_customization');

/**
 * Blank-pane helpers. The right (form) pane of a section starts hidden —
 * marked with `.sc-pane-blank` — so only the left list shows. Revealing the
 * pane is driven by New Entry or a list selection.
 */
crm_customization.show_form_pane = function ($panel) {
	if ($panel && $panel.find) $panel.find('.sc-split-right').removeClass('sc-pane-blank');
};
crm_customization.hide_form_pane = function ($panel) {
	if ($panel && $panel.find) $panel.find('.sc-split-right').addClass('sc-pane-blank');
};

crm_customization.BDCCListPane = class {

	// ─────────────────────────────────────────────
	//  DEFAULTS — override the relevant ones per section
	// ─────────────────────────────────────────────
	list_prefix() { return ''; }
	list_title() { return __('Records'); }
	list_search_hint() { return __('Search...'); }
	list_doctype() { return ''; }
	list_fields() { return ['name', 'modified']; }
	list_order_by() { return 'modified desc'; }
	list_filters() { return []; }
	list_empty_message() { return __('No records yet.'); }
	list_row_title(row) { return row.name; }
	list_row_meta() { return []; }
	list_row_badge() { return ''; }
	list_match() { return ''; }
	load_list_record() {}
	new_list_record() {}

	/**
	 * Entry point for the right pane's "New Entry" button. Guards unsaved edits
	 * before resetting the form, since the left pane no longer offers this
	 * action and would otherwise be the only place the check happened.
	 */
	new_entry_with_guard(fn) {
		crm_customization.show_form_pane(this.$panel);
		const run = typeof fn === 'function' ? fn : () => this.new_list_record();
		const execute = () => {
			run();
			// After the reset, re-fill the context fields (Subsidiary Company /
			// Customer / Business Request) from the Working Context.
			if (this.controller && typeof this.controller.prefill_form_context === 'function') {
				this.controller.prefill_form_context(this);
			}
		};
		if (this.is_dirty()) {
			this.confirm_discard_changes(execute);
			return;
		}
		execute();
	}

	// ─────────────────────────────────────────────
	//  MARKUP
	// ─────────────────────────────────────────────

	/**
	 * Left-column markup for the 20/80 split. `id`s are namespaced with the
	 * section prefix so several sections can coexist on the page.
	 */
	list_pane_html() {
		const p = this.list_prefix();
		return `
			<aside class="sc-split-left">
				<div class="sc-list-head">
					<div class="sc-list-title">
						${frappe.utils.escape_html(this.list_title())}
						<span class="sc-list-count" id="${p}-list-count">0</span>
					</div>
					<div class="sc-list-scope" id="${p}-list-scope" style="display: none;">
						<span class="sc-list-scope-text"></span>
						<button type="button" class="sc-filter-clear" title="${__('Remove filter')}" aria-label="${__('Remove filter')}">&times;</button>
					</div>
					<div class="sc-list-tools">
						<input
							type="text"
							id="${p}-list-search"
							class="sc-list-search"
							placeholder="${frappe.utils.escape_html(this.list_search_hint())}"
							autocomplete="off"
						/>
						<button class="sc-list-refresh" id="${p}-list-refresh" title="${__('Refresh list')}">
							<span class="sc-list-refresh-icon">&#8635;</span>
						</button>
					</div>
				</div>
				<div class="sc-list-body" id="${p}-list-body">
					<div class="sc-list-empty">${__('Loading...')}</div>
				</div>
			</aside>
		`;
	}

	// ─────────────────────────────────────────────
	//  LIFECYCLE
	// ─────────────────────────────────────────────

	/**
	 * Wire the pane and load the first page. Call after the form controls are
	 * mounted so `list_filters()` can read the working context.
	 */
	mount_list_pane() {
		if (!this._list_data) this._list_data = [];
		if (this._list_request === undefined) this._list_request = 0;
		if (this._active_list_item === undefined) this._active_list_item = '';

		const p = this.list_prefix();

		$(`#${p}-list-search`).on('input', (e) => {
			this._list_query = $(e.currentTarget).val();
			this.render_list();
		});

		$(`#${p}-list-refresh`).on('click', () => this.load_list());

		$(`#${p}-list-scope`).on('click', '.sc-filter-clear', () => this.clear_list_scope());

		// no New Entry button here: the right pane's header owns that action,
		// so the left list stays a pure browse/search surface.

		this.load_list();
	}

	// ─────────────────────────────────────────────
	//  DATA
	// ─────────────────────────────────────────────
	load_list() {
		const p = this.list_prefix();
		const request_id = ++this._list_request;
		// remember the scope this request was issued for so that a later
		// context-change event for the same scope does not refetch again
		const raw_scope = JSON.stringify(this.list_filters() || []);
		this._applied_scope = raw_scope;

		// a cleared scope only lasts while the context is unchanged; once the
		// working context moves on, the filter is re-applied
		if (this._list_unscoped && raw_scope !== this._unscoped_scope) {
			this._list_unscoped = false;
		}

		$(`#${p}-list-refresh`).addClass('sc-spinning');
		this.update_list_scope_label();

		const show_message = (msg) => {
			if (request_id !== this._list_request) return;
			$(`#${p}-list-refresh`).removeClass('sc-spinning');
			this._list_data = [];
			this.render_list(msg);
		};

		const filters = this._list_unscoped ? [] : (this.list_filters() || []);
		const scoped = filters.length > 0;

		frappe.call({
			method: 'frappe.client.get_list',
			args: {
				doctype: this.list_doctype(),
				fields: this.list_fields(),
				filters: filters,
				order_by: this.list_order_by(),
				limit_page_length: 500,
			},
			callback: (r) => {
				if (request_id !== this._list_request) return;
				$(`#${p}-list-refresh`).removeClass('sc-spinning');
				this._list_data = r.message || [];
				this.render_list(scoped ? undefined : undefined);
			},
			error: () => {
				show_message(__('Could not load the list.'));
			},
		});
	}

	/**
	 * Reload the list when the working context the list is scoped by changes.
	 *
	 * Sections call this from their context handlers. Two guards keep it quiet:
	 * a repeat of the scope already loaded does not refetch, and a record being
	 * loaded (`_loading`) is left alone so loading a record never drops the row
	 * it just populated the form with.
	 */
	on_working_context_change() {
		if (this._loading) return;

		const scope = JSON.stringify(this.list_filters() || []);
		if (scope === this._applied_scope) return;

		this._applied_scope = scope;
		this.load_list();
	}

	/**
	 * Remove the scope filter: reload the list unscoped so it shows every
	 * record. Stays unscoped until the working context changes, which re-applies
	 * the filter (see `load_list`).
	 */
	clear_list_scope() {
		this._list_unscoped = true;
		this._unscoped_scope = JSON.stringify(this.list_filters() || []);
		this.update_list_scope_label();
		this.load_list();
	}

	update_list_scope_label() {
		const p = this.list_prefix();
		const $scope = $(`#${p}-list-scope`);
		if (!$scope.length) return;

		const parts = this.list_scope_parts ? this.list_scope_parts() : [];
		const labels = (parts || []).filter(Boolean);

		if (!labels.length || this._list_unscoped) {
			$scope.hide();
			return;
		}

		$scope.show().find('.sc-list-scope-text').html(
			__('Filtered by') + ': ' +
			labels.map((v) => `<strong>${frappe.utils.escape_html(v)}</strong>`).join(' · ')
		);
	}

	_filtered_list() {
		const q = (this._list_query || '').trim().toLowerCase();
		if (!q) return this._list_data;
		return this._list_data.filter((row) => {
			const hay = this.list_match(row);
			if (hay === null || hay === undefined) return false;
			return String(hay).toLowerCase().includes(q);
		});
	}

	render_list(empty_msg) {
		const p = this.list_prefix();
		const $body = $(`#${p}-list-body`);
		if (!$body.length) return;

		const rows = this._filtered_list();
		$(`#${p}-list-count`).text(rows.length);

		if (!rows.length) {
			$body.html(`<div class="sc-list-empty">${frappe.utils.escape_html(
				empty_msg
				|| (this._list_query ? __('No matching record.') : this.list_empty_message())
			)}</div>`);
			return;
		}

		const esc = (v) => frappe.utils.escape_html(v || '');
		const fmt_date = (v) => (frappe.datetime && frappe.datetime.str_to_user ? frappe.datetime.str_to_user(v) : (v || ''));

		$body.html(rows.map((row) => {
			const name = row.name || '';
			const active = name && name === this._active_list_item ? ' active' : '';
			const badge = this.list_row_badge(row);

			const meta = (this.list_row_meta(row) || [])
				.map((v) => (v && v.toString && v.toString().indexOf('-') === 4 && /^\d{4}-\d{2}-\d{2}/.test(v.toString()) ? fmt_date(v) : v))
				.filter(Boolean);

			return `
				<button type="button" class="sc-list-item${active}" data-name="${esc(name)}" title="${esc(name)}">
					<span class="sc-list-item-title">
						<span class="sc-list-item-name">${esc(this.list_row_title(row))}</span>
						${badge ? `<span class="sc-list-item-badge">${esc(badge)}</span>` : ''}
					</span>
					${meta.length ? `<span class="sc-list-item-meta">${esc(meta.join(' · '))}</span>` : ''}
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
		const p = this.list_prefix();
		const $body = $(`#${p}-list-body`);
		if (!$body.length) return;

		$body.find('.sc-list-item').removeClass('active');
		if (!this._active_list_item) return;

		const $active = $body.find('.sc-list-item').filter((_, el) => $(el).data('name') === this._active_list_item);
		$active.addClass('active');
		if (!$active.length) return;

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
			this.load_list_record(name);
		};

		if (this.is_dirty()) {
			this.confirm_discard_changes(proceed);
			return;
		}

		proceed();
	}

	// ─────────────────────────────────────────────
	//  VALUE COERCION
	// ─────────────────────────────────────────────
	/**
	 * Time fields arrive from the server as `datetime.timedelta`, which Frappe
	 * serialises with microseconds ("16:46:38.861504"). The Time control's
	 * validate() rejects that and raises "Time ... must be in format: HH:mm:ss",
	 * so truncate to whole seconds before handing the value to set_value.
	 */
	normalize_time_value(value) {
		if (value == null || value === '') return '';
		if (typeof value !== 'string') {
			// defensive: a timedelta-like object from a non-standard serializer
			if (typeof value.seconds === 'number') {
				const h = Math.floor(value.seconds / 3600);
				const m = Math.floor((value.seconds % 3600) / 60);
				const s = Math.floor(value.seconds % 60);
				return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
			}
			value = String(value);
		}
		const m = value.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})/);
		if (!m) return value;
		return `${String(m[1]).padStart(2, '0')}:${m[2]}:${m[3]}`;
	}

	/**
	 * Coerce a raw doc value for a field definition before set_value.
	 * Datetime fields have the same microsecond problem and are truncated to
	 * their date/time portion.
	 */
	normalize_datetime_value(value) {
		if (value == null || value === '') return '';
		const v = String(value).replace('T', ' ');
		const m = v.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})/);
		return m ? `${m[1]} ${m[2]}` : v;
	}

	normalize_field_value(def, value) {
		if (def.type === 'Time') return this.normalize_time_value(value);
		if (def.type === 'Datetime') return this.normalize_datetime_value(value);
		return value;
	}

	/**
	 * Push a doc's values into the mounted controls, coercing by field type.
	 * Subclasses should use this instead of calling set_value directly so that
	 * Time/Datetime coercion applies everywhere.
	 */
	populate_from_doc(doc, field_defs) {
		(field_defs || this.field_definitions()).forEach((def) => {
			const ctrl = this._controls[def.fieldname];
			if (!ctrl) return;
			const raw = doc[def.fieldname] || '';
			// sections override this to inject their own fallback (e.g. company)
			const fallback = typeof this.doc_field_fallback === 'function'
				? this.doc_field_fallback(def, raw)
				: null;
			const val = fallback != null ? fallback : this.normalize_field_value(def, raw);
			try {
				ctrl.set_value(val);
			} catch (e) {}
		});
	}

	/**
	 * Same as populate_from_doc but for sections that keep an explicit list of
	 * fields instead of a field_definitions() table. Coerces by looking the
	 * field type up from field_definitions() where available.
	 */
	populate_fields_from_doc(doc, fieldnames) {
		const types = {};
		(this.field_definitions ? this.field_definitions() : []).forEach((d) => {
			types[d.fieldname] = d.type;
		});
		this.populate_from_doc(doc, fieldnames.map((fieldname) => ({
			fieldname,
			type: types[fieldname] || null,
		})));
	}

	// ─────────────────────────────────────────────
	//  DIRTY STATE / CONFIRMATION
	// ─────────────────────────────────────────────
	/**
	 * Serialise every editable control in the right pane. This is the single
	 * source of truth for "has the user changed anything", deliberately NOT
	 * based on change/input events: a freshly mounted form fires `change` for
	 * every prefilled default, which made untouched New forms look dirty.
	 */
	form_values_snapshot() {
		const snap = {};
		this.$panel
			.find('.sc-split-right input, .sc-split-right select, .sc-split-right textarea')
			.each(function () {
				const key = this.name || this.id;
				if (!key) return;
				if (this.type === 'checkbox' || this.type === 'radio') {
					snap[key] = this.checked ? '1' : '0';
				} else {
					snap[key] = this.value == null ? '' : String(this.value);
				}
			});
		return JSON.stringify(snap);
	}

	/**
	 * Record the current form values as the clean baseline. Deferred by
	 * `delay_ms` because Frappe controls apply `set_value` to the DOM after
	 * the calling code returns; snapshotting synchronously would capture a
	 * half-populated form and report a phantom diff.
	 */
	capture_dirty_baseline(delay_ms) {
		this._dirty = false;
		this._user_edited = false;
		clearTimeout(this._baseline_timer);

		if (delay_ms === undefined) {
			this._baseline = this.form_values_snapshot();
			return;
		}

		// Frappe populates controls asynchronously — a date picker or link can
		// land a fair way after `set_value` — so poll until the form stops
		// changing rather than taking a single delayed read, which can capture a
		// half-filled form and make every later edit look like a revert. Once
		// settled, a `_dirty` flag raised purely by those late async `change`
		// events is phantom, so clear it when nothing really differs.
		const started = Date.now();
		const min_ms = 150;
		let last = null;
		let stable_reads = 0;

		const settle = () => {
			clearTimeout(this._baseline_timer);
			this._baseline_timer = setTimeout(() => {
				if (this._user_edited) return;
				const snap = this.form_values_snapshot();
				stable_reads = snap === last ? stable_reads + 1 : 0;
				last = snap;
				if (stable_reads < 1 || Date.now() - started < min_ms) {
					settle();
					return;
				}
				this._baseline = snap;
				if (this._dirty && this.form_values_snapshot() === snap) this._dirty = false;
			}, 60);
		};
		settle();
	}

	/**
	 * `set_value` writes to the DOM without dispatching `input`, while real
	 * typing and clicks do. This flag is therefore a reliable "the user has
	 * started editing" signal, used to stop the deferred baseline capture
	 * from overwriting in-progress edits.
	 */
	bind_user_edit_signal() {
		this.$panel.on('input.bdcc-edit',
			'.sc-split-right input, .sc-split-right select, .sc-split-right textarea', () => {
			if (this._loading || this._silent) return;
			this._user_edited = true;
		});

		// Mark the form dirty on the gestures that only a user can make.
		// Programmatic `set_value` writes the DOM directly (`.val()`) and never
		// dispatches `change`, so merely loading a record can't trip this. It
		// catches typed-and-blurred text, selects, checkboxes, date/time picks
		// and Link/autocomplete selections. `input` is deliberately excluded:
		// Frappe fires it when an empty Link field is merely focused.
		const selector = '.sc-split-right input, .sc-split-right select, .sc-split-right textarea';
		this.$panel.on('change.bdcc-dirty', selector, () => this.mark_dirty());
		this.$panel.on('awesomplete-selectcomplete.bdcc-dirty',
			'.sc-split-right input', () => this.mark_dirty());
	}

	is_dirty() {
		// explicit marks (tag rows, child tables) that have no input control
		if (this._dirty) return true;
		if (this._baseline == null) return false;
		return this.form_values_snapshot() !== this._baseline;
	}

	mark_dirty() {
		if (this._loading || this._silent) return;
		this._dirty = true;
	}

	/**
	 * Run `fn` without its value changes marking the form dirty. Frappe controls
	 * emit `change` asynchronously after `set_value`, so the guard is held for
	 * `grace_ms` afterwards to swallow those late events.
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
					options: '<p>' + __('This record has unsaved changes. Discard them and continue?') + '</p>',
				},
			],
			primary_action_label: __('Discard Changes'),
			primary_action: () => {
				d.hide();
				this._dirty = false;
				on_confirm();
			},
			secondary_action_label: __('Keep Editing'),
			secondary_action: () => d.hide(),
		});
		d.show();
	}

	/**
	 * Throw away unsaved edits by restoring the last saved state. Record
	 * switching reloads a fresh record anyway, but leaving a tab would keep
	 * the edited form mounted, so it must be reverted explicitly.
	 */
	reset_after_discard() {
		if (this._saved_doc) {
			this.load_list_record(this._saved_doc);
			return;
		}
		this._loading = true;
		try {
			if (typeof this.new_list_record === 'function') this.new_list_record();
		} finally {
			this._loading = false;
		}
		this.capture_dirty_baseline(250);
	}
};