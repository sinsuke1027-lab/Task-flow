import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOCK_DIR = path.join(__dirname, '../src/mocks');

if (!fs.existsSync(MOCK_DIR)) {
  fs.mkdirSync(MOCK_DIR, { recursive: true });
}

// Helper to generate a random ID
const gid = (prefix) => `${prefix}_${Math.random().toString(36).substr(2, 9)}`;

// Positions
const POSITIONS = {
  PRESIDENT: 'President',
  DIV_MGR: 'Division Manager',
  GM: 'General Manager',
  TL: 'Team Leader',
  MEMBER: 'Member'
};

// Roles
const ROLES = {
  ADMIN: 'admin',
  USER: 'user'
};

const firstNames = ['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤'];
const lastNames = ['健二', '美咲', '太郎', '花子', '浩', '洋子', '智子', '真一', '直樹', '恵'];

function generateName() {
  const f = firstNames[Math.floor(Math.random() * firstNames.length)];
  const l = lastNames[Math.floor(Math.random() * lastNames.length)];
  return `${f} ${l}`;
}

const orgUnits = [];
const users = [];

// 1. Create Root / Presidential Office
const rootUnit = { id: 'org_root', name: '代表取締役直轄', type: 'root', parentId: null };
orgUnits.push(rootUnit);

