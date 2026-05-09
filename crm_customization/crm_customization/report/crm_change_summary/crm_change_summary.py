import frappe
import json
from frappe import _


def execute(filters=None):
    if not filters:
        filters = {}
    validate_filters(filters)
    columns = get_columns()
    data = get_data(filters)
    return columns, data


def validate_filters(filters):
    if not filters.get("ref_doctype"):
        frappe.throw(_("DocType is mandatory"))
    if not filters.get("from_date") or not filters.get("to_date"):
        frappe.throw(_("From Date and To Date are mandatory"))


def get_columns():
    return [
        {"label": "Document",       "fieldname": "docname",       "fieldtype": "Dynamic Link", "options": "ref_doctype", "width": 160},
        {"label": "Date & Time",    "fieldname": "creation",      "fieldtype": "Datetime",     "width": 250},
        {"label": "User",           "fieldname": "owner",         "fieldtype": "Link",         "options": "User", "width": 200},
        {"label": "Fields Changed", "fieldname": "fields_changed","fieldtype": "Int",          "width": 200},
        {"label": "Changed Fields", "fieldname": "field_names",   "fieldtype": "Data",         "width": 500},
        {"label": "Change Detail",  "fieldname": "summary",       "fieldtype": "Data",         "width": 1500},
    ]


def get_data(filters):
    conditions, query_filters = get_conditions(filters)

    # ── FIX: Use raw datetime range instead of DATE(creation) so the
    #         index on `creation` is actually used by MariaDB/MySQL.
    #         DATE(col) wrapping forces a full table scan every time.
    versions = frappe.db.sql(f"""
        SELECT
            name,
            ref_doctype,
            docname,
            data,
            owner,
            creation
        FROM `tabVersion`
        WHERE ref_doctype = %(ref_doctype)s
        {conditions}
        ORDER BY creation DESC
        LIMIT %(page_length)s
        OFFSET %(page_start)s
    """, query_filters, as_dict=True)

    result = []
    meta = frappe.get_meta(filters.get("ref_doctype"))

    for v in versions:
        try:
            data = json.loads(v.data)
        except Exception as e:
            frappe.log_error(
                f"JSON parse error for Version {v.name}: {e}",
                "CRM Change Summary"
            )
            continue

        changes = []
        field_labels = []

        # ── Changed fields ──────────────────────────────────────────
        for row in data.get("changed", []):
            try:
                fieldname, old, new = row
            except ValueError:
                continue
            if ignore_field(fieldname):
                continue
            field = meta.get_field(fieldname)
            label = field.label if field else fieldname.replace("_", " ").title()
            field_labels.append(label)
            changes.append(f"{label}: [{old or '—'}] → [{new or '—'}]")

        # ── Added rows ───────────────────────────────────────────────
        for row in data.get("added", []):
            try:
                fieldname, old, new = row
            except ValueError:
                continue
            if ignore_field(fieldname):
                continue
            field = meta.get_field(fieldname)
            label = field.label if field else fieldname.replace("_", " ").title()
            field_labels.append(f"{label} (added)")
            changes.append(f"{label} added: [{new or '—'}]")

        # ── Removed rows ─────────────────────────────────────────────
        for row in data.get("removed", []):
            try:
                fieldname, old, new = row
            except ValueError:
                continue
            if ignore_field(fieldname):
                continue
            field = meta.get_field(fieldname)
            label = field.label if field else fieldname.replace("_", " ").title()
            field_labels.append(f"{label} (removed)")
            changes.append(f"{label} removed: [{old or '—'}]")

        if not changes:
            continue

        result.append({
            "docname":       v.docname,
            "creation":      v.creation,
            "owner":         v.owner,
            "fields_changed": len(changes),
            "field_names":   ", ".join(field_labels),
            "summary":       " | ".join(changes),
        })

    # ── Summary rows at the top ──────────────────────────────────────
    result = add_summary_rows(result) + result
    return result


def add_summary_rows(data):
    """Prepend bold summary/stat rows — total edits and top users."""
    if not data:
        return []

    total_edits  = len(data)
    total_fields = sum(r.get("fields_changed", 0) for r in data)

    user_counts = {}
    for row in data:
        u = row["owner"]
        user_counts[u] = user_counts.get(u, 0) + 1

    top_user = max(user_counts, key=user_counts.get)

    return [
        {
            "docname":       "── SUMMARY ──",
            "creation":      None,
            "owner":         "",
            "fields_changed": total_fields,
            "field_names":   f"Total Edits: {total_edits}",
            "summary":       f"Top Editor: {top_user} ({user_counts[top_user]})",
        },
        # Blank separator row
        {
            "docname": "", "creation": None, "owner": "",
            "fields_changed": None, "field_names": "", "summary": "",
        },
    ]


def get_conditions(filters):
    """
    Build WHERE clause conditions and a safe filters dict for parameterised
    queries.

    KEY FIX — date range:
        Old (broken):  DATE(creation) BETWEEN %(from_date)s AND %(to_date)s
            → MySQL wraps every row in DATE(), cannot use the creation index.
        New (correct): creation >= %(from_date)s AND creation < %(to_date_exclusive)s
            → MariaDB does an index range scan on tabVersion.creation.

    All values are passed as parameters (no f-string interpolation of user
    data) so there is no SQL-injection risk.
    """
    conditions    = ""
    query_filters = {
        "ref_doctype":      filters.get("ref_doctype"),
        # Inclusive start of day
        "from_date":        filters.get("from_date") + " 00:00:00",
        # Exclusive start of *next* day — covers every second of to_date
        "to_date_exclusive": frappe.utils.add_days(filters.get("to_date"), 1),
        "page_length":      int(filters.get("page_length") or 500),
        "page_start":       int(filters.get("page_start")  or 0),
    }

    # ── FIX: sargable date range — index on `creation` will be used ──
    conditions += (
        " AND creation >= %(from_date)s"
        " AND creation < %(to_date_exclusive)s"
    )

    # ── Optional: filter by user — add index if used heavily ─────────
    if filters.get("user"):
        conditions += " AND owner = %(user)s"
        query_filters["user"] = filters.get("user")

    # ── Optional: filter by specific document ─────────────────────────
    if filters.get("docname"):
        conditions += " AND docname = %(docname)s"
        query_filters["docname"] = filters.get("docname")

    return conditions, query_filters


def ignore_field(fieldname):
    ignore_list = {"modified", "creation", "owner", "modified_by", "docstatus"}
    return fieldname in ignore_list


# ── Called automatically by bench migrate ────────────────────────────────────
# Adds indexes that are not present in the standard tabVersion table but are
# required for this report to be performant:
#
#   1. Composite (ref_doctype, creation) — the two most-used WHERE columns
#      together.  Covers the common "show all changes for DocType X in
#      date range Y" query in a single index scan.
#
#   2. owner — needed only when the optional User filter is applied.
#      Lower priority; add if your users filter by owner often.
#
# Run manually after deploying: bench --site <site> migrate
# ─────────────────────────────────────────────────────────────────────────────
def on_doctype_update():
    # Composite index: ref_doctype + creation
    # This is the most impactful index for this report because every query
    # always filters ref_doctype first and then ranges on creation.
    frappe.db.add_index("Version", ["ref_doctype", "creation"])

    # Composite index: ref_doctype + docname
    # Useful when filtering by a specific document name.
    frappe.db.add_index("Version", ["ref_doctype", "docname"])

    # Single-column index on owner for user-based filtering.
    frappe.db.add_index("Version", ["owner"])