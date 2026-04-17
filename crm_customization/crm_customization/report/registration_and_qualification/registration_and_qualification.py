# import frappe
# from frappe import _

# def execute(filters=None):
#     columns = get_columns()
#     data = get_data(filters)
#     report_summary = get_report_summary(data)
#     return columns, data, None, None, report_summary

# def get_columns():
#     return [
#         {
#             "label": _("Company"),
#             "fieldname": "company",
#             "fieldtype": "Link",
#             "options": "Subsidairy Company",
#             "width": 160
#         },
#         {"label": _("Business Request"), "fieldname": "business_request", "fieldtype": "Link", "options": "Business Request", "width": 150},
#         {"label": _("Request Date"), "fieldname": "request_date", "fieldtype": "Date", "width": 120},
#         {"label": _("Client"), "fieldname": "client", "fieldtype": "Link", "options": "Customer", "width": 180},
#         {"label": _("BD Task"), "fieldname": "bd_task", "fieldtype": "Data", "width": 220},
#         {"label": _("Registration"), "fieldname": "reg", "fieldtype": "Check", "width": 100},
#         {"label": _("Registration Status"), "fieldname": "registration_status", "fieldtype": "Data", "width": 180},
#         {"label": _("PQ"), "fieldname": "pq", "fieldtype": "Check", "width": 80},
#         {"label": _("PQ Project"), "fieldname": "pq_project", "fieldtype": "Check", "width": 120},
#         {"label": _("Vendor No"), "fieldname": "vendor_no", "fieldtype": "Data", "width": 140},
#         {"label": _("GBS / 9COM / 9CAT"), "fieldname": "cat_group_1", "fieldtype": "Check", "width": 160},
#         {"label": _("CPA / Others"), "fieldname": "cat_group_2", "fieldtype": "Check", "width": 140},
#         {"label": _("Status"), "fieldname": "status", "fieldtype": "Data", "width": 150},
#         {"label": _("Stage"), "fieldname": "stage", "fieldtype": "Data", "width": 140},
#     ]

# def get_period_dates(filters):
#     """
#     Resolve from_date and to_date based on period selection and its sub-filters.
#     - Monthly:    uses 'month' + 'year'
#     - Quarterly:  uses 'range' preset (This Month, Last Month, Last Quarter, etc.)
#     - Yearly:     uses 'year'
#     - Custom:     uses 'from_date' + 'to_date'
#     """
#     import calendar
#     from datetime import date
#     from dateutil.relativedelta import relativedelta

#     period = filters.get("period")

#     if not period:
#         return None, None

#     if period == "Custom":
#         return filters.get("from_date"), filters.get("to_date")

#     today = date.today()

#     if period == "Monthly":
#         month_name = filters.get("month")
#         year = filters.get("year")
#         if not month_name or not year:
#             return None, None

#         month_names = [
#             "January", "February", "March", "April", "May", "June",
#             "July", "August", "September", "October", "November", "December"
#         ]
#         month_num = month_names.index(month_name) + 1 if month_name in month_names else None
#         if not month_num:
#             return None, None

#         year = int(year)
#         from_date = date(year, month_num, 1)
#         last_day = calendar.monthrange(year, month_num)[1]
#         to_date = date(year, month_num, last_day)
#         return str(from_date), str(to_date)

#     if period == "Quarterly":
#         range_val = filters.get("range")
#         if not range_val:
#             return None, None

#         if range_val == "This Month":
#             from_date = date(today.year, today.month, 1)
#             last_day = calendar.monthrange(today.year, today.month)[1]
#             to_date = date(today.year, today.month, last_day)

#         elif range_val == "Last Month":
#             last_month = today - relativedelta(months=1)
#             from_date = date(last_month.year, last_month.month, 1)
#             last_day = calendar.monthrange(last_month.year, last_month.month)[1]
#             to_date = date(last_month.year, last_month.month, last_day)

#         elif range_val == "Last Quarter":
#             # Current quarter start, then go back 3 months
#             current_q_start_month = ((today.month - 1) // 3) * 3 + 1
#             current_q_start = date(today.year, current_q_start_month, 1)
#             prev_q_end = current_q_start - relativedelta(days=1)
#             prev_q_start = date(prev_q_end.year, ((prev_q_end.month - 1) // 3) * 3 + 1, 1)
#             from_date = prev_q_start
#             to_date = prev_q_end

#         elif range_val == "Last 3 Months":
#             from_date = today - relativedelta(months=3)
#             to_date = today

#         elif range_val == "Last 6 Months":
#             from_date = today - relativedelta(months=6)
#             to_date = today

