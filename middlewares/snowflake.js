import crypto from "crypto";
import os from "os";

class SnowflakeID {
  constructor({ epoch = 1735689600000 } = {}) {
    this.epoch = epoch; // Set to Jan 1, 2025
    this.machineId = this.generateMachineId(); // 10 bits
    this.processId = process.pid % 32; // 5 bits (0-31)
    this.sequence = 0; // 7 bits
    this.lastTimestamp = -1;
  }

  generateMachineId() {
    const networkInterfaces = os.networkInterfaces();
    const macAddresses = Object.values(networkInterfaces)
      .flat()
      .map((iface) => iface.mac)
      .filter((mac) => mac && mac !== "00:00:00:00:00:00"); // Filter invalid MACs

    const mac = macAddresses.length > 0 ? macAddresses[0] : "fallback"; // Use fallback if no MAC found
    return (
      parseInt(
        crypto.createHash("md5").update(mac).digest("hex").slice(0, 4),
        16
      ) % 1024
    ); // 10-bit ID
  }

  getTimestamp() {
    return Date.now() - this.epoch;
  }

  waitForNextMillis(lastTimestamp) {
    let timestamp = this.getTimestamp();
    while (timestamp <= lastTimestamp) {
      timestamp = this.getTimestamp();
    }
    return timestamp;
  }

  generate() {
    let timestamp = this.getTimestamp();

    if (timestamp < this.lastTimestamp) {
      console.warn("Clock moved backwards! Waiting for next millisecond...");
      timestamp = this.waitForNextMillis(this.lastTimestamp);
    }

    if (timestamp === this.lastTimestamp) {
      this.sequence = (this.sequence + 1) & 127; // 7-bit sequence (0-127)
      if (this.sequence === 0) {
        timestamp = this.waitForNextMillis(this.lastTimestamp);
      }
    } else {
      this.sequence = 0;
    }

    this.lastTimestamp = timestamp;

    return (
      (BigInt(timestamp) << 22n) |
      (BigInt(this.machineId) << 12n) | // Corrected bit shift
      (BigInt(this.processId) << 7n) | // 5-bit process ID
      BigInt(this.sequence)
    );
  }
}

export default SnowflakeID;
