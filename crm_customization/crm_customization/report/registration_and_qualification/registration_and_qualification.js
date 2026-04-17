// frappe.query_reports["Registration and Qualification"] = {
//     filters: [
//         {
//             "fieldname": "period",
//             "label": __("Period"),
//             "fieldtype": "Select",
//             "options": "\nMonthly\nQuarterly\nYearly\nCustom",
//             "default": "",
//             "on_change": function () {
//                 let period = frappe.query_report.get_filter_value("period");
//                 _toggle_period_filters(period);
//             }
//         },
//         {
//             "fieldname": "month",
//             "label": __("Month"),
//             "fieldtype": "Select",
//             "options": "\nJanuary\nFebruary\nMarch\nApril\nMay\nJune\nJuly\nAugust\nSeptember\nOctober\nNovember\nDecember",
//             "default": "",
//             "hidden": 1
//         },
//         {
//             "fieldname": "year",
//             "label": __("Year"),
//             "fieldtype": "Select",
//             "options": "\n2020\n2021\n2022\n2023\n2024\n2025\n2026",
//             "default": "",
//             "hidden": 1
//         },
//         {
//             "fieldname": "range",
//             "label": __("Range"),
//             "fieldtype": "Select",
//             "options": "\nThis Month\nLast Month\nLast Quarter\nLast 3 Months\nLast 6 Months\nThis Year",
//             "default": "",
//             "hidden": 1
//         },
//         {
//             "fieldname": "from_date",
//             "label": __("From Date"),
//             "fieldtype": "Date",
//             "hidden": 1
//         },
//         {
//             "fieldname": "to_date",
//             "label": __("To Date"),
//             "fieldtype": "Date",
//             "hidden": 1
//         },
//         {
//             "fieldname": "subsidiary_company",
//             "label": __("Subsidiary Company"),
//             "fieldtype": "Link",
//             "options": "Subsidairy Company"
//         },
//         {
//             "fieldname": "vendor",
//             "label": __("Vendor"),
//             "fieldtype": "Link",
//             "options": "Customer"
//         },
//         {
//             "fieldname": "status",
//             "label": __("Status"),
//             "fieldtype": "Select",
//             "options": "\nNot Started\nNot Qualified\nPending Approval\nWaiting for the Request Approval\nPending Submission\nPending Re-Submission\nIn Process\nOn Hold\nQualified\nCompleted\nRejected\nUnder Qualification\nCancelled"
//         },
//         {
//             "fieldname": "stage",
//             "label": __("Stage"),
//             "fieldtype": "Select",
//             "options": "\nRegistration\nPrequalification\nPQ Project\nRFQ Invitation"
//         },
//         {
//             "fieldname": "registration",
//             "label": __("Registration"),
//             "fieldtype": "Check"
//         },
//         {
//             "fieldname": "pre_qualification",
//             "label": __("Pre-qualification"),
//             "fieldtype": "Check"
//         },
//     ],

//     onload: function (report) {
//         setTimeout(function () {
//             let period = frappe.query_report.get_filter_value("period");
//             _toggle_period_filters(period || "");
//         }, 100);
//     },

//     after_datatable_render: function (report) {
//         frappe.dom.set_style(`
//             .report-summary {
//                 background: linear-gradient(to bottom right, #ffffff, #f9fafb) !important;
//                 border: 1px solid #e2e8f0 !important;
//                 border-radius: 12px !important;
//                 padding: 24px !important;
//                 margin: 15px 0 25px 0 !important;
//                 box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05) !important;
//                 display: flex !important;
//             }
//             .summary-item { border-right: 1px dotted #cbd5e1 !important; flex: 1 !important; text-align: center !important; }
//             .summary-item:last-child { border-right: none !important; }
//             .summary-value { font-size: 28px !important; font-weight: 800 !important; color: #0f172a !important; }
//             .summary-label { font-size: 10px !important; font-weight: 700 !important; color: #64748b !important; text-transform: uppercase; margin-top: 8px !important; }
//             .rq-status-card { transition: all 0.3s ease; border-radius: 8px; border-left: 5px solid; }
//             .rq-status-card:hover { transform: translateY(-3px); box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1) !important; }
//         `);
//     }
// };

// /**
//  * Toggle visibility of period sub-filters based on selected period.
//  *
//  * Monthly    → month, year
//  * Quarterly  → range
//  * Yearly     → year
//  * Custom     → from_date, to_date
//  */
// function _toggle_period_filters(period) {
//     var all_fields = ["month", "year", "range", "from_date", "to_date"];

