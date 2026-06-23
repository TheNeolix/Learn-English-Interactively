// Helper script executed during GitHub Actions CD deployment to generate db_config.php
// using secure single-quoted PHP variables to avoid variable interpolation issues.
const fs = require('fs');

const esc = (val) => {
  if (!val) return "''";
  return "'" + val.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
};

const content = `<?php
// Automatically compiled by GitHub Actions
define('DB_HOST', ${esc(process.env.DB_HOST)});
define('DB_NAME', ${esc(process.env.DB_NAME)});
define('DB_USER', ${esc(process.env.DB_USER)});
define('DB_PASS', ${esc(process.env.DB_PASS)});
define('MIGRATION_TOKEN', ${esc(process.env.MIGRATION_TOKEN)});
`;

fs.writeFileSync('db_config.php', content);
console.log('db_config.php successfully generated.');
