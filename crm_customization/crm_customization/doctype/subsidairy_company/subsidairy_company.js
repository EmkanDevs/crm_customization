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