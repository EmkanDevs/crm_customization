// Copyright (c) 2026, Finbyz and contributors
// For license information, please see license.txt

// Section files are inlined here at request time (no build/restart required).
// Add a new include line when you build a new section.
{% include "crm_customization/crm_customization/page/bd_control_center/bd_cc_sections/section_base_styles.js" %}
{% include "crm_customization/crm_customization/page/bd_control_center/bd_cc_sections/section_list_pane.js" %}
{% include "crm_customization/crm_customization/page/bd_control_center/bd_cc_sections/subsidiary_company.js" %}
{% include "crm_customization/crm_customization/page/bd_control_center/bd_cc_sections/customer.js" %}
{% include "crm_customization/crm_customization/page/bd_control_center/bd_cc_sections/business_request.js" %}
{% include "crm_customization/crm_customization/page/bd_control_center/bd_cc_sections/project.js" %}
{% include "crm_customization/crm_customization/page/bd_control_center/bd_cc_sections/company_document_type.js" %}
{% include "crm_customization/crm_customization/page/bd_control_center/bd_cc_sections/document_expiration.js" %}
{% include "crm_customization/crm_customization/page/bd_control_center/bd_cc_sections/client_issue_register.js" %}
{% include "crm_customization/crm_customization/page/bd_control_center/bd_cc_sections/customer_portal_document.js" %}
{% include "crm_customization/crm_customization/page/bd_control_center/bd_cc_sections/department_officer.js" %}
{% include "crm_customization/crm_customization/page/bd_control_center/bd_cc_sections/registration_and_qualification.js" %}
{% include "crm_customization/crm_customization/page/bd_control_center/bd_cc_sections/business_request_insights.js" %}
{% include "crm_customization/crm_customization/page/bd_control_center/bd_cc_sections/customer_portal_document_report.js" %}

frappe.provide('crm_customization');

frappe.pages['bd-control-center'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'BD Control Center',
		single_column: true
	});

	new crm_customization.BDControlCenter(page);
};

// ─────────────────────────────────────────────
//  SHARED FRAPPE CONTROL FACTORIES
//  Used by every section to build Link/Data controls.
// ─────────────────────────────────────────────
crm_customization.make_link_control = function(container_id, doctype, label, onchange) {
	const container = document.getElementById(container_id);
	if (!container) return null;
	try {
		const ctrl = frappe.ui.form.make_control({
			df: {
				fieldtype: 'Link',
				fieldname: container_id.replace(/-/g, '_'),
				label: label,
				options: doctype,
				placeholder: label,
			},
			parent: container,
			render_input: true,
		});
		ctrl.refresh();
		if (onchange) {
			ctrl.$input.on('change', () => {
				setTimeout(() => onchange(ctrl.get_value()), 100);
			});
			ctrl.$wrapper.on('awesomplete-selectcomplete', () => {
				setTimeout(() => onchange(ctrl.get_value()), 150);
			});
		}
		return ctrl;
	} catch(e) {
		console.error('Error making link control', container_id, e);
		return null;
	}
};

crm_customization.make_data_control = function(container_id, label, required) {
	const container = document.getElementById(container_id);
	if (!container) return null;
	try {
		const ctrl = frappe.ui.form.make_control({
			df: {
				fieldtype: 'Data',
				fieldname: container_id.replace(/-/g, '_'),
				label: label,
				placeholder: label,
				reqd: required ? 1 : 0,
			},
			parent: container,
			render_input: true,
		});
		ctrl.refresh();
		return ctrl;
	} catch(e) {
		console.error('Error making data control', container_id, e);
		return null;
	}
};

crm_customization.attach_link_teleport = function(ctrl, $el) {
	if (!ctrl || !$el || !$el.length) return;
	const input = ctrl.$input && ctrl.$input[0];
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
};

