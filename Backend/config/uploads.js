const path = require('path');

const uploadsConfig = {
    baseDir: path.join(__dirname, '../public/uploads'),
    profilePictures: {
        dir: 'profile-pictures',
        allowedTypes: ['image/jpeg', 'image/png', 'image/jpg'],
        maxSize: 5 * 1024 * 1024, // 5MB
    },
    getProfilePicturePath: function() {
        return path.join(this.baseDir, this.profilePictures.dir);
    }
};

module.exports = uploadsConfig;
