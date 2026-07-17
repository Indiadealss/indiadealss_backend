import Notification from "../models/Notifications.js";

export const getNotificationsMapping = async (req,res) => {
    try {
        const now = new Date();

        // Find the notifications 

        const notifications = await Notification.find()
        .populate("id", "property_id")
        return res.status(200).json({
            data: notifications,
        })

    } catch(error){
        return res.status(500).json({success:false, message: 'server error'})
    }
}