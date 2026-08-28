// templates/emails/invitation.ts

export function invitationEmail(
  workspace: string,
  url: string
) {
  return `

<h2>
Workspace Invitation
</h2>

<p>
You have been invited to join:

<b>
${workspace}
</b>
</p>

<a href="${url}">
Accept Invitation
</a>
`;
}
