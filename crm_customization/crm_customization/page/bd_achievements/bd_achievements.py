import base64
import json
from collections import defaultdict

import frappe
from frappe.utils import today, getdate

def _build_filters(filters):
    """Build ORM filters for the achievement list."""
    achievement_filters = []
    for field in ("year", "month", "company", "client", "sections"):
        value = filters.get(field)
        if value:
            achievement_filters.append([field, "=", value])

    if filters.get("from_date"):
        achievement_filters.append(["date", ">=", filters["from_date"]])
    if filters.get("to_date"):
        achievement_filters.append(["date", "<=", filters["to_date"]])

    if filters.get("sector"):
        parents = frappe.get_list(
            "Multiselect Sector",
            filters={"sector": filters["sector"], "parenttype": "BD Achievements"},
            parent_doctype="BD Achievements",
            pluck="parent",
            limit_page_length=0,
        )
        if not parents:
            return None
        achievement_filters.append(["name", "in", list(set(parents))])

    return achievement_filters

def _query_achievements(achievement_filters):
    """Query BD Achievement records and attach sector names for table display."""
    if achievement_filters is None:
        return []

    achievements = frappe.get_list(
        "BD Achievements",
        fields=[
            "name", "company", "year", "client", "date", "month", "month_no",
            "quarter", "sections", "vendor_no", "achievement", "creation",
        ],
        filters=achievement_filters,
        order_by="date desc",
        limit_page_length=0,
    )

    if achievements:
        sector_rows = frappe.get_list(
            "Multiselect Sector",
            fields=["parent", "sector"],
            filters={
                "parent": ["in", [a.name for a in achievements]],
                "parenttype": "BD Achievements",
            },
            parent_doctype="BD Achievements",
            order_by="parent asc, idx asc",
            limit_page_length=0,
        )
        sector_map = defaultdict(list)
        for row in sector_rows:
            if row.sector:
                sector_map[row.parent].append(row.sector)
        for ach in achievements:
            ach.sector = ", ".join(sector_map[ach.name])

    return achievements


def _top_value(field, achievement_filters):
    """Return the most frequent populated company or client for these filters."""
    if achievement_filters is None:
        return "N/A", 0

    rows = frappe.get_list(
        "BD Achievements",
        fields=[field, "count(*) as count"],
        filters=[*achievement_filters, [field, "!=", ""]],
        group_by=field,
        order_by="count desc",
        limit_page_length=1,
    )
    return (rows[0][field], rows[0].count) if rows else ("N/A", 0)

def _normalize_filters(filters):
    """Coerce the raw filters payload into the normalized dashboard filter keys."""
    if filters is None:
        filters = {}
    elif isinstance(filters, str):
        filters = json.loads(filters)

    return {
        "year": filters.get("year") or filters.get("fiscal_year"),
        "month": filters.get("month"),
        "company": filters.get("company"),
        "client": filters.get("client"),
        "sections": filters.get("sections") or filters.get("section"),
        "sector": filters.get("sector"),
        "from_date": filters.get("from_date"),
        "to_date": filters.get("to_date"),
    }

