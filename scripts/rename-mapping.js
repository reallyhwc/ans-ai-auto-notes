// rename-mapping.js — 扫描 kb/ 下所有 md，从 frontmatter title 生成中文文件名映射
// 用法: node scripts/rename-mapping.js [--dry-run] [--apply]

const fs = require('fs');
const path = require('path');

const KB = 'kb';
const MAPPING_FILE = 'scripts/rename-mapping.json';

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm = {};
  for (const line of match[1].split('\n')) {
    const m = line.match(/^(\w+):\s*(.*)/);
    if (m) fm[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
  return fm;
}

function titleToFilename(title) {
  if (!title) return null;
  let name = title.replace(/:/g, '：');
  name = name.replace(/[\/\\*?"<>|]/g, '');
  name = name.replace(/\s+/g, ' ');
  name = name.trim();
  if (name.length > 60) name = name.slice(0, 60);
  return name + '.md';
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function walkMd(dir, base) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      results.push(...walkMd(full, base));
    } else if (e.isFile() && e.name.endsWith('.md')) {
      results.push(path.relative(base, full));
    }
  }
  return results;
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const apply = process.argv.includes('--apply');

  const allFiles = walkMd(KB, '.');
  const mapping = {};
  const reverse = {};
  const skipped = [];

  for (const rel of allFiles) {
    const content = fs.readFileSync(rel, 'utf-8');
    const fm = parseFrontmatter(content);
    const title = fm.title;
    if (!title) {
      skipped.push({ rel, reason: 'no frontmatter title' });
      continue;
    }
    const newName = titleToFilename(title);
    const dir = path.dirname(rel);
    const newPath = path.join(dir, newName);

    if (newPath === rel) continue;

    mapping[rel] = newPath;

    if (reverse[newPath]) {
      console.error(`冲突: "${reverse[newPath]}" 和 "${rel}" 都映射到 "${newPath}"`);
      process.exit(1);
    }
    reverse[newPath] = rel;
  }

  console.log(`扫描: ${allFiles.length} 个文件`);
  console.log(`需重命名: ${Object.keys(mapping).length} 个`);
  console.log(`已匹配: ${allFiles.length - Object.keys(mapping).length - skipped.length} 个`);
  if (skipped.length > 0) {
    console.log(`跳过 (无 title): ${skipped.length} 个`);
    for (const s of skipped) console.log(`  - ${s.rel}`);
  }

  if (dryRun) {
    console.log('\n--- 重命名映射 (--dry-run) ---');
    for (const [old, n] of Object.entries(mapping)) {
      console.log(`  ${path.basename(old)} → ${path.basename(n)}`);
    }
  }

  if (apply) {
    // Step 1: Rename files on disk
    console.log('\n--- Step 1: 执行重命名 ---');
    for (const [old, n] of Object.entries(mapping)) {
      const dir = path.dirname(n);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.renameSync(old, n);
      console.log(`  ${path.basename(old)} → ${path.basename(n)}`);
    }

    // Step 2: Update all references
    console.log('\n--- Step 2: 更新引用 ---');
    const filesToScan = findReferencingFiles();
    let countFull = 0;
    let countBasename = 0;

    const basenameMap = {};
    for (const [old, n] of Object.entries(mapping)) {
      basenameMap[path.basename(old)] = path.basename(n);
    }

    for (const file of filesToScan) {
      if (!fs.existsSync(file)) continue;
      let content = fs.readFileSync(file, 'utf-8');
      let changed = false;
      const isKbFile = file.startsWith('kb/');

      // Full-path replacement for non-kb files (scripts, tests, config)
      if (!isKbFile) {
        for (const [old, n] of Object.entries(mapping)) {
          if (content.includes(old)) {
            content = content.replaceAll(old, n);
            changed = true;
            countFull++;
          }
        }
      }

      // Basename replacement for relative markdown links
      // Matches: ](any/path/old-filename.md) or ](any/path/old-filename.md#...)
      if (isKbFile || file.startsWith('timeline/')) {
        for (const [oldName, newName] of Object.entries(basenameMap)) {
          const esc = escapeRegex(oldName);
          const regexStr = '\\]\\(' + '[^)]*?' + esc + '[)#]';
          const regex = new RegExp(regexStr, 'g');
          const newContent = content.replace(regex, function(match) {
            return match.replace(oldName, newName);
          });
          if (newContent !== content) {
            content = newContent;
            changed = true;
            countBasename++;
          }
        }
      }

      if (changed) {
        fs.writeFileSync(file, content, 'utf-8');
        console.log(`  ${file}`);
      }
    }
    console.log(`  完整路径替换: ${countFull}, 相对链接替换: ${countBasename}`);

    fs.writeFileSync(MAPPING_FILE, JSON.stringify(mapping, null, 2));
    console.log(`\n映射表已保存到 ${MAPPING_FILE}`);
  } else {
    fs.writeFileSync(MAPPING_FILE, JSON.stringify(mapping, null, 2));
    console.log(`\n映射表已保存到 ${MAPPING_FILE}`);
    console.log('用 --apply 执行重命名和引用更新');
  }
}

function findReferencingFiles() {
  const files = [];

  function walkAllMd(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walkAllMd(full);
      else if (e.isFile() && e.name.endsWith('.md')) files.push(full);
    }
  }
  walkAllMd(KB);
  walkAllMd('timeline');
  walkAllMd('memory');

  if (fs.existsSync('timeline.json')) files.push('timeline.json');

  if (fs.existsSync('tests')) {
    const t = fs.readdirSync('tests', { withFileTypes: true });
    for (const e of t) {
      if (e.isFile() && e.name.endsWith('.js')) files.push(path.join('tests', e.name));
    }
  }

  if (fs.existsSync('scripts')) {
    const s = fs.readdirSync('scripts', { withFileTypes: true });
    for (const e of s) {
      if (e.isFile() && (e.name.endsWith('.js') || e.name.endsWith('.sh')))
        files.push(path.join('scripts', e.name));
    }
  }

  for (const f of ['CLAUDE.md', 'INDEX.md', 'README.md', 'README_EN.md',
    'exit-check.sh', 'test.sh', 'lint.sh', 'server.js']) {
    if (fs.existsSync(f)) files.push(f);
  }

  if (fs.existsSync('.claude/settings.local.json')) files.push('.claude/settings.local.json');

  return files;
}

main();
