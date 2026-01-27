import fs from 'fs';
import path from 'path';

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Simple file-based logger
class Logger {
  constructor(name) {
    this.name = name;
    this.logFile = path.join(logsDir, 'app.log');
    this.errorLogFile = path.join(logsDir, 'error.log');
  }

  getTimestamp() {
    return new Date().toISOString();
  }

  write(level, message, meta = {}) {
    const log = {
      timestamp: this.getTimestamp(),
      level,
      logger: this.name,
      message,
      ...meta,
    };

    const logStr = JSON.stringify(log);
    console.log(`[${log.timestamp}] [${level}] [${this.name}] ${message}`, meta);

    // Append to log file
    const targetFile = level === 'ERROR' || level === 'WARN' ? this.errorLogFile : this.logFile;
    fs.appendFile(targetFile, logStr + '\n', (err) => {
      if (err) console.error('Failed to write to log file:', err);
    });
  }

  info(message, meta) {
    this.write('INFO', message, meta);
  }

  error(message, meta) {
    this.write('ERROR', message, meta);
  }

  warn(message, meta) {
    this.write('WARN', message, meta);
  }

  debug(message, meta) {
    if (process.env.NODE_ENV !== 'production') {
      this.write('DEBUG', message, meta);
    }
  }
}

export default Logger;
