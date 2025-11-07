import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function cleanup() {
    console.log('🧹 Cleaning up...');
    
    try {
        // Останавливаем процессы на портах 3000-3002
        for (let port of [3000, 3001, 3002]) {
            try {
                const { stdout } = await execAsync(`lsof -ti:${port}`);
                if (stdout.trim()) {
                    await execAsync(`kill -9 ${stdout}`);
                    console.log(`✅ Killed process on port ${port}`);
                }
            } catch (error) {
                // Port is free, continue
            }
        }
        
        // Останавливаем процессы бота
        try {
            await execAsync('pkill -f "node.*bot"');
            console.log('✅ Stopped bot processes');
        } catch (error) {
            // No bot processes running
        }
        
        console.log('✅ Cleanup complete!');
    } catch (error) {
        console.error('❌ Cleanup error:', error);
    }
}

cleanup();
