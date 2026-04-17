frappe.query_reports["Customer Portal Document Report"] = {
    filters: [
        {
            fieldname: "customer",
            label: "Customer",
            fieldtype: "Link",
            options: "Customer"
        },
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
            options: "Company Document Type"
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