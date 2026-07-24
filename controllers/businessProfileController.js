import BusinessProfile from "../models/bussinessprofile.js";
import TeamMember from "../models/Teammember.js";

/**
 * GET /api/business-profile
 *
 * Returns:
 * - Business profile
 * - Team members
 *
 * One API request loads the complete Business Profile page.
 */
export const getBusinessProfile = async (req, res) => {
  try {
    // Assuming authentication middleware sets req.user
    const userId = req.query.userId;
console.log(req.query, req.userId, req.user, "let's check what's happen" )
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. User ID not found.",
      });
    }

    // Run both queries at the same time
    const [profile, teamMembers] = await Promise.all([
      BusinessProfile.findOne({
        userId: userId,
      }),

      TeamMember.find({
        ownerId: userId,
      }),
    ]);

    return res.status(200).json({
      success: true,

      profile: profile || null,

      teamMembers: teamMembers || [],
    });
  } catch (error) {
    console.error(
      "Get Business Profile Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch business profile",
      error: error.message,
    });
  }
};


/**
 * PUT /api/business-profile
 *
 * Creates the business profile if it doesn't exist.
 * Otherwise updates the existing profile.
 */
export const updateBusinessProfile = async (req, res) => {
  try {
    const userId = req.query.userId;

    console.log(userId);
    

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. User ID not found.",
      });
    }

    // Never trust userId coming from frontend
    // Remove it from req.body
    const {
      userId: bodyUserId,
      _id,
      ...profileData
    } = req.body;

    console.log(userId, profileData,'here are the details.')
    const updatedProfile =
      await BusinessProfile.findOneAndUpdate(
        {
          userId: userId,
        },

        {
          $set: profileData,

          $setOnInsert: {
            userId: userId,
          },
        },

        {
          new: true,

          // Create profile if it doesn't exist
          upsert: true,

          runValidators: true,

          // Apply schema defaults when creating
          setDefaultsOnInsert: true,
        }
      );

    return res.status(200).json({
      success: true,
      message: "Business profile updated successfully",

      profile: updatedProfile,
    });
  } catch (error) {
    console.error(
      "Update Business Profile Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update business profile",
      error: error.message,
    });
  }
};