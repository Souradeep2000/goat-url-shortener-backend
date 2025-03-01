import crypto from "crypto";
import os from "os";

class SnowflakeID {
  constructor({ epoch = 1735689600000 } = {}) {
    this.epoch = epoch;
    this.machineId = this.generateMachineId(); // 10 bits
    this.processId = process.pid % 32; // 5 bits
    this.sequence = 0; // 5 bits (0-31)
    this.lastTimestamp = -1;
  }

  generateMachineId() {
    const networkInterfaces = os.networkInterfaces();
    const macAddresses = Object.values(networkInterfaces)
      .flat()
      .map((iface) => iface.mac)
      .filter((mac) => mac && mac !== "00:00:00:00:00:00");

    const mac = macAddresses.length > 0 ? macAddresses[0] : "fallback";
    return (
      parseInt(
        crypto.createHash("md5").update(mac).digest("hex").slice(0, 4),
        16
      ) % 1024
    );
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

  generate(regionCode) {
    let timestamp = this.getTimestamp();

    if (timestamp < this.lastTimestamp) {
      console.warn("Clock moved backwards! Waiting for next millisecond...");
      timestamp = this.waitForNextMillis(this.lastTimestamp);
    }

    if (timestamp === this.lastTimestamp) {
      this.sequence = (this.sequence + 1) & 31; // 5-bit sequence
      if (this.sequence === 0) {
        timestamp = this.waitForNextMillis(this.lastTimestamp);
      }
    } else {
      this.sequence = 0;
    }

    this.lastTimestamp = timestamp;

    return (
      (BigInt(timestamp) << 22n) |
      (BigInt(regionCode) << 20n) | // 2-bit region code
      (BigInt(this.machineId) << 10n) |
      (BigInt(this.processId) << 5n) |
      BigInt(this.sequence)
    );
  }

  extractRegion(snowflakeId) {
    return Number((BigInt(snowflakeId) >> 20n) & 0b11n); // Extract 2-bit region code
  }
}

export default SnowflakeID;
