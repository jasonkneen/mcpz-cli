import { InstanceManager } from './src/utils/instanceManager.js';

// Get the instance manager
const instanceManager = InstanceManager.getInstance();

// Print all instances
console.info('All instances:');
console.info(instanceManager.getAllInstances());

// Wait a bit to allow health check to run
setTimeout(() => {
  console.info('\nAfter health check:');
  console.info(instanceManager.getAllInstances());
  
  // Clean up stale instances
  console.info('\nCleaning stale instances...');
  instanceManager.cleanupStaleInstances();
  
  console.info('\nAfter cleanup:');
  console.info(instanceManager.getAllInstances());
}, 5000);