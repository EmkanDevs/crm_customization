import frappe

def execute(filters=None):
    columns = get_columns()
    data = get_data(filters)
    return columns, data

def get_columns():
    return [
        {
            "label": "Subsidiary",
            "fieldname": "subsidairy_company",
            "fieldtype": "Link",
            "options": "Subsidairy Company",
            "width": 220
        },
        {
            "label": "Document ID",
            "fieldname": "parent_id",
            "fieldtype": "Link",
            "options": "Customer Portal Document",
            "width": 200
        },
        {
            "label": "Customer",
            "fieldname": "customer",
            "fieldtype": "Link",
            "options": "Customer",
            "width": 250
        },
        {
            "label": "Document Type",
            "fieldname": "document_type",
            "fieldtype": "Link",
            "options": "Company Document Type",
            "width": 200
        },
        {
            "label": "Archived File",
            "fieldname": "file_url",
            "fieldtype": "Attach",
            "width": 250
        },
        {
            "label": "Archived On",
            "fieldname": "uploaded_on",
            "fieldtype": "Datetime",
            "width": 250
        },
        {
            "label": "Archived By",
            "fieldname": "uploaded_by",
            "fieldtype": "Link",
            "options": "User",
            "width": 200
        }
    ]

def get_data(filters):
    conditions = get_conditions(filters)
    
    # Note: Replace 'tabPrevious Uploads' with the actual table name of your Child Table
    # You can find this in the DocType 'Previous Uploads' or check the DB
    data = frappe.db.sql(f"""
        SELECT
            child.parent as parent_id,
            child.file_url,
            child.uploaded_on,
            child.uploaded_by,
            
            parent.customer,
            parent.subsidairy_company,
            parent.document_type
        FROM 
            `tabAttachment History` child
        LEFT JOIN 
            `tabCustomer Portal Document` parent ON child.parent = parent.name
        WHERE 
            1=1 {conditions}
        ORDER BY 
            parent.subsidairy_company ASC, 
            child.parent ASC, 
            child.uploaded_on DESC
    """, filters, as_dict=1)

    return data

def get_conditions(filters):
    conditions = ""

    if filters.get("customer"):
        conditions += " AND parent.customer = %(customer)s"

    if filters.get("subsidairy_company"):
        conditions += " AND parent.subsidairy_company = %(subsidairy_company)s"

    if filters.get("document_type"):
        conditions += " AND parent.document_type = %(document_type)s"

    return conditions