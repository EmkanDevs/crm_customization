# customer_portal_document.py

import frappe
from frappe.model.document import Document
from frappe.utils import nowdate, date_diff


class CustomerPortalDocument(Document):

    def before_save(self):
        # 1. Get the previous version of the document from the database
        old_doc = self.get_doc_before_save()

        # 2. Logic for EXISTING documents
        if old_doc:
            if self.attachment and self.attachment != old_doc.attachment:
                self.log_to_history(self.attachment)
        
        # 3. Logic for NEW documents (first time saving)
        else:
            if self.attachment:
                self.log_to_history(self.attachment)

    def log_to_history(self, file_url):
        if self.attachment_history:
            last_entry = self.attachment_history[-1].file_url
            if last_entry == file_url:
                return

        self.append("attachment_history", {
            "file_url": file_url,
            "uploaded_on": frappe.utils.now_datetime(),
            "uploaded_by": frappe.session.user
        })
            

    def validate(self):
        self.set_expire_in_days()
        self.set_updated_by()

    def set_expire_in_days(self):
        if self.next_update:
            self.expire_in_days = date_diff(self.next_update, nowdate())
        else:
            self.expire_in_days = None

    def set_updated_by(self):
        # Always set current session user
        self.updated_by = frappe.session.user
