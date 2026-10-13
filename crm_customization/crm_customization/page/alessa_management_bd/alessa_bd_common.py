"""Shared canonical data helpers for the Business Development Management Dashboard.

This module is the single source of truth for the dashboard page and the
"Registration and Qualification" report.  It is responsible for:

* normalizing raw Task Register child values (blank stays blank),
* enriching a row from an explicitly linked Business Request only,
* deriving the exclusive ``opportunity_stage``,
* deriving ``activity_date`` from milestone dates,
* applying the documented global filters.

Neither the page nor the report may re-implement these rules.
"""

from datetime import datetime, date

import frappe
from frappe import _

# Tokens that mean "no filter applied".
_ALL_TOKENS = {
    "",
    "all",
    "all customers",
    "all subsidiary companies",
    "all companies",
    "all owners",
    "all priorities",
    "all categories",
    "all stages",
}

MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]

# Milestone dates that can define a row's operational activity date.
# When several are present the *latest* one wins.
ACTIVITY_DATE_FIELDS = (
    "award_result_date",
    "rfq_received_date",
    "pq_approval_date",
    "pq_submission_date",
    "pq_date",
    "registration_approval_date",
    "registration_submission_date",
    "registration_date",
)

# Opportunity stages derived exclusively from statuses/flags.
PIPELINE_CATEGORIES = ["Qualified", "Registered", "RFQ", "Registration", "PQ", "Not Started"]

# Status buckets shared by the Registration vs PQ chart.
REG_VS_PQ_CATEGORIES = [
    "Completed", "In Process", "Pending Approval", "In Hold",
    "Rejected", "Not Started", "Not Qualified", "Blank",
]


# ---------------------------------------------------------------------------
# Primitive normalization
# ---------------------------------------------------------------------------

