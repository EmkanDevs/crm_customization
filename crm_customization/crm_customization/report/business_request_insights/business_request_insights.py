import frappe
from frappe.utils import getdate

def execute(filters=None):
    columns = get_columns()
    data = get_data(filters)
    return columns, data


def get_columns():
    return [
        {"label": "Request ID", "fieldname": "name", "fieldtype": "Link", "options": "Business Request", "width": 150},
        {"label": "Customer", "fieldname": "customer", "fieldtype": "Link", "options": "Customer", "width": 180},
        {"label": "Subsidiary", "fieldname": "subsidairy_company", "fieldtype": "Link", "options": "Subsidairy Company", "width": 180},
        {"label": "Category", "fieldname": "request_category", "fieldtype": "Link", "options": "BD Request Category", "width": 150},
        {"label": "Status", "fieldname": "status", "fieldtype": "Data", "width": 120},
        {"label": "Plan Start Date", "fieldname": "planned_date", "fieldtype": "Date", "width": 130},
        {"label": "Request Date", "fieldname": "request_date", "fieldtype": "Date", "width": 130},
        # {"label": "Created On", "fieldname": "creation", "fieldtype": "Datetime", "width": 160},
        {"label": "Last Modified", "fieldname": "modified", "fieldtype": "Datetime", "width": 160},
        {"label": "Owner", "fieldname": "owner", "fieldtype": "Data", "width": 150},
    ]


def get_conditions(filters):
    conditions = []

    if filters.get("from_date") and filters.get("to_date"):
        conditions.append("br.creation BETWEEN %(from_date)s AND %(to_date)s")

    if filters.get("planned_from") and filters.get("planned_to"):
        conditions.append("br.planned_date BETWEEN %(planned_from)s AND %(planned_to)s")

    if filters.get("status"):
        conditions.append("br.status = %(status)s")

    if filters.get("customer"):
        conditions.append("br.customer = %(customer)s")

    if filters.get("subsidairy_company"):
        conditions.append("br.subsidairy_company = %(subsidairy_company)s")

    return " AND ".join(conditions)


def get_data(filters):
    conditions = get_conditions(filters)

    query = f"""
        SELECT
            br.name,
            br.customer,
            br.subsidairy_company,
            br.request_category,
            br.status,
            br.planned_date,
            br.request_date,
            br.modified,
            br.owner
        FROM `tabBusiness Request` br
        WHERE 1=1
        {f"AND {conditions}" if conditions else ""}
        ORDER BY br.modified DESC
    """

    return frappe.db.sql(query, filters, as_dict=1)