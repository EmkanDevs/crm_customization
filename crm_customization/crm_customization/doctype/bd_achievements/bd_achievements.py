# Copyright (c) 2026, Finbyz and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import getdate


MONTH_NAMES = {
    1: "January", 2: "February", 3: "March",
    4: "April", 5: "May", 6: "June",
    7: "July", 8: "August", 9: "September",
    10: "October", 11: "November", 12: "December"
}


class BDAchievements(Document):
    def before_save(self):
        """Set month and month_no before saving if date is available"""
        if self.date:
            self.set_month_from_date()

    def set_month_from_date(self):
        """Set month name and month number from date field"""
        if self.date:
            date = getdate(self.date)

            # Get month number (1-12)
            month_no = date.month
            
            # Set the fields
            self.month_no = str(month_no)
            self.month = MONTH_NAMES.get(month_no, "")
            
            # Also auto-generate naming series if not set
            if not self.naming_series:
                self.naming_series = "BDA-.####"

    def before_insert(self):
        """Set month fields before inserting new document"""
        if self.date:
            self.set_month_from_date()


# Server-side API method to get month info from date
@frappe.whitelist()
def get_month_info(date):
    """
    API endpoint to get month information from a date
    Usage: frappe.call('crm_customization.crm_customization.doctype.bd_achievements.bd_achievements.get_month_info', {'date': '2026-01-15'})
    """
    if not date:
        frappe.throw("Date is required")
    
    try:
        date_obj = getdate(date)
        
        month_no = date_obj.month
        
        return {
            "month_no": str(month_no),
            "month": MONTH_NAMES.get(month_no, "")
        }
    except Exception as e:
        frappe.log_error(f"Error getting month info: {str(e)}", "BD Achievements")
        return {"month_no": "", "month": ""}


# Optional: Validate month and month_no consistency
@frappe.whitelist()
def validate_month_fields(date, month, month_no):
    """Validate that month and month_no match the date"""
    if not date:
        return {"valid": True, "message": "No date provided"}
    
    try:
        date_obj = getdate(date)
        
        expected_month_no = str(date_obj.month)
        expected_month = MONTH_NAMES.get(date_obj.month, "")
        
        is_valid = (month_no == expected_month_no and month == expected_month)
        return {
            "valid": is_valid,
            "expected_month_no": expected_month_no,
            "expected_month": expected_month,
            "message": "Valid" if is_valid else "Month and month number don't match the date"
        }
    except Exception as e:
        return {"valid": False, "message": str(e)}
