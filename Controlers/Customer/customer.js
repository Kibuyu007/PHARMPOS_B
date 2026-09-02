import customer from "../../Models/Customers/customer.js";

// Add Customer
export const addCustomer = async (req, res) => {
  try {
    const { customerName, phone, address, email, company } = req.body;

    const newCustomer = new customer({
      customerName,
      phone,
      address,
      email,
      company,
      status: "Active"
    });

    const saveCustomer = await newCustomer.save();

    return res.status(201).json(saveCustomer);
  } catch (error) {
    console.log("Error adding customer:", error);
    return res
      .status(500)
      .json({ success: false, error: "Could not add a Customer" });
  }
};

// Get All Customers
export const getAllCustomers = async (req, res) => {
  try {
    const allCustomers = await customer.find();
    return res.status(200).json(allCustomers);
  } catch (error) {
    return res
      .status(500)
      .json({ error: "An error occurred while fetching customers." });
  }
};

// Get Active Customers
export const getCustomers = async (req, res) => {
  try {
    const activeCustomers = await customer.find({ status: "Active" });
    return res.status(200).json(activeCustomers);
  } catch (error) {
    return res
      .status(500)
      .json({ error: "An error occurred while fetching customers." });
  }
};

// Update Customer
export const updateCustomer = async (req, res) => {
  const id = req.params.id;

  try {
    const { phone, address, email, company, status } = req.body;

    const updateFields = {};
    if (phone) updateFields.phone = phone;
    if (address) updateFields.address = address;
    if (email) updateFields.email = email;
    if (company) updateFields.company = company;
    if (status) updateFields.status = status;

    const updatedCustomer = await customer.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Customer updated successfully",
      data: updatedCustomer,
    });
  } catch (error) {
    console.log("Error updating customer:", error);
    return res.status(500).json({ success: false, message: "Failed to update customer" });
  }
};

// Search Customers
export const searchCustomer = async (req, res) => {
  const { name, phone } = req.query;
  const query = {};

  if (name) {
    query.customerName = { $regex: name, $options: 'i' };
  }
  if (phone) {
    query.phone = { $regex: phone, $options: 'i' };
  }

  try {
    const customers = await customer.find(query);
    return res.status(200).json({ success: true, data: customers });
  } catch (error) {
    console.log("Error searching customers:", error);
    return res.status(500).json({ success: false, error: "Could not search customers" });
  }
};

// Toggle Customer Status
export const customerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const customers = await customer.findById(id);

    if (!customers) {
      return res.status(404).json({ error: "Customer not found." });
    }

    customers.status = customers.status === "Active" ? "Inactive" : "Active";
    await customers.save();

    res.status(200).json({
      message: `Customer ${customers.status} successfully`,
      status: customers.status,
    });
  } catch (error) {
    console.error("Error updating Customer status:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};
