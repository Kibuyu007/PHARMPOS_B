import supplier from "../../Models/Manunuzi/supplier.js";

//Add Supplier
export const addSupplier = async (req, res) => {
  try {
    const { supplierName, phone,address,email,company } = req.body;

    const newSupplier = new supplier({
      supplierName,
      phone,
      address,
      email,
      company,
      status: "Active"
    });

    const saveSupplier = await newSupplier.save();

    return res.status(201).json(saveSupplier);
  } catch (error) {
    console.log("Error adding item:", error);
    return res
      .status(500)
      .json({ success: false, error: "Could not add a Supplier" });
  }
};

// Get All Suppliers with Search and Pagination
export const getAllSuppliers = async (req, res) => {
  try {
    const allSuppliers = await supplier.find();
    return res.status(200).json(allSuppliers);
  } catch (error) {
    return res
      .status(500)
      .json({ error: "An error occurred while fetching users." });
  }
};


export const getSuppliers = async (req, res) => {
  try {
    const activeSuppliers = await supplier.find({ status: "Active" });
    return res.status(200).json(activeSuppliers);
  } catch (error) {
    return res
      .status(500)
      .json({ error: "An error occurred while fetching suppliers." });
  }
};




// Update Supplier
export const updateSupplier = async (req, res) => {
  const id = req.params.id;

  try {
    const  {phone, address,email,company, status } = req.body;

    // Create an object with the fields you want to update
    const updateFields = {};
    if (phone) updateFields.phone = phone;
    if (address) updateFields.address = address;
    if (email) updateFields.email = email;
    if (company) updateFields.company = company;
    if (status) updateFields.status = status;

    // Find the supplier by ID and update only specified fields
    const updatedSupplier = await supplier.findByIdAndUpdate(
      id,
      { $set: updateFields},
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Successfully Updated",
      data: updatedSupplier,
    });
  } catch (error) {
    console.log("Error updating supplier:", error);
    return res.status(500).json({ success: false, message: "Failed to update supplier" });
  }
};


// Search Suppliers
export const searchSupplier = async (req, res) => {
  const { name, phone} = req.query;
  const query = {};

  // Add search criteria to the query object
  if (name) {
    query.supplierName = { $regex: name, $options: 'i' }; 
  }
  if (phone) {
    query.phone = { $regex: phone, $options: 'i' }; 
  }
 

  try {
    const suppliers = await supplier.find(query);
    return res.status(200).json({ success: true, data: suppliers });
  } catch (error) {
    console.log("Error searching suppliers:", error);
    return res.status(500).json({ success: false, error: "Could not search suppliers" });
  }
};


export const supplierStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const suppliers = await supplier.findById(id);

    if (!suppliers) {
      return res.status(404).json({ error: "Supplier not found." });
    }

    // Toggle between Active and Inactive
    suppliers.status = suppliers.status === "Active" ? "Inactive" : "Active";
    await suppliers.save();

    //Logsof status change
    // await logs.create({
    //   supplierId: id,
    //   action: "Supplier Status Changed",
    //   details: `Supplier ${suppliers.supplierName} ${suppliers.company} changed status to ${suppliers.status}.`,
    // });

    res
      .status(200)
      .json({
        message: `Supplier ${suppliers.status} successfully`,
        status: suppliers.status,
      });
  } catch (error) {
    console.error("Error updating Supplier status:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};