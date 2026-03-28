// User role constants for the Herbal Medicine System

export const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  EXPERT: 'expert',
};

export const ROLE_PERMISSIONS = {
  [USER_ROLES.USER]: [
    'view:herbs',
    'view:recommendations',
    'create:recommendations',
    'create:feedback',
    'view:blog',
    'create:blog_comment',
    'update:own_profile',
    'use:chatbot',
    'upload:image',
  ],
  [USER_ROLES.MODERATOR]: [
    'view:herbs',
    'view:recommendations',
    'create:recommendations',
    'create:feedback',
    'view:blog',
    'create:blog_comment',
    'update:own_profile',
    'use:chatbot',
    'upload:image',
    'moderate:blog_comments',
    'moderate:feedback',
    'view:analytics_basic',
  ],
  [USER_ROLES.ADMIN]: [
    'view:herbs',
    'create:herb',
    'update:herb',
    'delete:herb',
    'view:recommendations',
    'create:recommendations',
    'update:recommendations',
    'delete:recommendations',
    'view:users',
    'create:user',
    'update:user',
    'delete:user',
    'view:blog',
    'create:blog_post',
    'update:blog_post',
    'delete:blog_post',
    'moderate:blog_comments',
    'create:blog_comment',
    'update:blog_comment',
    'delete:blog_comment',
    'view:feedback',
    'create:feedback',
    'update:feedback',
    'delete:feedback',
    'view:analytics_basic',
    'view:analytics_advanced',
    'view:ml_models',
    'train:ml_models',
    'deploy:ml_models',
    'update:own_profile',
    'use:chatbot',
    'view:chatbot_analytics',
    'upload:image',
    'manage:locations',
    'send:notifications',
    'manage:system_settings',
  ],
  [USER_ROLES.EXPERT]: [
    'view:herbs',
    'view:recommendations',
    'create:recommendations',
    'create:feedback',
    'view:blog',
    'create:blog_comment',
    'update:own_profile',
    'use:chatbot',
    'upload:image',
    'view:analytics_basic',
  ],
};

export const ROLE_HIERARCHY = {
  [USER_ROLES.USER]: 1,
  [USER_ROLES.MODERATOR]: 2,
  [USER_ROLES.EXPERT]: 3,
  [USER_ROLES.ADMIN]: 4,
};

export const DEFAULT_ROLE = USER_ROLES.USER;

export function hasPermission(userRole, permission) {
  return ROLE_PERMISSIONS[userRole]?.includes(permission) || false;
}

export function hasRoleLevel(userRole, requiredRole) {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function getRolePermissions(role) {
  return ROLE_PERMISSIONS[role] || [];
}

export function isRoleHigher(role1, role2) {
  return ROLE_HIERARCHY[role1] > ROLE_HIERARCHY[role2];
}

export function getAllRoles() {
  return Object.values(USER_ROLES);
}
