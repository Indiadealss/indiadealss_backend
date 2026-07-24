import User from "../models/User.js";

const DOC_VERIFICATION_TYPES = ["identity", "address", "business"];

export const submitVerification = async (req, res) => {
  try {
    const { userId, type, docType } = req.body;

    if (!userId || !type) {
      return res.status(400).json({ success: false, message: "userId and type are required" });
    }
    if (!DOC_VERIFICATION_TYPES.includes(type)) {
      return res.status(400).json({ success: false, message: "Invalid verification type" });
    }

    const file = req.files?.document?.[0];
    if (!file) {
      return res.status(400).json({ success: false, message: "Document file is required" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          [`verification.${type}.status`]: "pending",
          [`verification.${type}.docType`]: docType || "",
          [`verification.${type}.docUrl`]: file.location,
          [`verification.${type}.submittedAt`]: new Date(),
        },
      },
      { new: true }
    ).select("-password");

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    return res.status(200).json({ success: true, message: "Document submitted for verification", data: user });
  } catch (error) {
    console.error("submitVerification error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const addDocument = async (req, res) => {
  try {
    const { userId, name, type } = req.body;
    const file = req.files?.document?.[0];

    if (!userId || !file) {
      return res.status(400).json({ success: false, message: "userId and document file are required" });
    }

    const document = {
      name: name || file.originalname,
      type: type || "Uploaded Document",
      status: "pending",
      fileUrl: file.location,
      uploadedAt: new Date(),
    };

    const user = await User.findByIdAndUpdate(
      userId,
      { $push: { documents: document } },
      { new: true }
    ).select("-password");

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    return res.status(200).json({ success: true, message: "Document uploaded", data: user });
  } catch (error) {
    console.error("addDocument error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const removeDocument = async (req, res) => {
  try {
    const { docId } = req.params;
    const { userId } = req.query;

    if (!userId) return res.status(400).json({ success: false, message: "userId is required" });

    const user = await User.findByIdAndUpdate(
      userId,
      { $pull: { documents: { _id: docId } } },
      { new: true }
    ).select("-password");

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    return res.status(200).json({ success: true, message: "Document removed", data: user });
  } catch (error) {
    console.error("removeDocument error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const updateBankDetails = async (req, res) => {
  try {
    const { userId, accountHolder, accountNumber, bankName, ifsc, accountType, branch } = req.body;

    if (!userId) return res.status(400).json({ success: false, message: "userId is required" });
    if (!accountHolder || !accountNumber || !ifsc) {
      return res.status(400).json({ success: false, message: "Account holder, account number and IFSC are required" });
    }

    const update = {
      "bankDetails.accountHolder": accountHolder,
      "bankDetails.accountNumber": accountNumber,
      "bankDetails.bankName": bankName || "",
      "bankDetails.ifsc": ifsc,
      "bankDetails.accountType": accountType || "saving",
      "bankDetails.branch": branch || "",
      "bankDetails.status": "pending",
    };

    const file = req.files?.chequeFile?.[0];
    if (file) update["bankDetails.chequeUrl"] = file.location;

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: update },
      { new: true }
    ).select("-password");

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    return res.status(200).json({ success: true, message: "Bank details submitted for verification", data: user });
  } catch (error) {
    console.error("updateBankDetails error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
