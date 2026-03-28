// Shared formatting utilities for the Herbal Medicine System

export const formatDate = (date: string | Date | null | undefined, options: Intl.DateTimeFormatOptions = {}): string => {
  if (!date) return '';
  
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return '';
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };
  
  return dateObj.toLocaleDateString('en-US', { ...defaultOptions, ...options });
};

export const formatDateTime = (date: string | Date | null | undefined, options: Intl.DateTimeFormatOptions = {}): string => {
  if (!date) return '';
  
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return '';
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  
  return dateObj.toLocaleString('en-US', { ...defaultOptions, ...options });
};

export const formatRelativeTime = (date: string | Date | null | undefined): string => {
  if (!date) return '';
  
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return '';
  
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return formatDate(dateObj);
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatNumber = (num: number | null | undefined, options: Intl.NumberFormatOptions = {}): string => {
  if (typeof num !== 'number') return '';
  
  const defaultOptions: Intl.NumberFormatOptions = {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  };
  
  return num.toLocaleString('en-US', { ...defaultOptions, ...options });
};

export const formatCurrency = (amount: number | null | undefined, currency = 'USD', locale = 'en-US'): string => {
  if (typeof amount !== 'number') return '';
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

export const formatPercentage = (value: number | null | undefined, decimals = 1): string => {
  if (typeof value !== 'number') return '';
  
  return `${(value * 100).toFixed(decimals)}%`;
};

export const formatPhoneNumber = (phone: string | null | undefined): string => {
  if (!phone) return '';
  
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Check if it's a valid phone number
  if (cleaned.length < 10) return phone;
  
  // Format for US numbers
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  
  // Format for international numbers
  if (cleaned.length > 10) {
    const countryCode = cleaned.slice(0, cleaned.length - 10);
    const mainNumber = cleaned.slice(-10);
    return `+${countryCode} (${mainNumber.slice(0, 3)}) ${mainNumber.slice(3, 6)}-${mainNumber.slice(6)}`;
  }
  
  return phone;
};

export const formatName = (firstName: string | null | undefined, lastName: string | null | undefined): string => {
  if (!firstName && !lastName) return '';
  if (!firstName) return lastName || '';
  if (!lastName) return firstName || '';
  
  return `${firstName} ${lastName}`;
};

export const formatAddress = (address: any): string => {
  if (!address || typeof address !== 'object') return '';
  
  const parts: string[] = [];
  
  if (address.street) parts.push(address.street);
  if (address.city) parts.push(address.city);
  if (address.state) parts.push(address.state);
  if (address.postalCode) parts.push(address.postalCode);
  if (address.country) parts.push(address.country);
  
  return parts.join(', ');
};

export const formatCoordinates = (coordinates: [number, number] | null | undefined, precision = 6): string => {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) return '';
  
  const [lng, lat] = coordinates;
  return `${lat.toFixed(precision)}, ${lng.toFixed(precision)}`;
};

export const formatDuration = (milliseconds: number | null | undefined): string => {
  if (typeof milliseconds !== 'number') return '';
  
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  return `${seconds} second${seconds > 1 ? 's' : ''}`;
};

export const formatConfidence = (confidence: number | null | undefined): string => {
  if (typeof confidence !== 'number') return '';
  
  const percentage = Math.round(confidence * 100);
  return `${percentage}%`;
};

export const formatRating = (rating: number | null | undefined, maxRating = 5): string => {
  if (typeof rating !== 'number') return '';
  
  return `${rating}/${maxRating}`;
};

export const formatList = (items: string[] | null | undefined, options: { conjunction?: string; separator?: string; maxItems?: number | null; showMore?: boolean } = {}): string => {
  if (!Array.isArray(items)) return '';
  
  const { 
    conjunction = 'and', 
    separator = ', ',
    maxItems = null,
    showMore = false 
  } = options;
  
  if (maxItems && items.length > maxItems) {
    const visible = items.slice(0, maxItems);
    const remaining = items.length - maxItems;
    const moreText = showMore ? ` ${conjunction} ${remaining} more` : '...';
    return visible.join(separator) + moreText;
  }
  
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return items.join(` ${conjunction} `);
  
  const lastItem = items[items.length - 1];
  const otherItems = items.slice(0, -1);
  
  return `${otherItems.join(separator)}${separator}${conjunction} ${lastItem}`;
};

export const truncateText = (text: string | null | undefined, maxLength: number, suffix = '...'): string => {
  if (!text || typeof text !== 'string') return '';
  
  if (text.length <= maxLength) return text;
  
  return text.substring(0, maxLength - suffix.length) + suffix;
};

export const capitalize = (str: string | null | undefined): string => {
  if (!str || typeof str !== 'string') return '';
  
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const titleCase = (str: string | null | undefined): string => {
  if (!str || typeof str !== 'string') return '';
  
  return str.replace(/\w\S*/g, (txt) => 
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
};

export const slugify = (str: string | null | undefined): string => {
  if (!str || typeof str !== 'string') return '';
  
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove non-word characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};
