import frappe
from frappe.model.document import Document
from frappe.desk.form.assign_to import add as add_assignment

class BusinessRequest(Document):

    def on_submit(self):
        if not self.subsidairy_company:
            return

        # Fetch the Subsidairy Company document
        subsidairy_doc = frappe.get_doc("Subsidairy Company", self.subsidairy_company)

        # Determine stage
        stage = ""
        if self.registration:
            stage = "Registration"
        elif self.prequalification:
            stage = "Prequalification"

        # Append row to task_registered child table
        subsidairy_doc.append("task_registered", {
            "client": self.customer,
            "bd_task": self.bd_tasks,
            "category": self.request_category,
            "stage": stage
        })

        # Save the document
        subsidairy_doc.save(ignore_permissions=True)

    def on_update(self):
        self.assign_selected_users()

    def on_update_after_submit(self):
        self.assign_selected_users()

    def assign_selected_users(self):
        if not self.users:
            return

        # Get currently assigned users (to prevent duplicates)
        existing_assignments = frappe.get_all(
            "ToDo",
            filters={
                "reference_type": self.doctype,
                "reference_name": self.name,
                "status": ("!=", "Cancelled")
            },
            fields=["allocated_to"]
        )

        already_assigned = {d.allocated_to for d in existing_assignments}

        for row in self.users:
            user = row.users  # change if your link field has a different fieldname

            if user and user not in already_assigned:
                add_assignment({
                    "assign_to": [user],
                    "doctype": self.doctype,
                    "name": self.name,
                    "description": f"Assigned via Users field"
                })