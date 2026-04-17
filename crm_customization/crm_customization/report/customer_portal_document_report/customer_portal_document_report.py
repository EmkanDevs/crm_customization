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
            "options": "Customer Portal Document",
            "width": 180
        },
        {
            "label": "Customer",
            "fieldname": "customer",
            "fieldtype": "Link",
            "options": "Customer",
            "width": 180
        },
        {
            "label": "Subsidiary",
            "fieldname": "subsidairy_company",
            "fieldtype": "Link",
            "options": "Subsidairy Company",
            "width": 250
        },
        {
            "label": "Document Type",
            "fieldname": "document_type",
            "fieldtype": "Link",
            "options": "Company Document Type",
            "width": 250
        },
        {
            "label": "Updated On",
            "fieldname": "updated_on",
            "fieldtype": "Date",
            "width": 120
        },
        # {
        #     "label": "Updated By",
        #     "fieldname": "updated_by",
        #     "fieldtype": "Link",
        #     "options": "User",
        #     "width": 150
        # },
        {
            "label": "Next Update",
            "fieldname": "next_update",
            "fieldtype": "Date",
            "width": 120
        },
        # {
        #     "label": "Next Update By",
        #     "fieldname": "next_update_by",
        #     "fieldtype": "Link",
        #     "options": "User",
        #     "width": 150
        # },
        {
            "label": "Days Remaining",
            "fieldname": "days_remaining",
            "fieldtype": "Int",
            "width": 130
        },
    ]


def get_data(filters):
    conditions = get_conditions(filters)

    data = frappe.db.sql(f"""
        SELECT
            name,
            customer,
            subsidairy_company,
            document_type,
            updated_on,
            updated_by,
            next_update,
            next_update_by,
            attachment,
            remarks,

            DATEDIFF(next_update, CURDATE()) AS days_remaining,

            CASE
                WHEN next_update < CURDATE() THEN 'Expired'
                WHEN DATEDIFF(next_update, CURDATE()) <= 30 THEN 'Expiring Soon'
                ELSE 'Active'
            END AS status

        FROM `tabCustomer Portal Document`
        WHERE docstatus < 2
        {conditions}
        ORDER BY next_update ASC
    """, filters, as_dict=1)

    return data


def get_conditions(filters):
    conditions = ""

    if filters.get("customer"):
        conditions += " AND customer = %(customer)s"

    if filters.get("subsidairy_company"):
        conditions += " AND subsidairy_company = %(subsidairy_company)s"

    if filters.get("document_type"):
        conditions += " AND document_type = %(document_type)s"

    if filters.get("show_expired"):
        conditions += " AND next_update < CURDATE()"

    elif filters.get("days_to_expire"):
        conditions += """
            AND next_update BETWEEN CURDATE()
            AND DATE_ADD(CURDATE(), INTERVAL %(days_to_expire)s DAY)
        """

    return conditions