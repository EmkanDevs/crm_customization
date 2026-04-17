# Copyright (c) 2026, Finbyz and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import nowdate, getdate, add_days
from frappe.utils import get_url
from frappe.email.doctype.email_queue.email_queue import EmailQueue
from frappe import _

class DocumentExpiration(Document):
    pass

def send_expiry_email(docname, recipients, reminder_date):
    doc_url = frappe.utils.get_url_to_form("Document Expiration", docname)

    subject = f"Document Expired: {docname}"

    message = f"""
    <p>The document <b>{docname}</b> has exceeded its reminder period.</p>
    <p><b>Reminder Date:</b> {reminder_date}</p>
    <p><a href="{doc_url}">View Document</a></p>
    <p>Please take necessary action.</p>
    """
    print("Recipients:", recipients)
    frappe.sendmail(
        recipients=recipients,
        subject=subject,
        message=message,
        reference_doctype="Document Expiration",
        reference_name=docname,
        delayed=True
    )
    frappe.db.commit()
    # email = frappe.get_doc({
    #     "doctype": "Email Queue",
    #     "subject": subject,
    #     "message": message,
    #     "recipients": "\n".join(recipients),
    #     "reference_doctype": "Document Expiration",
    #     "reference_name": docname,
    # })

    # email.insert(ignore_permissions=True)

def check_document_expiration():
    today = getdate(nowdate())

    docs = frappe.get_all(
        "Document Expiration",
        fields=["name", "creation", "reminder_in_days", "department"]
    )

    for doc in docs:
        if not doc.reminder_in_days or not doc.department:
            continue

        creation_date = getdate(doc.creation)
        reminder_days = int(doc.reminder_in_days)
        reminder_date = add_days(creation_date, reminder_days)

        # Send email ONLY if today is outside reminder window
        if today > reminder_date:

            department_officer_doc = frappe.get_value(
                "Department Officer",
                {"department": doc.department},
                ["department_officer", "department_head"],
                as_dict=True
            )

            if not department_officer_doc:
                continue

            recipients = []

            if department_officer_doc.department_officer:
                recipients.append(department_officer_doc.department_officer)

            if department_officer_doc.department_head:
                recipients.append(department_officer_doc.department_head)

            if recipients:
                send_expiry_email(doc.name, recipients, reminder_date)