frappe.ui.form.on('Subsidairy Company', {
    refresh: function(frm) {
        // Add the button separately on the top bar
        let btn = frm.add_custom_button(__('Registration & Qualification Report'), function() {
            // Redirect with the company name as a filter
            frappe.set_route("query-report", "Registration and Qualification", {
                "subsidiary_company": frm.doc.name
            });
        });

        // Add some color (Frappe primary blue) and an icon
        btn.addClass('btn-primary')
           .css({
               'background-color': '#4b5563', // Custom Blue
               'color': 'white',
               'font-weight': 'bold',
               'margin-left': '10px'
           });
    }
});

frappe.ui.form.on('Subsidairy Company Task Register', {
    bd_task_reference: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (!row.bd_task_reference) return;

        // Use the Business Request's Request Date, or its creation date if that is empty
        frappe.db.get_value('Business Request', row.bd_task_reference, ['request_date', 'creation'])
            .then(r => {
                let br = r.message || {};
                let date = br.request_date || (br.creation ? br.creation.split(' ')[0] : null);
                if (date) {
                    frappe.model.set_value(cdt, cdn, 'request_raised_date', date);
                }
            });
    }
});
