import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function checkPort(port) {
  try {
    // Для Linux/Mac
    const { stdout } = await execAsync(`lsof -i :${port}`);
    console.log(`❌ Port ${port} is used by:\n${stdout}`);
    return true;
  } catch (error) {
    console.log(`✅ Port ${port} is free`);
    return false;
  }
}

// Проверяем порты
await checkPort(3000);
await checkPort(3001);
