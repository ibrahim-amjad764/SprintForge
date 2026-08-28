// services/ai.service.ts

import openai from '@/lib/openai';

/*

AI Business Logic

All AI features
go through this service.

*/

export async function generateTaskBreakdown(task: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    response_format: { type: "json_object" },
    messages: [
      {
        role: 'system',
        content: 'You are a project management assistant. Break down tasks into actionable sub-tasks with priorities and estimated deadlines.',
      },
      {
        role: 'user',
        content: `
Break this task into smaller actionable sub-tasks:
${task}

Return a JSON object with this structure:
{
  "subtasks": [
    {
      "title": "Task title",
      "description": "Brief description",
      "priority": "HIGH|MEDIUM|LOW",
      "estimatedDays": number
    }
  ]
}

Analyze the task description to determine appropriate priority based on urgency and complexity. Estimate completion time in days.
`,
      },
    ],
  });

  const content = response.choices[0].message.content;
  try {
    return JSON.parse(content || '{}');
  } catch {
    return { subtasks: [] };
  }
}

export async function generateSummary(project: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',

    messages: [
      {
        role: 'system',
        content: 'You summarize software projects.',
      },
      {
        role: 'user',
        content: `
Create project summary:

${project}
`,
      },
    ],
  });

  return response.choices[0].message.content;
}
