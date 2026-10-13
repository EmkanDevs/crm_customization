// Copyright (c) 2026, Finbyz and contributors
// For license information, please see license.txt
// Business Request section for the BD Control Center page.

frappe.provide('crm_customization');

crm_customization.BDCCBusinessRequest = class extends crm_customization.BDCCListPane {
constructor(controller, $panel) {
super(controller, $panel);
this.controller = controller;
this.page = controller.page;
this.$panel = $panel;

this._current_subsidiary = '';
this._current_customer = '';
// Set only by the global bar's Business Request filter (row clicks in this
// tab never reach it — the controller skips the source tab). When set, the
// left list shows only that request; the scope pill's × clears it.
this._current_business_request = '';
this._saved_doc = '';
this._saved_doc_data = null;
this._doc_status = 0;
this._controls = {};
this._users_value = [];

this._list_data = [];
this._list_query = '';
this._active_list_item = '';
this._list_request = 0;
this._loading = false;
this._silent = 0;
this._dirty = false;
this._baseline = null;
this._user_edited = false;
this._btn_update_timer = null;
}

render() {
this.add_styles();
this.$panel.html(`
<div id="br-tab-root">
<div class="sc-split">

${this.list_pane_html()}

<section class="sc-split-right">

<!-- Header action buttons -->
<div class="sc-header-btns">
<button class="sc-btn sc-btn-outline" id="br-open-doctype">Open Original DocType</button>
<button class="sc-btn sc-btn-outline" id="br-new-entry">New Entry</button>
<button class="sc-btn sc-btn-outline" id="br-next-btn">Next</button>
<button class="sc-btn sc-btn-primary" id="br-save-btn">Save</button>
</div>

<!-- Business Request Form -->
<div class="sc-form-section">
<div class="sc-form-section-header">
<h2>New Business Request</h2>
<span class="br-save-badge" id="br-save-badge">Not Saved</span>
</div>

<!-- Checkboxes row -->
<div class="br-check-row">
<div class="br-check-col" id="br-field-registration"></div>
<div class="br-check-col" id="br-field-prequalification"></div>
</div>

<!-- Main form grid -->
<div class="br-grid">
<!-- Row 1 -->
<div class="br-field-wrap" id="br-field-reference_request_no"></div>
<div class="br-field-wrap" id="br-field-request_date"></div>

<!-- Row 2 -->
<div class="br-field-wrap" id="br-field-bd_tasks"></div>
<div class="br-field-wrap" id="br-field-request_category"></div>

<!-- Row 3 -->
<div class="br-field-wrap" id="br-field-customer"></div>
<div class="br-field-wrap" id="br-field-requested_by"></div>

<!-- Row 4 -->
<div class="br-field-wrap" id="br-field-subsidairy_company"></div>
<div class="br-field-wrap" id="br-field-member_full_name"></div>

<!-- Row 5 & 6 : Sector & Request Type left | Business Justification right (spans 2 rows) -->
<div class="br-field-wrap" id="br-field-custom_sector"></div>
<div class="br-field-wrap br-span-2" id="br-field-description"></div>

<div class="br-field-wrap" id="br-field-custom_request_type"></div>

<!-- Row 7: Priority left | Users right -->
<div class="br-field-wrap" id="br-field-custom__priority"></div>
<div class="br-field-wrap" id="br-field-users"></div>

<!-- Row 8: Target Date left | Status right -->
<div class="br-field-wrap" id="br-field-custom_required_by"></div>
<div class="br-field-wrap" id="br-field-status"></div>

<!-- Row 9: Plan Start Date left -->
<div class="br-field-wrap" id="br-field-planned_date"></div>
<div class="br-field-wrap"></div>
</div>
</div>

</section>
</div>
</div>
`);

this.mount_controls();
this.wire_br_buttons();
this.bind_user_edit_signal();
this.mount_list_pane();
}

// ─────────────────────────────────────────────
//  LEFT PANE CONFIG — Business Requests
// ─────────────────────────────────────────────
list_prefix() { return 'br'; }
list_title() { return __('Business Requests'); }
list_search_hint() { return __('Search request no, customer...'); }
list_doctype() { return 'Business Request'; }
list_fields() { return ['name', 'customer', 'subsidairy_company', 'request_category', 'status', 'modified']; }
list_empty_message() { return __('No Business Request yet.'); }

list_filters() {
const filters = [];
if (this._current_business_request) filters.push(['name', '=', this._current_business_request]);
if (this._current_subsidiary) filters.push(['subsidairy_company', '=', this._current_subsidiary]);
if (this._current_customer) filters.push(['customer', '=', this._current_customer]);
return filters;
}

list_scope_parts() {
const parts = [];
if (this._current_business_request) parts.push(this._current_business_request);
if (this._current_subsidiary) parts.push(this._current_subsidiary);
if (this._current_customer) parts.push(this._current_customer);
return parts;
}

list_row_title(row) { return row.name; }
list_row_badge(row) { return row.status || ''; }
list_row_meta(row) { return [row.customer, row.request_category].filter(Boolean); }
list_match(row) {
return [row.name, row.customer, row.subsidairy_company, row.request_category, row.status]
.filter(Boolean).join(' ');
}

load_list_record(name) { this.load_business_request(name); }
	new_list_record() { this.new_business_request_entry(); }

	/**
	 * Called by each section's record loader once the form is populated, so the
	 * shared pane can clear its dirty flag and highlight the row. `_loading` is
	 * released here rather than in the loader so late `change` events from
	 * `set_value` cannot mark a freshly loaded record dirty.
	 */
	after_record_loaded() {
		this._loading = false;
		this.capture_dirty_baseline(250);
		this.set_active_list_item(this._saved_doc);
		this.set_action_btn_state();
	}

/**
* Mark the form dirty whenever a control the section owns changes. The left
* pane's own search box and buttons live outside `.sc-split-right`, so they are
* excluded by the selector.
*/

add_styles() {
if (document.getElementById('bd-cc-business-request-styles')) return;

const style = document.createElement('style');
style.id = 'bd-cc-business-request-styles';
style.innerHTML = `
/* ── Business Request section ── */

/* Save badge */
.br-save-badge {
font-size: 11px; font-weight: 500; padding: 2px 8px;
border-radius: 10px; border: 1px solid #d1d5db;
background: #f9fafb; color: #6b7280;
}

/* Checkbox row */
.br-check-row {
display: grid; grid-template-columns: 1fr 1fr;
gap: 0 28px; margin-bottom: 12px;
}
.br-check-col .frappe-control { margin-bottom: 0 !important; }
.br-check-col .frappe-control .form-group { margin-bottom: 0 !important; }
.br-check-col .frappe-control .checkbox { margin: 0; }
.br-check-col .frappe-control .checkbox label {
font-size: 12.5px; font-weight: 500; color: #374151;
}

/* Main form grid - 2 columns */
.br-grid {
display: grid;
grid-template-columns: 1fr 1fr;
gap: 10px 28px;
grid-auto-rows: auto;
}

/* Business Justification textarea spans 2 rows on the right column */
.br-col2 { grid-column: 2; }
.br-span-2 { grid-row: span 2; }

/* Field wrapper */
.br-field-wrap { display: flex; flex-direction: column; gap: 2px; }
.br-field-wrap .frappe-control { margin-bottom: 0 !important; }
.br-field-wrap .frappe-control .form-group { margin-bottom: 0 !important; }
.br-field-wrap .frappe-control .control-label {
font-size: 13px !important; font-weight: 600 !important; color: #374151 !important;
}
/* Business Justification textarea fill the spanned height */
.br-span-2 .frappe-control,
.br-span-2 .frappe-control .form-group { height: 100% !important; }
.br-span-2 .frappe-control .form-control { resize: none; min-height: 120px; }

/* Users multi-select */
.br-users-wrap { display: flex; flex-direction: column; gap: 2px; }
.br-users-label { font-size: 13px; font-weight: 600; color: #374151; }
.br-users-input-box {
border: 1px solid #d1d5db; border-radius: 4px;
padding: 4px 8px; min-height: 32px; background: #fff;
display: flex; flex-wrap: wrap; gap: 4px; align-items: center;
cursor: text;
}
.br-users-input-box input {
border: none; outline: none; flex: 1; min-width: 140px;
font-size: 12.5px; color: #374151; background: transparent; padding: 0;
}
.br-users-input-box input::placeholder { color: #9ca3af; }
.br-user-tag {
display: inline-flex; align-items: center; gap: 4px;
background: #eff6ff; border: 1px solid #bfdbfe;
border-radius: 4px; padding: 1px 6px; font-size: 11.5px;
color: #1d4ed8; font-weight: 500;
}
.br-user-tag-remove { cursor: pointer; color: #6b7280; font-size: 12px; line-height: 1; }
.br-user-tag-remove:hover { color: #dc2626; }
.br-users-dropdown {
position: absolute; z-index: 1000; background: #fff;
border: 1px solid #d1d5db; border-radius: 6px;
box-shadow: 0 4px 16px rgba(0,0,0,0.1); min-width: 240px;
max-height: 200px; overflow-y: auto;
top: calc(100% + 6px); left: 0;
}
.br-users-dropdown-item {
padding: 7px 12px; font-size: 12.5px; color: #374151;
cursor: pointer; display: flex; align-items: center; gap: 8px;
}
.br-users-dropdown-item:hover { background: #eff6ff; color: #1d4ed8; }
.br-users-dropdown-item.already-added { color: #9ca3af; cursor: default; }
`;
document.head.appendChild(style);
}

field_definitions() {
return [
{ fieldname: 'registration',         label: 'Registration (Vendor registration is the formal process of enrolling as a supplier)', type: 'Check', default: 0 },
{ fieldname: 'prequalification',     label: 'Prequalification (Prequalification is a, often, mandatory, pre-tender)', type: 'Check', default: 0 },
{ fieldname: 'reference_request_no', label: 'Reference Request No',  type: 'Data' },
{ fieldname: 'request_date',          label: 'Request Date',           type: 'Date' },
{ fieldname: 'bd_tasks',              label: 'BD Tasks',               type: 'Data' },
{ fieldname: 'request_category',      label: 'Request Category ',     type: 'Link', options: 'BD Request Category', reqd: true },
	{ fieldname: 'requested_by',           label: 'Requested By',           type: 'Data', read_only: true },
	{ fieldname: 'member_full_name',       label: 'Requester Full Name',    type: 'Data', read_only: true },
{ fieldname: 'customer',              label: 'Client/Customer',         type: 'Link', options: 'Customer' },
{ fieldname: 'description',           label: 'Business Justification',  type: 'Small Text' },
{ fieldname: 'subsidairy_company',    label: 'Subsidiary Company ',    type: 'Link', options: 'Subsidairy Company', reqd: true },
{ fieldname: 'custom_sector',         label: 'Sector',                  type: 'Link', options: 'Sector' },
{ fieldname: 'custom_request_type',   label: 'Request Type',            type: 'Link', options: 'Request Type' },
{ fieldname: 'custom__priority',      label: 'Priority',                type: 'Link', options: 'Issue Priority' },
{ fieldname: 'custom_required_by',    label: 'Target Date',             type: 'Date' },
{ fieldname: 'status',                label: 'Status',                  type: 'Select', options: ['', 'New', 'Planned', 'On-Going', 'Cancel', 'Completed'] },
{ fieldname: 'planned_date',          label: 'Plan Start Date',         type: 'Date' },
];
}

mount_controls() {
this._ctrl_subsidiary = crm_customization.make_link_control(
'br-subsidiary-control', 'Subsidairy Company', 'Subsidiary Company (primary)',
(val) => this.on_subsidiary_change(val)
);
this._ctrl_customer = crm_customization.make_link_control(
'br-customer-control', 'Customer', 'Client/Customer (optional)',
(val) => this.on_customer_change(val)
);

this.field_definitions().forEach(def => {
const container = document.getElementById('br-field-' + def.fieldname);
if (!container) return;
const ctrl = frappe.ui.form.make_control({
df: {
fieldtype: def.type,
fieldname: 'br_' + def.fieldname,
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

this.bind_form_to_context(this._controls['subsidairy_company'], 'subsidairy_company');
this.bind_form_to_context(this._controls['customer'], 'customer');

if (this._controls.request_date) {
this._controls.request_date.set_value(frappe.datetime.get_today());
}

this.populate_requester_fields();

this.mount_users_control();
}

// ─────────────────────────────────────────────
//  REQUESTED BY / REQUESTER FULL NAME
// ─────────────────────────────────────────────
populate_requester_fields() {
const user = frappe.session.user;
if (this._controls['requested_by']) {
this._controls['requested_by'].set_value(user);
}
frappe.db.get_value('User', user, 'full_name', (r) => {
const fn = (r && r.full_name) || '';
if (this._controls['member_full_name']) {
this._controls['member_full_name'].set_value(fn);
}
});
}

// ─────────────────────────────────────────────
//  CUSTOM USERS MULTI-SELECT
// ─────────────────────────────────────────────
mount_users_control() {
const container = document.getElementById('br-field-users');
if (!container) return;

container.innerHTML = `
<div class="br-users-wrap" style="position:relative;">
<div class="br-users-label">Users</div>
<div class="br-users-input-box" id="br-users-box">
<input type="text" id="br-users-search" placeholder="Type emails, comma separated" autocomplete="off">
</div>
<div class="br-users-dropdown" id="br-users-dropdown" style="display:none;"></div>
</div>
`;

const $box      = $('#br-users-box');
const $input    = $('#br-users-search');
const $dropdown = $('#br-users-dropdown');

$box.on('click', () => $input.focus());

let _search_timer = null;
$input.on('focus', () => {
if ($dropdown.is(':visible')) return;
_search_timer = setTimeout(() => this.search_users($input.val().trim(), $dropdown, $input), 60);
});
$input.on('input', () => {
clearTimeout(_search_timer);
const q = $input.val().trim();
_search_timer = setTimeout(() => this.search_users(q, $dropdown, $input), 250);
});

$input.on('keydown', (e) => {
if (e.key === ',' || e.key === 'Enter') {
e.preventDefault();
const val = $input.val().replace(',', '').trim();
if (val) this.add_user_tag(val);
$input.val('');
$dropdown.hide();
} else if (e.key === 'Backspace' && !$input.val()) {
if (this._users_value.length) {
this._users_value.pop();
this.render_user_tags();
this.mark_dirty();
}
}
});

$(document).off('mousedown.br-users').on('mousedown.br-users', (e) => {
if (!$(e.target).closest('#br-users-box, #br-users-dropdown').length) {
$dropdown.hide();
}
});
}

search_users(q, $dropdown, $input) {
const filters = [['enabled', '=', 1]];
if (q) filters.push(['name', 'like', '%' + q + '%']);
frappe.call({
method: 'frappe.client.get_list',
args: {
doctype: 'User',
filters: filters,
fields: ['name', 'full_name'],
limit: 10,
},
callback: (r) => {
if (!r.message || !r.message.length) { $dropdown.hide(); return; }
$dropdown.empty();
r.message.forEach(user => {
const already = this._users_value.some(u => u.users === user.name);
const $item = $('<div>')
.addClass('br-users-dropdown-item' + (already ? ' already-added' : ''))
.attr('data-user', user.name)
.html(
'<span>&#128100;</span>' +
'<span>' + frappe.utils.escape_html(user.full_name || user.name) + '</span>' +
'<span style="color:#9ca3af;font-size:11px;margin-left:4px;">' + frappe.utils.escape_html(user.name) + '</span>'
);
if (!already) {
$item.on('mousedown', (e) => {
e.preventDefault();
this.add_user_tag(user.name);
$input.val('');
$dropdown.hide();
});
}
$dropdown.append($item);
});
$dropdown.show();
},
});
}

add_user_tag(user_email) {
if (!user_email) return;
if (this._users_value.some(u => u.users === user_email)) return;
this._users_value.push({ users: user_email });
this.render_user_tags();
// tags have no input control, so the value snapshot cannot see them
this.mark_dirty();
}

render_user_tags() {
$('#br-users-box .br-user-tag').remove();
this._users_value.forEach((u, idx) => {
const $tag = $('<span>')
.addClass('br-user-tag')
.html(
frappe.utils.escape_html(u.users) +
'<span class="br-user-tag-remove" data-idx="' + idx + '">&times;</span>'
);
$tag.find('.br-user-tag-remove').on('click', () => {
this._users_value.splice(idx, 1);
this.render_user_tags();
this.mark_dirty();
});
$('#br-users-box').prepend($tag);
});
}

get_users_value() {
return this._users_value.map(u => ({ doctype: 'Select Users', users: u.users }));
}

set_users_value(users_array) {
this._users_value = (users_array || []).map(u => ({ users: u.users || u }));
this.render_user_tags();
}

// ─────────────────────────────────────────────
//  CONTEXT HANDLERS
// ─────────────────────────────────────────────
on_subsidiary_change(val, opts) {
this._current_subsidiary = val;
this.on_working_context_change();
const field = this._controls['subsidairy_company'];
if (field && (field.get_value() || '') !== (val || '')) {
try { field.set_value(val || ''); } catch(e) {}
}
this.update_context_desc();
// Scenario 2: the Business Request tab is the source of the
// Working Context (Subsidiary Company + Customer). Distribute
// to every tab on the right, but not when we are only
// reflecting a value that already came from the left.
if (!opts || !opts.propagated) {
if (this.controller) {
this.controller.set_working_context('business_request', { subsidiary: val });
}
}
}

on_customer_change(val, opts) {
this._current_customer = val;
this.on_working_context_change();
const field = this._controls['customer'];
if (field && (field.get_value() || '') !== (val || '')) {
try { field.set_value(val || ''); } catch(e) {}
}
this.update_context_desc();
if (!opts || !opts.propagated) {
if (this.controller) {
this.controller.set_working_context('business_request', { customer: val });
}
}
}

// The global bar's Business Request filter changed: re-scope the left list.
// This value is never pushed back — the global bar is its only source here.
on_business_request_change(val) {
this._current_business_request = val || '';
this.on_working_context_change();
}

bind_form_to_context(ctrl, fieldname) {
if (!ctrl || !ctrl.$input || !ctrl.$input.length) return;
const push = () => {
const val = ctrl.get_value() || '';
if (fieldname === 'subsidairy_company' || fieldname === 'customer') {
const wc_key = fieldname === 'subsidairy_company' ? 'subsidiary' : 'customer';
const synced = this.controller && this.controller._wc
&& String(this.controller._wc[wc_key] || '') === String(val);
this[fieldname === 'subsidairy_company' ? '_current_subsidiary' : '_current_customer'] = val;
if (this._ctrl_subsidiary && (this._ctrl_subsidiary.get_value() || '') !== val) {
this._ctrl_subsidiary.set_value(val);
}
if (this._ctrl_customer && (this._ctrl_customer.get_value() || '') !== val) {
this._ctrl_customer.set_value(val);
}
// Only re-assert the source when the value actually changed. When the
// global bar or a left tab already set it, this is just a mirror.
if (this.controller && !synced) {
this.controller.set_working_context('business_request', { [wc_key]: val });
}
}
this.update_context_desc();
};
ctrl.$input.on('change', () => setTimeout(push, 100));
ctrl.$input.on('awesomplete-selectcomplete', () => setTimeout(push, 150));
}

update_context_desc() {
const sub  = this._current_subsidiary || '';
const cust = this._current_customer   || '';
let desc = 'Select a Subsidiary Company to begin';
if (sub && cust) {
desc = 'Creating business requests for <strong>' + sub + '</strong> / <strong>' + cust + '</strong>';
} else if (sub) {
desc = 'Creating business requests for <strong>' + sub + '</strong>';
}
$('#br-context-desc').html(desc);
}

/**
 * An existing Business Request is immutable on every field except
 * `Status`, `Users`, `Request Date` and `Target Date`. Opening a saved record locks the
 * rest of the form; a New Entry restores the definition-level read-only.
 */
set_record_editability() {
	const editable_existing = ['status', 'request_date', 'custom_required_by'];
	const is_existing = Boolean(this._saved_doc);
	const defs = {};
	(this.field_definitions() || []).forEach((d) => { defs[d.fieldname] = d; });
	Object.keys(this._controls).forEach((fieldname) => {
		const ctrl = this._controls[fieldname];
		if (!ctrl) return;
		const def = defs[fieldname] || {};
		let read_only = def.read_only ? 1 : 0;
		if (is_existing && editable_existing.indexOf(fieldname) === -1) read_only = 1;
		if (ctrl.df) ctrl.df.read_only = read_only;
		try { ctrl.refresh(); } catch (e) {}
	});
}

/**
 * Freeze the current form values as the clean baseline the button compares
 * against. Frappe populates controls asynchronously (date pickers, links and
 * select refresh all land a tick or more after `set_value`), so a single
 * delayed read can capture a half-filled form. Re-read until two consecutive
 * snapshots agree and treat that as the baseline.
 *
 * Settling rather than arming one abortable timer is what makes this reliable:
 * `set_value` fires an async `change` for every control it populates, and under
 * the old one-shot capture that stray event cancelled the baseline for good,
 * leaving `is_dirty()` permanently false so Status and Request Date could never
 * raise the Update button.
 */
capture_dirty_baseline(delay_ms) {
	this._dirty = false;
	this._user_edited = false;
	clearTimeout(this._baseline_timer);
	clearTimeout(this._btn_baseline_timer);

	if (delay_ms === undefined) {
		this._baseline_pending = false;
		this._baseline = this.form_values_snapshot();
		return;
	}

	// Frappe populates controls asynchronously — a date picker or link can land
	// a fair way after `set_value` — so poll until the form stops changing and
	// at least `min_ms` has passed. A single delayed read is not enough: it can
	// capture a half-filled form and make every later edit look like a revert.
	this._baseline_pending = true;
	const started = Date.now();
	const min_ms = 150;
	let last = null;
	let stable_reads = 0;

	const settle = () => {
		clearTimeout(this._baseline_timer);
		this._baseline_timer = setTimeout(() => {
			const snap = this.form_values_snapshot();
			stable_reads = snap === last ? stable_reads + 1 : 0;
			last = snap;
			if (stable_reads < 1 || Date.now() - started < min_ms) {
				settle();
				return;
			}
			this._baseline = snap;
			this._baseline_pending = false;
			// a dirty flag raised before the form settled was phantom (a late
			// `set_value` event), otherwise the button would strand on Update
			if (this._dirty && this.form_values_snapshot() === snap) this._dirty = false;
			this.set_action_btn_state();
		}, 50);
	};
	settle();
}

/**
 * The action button must flip to "Update" as soon as the user edits any of
 * the editable fields. Deferred a few ms so programmatic `set_value` during
 * a load/save cannot race a real keystroke.
 */
refresh_action_btn_later(delay_ms) {
	clearTimeout(this._btn_update_timer);
	const delay = delay_ms === undefined ? 60 : delay_ms;
	this._btn_update_timer = setTimeout(() => this.set_action_btn_state(), delay);
}

/**
 * Track user edits on the right pane (excluding the context selectors) and
 * keep the action button in sync.
 *
 * `input` is the typing signal and is only ever raised by the user. `change`
 * also covers the date picker and the dropdowns, which write the value
 * programmatically and never fire `input` — but it must NOT set
 * `_user_edited`, because Frappe emits it for every control it populates on
 * load, and that is what used to cancel the baseline capture outright.
 *
 * Neither handler latches `_dirty`: every one of these fields has a DOM
 * control, so `is_dirty()` already compares it against the baseline. Latching
 * would strand the button on "Update" after a field was changed and put back.
 * `_dirty` is reserved for the users tags, which have no input control.
 */
bind_user_edit_signal() {
	const selector = '.sc-split-right input, .sc-split-right select, .sc-split-right textarea';
	const is_ours = (e) => !$(e.currentTarget).closest('.sc-context-selectors').length
		&& !this._loading && !this._silent;

	this.$panel.on('input.bdcc-edit', selector, (e) => {
		if (!is_ours(e)) return;
		this._user_edited = true;
		this.refresh_action_btn_later();
	});

	this.$panel.on('change.bdcc-edit', selector, (e) => {
		if (!is_ours(e)) return;
		this.refresh_action_btn_later();
	});
}

mark_dirty() {
	super.mark_dirty();
	this.refresh_action_btn_later(0);
}

// ─────────────────────────────────────────────
//  BUTTON WIRING
// ─────────────────────────────────────────────
wire_br_buttons() {
$('#br-open-doctype').on('click', () => {
frappe.set_route('List', 'Business Request');
});
$('#br-new-entry').on('click', () => this.new_entry_with_guard(() => this.new_business_request_entry()));
$('#br-next-btn').on('click', () => this.controller.go_next_tab());
$('#br-save-btn').on('click', () => this.on_action_btn());

$('#br-clear-context').on('click', () => {
if (this._ctrl_subsidiary) this._ctrl_subsidiary.set_value('');
if (this._ctrl_customer)   this._ctrl_customer.set_value('');
this._current_subsidiary = '';
this._current_customer   = '';
this.update_context_desc();
});
}

field_value(fieldname) {
const val = this._controls[fieldname] ? this._controls[fieldname].get_value() : '';
return (val === null || val === undefined) ? '' : val;
}

// ─────────────────────────────────────────────
//  SAVE / SUBMIT / NEW / NEXT
// ─────────────────────────────────────────────
validate_required() {
	if (!this.field_value('subsidairy_company')) {
		frappe.msgprint({ title: __('Validation'), message: __('Subsidairy Company is required.'), indicator: 'red' });
		return false;
	}
	if (!this.field_value('request_category')) {
		frappe.msgprint({ title: __('Validation'), message: __('Request Category is required.'), indicator: 'red' });
		return false;
	}
	return true;
}

build_doc_payload() {
	const doc = this._saved_doc_data
		? JSON.parse(JSON.stringify(this._saved_doc_data))
		: { doctype: 'Business Request' };
	doc.doctype = 'Business Request';
	doc.name = this._saved_doc || undefined;
	doc.subsidairy_company = this.field_value('subsidairy_company');
	doc.request_category = this.field_value('request_category');
	doc.contact_person = this.field_value('requested_by');
	doc.member_full_name = this.field_value('member_full_name');
	doc.registration = this.field_value('registration') ? 1 : 0;
	doc.prequalification = this.field_value('prequalification') ? 1 : 0;
	doc.reference_request_no = this.field_value('reference_request_no');
	doc.bd_tasks = this.field_value('bd_tasks');
	doc.custom_sector = this.field_value('custom_sector');
	doc.custom_request_type = this.field_value('custom_request_type');
	doc.custom__priority = this.field_value('custom__priority');
	doc.custom_required_by = this.field_value('custom_required_by');
	doc.status = this.field_value('status');
	doc.planned_date = this.field_value('planned_date');
	doc.customer = this.field_value('customer');
	doc.request_date = this.field_value('request_date');
	doc.description = this.field_value('description');
	doc.users = this.get_users_value();
	return doc;
}

/**
 * For an existing record the editable surface is narrow: Status, Request Date,
 * Target Date and Users. Comparing against the server-returned `_saved_doc_data` is far
 * more reliable than DOM-snapshot diffing.
 *
 * The snapshot-based baseline can be captured *after* the user already edited a
 * field if the edit happened inside the settle window (~150 ms after load).
 * When that happens, `is_dirty()` compares the changed value against itself and
 * reports "clean", so the Update button never appears — even for a single field
 * change. Bypassing the baseline entirely for the known editable fields fixes
 * that permanently.
 *
 * `_dirty` is still the signal for the Users multi-select, which has no input
 * control and therefore cannot be caught by DOM diffing.
 *
 * For new records fall through to the snapshot-based `super.is_dirty()`.
 */
is_dirty() {
	if (this._saved_doc && this._saved_doc_data) {
		if (this._dirty) return true;
		const saved = this._saved_doc_data;
		if ((this.field_value('status')             || '') !== (saved.status             || '')) return true;
		if ((this.field_value('request_date')       || '') !== (saved.request_date       || '')) return true;
		if ((this.field_value('custom_required_by') || '') !== (saved.custom_required_by || '')) return true;
		return false;
	}
	return super.is_dirty();
}

set_action_btn_state() {
	// No baseline and none being captured: freeze one now, otherwise is_dirty()
	// would answer "clean" for every edit and the button would never move off
	// its saved-record label. Skipped while a deferred capture is in flight,
	// since snapshotting mid-populate would freeze a half-filled form as clean.
	if (this._saved_doc && this._baseline == null
		&& !this._baseline_pending && !this._capturing_baseline) {
		this._capturing_baseline = true;
		try { this.capture_dirty_baseline(); } finally { this._capturing_baseline = false; }
	}

	const $btn = $('#br-save-btn');
	if (!this._saved_doc) {
		$btn.text('Save').prop('disabled', false).css('opacity', 1);
		return;
	}
	if (this.is_dirty()) {
		$btn.text('Update').prop('disabled', false).css('opacity', 1);
		return;
	}
	if (this._doc_status === 1) {
		$btn.text('Submitted').prop('disabled', true).css('opacity', 0.6);
	} else {
		$btn.text('Submit').prop('disabled', false).css('opacity', 1);
	}
}

on_action_btn() {
	if (this._doc_status === 1 && !this.is_dirty()) return;
	if (!this.validate_required()) return;
	if (this.is_dirty()) {
		this.update_business_request();
	} else if (this._saved_doc) {
		this.submit_business_request();
	} else {
		this.save_business_request();
	}
}

save_business_request() {
	const doc = this.build_doc_payload();
	frappe.call({
		method: 'frappe.client.save',
		args: { doc: doc },
		callback: (r) => {
			if (r.message) {
				this._saved_doc = r.message.name;
				this._saved_doc_data = r.message;
				this._doc_status = r.message.docstatus || 0;
				$('#br-save-badge').text(r.message.name).css({ color: '#16a34a', borderColor: '#86efac', background: '#f0fdf4' });
				frappe.show_alert({ message: __('Saved as draft: {0}', [r.message.name]), indicator: 'green' });
				this.capture_dirty_baseline();
				this.set_active_list_item(r.message.name);
				this.load_list();
				this.set_action_btn_state();
				this.update_context_desc();
				// The saved/submitted Business Request continues the flow:
				// pass its id (plus the working context) to the right tabs.
				this.push_working_context(r.message.name);
			}
		},
		error: (r) => {
			frappe.msgprint({ title: __('Error'), message: r.message || __('Save failed.'), indicator: 'red' });
		}
	});
}

push_working_context(current_business_request) {
	if (!this.controller) return;
	this.controller.set_working_context('business_request', {
		subsidiary: this._current_subsidiary,
		customer: this._current_customer,
		business_request: current_business_request || this._saved_doc || '',
	});
}

submit_business_request() {
	const doc = this.build_doc_payload();
	frappe.call({
		method: 'frappe.client.submit',
		args: { doc: doc },
		callback: (r) => {
if (r.message) {
			this._saved_doc = r.message.name;
			this._saved_doc_data = r.message;
			this._doc_status = r.message.docstatus || 1;
			this.set_record_editability();
			$('#br-save-badge').text(r.message.name).css({ color: '#16a34a', borderColor: '#86efac', background: '#f0fdf4' });
			frappe.show_alert({ message: __('Submitted successfully: {0}', [r.message.name]), indicator: 'green' });
				this.capture_dirty_baseline();
				this.set_active_list_item(r.message.name);
				this.load_list();
				this.set_action_btn_state();
				this.update_context_desc();
				// The submitted Business Request id continues the flow
				// to the Project tab (maintain the flow).
				this.push_working_context(r.message.name);
			}
		},
		error: (r) => {
			frappe.msgprint({ title: __('Error'), message: r.message || __('Submit failed.'), indicator: 'red' });
		}
	});
}

update_business_request() {
	const doc = this.build_doc_payload();
	frappe.call({
		method: 'frappe.client.save',
		args: { doc: doc },
		callback: (r) => {
			if (r.message) {
				this._saved_doc = r.message.name;
				this._saved_doc_data = r.message;
				this._doc_status = r.message.docstatus || this._doc_status;
				$('#br-save-badge').text(r.message.name).css({ color: '#16a34a', borderColor: '#86efac', background: '#f0fdf4' });
				frappe.show_alert({ message: __('Updated: {0}', [r.message.name]), indicator: 'green' });
				this.set_record_editability();
				this.capture_dirty_baseline();
				this.set_active_list_item(r.message.name);
				this.load_list();
				this.set_action_btn_state();
				this.update_context_desc();
				this.push_working_context(r.message.name);
			}
		},
		error: (r) => {
			frappe.msgprint({ title: __('Error'), message: r.message || __('Update failed.'), indicator: 'red' });
		}
	});
}

new_business_request_entry() {
	if (this._ctrl_subsidiary) this._ctrl_subsidiary.set_value('');
	if (this._ctrl_customer)   this._ctrl_customer.set_value('');
	this._current_subsidiary = '';
	this._current_customer   = '';
	this._saved_doc = '';
	this._saved_doc_data = null;
	this._doc_status = 0;

	Object.keys(this._controls).forEach(fieldname => {
		try { this._controls[fieldname].set_value(''); } catch(e) {}
	});
	if (this._controls.request_date) {
		this._controls.request_date.set_value(frappe.datetime.get_today());
	}
	this._users_value = [];
	this.render_user_tags();
	this.populate_requester_fields();
	this._dirty = false;
	this._user_edited = false;
	this.set_record_editability();
	this.capture_dirty_baseline(250);
	this.set_active_list_item('');
	$('#br-save-badge').text('Not Saved').css({ color: '#6b7280', borderColor: '#d1d5db', background: '#f9fafb' });
	this.set_action_btn_state();
	this.update_context_desc();
	// Starting a fresh Business Request — do not carry the previous
	// submitted Business Request id into the right tabs. A value chosen
	// in the global Working Context bar belongs to the user, so it stays.
	if (this.controller && (!this.controller._wc
		|| this.controller._wc.br_src !== 'global')) {
		this.controller.set_working_context('business_request', { business_request: '' });
		// Keep this tab's own scope in step with the cleared context.
		this._current_business_request = '';
		this.on_working_context_change();
	}
}

navigate_next() {
const current = this._saved_doc;
if (!current) {
frappe.msgprint({ message: __('Save a Business Request first.'), indicator: 'orange' });
return;
}
frappe.call({
method: 'frappe.client.get_list',
args: {
doctype: 'Business Request',
filters: [['name', '>', current]],
fields: ['name'],
order_by: 'name asc',
limit: 1
},
callback: (r) => {
if (r.message && r.message.length > 0) {
this.load_business_request(r.message[0].name);
} else {
frappe.show_alert({ message: __('This is the last record.'), indicator: 'blue' });
}
}
});
}

load_business_request(name) {
this._loading = true;
this._dirty = false;
this._user_edited = false;
this._baseline = null;
frappe.call({
method: 'frappe.client.get',
args: { doctype: 'Business Request', name: name },
callback: (r) => {
	if (!r.message) { this._loading = false; return; }
	const doc = r.message;
	this._saved_doc = doc.name;
	this._saved_doc_data = doc;

this.populate_fields_from_doc(doc, [
'registration', 'prequalification', 'reference_request_no', 'bd_tasks',
'custom_sector', 'custom_request_type', 'custom__priority', 'status',
'custom_required_by', 'planned_date', 'customer', 'request_date',
'description', 'subsidairy_company', 'request_category',
]);

this.set_users_value(doc.users || []);

if (this._controls['requested_by'])     this._controls['requested_by'].set_value(doc.contact_person || '');
if (this._controls['member_full_name']) this._controls['member_full_name'].set_value(doc.member_full_name || '');

if (this._ctrl_subsidiary) this._ctrl_subsidiary.set_value(doc.subsidairy_company || '');
if (this._ctrl_customer)   this._ctrl_customer.set_value(doc.customer || '');
this._current_subsidiary = doc.subsidairy_company || '';
this._current_customer   = doc.customer || '';
this._doc_status = doc.docstatus || 0;
$('#br-save-badge').text(doc.name).css({ color: '#16a34a', borderColor: '#86efac', background: '#f0fdf4' });
this.set_record_editability();
this.update_context_desc();
this.push_working_context(this._saved_doc);
this.after_record_loaded();
},
error: () => { this._loading = false; },
});
}
};
