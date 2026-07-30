const User = require("../models/UserModel");

class UserRepository {
  async findByEmail(email) {
    if (!email) return null;
    return User.findOne({ email: email.toLowerCase().trim() }).lean();
  }

  async findById(id) {
    if (!id) return null;
    return User.findById(id).lean();
  }

  async create(userData) {
    return User.create(userData);
  }
}

module.exports = new UserRepository();
