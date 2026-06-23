const fs = require('node:fs');
const path = require('node:path');

let hasErrors = false;

function logError(filePath, message) {
  console.error(`\x1b[31m[ERROR]\x1b[0m ${filePath}: ${message}`);
  hasErrors = true;
}

function logSuccess(message) {
  console.log(`\x1b[32m[PASS]\x1b[0m ${message}`);
}

function validateQuests(filePath, data) {
  if (!Array.isArray(data)) {
    return logError(filePath, 'Quests file must be a JSON array at top-level.');
  }
  data.forEach((quest, index) => {
    const required = ['id', 'type', 'target', 'reward', 'title', 'desc'];
    required.forEach(prop => {
      if (quest[prop] === undefined) {
        logError(filePath, `Item index ${index} is missing required property: "${prop}"`);
      }
    });
  });
}

function validateWords(filePath, data) {
  if (!Array.isArray(data)) {
    return logError(filePath, 'Words file must be a JSON array at top-level.');
  }
  data.forEach((word, index) => {
    if (!word.en || !word.hu) {
      logError(filePath, `Item index ${index} is missing "en" or "hu" property.`);
    }
  });
}

function validateFillBlanks(filePath, data) {
  if (typeof data.description !== 'string') {
    logError(filePath, 'Missing or invalid "description" string.');
  }
  if (!Array.isArray(data.items)) {
    return logError(filePath, 'Missing or invalid "items" array.');
  }
  data.items.forEach((item, index) => {
    if (!item.sentence || !item.answer) {
      logError(filePath, `Item index ${index} is missing "sentence" or "answer".`);
    }
  });
}

function validateTrueFalse(filePath, data) {
  if (typeof data.description !== 'string') {
    logError(filePath, 'Missing or invalid "description" string.');
  }
  if (!Array.isArray(data.items)) {
    return logError(filePath, 'Missing or invalid "items" array.');
  }
  data.items.forEach((item, index) => {
    if (!item.question || typeof item.answer !== 'boolean' || !item.explanation) {
      logError(filePath, `Item index ${index} is missing or has invalid "question", "answer" (boolean), or "explanation".`);
    }
  });
}

function validateWordOrder(filePath, data) {
  if (typeof data.description !== 'string') {
    logError(filePath, 'Missing or invalid "description" string.');
  }
  if (!Array.isArray(data.items)) {
    return logError(filePath, 'Missing or invalid "items" array.');
  }
  data.items.forEach((item, index) => {
    if (!item.hu || !item.id || !Array.isArray(item.scrambledWords) || !item.correctAnswer) {
      logError(filePath, `Item index ${index} has invalid or missing "hu", "id", "scrambledWords" (array), or "correctAnswer".`);
    }
  });
}

function validateSectionExam(filePath, data) {
  if (typeof data.description !== 'string') {
    logError(filePath, 'Missing or invalid "description" string.');
  }
  if (data.isDynamicExam) {
    if (typeof data.isDynamicExam !== 'boolean') {
      logError(filePath, '"isDynamicExam" must be a boolean.');
    }
    if (!data.examConfig || typeof data.examConfig !== 'object') {
      return logError(filePath, 'Dynamic exam is missing a valid "examConfig" object.');
    }
    if (typeof data.examConfig.totalQuestions !== 'number') {
      logError(filePath, 'examConfig.totalQuestions must be a number.');
    }
    if (!Array.isArray(data.examConfig.sources)) {
      return logError(filePath, 'examConfig.sources must be an array.');
    }
    data.examConfig.sources.forEach((src, idx) => {
      if (typeof src.file !== 'string' || typeof src.count !== 'number' || typeof src.type !== 'string') {
        logError(filePath, `examConfig.sources index ${idx} must contain file (string), count (number), and type (string).`);
      }
    });
  } else {
    if (!Array.isArray(data.items)) {
      return logError(filePath, 'Missing or invalid "items" array.');
    }
    data.items.forEach((item, index) => {
      if (!item.question || !item.type) {
        logError(filePath, `Item index ${index} is missing "question" or "type".`);
        return;
      }
      if (item.type === 'fill') {
        if (!item.answer) {
          logError(filePath, `Fill-type item at index ${index} is missing "answer".`);
        }
      } else if (item.type === 'order') {
        if (!item.id || !Array.isArray(item.scrambledWords) || !item.correctAnswer) {
          logError(filePath, `Order-type item at index ${index} is missing "id", "scrambledWords", or "correctAnswer".`);
        }
      } else if (item.type === 'tf') {
        if (typeof item.answer !== 'boolean' || !item.explanation) {
          logError(filePath, `True/False-type item at index ${index} has invalid "answer" (must be boolean) or missing "explanation".`);
        }
      } else {
        logError(filePath, `Item index ${index} has unknown type: "${item.type}".`);
      }
    });
  }
}

function processFile(filePath) {
  try {
    const rawContent = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(rawContent);
    const fileName = path.basename(filePath);

    if (fileName === 'quests.json') {
      validateQuests(filePath, data);
    } else if (fileName === 'words.json') {
      validateWords(filePath, data);
    } else if (fileName === 'fillBlanks.json') {
      validateFillBlanks(filePath, data);
    } else if (fileName === 'trueFalse.json') {
      validateTrueFalse(filePath, data);
    } else if (fileName === 'wordOrder.json') {
      validateWordOrder(filePath, data);
    } else if (fileName === 'sectionExam.json') {
      validateSectionExam(filePath, data);
    }

    if (!hasErrors) {
      logSuccess(`Validated: ${path.relative(process.cwd(), filePath)}`);
    }
  } catch (err) {
    logError(filePath, `Failed to parse JSON: ${err.message}`);
  }
}

function walkDir(dir) {
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath);
    } else if (file.endsWith('.json') && file !== '.DS_Store') {
      processFile(fullPath);
    }
  });
}

// Start validation
console.log('Starting JSON schema validation...');
const dataDir = path.join(__dirname, '..', 'data');
if (fs.existsSync(dataDir)) {
  walkDir(dataDir);
} else {
  console.error('Error: Data directory not found.');
  process.exit(1);
}

if (hasErrors) {
  console.error('\n\x1b[31mJSON validation failed with errors.\x1b[0m');
  process.exit(1);
} else {
  console.log('\n\x1b[32mAll JSON files are valid and conform to schema.\x1b[0m');
  process.exit(0);
}
