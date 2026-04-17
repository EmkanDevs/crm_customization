frappe.query_reports["Document Expiration"] = {
    filters: [
        {
            fieldname: "subsidairy_company",
            label: "Subsidiary",
            fieldtype: "Link",
            options: "Subsidairy Company"
        },
        {
            fieldname: "document_type",
            label: "Document Type",
            fieldtype: "Link",
			options : "Company Document Type"
        },
        {
            fieldname: "show_expired",
            label: "Show Expired Only",
            fieldtype: "Check"
        },
        {
            fieldname: "days_to_expire",
            label: "Expiring Within (Days)",
            fieldtype: "Int"
        }
    ]
};