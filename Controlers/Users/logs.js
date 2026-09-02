
import logs from "../../Models/Users/logs.js";

export const getUserLogs = async (req, res) => {
    try {
      const allLogs = await logs.find().populate("userId", "firstName lastName email");
      res.status(200).json(allLogs);
      console.log("Fetched Logs:", allLogs);
    } catch (error) {
      res.status(500).json({ error: "An error occurred while fetching logs." });
    }
  };
  