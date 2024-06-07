const { performance, PerformanceObserver } = require('perf_hooks');
const os = require('os');

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
  // These values can be adjusted based on more accurate benchmarks or specific hardware specs
  const basePowerConsumptionW = 50; // base consumption in watts
  const powerPerCoreW = 10; // additional power per core in watts
  const powerPerGBRamW = 2; // additional power per GB of RAM in watts

  const totalPowerConsumptionW = basePowerConsumptionW + (numCores * powerPerCoreW) + (totalMemoryGB * powerPerGBRamW);
  const totalPowerConsumptionmWh = totalPowerConsumptionW * 1000; // converting to mWh

  return {
    cpuModel,
    numCores,
    cpuSpeedMHz,
    totalMemoryGB,
    totalPowerConsumptionmWh
  };
}

// Function to find all prime numbers between a and b
function findPrimesBetween(a, b, energyLimit) {
  const primes = [];
  const { totalPowerConsumptionmWh } = getSystemPowerConsumptionRate();
  const startTime = performance.now();

  for (let i = a; i <= b; i++) {
    if (isPrime(i)) {
      primes.push(i);
    }

    // Periodically check energy consumption
    if (i % 100 === 0) { // Adjust the interval as needed for better performance
      const currentTime = performance.now();
      const executionTime = currentTime - startTime;
      const executionTimeHours = executionTime / (1000 * 3600); // converting milliseconds to hours
      const energyConsumptionmWh = totalPowerConsumptionmWh * executionTimeHours;

      if (energyConsumptionmWh > energyLimit) {
        console.log('Prime numbers found so far:', primes);
        console.log('Total execution time (ms):', executionTime.toFixed(3));
        console.log('Estimated energy consumption (mWh):', energyConsumptionmWh.toFixed(3));
        console.log('Energy limit quota (mWh):', energyLimit);
        console.log('Delta between limit quota and consumed energy (mWh):', (energyLimit - energyConsumptionmWh).toFixed(3));
        console.log('Program terminated due to exceeded mWh limit quota.');
        process.exit(1);
      }
    }
  }

  return primes;
}

// Read command line arguments for a and b
const [,, argA, argB, argLimit] = process.argv;
const a = parseInt(argA, 10);
const b = parseInt(argB, 10);
const energyLimit = parseInt(argLimit, 10) || 10000; // Default to 10000 mWh if not provided

if (isNaN(a) || isNaN(b)) {
  console.error('Please provide valid numbers for a and b.');
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
console.log('Total execution time (ms):', executionTime.toFixed(3));

// Final energy consumption estimate
const executionTimeHours = executionTime / (1000 * 3600); // converting milliseconds to hours
const energyConsumptionmWh = totalPowerConsumptionmWh * executionTimeHours;

console.log('Estimated energy consumption (mWh):', energyConsumptionmWh.toFixed(3));
console.log('Energy limit quota (mWh):', energyLimit);
console.log('Delta between limit quota and consumed energy (mWh):', (energyLimit - energyConsumptionmWh).toFixed(3));