#         elif range_val == "This Year":
#             from_date = date(today.year, 1, 1)
#             to_date = date(today.year, 12, 31)

#         else:
#             return None, None

#         return str(from_date), str(to_date)

#     if period == "Yearly":
#         year = filters.get("year")
#         if not year:
#             return None, None

#         from_date = date(int(year), 1, 1)
#         to_date = date(int(year), 12, 31)
#         return str(from_date), str(to_date)

#     return None, None

# def get_data(filters):
#     query_filters = {}

#     if filters.get("subsidiary_company"):
#         query_filters["parent"] = filters.get("subsidiary_company")
#     if filters.get("vendor"):
#         query_filters["vendor_no"] = ["like", f"%{filters.get('vendor')}%"]
#     if filters.get("status"):
#         query_filters["status"] = filters.get("status")
#     if filters.get("stage"):
#         query_filters["stage"] = filters.get("stage")
#     if filters.get("registration"):
#         query_filters["reg"] = ["not in", ["", "No", "Pending"]]
#     if filters.get("pre_qualification"):
#         query_filters["p_q"] = "Yes"

#     records = frappe.db.get_all(
#         "Subsidairy Company Task Register",
#         fields=[
#             "parent", "client", "bd_task", "reg", "registration_status",
#             "p_q", "pq_project", "vendor_no", "category",
#             "status", "stage"
#         ],
#         filters=query_filters,
#         order_by="parent, client, bd_task"
#     )

#     parent_names = list(set([r.parent for r in records]))

#     # ✅ Resolve dates from period (handles Monthly/Quarterly/Yearly/Custom)
#     from_date, to_date = get_period_dates(filters)

#     br_filters = {"subsidairy_company": ["in", parent_names]}

#     if from_date and to_date:
#         br_filters["request_date"] = ["between", [from_date, to_date]]
#     elif from_date:
#         br_filters["request_date"] = [">=", from_date]
#     elif to_date:
#         br_filters["request_date"] = ["<=", to_date]

#     br_records = frappe.db.get_all(
#         "Business Request",
#         filters=br_filters,
#         fields=["name", "subsidairy_company", "request_date", "customer", "bd_tasks"]
#     )

#     parent_map = {}
#     for br in br_records:
#         if br.subsidairy_company not in parent_map:
#             parent_map[br.subsidairy_company] = []
#         parent_map[br.subsidairy_company].append({
#             "br_id": br.name,
#             "request_date": br.request_date,
#             "customer": br.customer,
#             "bd_tasks": br.bd_tasks,
#             "used": False
#         })

#     data = []
#     for r in records:
#         status_val = (r.status or r.registration_status or "Not Started").strip()
#         if status_val == "Pending":
#             status_val = "Pending Approval"

#         category = (r.category or "").strip()
#         is_cat1 = 1 if category in ["GBS", "9COM", "9CAT"] else 0

#         br_list = parent_map.get(r.parent, [])
#         matched_br = None

#         # 1. Exact match first
#         for br in br_list:
#             if not br["used"] and br["customer"] == r.client and br["bd_tasks"] == r.bd_task:
#                 matched_br = br
#                 br["used"] = True
#                 break

#         # 2. Fallback to first unused BR
#         if not matched_br:
#             for br in br_list:
#                 if not br["used"]:
#                     matched_br = br
#                     br["used"] = True
#                     break

#         # Skip rows with no matching BR when date filter is active
#         if (from_date or to_date) and not matched_br:
#             continue

#         data.append({
#             "company": r.parent,
#             "business_request": matched_br["br_id"] if matched_br else None,
#             "request_date": matched_br["request_date"] if matched_br else None,
#             "client": r.client,
#             "bd_task": r.bd_task,
#             "reg": 1 if (r.reg and r.reg not in ["", "No", "Pending"]) else 0,
#             "registration_status": status_val,
#             "pq": 1 if r.p_q == "Yes" else 0,
#             "pq_project": 1 if r.pq_project == "Yes" else 0,
#             "vendor_no": r.vendor_no,
#             "cat_group_1": is_cat1,
#             "cat_group_2": 1 if (category and not is_cat1) else 0,
#             "status": status_val,
#             "stage": r.stage,
#         })

#     # Append unmatched Business Requests
#     for company, br_list in parent_map.items():
#         for br in br_list:
#             if not br["used"]:
#                 data.append({
#                     "company": company,
#                     "business_request": br["br_id"],
#                     "request_date": br["request_date"],
#                     "client": br["customer"],
#                     "bd_task": br["bd_tasks"],
#                     "reg": 0,
#                     "registration_status": "Not Started",
#                     "pq": 0,
#                     "pq_project": 0,
#                     "vendor_no": "",
#                     "cat_group_1": 0,
#                     "cat_group_2": 0,
#                     "status": "Not Started",
#                     "stage": "",
#                 })

