import Notification from "../models/Notifications.js";

export const getNotificationsMapping = async (req,res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ success: false, message: "userId is required" });
        }

        const notifications = await Notification.find({ recipient: userId })
            .sort({ createdAt: -1 })
            .limit(50);

        return res.status(200).json({
            success: true,
            data: notifications,
            unreadCount: notifications.filter((n) => n.status === "unread").length,
        })

    } catch(error){
        return res.status(500).json({success:false, message: 'server error'})
    }
}

export const markNotificationRead = async (req, res) => {
    try {
        const { id } = req.params;

        const notification = await Notification.findByIdAndUpdate(
            id,
            { status: "read" },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ success: false, message: "Notification not found" });
        }

        return res.status(200).json({ success: true, data: notification });
    } catch (error) {
        return res.status(500).json({ success: false, message: "server error" });
    }
}
