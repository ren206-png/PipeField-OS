// ============================================================
// trial-notifications-copy.ts
// Single source of truth for all trial notification copy.
//
// ⚠️  Edit ONLY this file to change subject lines, body text,
//     or in-app notification strings. Never inline copy in the
//     cron handler or email templates.
//
// Milestones:
//   day_7  — trial is at the midpoint; friendly reminder
//   day_11 — 3 days left; urgency increases
//   day_13 — final day; strong CTA
//
// Each milestone has:
//   key         unique key stored in trial_notifications_sent
//   daysLeft    days remaining in the trial when this fires
//   subject     email subject line
//   preheader   email preheader text (shown in inbox preview)
//   headline    bold heading inside the email
//   body        main paragraph text (plain; HTML-escaped in template)
//   cta         call-to-action button label
//   inAppTitle  title of the in-app notification
//   inAppBody   body of the in-app notification (short)
// ============================================================

export type TrialMilestoneKey = 'day_7' | 'day_11' | 'day_13'

export interface TrialMilestone {
  key:        TrialMilestoneKey
  daysLeft:   number
  subject:    string
  preheader:  string
  headline:   string
  body:       string
  cta:        string
  inAppTitle: string
  inAppBody:  string
}

export const TRIAL_MILESTONES: TrialMilestone[] = [
  {
    key:       'day_7',
    daysLeft:  7,
    subject:   '🛠 7 days left in your PipeField OS trial',
    preheader: 'Your free trial is halfway through. Choose a plan to keep full access.',
    headline:  'You have 7 days left in your free trial.',
    body:
      'Your PipeField OS trial is at the halfway mark. You\'re getting ' +
      'full access to weld tracking, spool management, QA/QC documentation, ' +
      'and every other feature on the platform.\n\n' +
      'To keep your data and uninterrupted access after the trial, choose a ' +
      'plan that fits your crew size. Plans start at $49/month.',
    cta:        'Choose a Plan',
    inAppTitle: '7 days left in your trial',
    inAppBody:  'Choose a plan before your trial ends to keep full access.',
  },
  {
    key:       'day_11',
    daysLeft:  3,
    subject:   '⏰ 3 days left — your PipeField OS trial ends soon',
    preheader: 'Add a plan now to avoid any interruption to your field operations.',
    headline:  '3 days left in your free trial.',
    body:
      'Your PipeField OS trial ends in 3 days. After that, write access ' +
      'is paused until you subscribe — but your data is never deleted.\n\n' +
      'Adding a plan takes less than 2 minutes and your card won\'t be ' +
      'charged until the trial ends. Cancel any time before then and pay nothing.',
    cta:        'Add a Plan Now',
    inAppTitle: '3 days left in your trial',
    inAppBody:  'Add a plan to avoid any interruption to your field operations.',
  },
  {
    key:       'day_13',
    daysLeft:  1,
    subject:   '🚨 Last day — your PipeField OS trial ends tomorrow',
    preheader: 'Act today to keep your welds, spools, and documents accessible.',
    headline:  'Your trial ends tomorrow.',
    body:
      'This is your last reminder — your PipeField OS free trial expires tomorrow.\n\n' +
      'After it ends, your account will enter read-only mode until you subscribe. ' +
      'All your welds, spools, documents, and reports stay safe — you\'ll just ' +
      'lose write access until a plan is active.\n\n' +
      'Subscribe now and your card still won\'t be charged until the trial period ends today.',
    cta:        'Subscribe Before It Ends',
    inAppTitle: 'Trial ends tomorrow',
    inAppBody:  'Subscribe today to keep creating welds, reports, and documents.',
  },
]

