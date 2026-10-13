"""Business Development Management Dashboard — backend service.

All values are calculated from the shared canonical dataset produced by
``crm_customization.crm_customization.alessa_bd_common`` so the dashboard, the
Registration & Qualification report and the Business Request Insights report
interpret the source records identically.
"""

from datetime import date, timedelta

import frappe
from frappe import _

from crm_customization.crm_customization.page.alessa_management_bd.alessa_bd_common import (
    PIPELINE_CATEGORIES,
    REG_VS_PQ_CATEGORIES,
    build_canonical_rows,
    is_direct,
    is_done,
    is_pq_completed,
    is_pq_pending,
    is_reg_completed,
    is_reg_pending,
    is_rfq_active,
    norm,
    norm_lower,
    normalize_filters,
)

# Data-completeness fields and their display colours.
_COMPLETENESS_FIELDS = [
    ("Client Category", "client_category", "#0ea5e9"),
    ("Assigned To", "assigned_to", "#d97706"),
    ("Last Follow-up", "last_follow_up", "#8b5cf6"),
    ("Next Action", "next_action", "#8b5cf6"),
    ("Target Date", "target_date", "#10b981"),
    ("Priority", "priority", "#d97706"),
]

_ACTIVE_MONTH_COUNT = 12


@frappe.whitelist(allow_guest=False)
def get_filter_options():
    """Return the dropdown options used by the dashboard filter bar."""
    customers = frappe.get_list(
        "Customer",
        filters={"disabled": 0},
        pluck="name",
        order_by="name asc",
        limit_page_length=0,
    )
    subsidiaries = frappe.get_list(
        "Subsidairy Company",
        fields=["subsidairy_company"],
        order_by="subsidairy_company asc",
        limit_page_length=0,
    )
    subsidiaries = sorted(
        {
            norm(row.get("subsidairy_company"))
            for row in subsidiaries
            if norm(row.get("subsidairy_company"))
        },
        key=str.lower,
    )
    categories = frappe.get_list(
        "BD Request Category",
        pluck="name",
        order_by="name asc",
        limit_page_length=0,
    )
    users = frappe.get_list(
        "User",
        filters={"enabled": 1, "user_type": "System User"},
        fields=["name", "full_name"],
        order_by="full_name asc",
        limit_page_length=0,
    )
    pq_statuses = _distinct_column(
        "Subsidairy Company Task Register", "status", parent_doctype="Subsidairy Company"
    )
    reg_statuses = _distinct_column(
        "Subsidairy Company Task Register",
        "registration_status",
        parent_doctype="Subsidairy Company",
    )

    return {
        "customers": customers,
        "subsidiaries": subsidiaries,
        "categories": categories,
        "users": users,
        # Opportunity stages are always the DERIVED exclusive stages — never raw child.stage.
        "stages": list(PIPELINE_CATEGORIES),
        "registration_statuses": _with_blank(reg_statuses),
        "pq_statuses": _with_blank(pq_statuses),
        "priorities": ["High", "Medium", "Low"],
    }


def _distinct_column(doctype, fieldname, parent_doctype=None):
    """Return sorted distinct non-empty values for a column."""
    rows = frappe.get_list(
        doctype,
        fields=[fieldname],
        parent_doctype=parent_doctype,
        limit_page_length=0,
    )
    values = {norm(row.get(fieldname)) for row in rows}
    return sorted(value for value in values if value)


def _with_blank(values):
    options = [v for v in values if norm(v)]
    options.append("Blank")
    return options


