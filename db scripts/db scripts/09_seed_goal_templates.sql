-- ── Seed 09: Goal templates from Excel source files ───────────────────────────
-- Sources: Team member - General (2).xlsx
--          Team Member - Tester (3).xlsx
--          Team Member - L&D.xlsx
-- Values rows have NULL weightage (assessed separately, not part of 100% sum).
-- Run this once after migration 08.

-- Prevent duplicate seeds on re-run
DELETE FROM goal_templates WHERE role_name IN (
  'Team Member - General',
  'Team Member - Tester',
  'Team Member - L&D'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TEMPLATE 1: Team Member - General
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO goal_templates
  (role_name, objective_type, area, commitment, weightage, kra_title, goal_description, goal_type, goal_performance)
VALUES

-- Financial
('Team Member - General','Financial','Indirect Impact to Financials','Indirect Impact to Financials',
 5,
 'Timely updation of time-sheet',
 'Timely updation of time-sheet',
 'Met or Not Met','The higher the better'),

-- Customer Focus
('Team Member - General','Customer Focus','Project Execution','Focus on Delivery Excellence',
 50,
 'On time achievement of targets as per agreed SLA''s',
 'On time achievement of targets as per agreed SLA''s  ( % of deliveries/tasks made within Schedule/SLA )',
 'Numerical','The higher the better'),

('Team Member - General','Customer Focus','Project Execution','Focus on Delivery Excellence',
 50,
 'Number of Customer Appreciations',
 'Number of Customer Appreciations',
 'Numerical','The higher the better'),

-- Business Processes
('Team Member - General','Business Processes','Knowledge Management','Knowledge Management',
 20,
 'Adhere to the procedure manuals and system and contribute to the repository',
 'Adhere to the procedure manuals and system and contribute to the repository',
 'Met or Not Met','The higher the better'),

('Team Member - General','Business Processes','Knowledge Management','Knowledge Management',
 20,
 'Complete the mandate training hours as prescribed for self',
 'Complete the mandate training hours as prescribed for self (Minimum 5 days Technical/Behavioral/Leadership training)',
 'Numerical','The higher the better'),

('Team Member - General','Business Processes','Knowledge Management','Knowledge Management',
 20,
 'New Joiner Training / Buddy',
 'New Joiner Training / Buddy',
 'Met or Not Met','The higher the better'),

-- People Related
('Team Member - General','People Related','People Management','People Management',
 15,
 'Quality of hire (Proper technical evaluation of the interview candidates)',
 'Quality of hire (Proper technical evaluation of the interview candidates)',
 'Numerical','The higher the better'),

('Team Member - General','People Related','People Management','People Management',
 15,
 'Participate in team-building activities',
 'Participate in team-building activities',
 'Feedback','The higher the better'),

('Team Member - General','People Related','People Management','People Management',
 15,
 'Mentoring team members (Number of Peer Mentoring / Development instances)',
 'Mentoring team members (Number of Peer Mentoring / Development instances)',
 'Feedback','The higher the better'),

('Team Member - General','People Related','People Management','People Management',
 15,
 'Ensure regular 1-1 connect with TL / PM / DM / HR',
 'Ensure regular 1-1 connect with TL / PM / DM / HR',
 'Feedback','The higher the better'),

('Team Member - General','People Related','Organisational','Organisational',
 10,
 'Working from Office',
 'Working from Office',
 'Feedback','The higher the better'),

('Team Member - General','People Related','Organisational','Organisational',
 10,
 'Exhibiting Accion Core values',
 'Exhibiting Accion Core values',
 'Met or Not Met','The higher the better'),

-- Values (no weightage)
('Team Member - General','Values','Total Ownership Mindset','Total Ownership Mindset',
 NULL,'Total Ownership Mindset','Total Ownership Mindset','Met or Not Met','The higher the better'),

('Team Member - General','Values','Humility and Respect','Humility and Respect',
 NULL,'Humility and Respect','Humility and Respect','Met or Not Met','The higher the better'),

('Team Member - General','Values','Result Oriented','Result Oriented',
 NULL,'Result Oriented','Result Oriented','Met or Not Met','The higher the better'),

('Team Member - General','Values','Innovation Everywhere','Innovation Everywhere',
 NULL,'Innovation Everywhere','Innovation Everywhere','Met or Not Met','The higher the better'),

('Team Member - General','Values','Value Creation','Value Creation',
 NULL,'Value Creation','Value Creation','Met or Not Met','The higher the better'),

('Team Member - General','Values','Eagerness To Learn','Eagerness To Learn',
 NULL,'Eagerness To Learn','Eagerness To Learn','Met or Not Met','The higher the better'),

('Team Member - General','Values','Zest for a life','Zest for a life',
 NULL,'Zest for a life','Zest for a life','Met or Not Met','The higher the better');


-- ─────────────────────────────────────────────────────────────────────────────
-- TEMPLATE 2: Team Member - Tester
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO goal_templates
  (role_name, objective_type, area, commitment, weightage, kra_title, goal_description, goal_type, goal_performance)
VALUES

-- Financial
('Team Member - Tester','Financial','Indirect Impact to Financials','Indirect Impact to Financials',
 5,
 'Completion of sprints on time',
 'Every Sprint/Task/Enhancement should be completed on time and in good quality',
 'Numerical','The higher the better'),

('Team Member - Tester','Financial','Indirect Impact to Financials','Indirect Impact to Financials',
 5,
 'Timely updation of timesheet and planning leaves',
 'Timely updation of timesheet and planning leaves',
 'Met or Not Met','The higher the better'),

-- Customer Focus
('Team Member - Tester','Customer Focus','Project Execution','Focus on Delivery Excellence',
 45,
 'Coverage of Acceptance criteria for each User stories',
 '90% coverage of Acceptance criteria for each User stories',
 'Numerical','The higher the better'),

('Team Member - Tester','Customer Focus','Project Execution','Focus on Delivery Excellence',
 45,
 'Improving quality of output',
 'Improving quality of output',
 'Numerical','The higher the better'),

('Team Member - Tester','Customer Focus','Project Execution','Delivery Process Compliance',
 20,
 'On time sprint delivery',
 '90% on time sprint delivery',
 'Feedback','The higher the better'),

('Team Member - Tester','Customer Focus','Project Execution','Delivery Process Compliance',
 20,
 'Daily track on Jira Board',
 'Daily track on Jira Board',
 'Numerical','The higher the better'),

('Team Member - Tester','Customer Focus','Project Execution','Delivery Process Compliance',
 20,
 'Ensuring 100% update of task by Team members',
 'Ensuring 100% update of task by Team members',
 'Met or Not Met','The higher the better'),

-- Business Processes
('Team Member - Tester','Business Processes','Knowledge Management','Knowledge Management',
 10,
 'KT Plan tracker',
 '90% KT Plan tracker',
 'Numerical','The higher the better'),

('Team Member - Tester','Business Processes','Knowledge Management','Knowledge Management',
 10,
 'Maintenance of repository with all project related documents',
 'Maintenance of repository with all project related documents',
 'Met or Not Met','The higher the better'),

('Team Member - Tester','Business Processes','Knowledge Management','Knowledge Management',
 10,
 '90% update with all KT session recording and documents in repository',
 '90% update with all KT session recording and documents in repository',
 'Feedback','The higher the better'),

('Team Member - Tester','Business Processes','Operations','Operations',
 5,
 'Connect with Stakeholder for backlog grooming, product enhancements, product marketing',
 'Weekly/Bi-Weekly connect with Stakeholder for backlog grooming, product enhancements, product marketing',
 'Numerical','The higher the better'),

('Team Member - Tester','Business Processes','Operations','Operations',
 5,
 'Adherence to the process on sprint planning',
 '90% adherence to the process on sprint planning',
 'Numerical','The higher the better'),

-- People Related
('Team Member - Tester','People Related','People Management','People Management',
 5,
 'Quality of hire (Proper technical evaluation of the interview candidates)',
 'Quality of hire (Proper technical evaluation of the interview candidates)',
 'Numerical','The higher the better'),

('Team Member - Tester','People Related','People Management','People Management',
 5,
 'Participate in team-building activities',
 'Participate in team-building activities',
 'Feedback','The higher the better'),

('Team Member - Tester','People Related','People Management','People Management',
 5,
 'Attend KYC (Know your customer) Training conducted for each team member',
 'Attend KYC (Know your customer) Training conducted for each team member',
 'Feedback','The higher the better'),

('Team Member - Tester','People Related','People Management','People Management',
 5,
 'Mentoring team members (Number of Peer Mentoring / Development instances)',
 'Mentoring team members (Number of Peer Mentoring / Development instances)',
 'Feedback','The higher the better'),

('Team Member - Tester','People Related','People Management','People Management',
 5,
 'Ensure regular 1-1 connect with TL / PM / DM / HR',
 'Ensure regular 1-1 connect with TL / PM / DM / HR',
 'Met or Not Met','The higher the better'),

('Team Member - Tester','People Related','Organisational','Organisational',
 10,
 'Contribution to Technology and Innovation (participation in Hackathons, innovation summit)',
 'Contribution to Technology and Innovation (participation in Hackathons, technology related to innovation summit)',
 'Numerical','The higher the better'),

('Team Member - Tester','People Related','Organisational','Organisational',
 10,
 'Self learning and Contribution to Technology training sessions',
 'Explore and learn one new technology every Quarter; Giving Training to internal/external team; Attending training, Tech Tuesdays, Thursday Demos; Contributing to Tech Tuesday; Participating in innovative activities like Accathon',
 'Numerical','The higher the better'),

('Team Member - Tester','People Related','Organisational','Organisational',
 10,
 'Working from Office',
 'Follow the work from office policy defined for the engagement',
 'Numerical','The higher the better'),

('Team Member - Tester','People Related','Organisational','Organisational',
 10,
 'Exhibiting Accion Core values',
 'Exhibiting Accion Core values',
 'Met or Not Met','The higher the better'),

-- Values (no weightage)
('Team Member - Tester','Values','Total Ownership Mindset','Total Ownership Mindset',
 NULL,'Total Ownership Mindset','Total Ownership Mindset','Met or Not Met','The higher the better'),

('Team Member - Tester','Values','Humility and Respect','Humility and Respect',
 NULL,'Humility and Respect','Humility and Respect','Met or Not Met','The higher the better'),

('Team Member - Tester','Values','Result Oriented','Result Oriented',
 NULL,'Result Oriented','Result Oriented','Met or Not Met','The higher the better'),

('Team Member - Tester','Values','Innovation Everywhere','Innovation Everywhere',
 NULL,'Innovation Everywhere','Innovation Everywhere','Met or Not Met','The higher the better'),

('Team Member - Tester','Values','Value Creation','Value Creation',
 NULL,'Value Creation','Value Creation','Met or Not Met','The higher the better'),

('Team Member - Tester','Values','Eagerness To Learn','Eagerness To Learn',
 NULL,'Eagerness To Learn','Eagerness To Learn','Met or Not Met','The higher the better'),

('Team Member - Tester','Values','Zest for a life','Zest for a life',
 NULL,'Zest for a life','Zest for a life','Met or Not Met','The higher the better');


-- ─────────────────────────────────────────────────────────────────────────────
-- TEMPLATE 3: Team Member - L&D
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO goal_templates
  (role_name, objective_type, area, commitment, weightage, kra_title, goal_description, goal_type, goal_performance)
VALUES

-- Financial
('Team Member - L&D','Financial','Indirect Impact to Financials','Indirect Impact to Financials',
 15,
 'Variance of L&D plan (Budget) Vs. Expenses',
 'Variance of L&D plan (Budget) Vs. Expenses',
 'Met or Not Met','The higher the better'),

-- Customer Focus
('Team Member - L&D','Customer Focus','Project Execution','Delivery Process Compliance',
 15,
 'Training Need Collection Vs. Delivery',
 'Work with Delivery teams / Employees / Management and have training needs identified',
 'Met or Not Met','The higher the better'),

('Team Member - L&D','Customer Focus','Project Execution','Delivery Process Compliance',
 15,
 'Employee Requests / Query',
 'Timely update and resolving the Learning function queries for certificate reimbursement / Udemy licenses / Training related queries',
 'Numerical','The higher the better'),

('Team Member - L&D','Customer Focus','Project Execution','Focus on Delivery Excellence',
 15,
 'Customer Feedback score',
 'E SAT / GPTW Feedback Score against L&D team (> 80)',
 'Met or Not Met','The higher the better'),

-- Business Processes - Operations
('Team Member - L&D','Business Processes','Operations','Operations',
 40,
 'Course Registration and Attendance rate',
 'Receipt and consolidation of Training Nominations',
 'Numerical','The higher the better'),

('Team Member - L&D','Business Processes','Operations','Operations',
 40,
 'Overall Global Training Coverage',
 'Overall Global Training Coverage',
 'Numerical','The higher the better'),

('Team Member - L&D','Business Processes','Operations','Operations',
 40,
 'SME Management',
 'Add new SMEs into Accion University; Employees above Manager level to mandatorily take 2 sessions; Timely reward and recognition for the internal SMEs',
 'Numerical','The higher the better'),

('Team Member - L&D','Business Processes','Operations','Operations',
 40,
 'Training Effectiveness',
 'Collect Training feedback post completion; Identify GAPS / Areas of Improvement; Collect skill enhancement update from Managers post 2 months of training completion',
 'Met or Not Met','The higher the better'),

('Team Member - L&D','Business Processes','Operations','Operations',
 40,
 'Ensure Smooth delivery of all sessions organised by L&D team',
 'Ensure Smooth delivery of all sessions organised by L&D team',
 'Met or Not Met','The higher the better'),

('Team Member - L&D','Business Processes','Operations','Operations',
 40,
 'L&D Operations: Learning MIS / Communication Mailers / Calendar Invitations',
 'Prepare L&D Dashboard covering no. of training programs, Training Man hours and certified employees; Sending out L&D communications such as Learning calendar, Learning glimpses, TOM posters and Induction posters; Sending out calendar invites for sessions',
 'Met or Not Met','The higher the better'),

('Team Member - L&D','Business Processes','Operations','Operations',
 40,
 'Compliance Training and Induction Coverage',
 'ISMS and POSH training for all existing employees; New Joiners trained as part of Induction / Orientation',
 'Met or Not Met','The higher the better'),

-- Business Processes - Knowledge Management
('Team Member - L&D','Business Processes','Knowledge Management','Knowledge Management',
 10,
 'Adhere to the procedure manuals and system and contribute to the repository',
 'Adhere to the procedure manuals and system and contribute to the repository',
 'Met or Not Met','The higher the better'),

('Team Member - L&D','Business Processes','Knowledge Management','Knowledge Management',
 10,
 'Complete the mandate training hours as prescribed for self',
 'Complete the mandate training hours as prescribed for self (Minimum 5 days Technical/Behavioral/Leadership training)',
 'Numerical','The higher the better'),

-- People Related
('Team Member - L&D','People Related','Organisational','Organisational',
 5,
 'Working from Office',
 'Adhere to in-office collaboration norms and be available for key team syncs',
 'Numerical','The higher the better'),

('Team Member - L&D','People Related','Organisational','Organisational',
 5,
 'Exhibiting Accion Core values',
 'Exhibiting Accion Core values',
 'Met or Not Met','The higher the better'),

-- Values (no weightage)
('Team Member - L&D','Values','Total Ownership Mindset','Total Ownership Mindset',
 NULL,'Total Ownership Mindset','Total Ownership Mindset','Met or Not Met','The higher the better'),

('Team Member - L&D','Values','Humility and Respect','Humility and Respect',
 NULL,'Humility and Respect','Humility and Respect','Met or Not Met','The higher the better'),

('Team Member - L&D','Values','Result Oriented','Result Oriented',
 NULL,'Result Oriented','Result Oriented','Met or Not Met','The higher the better'),

('Team Member - L&D','Values','Innovation Everywhere','Innovation Everywhere',
 NULL,'Innovation Everywhere','Innovation Everywhere','Met or Not Met','The higher the better'),

('Team Member - L&D','Values','Value Creation','Value Creation',
 NULL,'Value Creation','Value Creation','Met or Not Met','The higher the better'),

('Team Member - L&D','Values','Eagerness To Learn','Eagerness To Learn',
 NULL,'Eagerness To Learn','Eagerness To Learn','Met or Not Met','The higher the better'),

('Team Member - L&D','Values','Zest for a life','Zest for a life',
 NULL,'Zest for a life','Zest for a life','Met or Not Met','The higher the better');
