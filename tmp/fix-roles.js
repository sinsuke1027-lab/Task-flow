const fs = require('fs');
const path = require('path');

const usersPath = 'c:/Users/shinsuke-imanaka/OneDrive - 株式会社デジタルフォルン/デスクトップ/研修・各スキル/Google Antigravity Apps/TaskFlow/src/mocks/users.json';
const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

const updatedUsers = users.map(user => {
  let role = 'user';
  if (user.position === 'President') {
    role = 'president';
  } else if (['Division Manager', 'General Manager'].includes(user.position)) {
    role = 'gm';
  } else if (user.position === 'Team Leader') {
    role = 'tl';
  } else if (user.position === 'Admin' || user.id.includes('admin') || user.departmentId === 'dept_admin') {
    role = 'admin';
  }
  return { ...user, role };
});

fs.writeFileSync(usersPath, JSON.stringify(updatedUsers, null, 2));
console.log('Successfully updated roles for', updatedUsers.length, 'users.');
