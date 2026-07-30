# ComHabits

ComHabits is a full-stack mobile application that helps users build consistent habits through personal tracking and collaborative accountability. Users can create habits, track progress, share habits with friends, and receive real-time updates and notifications.

The project consists of a **Node.js/Express** backend with **MongoDB** and **Socket.IO**, and a cross-platform mobile application built with **React Native (Expo)**.

---

## Features

- Track daily, weekly, and monthly habits
- Monitor positive and negative habit streaks
- Create and manage shared habits with friends
- Real-time notifications and activity updates
- Friend request and relationship management
- Distraction logging and basic analytics
- JWT authentication, input validation, and rate limiting

---

## Tech Stack

**Backend**
- Node.js
- Express.js
- MongoDB & Mongoose
- Socket.IO
- Joi

**Frontend**
- React Native
- Expo
- Expo Router
- Socket.IO Client

---

## Project Structure

```text
ComHabits
├── Backend
│   ├── controllers
│   ├── middleware
│   ├── models
│   ├── routes
│   └── server.js
└── Frontend
    ├── app
    ├── api
    └── socket.js
```

---

## Getting Started

### Backend

```bash
cd Backend
npm install
npm start
```

### Frontend

```bash
cd Frontend
npm install
npx expo start
```

---

## Highlights

- Modular and scalable project structure
- RESTful API architecture
- Real-time communication with Socket.IO
- JWT authentication and secure API practices
- Centralized validation and error handling

---

## License

Developed as a Software Engineering graduation project.
