const { performance, PerformanceObserver } = require('perf_hooks');
const os = require('os');
const crypto = require('crypto');
const fs = require('fs');
const https = require('https'); // For https calls

// Global variables
const task_id = "<TASK_ID>";
const jwt = "<JWT>";
const energyLimit = "<ENERGY_LIMIT>";
const taskEffort = "<TASK_EFFORT>"; // Could be low, mid or high

// Function to calculate the hash of the current script file
function calculateScriptHash() {
  const scriptContent = fs.readFileSync(__filename);
  return crypto.createHash('sha256').update(scriptContent).digest('hex');
}

// Function to make an HTTP request with retry mechanism
function httpRequest(method, url, data, callback, retries = 3, delay = 1000) {
  const options = {
    method: method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt}`
    },
    timeout: 5000 // 5 seconds timeout
  };

  const req = https.request(url, options, (res) => {
    let body = '';
    res.on('data', chunk => {
      body += chunk;
    });
    res.on('end', () => {
      callback(null, res, body);
    });
  });

  req.on('error', (e) => {
    if (retries > 0) {
      setTimeout(() => {
        httpRequest(method, url, data, callback, retries - 1, delay * 2);
      }, delay);
    } else {
      callback(e);
    }
  });

  req.on('timeout', () => {
    req.abort();
    if (retries > 0) {
      setTimeout(() => {
        httpRequest(method, url, data, callback, retries - 1, delay * 2);
      }, delay);
    } else {
      callback(new Error('Request timed out'));
    }
  });

  if (data) {
    req.write(JSON.stringify(data));
  }

  req.end();
}

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
function findPrimesBetween(a = 0, b = 1000000000, energyLimit) {
  const primes = [];
  const { totalPowerConsumptionmWh } = getSystemPowerConsumptionRate();
  const startTime = performance.now();

  for (let i = a; i <= b; i++) {
    if (isPrime(i)) {
      primes.push(i);
    }

    if (i % 100 === 0) {
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

        httpRequest('PATCH', `https://t2f5wgen2d.execute-api.us-east-1.amazonaws.com/dev/api/v1/task/modify/execution?id=${task_id}`, { status: 3, hash: scriptHash }, (err) => {
          if (err) {
            console.error('Error making API call:', err);
          }
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

httpRequest('GET', `https://t2f5wgen2d.execute-api.us-east-1.amazonaws.com/dev/api/v1/task/find/by-id?id=${task_id}`, null, (err, res, body) => {
  if (err) {
    console.error('Error making API call:', err);
    process.exit(1);
  }

  const response = JSON.parse(body);

  // Check if status is 2 or 3
  if (response.status === 2 || response.status === 3) {
    console.error('Task is already completed or finished, cannot be restarted.');
    process.exit(1);
  }
  
  if (response.hash !== scriptHash) {
    console.error('Hash mismatch. Terminating program.');

    httpRequest('PATCH', `https://t2f5wgen2d.execute-api.us-east-1.amazonaws.com/dev/api/v1/task/modify/execution?id=${task_id}`, { status: 4, hash: scriptHash }, (err) => {
      if (err) {
        console.error('Error making API call:', err);
      }
      process.exit(1);
    });
  } else {
    httpRequest('PATCH', `https://t2f5wgen2d.execute-api.us-east-1.amazonaws.com/dev/api/v1/task/modify/execution?id=${task_id}`, { status: 1, hash: scriptHash }, (err) => {
      if (err) {
        console.error('Error making API call:', err);
        process.exit(1);
      }

      const [,, argA, argB] = process.argv;
      const a = parseInt(argA, 10) || 0;
      const b = parseInt(argB, 10) || (taskEffort === "low" ? 100000000 : taskEffort === "mid" ? 200000000 : taskEffort === "high" ? 500000000 : 100000000);

      if (isNaN(a) || isNaN(b)) {
        console.error('Please provide valid numbers for a and b.');
        process.exit(1);
      }

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

      const executionTimeHours = executionTime / (1000 * 3600); // converting milliseconds to hours
      const energyConsumptionmWh = totalPowerConsumptionmWh * executionTimeHours;

      console.log('Estimated energy consumption (mWh):', energyConsumptionmWh.toFixed(3));
      console.log('Energy limit quota (mWh):', energyLimit);
      console.log('Delta between limit quota and consumed energy (mWh):', (energyLimit - energyConsumptionmWh).toFixed(3));

      const finalStatus = energyConsumptionmWh > energyLimit ? 3 : 2;

      console.log('Final status:', finalStatus); // Debugging log
      console.log('Sending final request with data:', {
        status: finalStatus,
        hash: scriptHash,
        executionTime: executionTimeHours.toFixed(3),
        energyConsumed: energyConsumptionmWh.toFixed(3)
      }); // Debugging log

      httpRequest('PATCH', `https://t2f5wgen2d.execute-api.us-east-1.amazonaws.com/dev/api/v1/task/modify/execution?id=${task_id}`, {
        status: finalStatus,
        hash: scriptHash,
        executionTime: parseFloat(executionTimeHours.toFixed(3)),
        energyConsumed: parseFloat(energyConsumptionmWh.toFixed(3))
      }, (err) => {
        if (err) {
          console.error('Error making final API call:', err);
        }
        process.exit(finalStatus === 3 ? 1 : 0);
      });
    });
  }
});