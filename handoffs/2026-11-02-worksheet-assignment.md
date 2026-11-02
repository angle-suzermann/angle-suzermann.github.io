# Assign worksheets to selected pupils — 02.11.2026

Teacher-connected browsers can assign a worksheet from its page or a material card. The dialog asks for course, selected pupils (with Choose all / clear), lesson date and Homework / Classwork / Before the lesson.

Individual tasks use the existing plan and latest block with server-assigned numbering. Group worksheets retain their selected recipient list; only those pupils see the assignment and count it in completion. Existing group-wide worksheets keep their behavior. The teacher token is read from existing local browser settings and is never embedded in a worksheet or shared URL.

The complete private server source was backed up and patched, preserving doGet/doPost. The existing deployment was updated without changing its URL or audience. Retry identifiers prevent duplicate rows after an uncertain response.

Validation: local backend fixtures covered recipient isolation, numbering, duplicate retries and existing marks; local UI covered all/subset selection and work type. Build passed. Live API read and empty-selection validation passed without assigning real homework. Local files were updated before publishing.