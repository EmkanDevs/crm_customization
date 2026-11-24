# Copyright (c) 2026, Finbyz and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import getdate


class SubsidairyCompany(Document):
	def validate(self):
		self.set_request_raised_date()

	def set_request_raised_date(self):
		# Fill Request Raised Date from the linked Business Request when it is left empty.
		# A manually entered date is kept as is.
		for row in self.get("task_registered") or []:
			if row.bd_task_reference and not row.request_raised_date:
				request_date, creation = frappe.db.get_value(
					"Business Request", row.bd_task_reference, ["request_date", "creation"]
				) or (None, None)
				date = request_date or creation
				if date:
					row.request_raised_date = getdate(date)
