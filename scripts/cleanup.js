import { exec } from 'child_process';

console.log('🧹 Cleaning up ports...');

// Останавливаем процессы на портах 3000-3002
[3000, 3001, 3002].forEach(port => {
  exec(`lsof -ti:${port} | xargs kill -9`, (err) => {
    if (err) {
      console.log(`Port ${port} is free`);
    } else {
      console.log(`✅ Killed process on port ${port}`);
    }
  });
});

setTimeout(() => {
  console.log('✅ Cleanup complete!');
  process.exit(0);
}, 2000);
