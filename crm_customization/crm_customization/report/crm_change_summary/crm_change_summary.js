frappe.query_reports["CRM Change Summary"] = {
    "filters": [
        {
            "fieldname": "ref_doctype",
            "label": "DocType",
            "fieldtype": "Link",
            "options": "DocType",
            "reqd": 1
        },
        {
            "fieldname": "from_date",
            "label": "From Date",
            "fieldtype": "Date",
            "reqd": 1,
            "default": frappe.datetime.month_start()
        },
        {
            "fieldname": "to_date",
            "label": "To Date",
            "fieldtype": "Date",
            "reqd": 1,
            "default": frappe.datetime.now_date()
        },
        {
            "fieldname": "user",
            "label": "User",
            "fieldtype": "Link",
            "options": "User"
        },
        {
            "fieldname": "docname",
            "label": "Document",
            "fieldtype": "Dynamic Link",
            "options": "ref_doctype"
        }
    ],

    // 🎨 Color each row by user (audit clarity)
    "get_datatable_options": function(options) {
        return Object.assign(options, {
            getRowHTML(columns, row) {
                return null; // let default render, we use formatter below
            }
        });
    },

    "formatter": function(value, row, column, data, default_formatter) {
        value = default_formatter(value, row, column, data);

        if (!data) return value;

        const isSummaryRow = data.docname && data.docname.includes("── SUMMARY ──");
        const isSeparator  = data.docname === "";

        // ── Summary row styling ──────────────────────────────────────
        if (isSummaryRow) {
            return `<span style="
                font-weight: 700;
                color: #1a1a2e;
                background: #e8f4fd;
                padding: 3px 8px;
                border-radius: 4px;
                font-size: 12px;
            ">${value}</span>`;
        }

        if (isSeparator) return value;

        // ── Color-code by user (consistent color per user) ──────────
        if (column.fieldname === "owner") {
            const color = getUserColor(data.owner);
            return `<span style="
                background-color: ${color.bg};
                color: ${color.text};
                padding: 2px 8px;
                border-radius: 10px;
                font-size: 11px;
                font-weight: 600;
                white-space: nowrap;
            ">${value}</span>`;
        }

        // ── Fields changed count — badge style ───────────────────────
        if (column.fieldname === "fields_changed" && value) {
            const count = parseInt(data.fields_changed) || 0;
            const badgeColor = count >= 5 ? "#c0392b" : count >= 3 ? "#e67e22" : "#27ae60";
            return `<span style="
                background: ${badgeColor};
                color: white;
                padding: 2px 8px;
                border-radius: 10px;
                font-size: 11px;
                font-weight: 700;
                display: inline-block;
                min-width: 24px;
                text-align: center;
            ">${data.fields_changed}</span>`;
        }

        // ── Change detail — highlight the → arrow ────────────────────
        if (column.fieldname === "summary" && data.summary) {
            const formatted = data.summary
                .replace(/\[([^\]]*)\] → \[([^\]]*)\]/g, (_, old, nw) =>
                    `<span style="color:#c0392b; font-weight:600">[${old}]</span>` +
                    ` <span style="color:#888">→</span> ` +
                    `<span style="color:#27ae60; font-weight:600">[${nw}]</span>`
                )
                .replace(/\|/g, '<span style="color:#ccc; margin:0 4px">|</span>');
            return `<span style="font-size:12px">${formatted}</span>`;
        }

        return value;
    },

    "onload": function(report) {
        // Set sensible date defaults automatically
        report.set_filter_value("from_date", frappe.datetime.month_start());
        report.set_filter_value("to_date",   frappe.datetime.now_date());
    }
};


// ── Deterministic color per username ────────────────────────────────
function getUserColor(username) {
    if (!username) return { bg: "#f0f0f0", text: "#666" };

    // Hash the username to pick from a palette
    const palette = [
        { bg: "#dbeafe", text: "#1e40af" }, // blue
        { bg: "#dcfce7", text: "#166534" }, // green
        { bg: "#fef9c3", text: "#854d0e" }, // yellow
        { bg: "#fce7f3", text: "#9d174d" }, // pink
        { bg: "#ede9fe", text: "#5b21b6" }, // purple
        { bg: "#ffedd5", text: "#9a3412" }, // orange
        { bg: "#e0f2fe", text: "#075985" }, // sky
        { bg: "#d1fae5", text: "#065f46" }, // emerald
    ];

    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }

    return palette[Math.abs(hash) % palette.length];
}