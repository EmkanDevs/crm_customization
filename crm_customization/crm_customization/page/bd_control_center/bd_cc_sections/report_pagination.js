// Shared pagination for report tables in BD Control Center.
frappe.provide('crm_customization');

crm_customization.BDCCReportPagination = class {
	constructor($panel, prefix) {
		this.$panel = $panel;
		this.$footer = $panel.find(`#${prefix}-pagination`);
		this.page_size = 20;
		this.page = 1;
		this.data = [];
		this.render_rows = null;
		this.add_styles();
	}

	add_styles() {
		if (document.getElementById('bd-cc-report-pagination-styles')) return;
		const style = document.createElement('style');
		style.id = 'bd-cc-report-pagination-styles';
		style.textContent = `
			.bd-cc-report-pagination {
				display: flex; align-items: center; justify-content: space-between;
				flex-wrap: wrap; gap: 10px; padding: 14px 2px 0;
				color: #64748b; font-size: 12px;
			}
			.bd-cc-report-pagination .bd-cc-page-controls { display: flex; align-items: center; gap: 10px; }
			.bd-cc-report-pagination button {
				border: 1px solid #cbd5e1; border-radius: 6px; background: #fff;
				color: #334155; padding: 6px 12px; font-size: 12px; cursor: pointer;
			}
			.bd-cc-report-pagination button:disabled { opacity: .45; cursor: default; }
			[data-theme="dark"] .bd-cc-report-pagination { color: #94a3b8; }
			[data-theme="dark"] .bd-cc-report-pagination button {
				background: #1e2533; border-color: #475569; color: #cbd5e1;
			}
		`;
		document.head.appendChild(style);
	}

	set_data(data, render_rows) {
		this.data = data;
		this.render_rows = render_rows;
		this.page = 1;
		this.render();
	}

	render() {
		const total = this.data.length;
		const pages = Math.max(1, Math.ceil(total / this.page_size));
		this.page = Math.min(Math.max(1, this.page), pages);
		const start = (this.page - 1) * this.page_size;
		const end = Math.min(start + this.page_size, total);
		this.render_rows(this.data.slice(start, end), start);

		this.$footer.toggle(total > this.page_size);
		this.$footer.html(`
			<span>Showing ${total ? start + 1 : 0}–${end} of ${total}</span>
			<div class="bd-cc-page-controls">
				<button type="button" class="bd-cc-page-prev" ${this.page === 1 ? 'disabled' : ''}>Previous</button>
				<span>Page ${this.page} of ${pages}</span>
				<button type="button" class="bd-cc-page-next" ${this.page === pages ? 'disabled' : ''}>Next</button>
			</div>
		`);
		this.$footer.find('.bd-cc-page-prev').on('click', () => {
			this.page -= 1;
			this.render();
		});
		this.$footer.find('.bd-cc-page-next').on('click', () => {
			this.page += 1;
			this.render();
		});
	}
};