#     return data

# def get_report_summary(data):
#     if not data:
#         return []
#     m = {"reg": 0, "pq": 0, "pq_proj": 0, "cat_1": 0, "cat_2": 0}
#     for d in data:
#         if d.get("reg"): m["reg"] += 1
#         if d.get("pq"):  m["pq"] += 1
#         if d.get("pq_project"): m["pq_proj"] += 1
#         if d.get("cat_group_1"): m["cat_1"] += 1
#         if d.get("cat_group_2"): m["cat_2"] += 1

#     return [
#         {"value": m["reg"],     "label": _("Total Registrations"), "indicator": "Blue",   "datatype": "Int"},
#         {"value": m["pq"],      "label": _("Total PQ"),            "indicator": "Orange", "datatype": "Int"},
#         {"value": m["pq_proj"], "label": _("Total PQ Projects"),   "indicator": "Green",  "datatype": "Int"},
#         {"value": m["cat_1"],   "label": _("GBS/9COM/9CAT"),       "indicator": "Cyan",   "datatype": "Int"},
#         {"value": m["cat_2"],   "label": _("CPA/Others"),          "indicator": "Purple", "datatype": "Int"},
#     ]














import frappe
from datetime import datetime

# ---------------------------------------------------------
# MAIN
# ---------------------------------------------------------
def execute(filters=None):
    filters = filters or {}

    period_type = filters.get("period_type")
    year = filters.get("year")

    if not period_type or not year:
        return get_columns([]), [], None, None, []

    periods = get_periods(period_type, int(year))
    columns = get_columns(periods)
    data = get_data(filters, periods, period_type, int(year))
    report_summary = get_report_summary(data)

    return columns, data, None, None, report_summary


# ---------------------------------------------------------
# PERIODS
# ---------------------------------------------------------
def get_periods(period_type, year):

    if period_type == "Monthly":
        return [
            ("jan", f"Jan {year}", 1),
            ("feb", f"Feb {year}", 2),
            ("mar", f"Mar {year}", 3),
            ("apr", f"Apr {year}", 4),
            ("may", f"May {year}", 5),
            ("jun", f"Jun {year}", 6),
            ("jul", f"Jul {year}", 7),
            ("aug", f"Aug {year}", 8),
            ("sep", f"Sep {year}", 9),
            ("oct", f"Oct {year}", 10),
            ("nov", f"Nov {year}", 11),
            ("dec", f"Dec {year}", 12),
        ]

    elif period_type == "Quarterly":
        return [
            ("q1", f"Q1 {year}", (1, 3)),
            ("q2", f"Q2 {year}", (4, 6)),
            ("q3", f"Q3 {year}", (7, 9)),
            ("q4", f"Q4 {year}", (10, 12)),
        ]

    elif period_type == "Yearly":
        return [
            (str(year), str(year), year)
        ]

    return []


# ---------------------------------------------------------
# COLUMNS
# ---------------------------------------------------------
def get_columns(periods):
    columns = [
        {"label": frappe._("Company"), "fieldname": "company", "fieldtype": "Link", "options": "Subsidairy Company", "width": 160},
        {"label": frappe._("Business Request"), "fieldname": "business_request", "fieldtype": "Link", "options": "Business Request", "width": 150},
        {"label": frappe._("Request Date"), "fieldname": "request_date", "fieldtype": "Date", "width": 120},
        {"label": frappe._("Client"), "fieldname": "client", "fieldtype": "Link", "options": "Customer", "width": 180},
        {"label": frappe._("BD Task"), "fieldname": "bd_task", "fieldtype": "Data", "width": 220},
        {"label": frappe._("Registration"), "fieldname": "reg", "fieldtype": "Check", "width": 100},
        {"label": frappe._("Registration Status"), "fieldname": "registration_status", "fieldtype": "Data", "width": 180},
        {"label": frappe._("PQ"), "fieldname": "pq", "fieldtype": "Check", "width": 80},
        {"label": frappe._("PQ Project"), "fieldname": "pq_project", "fieldtype": "Check", "width": 120},
        {"label": frappe._("Vendor No"), "fieldname": "vendor_no", "fieldtype": "Data", "width": 140},
        {"label": frappe._("GBS / 9COM / 9CAT"), "fieldname": "cat_group_1", "fieldtype": "Check", "width": 160},
        {"label": frappe._("CPA / Others"), "fieldname": "cat_group_2", "fieldtype": "Check", "width": 140},
        {"label": frappe._("Status"), "fieldname": "status", "fieldtype": "Data", "width": 150},
        {"label": frappe._("Stage"), "fieldname": "stage", "fieldtype": "Data", "width": 140},
    ]

    # 🔥 Dynamic columns
    if periods:
        for key, label, _ in periods:
            columns.append({
                "label": label,
                "fieldname": key,
                "fieldtype": "Check",
                "width": 100
            })

    return columns


