// Copyright (c) 2026, Finbyz and contributors
// For license information, please see license.txt


frappe.ui.form.on('BD Achievements', {
    setup: function(frm) {
        // Set default naming series if not set
        if (!frm.doc.naming_series) {
            frm.set_value('naming_series', 'BDA-.####');
        }
    },

    date: function(frm) {

    // When date changes, update month, month_no, quarter and year

    if (frm.doc.date) {

        updateMonthFields(frm);

        const date = frappe.datetime.str_to_obj(frm.doc.date);
        const month_no = date.getMonth() + 1;
        const year = date.getFullYear();

        // Set Quarter
        let quarter;

        if (month_no <= 3) {
            quarter = "Q1";
        } else if (month_no <= 6) {
            quarter = "Q2";
        } else if (month_no <= 9) {
            quarter = "Q3";
        } else {
            quarter = "Q4";
        }

        frm.set_value("quarter", quarter);

        // Set Year
        frm.set_value("year", year.toString());

    } else {

        frm.set_value("quarter", "");
        frm.set_value("year", "");

    }

},

    before_save: function(frm) {
        // Ensure month fields are set before saving
        if (frm.doc.date) {
            updateMonthFields(frm);
        }
    },

    validate: function(frm) {
        // Validate month fields match the date
        if (frm.doc.date) {
            validateMonthFields(frm);
        }
    },

    refresh: function(frm) {
        // Add custom button to auto-fill month info
        frm.add_custom_button(__('Auto-fill Month Info'), function() {
            if (frm.doc.date) {
                updateMonthFields(frm);
                frappe.msgprint(__('Month information updated from date'));
            } else {
                frappe.msgprint(__('Please select a date first'));
            }
        }, __("Tools"));
    }
});

// Helper function to update month fields
function updateMonthFields(frm) {
    if (!frm.doc.date) return;
    
    // Use client-side date parsing
    let date_obj = new Date(frm.doc.date);
    let month_no = date_obj.getMonth() + 1; // JavaScript months are 0-indexed
    
    let month_names = {
        1: "January", 2: "February", 3: "March",
        4: "April", 5: "May", 6: "June",
        7: "July", 8: "August", 9: "September",
        10: "October", 11: "November", 12: "December"
    };
    
    let month_name = month_names[month_no] || "";
    
    // Set the fields
    frm.set_value('month_no', String(month_no));
    frm.set_value('month', month_name);
    
    // Optional: Show a brief success message
    frappe.show_alert({
        message: __('Month: {0} ({1})', [month_name, month_no]),
        indicator: 'green'
    }, 3);
}

// Helper function to validate month fields
function validateMonthFields(frm) {
    if (!frm.doc.date) return;
    
    let date_obj = new Date(frm.doc.date);
    let expected_month_no = date_obj.getMonth() + 1;
    let month_names = {
        1: "January", 2: "February", 3: "March",
        4: "April", 5: "May", 6: "June",
        7: "July", 8: "August", 9: "September",
        10: "October", 11: "November", 12: "December"
    };
    let expected_month = month_names[expected_month_no] || "";
    
    let current_month_no = frm.doc.month_no ? String(frm.doc.month_no) : "";
    let current_month = frm.doc.month || "";
    
    if (current_month_no !== String(expected_month_no) || current_month !== expected_month) {
        // Auto-correct the fields
        frm.set_value('month_no', String(expected_month_no));
        frm.set_value('month', expected_month);
        
        frappe.msgprint({
            title: __('Auto-correction'),
            message: __('Month fields have been corrected to match the selected date.'),
            indicator: 'orange'
        });
    }
}

// Handle the sector field - ensure child table fields are properly set
frappe.ui.form.on('Sector Details', {
    sector_details_add: function(frm, cdt, cdn) {
        // When adding a new sector row
        let child = locals[cdt][cdn];
        // You can add default values here if needed
    }
});

// Client-side function to get month info without server call
function getMonthInfoFromDate(date_str) {
    if (!date_str) return null;
    
    let date_obj = new Date(date_str);
    let month_no = date_obj.getMonth() + 1;
    let month_names = {
        1: "January", 2: "February", 3: "March",
        4: "April", 5: "May", 6: "June",
        7: "July", 8: "August", 9: "September",
        10: "October", 11: "November", 12: "December"
    };
    
    return {
        month_no: String(month_no),
        month: month_names[month_no] || ""
    };
}

// Expose function for use in console for debugging
window.getBDMonthInfo = getMonthInfoFromDate;