@frappe.whitelist(allow_guest=False)
def get_dashboard_data(filters=None):
    """
    Get dashboard data for BD Achievements
    """
    filters = _normalize_filters(filters)
    achievement_filters = _build_filters(filters)

    # Get all achievements (with sector names attached)
    achievements = _query_achievements(achievement_filters)

    # Calculate summary statistics
    total_achievements = len(achievements)

    # Companies supported
    companies_supported = len({ach.company for ach in achievements if ach.company})

    # Clients covered
    clients_covered = len({ach.client for ach in achievements if ach.client})

    # Top client (most achievements)
    top_client, top_client_count = _top_value("client", achievement_filters)

    # Top company
    top_company, top_company_count = _top_value("company", achievement_filters)

    # Count by achievement type (from the sections field)
    achievement_type_counts = get_achievement_type_counts(achievements)
    registrations = achievement_type_counts["registrations"]
    qualifications = achievement_type_counts["qualifications"]
    pq_projects = achievement_type_counts["pq_projects"]

    # Vendor nos count
    vendor_nos = len(set(ach.vendor_no for ach in achievements if ach.vendor_no))

    # Peak month (month with most achievements)
    month_counts = {}
    for ach in achievements:
        if ach.month and ach.year:
            key = f"{ach.month} {ach.year}"
            month_counts[key] = month_counts.get(key, 0) + 1
    peak_month = max(month_counts, key=month_counts.get) if month_counts else "N/A"

    # Monthly trend data
    monthly_trend = get_monthly_trend(achievements, filters.get("from_date"), filters.get("to_date"))

    # Company-wise breakdown
    company_breakdown = get_company_breakdown(achievements)

    # Client-wise breakdown
    client_breakdown = get_client_breakdown(achievements)

    # Sector breakdown (from multiselect)
    sector_breakdown = get_sector_breakdown(achievements)


    # Quarter view
    quarter_view = get_quarter_view(achievements)
    sections_breakdown = get_sections_breakdown(achievements)

    return {
        "total_achievements": total_achievements,
        "companies_supported": companies_supported,
        "clients_covered": clients_covered,
        "top_client": {
            "name": top_client,
            "count": top_client_count
        },
        "top_company": {
            "name": top_company,
            "count": top_company_count
        },
        "registrations": registrations,
        "qualifications": qualifications,
        "pq_projects": pq_projects,
        "vendor_nos": vendor_nos,
        "peak_month": peak_month,
        "monthly_trend": monthly_trend,
        "company_breakdown": company_breakdown,
        "client_breakdown": client_breakdown,
        "sector_breakdown": sector_breakdown,
        "quarter_view": quarter_view,
        "sections_breakdown": sections_breakdown,
        "achievements": achievements  # All records for paginated preview

    }

@frappe.whitelist(allow_guest=False)
def export_records(filters=None):
    """
    Export the filtered BD Achievement records as an Excel file.
    Returns the .xlsx content as base64 so the client can trigger a download.
    """
    from frappe.utils.xlsxutils import make_xlsx

    filters = _normalize_filters(filters)
    achievements = _query_achievements(_build_filters(filters))

    rows = [["Date", "Year", "Company", "Client", "Achievement", "Section", "Vendor No.", "Sector"]]
    for ach in achievements:
        rows.append([
            ach.date or "",
            ach.year or "",
            ach.company or "",
            ach.client or "",
            ach.achievement or "",
            ach.sections or "",
            ach.vendor_no or "",
            ach.sector or "",
        ])

    xlsx_file = make_xlsx(rows, "BD Achievement Records")
    return {
        "content": base64.b64encode(xlsx_file.getvalue()).decode("utf-8"),
        "filename": "BD Achievement Records.xlsx",
    }

def get_achievement_type_counts(achievements):
    """Count achievement types based on the sections field values"""
    counts = {"registrations": 0, "qualifications": 0, "pq_projects": 0}
    for ach in achievements:
        section = (ach.sections or "").strip().lower()
        if not section:
            continue
        if "project" in section:
            counts["pq_projects"] += 1
        elif "pq" in section or "qualif" in section:
            counts["qualifications"] += 1
        elif "regist" in section:
            counts["registrations"] += 1
    return counts

def get_current_fiscal_year():
    """Get current fiscal year"""
    today_date = getdate(today())
    year = today_date.year
    # If month is January-June, it's previous fiscal year
    if today_date.month <= 6:
        return f"{year-1}-{year}"
    else:
        return f"{year}-{year+1}"

def get_monthly_trend(achievements, from_date=None, to_date=None):
    """Get monthly trend data - always shows Jan 2025 to Dec 2026 (24 months)"""
    from datetime import date

    # Fixed 24-month window: Jan 2025 → Dec 2026
    start = date(2025, 1, 1)
    end   = date(2026, 12, 1)

    # Build ordered month list with zero counts
    monthly_data = {}
    current = start
    while current <= end:
        month_key = current.strftime("%b '%y")
        monthly_data[month_key] = 0
        if current.month == 12:
            current = date(current.year + 1, 1, 1)
        else:
            current = date(current.year, current.month + 1, 1)

    # Count achievements per month
    for ach in achievements:
        if ach.date:
            d = ach.date if hasattr(ach.date, 'strftime') else getdate(ach.date)
            month_key = d.strftime("%b '%y")
            if month_key in monthly_data:
                monthly_data[month_key] += 1

    # Return as ordered list (already insertion-ordered in Python 3.7+)
    return [{"month": m, "count": c} for m, c in monthly_data.items()]