# ---------------------------------------------------------
# DATA
# ---------------------------------------------------------
def get_data(filters, periods, period_type, year):

    query_filters = {}

    if filters.get("subsidiary_company"):
        query_filters["parent"] = filters.get("subsidiary_company")

    records = frappe.db.get_all(
        "Subsidairy Company Task Register",
        fields=[
            "parent", "client", "bd_task", "reg", "registration_status",
            "p_q", "pq_project", "vendor_no", "category",
            "status", "stage"
        ],
        filters=query_filters
    )

    parent_names = list(set([r.parent for r in records]))

    br_records = frappe.db.get_all(
        "Business Request",
        filters={"subsidairy_company": ["in", parent_names]},
        fields=["name", "subsidairy_company", "request_date", "customer", "bd_tasks"]
    )

    parent_map = {}
    for br in br_records:
        parent_map.setdefault(br.subsidairy_company, []).append({
            "br_id": br.name,
            "request_date": br.request_date,
            "customer": br.customer,
            "bd_tasks": br.bd_tasks,
            "used": False
        })

    data = []

    for r in records:

        status_val = (r.status or r.registration_status or "Not Started").strip()
        if status_val == "Pending":
            status_val = "Pending Approval"

        category = (r.category or "").strip()
        is_cat1 = 1 if category in ["GBS", "9COM", "9CAT"] else 0

        row = {
            "company": r.parent,
            "client": r.client,
            "bd_task": r.bd_task,
            "reg": 1 if (r.reg and r.reg not in ["", "No", "Pending"]) else 0,
            "registration_status": status_val,
            "pq": 1 if r.p_q == "Yes" else 0,
            "pq_project": 1 if r.pq_project == "Yes" else 0,
            "vendor_no": r.vendor_no,
            "cat_group_1": is_cat1,
            "cat_group_2": 1 if (category and not is_cat1) else 0,
            "status": status_val,
            "stage": r.stage,
        }

        br_list = parent_map.get(r.parent, [])
        matched_br = None

        # match BR
        for br in br_list:
            if not br["used"] and br["customer"] == r.client and br["bd_tasks"] == r.bd_task:
                matched_br = br
                br["used"] = True
                break

        if not matched_br and br_list:
            matched_br = br_list[0]

        if matched_br:
            row["business_request"] = matched_br["br_id"]
            row["request_date"] = matched_br["request_date"]

            if matched_br["request_date"]:
                d = matched_br["request_date"]

                # 🔥 PERIOD MAPPING
                for key, _, val in periods:

                    if period_type == "Monthly":
                        if d.month == val and d.year == year:
                            row[key] = 1

                    elif period_type == "Quarterly":
                        start, end = val
                        if start <= d.month <= end and d.year == year:
                            row[key] = 1

                    elif period_type == "Yearly":
                        if d.year == year:
                            row[key] = 1

        data.append(row)

    return data


# ---------------------------------------------------------
# SUMMARY
# ---------------------------------------------------------
def get_report_summary(data):
    if not data:
        return []

    m = {"reg": 0, "pq": 0, "pq_proj": 0, "cat_1": 0, "cat_2": 0}

    for d in data:
        if d.get("reg"): m["reg"] += 1
        if d.get("pq"): m["pq"] += 1
        if d.get("pq_project"): m["pq_proj"] += 1
        if d.get("cat_group_1"): m["cat_1"] += 1
        if d.get("cat_group_2"): m["cat_2"] += 1

    return [
        {"value": m["reg"], "label": frappe._("Total Registrations"), "indicator": "Blue"},
        {"value": m["pq"], "label": frappe._("Total PQ"), "indicator": "Orange"},
        {"value": m["pq_proj"], "label": frappe._("Total PQ Projects"), "indicator": "Green"},
        {"value": m["cat_1"], "label": frappe._("GBS/9COM/9CAT"), "indicator": "Cyan"},
        {"value": m["cat_2"], "label": frappe._("CPA/Others"), "indicator": "Purple"},
    ]