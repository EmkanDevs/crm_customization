# Copyright (c) 2026, Finbyz and contributors
# For license information, please see license.txt

from frappe.model.document import Document
from frappe.utils import date_diff


class ClientIssueRegister(Document):

    def validate(self):
        self.calculate_days_lost()

    def calculate_days_lost(self):
        if self.issue_start_date and self.business_resume_date:
            self.days_lost = date_diff(self.business_resume_date, self.issue_start_date)
        else:
            self.days_lost = 0