crm_customization.BDControlCenter = class {
	constructor(page) {
		this.page = page;
		this.tabs = {
			subsidiary_company:              { label: 'Subsidiary Company',              dot: '#f97316', section: 'BDCCSubsidiaryCompany' },
			customer:                         { label: 'Customer',                         dot: '#f97316', section: 'BDCCCustomer' },
			business_request:                { label: 'Business Request',                dot: '#f97316', section: 'BDCCBusinessRequest' },
			project:                         { label: 'Project',                         dot: '#f97316', section: 'BDCCProject' },
			client_issue_register:           { label: 'Client Issue Register',           dot: '#f97316', section: 'BDCCClientIssueRegister' },
			company_document_type:           { label: 'Company Document Type',           dot: '#f97316', section: 'BDCCCompanyDocumentType' },
			document_expiration:             { label: 'Document Expiration',             dot: '#f97316', section: 'BDCCDocumentExpiration' },
			customer_portal_document:        { label: 'Customer Portal Document',        dot: '#f97316', section: 'BDCCCustomerPortalDocument' },
			department_officer:              { label: 'Department Officer',              dot: '#f97316', section: 'BDCCDepartmentOfficer' },
			registration_and_qualification:  { label: 'Registration and Qualification',  dot: '#f97316', section: 'BDCCRegistrationAndQualification' },
			business_request_insights:       { label: 'Business Request Insights',       dot: '#f97316', section: 'BDCCBusinessRequestInsights' },
			customer_portal_document_report: { label: 'Customer Portal Document Report', dot: '#f97316', section: 'BDCCCustomerPortalDocumentReport' },
		};

		this.active_tab = 'subsidiary_company';
		this.sections = {};

		// Working Context propagation state (left → right).
		// Each value remembers the tab that established it,
		// so context always flows from its source rightward only.
		this._wc = { subsidiary: '', customer: '', business_request: '', document_type: '', subs_src: '', cust_src: '', br_src: '', doct_src: '' };

		this.setup_styles();
		this.setup_page();
	}

	setup_styles() {
		if (document.getElementById('bd-control-center-styles')) return;

		const style = document.createElement('style');
		style.id = 'bd-control-center-styles';
		style.innerHTML = `
			.bd-cc-wrapper {
				font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
				min-height: calc(100vh - var(--navbar-height));
				padding: 0;
			}
			body[data-route="bd-control-center"] .page-head { display: none; }
			body[data-route="bd-control-center"] .page-body,
			body[data-route="bd-control-center"] .layout-main,
			body[data-route="bd-control-center"] .layout-main-section-wrapper,
			body[data-route="bd-control-center"] .layout-main-section,
			body[data-route="bd-control-center"] .page-wrapper,
			body[data-route="bd-control-center"] .page-content {
				max-width: none !important;
				width: 100% !important;
				margin: 0 !important;
				padding: 0 !important;
			}
			.layout-main-section > .page-form { display: none !important; }

			/* Heading */
			.bd-cc-heading { padding: 20px 24px 0 24px; }
			.bd-cc-heading h1 {
				font-size: 22px; font-weight: 700;
				color: var(--heading-color, #1a1f2e);
				margin: 0 0 16px 0; letter-spacing: -0.3px;
			}
			/* Title + compact Working Context bar on one line */
			.bd-cc-heading-row {
				display: flex; align-items: center; justify-content: space-between;
				gap: 18px; flex-wrap: wrap; margin-bottom: 14px;
			}
			.bd-cc-heading-row h1 { margin: 0; white-space: nowrap; flex: 0 0 auto; }
			.bd-cc-heading .sc-context-bar {
				flex: 1 1 auto; min-width: 0; margin: 0;
				padding: 8px 14px;
			}
			.bd-cc-heading .sc-context-info { flex: 0 0 auto; min-width: 160px; }
			.bd-cc-heading .sc-context-info .sc-context-title { font-size: 13px; }
			.bd-cc-heading .sc-context-selectors { flex: 1 1 auto; gap: 14px; flex-wrap: wrap; justify-content: space-between; }
			.bd-cc-heading .sc-selector-group { flex: 1 1 170px; min-width: 150px; max-width: 300px; }
			.bd-cc-heading .sc-selector-group label { font-size: 11.5px; }
			.bd-cc-heading .sc-clear-btn { height: auto; min-height: 32px; }

			/* Nav */
			.bd-cc-navbar {
				display: flex; align-items: center; gap: 0;
				background: #ffffff; border: 1px solid #e2e6ea;
				border-radius: 8px; padding: 4px 6px;
				overflow-x: auto; flex-wrap: nowrap;
				scrollbar-width: thin; scrollbar-color: #c4cdd6 transparent;
				box-shadow: 0 1px 4px rgba(0,0,0,0.06);
			}
			.bd-cc-navbar::-webkit-scrollbar { height: 6px; }
			.bd-cc-navbar::-webkit-scrollbar-track { background: transparent; }
			.bd-cc-navbar::-webkit-scrollbar-thumb { background: #c4cdd6; border-radius: 3px; }
			.bd-cc-navbar::-webkit-scrollbar-thumb:hover { background: #9aa7b4; }
			.bd-cc-nav-wrap { position: relative; }
			.bd-cc-nav-fade {
				position: absolute; top: 0; bottom: 9px; width: 24px;
				pointer-events: none; opacity: 0; transition: opacity 0.2s ease; z-index: 1;
			}
			.bd-cc-nav-fade.left { left: 0; background: linear-gradient(to right, rgba(255,255,255,0.96), rgba(255,255,255,0)); }
			.bd-cc-nav-fade.right { right: 0; background: linear-gradient(to left, rgba(255,255,255,0.96), rgba(255,255,255,0)); }
			.bd-cc-nav-wrap.show-fade-left .bd-cc-nav-fade.left { opacity: 1; }
			.bd-cc-nav-wrap.show-fade-right .bd-cc-nav-fade.right { opacity: 1; }
			.bd-cc-nav-item {
				display: flex; align-items: center; gap: 6px;
				padding: 8px 13px; cursor: pointer;
				font-size: 12.5px; font-weight: 500; color: #505a6e;
				white-space: nowrap; border-radius: 6px;
				transition: background 0.18s ease, color 0.18s ease;
				position: relative; user-select: none; flex-shrink: 0;
			}
			.bd-cc-nav-item:hover { background: #f0f4ff; color: #2563eb; }
			.bd-cc-nav-item.active { background: #eff6ff; color: #1d4ed8; font-weight: 600; }
			.bd-cc-nav-item + .bd-cc-nav-item::before {
				content: ''; position: absolute; left: 0; top: 22%;
				height: 56%; width: 1px; background: #e2e6ea;
			}
			.bd-cc-dot {
				width: 7px; height: 7px; border-radius: 50%;
				flex-shrink: 0; display: inline-block; transition: background 0.18s ease;
			}
			.bd-cc-content { padding: 16px 24px 24px 24px; }
			.bd-cc-tab-panel { display: none; }
			.bd-cc-tab-panel.active { display: block; }

			/* Placeholder for sections not built yet */
			.bd-cc-placeholder {
				background: #fff; border: 1px dashed #d1d5db; border-radius: 8px;
				padding: 48px 24px; text-align: center;
				color: #9ca3af; font-size: 13px;
			}

			/* Dark mode */
			[data-theme="dark"] .bd-cc-navbar { background: #1e2533; border-color: #2d3748; scrollbar-color: #3a4558 transparent; }
			[data-theme="dark"] .bd-cc-navbar::-webkit-scrollbar-thumb { background: #3a4558; }
			[data-theme="dark"] .bd-cc-navbar::-webkit-scrollbar-thumb:hover { background: #4b5870; }
			[data-theme="dark"] .bd-cc-nav-fade.left { background: linear-gradient(to right, rgba(30,37,51,0.96), rgba(30,37,51,0)); }
			[data-theme="dark"] .bd-cc-nav-fade.right { background: linear-gradient(to left, rgba(30,37,51,0.96), rgba(30,37,51,0)); }
			[data-theme="dark"] .bd-cc-nav-item { color: #a0aec0; }
			[data-theme="dark"] .bd-cc-nav-item:hover { background: #2d3748; color: #90cdf4; }
			[data-theme="dark"] .bd-cc-nav-item.active { background: #2a3f6e; color: #93c5fd; }
			[data-theme="dark"] .bd-cc-heading h1 { color: #f0f4ff; }
			[data-theme="dark"] .bd-cc-placeholder { background: #1e2533; border-color: #2d3748; }
		`;
		document.head.appendChild(style);
	}

	setup_page() {
		const $wrapper = $(this.page.main);
		$wrapper.empty();

		const navKeys = Object.keys(this.tabs);
		const navItems = navKeys.map(key => {
			const t = this.tabs[key];
			return `
				<div class="bd-cc-nav-item${key === this.active_tab ? ' active' : ''}"
					 data-tab="${key}"
					 role="tab"
					 aria-selected="${key === this.active_tab ? 'true' : 'false'}"
					 tabindex="${key === this.active_tab ? '0' : '-1'}">
					<span class="bd-cc-dot" style="background:${t.dot}"></span>
					${frappe.utils.escape_html(t.label)}
				</div>
			`;
		}).join('');

		const panels = navKeys.map(key => `
			<div class="bd-cc-tab-panel${key === this.active_tab ? ' active' : ''}" id="bd-cc-panel-${key}">
			</div>
		`).join('');

		$wrapper.html(`
			<div class="bd-cc-wrapper">
				<div class="bd-cc-heading">
					<div class="bd-cc-heading-row">
						<h1>BD Control Center</h1>
						<div class="sc-context-bar">
							<div class="sc-context-info">
								<div class="sc-context-title">Working Context</div>
								<div class="sc-context-sub" id="bdcc-context-desc">Select a Subsidiary Company to begin</div>
							</div>
							<div class="sc-context-selectors">
								<div class="sc-selector-group">
									<label>Subsidiary</label>
									<div id="bdcc-subsidiary-control"></div>
								</div>
								<div class="sc-selector-group">
									<label>Customer</label>
									<div id="bdcc-customer-control"></div>
								</div>
								<div class="sc-selector-group">
									<label>Business Request</label>
									<div id="bdcc-business-request-control"></div>
								</div>
								<button class="sc-clear-btn" id="bdcc-clear-context">Clear</button>
							</div>
						</div>
					</div>
					<div class="bd-cc-nav-wrap">
						<nav class="bd-cc-navbar" role="tablist" aria-label="BD Control Center Navigation">
							${navItems}
						</nav>
						<div class="bd-cc-nav-fade left"></div>
						<div class="bd-cc-nav-fade right"></div>
					</div>
				</div>
				<div class="bd-cc-content">
					${panels}
				</div>
			</div>
		`);

		$wrapper.find('.bd-cc-nav-item').on('click', (e) => {
			const tab = $(e.currentTarget).data('tab');
			this.switch_tab(tab);
		});

		$wrapper.find('.bd-cc-nav-item').on('keydown', (e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				const tab = $(e.currentTarget).data('tab');
				this.switch_tab(tab);
			}
		});

		// Show edge fades only while the tab row actually overflows, so a
		// clipped strip reads as a scrollable line.
		const $navbar = $wrapper.find('.bd-cc-navbar');
		const navEl = $navbar[0];
		const $navwrap = $navbar.closest('.bd-cc-nav-wrap');
		const update_nav_hints = () => {
			$navwrap.toggleClass('show-fade-left', navEl.scrollLeft > 1);
			$navwrap.toggleClass('show-fade-right', navEl.scrollLeft + navEl.clientWidth < navEl.scrollWidth - 2);
		};
		$navbar.on('scroll', update_nav_hints);
		update_nav_hints();

		crm_customization.ensure_base_section_styles();
		this.setup_global_context();

		// Render the active tab immediately
		this.render_tab(this.active_tab);
	}

	switch_tab(tab_key) {
		if (this.active_tab === tab_key) return;

		// Leaving a tab with unsaved edits must be confirmed, just like
		// switching records or starting a New Entry inside the section.
		const proceed = () => this.activate_tab(tab_key);
		const current = this.sections && this.sections[this.active_tab];
		if (current && typeof current.confirm_discard_changes === 'function') {
			const dirty = typeof current.is_dirty === 'function'
				? current.is_dirty()
				: Boolean(current._dirty);
			if (dirty) {
				current.confirm_discard_changes(() => {
					if (typeof current.reset_after_discard === 'function') {
						current.reset_after_discard();
					}
					proceed();
				});
				return;
			}
		}
		proceed();
	}

	activate_tab(tab_key) {
		this.active_tab = tab_key;

		const $wrapper = $(this.page.main);

		$wrapper.find('.bd-cc-nav-item').each(function() {
			const $item = $(this);
			const isActive = $item.data('tab') === tab_key;
			$item.toggleClass('active', isActive);
			$item.attr('aria-selected', isActive ? 'true' : 'false');
			$item.attr('tabindex', isActive ? '0' : '-1');
		});

		$wrapper.find('.bd-cc-tab-panel').removeClass('active');
		$wrapper.find(`#bd-cc-panel-${tab_key}`).addClass('active');

		this.render_tab(tab_key);
	}

	go_next_tab() {
		const tabKeys = Object.keys(this.tabs);
		const idx = tabKeys.indexOf(this.active_tab);
		const next = tabKeys[idx + 1];
		if (next) {
			this.switch_tab(next);
		}
	}

	go_prev_tab() {
		const tabKeys = Object.keys(this.tabs);
		const idx = tabKeys.indexOf(this.active_tab);
		const prev = tabKeys[idx - 1];
		if (prev) {
			this.switch_tab(prev);
		}
	}

	// ─────────────────────────────────────────────
	//  GLOBAL WORKING CONTEXT BAR (above the tabs)
	//
	//  One bar for the whole page. It mirrors the current
	//  `_wc` state and, when edited, becomes the root
	//  source so every section on every tab inherits.
	// ─────────────────────────────────────────────
	setup_global_context() {
		this._global_ctrl_subsidiary = crm_customization.make_link_control(
			'bdcc-subsidiary-control', 'Subsidairy Company', 'Subsidiary Company',
			(val) => {
				if (this._syncing_global) return;
				if (String(this._wc.subsidiary || '') === String(val || '')) return;
				this.set_working_context('global', { subsidiary: val });
			}
		);
		this._global_ctrl_customer = crm_customization.make_link_control(
			'bdcc-customer-control', 'Customer', 'Customer',
			(val) => {
				if (this._syncing_global) return;
				if (String(this._wc.customer || '') === String(val || '')) return;
				this.set_working_context('global', { customer: val });
			}
		);
		this._global_ctrl_business_request = crm_customization.make_link_control(
			'bdcc-business-request-control', 'Business Request', 'Business Request',
			(val) => {
				if (this._syncing_global) return;
				if (String(this._wc.business_request || '') === String(val || '')) return;
				this.set_working_context('global', { business_request: val });
			}
		);
		$('#bdcc-clear-context').on('click', () => {
			this.set_working_context('global', { subsidiary: '', customer: '', business_request: '' });
		});
		this.update_global_context();
	}

	update_global_context() {
		const sub = this._wc.subsidiary || '';
		const cust = this._wc.customer || '';
		const br  = this._wc.business_request || '';

		this._syncing_global = true;
		if (this._global_ctrl_subsidiary
			&& String(this._global_ctrl_subsidiary.get_value() || '') !== String(sub)) {
			this._global_ctrl_subsidiary.set_value(sub);
		}
		if (this._global_ctrl_customer
			&& String(this._global_ctrl_customer.get_value() || '') !== String(cust)) {
			this._global_ctrl_customer.set_value(cust);
		}
		if (this._global_ctrl_business_request
			&& String(this._global_ctrl_business_request.get_value() || '') !== String(br)) {
			this._global_ctrl_business_request.set_value(br);
		}
		this._syncing_global = false;

		const $desc = $('#bdcc-context-desc');
		if ($desc.length) {
			const esc = (v) => frappe.utils.escape_html(v || '');
			let desc = 'Select a Subsidiary Company to begin';
			if (sub && cust)  desc = 'Working with <strong>' + esc(sub) + '</strong> / <strong>' + esc(cust) + '</strong>';
			else if (sub)     desc = 'Working with <strong>' + esc(sub) + '</strong>';
			else if (cust)    desc = 'Working with <strong>' + esc(cust) + '</strong>';
			if (br) desc += ' &middot; Request: <strong>' + esc(br) + '</strong>';
			$desc.html(desc);
		}
	}

	// ─────────────────────────────────────────────
	//  WORKING CONTEXT PROPAGATION (left → right)
	//
	//  The first tab where the required context is
	//  established becomes the source of truth. All
	//  tabs to its right inherit automatically and
	//  stay synchronized with the source values.
	// ─────────────────────────────────────────────
	set_working_context(source_tab, opts) {
		const keys = Object.keys(this.tabs);
		// indexOf returns -1 when the source is the global bar ('global'),
		// which then behaves as a root source above all tabs.
		const sourceIdx = keys.indexOf(source_tab);

		if (opts && opts.subsidiary !== undefined) {
			this._wc.subsidiary = opts.subsidiary || '';
			this._wc.subs_src = source_tab;
		}
		if (opts && opts.customer !== undefined) {
			this._wc.customer = opts.customer || '';
			this._wc.cust_src = source_tab;
		}
		if (opts && opts.business_request !== undefined) {
			this._wc.business_request = opts.business_request || '';
			this._wc.br_src = source_tab;
		}
		if (opts && opts.document_type !== undefined) {
			this._wc.document_type = opts.document_type || '';
			this._wc.doct_src = source_tab;
		}

		keys.forEach((key, idx) => {
			if (idx <= sourceIdx) return;
			if (this.sections[key]) {
				this.apply_working_context(this.sections[key], key);
			}
		});

		this.update_global_context();
	}

	_wc_control(section, kind) {
		if (kind === 'subsidiary') {
			if (section._ctrl_subsidiary) return section._ctrl_subsidiary;
			if (section._ctrl && section._ctrl.subsidairy_company) return section._ctrl.subsidairy_company;
			if (section._ctrl_subsidiary_filter) return section._ctrl_subsidiary_filter;
			return null;
		}
		if (kind === 'business_request') {
			if (section._controls && section._controls['custom_business_request']) return section._controls['custom_business_request'];
			if (section._controls && section._controls['business_request']) return section._controls['business_request'];
			return null;
		}
		if (kind === 'document_type') {
			if (section._controls && section._controls['document_type']) return section._controls['document_type'];
			if (section._ctrl && section._ctrl.document_type) return section._ctrl.document_type;
			if (section._ctrl_document_type) return section._ctrl_document_type;
			return null;
		}
		if (section._ctrl_customer) return section._ctrl_customer;
		if (section._ctrl && section._ctrl.customer) return section._ctrl.customer;
		if (section._ctrl_vendor) return section._ctrl_vendor;
		return null;
	}

	apply_working_context(section, tab_key) {
		if (!section) return;
		const keys = Object.keys(this.tabs);
		const idx = keys.indexOf(tab_key);
		const inherited = (src) => src === 'global'
			|| (src && keys.indexOf(src) >= 0 && (idx < 0 || keys.indexOf(src) < idx));

		try {
			if (inherited(this._wc.subs_src)) {
				const val = this._wc.subsidiary || '';
				const ctrl = this._wc_control(section, 'subsidiary');
				if (ctrl && String(ctrl.get_value() || '') !== String(val)) {
					ctrl.set_value(val);
				}
				section._current_subsidiary = val;
				if (typeof section.on_subsidiary_change === 'function') {
					section.on_subsidiary_change(val, { propagated: true });
				}
			}

			if (inherited(this._wc.cust_src)) {
				const val = this._wc.customer || '';
				const ctrl = this._wc_control(section, 'customer');
				if (ctrl && String(ctrl.get_value() || '') !== String(val)) {
					ctrl.set_value(val);
				}
				section._current_customer = val;
				if (typeof section.on_customer_change === 'function') {
					section.on_customer_change(val, { propagated: true });
				}
			}

			if (inherited(this._wc.br_src)) {
				const val = this._wc.business_request || '';
				const ctrl = this._wc_control(section, 'business_request');
				if (ctrl && String(ctrl.get_value() || '') !== String(val)) {
					ctrl.set_value(val);
				}
				section._current_business_request = val;
				if (typeof section.on_business_request_change === 'function') {
					section.on_business_request_change(val, { propagated: true });
				}
			}

			if (inherited(this._wc.doct_src)) {
				const val = this._wc.document_type || '';
				const ctrl = this._wc_control(section, 'document_type');
				if (ctrl && String(ctrl.get_value() || '') !== String(val)) {
					ctrl.set_value(val);
				}
				section._current_document_type = val;
				if (typeof section.on_document_type_change === 'function') {
					section.on_document_type_change(val, { propagated: true });
				}
			}

			if (typeof section.update_context_desc === 'function') {
				section.update_context_desc();
			}
		} catch (e) {
			console.error('Error applying working context', tab_key, e);
		}
	}

	// Refills the Subsidiary Company / Customer / Business Request fields of a
	// section's form after New Entry reset it. Only touches field values — no
	// propagation hooks, no list reloads, no context re-pushes. Clearing the
	// global filters fills '' here too, so the form clears with them.
	prefill_form_context(section) {
		if (!section) return;
		const apply = (force) => {
			const set = (ctrl, val) => {
				if (!ctrl) return;
				const v = val || '';
				try {
					// The reset's set_value('') clears resolve asynchronously, so a
					// plain comparison reads the stale old value and skips — force
					// the first pass; once settled the comparison is trustworthy.
					if (force || String(ctrl.get_value() || '') !== String(v)) {
						ctrl.set_value(v, true);
					}
				} catch (e) {}
			};
			try {
				const sub = this._wc.subsidiary || '';
				const cust = this._wc.customer || '';
				const br = this._wc.business_request || '';
				set(this._wc_control(section, 'subsidiary'), sub);
				set(this._wc_control(section, 'customer'), cust);
				set(this._wc_control(section, 'business_request'), br);
				if (section._controls) {
					set(section._controls['subsidairy_company'], sub);
					set(section._controls['customer'], cust);
					set(section._controls['custom_business_request'], br);
					set(section._controls['business_request'], br);
				}
			} catch (e) {
				console.error('Error prefilling form context', e);
			}
		};
		apply(true);
		// Re-assert once the reset's pending set_value chains have settled.
		setTimeout(() => apply(false), 0);
	}

	render_tab(tab_key) {
		const $panel = $(`#bd-cc-panel-${tab_key}`);
		if ($panel.data('rendered')) return;
		$panel.data('rendered', true);

		const cfg = this.tabs[tab_key];
		const SectionClass = cfg && cfg.section && crm_customization[cfg.section];

		if (!SectionClass) {
			$panel.html(`
				<div class="bd-cc-placeholder">
					${frappe.utils.escape_html(cfg.label)} section will be built here.
				</div>
			`);
			return;
		}

		const section = new SectionClass(this, $panel);
		this.sections[tab_key] = section;
		section.render();

		// These tabs open with the right (form) pane blank; the sections and
		// fields only appear once the user clicks New Entry or picks a record
		// from the left list.
		const blank_on_open = [
			'subsidiary_company', 'customer', 'business_request', 'project',
			'client_issue_register', 'company_document_type', 'document_expiration',
			'customer_portal_document', 'department_officer',
		];
		if (blank_on_open.indexOf(tab_key) !== -1) {
			crm_customization.hide_form_pane($panel);
		}

		// If a tab to the left already established the working
		// context, this newly rendered tab inherits it too.
		this.apply_working_context(section, tab_key);
	}
};