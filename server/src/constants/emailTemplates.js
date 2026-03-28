const USER_STATUS_TEMPLATES = {
  policy_violation: {
    key: 'policy_violation',
    label: 'Policy Violation',
    subject: 'Your Account Has Been Deactivated',
    body: 'Your account was deactivated because it violated our community policy.',
  },
  suspicious_activity: {
    key: 'suspicious_activity',
    label: 'Suspicious Activity',
    subject: 'Your Account Has Been Deactivated',
    body: 'Your account was temporarily deactivated due to suspicious activity.',
  },
  requested_by_user: {
    key: 'requested_by_user',
    label: 'Requested By User',
    subject: 'Your Account Has Been Deactivated',
    body: 'Your account has been deactivated based on your request.',
  },
  compliance_requirement: {
    key: 'compliance_requirement',
    label: 'Compliance Requirement',
    subject: 'Your Account Has Been Deactivated',
    body: 'Your account was deactivated to comply with a policy or legal requirement.',
  },
};

const BLOG_TEMPLATES = {
  approved: {
    key: 'approved',
    subject: 'A New Blog Post Was Approved',
    heading: 'New Approved Blog Post',
  },
  published: {
    key: 'published',
    subject: 'A New Blog Post Is Live',
    heading: 'New Published Blog Post',
  },
};

const USER_REACTIVATION_TEMPLATE = {
  key: 'reactivated',
  subject: 'Your Account Has Been Reactivated',
  body: 'Your account has been reactivated. You can now sign in and continue using the platform.',
};

const getUserStatusTemplate = (key) => USER_STATUS_TEMPLATES[key] || null;

const getUserStatusTemplateOptions = () =>
  Object.values(USER_STATUS_TEMPLATES).map((template) => ({
    key: template.key,
    label: template.label,
    subject: template.subject,
  }));

module.exports = {
  USER_STATUS_TEMPLATES,
  BLOG_TEMPLATES,
  USER_REACTIVATION_TEMPLATE,
  getUserStatusTemplate,
  getUserStatusTemplateOptions,
};
