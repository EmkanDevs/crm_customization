import base64
import json

import frappe
from frappe import _

from frappe.utils.xlsxutils import make_xlsx, read_xlsx_file_from_attached_file


@frappe.whitelist(allow_guest=False)
def export_task_table(data):
	"""Build an .xlsx file from a 2D array and return base64 for client download."""
	if isinstance(data, str):
		data = json.loads(data)

	if not isinstance(data, list) or not data:
		frappe.throw(_("No data to export."))

	xlsx_file = make_xlsx(data, "Task Registered")
	return {
		"content": base64.b64encode(xlsx_file.getvalue()).decode("utf-8"),
		"filename": "Task Registered.xlsx",
	}


@frappe.whitelist(allow_guest=False)
def get_subsidiary_clients(subsidiary=None):
	"""Unique customers linked to a Subsidiary Company via Task Registered.

	Returns the distinct values of the `client` column of the company's
	`task_registered` child table, in the order they first appear.
	"""
	if not subsidiary:
		return []

	if not frappe.db.exists("Subsidairy Company", subsidiary):
		return []

	rows = frappe.get_list(
		"Subsidairy Company Task Register",
		filters={
			"parent": subsidiary,
			"parenttype": "Subsidairy Company",
			"parentfield": "task_registered",
		},
		fields=["client"],
		parent_doctype="Subsidairy Company",
		limit_page_length=500,
		order_by="idx asc",
	)

	clients = []
	for row in rows or []:
		client = (row.get("client") or "").strip()
		if client and client not in clients:
			clients.append(client)

	return clients


@frappe.whitelist(allow_guest=False)
def read_task_table_upload(dataurl=None, file_name=""):
	"""Read rows from an uploaded .xlsx data URL. Row 0 is the header."""
	from datetime import date, datetime, time

	if not dataurl:
		frappe.throw(_("No file content provided."))

	name = (file_name or "").lower()
	if not name.endswith(".xlsx"):
		frappe.throw(_("Please upload a valid .xlsx file."))

	content = base64.b64decode(dataurl.split(",", 1)[-1])
	rows = read_xlsx_file_from_attached_file(fcontent=content)

	cleaned = []
	for row in rows or []:
		clean_row = []
		for cell in row:
			if cell is None:
				clean_row.append("")
			elif isinstance(cell, datetime):
				clean_row.append(cell.strftime("%Y-%m-%d %H:%M:%S"))
			elif isinstance(cell, date):
				clean_row.append(cell.strftime("%Y-%m-%d"))
			elif isinstance(cell, time):
				clean_row.append(cell.strftime("%H:%M:%S"))
			elif isinstance(cell, float) and cell.is_integer():
				clean_row.append(str(int(cell)))
			else:
				clean_row.append(str(cell))
		cleaned.append(clean_row)

	return cleaned