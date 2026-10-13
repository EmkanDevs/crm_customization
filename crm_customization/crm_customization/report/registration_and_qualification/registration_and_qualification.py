"""Registration and Qualification report.

Data is sourced from the shared canonical dataset so that this report and the
Business Development Management Dashboard always agree on:
  * Registration Status  (child.registration_status)
  * PQ Status            (child.status)
  * opportunity stage    (derived exclusive stage)
  * Business Request     (explicit link only)
  * priority             (row value or explicit-link value)
"""

import frappe
from frappe import _

from crm_customization.crm_customization.page.alessa_management_bd.alessa_bd_common import build_canonical_rows

_CAT_GROUP_1 = ("GBS", "9COM", "9CAT")


def execute(filters=None):
    filters = filters or {}

    period_type = filters.get("period_type")
    year = filters.get("year")
    if not period_type or not year:
        return get_columns([]), [], None, None, []

    year = int(year)
    periods = get_periods(period_type, year)
    columns = get_columns(periods)
    data = get_data(filters, periods, period_type, year)
    return columns, data, None, None, get_report_summary(data)


def get_periods(period_type, year):
    if period_type == "Monthly":
        return [
            ("jan", f"Jan {year}", 1), ("feb", f"Feb {year}", 2), ("mar", f"Mar {year}", 3),
            ("apr", f"Apr {year}", 4), ("may", f"May {year}", 5), ("jun", f"Jun {year}", 6),
            ("jul", f"Jul {year}", 7), ("aug", f"Aug {year}", 8), ("sep", f"Sep {year}", 9),
            ("oct", f"Oct {year}", 10), ("nov", f"Nov {year}", 11), ("dec", f"Dec {year}", 12),
        ]
    if period_type == "Quarterly":
        return [
            ("q1", f"Q1 {year}", (1, 3)), ("q2", f"Q2 {year}", (4, 6)),
            ("q3", f"Q3 {year}", (7, 9)), ("q4", f"Q4 {year}", (10, 12)),
        ]
    if period_type == "Yearly":
        return [(str(year), str(year), year)]
    return []


def get_columns(periods):
    columns = [
        {"label": _("Company"), "fieldname": "company", "fieldtype": "Link", "options": "Subsidairy Company", "width": 160},
        {"label": _("Business Request"), "fieldname": "business_request", "fieldtype": "Link", "options": "Business Request", "width": 150},
        {"label": _("Request Date"), "fieldname": "request_date", "fieldtype": "Date", "width": 120},
        {"label": _("Client"), "fieldname": "client", "fieldtype": "Link", "options": "Customer", "width": 180},
        {"label": _("Vendor No"), "fieldname": "vendor_no", "fieldtype": "Data", "width": 140},
        {"label": _("BD Task"), "fieldname": "bd_task", "fieldtype": "Data", "width": 220},
        {"label": _("Registration"), "fieldname": "reg", "fieldtype": "Check", "width": 100},
        {"label": _("Registration Status"), "fieldname": "registration_status", "fieldtype": "Data", "width": 180},
        {"label": _("PQ"), "fieldname": "pq", "fieldtype": "Check", "width": 80},
        {"label": _("PQ Project"), "fieldname": "pq_project", "fieldtype": "Check", "width": 120},
        {"label": _("GBS / 9COM / 9CAT"), "fieldname": "cat_group_1", "fieldtype": "Check", "width": 160},
        {"label": _("CPA / Others"), "fieldname": "cat_group_2", "fieldtype": "Check", "width": 140},
        {"label": _("Status"), "fieldname": "status", "fieldtype": "Data", "width": 150},
        {"label": _("Stage"), "fieldname": "stage", "fieldtype": "Data", "width": 140},
    ]
    for key, label, _value in periods:
        columns.append({"label": label, "fieldname": key, "fieldtype": "Check", "width": 100})
    return columns


def get_data(filters, periods, period_type, year):
    rows = build_canonical_rows(filters)
    data = []

    for row in rows:
        category = row.get("client_category") or ""
        is_cat_1 = 1 if category in _CAT_GROUP_1 else 0
        registration_flag = row.get("registration_flag") or ""
        pq_flag = row.get("pq_flag") or ""

        report_row = {
            "company": row.get("subsidiary_company"),
            "business_request": row.get("business_request"),
            "request_date": row.get("request_date"),
            "client": row.get("client"),
            "vendor_no": row.get("vendor_no"),
            "bd_task": row.get("scope"),
            "reg": 1 if registration_flag and registration_flag not in ("No", "Pending") else 0,
            "registration_status": row.get("registration_status"),
            "pq": 1 if pq_flag == "Yes" else 0,
            "pq_project": 1 if (row.get("pq_project_flag") == "Yes") else 0,
            "cat_group_1": is_cat_1,
            "cat_group_2": 1 if (category and not is_cat_1) else 0,
            "status": row.get("pq_status"),
            "stage": row.get("opportunity_stage"),
        }

        request_date = row.get("request_date")
        if request_date:
            for key, _label, value in periods:
                if period_type == "Monthly":
                    if request_date.month == value and request_date.year == year:
                        report_row[key] = 1
                elif period_type == "Quarterly":
                    start, end = value
                    if start <= request_date.month <= end and request_date.year == year:
                        report_row[key] = 1
                elif period_type == "Yearly":
                    if request_date.year == year:
                        report_row[key] = 1

        data.append(report_row)

    return data


def get_report_summary(data):
    if not data:
        return []

    counts = {"reg": 0, "pq": 0, "pq_proj": 0, "cat_1": 0, "cat_2": 0}
    for row in data:
        if row.get("reg"):
            counts["reg"] += 1
        if row.get("pq"):
            counts["pq"] += 1
        if row.get("pq_project"):
            counts["pq_proj"] += 1
        if row.get("cat_group_1"):
            counts["cat_1"] += 1
        if row.get("cat_group_2"):
            counts["cat_2"] += 1

    return [
        {"value": counts["reg"], "label": _("Total Registrations"), "indicator": "Blue"},
        {"value": counts["pq"], "label": _("Total PQ"), "indicator": "Orange"},
        {"value": counts["pq_proj"], "label": _("Total PQ Projects"), "indicator": "Green"},
        {"value": counts["cat_1"], "label": _("GBS/9COM/9CAT"), "indicator": "Cyan"},
        {"value": counts["cat_2"], "label": _("CPA/Others"), "indicator": "Purple"},
    ]