@frappe.whitelist(allow_guest=False)
def get_dashboard_data(filters=None):
    """Return every dashboard KPI/chart/table from one filtered canonical set."""
    filters = normalize_filters(filters)
    rows = build_canonical_rows(filters)

    today = date.today()
    in_14_days = today + timedelta(days=14)
    thirty_days_ago = today - timedelta(days=30)

    clients_records = len(rows)
    reg_completed = sum(1 for r in rows if is_reg_completed(r))
    pq_completed = sum(1 for r in rows if is_pq_completed(r))
    rfq_active = sum(1 for r in rows if is_rfq_active(r))
    direct = sum(1 for r in rows if is_direct(r))
    reg_pending = sum(1 for r in rows if is_reg_pending(r))
    pq_pending = sum(1 for r in rows if is_pq_pending(r))
    high_priority = sum(1 for r in rows if r["priority"] == "High")

    overdue_actions = 0
    due_next_14 = 0
    stale_followup = 0
    for row in rows:
        if is_done(row):
            continue
        target = row["target_date"]
        if target and target < today:
            overdue_actions += 1
        if target and today <= target <= in_14_days:
            due_next_14 += 1
        if row["last_follow_up"] and row["last_follow_up"] < thirty_days_ago and row["next_action"]:
            stale_followup += 1

    pipeline_values = _pipeline_values(rows)
    reg_vs_pq = _reg_vs_pq(rows)
    management_attention = {
        "overdue_actions": overdue_actions,
        "due_next_14": due_next_14,
        "high_priority": high_priority,
        "stale_followup": stale_followup,
        "total_signals": overdue_actions + due_next_14 + high_priority + stale_followup,
    }

    return {
        "clients_records": clients_records,
        "reg_completed": reg_completed,
        "pq_completed": pq_completed,
        "rfq_active": rfq_active,
        "direct": direct,
        "overdue_actions": overdue_actions,
        "due_next_14": due_next_14,
        "high_priority": high_priority,
        "reg_pending": reg_pending,
        "pq_pending": pq_pending,
        "pipeline": {"categories": list(PIPELINE_CATEGORIES), "values": pipeline_values},
        "reg_vs_pq": reg_vs_pq,
        "management_attention": management_attention,
        "monthly_progress": _monthly_progress(rows, today),
        "owner_performance": _owner_performance(rows, today),
        "data_completeness": _data_completeness(rows),
        "priority_actions": _priority_actions(rows, today, thirty_days_ago),
    }


# ---------------------------------------------------------------------------
# Section builders
# ---------------------------------------------------------------------------

def _pipeline_values(rows):
    values = {category: 0 for category in PIPELINE_CATEGORIES}
    for row in rows:
        stage = row.get("opportunity_stage")
        if stage in values:
            values[stage] += 1
    return [values[category] for category in PIPELINE_CATEGORIES]


def _bucket_status(status, buckets):
    text = norm_lower(status)
    if text in ("completed", "registered", "qualified"):
        buckets["Completed"] += 1
    elif text == "in process":
        buckets["In Process"] += 1
    elif text == "pending approval":
        buckets["Pending Approval"] += 1
    elif text == "in hold":
        buckets["In Hold"] += 1
    elif text == "rejected":
        buckets["Rejected"] += 1
    elif text == "not started":
        buckets["Not Started"] += 1
    elif text == "not qualified":
        buckets["Not Qualified"] += 1
    else:
        buckets["Blank"] += 1


def _reg_vs_pq(rows):
    registration = {category: 0 for category in REG_VS_PQ_CATEGORIES}
    pq = {category: 0 for category in REG_VS_PQ_CATEGORIES}
    for row in rows:
        _bucket_status(row.get("registration_status"), registration)
        _bucket_status(row.get("pq_status"), pq)
    return {
        "categories": list(REG_VS_PQ_CATEGORIES),
        "registration": [registration[category] for category in REG_VS_PQ_CATEGORIES],
        "pq": [pq[category] for category in REG_VS_PQ_CATEGORIES],
    }


def _monthly_progress(rows, today):
    keys = _trailing_months(today.replace(day=1), _ACTIVE_MONTH_COUNT)
    reg_approved = [0] * len(keys)
    pq_approved = [0] * len(keys)
    rfq_received = [0] * len(keys)

    for row in rows:
        for index, (year, month) in enumerate(keys):
            reg = row.get("registration_approval_date")
            if reg and reg.year == year and reg.month == month:
                reg_approved[index] += 1
            pq = row.get("pq_approval_date")
            if pq and pq.year == year and pq.month == month:
                pq_approved[index] += 1
            rfq = row.get("rfq_received_date")
            if rfq and rfq.year == year and rfq.month == month:
                rfq_received[index] += 1

    return {
        "months": [date(year, month, 1).strftime("%b-%Y") for year, month in keys],
        "reg_approved": reg_approved,
        "pq_approved": pq_approved,
        "rfq_received": rfq_received,
    }


