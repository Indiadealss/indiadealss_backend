import mongoose from "mongoose";
import TeamMember from "../models/Teammember.js";

/**
 * GET /api/team-members
 */
export const getTeamMembers = async (req, res) => {
  try {
    const ownerId = req.user?._id;
      
    if (!ownerId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const teamMembers = await TeamMember.find({
      ownerId,
    }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      teamMembers,
    });
  } catch (error) {
    console.error("Get Team Members Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch team members",
      error: error.message,
    });
  }
};


/**
 * POST /api/team-members
 *
 * Body:
 * {
 *   name,
 *   email,
 *   phone,
 *   role,
 *   sendInvitation
 * }
 */
export const addTeamMember = async (req, res) => {
  try {
    const ownerId = req.query.userId;
    const result = req.body

    console.log(ownerId, result);
    
    if (!ownerId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const {
      name,
      email,
      phone,
      role,
      sendInvitation,
    } = result;

    // Validation
    if (!name || !email || !role) {
      return res.status(400).json({
        success: false,
        message: "Name, email and role are required",
      });
    }

    // Check if member already exists for this owner
    const existingMember = await TeamMember.findOne({
      ownerId,
      email: email.toLowerCase().trim(),
    });

    if (existingMember) {
      return res.status(409).json({
        success: false,
        message: "Team member with this email already exists",
      });
    }

    // Create member
    const member = await TeamMember.create({
      ownerId,

      name: name.trim(),

      email: email.toLowerCase().trim(),

      phone: phone?.trim() || "",

      role: role.trim(),

      status: sendInvitation
        ? "Pending"
        : "Active",
    });

    /*
     * Invitation Email
     *
     * You can later integrate:
     * AWS SES
     * SendGrid
     * Nodemailer
     */
    if (sendInvitation) {
      console.log(
        `(stub) Sending invitation email to ${email}`
      );
    }

    return res.status(201).json({
      success: true,
      message: "Team member added successfully",
      member,
    });
  } catch (error) {
    console.error("Add Team Member Error:", error);

    // Mongo duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Team member with this email already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to add team member",
      error: error.message,
    });
  }
};


/**
 * DELETE /api/team-members/:id
 */
export const removeTeamMember = async (req, res) => {
  try {
    const ownerId = req.user?._id;

    const { id } = req.params;

    if (!ownerId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // Validate member MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid team member ID",
      });
    }

    /*
     * IMPORTANT:
     *
     * Match both:
     * 1. Team member _id
     * 2. Logged-in ownerId
     *
     * This prevents User A from deleting
     * User B's team member.
     */
    const removedMember =
      await TeamMember.findOneAndDelete({
        _id: id,
        ownerId,
      });

    if (!removedMember) {
      return res.status(404).json({
        success: false,
        message: "Team member not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Team member removed successfully",
    });
  } catch (error) {
    console.error(
      "Remove Team Member Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to remove team member",
      error: error.message,
    });
  }
};