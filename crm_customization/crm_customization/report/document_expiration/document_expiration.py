import frappe


def execute(filters=None):
    columns = get_columns()
    data = get_data(filters)
    return columns, data


def get_columns():
    return [
        {
            "label": "Document",
            "fieldname": "name",
            "fieldtype": "Link",
            "options": "Document Expiration",
            "width": 180
        },
        {
            "label": "Document Type",
            "fieldname": "document_type",
            "fieldtype": "Data",
            "width": 180
        },
        {
            "label": "Subsidiary",
            "fieldname": "subsidairy_company",
            "fieldtype": "Link",
            "options": "Company",
            "width": 180
        },
        {
            "label": "Department",
            "fieldname": "department",
            "fieldtype": "Data",
            "width": 150
        },
        {
            "label": "Expire On",
            "fieldname": "expire_on",
            "fieldtype": "Date",
            "width": 120
        },
        {
            "label": "Expires in Days",
            "fieldname": "expires_in_days",
            "fieldtype": "Int",
            "width": 130
        },
    ]


def get_data(filters):
    conditions = get_conditions(filters)

    data = frappe.db.sql(f"""
    SELECT
        name,
        document_type,
        subsidairy_company,
        department,
        expire_on,
        DATEDIFF(expire_on, CURDATE()) AS expires_in_days
    FROM `tabDocument Expiration`
    WHERE docstatus < 2
    {conditions}
    ORDER BY expire_on ASC
""", filters, as_dict=1)
    return data


def get_conditions(filters):
    conditions = ""

    if filters.get("subsidairy_company"):
        conditions += " AND subsidairy_company = %(subsidairy_company)s"

    if filters.get("document_type"):
        conditions += " AND document_type = %(document_type)s"

    if filters.get("department"):
        conditions += " AND department = %(department)s"

    if filters.get("show_expired"):
        conditions += " AND expire_on < CURDATE()"

    elif filters.get("days_to_expire"):
        conditions += """
            AND expire_on BETWEEN CURDATE()
            AND DATE_ADD(CURDATE(), INTERVAL %(days_to_expire)s DAY)
        """

    return conditions