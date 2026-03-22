/**
 * Pre-built collaboration chain templates for common workflows.
 *
 * Each template defines an ordered sequence of agents to consult and a
 * task template string that is expanded with the user's taskDescription at runtime.
 *
 * Note: 'charlie' is excluded from all template sequences — the charlie persona
 * is not yet fully configured (RESEARCH.md open question #1).
 */
import type { AgentId } from '@/types/agent';
import type { ChainTemplate } from '@/types/collaboration';

export const CHAIN_TEMPLATES: ChainTemplate[] = [
  {
    id: 'screenplay-evaluation',
    name: 'Screenplay Evaluation',
    description: 'Full creative, development, and market evaluation pipeline',
    sequence: ['isaac', 'sandra', 'patrik', 'marcos', 'wendy'] as AgentId[],
    taskTemplate: 'Evaluate this screenplay/project: {taskDescription}. Provide your domain perspective.',
  },
  {
    id: 'deal-review',
    name: 'Deal Review',
    description: 'Legal, financial, and production review of a deal structure',
    sequence: ['marcos', 'patrik', 'sandra'] as AgentId[],
    taskTemplate: 'Review this deal structure: {taskDescription}.',
  },
  {
    id: 'fund-structuring',
    name: 'Fund Structuring',
    description: 'Financial, legal, and production input on fund structure',
    sequence: ['patrik', 'marcos', 'sandra'] as AgentId[],
    taskTemplate: 'Provide input on fund structure: {taskDescription}.',
  },
  {
    id: 'project-packaging',
    name: 'Project Packaging',
    description: 'Packaging, legal, and financial sequencing for project setup',
    sequence: ['wendy', 'sandra', 'patrik'] as AgentId[],
    taskTemplate: 'Help package this project: {taskDescription}.',
  },
];

/**
 * Retrieves a chain template by its ID.
 * Returns undefined if not found.
 */
export function getTemplate(id: string): ChainTemplate | undefined {
  return CHAIN_TEMPLATES.find(t => t.id === id);
}

/**
 * Expands a template's taskTemplate with the actual task description.
 * Replaces {taskDescription} placeholder with the provided string.
 */
export function expandTemplate(template: ChainTemplate, taskDescription: string): string {
  return template.taskTemplate.replace('{taskDescription}', taskDescription);
}
