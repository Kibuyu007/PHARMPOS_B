import users from "../../Models/Users/users.js";
import logs from "../../Models/Users/logs.js";
import bcrypt from "bcrypt";

export const updateUser = async (req, res) => {
  const id = req.params.id;

  //Prevent editing of the protected user
  const PROTECTED_USER_ID = "67dac1d71e4020e195b0b590";
  if (id === PROTECTED_USER_ID) {
    return res.status(403).json({ error: "This user cannot be edited." });
  }

  try {
    const existingUser = await users.findById(id);
    if (!existingUser) {
      return res.status(404).json({ error: "User not found." });
    }

    const updates = {};

    // Basic text fields
    const fields = [
      "firstName",
      "secondName",
      "lastName",
      "userName",
      "dateOfBirth",
      "gender",
      "contacts",
      "address",
      "title",
      "email",
    ];

    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // Handle password
    if (req.body.password) {
      if (req.body.password.length < 4) {
        return res
          .status(400)
          .json({ error: "Password must be at least 4 characters long." });
      }
      updates.password = await bcrypt.hash(req.body.password, 10);
    }

    // Handle photo
    updates.photo = req.file ? req.file.filename : existingUser.photo;

    // Handle roles (parse JSON from string if needed)
    let rolesData = {};
    try {
      rolesData =
        typeof req.body.roles === "string"
          ? JSON.parse(req.body.roles)
          : req.body.roles || {};
    } catch (err) {
      return res.status(400).json({ error: "Invalid roles format." });
    }

    const toBool = (v) => v === true || v === "true";

    updates.roles = {
      canAddItems: toBool(rolesData.canAddItems),
      canEditItems: toBool(rolesData.canEditItems),
      canAddCategory: toBool(rolesData.canAddCategory),
      canEditCategory: toBool(rolesData.canEditCategory),

      canMakeTransaction: toBool(rolesData.canMakeTransaction),
      canPayBillTransaction: toBool(rolesData.canPayBillTransaction),

      canApproveNewGrn: toBool(rolesData.canApproveNewGrn),
      canPayBilledGrn: toBool(rolesData.canPayBilledGrn),

      canChangeDebtStatus: toBool(rolesData.canChangeDebtStatus),
      canPayDebt: toBool(rolesData.canPayDebt),

      canEditExpenses: toBool(rolesData.canEditExpenses),
      
      canAccessSettings: toBool(rolesData.canAccessSettings),
      canAccessCustomerManagement: toBool(rolesData.canAccessCustomerManagement),
      canAccessSupplierManagement: toBool(rolesData.canAccessSupplierManagement),
      canAccessUserManagement: toBool(rolesData.canAccessUserManagement),

      canSeeReports: toBool(rolesData.canSeeReports),
      canAccessMadeniReport: toBool(rolesData.canAccessMadeniReport),

    };

    updates.status = "Active";

    const updatedUser = await users.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(400).json({ error: "Failed to update user." });
    }

    const { password, ...userData } = updatedUser._doc;

    // Log update
    await logs.create({
      userId: id,
      action: "User Updated Profile",
      details: `User ${userData.firstName} ${userData.lastName} updated profile.`,
    });

    res.status(200).json(userData);
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Delete User
export const deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await users.findById(id);

    if (!user) {
      return res.status(404).json("User not found.");
    }

    if (req.userId !== user._id.toString()) {
      return res
        .status(401)
        .json("You are not authorized to delete this user.");
    }

    await Users.findByIdAndDelete(id);
    return res.status(200).json("User deleted.");
  } catch (error) {
    return res.status(500).json({ error: "An error occurred." });
  }
};

// Get All Users
export const getAllUsers = async (req, res) => {
  try {
    const allUsers = await users.find();
    return res.status(200).json(allUsers);
  } catch (error) {
    return res
      .status(500)
      .json({ error: "An error occurred while fetching users." });
  }
};

// Get User by ID
export const getUser = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await users.findById(id);

    if (!user) {
      return res.status(404).json("User not found.");
    }

    const { password, ...userDetails } = user._doc;
    return res.status(200).json(userDetails);
  } catch (error) {
    return res
      .status(500)
      .json({ error: "An error occurred while fetching the user." });
  }
};

//Change User Status
export const userStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await users.findById(id);

    //Prevent editing of the protected user
    const PROTECTED_USER_ID = "67dac1d71e4020e195b0b590";
    if (id === PROTECTED_USER_ID) {
      return res.status(403).json({ error: "This user cannot be edited." });
    }

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Toggle between Active and Inactive
    user.status = user.status === "Active" ? "Inactive" : "Active";
    await user.save();

    //Logsof status change
    await logs.create({
      userId: id,
      action: "User Status Changed",
      details: `User ${user.firstName} ${user.lastName} changed status to ${user.status}.`,
    });

    res.status(200).json({
      message: `User ${user.status} successfully`,
      status: user.status,
    });
  } catch (error) {
    console.error("Error updating user status:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};
