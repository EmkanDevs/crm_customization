import base64
import json
from datetime import datetime

import frappe
from frappe.utils import today, getdate

def _build_conditions(filters):
    """Build a parameterized WHERE clause and value map from dashboard filters."""
    conditions = ["1=1"]
    values = {}

    for field in ("year", "month", "company", "client", "sections"):
        value = filters.get(field)
        if value:
            conditions.append(f"{field} = %({field})s")
            values[field] = value

    if filters.get("from_date"):
        conditions.append("date >= %(from_date)s")
        values["from_date"] = filters["from_date"]
    if filters.get("to_date"):
        conditions.append("date <= %(to_date)s")
        values["to_date"] = filters["to_date"]
    if filters.get("sector"):
        conditions.append(
            "EXISTS (SELECT 1 FROM `tabMultiselect Sector` `sector_tab` "
            "WHERE `sector_tab`.`parent` = `tabBD Achievements`.`name` "
            "AND `sector_tab`.`sector` = %(sector)s)"
        )
        values["sector"] = filters["sector"]

    return " AND ".join(conditions), values

def _query_achievements(where_clause, values):
    """Query BD Achievement records for a WHERE clause and attach sector names."""
    achievements = frappe.db.sql(f"""
        SELECT
            name,
            company,
            year,
            client,
            date,
            month,
            month_no,
            quarter,
            sections,
            vendor_no,
            achievement,
            creation
        FROM `tabBD Achievements`
        WHERE {where_clause}
        ORDER BY date DESC
    """, values, as_dict=True)

    # Build a map of achievement name -> sectors for table display
    if achievements:
        ach_names = [a.name for a in achievements]
        placeholders = ', '.join(['%s'] * len(ach_names))
        sector_rows = frappe.db.sql(f"""
            SELECT parent, GROUP_CONCAT(sector SEPARATOR ', ') as sectors
            FROM `tabMultiselect Sector`
            WHERE parent IN ({placeholders}) AND sector IS NOT NULL AND sector != ''
            GROUP BY parent
        """, tuple(ach_names), as_dict=True)
        sector_map = {r.parent: r.sectors for r in sector_rows}
        for ach in achievements:
            ach.sector = sector_map.get(ach.name, '')

    return achievements

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

    where_clause, values = _build_conditions(filters)

    # Get all achievements (with sector names attached)
    achievements = _query_achievements(where_clause, values)

    # Calculate summary statistics
    total_achievements = len(achievements)

    # Companies supported
    companies = frappe.db.sql(f"""
        SELECT DISTINCT company
        FROM `tabBD Achievements`
        WHERE {where_clause} AND company IS NOT NULL AND company != ''
    """, values, as_dict=True)
    companies_supported = len(companies)

    # Clients covered
    clients = frappe.db.sql(f"""
        SELECT DISTINCT client
        FROM `tabBD Achievements`
        WHERE {where_clause} AND client IS NOT NULL AND client != ''
    """, values, as_dict=True)
    clients_covered = len(clients)

    # Top client (most achievements)
    top_client_data = frappe.db.sql(f"""
        SELECT client, COUNT(*) as count
        FROM `tabBD Achievements`
        WHERE {where_clause} AND client IS NOT NULL AND client != ''
        GROUP BY client
        ORDER BY count DESC
        LIMIT 1
    """, values, as_dict=True)
    top_client = top_client_data[0].client if top_client_data else "N/A"
    top_client_count = top_client_data[0].count if top_client_data else 0

    # Top company
    top_company_data = frappe.db.sql(f"""
        SELECT company, COUNT(*) as count
        FROM `tabBD Achievements`
        WHERE {where_clause} AND company IS NOT NULL AND company != ''
        GROUP BY company
        ORDER BY count DESC
        LIMIT 1
    """, values, as_dict=True)
    top_company = top_company_data[0].company if top_company_data else "N/A"
    top_company_count = top_company_data[0].count if top_company_data else 0

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
    where_clause, values = _build_conditions(filters)
    achievements = _query_achievements(where_clause, values)

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
    ach_names = [a.name for a in achievements]
    placeholders = ', '.join(['%s'] * len(ach_names))
    try:
        rows = frappe.db.sql(f"""
            SELECT sector, COUNT(*) as count
            FROM `tabMultiselect Sector`
            WHERE parent IN ({placeholders})
              AND sector IS NOT NULL AND sector != ''
            GROUP BY sector
            ORDER BY count DESC
        """, tuple(ach_names), as_dict=True)
        return [{"sector": r.sector, "count": r.count} for r in rows]
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
        rows = frappe.db.sql(f"""
            SELECT DISTINCT `{field}`
            FROM `tabBD Achievements`
            WHERE `{field}` IS NOT NULL AND `{field}` != ''
            ORDER BY `{field}` ASC
        """)
        options[field] = [row[0] for row in rows]

    sectors = frappe.db.sql("""
        SELECT DISTINCT `sector`
        FROM `tabMultiselect Sector`
        WHERE `sector` IS NOT NULL AND `sector` != ''
        ORDER BY `sector` ASC
    """)
    options["sector"] = [row[0] for row in sectors]

    return options

@frappe.whitelist(allow_guest=False)
def get_fiscal_years():
    """Get list of available fiscal years from achievements"""
    years = frappe.db.sql("""
        SELECT DISTINCT year
        FROM `tabBD Achievements`
        WHERE year IS NOT NULL AND year != ''
        ORDER BY year DESC
    """, as_list=True)

    return [year[0] for year in years] if years else []

@frappe.whitelist(allow_guest=False)
def get_companies():
    """Get list of companies from achievements"""
    companies = frappe.db.sql("""
        SELECT DISTINCT company
        FROM `tabBD Achievements`
        WHERE company IS NOT NULL AND company != ''
        ORDER BY company
    """, as_list=True)

    return [company[0] for company in companies] if companies else []

@frappe.whitelist(allow_guest=False)
def get_clients():
    """Get list of clients from achievements"""
    clients = frappe.db.sql("""
        SELECT DISTINCT client
        FROM `tabBD Achievements`
        WHERE client IS NOT NULL AND client != ''
        ORDER BY client
    """, as_list=True)

    return [client[0] for client in clients] if clients else []

@frappe.whitelist(allow_guest=False)
def get_summary_stats():
    """Get quick summary statistics"""
    total = frappe.db.count('BD Achievements')

    companies = frappe.db.sql("""
        SELECT COUNT(DISTINCT company) as count
        FROM `tabBD Achievements`
        WHERE company IS NOT NULL AND company != ''
    """, as_dict=True)

    clients = frappe.db.sql("""
        SELECT COUNT(DISTINCT client) as count
        FROM `tabBD Achievements`
        WHERE client IS NOT NULL AND client != ''
    """, as_dict=True)

    return {
        "total_achievements": total,
        "companies": companies[0].count if companies else 0,
        "clients": clients[0].count if clients else 0
    }