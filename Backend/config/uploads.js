const path = require('path');

const PROFILE_PICTURES_DIR = 'profile-pictures';
const TEMP_DIR = 'temp';

const baseDir = path.resolve(__dirname, '..', 'public', 'uploads');

const uploadsConfig = {
    baseDir,
    profilePictures: {
        dir: PROFILE_PICTURES_DIR,
        allowedTypes: ['image/jpeg', 'image/png', 'image/jpg'],
        maxSize: 5 * 1024 * 1024, // 5MB
    },
    tempDir: TEMP_DIR,
    getProfilePicturePath() {
        return path.join(this.baseDir, this.profilePictures.dir);
    },
    getProfilePictureUrl(filename) {
        return path.posix.join('/uploads', this.profilePictures.dir, filename);
    },
    getTempPath() {
        return path.join(this.baseDir, this.tempDir);
    }
};

module.exports = uploadsConfig;
