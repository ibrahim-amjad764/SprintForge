// templates/emails/task-assigned.ts
export function taskAssignedEmail(
  task: string,
  url: string
) {
  return `

<h2>
New Task Assigned
</h2>

<p>
You have been assigned:
<b>
${task}
</b>
</p>

<a href="${url}">
Open Task
</a>
`;
}