const president = {
  id: 'user_president',
  name: '山田 太郎',
  email: 'yamada.t@example.com',
  role: ROLES.USER,
  departmentId: 'dept_ga',
  orgUnitId: rootUnit.id,
  managerId: null,
  position: POSITIONS.PRESIDENT,
  avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=山田`
};
users.push(president);

// 2. Create Divisions
const divisions = [
  { name: '営業本部', code: 'sales' },
  { name: '開発本部', code: 'dev' },
  { name: '管理本部', code: 'admin' }
];

divisions.forEach((div, i) => {
  const divId = `org_div_${div.code}`;
  orgUnits.push({ id: divId, name: div.name, type: 'division', parentId: rootUnit.id });

  const divMgr = {
    id: `user_divmgr_${i}`,
    name: generateName(),
    email: `${div.code}.mgr@example.com`,
    role: ROLES.USER,
    departmentId: 'dept_ga',
    orgUnitId: divId,
    managerId: president.id,
    position: POSITIONS.DIV_MGR,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${div.code}mgr`
  };
  users.push(divMgr);

  // 3. Create Groups (total 8)
  const groupCount = i === 2 ? 2 : 3; // 3+3+2 = 8
  for (let g = 0; g < groupCount; g++) {
    const groupId = `org_grp_${div.code}_${g}`;
    orgUnits.push({ id: groupId, name: `${div.name} 第${g+1}グループ`, type: 'group', parentId: divId });

    const gm = {
      id: `user_gm_${div.code}_${g}`,
      name: generateName(),
      email: `${div.code}.gm${g}@example.com`,
      role: ROLES.USER,
      departmentId: 'dept_ga',
      orgUnitId: groupId,
      managerId: divMgr.id,
      position: POSITIONS.GM,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${div.code}gm${g}`
    };
    users.push(gm);

    // 4. Create Teams (total 15)
    const teamCount = 2; // 8 groups * 2 = 16 teams (approx 15)
    for (let t = 0; t < teamCount; t++) {
      if (users.filter(u => u.position === POSITIONS.TL).length >= 15) continue;
      
      const teamId = `org_team_${div.code}_${g}_${t}`;
      orgUnits.push({ id: teamId, name: `${div.name} 第${g+1}G 第${t+1}チーム`, type: 'team', parentId: groupId });

      const tl = {
        id: `user_tl_${div.code}_${g}_${t}`,
        name: generateName(),
        email: `${div.code}.tl${g}${t}@example.com`,
        role: ROLES.USER,
        departmentId: 'dept_ga',
        orgUnitId: teamId,
        managerId: gm.id,
        position: POSITIONS.TL,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${div.code}tl${g}${t}`
      };
      users.push(tl);

      // 5. Create Members (total 120)
      const memberCount = Math.floor(120 / 15); 
      for (let m = 0; m < memberCount; m++) {
        users.push({
          id: gid('user_m'),
          name: generateName(),
          email: `${div.code}.m${g}${t}${m}@example.com`,
          role: ROLES.USER,
          departmentId: 'dept_ga',
          orgUnitId: teamId,
          managerId: tl.id,
          position: POSITIONS.MEMBER,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random()}`
        });
      }
    }
  }
});

// Add some Back-office Admins explicitly
const admin1 = {
  id: 'user_admin_1',
  name: '佐藤 健二',
  email: 'kenji.sato@example.com',
  role: ROLES.ADMIN,
  departmentId: 'dept_ga',
  orgUnitId: 'org_div_admin',
  managerId: null,
  position: POSITIONS.GM,
  avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=Kenji`
};
users.push(admin1);

// Categories
const categories = [
  // HR
  { id: 'cat_hr_base', name: '人事・労務', parentId: null, targetDepartmentId: 'dept_hr' },
  { id: 'cat_hr_benefit', name: '資格取得祝金申請', parentId: 'cat_hr_base', targetDepartmentId: 'dept_hr', slaDays: 5 },
  { id: 'cat_hr_commuting', name: '通勤経費変更申請', parentId: 'cat_hr_base', targetDepartmentId: 'dept_hr', slaDays: 3 },
  { id: 'cat_hr_health', name: '健康診断面談希望', parentId: 'cat_hr_base', targetDepartmentId: 'dept_hr', slaDays: 2 },
  
  // IT
  { id: 'cat_it_base', name: 'IT・情報システム', parentId: null, targetDepartmentId: 'dept_it' },
  { id: 'cat_it_pc', name: 'PC貸与・交換依頼', parentId: 'cat_it_base', targetDepartmentId: 'dept_it', slaDays: 7 },
  { id: 'cat_it_soft', name: 'ソフトウェア導入相談', parentId: 'cat_it_base', targetDepartmentId: 'dept_it', slaDays: 14 },
  { id: 'cat_it_account', name: '各種アカウント発行', parentId: 'cat_it_base', targetDepartmentId: 'dept_it', slaDays: 1 },
  
  // GA (General Affairs)
  { id: 'cat_ga_base', name: '総務・ファシリティ', parentId: null, targetDepartmentId: 'dept_ga' },
  { id: 'cat_ga_card', name: '名刺作成依頼', parentId: 'cat_ga_base', targetDepartmentId: 'dept_ga', slaDays: 3 },
  { id: 'cat_ga_mail', name: '郵便物・宅配発送', parentId: 'cat_ga_base', targetDepartmentId: 'dept_ga', slaDays: 1 },
];

// Tasks
const tasks = [];
const statusIds = ['status_todo', 'status_working', 'status_done'];

statusIds.forEach(sid => {
  for (let i = 0; i < 30; i++) {
    const requestor = users[Math.floor(Math.random() * users.length)];
    const category = categories.filter(c => c.parentId !== null)[Math.floor(Math.random() * categories.filter(c => c.parentId !== null).length)];
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - Math.floor(Math.random() * 30));
    
    const dueDate = new Date(createdAt);
    dueDate.setDate(dueDate.getDate() + (category.slaDays || 5));

    tasks.push({
      id: gid('task'),
      title: `${category.name} - ${i+1}`,
      description: `${category.name}に関する依頼です。詳細は添付資料をご確認ください。`,
      requestorId: requestor.id,
      targetDepartmentId: category.targetDepartmentId,
      categoryId: category.id,
      statusId: sid,
      priority: ['low', 'normal', 'high'][Math.floor(Math.random() * 3)],
      createdAt: createdAt.toISOString(),
      updatedAt: new Date().toISOString(),
      dueDate: dueDate.toISOString(),
      approvalSteps: [
        { id: gid('step'), order: 1, approverId: requestor.managerId || president.id, status: sid === 'status_todo' ? 'pending' : 'approved', processedAt: sid === 'status_todo' ? null : createdAt.toISOString() }
      ]
    });
  }
});

fs.writeFileSync(path.join(MOCK_DIR, 'users.json'), JSON.stringify(users, null, 2));
fs.writeFileSync(path.join(MOCK_DIR, 'org_units.json'), JSON.stringify(orgUnits, null, 2));
fs.writeFileSync(path.join(MOCK_DIR, 'categories.json'), JSON.stringify(categories, null, 2));
fs.writeFileSync(path.join(MOCK_DIR, 'tasks.json'), JSON.stringify(tasks, null, 2));

console.log('Mock data generated successfully.');
console.log(`Users: ${users.length}`);
console.log(`Tasks: ${tasks.length}`);
