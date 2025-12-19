import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Skills Manager - Discover and load Agent Skills
 * Based on agentskills.io specification
 */

// Default skills directory
const SKILLS_DIR = path.join(os.homedir(), '.mcpz', 'skills');

/**
 * Parse YAML frontmatter from SKILL.md content
 * @param {string} content - Full SKILL.md content
 * @returns {{frontmatter: Object, body: string}}
 */
function parseSkillMd(content) {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!frontmatterMatch) {
    return { frontmatter: {}, body: content };
  }

  const frontmatterStr = frontmatterMatch[1];
  const body = frontmatterMatch[2];

  // Simple YAML parser for frontmatter (handles basic key: value pairs)
  const frontmatter = {};
  const lines = frontmatterStr.split('\n');

  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.*)$/);
    if (match) {
      const key = match[1];
      let value = match[2].trim();

      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      frontmatter[key] = value;
    }
  }

  return { frontmatter, body };
}

/**
 * Validate skill name according to spec
 * @param {string} name - Skill name
 * @returns {boolean}
 */
function isValidSkillName(name) {
  if (!name || name.length > 64) return false;
  if (name.startsWith('-') || name.endsWith('-')) return false;
  return /^[a-z0-9-]+$/.test(name);
}

/**
 * Load a skill from a directory
 * @param {string} skillPath - Path to skill directory
 * @returns {Object|null} Skill object or null if invalid
 */
export function loadSkill(skillPath) {
  const skillMdPath = path.join(skillPath, 'SKILL.md');

  if (!fs.existsSync(skillMdPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(skillMdPath, 'utf-8');
    const { frontmatter, body } = parseSkillMd(content);

    // Validate required fields
    if (!frontmatter.name || !frontmatter.description) {
      console.warn(`Skill at ${skillPath} missing required fields (name, description)`);
      return null;
    }

    if (!isValidSkillName(frontmatter.name)) {
      console.warn(`Skill at ${skillPath} has invalid name: ${frontmatter.name}`);
      return null;
    }

    // Check for optional directories
    const hasScripts = fs.existsSync(path.join(skillPath, 'scripts'));
    const hasReferences = fs.existsSync(path.join(skillPath, 'references'));
    const hasAssets = fs.existsSync(path.join(skillPath, 'assets'));

    return {
      name: frontmatter.name,
      description: frontmatter.description,
      license: frontmatter.license || null,
      compatibility: frontmatter.compatibility || null,
      metadata: frontmatter.metadata || {},
      allowedTools: frontmatter['allowed-tools'] ? frontmatter['allowed-tools'].split(' ') : [],
      instructions: body.trim(),
      path: skillPath,
      hasScripts,
      hasReferences,
      hasAssets
    };
  } catch (error) {
    console.error(`Error loading skill from ${skillPath}: ${error.message}`);
    return null;
  }
}

/**
 * Discover all skills in the skills directory
 * @param {string} skillsDir - Directory to scan for skills
 * @returns {Object[]} Array of skill objects
 */
export function discoverSkills(skillsDir = SKILLS_DIR) {
  const skills = [];

  // Ensure skills directory exists
  if (!fs.existsSync(skillsDir)) {
    return skills;
  }

  try {
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillPath = path.join(skillsDir, entry.name);
        const skill = loadSkill(skillPath);

        if (skill) {
          skills.push(skill);
        }
      }
    }
  } catch (error) {
    console.error(`Error discovering skills: ${error.message}`);
  }

  return skills;
}

/**
 * Get skill metadata (lightweight, for initial loading)
 * @param {Object} skill - Full skill object
 * @returns {Object} Metadata only
 */
export function getSkillMetadata(skill) {
  return {
    name: skill.name,
    description: skill.description,
    path: skill.path
  };
}

/**
 * Get skill instructions (loaded on demand)
 * @param {string} skillName - Name of the skill
 * @param {string} skillsDir - Skills directory
 * @returns {string|null} Skill instructions or null
 */
export function getSkillInstructions(skillName, skillsDir = SKILLS_DIR) {
  const skillPath = path.join(skillsDir, skillName);
  const skill = loadSkill(skillPath);

  if (skill) {
    return skill.instructions;
  }

  return null;
}

/**
 * List all available skills with metadata only
 * @param {string} skillsDir - Skills directory
 * @returns {Object[]} Array of skill metadata
 */
export function listSkills(skillsDir = SKILLS_DIR) {
  const skills = discoverSkills(skillsDir);
  return skills.map(getSkillMetadata);
}

/**
 * Get the default skills directory path
 * @returns {string}
 */
export function getSkillsDir() {
  return SKILLS_DIR;
}

/**
 * Ensure the skills directory exists
 */
export function ensureSkillsDir() {
  if (!fs.existsSync(SKILLS_DIR)) {
    fs.mkdirSync(SKILLS_DIR, { recursive: true });
  }
}

/**
 * Parse a skill install source into its components
 * Supports:
 * - github:user/repo (root of repo)
 * - github:user/repo/path/to/skill
 * - https://github.com/user/repo
 * - https://github.com/user/repo/tree/main/path/to/skill
 * @param {string} source - The install source
 * @returns {{type: string, user: string, repo: string, path: string, branch: string}|null}
 */
