//const API_URL = process.env.REACT_APP_API_URL || "http://192.168.0.100:3000/api";
const API_URL = process.env.REACT_APP_API_URL || "http://10.0.2.2:3000/api";

const API_ENDPOINTS = {
  // Authentication Endpoints
  REGISTER: "/auth/register",
  LOGIN: "/auth/login",
  LOGOUT: "/auth/logout",

  // Password Reset Endpoints
  FORGOT_PASSWORD: "/password-reset/forgot-password",
  VERIFY_RESET_CODE: "/password-reset/verify-code", 
  RESET_PASSWORD: "/password-reset/reset-password",
  
  // Habits Endpoints
  HABITS: "/habits",
  HABITS_BY_DATE_RANGE: "/habits/by-date-range",
  TRACK_HABIT: (habitId) => `/habits/${habitId}/track`,
  DELETE_HABIT: (habitId) => `/habits/${habitId}`,
  UPDATE_HABIT: (habitId) => `/habits/${habitId}`,
  HABIT_SUMMARY_STATS: "/habits/summary-stats",

  BAD_HABITS: {
    BASE: "/badhabits",
    GET_ALL: "/badhabits/getbadhabits",
    ADD_PAIR: "/badhabits/addbadhabit",
    UPDATE_PAIR: (id) => `/badhabits/updatebadhabit/${id}`,
    DELETE_PAIR: (id) => `/badhabits/deletebadhabit/${id}`,
    TRACK_HABIT: (id) => `/api/badhabits/${id}/track`    },

  // Shared Habits
   SHARED_HABITS: {
    REQUEST: "/shared/request", 
    ACCEPT_REQUEST: (habitId) => `/shared/${habitId}/accept`,
    REJECT_REQUEST: (habitId) => `/shared/${habitId}/reject`,
    GET_ALL: "/shared",
    TRACK: (habitId) => `/shared/${habitId}/track`,
    PROGRESS: (habitId) => `/shared/${habitId}/progress`,
    UPDATE: (habitId) => `/shared/${habitId}/update`,
    DELETE: (habitId) => `/shared/${habitId}/delete`,
  },

  // Friends Endpoints
   SEARCH_USERS: "/friends/search-users",
   SEND_FRIEND_REQUEST: "/friends/send-request",
   CANCEL_REQUEST: "/friends/cancel-request",
   GET_FRIENDS: "/friends/friends",
   GET_PENDING_REQUESTS: "/friends/pending-requests",
   REMOVE_FRIEND: "/friends/remove-friend",
   GET_FRIEND_SUGGESTIONS: "/friends/suggestions",
   GET_INCOMING_REQUESTS: "/friends/incoming-requests",
   ACCEPT_REQUEST: "/friends/accept-request",
   REJECT_REQUEST: "/friends/reject-request",
   FIND_FRIEND_REQUEST: (userId) => `/friends/find-request/${userId}`,

  // Notification Endpoints 
  GET_NOTIFICATIONS: "/notifications",
  GET_UNREAD_COUNT: "/notifications/unread-count",
  MARK_NOTIFICATION_AS_READ: (notificationId) => `/notifications/${notificationId}/read`,
  MARK_ALL_AS_READ: "/notifications/mark-all-read",
  DELETE_NOTIFICATION: (notificationId) => `/notifications/${notificationId}`,
  HANDLE_NOTIFICATION_ACTION: (notificationId) => `/notifications/${notificationId}/action`,
 
  // Settings Endpoints
  UPDATE_USER: "/settings/update",
  CHANGE_PASSWORD: "/settings/change-password",
  DELETE_ACCOUNT: "/settings/delete-account",
  UPLOAD_PROFILE_PICTURE: '/settings/upload-profile-picture',
  DELETE_PROFILE_PICTURE: '/settings/profile-picture',
  GET_PROFILE_PICTURE: '/settings/get-profile-picture',
  
  // Distraction Endpoints
  DISTRACTIONS: {
    LOG: "/distractions/log",
    LOGS: "/distractions/logs",
    COUNTS: "/distractions/counts", 
    STATS: "/distractions/stats",
    EDIT: (id) => `/distractions/edit/${id}`,
    DELETE: (id) => `/distractions/delete/${id}`
  }
};

export { API_URL, API_ENDPOINTS };