//     var visible_fields = [];
//     if (period === "Monthly") {
//         visible_fields = ["month", "year"];
//     } else if (period === "Quarterly") {
//         visible_fields = ["range"];
//     } else if (period === "Yearly") {
//         visible_fields = ["year"];
//     } else if (period === "Custom") {
//         visible_fields = ["from_date", "to_date"];
//     }

//     all_fields.forEach(function (fieldname) {
//         var f = frappe.query_report.get_filter(fieldname);
//         if (f) {
//             var should_show = visible_fields.includes(fieldname);
//             f.df.hidden = should_show ? 0 : 1;
//             f.refresh();
//             if (!should_show && f.get_value()) {
//                 f.set_value("");
//             }
//         }
//     });
// }



frappe.query_reports["Registration and Qualification"] = {
    filters: [
        {
            fieldname: "period_type",
            label: __("Period Type"),
            fieldtype: "Select",
            options: "\nMonthly\nQuarterly\nYearly",
            default: ""
        },
        {
            fieldname: "year",
            label: __("Year"),
            fieldtype: "Select",
            options: get_years(),
            default: ""
        },
        {
            fieldname: "subsidiary_company",
            label: __("Subsidiary Company"),
            fieldtype: "Link",
            options: "Subsidairy Company"
        },
        {
            fieldname: "vendor",
            label: __("Vendor"),
            fieldtype: "Link",
            options: "Customer"
        },
        {
            fieldname: "status",
            label: __("Status"),
            fieldtype: "Select",
            options: "\nNot Started\nNot Qualified\nPending Approval\nWaiting for the Request Approval\nPending Submission\nPending Re-Submission\nIn Process\nOn Hold\nQualified\nCompleted\nRejected\nUnder Qualification\nCancelled"
        },
        {
            fieldname: "stage",
            label: __("Stage"),
            fieldtype: "Select",
            options: "\nRegistration\nPrequalification\nPQ Project\nRFQ Invitation"
        },
        {
            fieldname: "registration",
            label: __("Registration"),
            fieldtype: "Check"
        },
        {
            fieldname: "pre_qualification",
            label: __("Pre-qualification"),
            fieldtype: "Check"
        },
    ],

    onload: function(report) {
        frappe.dom.set_style(`
            .rq-highlight-row .dt-cell {
                background-color: #FEF3C7 !important;
                font-weight: 500;
            }
            .rq-highlight-row {
                border-left: 4px solid #10b981 !important;
            }
        `);
    },

    after_datatable_render: function(datatable_obj) {
        highlight_checked_rows(datatable_obj);
    }
};

// --------------------------------------------
// Row Highlighter — targets period columns only
// --------------------------------------------
function highlight_checked_rows(datatable_obj) {
    const datamanager = datatable_obj.datamanager;
    const rows = datamanager?.data;
    const columns = datamanager?.columns;

    if (!rows || !columns) return;

    // Detect dynamic period columns (Monthly / Quarterly / Yearly)
    const period_column_keys = columns
        .filter(col => {
            const name  = (col.id || col.fieldname || col.name || "").toLowerCase();
            const label = (col.content || col.label || "").toLowerCase();

            return (
                /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/.test(name)  ||
                /^q[1-4]/.test(name)  ||
                /^\d{4}$/.test(name)  ||
                /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/.test(label) ||
                /^q[1-4]/.test(label) ||
                /^\d{4}$/.test(label)
            );
        })
        .map(col => col.id || col.fieldname || col.name);

    if (!period_column_keys.length) {
        console.warn(
            "RQ Report: No period columns detected. Column keys available:",
            columns.map(c => ({ id: c.id, name: c.name, fieldname: c.fieldname, label: c.label || c.content }))
        );
        return;
    }

    rows.forEach((row, row_index) => {
        // Highlight if ANY period column checkbox is checked (value === 1)
        const is_checked = period_column_keys.some(
            key => row[key] === 1 || row[key] === "1"
        );

        if (is_checked) {
            const row_el = datatable_obj.wrapper.querySelector(
                `.dt-row[data-row-index="${row_index}"]`
            );
            if (row_el) {
                row_el.classList.add("rq-highlight-row");
            }
        }
    });
}

// --------------------------------------------
// Helper → Dynamic Year Options
// --------------------------------------------
function get_years() {
    let years = [];
    let current_year = new Date().getFullYear();

    for (let i = current_year - 5; i <= current_year + 2; i++) {
        years.push(i);
    }

    return "\n" + years.join("\n");
}