def norm(value):
    """Normalize to a trimmed string; None -> ""."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    return str(value).strip()


def norm_lower(value):
    return norm(value).lower()


def is_blank(value):
    return norm(value) == ""


def is_all(value):
    return norm_lower(value) in _ALL_TOKENS


def parse_date(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d", "%d %b %Y", "%d-%b-%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    try:
        return datetime.strptime(text.split(" ")[0], "%Y-%m-%d").date()
    except ValueError:
        return None


def parse_dt(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime(value.year, value.month, value.day)
    try:
        return datetime.fromisoformat(str(value).strip().replace(" ", "T"))
    except ValueError:
        parsed = parse_date(value)
        return datetime(parsed.year, parsed.month, parsed.day) if parsed else None


def normalize_priority(value):
    """Map any priority-ish value to High/Medium/Low or blank."""
    text = norm_lower(value)
    if text == "high":
        return "High"
    if text == "medium":
        return "Medium"
    if text == "low":
        return "Low"
    return ""


def normalize_filters(filters):
    if isinstance(filters, str):
        import json
        filters = json.loads(filters)
    return filters or {}


# ---------------------------------------------------------------------------
# Canonical row construction
# ---------------------------------------------------------------------------

def _milestone_dates(raw):
    dates = {}
    for field in ACTIVITY_DATE_FIELDS:
        value = parse_date(getattr(raw, field, None))
        if value:
            dates[field] = value
    return dates


def _resolve_linked_business_request(raw, br_by_name):
    """Return the Business Request explicitly linked on the child row, if any."""
    if not br_by_name:
        return None
    for link_field in (
        "business_request", "bd_request", "br_name",
        "reference", "business_request_no", "br_link",
    ):
        key = norm_lower(getattr(raw, link_field, None))
        if key and key in br_by_name:
            return br_by_name[key]
    return None


def to_canonical_row(raw, br_by_name=None):
    """Create one canonical row dict from a Task Register child record."""
    row = {
        "row_id": norm(getattr(raw, "name", None)),
        "source_doctype": "Subsidairy Company Task Register",
        "source_name": norm(getattr(raw, "name", None)),
        "subsidiary_company": norm(getattr(raw, "parent", None)),
        "client": norm(getattr(raw, "client", None)),
        "scope": norm(getattr(raw, "bd_task", None)),
        "business_request": None,
        "registration_flag": norm(getattr(raw, "reg", None)),
        "registration_status": norm(getattr(raw, "registration_status", None)),
        "pq_flag": norm(getattr(raw, "p_q", None)),
        "pq_status": norm(getattr(raw, "status", None)),
        "raw_stage": norm(getattr(raw, "stage", None)),
        "client_category": norm(getattr(raw, "category", None)),
        "priority": normalize_priority(
            getattr(raw, "priority", None) or getattr(raw, "custom__priority", None)
        ),
        "assigned_to": norm(
            getattr(raw, "assigned_to", None)
            or getattr(raw, "member_full_name", None)
            or getattr(raw, "member", None)
            or getattr(raw, "owner", None)
        ),
        "last_follow_up": parse_date(
            getattr(raw, "last_follow_up", None)
            or getattr(raw, "last_followup", None)
            or getattr(raw, "follow_up_date", None)
        ),
        "next_action": norm(getattr(raw, "next_action", None)),
        "target_date": parse_date(getattr(raw, "expires_on", None)),
        "registration_approval_date": parse_date(getattr(raw, "registration_approval_date", None)),
        "pq_approval_date": parse_date(getattr(raw, "pq_approval_date", None)),
        "rfq_received_date": parse_date(getattr(raw, "rfq_received_date", None)),
        "vendor_no": norm(getattr(raw, "vendor_no", None)),
        "pq_project_flag": norm(getattr(raw, "pq_project", None)),
        "request_date": None,
        "creation": parse_dt(getattr(raw, "creation", None)),
    }

    linked = _resolve_linked_business_request(raw, br_by_name)
    if linked is not None:
        row["business_request"] = norm(getattr(linked, "name", None))
        if not row["priority"]:
            row["priority"] = normalize_priority(
                getattr(linked, "custom__priority", None) or getattr(linked, "priority", None)
            )
        if not row["client_category"]:
            row["client_category"] = norm(getattr(linked, "request_category", None))
        if not row["request_date"]:
            row["request_date"] = parse_date(getattr(linked, "request_date", None))

    row["opportunity_stage"] = derive_opportunity_stage(row)

    milestones = _milestone_dates(raw)
    row["activity_date"] = max(milestones.values()) if milestones else None
    return row


def derive_opportunity_stage(row):
    """Exclusive stage — a row contributes to exactly one pipeline bucket."""
    if norm_lower(row.get("raw_stage")) == "rfq invitation":
        return "RFQ"
    pq = norm_lower(row.get("pq_status"))
    if pq in ("completed", "qualified"):
        return "Qualified"
    if pq in ("in process", "pending approval", "pending resubmission"):
        return "PQ"
    reg = norm_lower(row.get("registration_status"))
    if reg in ("completed", "registered"):
        return "Registered"
    if reg in ("in process", "pending approval", "pending", "pending resubmission"):
        return "Registration"
    return "Not Started"


# ---------------------------------------------------------------------------
# Derived row predicates
# ---------------------------------------------------------------------------

def is_reg_completed(row):
    return norm_lower(row.get("registration_status")) in ("completed", "registered")


def is_pq_completed(row):
    return norm_lower(row.get("pq_status")) in ("completed", "qualified")


def is_rfq_active(row):
    stage = norm_lower(row.get("raw_stage"))
    return stage == "rfq invitation" or "rfq" in stage


def is_direct(row):
    return norm_lower(row.get("raw_stage")) == "direct"


def is_reg_pending(row):
    return norm_lower(row.get("registration_status")) in ("pending", "in process", "pending approval")


def is_pq_pending(row):
    return norm_lower(row.get("pq_status")) in ("pending", "in process", "pending approval")


def is_done(row):
    return is_reg_completed(row) or is_pq_completed(row)


# ---------------------------------------------------------------------------
# Fetching + filtering
# ---------------------------------------------------------------------------

_BR_FIELDS = [
    "name", "customer", "subsidairy_company", "custom__priority",
    "request_category", "request_date",
]


def _fetch_business_request_index(filters):
    br_filters = {}
    cust = norm(filters.get("customer"))
    sub = norm(filters.get("subsidiary_company"))
    if cust and not is_all(cust):
        br_filters["customer"] = cust
    if sub and not is_all(sub):
        br_filters["subsidairy_company"] = sub

    index = {}
    for br in frappe.get_list(
        "Business Request", fields=_BR_FIELDS, filters=br_filters, limit_page_length=0
    ):
        key = norm_lower(getattr(br, "name", None))
        if key:
            index[key] = br
    return index


def build_canonical_rows(filters):
    """Fetch, normalize, enrich and filter — the canonical dataset."""
    filters = normalize_filters(filters)

    db_filters = {}
    cust = norm(filters.get("customer"))
    sub = norm(filters.get("subsidiary_company"))
    cat = norm(filters.get("client_category"))
    if cust and not is_all(cust):
        db_filters["client"] = cust
    if sub and not is_all(sub):
        db_filters["parent"] = sub
    if cat and not is_all(cat):
        db_filters["category"] = cat

    tasks = frappe.get_list(
        "Subsidairy Company Task Register",
        fields=["*"],
        filters=db_filters,
        parent_doctype="Subsidairy Company",
        limit_page_length=0,
    )
    br_by_name = _fetch_business_request_index(filters)

    rows = []
    seen = set()
    for task in tasks:
        child_id = norm(getattr(task, "name", None))
        if child_id and child_id in seen:
            continue
        if child_id:
            seen.add(child_id)
        rows.append(to_canonical_row(frappe._dict(task), br_by_name))

    return apply_filters(rows, filters)


def _match_status(value, filter_value):
    if is_all(filter_value):
        return True
    if norm_lower(filter_value) == "blank":
        return is_blank(value)
    return norm_lower(value) == norm_lower(filter_value)


def _match_yes_no(flag_value, filter_value):
    if is_all(filter_value):
        return True
    return norm_lower(flag_value) == norm_lower(filter_value)


def apply_filters(rows, filters):
    filters = normalize_filters(filters)

    pq_f = norm(filters.get("pq_status"))
    reg_f = norm(filters.get("registration_status"))
    stage_f = norm(filters.get("opportunity_stage") or filters.get("stage"))
    prio_f = norm(filters.get("priority"))
    owner_f = norm(filters.get("assigned_to"))
    scope_f = norm_lower(filters.get("client_scope"))
    vendor_f = norm_lower(filters.get("vendor_no") or filters.get("vendor"))
    reg_flag_f = norm(filters.get("registration"))
    pq_flag_f = norm(filters.get("pre_qualification"))
    pq_project_f = norm(filters.get("pq_project"))

    from_d = parse_date(filters.get("from_date"))
    to_d = parse_date(filters.get("to_date"))
    if from_d and to_d and from_d > to_d:
        frappe.throw(_("From Date cannot be after To Date."))

    month_f = norm(filters.get("activity_month"))
    month_active = bool(month_f) and not is_all(month_f) and month_f in MONTH_NAMES

    filtered = []
    for row in rows:
        if not _match_status(row.get("pq_status"), pq_f):
            continue
        if not _match_status(row.get("registration_status"), reg_f):
            continue
        if stage_f and not is_all(stage_f):
            if norm_lower(row.get("opportunity_stage")) != norm_lower(stage_f):
                continue
        if prio_f and not is_all(prio_f):
            if norm_lower(row.get("priority")) != norm_lower(prio_f):
                continue
        if owner_f and not is_all(owner_f):
            if norm_lower(row.get("assigned_to")) != norm_lower(owner_f):
                continue
        if scope_f:
            if scope_f not in norm_lower(row.get("client")) and scope_f not in norm_lower(row.get("scope")):
                continue
        if vendor_f and vendor_f not in norm_lower(row.get("vendor_no")):
            continue
        if not _match_yes_no(row.get("registration_flag"), reg_flag_f):
            continue
        if not _match_yes_no(row.get("pq_flag"), pq_flag_f):
            continue
        if not _match_yes_no(row.get("pq_project_flag"), pq_project_f):
            continue

        activity = row.get("activity_date")
        if month_active or from_d or to_d:
            if not activity:
                continue
            if month_active and MONTH_NAMES[activity.month - 1] != month_f:
                continue
            if from_d and activity < from_d:
                continue
            if to_d and activity > to_d:
                continue

        filtered.append(row)
    return filtered
