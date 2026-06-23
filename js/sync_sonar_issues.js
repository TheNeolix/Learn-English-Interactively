const { execSync } = require('child_process');
const https = require('https');

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
    const output = execSync('gh issue list --label "sonarcloud" --json title,body,number --limit 200', { encoding: 'utf8' });
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
    const labelFlags = labels.map(l => `--label "${l}"`).join(' ');
    const command = `gh issue create --title ${JSON.stringify(title)} --body ${JSON.stringify(body)} ${labelFlags}`;
    const output = execSync(command, { encoding: 'utf8' });
    console.log(`Created GitHub issue: ${output.trim()} for SonarCloud key: ${issue.key}`);
  } catch (e) {
    console.error(`Failed to create issue for SonarCloud key ${issue.key}:`, e.message);
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
      const match = (issue.body || '').match(/<!-- SonarCloudKey:\s*([A-Za-z0-9_\-]+)\s*-->/);
      if (match && match[1]) {
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
