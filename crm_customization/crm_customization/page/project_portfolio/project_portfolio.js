frappe.pages['project-portfolio'].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({ parent: wrapper, title: 'Project Portfolio', single_column: true });
	// Append, not .html(): page.body also holds the filter bar, which .html() would wipe.
	const $b = $('<div class="pp"></div>').appendTo(page.body);
	page.set_primary_action(__('Refresh'), () => load());
	page.add_field({ fieldname: 'from_date', label: __('From Date'), fieldtype: 'Date', change: () => load() });
	page.add_field({ fieldname: 'to_date', label: __('To Date'), fieldtype: 'Date', change: () => load() });
	page.add_field({ fieldname: 'project', label: __('Project'), fieldtype: 'Link', options: 'Project', change: () => load(),
		get_query: () => ({ filters: { project_type: ['!=', 'Internal'] } }) });
	page.add_field({ fieldname: 'customer', label: __('Client'), fieldtype: 'Link', options: 'Customer', change: () => load() });
	page.add_field({ fieldname: 'project_type', label: __('Type'), fieldtype: 'Link', options: 'Project Type', change: () => load(),
		get_query: () => ({ filters: { name: ['!=', 'Internal'] } }) });
	page.add_field({ fieldname: 'portfolio_status', label: __('Status'), fieldtype: 'Select', options: '\nOn Going\nCompleted\nDelayed\nOn Hold', change: () => load() });
	page.add_field({ fieldname: 'project_company', label: __('Project Company'), fieldtype: 'Link', options: 'Subsidairy Company', change: () => load() });
	page.add_field({ fieldname: 'business_unit', label: __('Business Unit'), fieldtype: 'Link', options: 'Subsidairy Company', change: () => load() });
	page.add_field({ fieldname: 'location', label: __('Location'), fieldtype: 'Link', options: 'Location', change: () => load() });
	page.add_field({ fieldname: 'category', label: __('Category'), fieldtype: 'Select', options: '\nO&M\nMaintenance\nConstruction\nShutdown / Turnaround\nOther', change: () => load() });
	// SAR is pegged to USD at 3.75; used only when ERPNext has no SAR to USD rate.
	const USD_PEG = { USD: 1, SAR: 1 / 3.75 };
	const rate_cache = {};
	const rate_src = {}; // currency -> where the rate came from, shown in the USD box
	const esc = frappe.utils.escape_html;
	const COLORS = ['#0f4fa8', '#4d9be0', '#9cc6ef', '#cfe3f7', '#7a7fa6'];

	function status(p) {
		if (p.status === 'Completed') return 'Completed';
		if (p.status === 'On Hold') return 'On Hold';
		if (p.expected_end_date && p.expected_end_date < frappe.datetime.get_today()) return 'Delayed';
		return 'On Going';
	}
	function donut(items) {
		const tot = items.reduce((a, i) => a + i.n, 0) || 1; let acc = 0;
		const stops = items.filter(i => i.n).map(i => { const s = acc; acc += i.n / tot * 100; return `${i.c} ${s}% ${acc}%`; });
		return `<div class="pp-row"><div class="pp-donut" style="background:conic-gradient(${stops.join(',') || 'var(--border-color) 0 100%'})"><div><b>${items.reduce((a, i) => a + i.n, 0)}</b><small>${__('Projects')}</small></div></div>
		<div class="pp-leg">${items.map(i => `<div><span><i style="background:${i.c}"></i>${esc(i.l)}</span><b>${i.n}</b></div>`).join('')}</div></div>`;
	}
	function load() {
		const f = { status: ['!=', 'Cancelled'], project_type: ['!=', 'Internal'] };
		const v = page.get_form_values();
		if (v.project_company) f.project_company = v.project_company;
		if (v.business_unit) f.business_unit = v.business_unit;
		if (v.location) f.location = v.location;
		if (v.customer) f.customer = v.customer;
		if (v.project_type) f.project_type = v.project_type;
		if (v.project) f.name = v.project;
		if (v.category) f.custom_category = v.category;
		// Date range: show projects whose planned period overlaps the range.
		const df = [];
		if (v.from_date) df.push(['expected_end_date', '>=', v.from_date]);
		if (v.to_date) df.push(['expected_start_date', '<=', v.to_date]);
		frappe.db.get_list('Project', {
			fields: ['name', 'project_name', 'customer', 'project_type', 'expected_start_date', 'expected_end_date', 'percent_complete',
				'status', 'company', 'project_company', 'business_unit', 'location', 'contract_value', 'currency', 'project_image'],
			filters: Object.entries(f).map(([k, x]) => Array.isArray(x) ? [k, x[0], x[1]] : [k, '=', x]).concat(df),
			order_by: 'expected_start_date desc', limit: 0
		}).then(rows => {
			rows.forEach(p => { p.st = status(p); });
			if (v.portfolio_status) rows = rows.filter(p => p.st === v.portfolio_status);
			return to_usd(rows).then(usd => render(rows, usd));
		});
	}
	function get_rate(cur) {
		if (rate_cache[cur] !== undefined) return Promise.resolve(rate_cache[cur]);
		if (cur === 'USD') return Promise.resolve(rate_cache[cur] = 1);
		// Read the latest Currency Exchange record directly; ERPNext's rate API pops up a message when none exists.
		return frappe.db.get_list('Currency Exchange', {
			fields: ['exchange_rate', 'date'], filters: { from_currency: cur, to_currency: 'USD' }, order_by: 'date desc', limit: 1
		}).catch(() => []).then(r => {
			const rec = r[0] || {};
			if (flt(rec.exchange_rate)) {
				rate_src[cur] = __('Currency Exchange, {0}', [frappe.datetime.str_to_user(rec.date)]);
				return (rate_cache[cur] = flt(rec.exchange_rate));
			}
			rate_src[cur] = USD_PEG[cur] ? __('') : '';
			return (rate_cache[cur] = USD_PEG[cur] || 0);
		});
	}
	// Returns { total, missing } where missing lists currencies with no USD rate.
	function to_usd(rows) {
		const base = frappe.defaults.get_default('currency');
		const valued = rows.filter(p => p.contract_value);
		const curs = [...new Set(valued.map(p => p.currency || base).filter(Boolean))];
		return Promise.all(curs.map(get_rate)).then(() => {
			const missing = curs.filter(c => !rate_cache[c]);
			const total = valued.reduce((a, p) => a + p.contract_value * (rate_cache[p.currency || base] || 0), 0);
			const rates = curs.filter(c => c !== 'USD' && rate_cache[c]).map(c =>
				`1 ${c} = ${rate_cache[c].toFixed(4)} USD (1 USD = ${(1 / rate_cache[c]).toFixed(2)} ${c}), ${rate_src[c]}`);
			return { total, missing, rates };
		});
	}
	function render(rows, usd) {
		rows.forEach(p => { p.pct = Math.round(p.percent_complete || 0); });
		const n = rows.length, avg = n ? Math.round(rows.reduce((a, p) => a + p.pct, 0) / n) : 0;
		const active = rows.filter(p => p.st === 'On Going').length;
		const delayed = rows.filter(p => p.st === 'Delayed').length;
		const total = rows.reduce((a, p) => a + (p.contract_value || 0), 0);
		const cur = (rows.find(p => p.currency) || {}).currency;
		const by = (k) => { const m = {}; rows.forEach(p => { const x = p[k] || __('Not set'); m[x] = (m[x] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
		const clients = by('customer').map(([l, n], i) => ({ l, n, c: COLORS[i % COLORS.length] }));
		const sts = [['On Going', '#1a9a62'], ['Completed', '#9aa4ae'], ['Delayed', '#f0a030'], ['On Hold', '#7a7fa6']]
			.map(([l, c]) => ({ l, c, n: rows.filter(p => p.st === l).length }));
		const bar = p => `<div class="pp-bar"><div class="pp-fill" style="width:${p.pct}%"></div></div>`;
		const kpi = (ic, t, v, s) => `<div class="pp-card pp-kpi"><div class="pp-ico">${ic}</div><div><b>${t}</b><div class="pp-v">${v}</div><small>${s}</small></div></div>`;

		$b.html(`<style>
.pp{--b:#1f6fcc;--soft:var(--control-bg);font-size:13px;padding:4px 0 20px}
.pp-card{background:var(--card-bg);border:1px solid var(--border-color);border-radius:4px}
.pp-grid{display:grid;gap:16px;margin-bottom:16px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.pp-kpi{display:flex;gap:14px;align-items:center;padding:14px}.pp-ico{width:56px;height:56px;background:var(--control-bg);display:grid;place-items:center;color:var(--b);font-size:20px}
.pp-v{font-size:20px;font-weight:700;color:var(--b)}
.pp-ch{padding:14px 16px;min-height:200px}.pp-ch h5{margin:0 0 12px}
.pp-row{display:flex;align-items:center;justify-content:space-around;gap:12px}
.pp-donut{width:140px;height:140px;border-radius:50%;display:grid;place-items:center}
.pp-donut>div{width:88px;height:88px;border-radius:50%;background:var(--card-bg);display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.1}
.pp-donut b{font-size:24px}.pp-leg div{display:flex;justify-content:space-between;gap:24px;margin:6px 0}.pp-leg i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:8px}
.pp-bars{display:flex;align-items:flex-end;gap:14px;height:150px;border-left:1px solid var(--border-color);border-bottom:1px solid var(--border-color);padding:16px 6px 0 14px;margin-bottom:26px}
.pp-bars>div{flex:1;position:relative;background:var(--b);min-height:2px}.pp-bars em{position:absolute;top:-16px;left:0;right:0;text-align:center;font:700 11px sans-serif}
.pp-bars small{position:absolute;top:100%;left:-6px;right:-6px;text-align:center;font-size:9px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pp-t{overflow-x:auto;margin-bottom:16px}.pp-t table{width:100%;min-width:900px;border-collapse:collapse}
.pp-t th{background:var(--control-bg);padding:8px 10px;text-align:left}.pp-t td{padding:10px;border-top:1px solid var(--border-color)}
.pp-t a{cursor:pointer;color:var(--b);text-decoration:underline}.pp-ok{color:#1a9a62;font-weight:600}.pp-late{color:#d9822b;font-weight:600}
.pp-bar{width:70px;height:22px;background:var(--control-bg)}.pp-fill{height:100%;background:linear-gradient(90deg,#2b7de0,var(--control-bg))}
.pp-g{display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(210px,1fr))}.pp-pc{overflow:hidden}
.pp-img{height:90px;background:linear-gradient(160deg,#3a6a8f,#1b2a38) center/cover}.pp-pb{padding:10px 14px 14px}.pp-pb h6{min-height:32px;margin:0 0 8px}
.pp-ln{display:flex;gap:10px;font-size:11px;margin:5px 0;align-items:center}.pp-ln span{width:54px;color:var(--text-muted)}
.pp-btn{display:block;width:100%;margin-top:10px;padding:6px;border:2px solid var(--b);color:var(--b);font-weight:700;text-align:center;cursor:pointer}
</style>
<div class="pp-grid">
${kpi('▦', __('Total Projects'), n, __('Active') + ': ' + active)}
${kpi('﷼', __('Total Contract Value'), total ? format_currency(total, cur) : __('Not provided'), __('Enter values on the Project form'))}
${kpi('$', __('Total Contract Value (USD)'), usd.total ? format_currency(usd.total, 'USD') : __('Not provided'),
	[usd.rates.map(esc).join('<br>'), usd.missing.length ? __('No USD rate for') + ': ' + esc(usd.missing.join(', ')) : '']
		.filter(Boolean).join('<br>') || __('Converted to US Dollars'))}
${kpi('◔', __('Average Completion'), avg + '%', __('Across All Projects'))}
${kpi('◷', __('On-Time Delivery'), (n ? Math.round((n - delayed) / n * 100) : 0) + '%', '(' + delayed + ' ' + __('Delays') + ')')}
</div>
<div class="pp-grid">
<div class="pp-card pp-ch"><h5>${__('Projects by Client')}</h5>${donut(clients)}</div>
<div class="pp-card pp-ch"><h5>${__('Projects by Status')}</h5>${donut(sts)}</div>
<div class="pp-card pp-ch"><h5>${__('Progress Overview')}</h5><div class="pp-bars">${rows.slice(0, 8).map(p => `<div style="height:${Math.max(p.pct, 1.5)}%"><em>${p.pct}%</em><small title="${esc(p.name)}">${esc(p.name)}<br>${esc(p.project_type || '')}</small></div>`).join('')}</div></div>
</div>
<div class="pp-card pp-t"><table><thead><tr><th>${__('Project No.')}</th><th>${__('Type')}</th><th>${__('Client')}</th><th>${__('Project Title')}</th><th>${__('Start')}</th><th>${__('End')}</th><th colspan="2">${__('Progress')}</th><th>${__('Status')}</th><th>${__('Project Company')}</th><th>${__('Business Unit')}</th><th>${__('Location')}</th></tr></thead><tbody>
${rows.map(p => `<tr><td>${esc(p.name)}</td><td>${esc(p.project_type || '')}</td><td>${esc(p.customer || '')}</td><td><a data-p="${esc(p.name)}">${esc(p.project_name)}</a></td><td>${frappe.datetime.str_to_user(p.expected_start_date) || ''}</td><td>${frappe.datetime.str_to_user(p.expected_end_date) || ''}</td><td>${bar(p)}</td><td>${p.pct}%</td><td class="${p.st === 'Delayed' ? 'pp-late' : 'pp-ok'}">● ${__(p.st)}</td><td>${esc(p.project_company || '')}</td><td>${esc(p.business_unit || '')}</td><td>${esc(p.location || __('Not provided'))}</td></tr>`).join('')}
</tbody></table></div>
<div class="pp-g">${rows.map(p => `<div class="pp-card pp-pc"><div class="pp-img" ${p.project_image ? `style="background-image:url('${encodeURI(p.project_image)}')"` : ''}></div><div class="pp-pb"><h6>${esc(p.project_name)}</h6>
<div class="pp-ln"><span>${__('Project No.')}</span>${esc(p.name)}</div><div class="pp-ln"><span>${__('Client')}</span>${esc(p.customer || '')}</div>
<div class="pp-ln"><span>${__('Duration')}</span>${frappe.datetime.str_to_user(p.expected_start_date) || ''} → ${frappe.datetime.str_to_user(p.expected_end_date) || ''}</div>
<div class="pp-ln"><span>${__('Progress')}</span><b>${p.pct}%</b>${bar(p)}</div><a class="pp-btn" data-p="${esc(p.name)}">${__('View Details')} →</a></div></div>`).join('')}</div>`);
		$b.find('[data-p]').on('click', function () { frappe.set_route('Form', 'Project', $(this).data('p')); });
	}
	load();
};
