const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'data', 'tasks.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

let updated = 0;
for (const task of data.tasks) {
  if (!task.createdAt) {
    task.createdAt = task.meetingDate || data.refreshedAt || '2026-01-29T00:00:00Z';
    updated++;
  }
}

fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
console.log(`Backfilled createdAt on ${updated} tasks`);
