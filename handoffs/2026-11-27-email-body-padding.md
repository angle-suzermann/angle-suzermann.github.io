# Email body inset — 27.11.2026

Reported on a2-key-for-schools/Wiseman Teens A2/finishing-line: the displayed Giles email text touched the frame edge. Added shared `.email-frame > .text-box { padding:14px 16px }` and removed the final child bottom margin to keep the lower inset even. Applies to matching display/cloze bodies across the site and future materials. Email bars and writing textareas retain their existing styles.

build.mjs now injects worksheet-ui.css v3. Local sources saved before publication; backup in ANGLE Memory/output/email-padding-backup-20261127.

Validation: full node build.mjs passed (362 teacher-catalog materials). Browser check visited all 11 current email-frame materials at 390/1280px and confirmed padding on all 18 body/view combinations. In the reported email, a cloze field remained editable and the frame had no horizontal overflow. Desktop/mobile screenshots inspected after the page fade-in completed; output/email-padding-390.png and email-padding-1280.png. QA requests were intercepted, no real submissions sent. git diff --check passed.
