const { ROOM } = require('../config/constants');

function createRoomIfNotExists(rooms, roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      users: new Set(),
      createdAt: Date.now()
    });
    return true;
  }
  return false;
}

function isRoomFull(room) {
  return room.users.size >= ROOM.MAX_USERS_PER_ROOM;
}

function addUserToRoom(room, socketId) {
  room.users.add(socketId);
}

function removeUserFromRoom(room, socketId) {
  room.users.delete(socketId);
}

function getExistingUsersInRoom(room, currentSocketId) {
  return Array.from(room.users).filter(socketId => socketId !== currentSocketId);
}

function shouldDeleteRoom(room) {
  return room.users.size === 0;
}

function isRoomExpired(room, currentTime) {
  const { TIMEOUT_MS } = ROOM;
  return room.users.size === 0 && (currentTime - room.createdAt) > TIMEOUT_MS;
}

module.exports = {
  createRoomIfNotExists,
  isRoomFull,
  addUserToRoom,
  removeUserFromRoom,
  getExistingUsersInRoom,
  shouldDeleteRoom,
  isRoomExpired
};


