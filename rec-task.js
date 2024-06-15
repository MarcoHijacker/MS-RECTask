const { performance } = require("perf_hooks");
const os = require("os");
const crypto = require("crypto");
const fs = require("fs");
const axios = require("axios");

// Global variables
const task_id = "<TASK_ID>";
const jwt = "<JWT>";
const energyLimit = "<ENERGY_LIMIT>"; // Assuming energy limit is a number

// Function to calculate the hash of the current script file
function calculateScriptHash() {
  const scriptContent = fs.readFileSync(__filename);
  return crypto.createHash("sha256").update(scriptContent).digest("hex");
}

// Axios instance with default headers
const axiosInstance = axios.create({
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${jwt}`,
  },
});

// Function to check if a number is prime
function isPrime(num) {
  if (num <= 1) return false;
  if (num <= 3) return true;

  if (num % 2 === 0 || num % 3 === 0) return false;

  for (let i = 5; i * i <= num; i += 6) {
    if (num % i === 0 || num % (i + 2) === 0) return false;
  }

  return true;
}

// Function to get system information and calculate power consumption rate in mWh
function getSystemPowerConsumptionRate() {
  const cpus = os.cpus();
  const cpuModel = cpus[0].model;
  const numCores = cpus.length;
  const cpuSpeedMHz = cpus[0].speed; // speed in MHz
  const totalMemoryGB = os.totalmem() / (1024 ** 3); // total memory in GB

  // Assuming a generic power consumption based on CPU speed, number of cores, and RAM
  const basePowerConsumptionW = 50; // base consumption in watts
  const powerPerCoreW = 10; // additional power per core in watts
  const powerPerGBRamW = 2; // additional power per GB of RAM in watts

  const totalPowerConsumptionW =
    basePowerConsumptionW + numCores * powerPerCoreW + totalMemoryGB * powerPerGBRamW;
  const totalPowerConsumptionmWh = totalPowerConsumptionW * 1000; // converting to mWh

  return {
    cpuModel,
    numCores,
    cpuSpeedMHz,
    totalMemoryGB,
    totalPowerConsumptionmWh,
  };
}

// Function to find all prime numbers between a and b
function findPrimesBetween(a = 0, b = 1000000000, energyLimit) {
  const primes = [];
  const { totalPowerConsumptionmWh } = getSystemPowerConsumptionRate();
  const startTime = performance.now();

  for (let i = a; i <= b; i++) {
    if (isPrime(i)) {
      primes.push(i);
    }

    // Periodically check energy consumption
    if (i % 100 === 0) {
      const currentTime = performance.now();
      const executionTime = currentTime - startTime;
      const executionTimeHours = executionTime / (1000 * 3600); // converting milliseconds to hours
      const energyConsumptionmWh = totalPowerConsumptionmWh * executionTimeHours;

      if (energyConsumptionmWh > energyLimit) {
        console.log("Prime numbers found so far:", primes);
        console.log("Total execution time (ms):", executionTime.toFixed(3));
        console.log("Estimated energy consumption (mWh):", energyConsumptionmWh.toFixed(3));
        console.log("Energy limit quota (mWh):", energyLimit);
        console.log("Delta between limit quota and consumed energy (mWh):", (energyLimit - energyConsumptionmWh).toFixed(3));
        console.log("Program terminated due to exceeded mWh limit quota.");

        axiosInstance.patch(`http://localhost:8086/api/task/execution/${task_id}`, { status: 3, hash: calculateScriptHash() })
          .then(() => {
            process.exit(1);
          })
          .catch((error) => {
            console.error("Error making final API call:", error);
            process.exit(1);
          });

        return primes; // Early return on energy limit exceedance
      }
    }
  }

  return primes;
}

// Main execution logic
const scriptHash = calculateScriptHash();

axiosInstance.get(`http://localhost:8086/api/task/${task_id}`)
  .then((response) => {
    if (response.data.hash !== scriptHash) {
      console.error("Hash mismatch. Terminating program.");

      axiosInstance.patch(`http://localhost:8086/api/task/execution/${task_id}`, { status: 4, hash: scriptHash })
        .then(() => {
          process.exit(1);
        })
        .catch((error) => {
          console.error("Error making API call:", error);
          process.exit(1);
        });
    } else {
      axiosInstance.patch(`http://localhost:8086/api/task/execution/${task_id}`, { status: 1, hash: scriptHash })
        .then(() => {
          // Read command line arguments for a and b
          const [, , argA, argB] = process.argv;
          const a = parseInt(argA, 10) || 0;
          const b = parseInt(argB, 10) || 200000000;

          if (isNaN(a) || isNaN(b)) {
            console.error("Please provide valid numbers for a and b.");
            process.exit(1);
          }

          // Measure execution time
          const startTime = performance.now();
          const primes = findPrimesBetween(a, b, energyLimit);
          const endTime = performance.now();
          const executionTime = endTime - startTime;

          const { cpuModel, numCores, cpuSpeedMHz, totalMemoryGB, totalPowerConsumptionmWh } = getSystemPowerConsumptionRate();

          console.log(`CPU Model: ${cpuModel}`);
          console.log(`Number of CPU Cores: ${numCores}`);
          console.log(`CPU Speed (MHz): ${cpuSpeedMHz}`);
          console.log(`Total Memory (GB): ${totalMemoryGB}`);
          console.log(`Estimated Power Consumption Rate (mWh per hour): ${totalPowerConsumptionmWh}`);

          console.log(`Prime numbers between ${a} and ${b}:`, primes);
          console.log("Total execution time (ms):", executionTime.toFixed(3));

          // Final energy consumption estimate
          const executionTimeHours = executionTime / (1000 * 3600); // converting milliseconds to hours
          const energyConsumptionmWh = totalPowerConsumptionmWh * executionTimeHours;

          console.log("Estimated energy consumption (mWh):", energyConsumptionmWh.toFixed(3));
          console.log("Energy limit quota (mWh):", energyLimit);
          console.log("Delta between limit quota and consumed energy (mWh):", (energyLimit - energyConsumptionmWh).toFixed(3));

          // Determine final status based on energy consumption
          const finalStatus = energyConsumptionmWh > energyLimit ? 3 : 2;

          const payload = {
            status: parseInt(finalStatus),
            executionTime: parseInt(executionTimeHours),
            energyConsumed: parseInt(energyConsumptionmWh),
            hash: scriptHash,
          };

          axiosInstance.patch(`http://localhost:8086/api/task/execution/${task_id}`, payload)
            .then(() => {
              process.exit(finalStatus === 3 ? 1 : 0);
            })
            .catch((error) => {
              console.log(payload);
              console.error("Error making final API call:", error);
              process.exit(1);
            });
        })
        .catch((error) => {
          console.error("Error making API call:", error);
          process.exit(1);
        });
    }
  })
  .catch((error) => {
    console.error("Error making API call:", error);
    process.exit(1);
  });