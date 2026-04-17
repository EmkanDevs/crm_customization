frappe.ui.form.on('Customer Portal Document', {
    attachment: function(frm) {
        if (frm.doc.attachment) {
            let row = frm.add_child('attachment_history');
            row.file_url = frm.doc.attachment;
            row.uploaded_on = frappe.datetime.now_datetime();
            row.uploaded_by = frappe.session.user;
            
            frm.refresh_field('attachment_history');
            
        }
    }
});