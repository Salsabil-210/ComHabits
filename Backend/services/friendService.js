const Friend = require('../models/FriendModel');

const checkFriendship = async (userId1, userId2) => {
  return Friend.findOne({
    $or: [
      { requester: userId1, recipient: userId2, status: 'accepted' },
      { requester: userId2, recipient: userId1, status: 'accepted' }
    ]
  });
};

const validateCanShare = async (requesterId, recipientId) => {
  if (requesterId.toString() === recipientId.toString()) {
    throw new Error('Cannot share with yourself');
  }
  
  const isFriend = await checkFriendship(requesterId, recipientId);
  if (!isFriend) {
    throw new Error('You can only share with friends');
  }
  
  return true;
};

module.exports = {
  checkFriendship,
  validateCanShare
};