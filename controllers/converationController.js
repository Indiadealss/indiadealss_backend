import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import Notification from "../models/Notifications.js";

const notifyNewMessage = async ({ recipient, senderName, message }) => {
  if (!recipient) return;
  try {
    await Notification.create({
      recipient,
      name: `New message from ${senderName || "a visitor"}`,
      id: message._id,
      model: "Message",
      status: "unread",
    });
  } catch (err) {
    console.error("notifyNewMessage error:", err.message);
  }
};

export const sendMessage = async (req, res) => {
  try {
    const {
      conversationId,
      sender,
      senderName,
      receiver,
      property_id,
      message,
      messageType,
      attachment,
      guestName,
      guestPhone,
    } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: "Message text is required" });
    }

    const senderIp = req.ip;

    if (!sender) {
      if (!guestName || !guestPhone) {
        return res.status(400).json({
          success: false,
          message: "Name and phone are required to message without logging in",
        });
      }
    }

    let conversation;

    if (conversationId) {
      conversation = await Conversation.findById(conversationId);
    }

    if (!conversation) {
      if (!receiver) {
        return res.status(400).json({ success: false, message: "receiver is required" });
      }
      conversation = await Conversation.create({
        participants: sender ? [sender, receiver] : [receiver],
        guestIp: sender ? null : senderIp,
        guestName: sender ? null : guestName,
        guestPhone: sender ? null : guestPhone,
        property_id: property_id || undefined,
      });
    }

    const newMessage = await Message.create({
      conversationId: conversation._id,
      sender: sender || null,
      senderIp: sender ? null : senderIp,
      receiver: receiver || null,
      message,
      messageType: messageType || "text",
      attachment: attachment || "",
    });

    conversation.lastMessage = newMessage._id;
    await conversation.save();

    const displaySenderName = sender ? senderName : guestName || conversation.guestName;
    await notifyNewMessage({ recipient: receiver, senderName: displaySenderName, message: newMessage });

    return res.status(201).json({
      success: true,
      conversationId: conversation._id,
      data: newMessage,
    });
  } catch (err) {
    console.error("sendMessage error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const getConversations = async (req, res) => {
  try {
    const { user_id } = req.params;

    const conversations = await Conversation.find({
      participants: user_id,
    })
      .populate("participants", "name email phone profile")
      .populate("lastMessage")
      .populate("property_id", "projectname apartment_name location images spid npxid")
      .sort({ updatedAt: -1 });

    const withUnread = await Promise.all(
      conversations.map(async (c) => {
        const unread = await Message.countDocuments({
          conversationId: c._id,
          receiver: user_id,
          isRead: false,
        });
        return { ...c.toObject(), unread };
      })
    );

    res.status(200).json({
      success: true,
      data: withUnread,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const messages = await Message.find({
      conversationId,
    })
      .populate("sender", "name profile")
      .sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      data: messages,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const replyMessage = async (req, res) => {
  try {
    const { conversationId, sender, senderName, receiver, message } = req.body;

    if (!conversationId || !sender || !message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "conversationId, sender and message are required",
      });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }

    const resolvedReceiver =
      receiver || conversation.participants.find((p) => p.toString() !== sender.toString()) || null;

    const newMessage = await Message.create({
      conversationId,
      sender,
      receiver: resolvedReceiver,
      message,
    });

    conversation.lastMessage = newMessage._id;
    if (!conversation.participants.some((p) => p.toString() === sender.toString())) {
      conversation.participants.push(sender);
    }
    await conversation.save();

    await notifyNewMessage({ recipient: resolvedReceiver, senderName, message: newMessage });

    res.status(201).json({
      success: true,
      data: newMessage,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { userId } = req.query;

    const filter = { conversationId, isRead: false };
    if (userId) filter.receiver = userId;

    await Message.updateMany(filter, { isRead: true });

    res.status(200).json({
      success: true,
      message: "Messages marked as read",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
