frappe.ui.form.on('Lead', {
    refresh: function(frm) {

        // Add Project in Create menu
        frm.add_custom_button(__('Project'), function() {

            frappe.new_doc('Project', {
                project_name: frm.doc.lead_name || frm.doc.company_name,
                expected_start_date: frappe.datetime.get_today(),
                custom_lead : frm.doc.name
            });
        }, __('Create'));
    }
});