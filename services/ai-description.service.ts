// services/ai-description.service.ts
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateWorkspaceDescription(params: {
  name: string;
  template?: string;
  industry?: string;
  teamSize?: number;
}): Promise<string> {
  try {
    const { name, template, industry, teamSize } = params;
    
    const prompt = `Generate a professional workspace description for a project called "${name}".
    ${template ? `Template type: ${template}.` : ''}
    ${industry ? `Industry: ${industry}.` : ''}
    ${teamSize ? `Team size: ${teamSize} members.` : ''}
    
    The description should be:
    - Professional and concise (2-3 sentences)
    - Highlight the workspace's purpose
    - Mention collaboration and productivity
    - Be suitable for a team management platform
    
    Return only the description text, no additional commentary.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that generates professional workspace descriptions for team management platforms."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    const description = completion.choices[0]?.message?.content?.trim() || 
      `A collaborative workspace for ${name}, designed to streamline team productivity and project management.`;
    
    return description;
  } catch (error) {
    console.error('Error generating AI description:', error);
    // Fallback description if AI fails
    return `A collaborative workspace for ${params.name}, designed to streamline team productivity and project management.`;
  }
}

export async function generateWorkspaceSuggestions(params: {
  name: string;
  industry?: string;
}): Promise<{
  description: string;
  suggestedTags: string[];
  recommendedIntegrations: string[];
}> {
  try {
    const { name, industry } = params;
    
    const prompt = `For a workspace called "${name}"${industry ? ` in the ${industry} industry` : ''}, suggest:
    1. A brief description (2-3 sentences)
    2. 5 relevant tags (comma-separated)
    3. 3 recommended integrations from: Slack, Microsoft Teams, Google Calendar, Outlook Calendar, GitHub, GitLab
    
    Return as JSON with keys: description, tags (array), integrations (array).`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that provides workspace suggestions. Return valid JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 200,
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const response = JSON.parse(completion.choices[0]?.message?.content || '{}');
    
    return {
      description: response.description || `A collaborative workspace for ${name}.`,
      suggestedTags: response.tags || ['collaboration', 'productivity', 'teamwork'],
      recommendedIntegrations: response.integrations || ['Slack', 'Google Calendar']
    };
  } catch (error) {
    console.error('Error generating AI suggestions:', error);
    return {
      description: `A collaborative workspace for ${params.name}.`,
      suggestedTags: ['collaboration', 'productivity', 'teamwork'],
      recommendedIntegrations: ['Slack', 'Google Calendar']
    };
  }
}
