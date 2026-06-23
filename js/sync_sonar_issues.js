const { execSync } = require('node:child_process');
const https = require('node:https');
const fs = require('node:fs');

let ghPath = 'gh';
if (fs.existsSync('/opt/homebrew/bin/gh')) {
  ghPath = '/opt/homebrew/bin/gh';
} else if (fs.existsSync('/usr/local/bin/gh')) {
  ghPath = '/usr/local/bin/gh';
} else if (fs.existsSync('/usr/bin/gh')) {
  ghPath = '/usr/bin/gh';
}

// Fixed, unwriteable system directories path for safe execution
const safeEnv = {
  ...process.env,
  PATH: '/usr/bin:/bin:/usr/sbin:/sbin'
};

// Configuration
const PROJECT_KEY = 'Neolix-Studio_Learn-English-Interactively';
const SONAR_TOKEN = process.env.SONAR_TOKEN || ''; // Optional: for private repos

// Fetch issues from SonarCloud API
function fetchSonarIssues() {
  return new Promise((resolve, reject) => {
    // Fetch all unresolved issues
    const url = `https://sonarcloud.io/api/issues/search?componentKeys=${PROJECT_KEY}&resolved=false&ps=100`;
    
    const headers = {
      'User-Agent': 'NodeJS/SonarSync'
    };
    if (SONAR_TOKEN) {
      // SonarCloud supports Basic Auth using token as username with empty password
      const auth = Buffer.from(`${SONAR_TOKEN}:`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
    }

    https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data).issues || []);
          } catch (e) {
            reject(new Error(`Failed to parse response: ${e.message}`));
          }
        } else {
          reject(new Error(`SonarCloud API returned status ${res.statusCode}: ${data}`));
        }
      });
    }).on('error', reject);
  });
}

// Check existing GitHub issues with 'sonarcloud' label
function fetchExistingGitHubIssues() {
  try {
    const output = execSync(`${ghPath} issue list --label "sonarcloud" --json title,body,number --limit 200`, { encoding: 'utf8', env: safeEnv });
    return JSON.parse(output || '[]');
  } catch (e) {
    console.error('Failed to fetch existing GitHub issues via gh CLI:', e.message);
    return [];
  }
}

// Create a new GitHub issue
function createGitHubIssue(issue) {
  const severity = (issue.severity || '').toLowerCase();
  
  // Define tags and labels based on severity
  const labels = ['bug', 'sonarcloud'];
  if (severity === 'blocker') labels.push('severity/blocker');
  else if (severity === 'critical') labels.push('severity/high');
  else if (severity === 'major') labels.push('severity/medium');
  else return; // Skip minor/info issues

  // Add security label for security vulnerabilities or security-tagged issues
  const isSecurity = issue.type === 'VULNERABILITY' || issue.tags?.includes('security');
  if (isSecurity) {
    labels.push('security');
  }

  const title = `[SonarCloud] ${issue.message}`;
  
  // Format body with issue details and trailing metadata key for tracking
  const body = `
### SonarCloud Issue Detail
* **Message:** ${issue.message}
* **Severity:** ${issue.severity}
* **Type:** ${issue.type}
* **File:** [${issue.component}](https://github.com/Neolix-Studio/Learn-English-Interactively/blob/main/${issue.component.split(':').pop()})
* **Line:** ${issue.line || 'N/A'}

[View on SonarCloud](https://sonarcloud.io/project/issues?id=${PROJECT_KEY}&open=${issue.key})

<!-- SonarCloudKey: ${issue.key} -->
`;

  try {
    const { spawnSync } = require('node:child_process');
    const args = ['issue', 'create', '--title', title, '--body', body];
    labels.forEach(l => {
      args.push('--label', l);
    });

    const result = spawnSync(ghPath, args, { encoding: 'utf8', env: safeEnv });
    if (result.status === 0) {
      const issueUrl = result.stdout.trim();
      console.log(`Created GitHub issue: ${issueUrl} for SonarCloud key: ${issue.key}`);
      
      // Route the issue to the project board
      addIssueToProject(issueUrl, isSecurity);
    } else {
      console.error(`Failed to create issue for SonarCloud key ${issue.key}: ${result.stderr}`);
    }
  } catch (e) {
    console.error(`Failed to execute gh CLI for SonarCloud key ${issue.key}:`, e.message);
  }
}

// Add issue to project and set Status
function addIssueToProject(issueUrl, isSecurity) {
  const projectNumber = process.env.PROJECT_NUMBER || '1'; // Default to project 1
  const owner = 'Neolix-Studio';
  
  try {
    const { spawnSync } = require('node:child_process');
    
    // 1. Add item to project
    console.log(`Adding issue to project #${projectNumber}...`);
    const addResult = spawnSync(ghPath, ['project', 'item-add', projectNumber, '--owner', owner, '--url', issueUrl], { encoding: 'utf8', env: safeEnv });
    if (addResult.status !== 0) {
      console.error(`Failed to add issue to project: ${addResult.stderr}`);
      return;
    }

    // Extract item ID (e.g. PVTI_...) from output
    const match = addResult.stdout.match(/PVTI_[A-Za-z0-9_-]+/);
    if (!match) {
      console.error(`Could not parse project item ID from output: ${addResult.stdout}`);
      return;
    }
    const itemId = match[0];

    // 2. Set status to "Security Hotspots" or "Bug/Refinement"
    const targetStatus = isSecurity ? 'Security Hotspots' : 'Bug/Refinement';
    console.log(`Setting status of item ${itemId} to '${targetStatus}'...`);
    const editResult = spawnSync(ghPath, ['project', 'item-edit', projectNumber, '--owner', owner, '--id', itemId, '--field', 'Status', '--value', targetStatus], { encoding: 'utf8', env: safeEnv });
    if (editResult.status !== 0) {
      console.error(`Failed to set status field: ${editResult.stderr}`);
    }
  } catch (e) {
    console.error(`Failed to execute project integration for ${issueUrl}:`, e.message);
  }
}

async function run() {
  try {
    console.log('Fetching issues from SonarCloud...');
    const sonarIssues = await fetchSonarIssues();
    console.log(`Found ${sonarIssues.length} unresolved issues on SonarCloud.`);

    console.log('Fetching existing GitHub issues...');
    const existingIssues = fetchExistingGitHubIssues();
    const existingKeys = new Set();
    
    // Extract SonarCloud keys from HTML comments in existing issue bodies
    existingIssues.forEach(issue => {
      const match = (issue.body || '').match(/<!-- SonarCloudKey:\s*([A-Za-z0-9_-]+)\s*-->/);
      if (match?.[1]) {
        existingKeys.add(match[1]);
      }
    });
    console.log(`Found ${existingKeys.size} tracked SonarCloud issues already open on GitHub.`);

    // Filter and process new issues
    let createdCount = 0;
    for (const issue of sonarIssues) {
      if (existingKeys.has(issue.key)) {
        continue; // Already tracked
      }
      
      const severity = (issue.severity || '').toLowerCase();
      // Only process Blocker, Critical (High), and Major (Medium)
      if (['blocker', 'critical', 'major'].includes(severity)) {
        createGitHubIssue(issue);
        createdCount++;
      }
    }
    
    console.log(`Sync completed. Created ${createdCount} new issues.`);
  } catch (e) {
    console.error('Error running sync:', e.message);
    process.exit(1);
  }
}

run();