def get_company_breakdown(achievements):
    """Get breakdown by company"""
    company_counts = {}
    for ach in achievements:
        if ach.company:
            company_counts[ach.company] = company_counts.get(ach.company, 0) + 1

    result = []
    for company, count in company_counts.items():
        result.append({
            "company": company,
            "count": count
        })

    return sorted(result, key=lambda x: x['count'], reverse=True)

def get_sections_breakdown(achievements):
    """Get breakdown by the sections field"""
    sections_counts = {}
    for ach in achievements:
        if ach.sections:
            sections_counts[ach.sections] = sections_counts.get(ach.sections, 0) + 1

    result = []
    for section, count in sections_counts.items():
        result.append({
            "sections": section,
            "count": count
        })

    return sorted(result, key=lambda x: x['count'], reverse=True)

def get_client_breakdown(achievements):
    """Get breakdown by client"""
    client_counts = {}
    for ach in achievements:
        if ach.client:
            client_counts[ach.client] = client_counts.get(ach.client, 0) + 1

    result = []
    for client, count in client_counts.items():
        result.append({
            "client": client,
            "count": count
        })

    return sorted(result, key=lambda x: x['count'], reverse=True)

def get_sector_breakdown(achievements):
    """Get breakdown by sector using the filtered achievements list"""
    if not achievements:
        return []
    try:
        rows = frappe.get_list(
            "Multiselect Sector",
            fields=["sector", "count(*) as count"],
            filters={
                "parent": ["in", [a.name for a in achievements]],
                "parenttype": "BD Achievements",
                "sector": ["!=", ""],
            },
            parent_doctype="BD Achievements",
            group_by="sector",
            order_by="count desc",
            limit_page_length=0,
        )
        return [{"sector": row.sector, "count": row.count} for row in rows]
    except Exception:
        return []

def get_quarter_view(achievements):
    """Get achievements grouped by quarter+year using the quarter DB field"""
    quarter_counts = {}
    for ach in achievements:
        q = ach.quarter or 'Unscheduled'
        year = str(ach.year) if ach.year else ''
        key = f"{q} {year}" if year else q
        quarter_counts[key] = quarter_counts.get(key, 0) + 1

    result = [{"quarter": k, "count": v} for k, v in quarter_counts.items()]
    return sorted(result, key=lambda x: x['count'], reverse=True)

@frappe.whitelist(allow_guest=False)
def get_filter_options():
    """Get distinct values for dashboard select filters"""
    options = {}
    for field in ("year", "company", "client", "sections"):
        options[field] = _distinct_values("BD Achievements", field)

    visible_names = frappe.get_list("BD Achievements", pluck="name", limit_page_length=0)
    options["sector"] = (
        _distinct_values(
            "Multiselect Sector",
            "sector",
            filters={
                "parent": ["in", visible_names],
                "parenttype": "BD Achievements",
            },
            parent_doctype="BD Achievements",
        )
        if visible_names else []
    )

    return options

@frappe.whitelist(allow_guest=False)
def get_fiscal_years():
    """Get list of available fiscal years from achievements"""
    return _distinct_values("BD Achievements", "year", descending=True)

@frappe.whitelist(allow_guest=False)
def get_companies():
    """Get list of companies from achievements"""
    return _distinct_values("BD Achievements", "company")

@frappe.whitelist(allow_guest=False)
def get_clients():
    """Get list of clients from achievements"""
    return _distinct_values("BD Achievements", "client")


def _distinct_values(doctype, field, descending=False, filters=None, parent_doctype=None):
    """Return populated field values in the same order as the dashboard filters."""
    return frappe.get_list(
        doctype,
        filters={**(filters or {}), field: ["!=", ""]},
        parent_doctype=parent_doctype,
        fields=[field],
        distinct=True,
        order_by=f"{field} {'desc' if descending else 'asc'}",
        pluck=field,
        limit_page_length=0,
    )

@frappe.whitelist(allow_guest=False)
def get_summary_stats():
    """Get quick summary statistics"""
    total = frappe.get_list(
        "BD Achievements",
        fields=["count(*) as count"],
        limit_page_length=1,
    )[0].count

    return {
        "total_achievements": total,
        "companies": len(_distinct_values("BD Achievements", "company")),
        "clients": len(_distinct_values("BD Achievements", "client")),
    }