def _trailing_months(end_month, count):
    """Return the last ``count`` (year, month) tuples ending at ``end_month``."""
    months = []
    year, month = end_month.year, end_month.month
    for _ in range(count):
        months.append((year, month))
        month -= 1
        if month == 0:
            month = 12
            year -= 1
    return list(reversed(months))


def _owner_performance(rows, today):
    owners = {}
    for row in rows:
        name = row.get("assigned_to")
        if not name:
            continue
        entry = owners.setdefault(
            name,
            {"name": name, "assigned": 0, "reg_completed": 0, "pq_completed": 0, "overdue": 0},
        )
        entry["assigned"] += 1
        if is_reg_completed(row):
            entry["reg_completed"] += 1
        if is_pq_completed(row):
            entry["pq_completed"] += 1
        target = row.get("target_date")
        if target and target < today and not is_done(row):
            entry["overdue"] += 1

    ordered = sorted(owners.values(), key=lambda item: item["assigned"], reverse=True)[:10]
    for entry in ordered:
        assigned = entry["assigned"]
        completed = entry["reg_completed"] + entry["pq_completed"]
        entry["completion_pct"] = round(completed * 100.0 / (assigned * 2), 1) if assigned else 0
    return ordered


def _data_completeness(rows):
    total = len(rows)
    if not total:
        return {"total": 0, "total_missing": 0, "fields": []}

    fields = []
    total_missing = 0
    for label, key, color in _COMPLETENESS_FIELDS:
        missing = sum(1 for row in rows if not row.get(key))
        total_missing += missing
        fields.append(
            {
                "field": label,
                "missing": missing,
                "percentage": round((total - missing) * 100.0 / total, 1),
                "color": color,
            }
        )
    return {"total": total, "total_missing": total_missing, "fields": fields}


def _priority_actions(rows, today, thirty_days_ago):
    actions = []
    for row in rows:
        target = row.get("target_date")
        days_due = (target - today).days if target else None
        priority = row.get("priority")
        last_follow_up = row.get("last_follow_up")
        next_action = row.get("next_action")

        include = (
            (days_due is not None and days_due < 0)
            or (days_due is not None and 0 <= days_due <= 14)
            or priority == "High"
            or (last_follow_up and last_follow_up < thirty_days_ago and next_action)
        )
        if not include:
            continue

        if target is None:
            action_status = "No Due Date"
        elif days_due < 0:
            action_status = "Overdue"
        elif days_due <= 7:
            action_status = "Due This Week"
        elif days_due <= 14:
            action_status = "Due Next 14 Days"
        else:
            action_status = "Upcoming"

        registration_status = row.get("registration_status")
        pq_status = row.get("pq_status")
        actions.append(
            {
                "client": row.get("client") or "-",
                "scope": row.get("scope") or "-",
                "owner": row.get("assigned_to") or "-",
                # Never fabricate a priority that does not exist on the record.
                "priority": priority or "",
                "stage": row.get("opportunity_stage") or "",
                "registration": "Completed" if is_reg_completed(row)
                else (registration_status.title() if registration_status else "Blank"),
                "pq": "Completed" if is_pq_completed(row)
                else (pq_status.title() if pq_status else "Blank"),
                "last_followup": last_follow_up.strftime("%d %b %Y") if last_follow_up else "",
                "next_action": next_action or "",
                "target_date": target.strftime("%d %b %Y") if target else "-",
                "days_to_due": days_due if days_due is not None else "",
                "action_status": action_status,
            }
        )
    return actions


@frappe.whitelist(allow_guest=False)
def get_report_data(report_name, filters=None):
    """Execute a Query Report and return its tabular result."""
    filters = normalize_filters(filters)
    from frappe.desk.query_report import run

    result = run(report_name, filters)
    return {
        "columns": result.get("columns", []),
        "result": result.get("result", []),
        "report_summary": result.get("report_summary", []),
    }
