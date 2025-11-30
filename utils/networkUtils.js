const os = require('os');

function findFirstNonInternalIPv4(interfaces) {
  for (const interfaceName of Object.keys(interfaces)) {
    for (const iface of interfaces[interfaceName]) {
      if (isNonInternalIPv4(iface)) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

function isNonInternalIPv4(iface) {
  return iface.family === 'IPv4' && !iface.internal;
}

function getLocalIPAddress() {
  const networkInterfaces = os.networkInterfaces();
  return findFirstNonInternalIPv4(networkInterfaces);
}

function getAllNonInternalIPv4Addresses() {
  const networkInterfaces = os.networkInterfaces();
  const addresses = [];
  
  Object.keys(networkInterfaces).forEach((interfaceName) => {
    networkInterfaces[interfaceName].forEach((iface) => {
      if (isNonInternalIPv4(iface)) {
        addresses.push(iface.address);
      }
    });
  });
  
  return addresses;
}

module.exports = {
  getLocalIPAddress,
  getAllNonInternalIPv4Addresses
};

