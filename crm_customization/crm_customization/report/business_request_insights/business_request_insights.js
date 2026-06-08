frappe.query_reports["Business Request Insights"] = {
    "filters": [
        {
            "fieldname": "planned_from",
            "label": "Planned From",
            "fieldtype": "Date"
        },
        {
            "fieldname": "planned_to",
            "label": "Planned To",
            "fieldtype": "Date"
        },
        {
            "fieldname": "status",
            "label": "Status",
            "fieldtype": "Select",
            "options": "\nNew\nPlanned\nOn-Going\nCancel\nCompleted"
        },
        {
            "fieldname": "customer",
            "label": "Customer",
            "fieldtype": "Link",
            "options": "Customer"
        },
        {
            "fieldname": "subsidairy_company",
            "label": "Subsidairy Company",
            "fieldtype": "Link",
            "options": "Subsidairy Company"
        }
    ]
};