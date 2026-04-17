frappe.query_reports["Previous uploads CRM"] = {
    filters: [
        {
            fieldname: "customer",
            label: __("Customer"),
            fieldtype: "Link",
            options: "Customer"
        },
        {
            fieldname: "subsidairy_company",
            label: __("Subsidiary"),
            fieldtype: "Link",
            options: "Subsidairy Company"
        },
        {
            fieldname: "document_type",
            label: __("Document Type"),
            fieldtype: "Link",
            options: "Company Document Type"
        },
        {
            fieldname: "from_date",
            label: __("From Date"),
            fieldtype: "Date",
            default: frappe.datetime.add_months(frappe.datetime.get_today(), -1) // Defaults to 1 month ago
        },
        {
            fieldname: "to_date",
            label: __("To Date"),
            fieldtype: "Date",
            default: frappe.datetime.get_today()
        }
    ]
};