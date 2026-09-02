import users from "../../Models/Users/users.js";
import logs from "../../Models/Users/logs.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// Register User
export const register = async (req, res) => {
  try {
    const {
      firstName,
      secondName,
      lastName,
      userName,
      dateOfBirth,
      gender,
      contacts,
      address,
      title,
      email,
      password,
      roles,
    } = req.body;

    console.log("Received Request:", req.body);
    console.log("Received File:", req.file);

    // Check if user already exists
    const existingUser = await users.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists." });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("Hashed Password:", hashedPassword); // Debugging

    // Parse roles (since it's sent as a JSON string)
    const rolesData = JSON.parse(roles);

    // Create new user
    const newUser = await users.create({
      firstName,
      secondName,
      lastName,
      userName,
      dateOfBirth,
      gender,
      contacts,
      address,
      title,
      email,
      password: hashedPassword,
      photo: req.file ? req.file.filename : null, // Fixed req.file issue
      roles: {
        canAddItems: !!rolesData.canAddItems,
        canEditItems: !!rolesData.canEditItems,
        canAddCategory: !!rolesData.canAddCategory,
        CanEditCategory: !!rolesData.canEditCategory,

        canMakeTransaction: !!rolesData.canMakeTransaction,
        canPayBillTransactions: !!rolesData.canPayBillTransactions,

        canApproveNewGrn: !!rolesData.canApproveNewGrn,
        canPayBilledGrn: !!rolesData.canPayBilledGrn,

        canChangeDebtStatus: !!rolesData.canChangeDebtStatus,
        canPayDebt: !!rolesData.canPayDebt,

        canAccessSettings: !!rolesData.canAccessSettings,
        canAccessUserManagement: !!rolesData.canAccessUserManagement,
        canAccessCustomerManagement: !!rolesData.canAccessCustomerManagement,
        canAccessSupplierManagement: !!rolesData.canAccessSupplierManagement,

        canSeeReports: !!rolesData.canSeeReports,
        canAccessMadeniReport: !!rolesData.canAccessMadeniReport,
        
      },
      status: "Active",
      createdBy: req.userId,
    });

    return res
      .status(201)
      .json({ data: newUser, message: "User created successfully!" });
  } catch (error) {
    console.error("Error Registering User:", error);
    return res.status(500).json({ error: error.message });
  }
};

// Login User
export const login = async (req, res) => {
  try {
    const { userName, password } = req.body;

    // Find user
    const existingUser = await users.findOne({ userName });
    if (!existingUser) {
      return res.status(400).json({ error: "User does not exist." });
    }

    if (existingUser.status === "Inactive") {
      return res.status(403).json({
        error: "Your account is deactivated. Please contact support.",
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      password,
      existingUser.password
    );
    if (!isPasswordValid) {
      return res.status(400).json({ error: "Invalid password." });
    }

    // Generate token
    const token = jwt.sign({ id: existingUser._id }, process.env.MYCODE, {
      expiresIn: "3h",
    });

    // Set cookie
    res.cookie("accessToken", token, {
      maxAge: 1000 * 60 * 30, // 30 minutes
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", //dig dig baadae
      secure: process.env.NODE_ENV === "production",
    });

    //Logs of login user
    await logs.create({
      userId: existingUser._id,
      action: "User Logged In",
      details: `User ${existingUser.firstName} ${existingUser.lastName} logged in.`,
    });

    const { password: _, ...userData } = existingUser._doc;

    res.status(200).json({ token, user: userData });
  } catch (error) {
    console.error("Error Logging In:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Logout User
export const logout = async (req, res) => {
  try {
    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });

    res.status(200).json({ message: "Logged out successfully." });
  } catch (error) {
    res.status(500).json({ error: "Internal server error." });
  }
};
