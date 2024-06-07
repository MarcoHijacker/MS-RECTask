const now = require('performance-now');

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

// Function to find all prime numbers between a and b
function findPrimesBetween(a, b, energyLimit) {
  const primes = [];
  const powerConsumptionW = 100; // Approximate power consumption in watts
  const startTime = now();

  for (let i = a; i <= b; i++) {
    if (isPrime(i)) {
      primes.push(i);
    }

    // Periodically check energy consumption
    if (i % 100 === 0) { // Adjust the interval as needed for better performance
      const currentTime = now();
      const executionTime = currentTime - startTime;
      const executionTimeSeconds = executionTime / 1000;
      const energyConsumptionWh = powerConsumptionW * (executionTimeSeconds / 3600);
      const energyConsumptionmWh = energyConsumptionWh * 1000;

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
const startTime = now();
const primes = findPrimesBetween(a, b, energyLimit);
const endTime = now();
const executionTime = endTime - startTime;

console.log(`Prime numbers between ${a} and ${b}:`, primes);
console.log('Total execution time (ms):', executionTime.toFixed(3));

// Final energy consumption estimate
const powerConsumptionW = 100; // Approximate power consumption in watts
const executionTimeSeconds = executionTime / 1000;
const energyConsumptionWh = powerConsumptionW * (executionTimeSeconds / 3600);
const energyConsumptionmWh = energyConsumptionWh * 1000;

console.log('Estimated energy consumption (mWh):', energyConsumptionmWh.toFixed(3));
console.log('Energy limit quota (mWh):', energyLimit);
console.log('Delta between limit quota and consumed energy (mWh):', (energyLimit - energyConsumptionmWh).toFixed(3));