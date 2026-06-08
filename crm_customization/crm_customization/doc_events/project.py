import frappe

def update_br_status(doc, method):
    br = doc.get("custom_business_request")

    if not br:
        return

    if doc.status == "Cancelled":
        frappe.db.set_value(
            "Business Request",
            br,
            "status",
            "Cancel"
        )

    elif doc.status == "Completed":
        frappe.db.set_value(
            "Business Request",
            br,
            "status",
            "Completed"
        )

    else:
        frappe.db.set_value(
            "Business Request",
            br,
            "status",
            "On-Going"
        )