export function parseInstallSource(source) {
  // Handle github: shorthand
  if (source.startsWith('github:')) {
    const parts = source.slice(7).split('/');
    if (parts.length < 2) return null;

    const user = parts[0];
    const repo = parts[1];
    const skillPath = parts.slice(2).join('/') || '';

    return {
      type: 'github',
      user,
      repo,
      path: skillPath,
      branch: 'main'
    };
  }

  // Handle GitHub URLs
  const githubUrlMatch = source.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+)\/(.+))?$/
  );

  if (githubUrlMatch) {
    return {
      type: 'github',
      user: githubUrlMatch[1],
      repo: githubUrlMatch[2],
      path: githubUrlMatch[4] || '',
      branch: githubUrlMatch[3] || 'main'
    };
  }

  // Handle raw URLs (just a URL)
  if (source.startsWith('http://') || source.startsWith('https://')) {
    return {
      type: 'url',
      url: source
    };
  }

  return null;
}

/**
 * Download and install a skill from a source
 * @param {string} source - Install source (github:user/repo or URL)
 * @param {Object} options - Install options
 * @param {string} options.name - Override skill name (optional)
 * @returns {Promise<{success: boolean, message: string, skill?: Object}>}
 */
export async function installSkill(source, options = {}) {
  const parsed = parseInstallSource(source);

  if (!parsed) {
    return {
      success: false,
      message: `Invalid install source: ${source}. Use github:user/repo or a URL`
    };
  }

  ensureSkillsDir();

  if (parsed.type === 'github') {
    return installFromGitHub(parsed, options);
  }

  return {
    success: false,
    message: `Unsupported install source type: ${parsed.type}`
  };
}

/**
 * Install a skill from GitHub
 * @param {Object} parsed - Parsed GitHub source
 * @param {Object} options - Install options
 * @returns {Promise<{success: boolean, message: string, skill?: Object}>}
 */
async function installFromGitHub(parsed, options = {}) {
  const { user, repo, path: skillPath } = parsed;

  // Determine the skill name from the path or repo name
  const skillName = options.name || (skillPath ? path.basename(skillPath) : repo);

  if (!isValidSkillName(skillName)) {
    return {
      success: false,
      message: `Invalid skill name: ${skillName}. Must be lowercase alphanumeric with hyphens.`
    };
  }

  const targetDir = path.join(SKILLS_DIR, skillName);

  // Check if skill already exists
  if (fs.existsSync(targetDir)) {
    return {
      success: false,
      message: `Skill already exists: ${skillName}. Remove it first with 'mcpz skill remove ${skillName}'`
    };
  }

  try {
    // Use git clone with sparse-checkout if path is specified
    const { execSync } = await import('child_process');

    if (skillPath) {
      // Clone with sparse checkout for subdirectory
      const repoUrl = `https://github.com/${user}/${repo}.git`;
      const tempDir = path.join(os.tmpdir(), `mcpz-skill-${Date.now()}`);

      // Clone the repo with sparse checkout
      execSync(`git clone --filter=blob:none --no-checkout --depth 1 --sparse "${repoUrl}" "${tempDir}"`, {
        stdio: 'pipe'
      });

      // Set up sparse checkout
      execSync(`git -C "${tempDir}" sparse-checkout set "${skillPath}"`, {
        stdio: 'pipe'
      });

      // Checkout
      execSync(`git -C "${tempDir}" checkout`, {
        stdio: 'pipe'
      });

      // Move the skill directory to the target
      const sourceSkillDir = path.join(tempDir, skillPath);
      if (!fs.existsSync(sourceSkillDir)) {
        // Clean up temp dir
        fs.rmSync(tempDir, { recursive: true, force: true });
        return {
          success: false,
          message: `Skill path not found in repository: ${skillPath}`
        };
      }

      // Copy to target
      fs.cpSync(sourceSkillDir, targetDir, { recursive: true });

      // Clean up temp dir
      fs.rmSync(tempDir, { recursive: true, force: true });
    } else {
      // Clone the entire repo
      const repoUrl = `https://github.com/${user}/${repo}.git`;
      execSync(`git clone --depth 1 "${repoUrl}" "${targetDir}"`, {
        stdio: 'pipe'
      });

      // Remove .git directory
      const gitDir = path.join(targetDir, '.git');
      if (fs.existsSync(gitDir)) {
        fs.rmSync(gitDir, { recursive: true, force: true });
      }
    }

    // Validate the skill after installation
    const skill = loadSkill(targetDir);

    if (!skill) {
      // Clean up invalid installation
      fs.rmSync(targetDir, { recursive: true, force: true });
      return {
        success: false,
        message: `Invalid skill: No valid SKILL.md found in ${source}`
      };
    }

    return {
      success: true,
      message: `Successfully installed skill: ${skill.name}`,
      skill
    };
  } catch (error) {
    // Clean up on error
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }

    return {
      success: false,
      message: `Failed to install skill: ${error.message}`
    };
  }
}

/**
 * Remove an installed skill
 * @param {string} skillName - Name of the skill to remove
 * @returns {{success: boolean, message: string}}
 */
export function removeSkill(skillName) {
  const skillDir = path.join(SKILLS_DIR, skillName);

  if (!fs.existsSync(skillDir)) {
    return {
      success: false,
      message: `Skill not found: ${skillName}`
    };
  }

  try {
    fs.rmSync(skillDir, { recursive: true, force: true });
    return {
      success: true,
      message: `Successfully removed skill: ${skillName}`
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to remove skill: ${error.message}`
    };
  }
}
