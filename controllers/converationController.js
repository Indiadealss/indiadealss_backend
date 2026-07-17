import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";


export const sendMessage = async (req, res) => {
  try {
    const {
      conversationId,
      sender,
      senderIp,
      receiver,
      property_id,
      message,
      messageType,
      attachment,
    } = req.body;

    

    if (!sender && !senderIp) {
      return res.status(400).json({
        success: false,
        message: "Sender or senderIp is required",
      });
    }

    let conversation;

    // Existing conversation
    if (conversationId) {
      conversation = await Conversation.findById(conversationId);
    }

    // Create new conversation
    if (!conversation) {
      conversation = await Conversation.create({
        participants: sender ? [sender, receiver] : [receiver],
        guestIp: senderIp || null,
        property_id,
      });
    }

    const newMessage = await Message.create({
      conversationId: conversation._id,
      sender,
      senderIp,
      receiver,
      message,
      messageType,
      attachment,
    });

    

    conversation.lastMessage = newMessage._id;
    await conversation.save();

    return res.status(201).json({
      success: true,
      conversationId: conversation._id,
      data: newMessage,
    });
  } catch (err) {
    console.log(err);

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
      .populate("participants", "fullname email phone")
      .populate("lastMessage")
      .populate("property_id", "projectname");

    res.status(200).json({
      success: true,
      data: conversations,
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
    }).sort({ createdAt: 1 });

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
    const {
      conversationId,
      sender,
      receiver,
      message,
    } = req.body;

    const newMessage = await Message.create({
      conversationId,
      sender,
      receiver,
      message,
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: newMessage._id,
    });

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

    await Message.updateMany(
      {
        conversationId,
        isRead: false,
      },
      {
        isRead: true,
      }
    );

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