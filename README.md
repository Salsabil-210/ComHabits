# ComHabits 

ComHabits is a community-driven, collaborative habit tracking application designed to help individuals build positive habits, break bad ones, and stay accountable alongside friends. The system consists of a robust **Express/Node.js/MongoDB Backend** with real-time WebSocket communication and a cross-platform **Expo React Native Frontend**.

---

##  Key Features

* **Dual Habit Tracking:** Track personal daily/weekly/monthly routines as well as bad habits with customized streak recovery algorithms.
* **Collaborative (Shared) Habits:** Share habits with friends. Track combined progress, streaks, and completions in real-time.
* **Interactive Friend System:** Send, accept, reject, or cancel friend requests. Includes cancellation cycle limits and daily limits to prevent spam.
* **Distraction Logging & Analytics:** Log daily distractions (category, description, severity from 1–5) and visualize trends to understand what breaks focus.
* **Real-Time Notification Engine:** Immediate socket-driven alerts for shared habit updates, milestone streaks, and friend requests. Fallback to delivery recovery when clients reconnect.
* **High Security Standards:** Layered clean architecture with Redis token blacklisting/whitelisting, JWT refresh tokens, rate limiting, and fail-fast startup config validation.

---

## 🛠️ Tech Stack

### Backend
* **Runtime:** Node.js (v18+)
* **Framework:** Express.js
* **Database:** MongoDB (via Mongoose ODM)
* **Caching & Sessions:** Redis (`ioredis`)
* **Real-time:** Socket.IO
* **Validations:** Joi (strict schemas for auth, habits, and relationships)
* **Date Utilities:** `date-fns` & `moment` for reliable timezone calculations

### Frontend
* **Framework:** Expo & React Native
* **Navigation:** File-based Expo Router
* **State & Real-time:** Socket.IO Client for instant notifications

---

##  Repository Structure

```
ComHabits/
├── Backend/                 # Express REST API & WebSocket Server
│   ├── config/              # Database connection, auth validation, and upload configs
│   ├── controllers/         # HTTP Controllers (Auth, Habits, Friends, Settings)
│   ├── middleware/          # Security, rate limiting, auth, and central error-handling
│   ├── models/              # Mongoose data schemas (User, Habit, Friend, Notification)
│   ├── repositories/        # Data access layer (UserRepository)
│   ├── routes/              # Express API route declarations
│   ├── services/            # Core business logic layer (AuthService, FriendService)
│   ├── util/                # Redis client, custom errors, validators, socket helpers
│   ├── server.js            # Node server initialization & Socket.IO handlers
│   └── package.json         # Backend dependencies & run scripts
│
├── Frontend/                # React Native Client
│   ├── app/                 # Expo Router file-based screens
│   ├── api/                 # Endpoint calls and client configurations
│   ├── socket.js            # WebSocket client instance initialization
│   └── package.json         # Mobile application dependencies
```

---

## ⚙️ Backend Setup & Environment Variables

Create a `.env` file inside the `Backend/` directory:

```env
PORT=3000
MONGO_URI=mongodb+srv://your_connection_string
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your_super_secure_jwt_secret_key_at_least_32_characters
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:8081
NODE_ENV=development
```

### Installing dependencies & running:

```bash
# Navigate to the backend directory
cd Backend

# Install dependencies
npm install

# Run the server in development mode
npm start
```

---

##  Frontend Setup

Configure your local IP/environment for local debugging.

```bash
# Navigate to the frontend directory
cd Frontend

# Install dependencies
npm install

# Start the Expo Go / Simulator compiler
npx expo start
```

---

##  Unified Local Development

You can run both the Backend server and Frontend Expo client simultaneously from the `Backend` directory using the root concurrency setup:

```bash
cd Backend
npm run dev
```

---

##  Security & Refactoring Standards

This project has been updated to follow top-tier production architectural standards:
* **No Credential Logging:** Secrets (passwords/tokens) are never logged to console outputs.
* **Strict Input Validation:** All authentication and CRUD data are pre-validated on the controller boundary using Joi.
* **Layered Architecture:** Clear separation between Controllers, Services, Repositories, and Utilities.
* **Token Security:** Redis-backed access token blacklisting and refresh token whitelist rotation.
* **Optimized Queries:** Replaced bracket map accesses with native `.get()` calls on Map types and aligned database indices for rapid queries.
