import chalk from 'chalk';
import { listSkills, getSkillInstructions, getSkillsDir, ensureSkillsDir, installSkill, removeSkill } from '../utils/skills.js';

/**
 * List all installed skills
 */
export function list() {
  const skills = listSkills();

  if (skills.length === 0) {
    console.info(chalk.yellow('No skills installed'));
    console.info(chalk.gray(`Skills directory: ${getSkillsDir()}`));
    console.info(chalk.gray('Add skills by creating directories with SKILL.md files'));
    return;
  }

  console.info(chalk.bold('\nInstalled Skills:'));
  console.info(chalk.gray('─'.repeat(50)));

  skills.forEach(skill => {
    console.info(chalk.cyan(`\n  ${skill.name}`));
    console.info(chalk.gray(`    ${skill.description}`));
    console.info(chalk.gray(`    Path: ${skill.path}`));
  });

  console.info('');
}

/**
 * Show details for a specific skill
 * @param {string} name - Skill name
 */
export function show(name) {
  if (!name) {
    console.info(chalk.red('Skill name is required'));
    return;
  }

  const instructions = getSkillInstructions(name);

  if (!instructions) {
    console.info(chalk.red(`Skill '${name}' not found`));
    return;
  }

  console.info(chalk.bold(`\nSkill: ${name}`));
  console.info(chalk.gray('─'.repeat(50)));
  console.info(instructions);
  console.info('');
}

/**
 * Show the skills directory path
 */
export function dir() {
  ensureSkillsDir();
  console.info(chalk.bold('Skills Directory:'));
  console.info(`  ${getSkillsDir()}`);
}

/**
 * Install a skill from a source
 * @param {string} source - Install source (github:user/repo or URL)
 * @param {Object} options - Install options
 */
export async function install(source, options = {}) {
  if (!source) {
    console.info(chalk.red('Install source is required'));
    console.info(chalk.gray('\nUsage:'));
    console.info(chalk.gray('  mcpz skill install github:user/repo'));
    console.info(chalk.gray('  mcpz skill install github:user/repo/path/to/skill'));
    console.info(chalk.gray('  mcpz skill install https://github.com/user/repo'));
    return;
  }

  console.info(chalk.gray(`Installing skill from ${source}...`));

  const result = await installSkill(source, options);

  if (result.success) {
    console.info(chalk.green(result.message));
    if (result.skill) {
      console.info(chalk.gray(`  Name: ${result.skill.name}`));
      console.info(chalk.gray(`  Description: ${result.skill.description}`));
      console.info(chalk.gray(`  Path: ${result.skill.path}`));
    }
  } else {
    console.info(chalk.red(result.message));
  }
}

/**
 * Remove an installed skill
 * @param {string} name - Skill name
 */
export function remove(name) {
  if (!name) {
    console.info(chalk.red('Skill name is required'));
    return;
  }

  const result = removeSkill(name);

  if (result.success) {
    console.info(chalk.green(result.message));
  } else {
    console.info(chalk.red(result.message));
  }
}
